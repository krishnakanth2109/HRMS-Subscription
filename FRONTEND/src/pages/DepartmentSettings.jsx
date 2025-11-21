import React, { useState, useEffect, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import {
  FaClock,
  FaUserTie,
  FaSave,
  FaSearch,
  FaEdit,
  FaTrash,
  FaCheckCircle,
  FaTimesCircle,
  FaUsers,
  FaTag,
} from "react-icons/fa";
import {
  getEmployees,
  getAllShifts,
  createOrUpdateShift,
  deleteShift,
  bulkCreateShifts,
} from "../api";

const DepartmentSettings = () => {
  const { user } = useContext(AuthContext);

  const [employees, setEmployees] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [viewMode, setViewMode] = useState("individual"); // "individual" | "bulk"

  // --- Category System (frontend-only) ---
  const [categories, setCategories] = useState([
    { id: "day", name: "Day Shift", isDefault: true },
    { id: "night", name: "Night Shift", isDefault: true },
    { id: "nonit", name: "Non-IT", isDefault: true },
  ]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all"); // "all" | "unassigned" | categoryId
  const [employeeCategories, setEmployeeCategories] = useState({}); // { [employeeId]: categoryId }

  const [shiftForm, setShiftForm] = useState({
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateGracePeriod: 15,
    fullDayHours: 8,
    halfDayHours: 4,
    autoExtendShift: true,
    weeklyOffDays: [0],
  });

  const [bulkShiftForm, setBulkShiftForm] = useState({
    shiftStartTime: "09:00",
    shiftEndTime: "18:00",
    lateGracePeriod: 15,
    fullDayHours: 8,
    halfDayHours: 4,
    autoExtendShift: true,
    weeklyOffDays: [0],
  });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);

  // ---------------- Fetch Data ----------------
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [employeesData, shiftsData] = await Promise.all([
        getEmployees(),
        getAllShifts(),
      ]);

      setEmployees(employeesData?.data || employeesData || []);
      setShifts(shiftsData || []);
    } catch (error) {
      console.error("Fetch error:", error);
      showMessage("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Helpers ----------------
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: "", text: "" }), 5000);
  };

  const handleEmployeeSelect = (employee) => {
    setSelectedEmployee(employee);

    const existingShift = shifts.find(
      (s) => s.employeeId === employee.employeeId
    );

    if (existingShift) {
      setShiftForm({
        shiftStartTime: existingShift.shiftStartTime || "09:00",
        shiftEndTime: existingShift.shiftEndTime || "18:00",
        lateGracePeriod: existingShift.lateGracePeriod ?? 15,
        fullDayHours: existingShift.fullDayHours || 8,
        halfDayHours: existingShift.halfDayHours || 4,
        autoExtendShift: existingShift.autoExtendShift ?? true,
        weeklyOffDays: existingShift.weeklyOffDays || [0],
      });
    } else {
      setShiftForm({
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        lateGracePeriod: 15,
        fullDayHours: 8,
        halfDayHours: 4,
        autoExtendShift: true,
        weeklyOffDays: [0],
      });
    }
  };

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleBulkFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBulkShiftForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleWeeklyOffToggle = (day) => {
    setShiftForm((prev) => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter((d) => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkWeeklyOffToggle = (day) => {
    setBulkShiftForm((prev) => {
      const current = prev.weeklyOffDays || [];
      if (current.includes(day)) {
        return { ...prev, weeklyOffDays: current.filter((d) => d !== day) };
      } else {
        return { ...prev, weeklyOffDays: [...current, day] };
      }
    });
  };

  const handleBulkEmployeeToggle = (employeeId) => {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmployeeIds.length === filteredEmployees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(filteredEmployees.map((emp) => emp.employeeId));
    }
  };

  // ---------------- Category Logic (Frontend only) ----------------
  const handleAddCategory = () => {
    const name = prompt("Enter new category name:");
    if (!name) return;

    const id =
      name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now().toString();
    setCategories((prev) => [...prev, { id, name, isDefault: false }]);
  };

  const handleDeleteCategory = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category || category.isDefault) return;

    if (!window.confirm(`Delete category "${category.name}"?`)) return;

    setCategories((prev) => prev.filter((c) => c.id !== categoryId));

    setEmployeeCategories((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((empId) => {
        if (updated[empId] === categoryId) {
          updated[empId] = null;
        }
      });
      return updated;
    });

    if (selectedCategoryId === categoryId) {
      setSelectedCategoryId("all");
    }
  };

  const handleAssignCategory = (employeeId, categoryIdOrEmpty) => {
    const categoryId = categoryIdOrEmpty || null; // "" => unassigned
    setEmployeeCategories((prev) => ({
      ...prev,
      [employeeId]: categoryId,
    }));
  };

  // ---------------- Shift Save ----------------
  const handleSaveShift = async (e) => {
    e.preventDefault();

    if (!selectedEmployee) {
      showMessage("error", "Please select an employee first");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        employeeId: selectedEmployee.employeeId,
        shiftStartTime: shiftForm.shiftStartTime,
        shiftEndTime: shiftForm.shiftEndTime,
        lateGracePeriod: Number(shiftForm.lateGracePeriod),
        fullDayHours: Number(shiftForm.fullDayHours),
        halfDayHours: Number(shiftForm.halfDayHours),
        autoExtendShift: shiftForm.autoExtendShift,
        weeklyOffDays: shiftForm.weeklyOffDays,
      };

      await createOrUpdateShift(payload);
      showMessage("success", "Shift configuration saved successfully");
      await fetchData();
    } catch (error) {
      console.error("Save shift error:", error);
      showMessage(
        "error",
        error.response?.data?.message || "Failed to save shift"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSaveShift = async (e) => {
    e.preventDefault();

    if (selectedEmployeeIds.length === 0) {
      showMessage("error", "Please select at least one employee");
      return;
    }

    setSaving(true);
    try {
      const shiftData = {
        shiftStartTime: bulkShiftForm.shiftStartTime,
        shiftEndTime: bulkShiftForm.shiftEndTime,
        lateGracePeriod: Number(bulkShiftForm.lateGracePeriod),
        fullDayHours: Number(bulkShiftForm.fullDayHours),
        halfDayHours: Number(bulkShiftForm.halfDayHours),
        autoExtendShift: bulkShiftForm.autoExtendShift,
        weeklyOffDays: bulkShiftForm.weeklyOffDays,
      };

      await bulkCreateShifts(selectedEmployeeIds, shiftData);
      showMessage(
        "success",
        `Successfully updated ${selectedEmployeeIds.length} employees`
      );

      setSelectedEmployeeIds([]);
      await fetchData();
    } catch (error) {
      console.error("Bulk save error:", error);
      showMessage(
        "error",
        error.response?.data?.message || "Failed to save shifts"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (employeeId) => {
    if (
      !window.confirm(
        "Are you sure you want to reset this shift to default for this employee?"
      )
    ) {
      return;
    }

    try {
      await deleteShift(employeeId);
      showMessage("success", "Shift reset to default successfully");
      await fetchData();

      if (selectedEmployee?.employeeId === employeeId) {
        setSelectedEmployee(null);
      }
    } catch (error) {
      console.error("Delete shift error:", error);
      showMessage("error", "Failed to delete shift");
    }
  };

  // ---------------- Filtering (Search + Category) ----------------
  const baseFilteredEmployees = employees.filter((emp) => {
    const q = searchTerm.toLowerCase();
    return (
      emp.name?.toLowerCase().includes(q) ||
      emp.employeeId?.toLowerCase().includes(q) ||
      emp.email?.toLowerCase().includes(q)
    );
  });

  const filteredEmployees = baseFilteredEmployees.filter((emp) => {
    const empCat = employeeCategories[emp.employeeId] || null;

    if (selectedCategoryId === "all") return true;
    if (selectedCategoryId === "unassigned") return empCat === null;
    return empCat === selectedCategoryId;
  });

  const weekDays = [
    { value: 0, label: "Sun" },
    { value: 1, label: "Mon" },
    { value: 2, label: "Tue" },
    { value: 3, label: "Wed" },
    { value: 4, label: "Thu" },
    { value: 5, label: "Fri" },
    { value: 6, label: "Sat" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Utility to get label for employee's category
  const getEmployeeCategoryName = (empId) => {
    const catId = employeeCategories[empId];
    if (!catId) return "Unassigned";
    const cat = categories.find((c) => c.id === catId);
    return cat ? cat.name : "Unassigned";
  };

  const selectedEmployeesForPreview = employees.filter((emp) =>
    selectedEmployeeIds.includes(emp.employeeId)
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <span className="inline-flex items-center justify-center rounded-2xl bg-blue-100 p-3">
              <FaClock className="text-blue-600 text-xl" />
            </span>
            <span>Shift Management</span>
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            Configure employee shifts, weekly offs, and group them by categories
            like Day / Night / Non-IT.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-gray-100 p-1 self-start">
          <button
            onClick={() => setViewMode("individual")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              viewMode === "individual"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            <FaUserTie />
            Individual
          </button>
          <button
            onClick={() => setViewMode("bulk")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
              viewMode === "bulk"
                ? "bg-white shadow text-blue-700"
                : "text-gray-600 hover:text-blue-600"
            }`}
          >
            <FaUsers />
            Bulk
          </button>
        </div>
      </div>

      {/* ALERTS */}
      {message.text && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-2 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.type === "success" ? <FaCheckCircle /> : <FaTimesCircle />}
          <span className="font-medium text-sm">{message.text}</span>
        </div>
      )}

      {/* TOP CATEGORY ROW */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
            <FaTag className="text-blue-600" /> Employee Categories
          </h3>
          <button
            onClick={handleAddCategory}
            className="text-xs px-3 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            + Add
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* All */}
          <button
            onClick={() => setSelectedCategoryId("all")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              selectedCategoryId === "all"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
            }`}
          >
            All ({baseFilteredEmployees.length})
          </button>

          {/* Unassigned */}
          <button
            onClick={() => setSelectedCategoryId("unassigned")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              selectedCategoryId === "unassigned"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
            }`}
          >
            Unassigned (
            {
              baseFilteredEmployees.filter(
                (e) => !employeeCategories[e.employeeId]
              ).length
            }
            )
          </button>

          {/* Dynamic Categories */}
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs border ${
                selectedCategoryId === cat.id
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-indigo-50"
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedCategoryId(cat.id)}
                className="font-semibold"
              >
                {cat.name}
              </button>

              {!cat.isDefault && (
                <button
                  type="button"
                  onClick={() => handleDeleteCategory(cat.id)}
                  className="text-[11px] text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN – EMPLOYEE LIST / SELECTION */}
        <div className="lg:col-span-5">
          {viewMode === "individual" ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
              <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm mb-3">
                <FaUserTie className="text-blue-600" />
                Employees
              </h3>

              {/* Search */}
              <div className="relative mb-3">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Showing {filteredEmployees.length} of{" "}
                {baseFilteredEmployees.length} employees
              </p>

              {/* Employee list */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredEmployees.map((emp) => {
                  const hasShift = shifts.some(
                    (s) => s.employeeId === emp.employeeId
                  );
                  const catName = getEmployeeCategoryName(emp.employeeId);

                  return (
                    <div
                      key={emp.employeeId}
                      className={`p-3 rounded-xl cursor-pointer border transition-all ${
                        selectedEmployee?.employeeId === emp.employeeId
                          ? "bg-blue-50 border-blue-400"
                          : "bg-gray-50 hover:bg-gray-100 border-transparent"
                      }`}
                      onClick={() => handleEmployeeSelect(emp)}
                    >
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-800 text-sm">
                            {emp.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {emp.employeeId}
                          </p>
                          <p className="text-xs text-gray-500">{emp.email}</p>
                          <p className="text-[11px] text-indigo-600 mt-1">
                            Category: <b>{catName}</b>
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                         
                          <select
                            value={employeeCategories[emp.employeeId] || ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              handleAssignCategory(
                                emp.employeeId,
                                e.target.value
                              )
                            }
                            className="mt-1 text-[11px] border border-gray-300 rounded-full px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">Unassigned</option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredEmployees.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-10">
                    No employees match your search / category filter.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <FaUsers className="text-blue-600" />
                  Select Employees (Bulk)
                </h3>
                <button
                  onClick={handleSelectAllEmployees}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                >
                  {selectedEmployeeIds.length === filteredEmployees.length &&
                  filteredEmployees.length > 0
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>

              <div className="relative mb-3">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mb-2">
                Selected {selectedEmployeeIds.length} of{" "}
                {filteredEmployees.length} shown employees
              </p>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredEmployees.map((emp) => (
                  <div
                    key={emp.employeeId}
                    onClick={() => handleBulkEmployeeToggle(emp.employeeId)}
                    className={`p-3 rounded-xl cursor-pointer border transition-all ${
                      selectedEmployeeIds.includes(emp.employeeId)
                        ? "bg-blue-50 border-blue-400"
                        : "bg-gray-50 hover:bg-gray-100 border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEmployeeIds.includes(emp.employeeId)}
                        readOnly
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">
                          {emp.name}
                        </p>
                        <p className="text-xs text-gray-600">
                          {emp.employeeId} •{" "}
                          {getEmployeeCategoryName(emp.employeeId)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredEmployees.length === 0 && (
                  <div className="text-center text-gray-400 text-sm py-10">
                    No employees match your search / category filter.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN – SHIFT FORMS */}
        <div className="lg:col-span-7">
          {viewMode === "individual" ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex flex-col">
              {selectedEmployee ? (
                <form
                  onSubmit={handleSaveShift}
                  className="flex flex-col h-full"
                >
                  <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaEdit className="text-blue-600" />
                        <span>Configure Shift</span>
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        Employee:{" "}
                        <span className="font-semibold">
                          {selectedEmployee.name}
                        </span>{" "}
                        ({selectedEmployee.employeeId})
                      </p>
                      <p className="text-xs text-indigo-600">
                        Category:{" "}
                        {getEmployeeCategoryName(selectedEmployee.employeeId)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Shift Start Time
                      </label>
                      <input
                        type="time"
                        name="shiftStartTime"
                        value={shiftForm.shiftStartTime}
                        onChange={handleFormChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Shift End Time
                      </label>
                      <input
                        type="time"
                        name="shiftEndTime"
                        value={shiftForm.shiftEndTime}
                        onChange={handleFormChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Late Grace Period (minutes)
                      </label>
                      <input
                        type="number"
                        name="lateGracePeriod"
                        value={shiftForm.lateGracePeriod}
                        onChange={handleFormChange}
                        min="0"
                        max="60"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Employee can punch in this many minutes late without
                        penalty.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Day Hours
                      </label>
                      <input
                        type="number"
                        name="fullDayHours"
                        value={shiftForm.fullDayHours}
                        onChange={handleFormChange}
                        min="1"
                        max="24"
                        step="0.5"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Half Day Hours
                      </label>
                      <input
                        type="number"
                        name="halfDayHours"
                        value={shiftForm.halfDayHours}
                        onChange={handleFormChange}
                        min="1"
                        max="12"
                        step="0.5"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="flex items-center mt-2">
                      <input
                        type="checkbox"
                        name="autoExtendShift"
                        checked={shiftForm.autoExtendShift}
                        onChange={handleFormChange}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label className="ml-3 text-sm font-semibold text-gray-700">
                        Auto-extend shift when late
                      </label>
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Weekly Off Days
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {weekDays.map((day) => (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => handleWeeklyOffToggle(day.value)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                            (shiftForm.weeklyOffDays || []).includes(day.value)
                              ? "bg-blue-600 text-white shadow-md"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 flex flex-wrap gap-4">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 min-w-[180px] bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {saving ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        <>
                          <FaSave />
                          Save Shift Configuration
                        </>
                      )}
                    </button>

                    {shifts.some(
                      (s) => s.employeeId === selectedEmployee.employeeId
                    ) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteShift(selectedEmployee.employeeId)
                        }
                        className="min-w-[180px] bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                      >
                        <FaTrash />
                        Reset to Default
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-gray-500">
                  <FaUserTie className="text-6xl mb-4 text-gray-400" />
                  <p className="text-lg font-medium">
                    Select an employee from the left to configure their shift
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    You can also assign them to Day / Night / Non-IT categories.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 h-full flex flex-col">
              <form
                onSubmit={handleBulkSaveShift}
                className="flex flex-col gap-6 h-full"
              >
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaUsers className="text-blue-600" />
                    <span>Bulk Shift Configuration</span>
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Apply the same shift to{" "}
                    <span className="font-semibold">
                      {selectedEmployeeIds.length}
                    </span>{" "}
                    selected employee
                    {selectedEmployeeIds.length === 1 ? "" : "s"}.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shift Start Time
                    </label>
                    <input
                      type="time"
                      name="shiftStartTime"
                      value={bulkShiftForm.shiftStartTime}
                      onChange={handleBulkFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Shift End Time
                    </label>
                    <input
                      type="time"
                      name="shiftEndTime"
                      value={bulkShiftForm.shiftEndTime}
                      onChange={handleBulkFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Late Grace Period (minutes)
                    </label>
                    <input
                      type="number"
                      name="lateGracePeriod"
                      value={bulkShiftForm.lateGracePeriod}
                      onChange={handleBulkFormChange}
                      min="0"
                      max="60"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Full Day Hours
                    </label>
                    <input
                      type="number"
                      name="fullDayHours"
                      value={bulkShiftForm.fullDayHours}
                      onChange={handleBulkFormChange}
                      min="1"
                      max="24"
                      step="0.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Half Day Hours
                    </label>
                    <input
                      type="number"
                      name="halfDayHours"
                      value={bulkShiftForm.halfDayHours}
                      onChange={handleBulkFormChange}
                      min="1"
                      max="12"
                      step="0.5"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="flex items-center mt-2">
                    <input
                      type="checkbox"
                      name="autoExtendShift"
                      checked={bulkShiftForm.autoExtendShift}
                      onChange={handleBulkFormChange}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <label className="ml-3 text-sm font-semibold text-gray-700">
                      Auto-extend shift when late
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Weekly Off Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {weekDays.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleBulkWeeklyOffToggle(day.value)}
                        className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                          (bulkShiftForm.weeklyOffDays || []).includes(
                            day.value
                          )
                            ? "bg-blue-600 text-white shadow-md"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Selected Employees Preview */}
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Selected Employees ({selectedEmployeeIds.length})
                  </h3>
                  {selectedEmployeesForPreview.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-1">
                      {selectedEmployeesForPreview.map((emp) => (
                        <div
                          key={emp.employeeId}
                          className="text-xs text-gray-700 flex justify-between"
                        >
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-gray-500">
                            {emp.employeeId} •{" "}
                            {getEmployeeCategoryName(emp.employeeId)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      No employees selected yet. Choose employees from the left
                      panel.
                    </p>
                  )}
                </div>

                <div className="mt-auto pt-4">
                  <button
                    type="submit"
                    disabled={saving || selectedEmployeeIds.length === 0}
                    className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <FaSave />
                        Apply to {selectedEmployeeIds.length} Employee
                        {selectedEmployeeIds.length === 1 ? "" : "s"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DepartmentSettings;
