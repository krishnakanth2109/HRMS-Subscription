import Razorpay from "razorpay";
import crypto from "crypto";
import PlanSetting from "../models/planSettingModel.js";
import Admin from "../models/adminModel.js";
import { getBillableEmployeesCount } from "../utils/billingHelper.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const isSameBillingDay = (date1, date2) => {
  if (!date1 || !date2) return false;
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return d1.getDate() === d2.getDate();
};

const mergeSameDateAddonsIntoMain = (admin, oldPlanExpiresAt) => {
  let mergedSeats = 0;

  (admin.limitAddons || []).forEach((addon) => {
    const alreadyBilledWithMain =
      (addon.razorpayPaymentId && admin.razorpayPaymentId && addon.razorpayPaymentId === admin.razorpayPaymentId) ||
      (addon.razorpayOrderId && admin.razorpayOrderId && addon.razorpayOrderId === admin.razorpayOrderId);

    if (alreadyBilledWithMain && !addon.mergedIntoMainPlan) {
      addon.isPaid = false;
      addon.mergedIntoMainPlan = true;
      addon.mergedAt = new Date();
      return;
    }

    if (
      addon.isPaid &&
      !addon.mergedIntoMainPlan &&
      addon.expiresAt &&
      isSameBillingDay(addon.expiresAt, oldPlanExpiresAt)
    ) {
      mergedSeats += addon.addonLimit || 0;
      addon.isPaid = false;
      addon.mergedIntoMainPlan = true;
      addon.mergedAt = new Date();
    }
  });

  return mergedSeats;
};

const isAddonAlreadyMainBilled = (addon, admin) =>
  addon.mergedIntoMainPlan ||
  (addon.razorpayPaymentId && admin.razorpayPaymentId && addon.razorpayPaymentId === admin.razorpayPaymentId) ||
  (addon.razorpayOrderId && admin.razorpayOrderId && addon.razorpayOrderId === admin.razorpayOrderId);

/* ─────────────────────────────────────────────
   1.  CREATE ORDER
   POST /api/razorpay/create-order
   Called before the Razorpay popup opens
 ───────────────────────────────────────────── */
