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
    const { name, email, password, phone, department, role, plan } = metadata;

    /* 🔴 HARD VALIDATION */
    if (!name || !email || !password || !plan) {
      console.error("❌ Missing metadata:", metadata);
      return res.json({ received: true });
    }

    try {
      // Prevent duplicate admin
      const existing = await Admin.findOne({ email });
      if (existing) {
        console.log("ℹ️ Admin already exists:", email);
        return res.json({ received: true });
      }

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

        // ✅ SAFE FIELD
        planActivatedAt: new Date(),
      });

      console.log("✅ Paid admin created successfully:", email);
    } catch (dbErr) {
      console.error("❌ Failed to create paid admin:", dbErr);
    }
  }

  res.json({ received: true });
};

export default stripeWebhookHandler;