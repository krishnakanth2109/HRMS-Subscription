import Razorpay from "razorpay";
import crypto from "crypto";
import PlanSetting from "../models/planSettingModel.js";
import Admin from "../models/adminModel.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ─────────────────────────────────────────────
   1.  CREATE ORDER
   POST /api/razorpay/create-order
   Called before the Razorpay popup opens
───────────────────────────────────────────── */
export const createOrder = async (req, res) => {
  try {
    const { plan, signupForm } = req.body;

    if (!plan || !signupForm) {
      return res.status(400).json({ message: "Invalid request" });
    } ``

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

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(planInfo.price * 100);

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
    } = notes;

    if (!name || !email || !password || !planName) {
      console.error("❌ Missing order notes:", notes);
      return res
        .status(400)
        .json({ message: "Order metadata incomplete. Contact support." });
    }

    // ── Calculate subscription window ───────────────────────────────────────
    const activatedAt = new Date();
    const expiresAt = new Date();
    if (durationDays) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));
    }

    // ── Upsert admin ────────────────────────────────────────────────────────
    const existing = await Admin.findOne({ email });

    if (existing) {
      existing.plan = planName;
      existing.isPaid = true;
      existing.razorpayOrderId = razorpay_order_id;
      existing.razorpayPaymentId = razorpay_payment_id;
      existing.planActivatedAt = activatedAt;
      existing.planExpiresAt = expiresAt;
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
        isPaid: true,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
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
    const expiresAt = new Date();
    if (durationDays) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));
    }

    if (existing) {
      existing.plan = planName;
      existing.isPaid = true;
      existing.razorpayOrderId = orderId;
      existing.razorpayPaymentId = paymentId;
      existing.planActivatedAt = activatedAt;
      existing.planExpiresAt = expiresAt;
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
        isPaid: true,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
      });
      console.log("✅ Webhook: paid admin created:", email);
    }
  } catch (dbErr) {
    console.error("❌ Webhook DB error:", dbErr.message);
  }

  res.json({ received: true });
};