export const createOrder = async (req, res) => {
  try {
    const { plan, signupForm, userLimit = 30 } = req.body;

    if (!plan || !signupForm) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // Fetch plan from DB (accept both planName and name from frontend)
    const planInfo = await PlanSetting.findOne({
      planName: plan.planName || plan.name,
    });

    if (!planInfo) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    if (planInfo.price === 0) {
      return res
        .status(400)
        .json({ message: "Free plan does not require payment" });
    }

    const limit = Math.max(30, Number(userLimit) || 30);

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(planInfo.price * limit * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: {
        name: signupForm.name,
        email: signupForm.email,
        phone: signupForm.phone || "",
        role: signupForm.role || "admin",
        department: signupForm.department || "",
        plan: planInfo.planName,
        durationDays: planInfo.durationDays.toString(),
        billingCycle: planInfo.billingCycle || "monthly",
        employeeCount: limit.toString(),
        userLimit: limit.toString(),
        amount: (amountInPaise / 100).toString(),
        isUpgrade: req.body.isUpgrade ? "true" : "false",
        // NOTE: Never store raw password in notes for real prod.
        // We send it here only because webhook needs it to create the admin.
        // Consider encrypting or using a one-time token in production.
        password: signupForm.password || "EXISTING_USER",
      },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID, // sent so frontend doesn't need VITE_ env
    });
  } catch (err) {
    console.error("RAZORPAY CREATE ORDER ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   2.  VERIFY PAYMENT & PROVISION ADMIN
   POST /api/razorpay/verify-payment
   Called by frontend after the popup succeeds.
   This is the primary provisioning path.
 ───────────────────────────────────────────── */
export const verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      signupForm,
      plan,
    } = req.body;

    // ── Signature verification ──────────────────────────────────────────────
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error("❌ Razorpay signature mismatch");
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // ── Fetch order from Razorpay to get notes (source of truth) ────────────
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = order.notes || {};

    const {
      name,
      email,
      password,
      phone,
      department,
      role,
      plan: planName,
      durationDays,
      billingCycle,
      userLimit,
    } = notes;

    if (!name || !email || !password || !planName) {
      console.error("❌ Missing order notes:", notes);
      return res
        .status(400)
        .json({ message: "Order metadata incomplete. Contact support." });
    }

    // ── Upsert admin ────────────────────────────────────────────────────────
    const existing = await Admin.findOne({ email });

    // ── Calculate subscription window using precise calendar cycles ───────────
    let activatedAt = new Date();
    let expiresAt = new Date();
    if (existing && existing.plan === planName && existing.planExpiresAt && new Date(existing.planExpiresAt) > new Date()) {
      // Extend early renewal from existing expiration date ONLY if the plan is the same
      activatedAt = new Date(existing.planExpiresAt);
      expiresAt = new Date(existing.planExpiresAt);
    }

    if (billingCycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (billingCycle === "quarterly") {
      expiresAt.setMonth(expiresAt.getMonth() + 3);
    } else if (billingCycle === "halfYearly") {
      expiresAt.setMonth(expiresAt.getMonth() + 6);
    } else if (billingCycle === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (durationDays) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    if (existing) {
      const oldPlanExpiresAt = existing.planExpiresAt;
      const mergedAddonSeats = mergeSameDateAddonsIntoMain(existing, oldPlanExpiresAt);
      const requestedUserLimit = Number(userLimit) || 30;
      const renewedUserLimit = Math.max(requestedUserLimit, (existing.userLimit || 30) + mergedAddonSeats);

      existing.plan = planName;
      existing.userLimit = renewedUserLimit;
      existing.isPaid = true;
      existing.razorpayOrderId = razorpay_order_id;
      existing.razorpayPaymentId = razorpay_payment_id;
      existing.planActivatedAt = activatedAt;
      existing.planExpiresAt = expiresAt;
      existing.lastPaymentAt = new Date();
      existing.lastPaymentAmount = Number(notes.amount) || 0;
      await existing.save();
      console.log("✅ Admin plan upgraded:", email);
    } else {
      await Admin.create({
        name,
        email,
        password, // hashed by schema pre-save hook
        phone: phone || "",
        department: department || "Administration",
        role: role || "admin",
        plan: planName,
        userLimit: Number(userLimit) || 30,
        isPaid: true,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
        lastPaymentAt: new Date(),
        lastPaymentAmount: Number(notes.amount) || 0,
      });
      console.log("✅ Paid admin created:", email);
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and account activated",
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error("RAZORPAY VERIFY ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   3.  WEBHOOK HANDLER
   POST /api/razorpay/webhook
   Fallback / async confirmation from Razorpay.
   Handles cases where the browser closed before
   verifyPayment was called.
 ───────────────────────────────────────────── */
export const razorpayWebhookHandler = async (req, res) => {
  console.log("🚀 RAZORPAY WEBHOOK HIT");

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const receivedSignature = req.headers["x-razorpay-signature"];

  // ── Signature check ─────────────────────────────────────────────────────
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(JSON.stringify(req.body))  // req.body is already parsed JSON here
    .digest("hex");

  if (expectedSignature !== receivedSignature) {
    console.error("❌ Razorpay webhook signature failed");
    return res.status(400).send("Webhook signature verification failed");
  }

  const event = req.body.event;
  console.log("🔥 Razorpay Event:", event);

  // ── Only handle payment.captured ─────────────────────────────────────────
  if (event !== "payment.captured") {
    return res.json({ received: true });
  }

  const payment = req.body.payload?.payment?.entity;
  if (!payment) return res.json({ received: true });

  const orderId = payment.order_id;
  const paymentId = payment.id;

  try {
    // Fetch the order to get notes (metadata)
    const order = await razorpay.orders.fetch(orderId);
    const notes = order.notes || {};

    const {
      name,
      email,
      password,
      phone,
      department,
      role,
      plan: planName,
      durationDays,
      billingCycle,
      userLimit,
    } = notes;

    if (!name || !email || !password || !planName) {
      console.error("❌ Webhook: missing order notes:", notes);
      return res.json({ received: true });
    }

    // Check if admin was already provisioned by verifyPayment
    const existing = await Admin.findOne({ email });

    if (existing && existing.razorpayPaymentId === paymentId) {
      console.log("ℹ️ Already provisioned via verifyPayment, skipping:", email);
      return res.json({ received: true });
    }

    const activatedAt = new Date();
    let expiresAt = new Date();
    if (existing && existing.plan === planName && existing.planExpiresAt && new Date(existing.planExpiresAt) > new Date()) {
      expiresAt = new Date(existing.planExpiresAt);
    }

    if (billingCycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else if (billingCycle === "quarterly") {
      expiresAt.setMonth(expiresAt.getMonth() + 3);
    } else if (billingCycle === "halfYearly") {
      expiresAt.setMonth(expiresAt.getMonth() + 6);
    } else if (billingCycle === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else if (durationDays) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 30);
    }

    if (existing) {
      const oldPlanExpiresAt = existing.planExpiresAt;
      const mergedAddonSeats = mergeSameDateAddonsIntoMain(existing, oldPlanExpiresAt);
      const requestedUserLimit = Number(userLimit) || 30;
      const renewedUserLimit = Math.max(requestedUserLimit, (existing.userLimit || 30) + mergedAddonSeats);

      existing.plan = planName;
      existing.userLimit = renewedUserLimit;
      existing.isPaid = true;
      existing.razorpayOrderId = orderId;
      existing.razorpayPaymentId = paymentId;
      existing.planActivatedAt = activatedAt;
      existing.planExpiresAt = expiresAt;
      existing.lastPaymentAt = payment.created_at ? new Date(payment.created_at * 1000) : new Date();
      existing.lastPaymentAmount = payment.amount ? payment.amount / 100 : 0;
      await existing.save();
      console.log("✅ Webhook: admin plan upgraded:", email);
    } else {
      await Admin.create({
        name,
        email,
        password,
        phone: phone || "",
        department: department || "Administration",
        role: role || "admin",
        plan: planName,
        userLimit: Number(userLimit) || 30,
        isPaid: true,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
        lastPaymentAt: payment.created_at ? new Date(payment.created_at * 1000) : new Date(),
        lastPaymentAmount: payment.amount ? payment.amount / 100 : 0,
      });
      console.log("✅ Webhook: paid admin created:", email);
    }
  } catch (dbErr) {
    console.error("❌ Webhook DB error:", dbErr.message);
  }

  res.json({ received: true });
};

/* ─────────────────────────────────────────────
   4.  GET BILLING HISTORY
   GET /api/razorpay/billing-history
   Fetches paid bills/invoices directly from Razorpay
 ───────────────────────────────────────────── */
export const getBillingHistory = async (req, res) => {
  try {
    const adminEmail = req.user.email.toLowerCase().trim();

    // Fetch last 100 payments from Razorpay
    const paymentsResponse = await razorpay.payments.all({ count: 100 });
    const payments = paymentsResponse.items || [];

    // Filter payments for this admin email and only return captured/successful payments
    const history = payments
      .filter((p) => p.status === "captured" && p.notes && p.notes.email && p.notes.email.toLowerCase().trim() === adminEmail)
      .map((p) => {
        const isAddon = p.notes.isAddon === "true";
        return {
          paymentId: p.id,
          orderId: p.order_id,
          amount: p.amount / 100, // convert paise to INR
          plan: p.notes.plan || "N/A",
          billingCycle: p.notes.billingCycle || "N/A",
          // For addon payments use addonLimit as the seat count; for plan payments use employeeCount
          employeeCount: isAddon
            ? parseInt(p.notes.addonLimit) || 0
            : p.notes.employeeCount ? parseInt(p.notes.employeeCount) : 1,
          isAddon,
          method: p.method,
          status: p.status,
          date: new Date(p.created_at * 1000).toISOString(),
        };
      });

    return res.status(200).json(history);
  } catch (err) {
    console.error("GET BILLING HISTORY ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};


/* ─────────────────────────────────────────────
   5.  GET NEXT BILL INFO
   GET /api/razorpay/next-bill
   Calculates next billing date and total renewal price based on billable seats
 ───────────────────────────────────────────── */
export const getNextBillInfo = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ message: "Admin profile not found" });
    }

    const planInfo = await PlanSetting.findOne({ planName: admin.plan });
    if (!planInfo) {
      return res.status(404).json({ message: "Plan settings not found" });
    }

    const baseLimit = admin.userLimit || 30;
    let mergedAddonSeats = 0;
    const separateAddons = [];

    if (admin.limitAddons && admin.limitAddons.length > 0) {
      admin.limitAddons.forEach((addon) => {
        if (!addon.isPaid || isAddonAlreadyMainBilled(addon, admin) || !addon.expiresAt) return;
        if (isSameBillingDay(addon.expiresAt, admin.planExpiresAt)) {
          mergedAddonSeats += addon.addonLimit || 0;
        } else {
          separateAddons.push(addon);
        }
      });
    }

    const mainBillSeats = baseLimit + mergedAddonSeats;
    const mainBillAmount = planInfo.price * mainBillSeats;

    const bills = [];
    const isFreePlan = admin.plan?.toLowerCase()?.includes("free");
    if (!isFreePlan) {
      bills.push({
        id: "main",
        type: "main",
        planName: admin.plan,
        pricePerPerson: planInfo.price,
        employeeCount: mainBillSeats,
        userLimit: baseLimit,
        addonLimit: mergedAddonSeats,
        amount: mainBillAmount,
        nextBillingDate: admin.planExpiresAt,
        planInfo,
      });
    }

    separateAddons.forEach((addon) => {
      const addonSeats = addon.addonLimit || 10;
      const addonAmount = planInfo.price * addonSeats;
      bills.push({
        id: addon._id.toString(),
        type: "addon",
        addonId: addon._id.toString(),
        planName: `${admin.plan} - Add-on`,
        pricePerPerson: planInfo.price,
        employeeCount: addonSeats,
        amount: addonAmount,
        nextBillingDate: addon.expiresAt,
        planInfo,
      });
    });

    const defaultBill = bills.find(b => b.type === "main") || bills[0] || {
      planName: admin.plan,
      pricePerPerson: planInfo.price,
      employeeCount: baseLimit,
      amount: planInfo.price * baseLimit,
      nextBillingDate: admin.planExpiresAt,
      planInfo,
    };

    return res.status(200).json({
      ...defaultBill,
      bills,
    });
  } catch (err) {
    console.error("GET NEXT BILL INFO ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   6.  CREATE ADDON ORDER
   POST /api/razorpay/create-addon-order
   Creates a Razorpay order for purchasing additional user seats.
   Each add-on has its own monthly billing cycle independent of the main plan.
 ───────────────────────────────────────────── */
export const createAddonOrder = async (req, res) => {
  try {
    const { addonLimit, addonId } = req.body;

    const admin = await Admin.findById(req.user._id);
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    // Free plan restriction
    const isFreePlan = admin.plan?.toLowerCase()?.includes("free");
    if (isFreePlan) {
      return res.status(400).json({
        message: "User limit add-ons are only available on paid plans. Please upgrade your plan first."
      });
    }

    const planInfo = await PlanSetting.findOne({ planName: admin.plan });
    if (!planInfo || planInfo.price === 0) {
      return res.status(400).json({
        message: "Cannot purchase add-on seats on the current plan. Please upgrade to a paid plan."
      });
    }

    let seats;
    let isRenewal = false;

    if (addonId) {
      // Renew an existing expired addon
      const existingAddon = admin.limitAddons?.id(addonId);
      if (!existingAddon) {
        return res.status(404).json({ message: "Add-on not found" });
      }
      if (isAddonAlreadyMainBilled(existingAddon, admin)) {
        return res.status(400).json({ message: "This add-on is already included in your main plan." });
      }
      seats = existingAddon.addonLimit;
      isRenewal = true;
    } else {
      // New addon purchase
      seats = Math.max(10, Number(addonLimit) || 10);
    }

    const amountInPaise = Math.round(planInfo.price * seats * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `addon_${Date.now()}`,
      notes: {
        email: admin.email,
        name: admin.name,
        addonLimit: seats.toString(),
        plan: admin.plan,
        pricePerSeat: planInfo.price.toString(),
        billingCycle: planInfo.billingCycle || "monthly",
        isAddon: "true",
        isRenewal: isRenewal ? "true" : "false",
        addonId: addonId || "",
        amount: (amountInPaise / 100).toString(),
      },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      seats,
      pricePerSeat: planInfo.price,
      planName: admin.plan,
    });
  } catch (err) {
    console.error("CREATE ADDON ORDER ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

/* ─────────────────────────────────────────────
   7.  VERIFY ADDON PAYMENT
   POST /api/razorpay/verify-addon-payment
   Verifies payment and provisions the add-on limit package into admin.limitAddons.
   Each addon has its own expiresAt date (1 month from activation), separate from the main plan.
 ───────────────────────────────────────────── */
export const verifyAddonPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ message: "Payment verification failed" });
    }

    // Fetch order notes from Razorpay
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = order.notes || {};

    const {
      email,
      addonLimit,
      plan: planName,
      pricePerSeat,
      billingCycle,
      isRenewal,
      addonId,
      amount,
    } = notes;

    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const activatedAt = new Date();
    const expiresAt = new Date(activatedAt);

    // Set expiry based on billing cycle (default 1 month for addon)
    if (billingCycle === "quarterly") {
      expiresAt.setMonth(expiresAt.getMonth() + 3);
    } else if (billingCycle === "halfYearly") {
      expiresAt.setMonth(expiresAt.getMonth() + 6);
    } else if (billingCycle === "yearly") {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
      // Default: monthly addon billing cycle
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }

    if (isRenewal === "true" && addonId) {
      // Renew existing expired addon
      const existingAddon = admin.limitAddons?.id(addonId);
      if (existingAddon) {
        if (isAddonAlreadyMainBilled(existingAddon, admin)) {
          return res.status(400).json({ message: "This add-on is already included in your main plan." });
        }
        const renewBase = existingAddon.expiresAt && new Date(existingAddon.expiresAt) > new Date()
          ? new Date(existingAddon.expiresAt)
          : activatedAt;
        const newExpiry = new Date(renewBase);
        if (billingCycle === "quarterly") {
          newExpiry.setMonth(newExpiry.getMonth() + 3);
        } else if (billingCycle === "halfYearly") {
          newExpiry.setMonth(newExpiry.getMonth() + 6);
        } else if (billingCycle === "yearly") {
          newExpiry.setFullYear(newExpiry.getFullYear() + 1);
        } else {
          newExpiry.setMonth(newExpiry.getMonth() + 1);
        }
        existingAddon.expiresAt = newExpiry;
        existingAddon.isPaid = true;
        existingAddon.razorpayOrderId = razorpay_order_id;
        existingAddon.razorpayPaymentId = razorpay_payment_id;
        existingAddon.pricePaid = Number(pricePerSeat) * Number(addonLimit);
        console.log(`✅ Addon renewed for admin: ${email}, id: ${addonId}`);
      } else {
        // Addon not found, create a new one anyway
        admin.limitAddons.push({
          addonLimit: Number(addonLimit) || 10,
          pricePaid: Number(amount) || 0,
          planName: planName || admin.plan,
          activatedAt,
          expiresAt,
          razorpayOrderId: razorpay_order_id,
          razorpayPaymentId: razorpay_payment_id,
          isPaid: true,
        });
      }
    } else {
      // New addon purchase
      admin.limitAddons.push({
        addonLimit: Number(addonLimit) || 10,
        pricePaid: Number(amount) || 0,
        planName: planName || admin.plan,
        activatedAt,
        expiresAt,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        isPaid: true,
      });
      console.log(`✅ New addon purchased for admin: ${email}, seats: ${addonLimit}`);
    }

    await admin.save();

    return res.status(200).json({
      success: true,
      message: "Add-on limit activated successfully",
      paymentId: razorpay_payment_id,
    });
  } catch (err) {
    console.error("VERIFY ADDON PAYMENT ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};
