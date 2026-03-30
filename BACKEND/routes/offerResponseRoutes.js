import express from "express";
import OfferLetterEmployee from "../models/OfferLetterEmployee.js";
import InvitedEmployee from "../models/Invitedemployee.js";
import Company from "../models/CompanyModel.js";
import transporter from "../config/nodemailer.js";

const router = express.Router();

/* ============================================================
   PUBLIC: GET /api/offer-letters/respond?token=...&action=accept|reject
   No auth required — candidate clicks from email
============================================================ */
router.get("/respond", async (req, res) => {
  try {
    const { token, action } = req.query;
    console.log(`[Offer Response] Hit! Action: ${action}, Token: ${token?.[0]}...`);

    if (!token || !action) {
      return res.status(400).send(buildResponsePage("Invalid Request", "Missing token or action.", "error"));
    }

    const emp = await OfferLetterEmployee.findOne({ offer_token: token });
    if (!emp) {
      return res.status(404).send(buildResponsePage("Token Invalid", "This offer link is no longer valid or has already been used.", "error"));
    }

    // Check if already responded
    if (emp.status === "Accepted" || emp.status === "Rejected") {
      return res.send(buildResponsePage(
        `Already ${emp.status}`,
        `You have already ${emp.status.toLowerCase()} this offer. No further action needed.`,
        emp.status === "Accepted" ? "success" : "error"
      ));
    }

    // Check expiry
    if (emp.expires_at && new Date() > new Date(emp.expires_at)) {
      await OfferLetterEmployee.findByIdAndUpdate(emp._id, {
        $set: { status: "Rejected", rejection_reason: "Offer Expired (24h)", offer_token: null }
      });
      return res.send(buildResponsePage("Offer Expired", "This offer has expired after 24 hours.", "error"));
    }

    // Process response
    if (action === "accept") {
      console.log(`[Offer Accepted] Processing acceptance for: ${emp.name} (${emp.email})`);
      
      await OfferLetterEmployee.findByIdAndUpdate(emp._id, {
        $set: { status: "Accepted", accepted_at: new Date(), offer_token: null }
      });

      return res.send(buildResponsePage(
        "🎉 Offer Accepted!",
        `Congratulations ${emp.name}! You have successfully accepted the offer. We look forward to welcoming you to the team!`,
        "success"
      ));
    } else if (action === "reject") {
      await OfferLetterEmployee.findByIdAndUpdate(emp._id, {
        $set: { status: "Rejected", rejected_at: new Date(), rejection_reason: "Declined by candidate", offer_token: null }
      });
      return res.send(buildResponsePage(
        "Offer Declined",
        `Thank you for your response, ${emp.name}. We wish you all the best in your future endeavors.`,
        "error"
      ));
    } else {
      return res.status(400).send(buildResponsePage("Invalid Action", "Unknown action.", "error"));
    }
  } catch (err) {
    console.error("Offer response error:", err);
    res.status(500).send(buildResponsePage("Error", "Something went wrong. Please try again later.", "error"));
  }
});

function buildResponsePage(title, message, type) {
  const color = type === "success" ? "#10b981" : "#ef4444";
  const icon = type === "success" ? "✅" : "❌";
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: linear-gradient(135deg, #0f172a, #1e293b); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .card { background: white; border-radius: 24px; padding: 60px; max-width: 500px; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3); }
  .icon { font-size: 64px; margin-bottom: 24px; }
  h1 { font-size: 28px; color: #1e293b; margin-bottom: 16px; }
  p { font-size: 16px; color: #64748b; line-height: 1.6; }
  .bar { width: 80px; height: 4px; background: ${color}; margin: 24px auto 0; border-radius: 2px; }
</style></head>
<body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p><div class="bar"></div></div></body></html>`;
}

export default router;
