// --- START OF FILE models/LeaveRequest.js ---
import mongoose from "mongoose";

/* ============================================================================
   📌 SUB-SCHEMA: Per-day breakdown of a leave request
   NOTE: leaveType is a free String — no enum — so admin-defined custom types
         like "MATERNITY", "PATERNITY", "BEREAVEMENT" all work without code changes.
============================================================================ */
const perDaySchema = new mongoose.Schema(
  {
    date:          { type: String, required: true },
    leavecategory: { type: String, enum: ["Paid", "UnPaid"], default: "UnPaid" },
    leaveType:     { type: String, default: null },   // free string — dynamic
    leaveDayType:  { type: String, enum: ["Full Day", "Half Day"], default: null },
  },
  { _id: false }
);

/* ============================================================================
   📌 SUB-SCHEMA: One entry in the admin's leave policy
   leaveType  — free string (admin names it: "Casual Leave", "SICK", whatever)
   paidDaysLimit — how many days per year are paid for this type (0 = all unpaid)
   usedPaidDays  — running counter, auto-incremented on approval
============================================================================ */
const leaveTypePolicySchema = new mongoose.Schema(
  {
    leaveType:          { type: String, required: true },   // free string — dynamic
    paidDaysLimit:      { type: Number, default: 0, min: 0 },
    usedPaidDays:       { type: Number, default: 0, min: 0 },
    // ✅ NEW: Carry-forward balance tracking per leave type
    // carriedForwardDays — days carried forward FROM the previous cycle
    // These are added on top of paidDaysLimit for the current cycle
    carriedForwardDays: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

/* ============================================================================
   📌 MAIN SCHEMA: LeaveRequest
============================================================================ */
const leaveRequestSchema = new mongoose.Schema(
  {
    // ── HIERARCHY ──────────────────────────────────────────────────────────
    adminId:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin",   required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employeeId: { type: String, required: true },

    // ── LEAVE DATES & REASON ───────────────────────────────────────────────
    from:   { type: String, required: true },
    to:     { type: String, required: true },
    reason: { type: String, required: true, maxlength: 500 },

    // ── LEAVE CLASSIFICATION — all free strings, no enum restriction ───────
    leaveType:      { type: String, required: true },              // dynamic — from admin policy
    leaveDayType:   { type: String, enum: ["Full Day", "Half Day"], required: true },
    halfDaySession: { type: String, default: "" },

    // ── TOP-LEVEL CATEGORY resolved at creation time ───────────────────────
    leavecategory: { type: String, enum: ["Paid", "UnPaid"], default: "UnPaid" },

    // ── STATUS LIFECYCLE ───────────────────────────────────────────────────
    status:      { type: String, enum: ["Pending", "Approved", "Rejected", "Cancelled"], default: "Pending" },
    requestDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    actionDate:  { type: String, default: "-" },
    approvedBy:  { type: String, default: "-" },

    // ── MONTH KEY for fast filtering ───────────────────────────────────────
    monthKey: { type: String, required: true }, // e.g. "2025-04"

    // ── PER-DAY BREAKDOWN ──────────────────────────────────────────────────
    details: { type: [perDaySchema], default: [] },
  },
  { timestamps: true }
);

/* ============================================================================
   📌 LEAVE POLICY MODEL — one document per admin
   Admin can define any leave types they want with their own names.
   Example policies array:
   [
     { leaveType: "Casual Leave",    paidDaysLimit: 12, usedPaidDays: 3, carriedForwardDays: 2 },
     { leaveType: "Sick Leave",      paidDaysLimit: 6,  usedPaidDays: 0, carriedForwardDays: 0 },
     { leaveType: "Emergency Leave", paidDaysLimit: 3,  usedPaidDays: 1, carriedForwardDays: 0 },
     { leaveType: "Maternity Leave", paidDaysLimit: 90, usedPaidDays: 0, carriedForwardDays: 0 },
   ]

   ── FEATURE FLAGS ──────────────────────────────────────────────────────────
   sandwichLeaveEnabled:
     true  → Sandwich leave calculation is active. When an employee's leaves
             sandwich a weekend/holiday, the gap days are counted as leave days.
     false → Sandwich calculation is completely disabled. Gap days are ignored.

   unplannedAbsenceToLOP:
     true  → Unplanned absences (days with no attendance record and no approved
             leave) are automatically treated as Loss of Pay (LOP) entries.
     false → Unplanned absences are NOT added to LOP. They are informational only.

   ✅ NEW — carryForwardEnabled:
     true  → At the start of each new annual cycle, any unused paid days from
             the previous cycle are automatically carried forward and added to
             each employee's balance for that leave type in the new cycle.
     false → Unused days are forfeited at cycle reset. No carry-forward happens.
============================================================================ */
const leavePolicySchema = new mongoose.Schema(
  {
    adminId:   { type: mongoose.Schema.Types.ObjectId, ref: "Admin",   required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },

    policies: { type: [leaveTypePolicySchema], default: [] },

    // Annual auto-reset config
    resetMonth:    { type: String, default: "01" }, // "01"–"12"
    lastResetYear: { type: Number, default: null  },

    // ── Feature flags managed by admin ─────────────────────────────────────
    // Sandwich leave: if ON, gap days (weekends/holidays between leaves) are
    // counted as leave days. If OFF, no sandwich calculation is applied at all.
    sandwichLeaveEnabled: { type: Boolean, default: false },

    // Unplanned absence to LOP: if ON, any day where employee has no attendance
    // record and no approved leave is automatically counted as Loss of Pay.
    // If OFF, unplanned absences are shown informationally but not added to LOP.
    unplannedAbsenceToLOP: { type: Boolean, default: false },

    // ✅ NEW — Carry Forward: if ON, unused paid days roll over to next annual
    // cycle per employee. Each leave type tracks carriedForwardDays separately.
    // If OFF, unused days are lost at year reset — no carry-forward happens.
    carryForwardEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const LeavePolicy = mongoose.model("LeavePolicy", leavePolicySchema);
export default mongoose.model("LeaveRequest", leaveRequestSchema);
// --- END OF FILE models/LeaveRequest.js ---