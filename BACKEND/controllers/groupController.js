// --- START OF FILE controllers/groupController.js ---
import Group from "../models/Group.js";
import Company from "../models/CompanyModel.js";
import Attendance from "../models/Attendance.js"; // Needed for team attendance

/* =====================================================
   CREATE GROUP (ADMIN ONLY)
===================================================== */
export const createGroup = async (req, res) => {
  try {
    const {
      groupName,
      groupCode,
      description,
      groupLeader,
      permissions,
      companyId // REQUIRED
    } = req.body;

    if (!groupName || !groupCode || !groupLeader || !companyId) {
      return res.status(400).json({ message: "Missing required fields (including companyId)" });
    }

    // 1. Verify this Admin owns the Company
    const company = await Company.findOne({ _id: companyId, adminId: req.user._id });
    if (!company) {
      return res.status(404).json({ message: "Invalid Company ID or Unauthorized" });
    }

    // 2. Create Group with Hierarchy
    const group = await Group.create({
      adminId: req.user._id,
      companyId: companyId,
      groupName,
      groupCode,
      description,
      groupLeader,
      permissions,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Group created successfully", data: group });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================================
   GET ALL GROUPS (ADMIN ONLY)
===================================================== */
export const getAllGroups = async (req, res) => {
  try {
    // 1. Fetch groups belonging to this Admin
    const groups = await Group.find({ adminId: req.user._id, isDeleted: false })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation")
      .populate("companyId", "name prefix");

    res.status(200).json(groups);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET SINGLE GROUP (ADMIN ONLY)
===================================================== */
export const getSingleGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id })
      .populate("groupLeader", "name employeeId")
      .populate("members.employee", "name employeeId");

    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json(group);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   UPDATE GROUP (ADMIN ONLY)
===================================================== */
export const updateGroup = async (req, res) => {
  try {
    const updatedGroup = await Group.findOneAndUpdate(
      { _id: req.params.id, adminId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.status(200).json({
      message: "Group updated successfully",
      updatedGroup,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   ASSIGN / CHANGE GROUP LEADER
===================================================== */
export const assignGroupLeader = async (req, res) => {
  try {
    const { leaderId } = req.body;

    if (!leaderId) return res.status(400).json({ message: "Leader ID is required" });

    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.groupLeader = leaderId;
    await group.save();

    res.status(200).json({ message: "Group leader updated successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   ADD MEMBER TO GROUP
===================================================== */
export const addMember = async (req, res) => {
  try {
    const { employeeId, role } = req.body;

    if (!employeeId) return res.status(400).json({ message: "Employee ID is required" });

    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    const exists = group.members.some((m) => m.employee.toString() === employeeId);
    if (exists) {
      return res.status(400).json({ message: "Employee already in group" });
    }

    group.members.push({
      employee: employeeId,
      role: role || "member",
    });

    await group.save();
    res.status(200).json({ message: "Member added successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   REMOVE MEMBER FROM GROUP
===================================================== */
export const removeMember = async (req, res) => {
  try {
    const { employeeId } = req.body;
    if (!employeeId) return res.status(400).json({ message: "Employee ID is required" });

    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!group || group.isDeleted) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.members = group.members.filter((m) => m.employee.toString() !== employeeId);
    await group.save();

    res.status(200).json({ message: "Member removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   SOFT DELETE GROUP
===================================================== */
export const deleteGroup = async (req, res) => {
  try {
    const group = await Group.findOne({ _id: req.params.id, adminId: req.user._id });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    group.isDeleted = true;
    group.status = "inactive";
    await group.save();

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET EMPLOYEE TEAMS (EMPLOYEE SIDE)
===================================================== */
export const getEmployeeTeams = async (req, res) => {
  try {
    const employeeId = req.user._id;
    // const companyId = req.user.company; // Can filter by company if needed

    const teams = await Group.find({
      isDeleted: false,
      status: "active",
      // Ensure we only look in their company
      companyId: req.user.company, 
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation");

    res.status(200).json({
      success: true,
      data: teams,
    });
  } catch (error) {
    console.error("Get employee teams error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch employee teams",
    });
  }
};

/* =====================================================
   GET MY TEAMS (EMPLOYEE) - Alias for above
===================================================== */
export const getMyTeams = async (req, res) => {
  try {
    const employeeId = req.user._id;

    const teams = await Group.find({
      isDeleted: false,
      companyId: req.user.company,
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    })
      .populate("groupLeader", "name employeeId designation")
      .populate("members.employee", "name employeeId designation");

    res.status(200).json({
      data: teams,
    });
  } catch (error) {
    console.error("Get my teams error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* =====================================================
   GET TEAM ATTENDANCE (EMPLOYEE SAFE)
===================================================== */
export const getTeamAttendanceToday = async (req, res) => {
  try {
    const employeeId = req.user._id;

    // Find employee teams within their company
    const groups = await Group.find({
      isDeleted: false,
      companyId: req.user.company,
      $or: [
        { groupLeader: employeeId },
        { "members.employee": employeeId },
      ],
    });

    const memberIds = [
      ...new Set(
        groups.flatMap((g) =>
          g.members.map((m) => m.employee.toString())
        )
      ),
    ];

    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch attendance for these members, scoped to company
    const attendance = await Attendance.find({
      employeeId: { $in: memberIds }, // Matches employeeId string in Attendance
      companyId: req.user.company // Extra safety
    }).select("employeeName attendance"); 
    
    // We need to filter the attendance array inside the doc for "today"
    // or aggregate. For simplicity, filtering in JS:
    const result = attendance.map(doc => {
        const todayRecord = doc.attendance.find(r => r.date === todayStr);
        return {
            employeeId: doc.employeeId,
            employeeName: doc.employeeName,
            status: todayRecord ? todayRecord.status : "ABSENT",
            punchIn: todayRecord ? todayRecord.punchIn : null
        };
    });

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Team attendance error:", error);
    res.status(500).json({ message: "Failed to load attendance" });
  }
};