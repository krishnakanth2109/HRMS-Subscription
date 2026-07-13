import express from "express";
import AdminTask from "../models/AdminTask.js";
import { protect } from "../controllers/authController.js";
import { onlyAdmin } from "../middleware/roleMiddleware.js";

const router = express.Router();

// @route   POST /api/admin-tasks
// @desc    Admin assigns a task to an employee
// @access  Protected, Admin
router.post("/", protect, onlyAdmin, async (req, res) => {
  try {
    const { employeeId, title, description } = req.body;
    
    if (!employeeId || !title) {
      return res.status(400).json({ message: "Employee ID and Title are required." });
    }

    const newTask = new AdminTask({
      employeeId,
      adminId: req.user._id, // Assumes req.user is populated by protect middleware
      title,
      description,
    });

    await newTask.save();
    res.status(201).json(newTask);
  } catch (error) {
    console.error("Create AdminTask Error:", error);
    res.status(500).json({ message: "Failed to assign task.", error: error.message });
  }
});

// @route   GET /api/admin-tasks
// @desc    Admin lists all assigned tasks (can filter by status or employeeId)
// @access  Protected, Admin
router.get("/", protect, onlyAdmin, async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const filter = { adminId: req.user._id };
    if (employeeId) filter.employeeId = employeeId;
    if (status) filter.status = status;

    const tasks = await AdminTask.find(filter)
      .populate("employeeId", "name employeeId")
      .populate("adminId", "name")
      .sort({ createdAt: -1 });

    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get AdminTasks Error:", error);
    res.status(500).json({ message: "Failed to fetch tasks.", error: error.message });
  }
});

// @route   GET /api/admin-tasks/employee
// @desc    Employee fetches their assigned pending tasks
// @access  Protected (Employee)
router.get("/employee", protect, async (req, res) => {
  try {
    const { status } = req.query;
    // req.user has the current employee's info
    const filter = { employeeId: req.user._id };
    if (status) {
      filter.status = status;
    } else {
      // By default fetch Pending or In Progress tasks for the morning dropdown
      filter.status = { $in: ["Pending", "In Progress"] };
    }

    const tasks = await AdminTask.find(filter).sort({ createdAt: -1 });
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Get Employee AdminTasks Error:", error);
    res.status(500).json({ message: "Failed to fetch your tasks.", error: error.message });
  }
});

// @route   PUT /api/admin-tasks/:id/complete
// @desc    Mark task as completed
// @access  Protected (Employee or Admin)
router.put("/:id/complete", protect, async (req, res) => {
  try {
    const task = await AdminTask.findById(req.params.id);
    
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }

    // Mark as completed
    task.status = "Completed";
    task.completedAt = new Date();
    await task.save();

    res.status(200).json(task);
  } catch (error) {
    console.error("Complete AdminTask Error:", error);
    res.status(500).json({ message: "Failed to complete task.", error: error.message });
  }
});

// @route   DELETE /api/admin-tasks/:id
// @desc    Admin deletes a task
// @access  Protected, Admin
router.delete("/:id", protect, onlyAdmin, async (req, res) => {
  try {
    const task = await AdminTask.findOneAndDelete({ 
      _id: req.params.id, 
      adminId: req.user._id 
    });
    if (!task) {
      return res.status(404).json({ message: "Task not found." });
    }
    res.status(200).json({ message: "Task deleted successfully." });
  } catch (error) {
    console.error("Delete AdminTask Error:", error);
    res.status(500).json({ message: "Failed to delete task.", error: error.message });
  }
});

export default router;
