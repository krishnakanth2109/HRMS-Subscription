import Stripe from "stripe";
import Admin from "../models/adminModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const stripeWebhookHandler = async (req, res) => {
  console.log("🚀 WEBHOOK HIT");

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature failed:", err.message);
    return res.status(400).send("Webhook Error");
  }

  console.log("🔥 Stripe Event:", event.type);

  /* ==================== PAID ADMIN CREATION ==================== */
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only subscription checkouts
    if (session.mode !== "subscription") {
      return res.json({ received: true });
    }

    const metadata = session.metadata || {};
    const { name, email, password, phone, department, role, plan, durationDays } = metadata;

    /* 🔴 HARD VALIDATION */
    if (!name || !email || !password || !plan) {
      console.error("❌ Missing metadata:", metadata);
      return res.json({ received: true });
    }

    // Calculate expiration date
    const activatedAt = new Date();
    const expiresAt = new Date();
    if (durationDays) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(durationDays));
    }

    try {
      // 1. Check if admin already exists
      const existing = await Admin.findOne({ email });

      if (existing) {
        console.log("ℹ️ Admin exists, updating plan for:", email);
        
        // Update subscription details
        existing.plan = plan;
        existing.isPaid = true;
        existing.stripeCustomerId = session.customer;
        existing.stripeSubscriptionId = session.subscription;
        existing.planActivatedAt = activatedAt;
        existing.planExpiresAt = expiresAt;
        
        await existing.save();
        console.log("✅ Admin plan upgraded successfully:", email);
        return res.json({ received: true });
      }

      // 2. Create new admin if not exists
      await Admin.create({
        name,
        email,
        password, // hashed by schema
        phone: phone || "",
        department: department || "Administration",
        role: role || "admin",
        plan,
        isPaid: true,

        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,

        // ✅ SAFE FIELDS
        planActivatedAt: activatedAt,
        planExpiresAt: expiresAt,
      });

      console.log("✅ Paid admin created successfully:", email);
    } catch (dbErr) {
      console.error("❌ Failed to process paid admin:", dbErr);
    }
  }

  res.json({ received: true });
};

export default stripeWebhookHandler;