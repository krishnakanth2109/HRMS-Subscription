import express from "express";
import {
  createOrder,
  verifyPayment,
  razorpayWebhookHandler,
  getBillingHistory,
  getNextBillInfo,
  createAddonOrder,
  verifyAddonPayment,
} from "../controllers/razorpayController.js";
import { protect } from "../controllers/authController.js";

const router = express.Router();

// Standard JSON routes
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.get("/billing-history", protect, getBillingHistory);
router.get("/next-bill", protect, getNextBillInfo);

// User Limit Add-on routes (require auth)
router.post("/create-addon-order", protect, createAddonOrder);
router.post("/verify-addon-payment", protect, verifyAddonPayment);

// Webhook — body is already raw JSON parsed by express.json()
// (unlike Stripe which needs raw bytes). We handle it here.
router.post("/webhook", razorpayWebhookHandler);

export default router;

