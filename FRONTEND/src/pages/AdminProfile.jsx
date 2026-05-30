import React, { useState, useEffect } from "react";
import ModalWrapper from "../components/ModalWrapper";
import { useLocation } from "react-router-dom";
import api, { getAllCompanies } from "../api";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  FaUser, FaEnvelope, FaPhone, FaBuilding,
  FaCrown, FaCalendarAlt, FaCheckCircle, FaTimesCircle,
  FaClock, FaCreditCard, FaEdit, FaSave, FaTimes,
  FaMapMarkerAlt, FaGlobeAsia, FaFingerprint, FaLayerGroup,
  FaDotCircle, FaWifi, FaCity, FaFlag, FaHashtag, FaChevronDown,
  FaEye, FaEyeSlash, FaUsers, FaTrash, FaDownload, FaFilePdf
} from "react-icons/fa";
import { MdRadar, MdLocationOn } from "react-icons/md";

/* ─────────────────────────────────────────────────────────────────
   Helper: dynamically load Razorpay checkout script
   Returns a promise that resolves to true when ready.
───────────────────────────────────────────────────────────────── */
const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const AdminProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [upgradeLoadingFree, setUpgradeLoadingFree] = useState(false);

  // Create Admin Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createAdminLoading, setCreateAdminLoading] = useState(false);
  const [newAdminForm, setNewAdminForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const featureLabels = {
    "/admin/dashboard": "Dashboard",
    "/employees": "Employee Management",
    "/attendance": "Employees Attendance",
    "/admin/settings": "Shift Management",
    "/admin/shifttype": "Location Settings",
    "/admin/leave-summary": "Leave Summary",
    "/admin/holiday-calendar": "Holiday Calendar",
    "/admin/payroll": "Payroll",
    "/admin/notices": "Announcements",
    "/admin/admin-Leavemanage": "Leave Requests",
    "/admin/late-requests": "Attendance Adjustment",
    "/admin/admin-overtime": "Overtime Requests",
    "/admin/live-tracking": "Employee Idle Tracking",
    "/admin/induction": "Induction",
  };

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    department: ""
  });

  // Plans State
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);

  // Companies State
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [upgradingPlanId, setUpgradingPlanId] = useState(null);

  // Support Admins State
  const [isSupportAdminsModalOpen, setIsSupportAdminsModalOpen] = useState(false);
  const [supportAdmins, setSupportAdmins] = useState([]);
  const [loadingSupportAdmins, setLoadingSupportAdmins] = useState(false);

  // Billing History State
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingHistory, setBillingHistory] = useState([]);
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false);

  const fetchBillingHistory = async () => {
    setLoadingBillingHistory(true);
    try {
      const res = await api.get("/api/razorpay/billing-history");
      setBillingHistory(res.data || []);
    } catch (err) {
      console.error("Error fetching billing history:", err);
    } finally {
      setLoadingBillingHistory(false);
    }
  };

  const downloadReceiptPdf = (bill) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor = [79, 70, 229];
    const darkColor = [31, 41, 55];
    const greyColor = [107, 114, 128];
    const lightGreyColor = [243, 244, 246];
    const successColor = [16, 185, 129];

    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("ARAH INFO TECH V-SYNC", 20, 18);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Workforce Management Platform", 20, 24);

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PAYMENT RECEIPT", 140, 22);

    doc.setTextColor(...darkColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Receipt Details:", 20, 55);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...greyColor);
    doc.text(`Receipt Date: ${new Date(bill.date).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 20, 62);
    doc.text(`Payment ID: ${bill.paymentId}`, 20, 68);
    doc.text(`Order ID: ${bill.orderId || "N/A"}`, 20, 74);

    doc.setTextColor(...darkColor);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Billed To:", 130, 55);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...greyColor);
    doc.text(`Admin Name: ${profile?.name || "N/A"}`, 130, 62);
    doc.text(`Email: ${profile?.email || "N/A"}`, 130, 68);
    doc.text(`Phone: ${profile?.phone || "N/A"}`, 130, 74);

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(20, 82, 190, 82);

    const headers = [["Billing Item", "Details", "Quantity", "Amount Paid"]];
    const unitPrice = bill.employeeCount ? (bill.amount / bill.employeeCount).toFixed(2) : bill.amount.toFixed(2);
    const tableData = [
      ["Plan Subscription", `${bill.plan} (${bill.billingCycle})`, "1", ""],
      ["Per-Person User Seats", `INR ${unitPrice} per employee`, `${bill.employeeCount} seats`, `INR ${bill.amount.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 90,
      head: headers,
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 55 },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 30, halign: "right" },
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
      },
      margin: { left: 20, right: 20 },
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFillColor(...lightGreyColor);
    doc.rect(120, finalY, 70, 30, "F");

    doc.setTextColor(...darkColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Total Paid:", 125, finalY + 10);
    doc.setFontSize(14);
    doc.setTextColor(...primaryColor);
    doc.text(`INR ${bill.amount.toFixed(2)}`, 148, finalY + 10);

    doc.setFontSize(8);
    doc.setTextColor(...greyColor);
    doc.setFont("helvetica", "normal");
    doc.text(`Payment Method: ${bill.method.toUpperCase()}`, 125, finalY + 20);
    doc.text("Status: Captured/Paid", 125, finalY + 25);

    doc.setDrawColor(...successColor);
    doc.setLineWidth(1);
    doc.setFillColor(255, 255, 255);
    doc.rect(20, finalY, 40, 15);
    doc.setTextColor(...successColor);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("PAID", 32, finalY + 10);

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.5);
    doc.line(20, 260, 190, 260);

    doc.setFontSize(8);
    doc.setTextColor(...greyColor);
    doc.setFont("helvetica", "normal");
    doc.text("This is a computer-generated transaction receipt and does not require a physical signature.", 20, 266);
    doc.text("For any support queries, please reach out to our team at ops@arahinfotech.com.", 20, 272);

    doc.save(`receipt-${bill.paymentId}.pdf`);
  };

  const downloadAllBillingHistoryPdf = () => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });

    const primaryColor = [79, 70, 229];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("ARAH INFO TECH V-SYNC — BILLING HISTORY REPORT", 20, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(107, 114, 128);
    doc.text(`Generated On: ${new Date().toLocaleDateString("en-IN")}`, 20, 26);
    doc.text(`Account Email: ${profile?.email || "N/A"}`, 20, 32);

    const headers = [["Date", "Transaction ID", "Plan", "Cycle", "Seats Billed", "Amount Paid", "Method", "Status"]];
    const tableData = billingHistory.map((bill) => [
      new Date(bill.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      bill.paymentId,
      bill.plan,
      bill.billingCycle,
      bill.employeeCount.toString(),
      `INR ${bill.amount.toFixed(2)}`,
      bill.method,
      "Paid"
    ]);

    autoTable(doc, {
      startY: 40,
      head: headers,
      body: tableData,
      theme: "striped",
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
      },
      margin: { left: 20, right: 20 },
    });

    doc.save("billing-history-report.pdf");
  };

  // Pay Bill State
  const [isPayBillModalOpen, setIsPayBillModalOpen] = useState(false);
  const [nextBillInfo, setNextBillInfo] = useState(null);
  const [loadingBillInfo, setLoadingBillInfo] = useState(false);
  const [isPayingBill, setIsPayingBill] = useState(false);

  const fetchNextBillInfo = async () => {
    setLoadingBillInfo(true);
    try {
      const res = await api.get("/api/razorpay/next-bill");
      setNextBillInfo(res.data);
    } catch (err) {
      console.error("Error fetching next bill info:", err);
    } finally {
      setLoadingBillInfo(false);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get("/api/admin/profile");
      setProfile(res.data);
      // Initialize form data with fetched values
      setFormData({
        name: res.data.name || "",
        phone: res.data.phone || "",
        department: res.data.department || ""
      });
    } catch (err) {
      console.error("Error fetching profile", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await api.get("/api/admin/all-plans");
      setPlans(response.data.filter(p => p.planName?.toLowerCase() !== "owner"));
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await getAllCompanies();
      const list = Array.isArray(res) ? res : res.data || [];
      setCompanies(list);
      if (list.length > 0) setSelectedCompanyId(list[0]._id);
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setCompaniesLoading(false);
    }
  };

  const fetchSupportAdmins = async () => {
    setLoadingSupportAdmins(true);
    try {
      const res = await api.get("/api/admin/support-admins");
      setSupportAdmins(res.data || []);
    } catch (err) {
      console.error("Error fetching support admins:", err);
    } finally {
      setLoadingSupportAdmins(false);
    }
  };

  const handleDeleteSupportAdmin = async (id) => {
    if (!window.confirm("Are you sure you want to delete this support admin?")) return;
    try {
      await api.delete(`/api/admin/support-admins/${id}`);
      setSupportAdmins(supportAdmins.filter(a => a._id !== id));
      alert("Support Admin deleted successfully.");
    } catch (err) {
      console.error("Error deleting support admin:", err);
      alert("Failed to delete support admin.");
    }
  };

  useEffect(() => {
    if (isSupportAdminsModalOpen) {
      fetchSupportAdmins();
    }
  }, [isSupportAdminsModalOpen]);

  useEffect(() => {
    if (isBillingModalOpen) {
      fetchBillingHistory();
    }
  }, [isBillingModalOpen]);

  useEffect(() => {
    if (isPayBillModalOpen) {
      fetchNextBillInfo();
    }
  }, [isPayBillModalOpen]);

  useEffect(() => {
    fetchProfile();
    fetchPlans();
    fetchCompanies();

    const handleFocus = () => setUpgradingPlanId((prev) => prev !== null ? null : prev);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setUpdateLoading(true);
    try {
      await api.put("/api/admin/profile/update", formData);
      await fetchProfile(); // Refresh data
      setIsEditing(false);
      alert("Profile updated successfully!");
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleCreateSupportAdmin = async (e) => {
    e.preventDefault();
    if (newAdminForm.password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }
    if (newAdminForm.password !== newAdminForm.confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    setCreateAdminLoading(true);
    try {
      const payload = {
        name: newAdminForm.name,
        email: newAdminForm.email,
        password: newAdminForm.password,
        phone: profile?.phone || "",
        department: profile?.department || "Support Administration",
        adminId: profile?.adminId || profile?._id // Link to root admin
      };
      await api.post("/api/admin/support-admins", payload);
      alert("Support Admin created successfully!");
      setIsCreateModalOpen(false);
      setNewAdminForm({ name: "", email: "", password: "", confirmPassword: "" });
      fetchSupportAdmins(); // Refresh support admins list
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create support admin");
    } finally {
      setCreateAdminLoading(false);
    }
  };

  const handlePayBillSubmit = async () => {
    if (!nextBillInfo || !nextBillInfo.planInfo) {
      alert("Billing details not loaded yet.");
      return;
    }

    setIsPayingBill(true);

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        alert("Failed to load payment gateway. Please check your connection.");
        setIsPayingBill(false);
        return;
      }

      // 1. Create Razorpay order on backend for renewal
      const res = await api.post("/api/razorpay/create-order", {
        plan: nextBillInfo.planInfo,
        signupForm: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          department: profile.department,
          role: profile.role
        },
        isUpgrade: false
      });

      const orderData = res.data;

      // 2. Open Razorpay checkout popup
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        name: "HRMS vwsync",
        description: `Renewal Payment for ${nextBillInfo.planName}`,
        order_id: orderData.orderId,
        prefill: {
          name: profile.name,
          email: profile.email,
          contact: profile.phone,
        },
        theme: { color: "#4f46e5" }, // matches indigo theme

        // 3. On payment success — verify on backend
        handler: async (paymentResponse) => {
          try {
            await api.post("/api/razorpay/verify-payment", {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              plan: nextBillInfo.planInfo,
              isUpgrade: false
            });

            alert("Renewal payment successful! Subscription extended.");
            setIsPayBillModalOpen(false);
            await fetchProfile(); // Refresh profile to show new plan dates
          } catch (verifyErr) {
            alert(
              verifyErr.response?.data?.message ||
              "Payment received but verification failed. Please contact support."
            );
          } finally {
            setIsPayingBill(false);
          }
        },

        modal: {
          ondismiss: () => {
            setIsPayingBill(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response.error);
        alert(response.error?.description || "Payment failed. Please try again.");
        setIsPayingBill(false);
      });

      rzp.open();

    } catch (err) {
      alert(err.response?.data?.message || "Payment initiation failed. Please try again.");
      setIsPayingBill(false);
    }
  };

  /* ─────────────────────────────────────────────────────────────────
     RAZORPAY UPGRADE FLOW
  ───────────────────────────────────────────────────────────────── */
  const handleUpgrade = async (plan) => {
    if (plan.planName === profile?.plan) {
      alert("You are already on this plan!");
      return;
    }

    if (Number(plan.price) === 0) {
      alert("Please contact support to switch to a free plan.");
      return;
    }

    setUpgradingPlanId(plan._id);

    try {
      const sdkReady = await loadRazorpayScript();
      if (!sdkReady) {
        alert("Failed to load payment gateway. Please check your connection.");
        setUpgradingPlanId(null);
        return;
      }

      // 1. Create Razorpay order on backend
      const res = await api.post("/api/razorpay/create-order", {
        plan: plan,
        signupForm: {
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          department: profile.department,
          role: profile.role
        },
        isUpgrade: true
      });

      const orderData = res.data; // { orderId, amount, currency, keyId }

      // 2. Open Razorpay checkout popup
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency,
        name: "HRMS vwsync",
        description: `Upgrade to ${plan.planName} Plan`,
        order_id: orderData.orderId,
        prefill: {
          name: profile.name,
          email: profile.email,
          contact: profile.phone,
        },
        theme: { color: "#9333ea" }, // Matches the purple-600 theme of this page

        // 3. On payment success — verify on backend
        handler: async (paymentResponse) => {
          try {
            await api.post("/api/razorpay/verify-payment", {
              razorpay_order_id: paymentResponse.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature,
              plan: plan,
              isUpgrade: true
            });

            alert("Plan upgraded successfully!");
            await fetchProfile(); // Refresh data to show new plan & dates
          } catch (verifyErr) {
            alert(
              verifyErr.response?.data?.message ||
              "Payment received but verification failed. Please contact support."
            );
          } finally {
            setUpgradingPlanId(null);
          }
        },

        modal: {
          // User closed the popup without paying
          ondismiss: () => {
            setUpgradingPlanId(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response.error);
        alert(response.error?.description || "Payment failed. Please try again.");
        setUpgradingPlanId(null);
      });

      rzp.open();

    } catch (err) {
      alert(err.response?.data?.message || "Upgrade failed. Please try again.");
      setUpgradingPlanId(null);
    }
  };

  const handleFreeUpgrade = async () => {
    if (!window.confirm("Are you sure you want to upgrade your plan to Owner for free?")) {
      return;
    }
    setUpgradeLoadingFree(true);
    try {
      const res = await api.post("/api/admin/free-upgrade-to-owner");
      alert(res.data.message || "Upgraded successfully!");
      await fetchProfile(); // Refresh profile to reflect the changes
    } catch (err) {
      alert(err.response?.data?.message || "Failed to upgrade plan");
    } finally {
      setUpgradeLoadingFree(false);
    }
  };

  const location = useLocation();

  useEffect(() => {
    if (!loading && !plansLoading && location.hash === "#plans") {
      setTimeout(() => {
        const element = document.getElementById("plans");
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, [loading, plansLoading, location.hash]);

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit", month: "long", year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const planExpiry = profile?.planExpiresAt ? new Date(profile.planExpiresAt) : null;
  const isFreePlan = profile?.plan ? profile.plan.toLowerCase().includes("free") : true;
  const isBillPayable = !isFreePlan && planExpiry ? new Date() >= planExpiry : false;

  const isGracePeriod = !isFreePlan && planExpiry && new Date() > planExpiry && new Date() <= new Date(planExpiry.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeftInGrace = planExpiry ? Math.ceil((new Date(planExpiry.getTime() + 7 * 24 * 60 * 60 * 1000) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {isGracePeriod && (
          <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl shadow-sm flex items-center justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="text-amber-800 text-sm font-black uppercase tracking-wider">Subscription Payment Overdue</p>
                <p className="text-amber-700 text-xs font-semibold mt-0.5">
                  Your billing date was <strong>{formatDate(profile.planExpiresAt)}</strong>. Please pay your bill within <strong>{daysLeftInGrace} days</strong> to prevent account suspension.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPayBillModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase px-4 py-2 rounded-xl tracking-wider transition-all shadow-md shrink-0 animate-bounce"
            >
              Pay Bill Now
            </button>
          </div>
        )}

        {/* <div className="flex justify-end">
          <button
            onClick={() => setIsSupportAdminsModalOpen(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
          >
            <FaUsers size={14} /> Support Admins
          </button>
        </div> */}

        {/* HEADER SECTION */}
        <div className="bg-white  p-8 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden">
          <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-4xl font-bold shadow-lg shrink-0">
            {profile?.name?.charAt(0)}
          </div>
          <div className="text-center md:text-left flex-1">
            {isEditing ? (
              <input
                className="text-xl font-bold text-gray-900 border-b-2 border-purple-200 outline-none focus:border-purple-600 bg-transparent w-full md:w-auto"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            ) : (
              <h1 className="text-xl font-bold text-gray-900">{profile?.name}</h1>
            )}
            <p className="text-gray-500 font-medium uppercase tracking-widest text-[10px] mt-1">
              {profile?.role}
              {/* • {profile?.department} */}
            </p>
          </div>

          <div className="flex gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsBillingModalOpen(true)}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
                >
                  <FaCreditCard size={14} /> Billing History
                </button>
                <button
                  onClick={() => setIsPayBillModalOpen(true)}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 cursor-pointer"
                  title="Pay Subscription Bill"
                >
                  <FaCreditCard size={14} /> Pay bill
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                >
                  <FaEdit size={14} /> Edit Profile
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleUpdate}
                  disabled={updateLoading}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                >
                  <FaSave size={14} /> {updateLoading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-2 bg-gray-100 text-gray-600 px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                >
                  <FaTimes size={14} /> Cancel
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* BASIC INFORMATION CARD */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-[0.5rem] p-6 shadow-sm border border-gray-100">
              <h3 className="text-gray-900 font-bold mb-6 flex items-center gap-2">
                <FaUser className="text-purple-500 text-sm" /> Basic Information
              </h3>

              <div className="space-y-6">
                <InfoItem icon={<FaEnvelope />} label="Email Address (Locked)" value={profile?.email} />

                {/* Editable Phone */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaPhone />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Phone Number</p>
                    {isEditing ? (
                      <input
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-900 font-bold">{profile?.phone || "Not Provided"}</p>
                    )}
                  </div>
                </div>

                {/* Editable Department */}
                <div className="flex items-center gap-4 group">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
                    <FaBuilding />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Department</p>
                    {isEditing ? (
                      <input
                        className="w-full font-bold text-gray-900 border-b border-purple-200 focus:border-purple-600 outline-none py-1"
                        value={formData.department}
                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      />
                    ) : (
                      <p className="text-gray-900 font-bold">{profile?.department}</p>
                    )}
                  </div>
                </div>

                <InfoItem icon={<FaClock />} label="Member Since" value={formatDate(profile?.createdAt)} />
              </div>
            </div>
          </div>

          {/* SUBSCRIPTION DETAILS */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-[0.5rem] p-8 shadow-sm border border-gray-100 relative overflow-hidden h-full">
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <FaCrown size={120} />
              </div>

              <h3 className="text-gray-900 font-bold mb-8 flex items-center gap-2">
                <FaCreditCard className="text-purple-500 text-sm" /> Subscription Overview
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Current Plan</p>
                  <h4 className="text-2xl font-black text-purple-600 capitalize">{profile?.plan}</h4>
                  <div className="mt-4 flex items-center gap-2 text-sm font-bold">
                    {profile?.isPaid ? (
                      <><FaCheckCircle className="text-emerald-500" /> <span className="text-emerald-600 uppercase">Active</span></>
                    ) : (
                      <><FaTimesCircle className="text-amber-500" /> <span className="text-amber-600 uppercase">Trial / Unpaid</span></>
                    )}
                  </div>

                </div>

                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Account Status</p>
                  <h4 className={`text-2xl font-black ${profile?.loginEnabled ? "text-emerald-600" : "text-red-600"}`}>
                    {profile?.loginEnabled ? "Fully Accessible" : "Access Blocked"}
                  </h4>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-dashed border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Activated On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planActivatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-red-50 p-3 rounded-2xl text-red-600"><FaCalendarAlt /></div>
                  <div>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Expires On</p>
                    <p className="text-gray-900 font-bold">{formatDate(profile?.planExpiresAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COMPANY SELECTOR SECTION */}
        <div className="bg-white rounded-[0.5rem] p-5 shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h3 className="text-gray-900 font-bold flex items-center gap-2">
              <FaBuilding className="text-purple-500 text-sm" /> Company Details
            </h3>
            {companiesLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600" />
            ) : companies.length === 0 ? (
              <span className="text-sm text-gray-400 italic">No companies added yet</span>
            ) : (
              <div className="relative w-full sm:w-64">
                <select
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 font-semibold text-sm px-4 py-2.5 pr-9 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 transition-all cursor-pointer"
                >
                  {companies.map((c) => (
                    <option key={c._id} value={c._id}>{c.name} ({c.prefix})</option>
                  ))}
                </select>
                <FaChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-[10px]" />
              </div>
            )}
          </div>

          {(() => {
            const co = companies.find(c => c._id === selectedCompanyId);
            if (!co) return (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <FaBuilding size={36} className="mb-3 opacity-25" />
                <p className="font-semibold">No company selected</p>
                <p className="text-xs mt-1">Add a company from Employee Management</p>
              </div>
            );
            const Row = ({ label, value }) => (
              <div className="flex items-start py-2 border-b border-gray-200 last:border-0">
                <span className="w-32 shrink-0 text-[10px] font-black text-gray-500 uppercase tracking-widest pt-0.5 leading-none">{label}</span>
                <span className="text-gray-900 font-bold flex-1 text-[13px] leading-snug">{value || <span className="text-gray-400 font-normal italic">Not set</span>}</span>
              </div>
            );
            return (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.18em] mb-1 pl-2 border-l-2 border-purple-400">Identity</p>
                    <Row label="Name" value={co.name} />
                    <Row label="Prefix" value={co.prefix} />
                    <Row label="Employees" value={co.employeeCount?.toString() || "0"} />
                    <Row label="Created" value={co.createdAt ? new Date(co.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : null} />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.18em] mb-1 pl-2 border-l-2 border-purple-400">Contact</p>
                    <Row label="Email" value={co.email} />
                    <Row label="Phone" value={co.phone} />
                    <Row label="Website" value={co.website} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.18em] mb-1 pl-2 border-l-2 border-purple-400">Location</p>
                    <Row label="Address" value={co.officeLocation?.address} />
                    <Row label="City" value={co.officeLocation?.city} />
                    <Row label="State" value={co.officeLocation?.state} />
                    <Row label="Zip Code" value={co.officeLocation?.zipCode} />
                    <Row label="Country" value={co.officeLocation?.country} />
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.18em] mb-1 pl-2 border-l-2 border-purple-400">Registration</p>
                    <Row label="Registration / GST" value={co.registrationNumber} />
                    <Row label="Description" value={co.description} />
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* PLANS SECTION — last */}
        {!isBillPayable && (
          <div className="bg-rose-50 border-l-4 border-rose-500 p-4 rounded-xl shadow-sm flex items-center gap-3 mb-4">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-rose-800 text-sm font-black uppercase tracking-wider">Available Plans &amp; Upgrade Locked</p>
              <p className="text-rose-700 text-xs font-semibold mt-0.5">
                Upgrading or switching plans is only permitted <strong>on or after your next billing date: {formatDate(profile?.planExpiresAt)}</strong>. If you require immediate plan changes, please contact support at <a href="mailto:ops@arahinfotech.com" className="text-rose-800 underline font-bold">ops@arahinfotech.com</a>.
              </p>
            </div>
          </div>
        )}

        <div id="plans" className={`bg-white rounded-[0.5rem] p-8 shadow-sm border border-gray-100 transition-all ${!isBillPayable ? "opacity-75" : ""}`}>
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-gray-900 font-bold flex items-center gap-2">
              <FaCrown className="text-purple-500 text-sm" /> Available Plans &amp; Upgrade
            </h3>
            {plansLoading && <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-600"></div>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isCurrentPlan = plan.planName === profile?.plan;
              return (
                <div
                  key={plan._id}
                  className={`relative p-6 rounded-xl border-2 transition-all flex flex-col ${isCurrentPlan ? "border-purple-500 bg-purple-50/50" : "border-gray-100 bg-gray-50 hover:border-purple-200"}`}
                >
                  {isCurrentPlan && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg">
                      Current Plan
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-gray-900 capitalize">{plan.planName}</h4>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">{plan.durationDays} Days</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-purple-600">{Number(plan.price) === 0 ? "Free" : `₹${plan.price}`}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 mb-6 flex-grow">
                    <li className="flex items-center gap-2 text-xs text-gray-600">
                      <FaCheckCircle className="text-emerald-500 shrink-0" size={12} />
                      <span>{plan.maxUsers === null ? "Unlimited Users" : `${plan.maxUsers} Users`}</span>
                    </li>
                    {plan.features?.slice(0, 3).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-gray-600">
                        <FaCheckCircle className="text-emerald-500 shrink-0" size={12} />
                        <span className="truncate">{featureLabels[feature] || feature.split('/').pop().replace(/-/g, ' ')}</span>
                      </li>
                    ))}
                    {plan.features?.length > 3 && (
                      <li className="text-[10px] text-gray-400 italic ml-5">+{plan.features.length - 3} more features</li>
                    )}
                  </ul>
                  <button
                    onClick={() => handleUpgrade(plan)}
                    disabled={isCurrentPlan || upgradingPlanId === plan._id || (upgradingPlanId !== null && upgradingPlanId !== plan._id) || Number(plan.price) === 0 || !isBillPayable}
                    className={`w-full py-3 rounded-2xl font-bold text-sm transition-all ${isCurrentPlan ? "bg-emerald-100 text-emerald-600 cursor-default" : Number(plan.price) === 0 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : !isBillPayable ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none" : "bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-100"}`}
                  >
                    {isCurrentPlan ? "Active Now" : upgradingPlanId === plan._id ? "Processing..." : Number(plan.price) === 0 ? "Default Plan" : !isBillPayable ? "Upgrade Locked" : "Upgrade Plan"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <ModalWrapper isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} containerClass="bg-white rounded-[0.5rem] w-full max-w-md p-8 shadow-2xl relative flex flex-col">
        <button
          onClick={() => setIsCreateModalOpen(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <FaTimes size={20} />
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <FaUser className="text-purple-600" /> Create New Support Admin
        </h2>
        <form onSubmit={handleCreateSupportAdmin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Full Name</label>
            <input
              type="text"
              required
              value={newAdminForm.name}
              onChange={(e) => setNewAdminForm({ ...newAdminForm, name: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-purple-600 transition-colors"
              placeholder="John Doe"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Username (Email)</label>
            <input
              type="email"
              required
              value={newAdminForm.email}
              onChange={(e) => setNewAdminForm({ ...newAdminForm, email: e.target.value })}
              className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-purple-600 transition-colors"
              placeholder="john@example.com"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={newAdminForm.password}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-purple-600 transition-colors"
                placeholder="Min. 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Confirm Password</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                required
                minLength={8}
                value={newAdminForm.confirmPassword}
                onChange={(e) => setNewAdminForm({ ...newAdminForm, confirmPassword: e.target.value })}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm font-bold rounded-xl px-4 py-3 focus:outline-none focus:border-purple-600 transition-colors"
                placeholder="Confirm Password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={createAdminLoading}
              className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-70 flex justify-center"
            >
              {createAdminLoading ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div> : "Create Support Admin"}
            </button>
          </div>
        </form>
      </ModalWrapper>

      <ModalWrapper isOpen={isSupportAdminsModalOpen} onClose={() => setIsSupportAdminsModalOpen(false)} containerClass="bg-white w-full max-w-xl rounded-[0.5rem] shadow-2xl p-8 relative flex flex-col max-h-[90vh]">
        <button
          onClick={() => setIsSupportAdminsModalOpen(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
        >
          <FaTimes size={16} />
        </button>
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-gray-900">Manage Support Admins</h3>
            <p className="text-gray-500 font-medium text-sm mt-1">View and manage support admins created under your account.</p>
          </div>
          <button
            onClick={() => {
              setIsSupportAdminsModalOpen(false);
              setIsCreateModalOpen(true);
            }}
            className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
          >
            <FaUser size={14} /> Create Support Admin
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {loadingSupportAdmins ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : supportAdmins.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
              <FaUsers size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500 font-semibold">No support admins found</p>
              <p className="text-sm text-gray-400 mt-1">You haven't created any support admins yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {supportAdmins.map((supportAdmin) => (
                <div key={supportAdmin._id} className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shrink-0">
                      {supportAdmin.name?.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900">{supportAdmin.name}</h4>
                      <p className="text-sm font-medium text-gray-500 flex items-center gap-2">
                        <FaEnvelope className="text-gray-400" size={10} /> {supportAdmin.email}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSupportAdmin(supportAdmin._id)}
                    className="p-3 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors"
                    title="Delete Support Admin"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </ModalWrapper>

      <ModalWrapper isOpen={isBillingModalOpen} onClose={() => setIsBillingModalOpen(false)} containerClass="bg-white w-full max-w-4xl rounded-[0.5rem] shadow-2xl p-8 relative flex flex-col max-h-[90vh]">
        <button
          onClick={() => setIsBillingModalOpen(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
        >
          <FaTimes size={16} />
        </button>
        
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
              <FaCreditCard className="text-indigo-600" /> Billing & Payment History
            </h3>
            <p className="text-gray-500 font-medium text-sm mt-1">View all your past invoices and successful subscription payments.</p>
          </div>
          {billingHistory.length > 0 && (
            <button
              onClick={downloadAllBillingHistoryPdf}
              className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 cursor-pointer shrink-0"
            >
              <FaFilePdf size={14} /> Export History (PDF)
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {loadingBillingHistory ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : billingHistory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-100">
              <FaCreditCard size={48} className="mx-auto text-gray-300 mb-4 animate-bounce" />
              <p className="text-gray-500 font-semibold">No payment history found</p>
              <p className="text-sm text-gray-400 mt-1">You haven't made any subscription payments yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50">
                    <th className="py-4 px-4">Date</th>
                    <th className="py-4 px-4">Plan Details</th>
                    <th className="py-4 px-4">Billing Cycle</th>
                    <th className="py-4 px-4 text-center">Seats Billed</th>
                    <th className="py-4 px-4">Amount Paid</th>
                    <th className="py-4 px-4">Payment Method</th>
                    <th className="py-4 px-4">Transaction ID</th>
                    <th className="py-4 px-4">Status</th>
                    <th className="py-4 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {billingHistory.map((bill, idx) => (
                    <tr key={bill.paymentId || idx} className="hover:bg-gray-50/50 transition-colors text-sm font-bold text-gray-800">
                      <td className="py-4 px-4 whitespace-nowrap font-medium text-gray-500">
                        {new Date(bill.date).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-4 px-4 capitalize font-bold text-gray-900">{bill.plan}</td>
                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-wider bg-indigo-50 text-indigo-600 border border-indigo-100">
                          {bill.billingCycle}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center font-black text-gray-900">{bill.employeeCount}</td>
                      <td className="py-4 px-4 font-black text-slate-900 text-base">₹{bill.amount}</td>
                      <td className="py-4 px-4 font-semibold text-gray-500 capitalize">{bill.method}</td>
                      <td className="py-4 px-4 font-mono text-[11px] text-gray-400 select-all">{bill.paymentId}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Paid
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => downloadReceiptPdf(bill)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 text-purple-600 border border-purple-100 hover:bg-purple-100 transition-colors cursor-pointer"
                          title="Download PDF Receipt"
                        >
                          <FaDownload size={10} />
                          Receipt
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </ModalWrapper>

      <ModalWrapper isOpen={isPayBillModalOpen} onClose={() => setIsPayBillModalOpen(false)} containerClass="bg-white w-full max-w-md rounded-[0.5rem] shadow-2xl p-8 relative flex flex-col">
        <button
          onClick={() => setIsPayBillModalOpen(false)}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 p-2 rounded-full transition-colors"
        >
          <FaTimes size={16} />
        </button>

        <div className="mb-6">
          <h3 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <FaCreditCard className="text-emerald-600 animate-pulse" /> Pay Subscription Bill
          </h3>
          <p className="text-gray-500 font-medium text-sm mt-1">Renew your current subscription plan to keep your account active.</p>
        </div>

        {loadingBillInfo ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Calculating bill details...</p>
          </div>
        ) : !nextBillInfo ? (
          <div className="text-center py-8 text-red-500 font-bold">
            Failed to load billing details. Please try again.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Plan</span>
                <span className="text-sm font-black text-indigo-600 capitalize">{nextBillInfo.planName}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Next Billing Date</span>
                <span className="text-sm font-black text-gray-800">
                  {nextBillInfo.nextBillingDate ? formatDate(nextBillInfo.nextBillingDate) : "N/A"}
                </span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Billable Seats</span>
                <span className="text-sm font-black text-gray-800">{nextBillInfo.employeeCount} Employees</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-gray-200">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Price per Seat</span>
                <span className="text-sm font-black text-gray-800">₹{nextBillInfo.pricePerPerson} / month</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm font-black text-gray-900 uppercase tracking-wider">Total Amount Due</span>
                <span className="text-2xl font-black text-emerald-600">₹{nextBillInfo.amount}</span>
              </div>
            </div>

            <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-start gap-2.5">
              <span className="text-base mt-0.5">💡</span>
              <p className="text-indigo-800 text-[11px] font-bold leading-normal">
                <strong>Note:</strong> Active employees and those deactivated after 15 days of the current cycle are included in this billing count. Early renewals will extend from your existing billing end date.
              </p>
            </div>

            {!isBillPayable && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5">
                <span className="text-base mt-0.5">⚠️</span>
                <p className="text-amber-800 text-[11px] font-bold leading-normal">
                  <strong>Payment Locked:</strong> Your next bill can only be paid on or after your billing date: <strong>{formatDate(profile.planExpiresAt)}</strong>.
                </p>
              </div>
            )}

            <button
              onClick={handlePayBillSubmit}
              disabled={isPayingBill || !isBillPayable}
              className={`w-full font-bold py-3.5 rounded-2xl uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-2 ${
                isPayingBill || !isBillPayable
                  ? "bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed shadow-none"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 cursor-pointer"
              }`}
            >
              {isPayingBill ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <FaCreditCard size={14} /> Proceed to Payment
                </>
              )}
            </button>
          </div>
        )}
      </ModalWrapper>
    </div>
  );
};

// ─── Color map for CompanyDetailCard ───────────────────────────────────────────
const colorMap = {
  purple: { bg: "bg-purple-50", icon: "text-purple-500", badge: "text-purple-700 bg-purple-50 border-purple-100" },
  indigo: { bg: "bg-indigo-50", icon: "text-indigo-500", badge: "text-indigo-700 bg-indigo-50 border-indigo-100" },
  blue: { bg: "bg-blue-50", icon: "text-blue-500", badge: "text-blue-700 bg-blue-50 border-blue-100" },
  teal: { bg: "bg-teal-50", icon: "text-teal-500", badge: "text-teal-700 bg-teal-50 border-teal-100" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-500", badge: "text-emerald-700 bg-emerald-50 border-emerald-100" },
  rose: { bg: "bg-rose-50", icon: "text-rose-500", badge: "text-rose-700 bg-rose-50 border-rose-100" },
  sky: { bg: "bg-sky-50", icon: "text-sky-500", badge: "text-sky-700 bg-sky-50 border-sky-100" },
  amber: { bg: "bg-amber-50", icon: "text-amber-500", badge: "text-amber-700 bg-amber-50 border-amber-100" },
  violet: { bg: "bg-violet-50", icon: "text-violet-500", badge: "text-violet-700 bg-violet-50 border-violet-100" },
  orange: { bg: "bg-orange-50", icon: "text-orange-500", badge: "text-orange-700 bg-orange-50 border-orange-100" },
  fuchsia: { bg: "bg-fuchsia-50", icon: "text-fuchsia-500", badge: "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-100" },
  red: { bg: "bg-red-50", icon: "text-red-500", badge: "text-red-700 bg-red-50 border-red-100" },
  slate: { bg: "bg-slate-50", icon: "text-slate-500", badge: "text-slate-700 bg-slate-50 border-slate-200" },
};

const CompanyDetailCard = ({ icon, label, value, color = "purple", compact = false }) => {
  const c = colorMap[color] || colorMap.purple;
  return (
    <div className={`flex items-start gap-3 ${compact ? "p-4" : "p-5"} bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 group`}>
      <div className={`shrink-0 w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center ${c.icon} text-sm transition-transform group-hover:scale-110`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em] leading-none mb-1.5">{label}</p>
        <p className="text-gray-800 font-bold text-sm truncate leading-snug">{value}</p>
      </div>
    </div>
  );
};

const InfoItem = ({ icon, label, value }) => (
  <div className="flex items-center gap-4 group">
    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{label}</p>
      <p className="text-gray-900 font-bold truncate">{value}</p>
    </div>
  </div>
);

export default AdminProfile;
