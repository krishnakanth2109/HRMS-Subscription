import Stripe from "stripe";
import PlanSetting from "../models/planSettingModel.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
  try {
    const { plan, signupForm } = req.body;

    if (!plan || !signupForm) {
      return res.status(400).json({ message: "Invalid request" });
    }

    // 1. Fetch the plan details from the database dynamically
    // We check both 'planName' and 'name' to be safe with frontend naming
    const planInfo = await PlanSetting.findOne({ 
      planName: plan.planName || plan.name 
    });

    if (!planInfo) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    // 2. Safety check: If price is 0, this route shouldn't be used
    if (planInfo.price === 0) {
      return res.status(400).json({
        message: "Free plan does not require payment",
      });
    }

    // 3. Create the Stripe Session using dynamic price and duration from DB
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: signupForm.email,
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: planInfo.planName,
              description: `Subscription for ${planInfo.durationDays} days`,
            },
            unit_amount: planInfo.price * 100, // Stripe expects amount in paise/cents
            recurring: {
              interval: "day", 
              interval_count: planInfo.durationDays, // Dynamically set from DB
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
      metadata: {
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        phone: signupForm.phone || "",
        role: signupForm.role || "admin",
        department: signupForm.department || "",
        plan: planInfo.planName, // Use the name from DB
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("STRIPE CHECKOUT ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};