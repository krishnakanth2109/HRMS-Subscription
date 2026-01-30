import express from "express";
import Holiday from "../models/Holiday.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

/* ============================================================
   🔐 ALL ROUTES REQUIRE LOGIN
============================================================ */
router.use(protect);

/* ============================================================
   🟥 ADMIN ONLY — ADD HOLIDAY (SCOPED)
============================================================ */
router.post("/", onlyAdmin, async (req, res) => {
  try {
    const { name, description, startDate, endDate, companyId } = req.body;

    if (!name || !description || !startDate || !endDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await Holiday.create({ 
        adminId: req.user._id,
        companyId: companyId || null, // Optional company scope
        name, 
        description, 
        startDate, 
        endDate 
    });

    res.status(201).json({ message: "Holiday added successfully" });
  } catch (error) {
    console.error("Add holiday error:", error);
    res.status(500).json({ message: "Failed to add holiday" });
  }
});

/* ============================================================
   🟥 ADMIN ONLY — UPDATE HOLIDAY
============================================================ */
router.put("/:id", onlyAdmin, async (req, res) => {
  try {
    const { name, description, startDate, endDate } = req.body;

    const updatedHoliday = await Holiday.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      { name, description, startDate, endDate },
      { new: true }
    );

    if (!updatedHoliday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    res.json({ message: "Holiday updated successfully", holiday: updatedHoliday });
  } catch (error) {
    console.error("Update holiday error:", error);
    res.status(500).json({ message: "Failed to update holiday" });
  }
});

/* ============================================================
   👤 VIEW ALL HOLIDAYS (SCOPED)
============================================================ */
router.get("/", async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'admin') {
      query.adminId = req.user._id;
    } else {
      query.$or = [
          { companyId: req.user.company },
          { adminId: req.user.adminId, companyId: null }
      ];
    }

    const holidays = await Holiday.find(query).sort({ startDate: 1 });
    res.json(holidays);
  } catch (error) {
    console.error("Get holidays error:", error);
    res.status(500).json({ message: "Failed to fetch holidays" });
  }
});

/* ============================================================
   🟥 ADMIN ONLY — DELETE HOLIDAY
============================================================ */
router.delete("/:id", onlyAdmin, async (req, res) => {
  try {
    await Holiday.findOneAndDelete({ _id: req.params.id, adminId: req.user._id });
    res.json({ message: "Holiday deleted successfully" });
  } catch (error) {
    console.error("Delete holiday error:", error);
    res.status(500).json({ message: "Failed to delete holiday" });
  }
});

export default router;