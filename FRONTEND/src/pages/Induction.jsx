import { useContext, useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import {
  FaCalendarAlt,
  FaChevronDown,
  FaCheckSquare,
  FaClock,
  FaConnectdevelop,
  FaEnvelope,
  FaFileUpload,
  FaFilter,
  FaLink,
  FaMapMarkerAlt,
  FaSearch,
  FaUser,
  FaUsers,
} from "react-icons/fa";
import { EmployeeContext } from "../context/EmployeeContext";
import {
  sendInductionEmail,
  addEmployee as addEmployeeApi,
  getAllCompanies as getAllCompaniesApi,
  getNextEmployeeId as getNextEmployeeIdApi,
} from "../api";

const INDUCTION_TYPES = [
  "Classroom Lecture",
  "PowerPoint Presentation",
  "Online Module",
  "Handout Reading Material",
  "One-to-One Session",
  "Induction Program Duration",
  "Site / Client Visit",
];

const FILE_CONFIG = {
  "PowerPoint Presentation": {
    accept: ".pdf,.ppt,.pptx",
    allowedTypes: [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  "Handout Reading Material": {
    accept: ".pdf,.doc,.docx",
    allowedTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
};

const INITIAL_FORM = {
  inductionType: "",
  date: "",
  time: "",
  venueOrPlatform: "",
  meetingLink: "",
  startDate: "",
  endDate: "",
};

const INITIAL_EMPLOYEE_FORM = {
  company: "",
  companyName: "",
  companyPrefix: "",
  employeeId: "",
  name: "",
  email: "",
  password: "",
  phone: "",
  employmentType: "Full-Time",
  joiningDate: "",
  currentDepartment: "",
  currentRole: "",
  currentSalary: "",
};

const isFileRequired = (inductionType) =>
  inductionType === "PowerPoint Presentation" ||
  inductionType === "Handout Reading Material";

const Induction = () => {
  const { employees = [], fetchEmployees } = useContext(EmployeeContext);
  const [selectionMode, setSelectionMode] = useState("multiple");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState(INITIAL_FORM);
  const [attachment, setAttachment] = useState(null);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [newEmployeeForm, setNewEmployeeForm] = useState(INITIAL_EMPLOYEE_FORM);

  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const data = await getAllCompaniesApi();
        setCompanies(data.data || data || []);
      } catch (error) {
        console.error("Failed to load companies:", error);
      }
    };

    loadCompanies();
  }, []);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => employee.isActive !== false),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return activeEmployees;

    return activeEmployees.filter((employee) => {
      const parts = [
        employee.name,
        employee.employeeId,
        employee.email,
        employee.companyName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return parts.includes(query);
    });
  }, [activeEmployees, searchTerm]);

  const selectedEmployees = useMemo(
    () =>
      activeEmployees.filter((employee) =>
        selectedEmployeeIds.includes(employee._id)
      ),
    [activeEmployees, selectedEmployeeIds]
  );

  useEffect(() => {
    if (form.inductionType === "One-to-One Session") {
      setSelectionMode("single");
      setSelectedEmployeeIds((prev) => prev.slice(0, 1));
    }
  }, [form.inductionType]);

  useEffect(() => {
    if (selectionMode === "single" && selectedEmployeeIds.length > 1) {
      setSelectedEmployeeIds((prev) => prev.slice(0, 1));
    }
  }, [selectionMode, selectedEmployeeIds]);

  const previewText = useMemo(() => {
    const previewEmployee = selectedEmployees[0]?.name || "{{employee_name}}";
    const isDuration = form.inductionType === "Induction Program Duration";
    const dateValue = isDuration
      ? form.startDate && form.endDate
        ? `${form.startDate} to ${form.endDate}`
        : "{{date}}"
      : form.date || "{{date}}";
    const timeValue = isDuration
      ? form.time || "As per induction program schedule"
      : form.time || "{{time}}";
    const venueOrLink =
      form.inductionType === "Online Module"
        ? form.meetingLink || "{{venue_or_link}}"
        : form.venueOrPlatform || "{{venue_or_link}}";

    let adminName = "{{admin_name}}";
    let companyName = "{{company_name}}";

    try {
      const raw = sessionStorage.getItem("hrmsUser");
      if (raw) {
        const user = JSON.parse(raw);
        adminName = user?.name || adminName;
      }
    } catch {
      // Preview fallback is fine here.
    }

    if (selectedEmployees[0]?.companyName) {
      companyName = selectedEmployees[0].companyName;
    }

    return `Dear ${previewEmployee},

Greetings!

You are scheduled to attend the following induction activity. Please find the details below:

Activity: ${form.inductionType || "{{activity_type}}"}
Date: ${dateValue}
Time: ${timeValue}
Venue / Platform: ${venueOrLink}

Kindly ensure your availability at the scheduled time.

Best regards,
${adminName}
${companyName}`;
  }, [form, selectedEmployees]);

  const toggleEmployee = (employeeId) => {
    if (selectionMode === "single") {
      setSelectedEmployeeIds([employeeId]);
      setShowEmployeeDropdown(false);
      return;
    }

    setSelectedEmployeeIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectionMode === "single") return;

    const visibleIds = filteredEmployees.map((employee) => employee._id);
    const allVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedEmployeeIds.includes(id));

    setSelectedEmployeeIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...prev, ...visibleIds])];
    });
  };

  const handleInputChange = (key, value) => {
    if (key === "inductionType") {
      setAttachment(null);
      setLastResult(null);
      setForm((prev) => ({
        ...prev,
        inductionType: value,
        date: "",
        time: "",
        venueOrPlatform: "",
        meetingLink: "",
        startDate: "",
        endDate: "",
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setAttachment(null);
      return;
    }

    const config = FILE_CONFIG[form.inductionType];
    if (!config?.allowedTypes.includes(file.type)) {
      Swal.fire("Invalid File", "Please upload a valid file type.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      Swal.fire("File Too Large", "Please upload a file under 10 MB.", "error");
      event.target.value = "";
      return;
    }

    setAttachment(file);
  };

  const validateForm = () => {
    if (!selectedEmployeeIds.length) {
      return "Please select at least one employee.";
    }

    if (!form.inductionType) {
      return "Please choose an induction type.";
    }

    if (
      form.inductionType === "One-to-One Session" &&
      selectedEmployeeIds.length !== 1
    ) {
      return "One-to-One Session requires exactly one employee.";
    }

    if (form.inductionType === "Induction Program Duration") {
      if (!form.startDate || !form.endDate || !form.venueOrPlatform) {
        return "Start date, end date, and venue/platform are required.";
      }
      if (form.endDate < form.startDate) {
        return "End date cannot be earlier than start date.";
      }
    } else if (form.inductionType === "Online Module") {
      if (!form.date || !form.time || !form.meetingLink) {
        return "Date, time, and meeting link are required.";
      }
    } else if (!form.date || !form.time || !form.venueOrPlatform) {
      return "Date, time, and venue/platform are required.";
    }

    if (isFileRequired(form.inductionType) && !attachment) {
      return "Please upload the required file.";
    }

    return null;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      Swal.fire("Missing Details", validationMessage, "warning");
      return;
    }

    const payload = new FormData();
    payload.append("employeeIds", JSON.stringify(selectedEmployeeIds));
    payload.append("inductionType", form.inductionType);

    if (form.date) payload.append("date", form.date);
    if (form.time) payload.append("time", form.time);
    if (form.venueOrPlatform) {
      payload.append("venueOrPlatform", form.venueOrPlatform);
    }
    if (form.meetingLink) payload.append("meetingLink", form.meetingLink);
    if (form.startDate) payload.append("startDate", form.startDate);
    if (form.endDate) payload.append("endDate", form.endDate);
    if (attachment) payload.append("attachment", attachment);

    try {
      setSending(true);
      const response = await sendInductionEmail(payload);
      setLastResult(response);

      Swal.fire(
        "Emails Processed",
        response.message || "Induction emails processed successfully.",
        response.summary?.failed ? "warning" : "success"
      );
    } catch (error) {
      Swal.fire(
        "Send Failed",
        error.response?.data?.message || "Failed to send induction email.",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const handleNewEmployeeChange = (key, value) => {
    setNewEmployeeForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleNewEmployeeCompanyChange = async (companyId) => {
    const selectedCompany = companies.find((company) => company._id === companyId);

    if (!selectedCompany) {
      setNewEmployeeForm(INITIAL_EMPLOYEE_FORM);
      return;
    }

    try {
      const idResponse = await getNextEmployeeIdApi(companyId);
      const nextEmployeeId =
        idResponse?.nextEmployeeId ||
        idResponse?.employeeId ||
        idResponse?.data?.nextEmployeeId ||
        "";

      setNewEmployeeForm((prev) => ({
        ...prev,
        company: companyId,
        companyName: selectedCompany.name,
        companyPrefix: selectedCompany.prefix,
        employeeId: nextEmployeeId,
      }));
    } catch (error) {
      Swal.fire("Error", "Failed to generate employee ID.", "error");
    }
  };

  const validateNewEmployeeForm = () => {
    if (!newEmployeeForm.company) return "Please select a company.";
    if (!newEmployeeForm.name.trim()) return "Employee name is required.";
    if (!newEmployeeForm.email.trim()) return "Employee email is required.";
    if (!/^\S+@\S+\.\S+$/.test(newEmployeeForm.email.trim())) {
      return "Please enter a valid email address.";
    }
    if (!newEmployeeForm.password.trim()) return "Password is required.";
    if (newEmployeeForm.password.length < 8) {
      return "Password must be at least 8 characters.";
    }
    if (newEmployeeForm.phone && !/^\d{10}$/.test(newEmployeeForm.phone.trim())) {
      return "Phone number must be exactly 10 digits.";
    }
    if (!newEmployeeForm.currentDepartment.trim()) return "Department is required.";
    if (!newEmployeeForm.currentRole.trim()) return "Role is required.";
    if (!newEmployeeForm.joiningDate) return "Joining date is required.";
    if (!newEmployeeForm.currentSalary) return "Salary is required.";
    if (Number(newEmployeeForm.currentSalary) <= 0) {
      return "Salary must be greater than 0.";
    }

    return null;
  };

  const handleAddEmployee = async (event) => {
    event.preventDefault();

    const validationMessage = validateNewEmployeeForm();
    if (validationMessage) {
      Swal.fire("Missing Details", validationMessage, "warning");
      return;
    }

    const payload = {
      company: newEmployeeForm.company,
      companyName: newEmployeeForm.companyName,
      companyPrefix: newEmployeeForm.companyPrefix,
      employeeId: newEmployeeForm.employeeId,
      name: newEmployeeForm.name.trim(),
      email: newEmployeeForm.email.trim().toLowerCase(),
      password: newEmployeeForm.password,
      phone: newEmployeeForm.phone.trim(),
      isActive: true,
      experienceDetails: [
        {
          company: newEmployeeForm.companyName,
          role: newEmployeeForm.currentRole.trim(),
          department: newEmployeeForm.currentDepartment.trim(),
          years: 0,
          joiningDate: newEmployeeForm.joiningDate,
          lastWorkingDate: "Present",
          salary: Number(newEmployeeForm.currentSalary),
          employmentType: newEmployeeForm.employmentType,
        },
      ],
    };

    try {
      setAddingEmployee(true);
      await addEmployeeApi(payload);
      await fetchEmployees?.();
      setShowAddEmployeeModal(false);
      setNewEmployeeForm(INITIAL_EMPLOYEE_FORM);
      Swal.fire("Success", "Employee added successfully.", "success");
    } catch (error) {
      Swal.fire(
        "Add Failed",
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to add employee.",
        "error"
      );
    } finally {
      setAddingEmployee(false);
    }
  };

  const renderScheduleFields = () => {
    if (form.inductionType === "Induction Program Duration") {
      return (
        <div className="grid gap-4 md:grid-cols-2">
          <InputField
            label="Start Date"
            icon={<FaCalendarAlt />}
            type="date"
            value={form.startDate}
            onChange={(value) => handleInputChange("startDate", value)}
          />
          <InputField
            label="End Date"
            icon={<FaCalendarAlt />}
            type="date"
            value={form.endDate}
            onChange={(value) => handleInputChange("endDate", value)}
          />
          <InputField
            label="Venue / Platform"
            icon={<FaMapMarkerAlt />}
            placeholder="Enter venue or schedule platform"
            value={form.venueOrPlatform}
            onChange={(value) => handleInputChange("venueOrPlatform", value)}
          />
          <InputField
            label="Program Schedule (Optional)"
            icon={<FaClock />}
            placeholder="Example: 10:00 AM to 4:00 PM"
            value={form.time}
            onChange={(value) => handleInputChange("time", value)}
          />
        </div>
      );
    }

    if (form.inductionType === "Online Module") {
      return (
        <div className="grid gap-4 md:grid-cols-3">
          <InputField
            label="Date"
            icon={<FaCalendarAlt />}
            type="date"
            value={form.date}
            onChange={(value) => handleInputChange("date", value)}
          />
          <InputField
            label="Time"
            icon={<FaClock />}
            type="time"
            value={form.time}
            onChange={(value) => handleInputChange("time", value)}
          />
          <InputField
            label="Meeting Link"
            icon={<FaLink />}
            placeholder="Paste Google Meet / Zoom link"
            value={form.meetingLink}
            onChange={(value) => handleInputChange("meetingLink", value)}
          />
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-3">
        <InputField
          label="Date"
          icon={<FaCalendarAlt />}
          type="date"
          value={form.date}
          onChange={(value) => handleInputChange("date", value)}
        />
        <InputField
          label="Time"
          icon={<FaClock />}
          type="time"
          value={form.time}
          onChange={(value) => handleInputChange("time", value)}
        />
        <InputField
          label="Venue / Platform"
          icon={<FaMapMarkerAlt />}
          placeholder="Enter venue or platform"
          value={form.venueOrPlatform}
          onChange={(value) => handleInputChange("venueOrPlatform", value)}
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
         <div className="bg-blue-50 px-5 py-4 md:px-6 md:py-5">
  <h1 className="text-xl font-semibold text-blue-800 md:text-2xl">
    Induction Email Center
  </h1>
  <p className="mt-1 max-w-2xl text-sm leading-5 text-blue-500 md:text-sm">
    Select employees, choose an induction activity, fill the schedule,
    and send personalized emails automatically from HRMS.
  </p>
</div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <div className="border-b border-slate-200 pb-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Employee Selection
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Choose a single employee or send personalized induction emails
                    in bulk.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectionMode("single")}
                    disabled={form.inductionType === "One-to-One Session"}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      selectionMode === "single"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } ${
                      form.inductionType === "One-to-One Session"
                        ? "cursor-not-allowed opacity-60"
                        : ""
                    }`}
                  >
                    Single Select
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode("multiple")}
                    disabled={form.inductionType === "One-to-One Session"}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      selectionMode === "multiple"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    } ${
                      form.inductionType === "One-to-One Session"
                        ? "cursor-not-allowed opacity-60"
                        : ""
                    }`}
                  >
                    Bulk Select
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-3 block text-sm font-semibold text-slate-800">
                Select Employee
              </label>

              <div className="flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={() => setShowEmployeeDropdown((prev) => !prev)}
                  className={`flex flex-1 items-center justify-between rounded-3xl border px-5 py-4 text-left transition ${
                    showEmployeeDropdown
                      ? "border-sky-400 bg-white shadow-sm"
                      : "border-slate-200 bg-slate-50 hover:border-sky-300 hover:bg-white"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <FaSearch />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-medium text-slate-900">
                        {selectedEmployees.length
                          ? selectedEmployees
                              .slice(0, 2)
                              .map((employee) => employee.name)
                              .join(", ")
                          : "Select employee"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {selectedEmployees.length
                          ? `${selectedEmployees.length} employee(s) selected`
                          : "Open the dropdown to choose from employee records"}
                      </p>
                    </div>
                  </div>
                  <FaChevronDown
                    className={`shrink-0 text-slate-500 transition ${
                      showEmployeeDropdown ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  disabled={selectionMode === "single"}
                  className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    selectionMode === "single"
                      ? "cursor-not-allowed bg-slate-100 text-slate-400"
                      : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                  }`}
                >
                  {selectionMode === "single"
                    ? "Single Mode"
                    : "Select All Visible"}
                </button>
              </div>

              {showEmployeeDropdown && (
                <div className="mt-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="relative">
                    <FaSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search employees by name, ID, email, or company"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    />
                  </div>

                  <div className="mt-3 max-h-[280px] space-y-1.5 overflow-y-auto pr-1">
                    {filteredEmployees.map((employee) => {
                      const isSelected = selectedEmployeeIds.includes(employee._id);

                      return (
                        <button
                          key={employee._id}
                          type="button"
                          onClick={() => toggleEmployee(employee._id)}
                          className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left transition ${
                            isSelected
                              ? "border-sky-500 bg-sky-50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold text-slate-900">
                              {employee.name}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500">
                              {employee.employeeId}
                            </p>
                            <p className="mt-1.5 truncate text-[13px] text-slate-600">
                              {employee.email}
                            </p>
                            <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                              {employee.companyName || "No company"}
                            </p>
                          </div>
                          <span
                            className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                              isSelected
                                ? "bg-sky-600 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {selectionMode === "single" ? (
                              <FaUser className="text-[10px]" />
                            ) : (
                              <FaCheckSquare className="text-[10px]" />
                            )}
                          </span>
                        </button>
                      );
                    })}

                    {!filteredEmployees.length && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                        No employees match the current search.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                    Selected Employees
                  </p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {selectedEmployees.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployeeIds([])}
                  className="rounded-xl bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-300"
                >
                  Clear Selection
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedEmployees.map((employee) => (
                  <span
                    key={employee._id}
                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    <FaUsers className="text-[10px] text-sky-600" />
                    {employee.name}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6"
            >
              <div className="border-b border-slate-200 pb-5">
                <h2 className="text-xl font-bold text-slate-900">
                  Induction Details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  The system will generate personalized emails for each selected
                  employee using your required template.
                </p>
              </div>

              <div className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Induction Type
                  </label>
                  <div className="relative">
                    <FaFilter className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select
                      value={form.inductionType}
                      onChange={(event) =>
                        handleInputChange("inductionType", event.target.value)
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                    >
                      <option value="">Select induction type</option>
                      {INDUCTION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {form.inductionType && renderScheduleFields()}

                {form.inductionType && isFileRequired(form.inductionType) && (
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Upload Supporting File
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-sky-300 bg-sky-50 px-4 py-4 text-sm text-slate-700 transition hover:border-sky-400 hover:bg-sky-100">
                      <FaFileUpload className="text-sky-600" />
                      <span className="font-medium">
                        {attachment
                          ? attachment.name
                          : "Choose PDF / PPT / DOC file"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept={FILE_CONFIG[form.inductionType]?.accept}
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={sending}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${
                    sending
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-slate-900 hover:bg-slate-800"
                  }`}
                >
                  <FaEnvelope />
                  {sending ? "Sending Emails..." : "Send Email"}
                </button>
              </div>
            </form>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h2 className="text-xl font-bold text-slate-900">
                Email Preview
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                This preview follows the exact template and updates as you fill
                the form.
              </p>
          <pre className="mt-4 overflow-x-auto rounded-2xl bg-white p-5 text-sm leading-7 text-black border border-gray-300 shadow-sm">
  {previewText}
</pre>
            </section>

            {lastResult && (
              <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                <h2 className="text-xl font-bold text-slate-900">
                  Last Send Summary
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <SummaryCard
                    title="Total"
                    value={lastResult.summary?.total || 0}
                    color="text-slate-900"
                  />
                  <SummaryCard
                    title="Accepted"
                    value={lastResult.summary?.sent || 0}
                    color="text-emerald-600"
                  />
                  <SummaryCard
                    title="Failed"
                    value={lastResult.summary?.failed || 0}
                    color="text-rose-600"
                  />
                </div>
                <div className="mt-4 space-y-2">
                  {(lastResult.results || []).map((item) => (
                    <div
                      key={`${item.employeeId}-${item.email}`}
                      className="rounded-2xl border border-slate-200 px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {item.employeeName}
                          </p>
                          <p className="text-xs text-slate-500">{item.email}</p>
                          {item.provider && (
                            <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">
                              Provider: {item.provider}
                            </p>
                          )}
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] ${
                            item.status === "sent"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {item.status === "sent" ? "accepted" : item.status}
                        </span>
                      </div>
                      {item.error && (
                        <p className="mt-2 text-xs text-rose-600">
                          {item.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>
      </div>

      {showAddEmployeeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  Add New Employee
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Create an employee here and use them immediately for induction.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddEmployeeModal(false);
                  setNewEmployeeForm(INITIAL_EMPLOYEE_FORM);
                }}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddEmployee} className="space-y-6 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Company
                  </label>
                  <select
                    value={newEmployeeForm.company}
                    onChange={(event) =>
                      handleNewEmployeeCompanyChange(event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">Select company</option>
                    {companies.map((company) => (
                      <option key={company._id} value={company._id}>
                        {company.name} ({company.prefix})
                      </option>
                    ))}
                  </select>
                </div>

                <InputField
                  label="Employee ID"
                  icon={<FaUser />}
                  value={newEmployeeForm.employeeId}
                  onChange={(value) =>
                    handleNewEmployeeChange("employeeId", value.toUpperCase())
                  }
                  placeholder="Auto-generated employee ID"
                />

                <InputField
                  label="Full Name"
                  icon={<FaUser />}
                  value={newEmployeeForm.name}
                  onChange={(value) => handleNewEmployeeChange("name", value)}
                  placeholder="Enter employee name"
                />

                <InputField
                  label="Email"
                  icon={<FaEnvelope />}
                  type="email"
                  value={newEmployeeForm.email}
                  onChange={(value) => handleNewEmployeeChange("email", value)}
                  placeholder="Enter employee email"
                />

                <InputField
                  label="Password"
                  icon={<FaUser />}
                  type="password"
                  value={newEmployeeForm.password}
                  onChange={(value) =>
                    handleNewEmployeeChange("password", value)
                  }
                  placeholder="Minimum 8 characters"
                />

                <InputField
                  label="Phone"
                  icon={<FaUser />}
                  value={newEmployeeForm.phone}
                  onChange={(value) =>
                    handleNewEmployeeChange(
                      "phone",
                      value.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                  placeholder="10 digit phone number"
                />

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Employment Type
                  </label>
                  <select
                    value={newEmployeeForm.employmentType}
                    onChange={(event) =>
                      handleNewEmployeeChange("employmentType", event.target.value)
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
                  >
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                    <option value="Intern">Intern</option>
                    <option value="Contract">Contract</option>
                  </select>
                </div>

                <InputField
                  label="Department"
                  icon={<FaUsers />}
                  value={newEmployeeForm.currentDepartment}
                  onChange={(value) =>
                    handleNewEmployeeChange("currentDepartment", value)
                  }
                  placeholder="Enter department"
                />

                <InputField
                  label="Role"
                  icon={<FaUser />}
                  value={newEmployeeForm.currentRole}
                  onChange={(value) =>
                    handleNewEmployeeChange("currentRole", value)
                  }
                  placeholder="Enter current role"
                />

                <InputField
                  label="Joining Date"
                  icon={<FaCalendarAlt />}
                  type="date"
                  value={newEmployeeForm.joiningDate}
                  onChange={(value) =>
                    handleNewEmployeeChange("joiningDate", value)
                  }
                />

                <InputField
                  label="Current Salary"
                  icon={<FaClock />}
                  type="number"
                  value={newEmployeeForm.currentSalary}
                  onChange={(value) =>
                    handleNewEmployeeChange("currentSalary", value)
                  }
                  placeholder="Enter salary"
                />
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEmployeeModal(false);
                    setNewEmployeeForm(INITIAL_EMPLOYEE_FORM);
                  }}
                  className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingEmployee}
                  className={`rounded-2xl px-5 py-3 text-sm font-bold text-white transition ${
                    addingEmployee
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {addingEmployee ? "Adding Employee..." : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const InputField = ({
  label,
  icon,
  type = "text",
  placeholder,
  value,
  onChange,
}) => (
  <div>
    <label className="mb-2 block text-sm font-semibold text-slate-700">
      {label}
    </label>
    <div className="relative">
      <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
        {icon}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-sky-500 focus:bg-white"
      />
    </div>
  </div>
);

const SummaryCard = ({ title, value, color }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
      {title}
    </p>
    <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
  </div>
);

export default Induction;
