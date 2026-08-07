import express from "express";
import { protect } from "../controllers/authController.js";
import PayrollGroup from "../models/PayrollGroup.js";

const router = express.Router();
router.use(protect);

const safeAdminCheck = (req, res, next) => {
  if (req.user && req.user.role && (req.user.role.toLowerCase() === 'admin' || req.user.role.toLowerCase() === 'support-admin')) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

router.use(safeAdminCheck);

// GET all payroll groups for the company
router.get("/", async (req, res) => {
  try {
    const safeCompanyId = req.user.company || req.user.companyId || req.user._id;
    const groups = await PayrollGroup.find({ companyId: safeCompanyId });
    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payroll groups" });
  }
});

// CREATE a new payroll group
router.post("/", async (req, res) => {
  try {
    const { groupName, description, employees } = req.body;
    const safeCompanyId = req.user.company || req.user.companyId || req.user._id;

    const newGroup = await PayrollGroup.create({
      adminId: req.user._id,
      companyId: safeCompanyId,
      groupName,
      description,
      employees: employees || [],
    });

    res.status(201).json(newGroup);
  } catch (error) {
    res.status(500).json({ message: "Error creating payroll group" });
  }
});

// UPDATE a payroll group (e.g., adding/removing employees)
router.put("/:id", async (req, res) => {
  try {
    const { groupName, description, employees } = req.body;
    const updatedGroup = await PayrollGroup.findByIdAndUpdate(
      req.params.id,
      { groupName, description, employees },
      { new: true }
    );
    if (!updatedGroup) {
      return res.status(404).json({ message: "Payroll group not found" });
    }
    res.status(200).json(updatedGroup);
  } catch (error) {
    res.status(500).json({ message: "Error updating payroll group" });
  }
});

// DELETE a payroll group
router.delete("/:id", async (req, res) => {
  try {
    const deletedGroup = await PayrollGroup.findByIdAndDelete(req.params.id);
    if (!deletedGroup) {
      return res.status(404).json({ message: "Payroll group not found" });
    }
    res.status(200).json({ message: "Payroll group deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting payroll group" });
  }
});

export default router;
