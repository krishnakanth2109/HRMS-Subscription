import express from "express";
import Employee from "../models/employeeModel.js";

const router = express.Router();

// CREATE employee
router.post("/", async (req, res) => {
  try {
    const employee = new Employee(req.body);
    const result = await employee.save();
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET all employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find();
    res.status(200).json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET employee by employeeId
router.get("/:id", async (req, res) => {
  try {
    const employee = await Employee.findOne({ employeeId: req.params.id });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json(employee);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE employee by employeeId
router.put("/:id", async (req, res) => {
  try {
    const updated = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "Employee not found" });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE employee by employeeId
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Employee.findOneAndDelete({ employeeId: req.params.id });

    if (!deleted) return res.status(404).json({ message: "Employee not found" });

    res.status(200).json({ message: "Employee deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DEACTIVATE employee
router.patch("/deactivate/:id", async (req, res) => {
  const { endDate, reason } = req.body;
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { isActive: false, endDate, reason },
      { new: true }
    );
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// REACTIVATE employee
router.patch("/reactivate/:id", async (req, res) => {
  try {
    const emp = await Employee.findOneAndUpdate(
      { employeeId: req.params.id },
      { isActive: true, endDate: "", reason: "" },
      { new: true }
    );
    res.json(emp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;