// --- START OF FILE CurrentEmployeeProfile.jsx ---

import React, { useEffect, useState } from "react";
// ✅ Step 1: Remove all context and axios imports. This component is now self-reliant.

const CurrentEmployeeProfile = () => {
  // ✅ Step 2: Create local state to hold the employee data and loading status.
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Step 3: Use useEffect to load the user directly from sessionStorage on mount.
  useEffect(() => {
    const savedUser = sessionStorage.getItem("hrmsUser");
    if (savedUser) {
      setEmployee(JSON.parse(savedUser));
    }
    setLoading(false); // Stop loading after attempting to get the user
  }, []); // The empty array means this runs only once when the component mounts.

  if (loading) {
    return <div className="p-6 text-xl text-center">Loading profile...</div>;
  }

  if (!employee) {
    return <div className="p-6 text-red-600 text-center">Employee not found. Please log in again.</div>;
  }

  // ✅ Step 4: Destructure data from the local 'employee' state variable.
  const {
    employeeId, name, email, phone, address, emergency,
    personalDetails = {}, bankDetails = {}, experienceDetails = [],
    currentDepartment, currentRole, joiningDate, currentSalary
  } = employee;

  // Helper to split emergency contact info
  const [emergencyName, emergencyPhone] = emergency?.includes("-")
    ? emergency.split("-").map(part => part.trim())
    : [emergency || "N/A", ""];

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <h2 className="text-3xl font-bold text-gray-800 mb-8">My Profile</h2>

      {/* BASIC DETAILS */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-bold text-xl mb-4 text-blue-700 border-b pb-2">Basic Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Employee ID:</strong> {employeeId}</p>
          <p><strong>Name:</strong> {name}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Phone:</strong> {phone || 'N/A'}</p>
          <p className="md:col-span-2"><strong>Address:</strong> {address || 'N/A'}</p>
          <p><strong>Emergency Contact Name:</strong> {emergencyName}</p>
          <p><strong>Emergency Contact Phone:</strong> {emergencyPhone}</p>
        </div>
      </div>

      {/* PERSONAL DETAILS */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-bold text-xl mb-4 text-blue-700 border-b pb-2">Personal Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Date of Birth:</strong> {personalDetails.dob?.split("T")[0] || 'N/A'}</p>
          <p><strong>Gender:</strong> {personalDetails.gender || 'N/A'}</p>
          <p><strong>Marital Status:</strong> {personalDetails.maritalStatus || 'N/A'}</p>
          <p><strong>Nationality:</strong> {personalDetails.nationality || 'N/A'}</p>
          <p><strong>Aadhaar Number:</strong> {personalDetails.aadharNumber || 'N/A'}</p>
          <p><strong>PAN Number:</strong> {personalDetails.panNumber || 'N/A'}</p>
          <p>
            <strong>Aadhaar File:</strong>{" "}
            {personalDetails.aadharFileUrl ? (
              <a href={personalDetails.aadharFileUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">View Aadhaar</a>
            ) : "Not Uploaded"}
          </p>
          <p>
            <strong>PAN File:</strong>{" "}
            {personalDetails.panFileUrl ? (
              <a href={personalDetails.panFileUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">View PAN</a>
            ) : "Not Uploaded"}
          </p>
        </div>
      </div>

      {/* JOB DETAILS */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-bold text-xl mb-4 text-blue-700 border-b pb-2">Job Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Department:</strong> {currentDepartment || 'N/A'}</p>
          <p><strong>Role:</strong> {currentRole || 'N/A'}</p>
          <p><strong>Date of Joining:</strong> {joiningDate?.split("T")[0] || 'N/A'}</p>
          <p><strong>Current Salary:</strong> {currentSalary ? `₹${currentSalary}` : 'N/A'}</p>
        </div>
      </div>

      {/* BANK DETAILS */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-bold text-xl mb-4 text-blue-700 border-b pb-2">Bank Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <p><strong>Bank Name:</strong> {bankDetails.bankName || 'N/A'}</p>
          <p><strong>Account Number:</strong> {bankDetails.accountNumber || 'N/A'}</p>
          <p><strong>IFSC Code:</strong> {bankDetails.ifsc || 'N/A'}</p>
          <p><strong>Branch:</strong> {bankDetails.branch || 'N/A'}</p>
        </div>
      </div>

      {/* EXPERIENCE DETAILS */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h3 className="font-bold text-xl mb-4 text-blue-700 border-b pb-2">Experience Details</h3>
        {experienceDetails.length > 0 ? experienceDetails.map((exp, index) => (
          <div key={index} className="mb-4 border-b pb-4 last:border-b-0 last:pb-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <p><strong>Company:</strong> {exp.company || 'N/A'}</p>
                <p><strong>Role:</strong> {exp.role || 'N/A'}</p>
                <p><strong>Department:</strong> {exp.department || 'N/A'}</p>
                <p><strong>Years:</strong> {exp.years || 'N/A'}</p>
                <p><strong>Joining:</strong> {exp.joiningDate?.split("T")[0] || 'N/A'}</p>
                <p><strong>Last Working:</strong> {exp.lastWorkingDate === "Present" ? "Present" : exp.lastWorkingDate?.split("T")[0] || 'N/A'}</p>
                <p><strong>Salary:</strong> {exp.salary ? `₹${exp.salary}` : 'N/A'}</p>
                <p><strong>Reason for Leaving:</strong> {exp.reason || "N/A"}</p>
                <p className="md:col-span-2">
                    <strong>Experience Letter:</strong>{" "}
                    {exp.experienceLetterUrl ? (
                    <a href={exp.experienceLetterUrl} className="text-blue-600 underline" target="_blank" rel="noopener noreferrer">View Letter</a>
                    ) : "Not Uploaded"}
                </p>
            </div>
          </div>
        )) : <p className="text-gray-500">No experience details available.</p>}
      </div>
    </div>
  );
};

export default CurrentEmployeeProfile;