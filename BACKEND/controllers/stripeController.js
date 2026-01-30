import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createCheckoutSession = async (req, res) => {
  try {
    const { plan, signupForm } = req.body;

    if (!plan || !signupForm) {
      return res.status(400).json({ message: "Invalid request" });
    }

    if (plan.name === "Free") {
      return res.status(400).json({
        message: "Free plan does not require payment",
      });
    }

    const ALLOWED_PLANS = {
      Basic: "price_1SuSHGRlPtnrZpEPO6x5DFy7",
      Premium: "price_1SuSF2RlPtnrZpEPD9YOIMSr",
      Flex: "price_1SuSHyRlPtnrZpEPxZBNR9MN",
    };

    const priceId = ALLOWED_PLANS[plan.name];
    if (!priceId) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: signupForm.email, // ⭐ ADD THIS
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.CLIENT_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment-cancel`,
      metadata: {
        name: signupForm.name,
        email: signupForm.email,
        password: signupForm.password,
        phone: signupForm.phone || "",
        role: signupForm.role || "admin",
        department: signupForm.department || "",
        plan: plan.name,
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("STRIPE CHECKOUT ERROR:", err.message);
    return res.status(500).json({ message: err.message });
  }
};