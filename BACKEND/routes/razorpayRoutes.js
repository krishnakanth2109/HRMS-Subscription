import express from "express";
import {
  createOrder,
  verifyPayment,
  razorpayWebhookHandler,
} from "../controllers/razorpayController.js";

const router = express.Router();

// Standard JSON routes
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);

// Webhook — body is already raw JSON parsed by express.json()
// (unlike Stripe which needs raw bytes). We handle it here.
router.post("/webhook", razorpayWebhookHandler);

export default router;
