import { useState, useEffect } from "react";
import { CurrentEmployeeContext } from "./CurrentEmployeeContext";
import { baseURL } from "../api";

export const CurrentEmployeeProvider = ({ children }) => {
  const employeeId = sessionStorage.getItem("employeeId");

  const [currentEmployee, setCurrentEmployee] = useState({
    personal: {},
  });

  const [employeeStats, setEmployeeStats] = useState({});
  const [job, setJob] = useState({});
  const [bank, setBank] = useState({});
  const [experienceStats, setExperienceStats] = useState([]);

  const idle_time = 1.25;

  // ✅ Fetch real employee data
  useEffect(() => {
    if (!employeeId) return;

    const fetchEmployee = async () => {
      try {
        const res = await fetch(`${baseURL}/api/employees/${employeeId}`);
        if (!res.ok) throw new Error("Failed to fetch employee");

        const data = await res.json();

        // ✅ Split emergency “Name - Phone”
        let emergencyName = "";
        let emergencyPhone = "";
        if (data.emergency?.includes("-")) {
          const parts = data.emergency.split("-");
          emergencyName = parts[0].trim();
          emergencyPhone = parts[1].trim();
        }

        // ✅ Set Personal Data
        setCurrentEmployee({
          personal: {
            name: data.name,
            fatherName: "", // backend does not have this
            dob: data.personalDetails?.dob?.split("T")[0] || "",
            gender: data.personalDetails?.gender || "",
            marital_status: data.personalDetails?.maritalStatus || "",
            nationality: data.personalDetails?.nationality || "",
            aadhaar_number: data.personalDetails?.aadharNumber || "",
            pan_number: data.personalDetails?.panNumber || "",
            profile_photo: null, // optional
            aadhaar: data.personalDetails?.aadharFileUrl || null,
            pan: data.personalDetails?.panFileUrl || null,
            resume: null,
            employeeId: data.employeeId,
          },
        });

        // ✅ Set Contact Details
        setEmployeeStats({
          email: data.email,
          phone: data.phone,
          address: data.address,
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
          emergency_contact_relation: "", // backend does not have
        });

        // ✅ Set Job Details
        setJob({
          dept_id: "1",
          department: data.currentDepartment,
          designation: data.currentRole,
          doj: data.joiningDate?.split("T")[0] || "",
        });

        // ✅ Set Bank Details
        setBank({
          account_number: data.bankDetails?.accountNumber || "",
          bank_name: data.bankDetails?.bankName || "",
          ifsc_code: data.bankDetails?.ifsc || "",
          branch: data.bankDetails?.branch || "",
        });

        // ✅ Set Experience Details (array)
        setExperienceStats(
          data.experienceDetails?.map((exp) => ({
            company: exp.company,
            role: exp.role,
            years: exp.years,
            joining_date: exp.joiningDate?.split("T")[0] || "",
            last_working_date:
              exp.lastWorkingDate === "Present"
                ? "Present"
                : exp.lastWorkingDate?.split("T")[0],
            salary: exp.salary,
            reason: exp.reason,
            experience_letter: exp.experienceLetterUrl
              ? { url: exp.experienceLetterUrl, name: "Experience Letter" }
              : null,
          })) || []
        );
      } catch (err) {
        console.log("Error fetching employee", err);
      }
    };

    fetchEmployee();
  }, [employeeId]);

  // ✅ edit functions (unchanged)
  const editCurrentEmployee = (updatedData) => {
    setCurrentEmployee((prev) => ({
      ...prev,
      personal: { ...prev.personal, ...(updatedData.personal || {}) },
    }));
  };

  const editEmployeeStats = (updatedStats) => {
    setEmployeeStats((prev) => ({
      ...prev,
      ...updatedStats,
    }));
  };

  const editJob = (updatedJob) => {
    setJob((prev) => ({
      ...prev,
      ...updatedJob,
    }));
  };

  const editBank = (updatedBank) => {
    setBank((prev) => ({
      ...prev,
      ...updatedBank,
    }));
  };

  const editExperience = (updatedExperience) => {
    setExperienceStats((prev) => ({
      ...prev,
      ...updatedExperience,
    }));
  };

  return (
    <CurrentEmployeeContext.Provider
      value={{
        currentEmployee,
        editCurrentEmployee,
        idle_time,
        employeeStats,
        setEmployeeStats,
        editEmployeeStats,
        job,
        setJob,
        editJob,
        bank,
        setBank,
        editBank,
        experienceStats,
        setExperienceStats,
        editExperience,
      }}
    >
      {children}
    </CurrentEmployeeContext.Provider>
  );
};
