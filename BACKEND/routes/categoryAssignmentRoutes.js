import express from "express";
import EmployeeCategory from "../models/EmployeeCategory.js";

const router = express.Router();

/* ===================== GET ALL EMPLOYEE → CATEGORY MAPPINGS ===================== */
router.get("/", async (req, res) => {
  try {
    const mappings = await EmployeeCategory.find();
    return res.json(mappings);
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to fetch mappings", error: err.message });
  }
});

/* ===================== ASSIGN CATEGORY ===================== */
router.post("/assign", async (req, res) => {
  try {
    const { employeeId, categoryId } = req.body;

    if (!employeeId)
      return res.status(400).json({ success: false, message: "employeeId is required" });

    await EmployeeCategory.updateOne(
      { employeeId },
      { categoryId: categoryId || null },
      { upsert: true }
    );

    return res.json({ success: true, message: "Category assigned" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to assign category", error: err.message });
  }
});

/* ===================== REMOVE CATEGORY (optional) ===================== */
router.delete("/:employeeId", async (req, res) => {
  try {
    await EmployeeCategory.deleteOne({ employeeId: req.params.employeeId });
    return res.json({ success: true, message: "Category removed" });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to remove mapping", error: err.message });
  }
});

export default router;
