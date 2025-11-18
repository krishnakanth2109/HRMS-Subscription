// --- START OF FILE CurrentEmployeeProfile.jsx ---

/**
 * Editable CurrentEmployeeProfile
 * --------------------------------
 * Features:
 * ✔ Edit all employee details (Basic, Personal, Job, Bank, Experience)
 * ✔ Saves updates to backend API:
 *      PUT http://localhost:5000/api/employees/:employeeId
 * ✔ Automatically updates sessionStorage with the new server response
 * ✔ Converts employeeId to STRING so backend always finds correct record
 * ✔ Supports adding/removing experience blocks
 * ✔ Handles nested fields safely
 *
 * IMPORTANT:
 * - employeeId & email are non-editable by default.
 * - Backend searches employeeId as STRING, so frontend must send STRING.
 */

import React, { useEffect, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:5000";

const CurrentEmployeeProfile = () => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Load Employee from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("hrmsUser");
    if (saved) {
      const parsed = JSON.parse(saved);
      parsed.employeeId = String(parsed.employeeId); // 🔥 FIX: Ensure string
      setEmployee(parsed);
    }
    setLoading(false);
  }, []);

  if (loading) return <div className="p-6 text-center">Loading profile...</div>;

  if (!employee)
    return (
      <div className="p-6 text-red-600 text-center">
        Employee not found. Please log in again.
      </div>
    );

  // ---------------- UPDATE HELPERS ----------------

  const handleBasicChange = (field, value) => {
    setEmployee((p) => ({ ...p, [field]: value }));
  };

  const handleNestedChange = (section, field, value) => {
    setEmployee((p) => ({
      ...p,
      [section]: { ...(p[section] || {}), [field]: value },
    }));
  };

  // Emergency Contact handling
  const parseEmergency = () => {
    if (!employee.emergency) return { name: "", phone: "" };

    if (employee.emergency.includes("-")) {
      const [n, p] = employee.emergency.split("-").map((x) => x.trim());
      return { name: n, phone: p };
    }
    return { name: employee.emergency, phone: "" };
  };

  const writeEmergency = (name, phone) => {
    setEmployee((p) => ({ ...p, emergency: `${name} - ${phone}` }));
  };

  // Experience Helpers
  const updateExp = (i, field, value) => {
    setEmployee((p) => {
      const list = [...(p.experienceDetails || [])];
      list[i] = { ...list[i], [field]: value };
      return { ...p, experienceDetails: list };
    });
  };

  const addExperience = () => {
    setEmployee((p) => ({
      ...p,
      experienceDetails: [
        ...(p.experienceDetails || []),
        {
          company: "",
          role: "",
          department: "",
          years: "",
          joiningDate: "",
          lastWorkingDate: "",
          salary: "",
          reason: "",
          experienceLetterUrl: "",
        },
      ],
    }));
  };

  const removeExperience = (i) => {
    setEmployee((p) => {
      const list = [...(p.experienceDetails || [])];
      list.splice(i, 1);
      return { ...p, experienceDetails: list };
    });
  };

  // ---------------- SAVE TO BACKEND ----------------

  const saveChanges = async () => {
    if (!employee.employeeId) {
      alert("Cannot update — employeeId missing");
      return;
    }

    const empId = String(employee.employeeId); // 🔥 FIX: STRING always

    const updatedEmployee = {
      ...employee,
      employeeId: empId, // 🔥 ensure body also has string
    };

    setSaving(true);

    try {
      const { data } = await axios.put(
        `${API_BASE}/api/employees/${empId}`, // 🔥 FIXED URL
        updatedEmployee
      );

      data.employeeId = String(data.employeeId); // ensure consistent

      sessionStorage.setItem("hrmsUser", JSON.stringify(data));
      setEmployee(data);

      alert("Profile updated successfully!");
      setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Failed to update: " + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  // Toggle Edit Mode
  const toggleEdit = () => {
    if (isEditing) {
      saveChanges();
    } else {
      setIsEditing(true);
    }
  };

  // Extract Data
  const {
    employeeId,
    name,
    email,
    phone,
    address,
    personalDetails = {},
    bankDetails = {},
    experienceDetails = [],
    currentDepartment,
    currentRole,
    joiningDate,
    currentSalary,
  } = employee;

  const emergency = parseEmergency();

  return (
    <div className="p-8 bg-gray-50 min-h-screen">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">My Profile</h2>

        <div className="flex gap-3">
          {isEditing && (
            <button
              onClick={() => {
                const saved = JSON.parse(sessionStorage.getItem("hrmsUser"));
                saved.employeeId = String(saved.employeeId);
                setEmployee(saved);
                setIsEditing(false);
              }}
              className="px-4 py-2 border rounded"
            >
              Cancel
            </button>
          )}

          <button
            onClick={toggleEdit}
            disabled={saving}
            className={`px-5 py-2 rounded text-white ${
              isEditing ? "bg-green-600" : "bg-blue-600"
            }`}
          >
            {saving ? "Saving..." : isEditing ? "Save" : "Edit"}
          </button>
        </div>
      </div>

      {/* --------------------- SECTIONS --------------------- */}

      {/* Basic Details */}
      <Section title="Basic Details">
        <TwoCol>
          <StaticField label="Employee ID" value={employeeId} />

          <EditableField
            label="Name"
            value={name}
            editable={isEditing}
            onChange={(v) => handleBasicChange("name", v)}
          />

          <StaticField label="Email" value={email} />

          <EditableField
            label="Phone"
            value={phone}
            editable={isEditing}
            onChange={(v) => handleBasicChange("phone", v)}
          />

          <FullWidthEditable
            label="Address"
            value={address}
            editable={isEditing}
            onChange={(v) => handleBasicChange("address", v)}
          />

          <EditableField
            label="Emergency Name"
            value={emergency.name}
            editable={isEditing}
            onChange={(v) => writeEmergency(v, emergency.phone)}
          />

          <EditableField
            label="Emergency Phone"
            value={emergency.phone}
            editable={isEditing}
            onChange={(v) => writeEmergency(emergency.name, v)}
          />
        </TwoCol>
      </Section>

      {/* Personal Details */}
      <Section title="Personal Details">
        <TwoCol>
          <EditableField
            label="Date of Birth"
            type="date"
            value={personalDetails.dob?.split("T")[0] || ""}
            editable={isEditing}
            onChange={(v) => handleNestedChange("personalDetails", "dob", v)}
          />

          <EditableField
            label="Gender"
            value={personalDetails.gender}
            editable={isEditing}
            onChange={(v) => handleNestedChange("personalDetails", "gender", v)}
          />

          <EditableField
            label="Marital Status"
            value={personalDetails.maritalStatus}
            editable={isEditing}
            onChange={(v) =>
              handleNestedChange("personalDetails", "maritalStatus", v)
            }
          />

          <EditableField
            label="Nationality"
            value={personalDetails.nationality}
            editable={isEditing}
            onChange={(v) =>
              handleNestedChange("personalDetails", "nationality", v)
            }
          />

          <EditableField
            label="Aadhaar Number"
            value={personalDetails.aadharNumber}
            editable={isEditing}
            onChange={(v) =>
              handleNestedChange("personalDetails", "aadharNumber", v)
            }
          />

          <EditableField
            label="PAN Number"
            value={personalDetails.panNumber}
            editable={isEditing}
            onChange={(v) =>
              handleNestedChange("personalDetails", "panNumber", v)
            }
          />
        </TwoCol>
      </Section>

      {/* Job Details */}
      <Section title="Job Details">
        <TwoCol>
          <EditableField
            label="Department"
            value={currentDepartment}
            editable={isEditing}
            onChange={(v) => handleBasicChange("currentDepartment", v)}
          />

          <EditableField
            label="Role"
            value={currentRole}
            editable={isEditing}
            onChange={(v) => handleBasicChange("currentRole", v)}
          />

          <EditableField
            label="Joining Date"
            type="date"
            value={joiningDate?.split("T")[0] || ""}
            editable={isEditing}
            onChange={(v) => handleBasicChange("joiningDate", v)}
          />

          <EditableField
            label="Current Salary"
            value={currentSalary}
            editable={isEditing}
            onChange={(v) => handleBasicChange("currentSalary", v)}
          />
        </TwoCol>
      </Section>

      {/* Bank Details */}
      <Section title="Bank Details">
        <TwoCol>
          <EditableField
            label="Bank Name"
            value={bankDetails.bankName}
            editable={isEditing}
            onChange={(v) => handleNestedChange("bankDetails", "bankName", v)}
          />

          <EditableField
            label="Account Number"
            value={bankDetails.accountNumber}
            editable={isEditing}
            onChange={(v) =>
              handleNestedChange("bankDetails", "accountNumber", v)
            }
          />

          <EditableField
            label="IFSC Code"
            value={bankDetails.ifsc}
            editable={isEditing}
            onChange={(v) => handleNestedChange("bankDetails", "ifsc", v)}
          />

          <EditableField
            label="Branch"
            value={bankDetails.branch}
            editable={isEditing}
            onChange={(v) => handleNestedChange("bankDetails", "branch", v)}
          />
        </TwoCol>
      </Section>

      {/* Experience */}
      <Section title="Experience Details">
        {isEditing && (
          <button
            onClick={addExperience}
            className="px-4 py-2 bg-blue-600 text-white rounded"
          >
            + Add Experience
          </button>
        )}

        {experienceDetails.length === 0 && (
          <p className="text-gray-500 mt-3">No experience details available.</p>
        )}

        {experienceDetails.map((exp, i) => (
          <div key={i} className="border p-4 rounded bg-white mt-4">
            <TwoCol>
              <EditableField
                label="Company"
                value={exp.company}
                editable={isEditing}
                onChange={(v) => updateExp(i, "company", v)}
              />

              <EditableField
                label="Role"
                value={exp.role}
                editable={isEditing}
                onChange={(v) => updateExp(i, "role", v)}
              />

              <EditableField
                label="Department"
                value={exp.department}
                editable={isEditing}
                onChange={(v) => updateExp(i, "department", v)}
              />

              <EditableField
                label="Years"
                value={exp.years}
                editable={isEditing}
                onChange={(v) => updateExp(i, "years", v)}
              />

              <EditableField
                label="Joining Date"
                type="date"
                value={exp.joiningDate?.split("T")[0] || ""}
                editable={isEditing}
                onChange={(v) => updateExp(i, "joiningDate", v)}
              />

              <EditableField
                label="Last Working"
                type="date"
                value={exp.lastWorkingDate?.split("T")[0] || ""}
                editable={isEditing}
                onChange={(v) => updateExp(i, "lastWorkingDate", v)}
              />

              <EditableField
                label="Salary"
                value={exp.salary}
                editable={isEditing}
                onChange={(v) => updateExp(i, "salary", v)}
              />

              <FullWidthEditable
                label="Reason for Leaving"
                value={exp.reason}
                editable={isEditing}
                onChange={(v) => updateExp(i, "reason", v)}
              />
            </TwoCol>

            {isEditing && (
              <button
                onClick={() => removeExperience(i)}
                className="mt-3 px-3 py-1 border text-red-600 rounded"
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
};

export default CurrentEmployeeProfile;

/* ---------------- SMALL COMPONENTS ---------------- */

const Section = ({ title, children }) => (
  <div className="bg-white p-6 rounded-lg shadow mb-6">
    <h3 className="text-xl font-bold mb-4 text-blue-700 border-b pb-2">
      {title}
    </h3>
    {children}
  </div>
);

const TwoCol = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
);

const StaticField = ({ label, value }) => (
  <div>
    <strong>{label}:</strong>
    <p>{value || "N/A"}</p>
  </div>
);

const EditableField = ({ label, value, editable, onChange, type = "text" }) => (
  <div>
    <strong>{label}:</strong>
    {editable ? (
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 mt-1 border rounded"
      />
    ) : (
      <p>{value || "N/A"}</p>
    )}
  </div>
);

const FullWidthEditable = ({ label, value, editable, onChange }) => (
  <div className="md:col-span-2">
    <EditableField label={label} value={value} editable={editable} onChange={onChange} />
  </div>
);
