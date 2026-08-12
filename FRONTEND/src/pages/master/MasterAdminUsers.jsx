import React, { useState, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import api from "../../api"; // Import the configured axios instance
import Swal from "sweetalert2";
import html2pdf from "html2pdf.js";
import logoImg from "../../assets/logo.png";

const AdminMonitoring = () => {
  const location = useLocation();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (location.state && location.state.status) {
      setStatusFilter(location.state.status);
    }
  }, [location]);

  // 1. Update current time every second for the countdown
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch all admins from backend using the configured api instance
  const fetchAdmins = async () => {
    try {
      // Using the imported api instance which has the correct baseURL from env
      const res = await api.get("/api/admin/all-admins");
      setAdmins(res.data);
    } catch (err) {
      console.error("Fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const handleSendEmail = async (admin) => {
    const { value: formValues } = await Swal.fire({
      title: `<div class="text-left text-2xl font-black text-gray-800 flex items-center gap-3">
                <span class="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                </span>
                Dispatch Email
              </div>`,
      html: `
        <div class="mt-4 text-left font-sans">
          <p class="text-sm text-gray-500 mb-6 font-medium leading-relaxed">You are drafting a secure message directly to <span class="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">${admin.name}</span>.</p>
          <div class="mb-5">
            <label class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Subject</label>
            <input id="swal-input1" class="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 block p-3.5 transition-all outline-none" placeholder="Enter subject line here...">
          </div>
          <div>
            <label class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Message Content</label>
            <textarea id="swal-input2" class="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm font-medium rounded-xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 block p-3.5 transition-all outline-none leading-relaxed" placeholder="Type your message..." style="height: 160px; resize: none;"></textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'rounded-2xl shadow-2xl border border-gray-100 !p-8 max-w-lg',
        confirmButton: 'bg-indigo-600 text-white font-bold rounded-xl px-7 py-3 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all ml-3 shadow-lg shadow-indigo-200/50',
        cancelButton: 'bg-white text-gray-600 border border-gray-200 font-bold rounded-xl px-7 py-3 hover:bg-gray-50 hover:text-gray-900 focus:ring-4 focus:ring-gray-50 transition-all'
      },
      buttonsStyling: false,
      showCancelButton: true,
      confirmButtonText: 'Send Message',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        return {
          subject: document.getElementById('swal-input1').value,
          message: document.getElementById('swal-input2').value
        }
      }
    });

    if (formValues) {
      if (!formValues.subject || !formValues.message) {
        Swal.fire('Error', 'Subject and Message are required', 'error');
        return;
      }
      try {
        Swal.fire({ title: 'Sending...', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        await api.post('/api/admin/send-subscriber-email', {
          email: admin.email,
          name: admin.name,
          subject: formValues.subject,
          message: formValues.message
        });
        Swal.fire('Sent!', 'Email has been sent successfully.', 'success');
      } catch (err) {
        Swal.fire('Error', 'Failed to send email.', 'error');
      }
    }
  };

  const numberToWords = (amount) => {
    if (!amount || amount === 0) return 'Zero Only';
    const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const inWords = (n) => {
      n = parseInt(n);
      if (n === 0) return '';
      if (n < 20) return a[n] + ' ';
      if (n < 100) return b[Math.floor(n/10)] + (n%10 ? ' ' + a[n%10] : '') + ' ';
      if (n < 1000) return a[Math.floor(n/100)] + ' Hundred ' + inWords(n%100);
      if (n < 100000) return inWords(Math.floor(n/1000)) + 'Thousand ' + inWords(n%1000);
      if (n < 10000000) return inWords(Math.floor(n/100000)) + 'Lakh ' + inWords(n%100000);
      return inWords(Math.floor(n/10000000)) + 'Crore ' + inWords(n%10000000);
    };
    const whole = Math.floor(amount);
    const paise = Math.round((amount - whole) * 100);
    let result = 'Rupees ' + inWords(whole).trim();
    if (paise > 0) result += ' and ' + inWords(paise).trim() + ' Paise';
    return result + ' Only';
  };

  const handleDownloadInvoice = async (admin) => {
    const { value: formValues } = await Swal.fire({
      title: `<div class="text-left text-2xl font-black text-gray-800 flex items-center gap-3">
                <span class="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                </span>
                Generate Invoice
              </div>`,
      html: `
        <div class="mt-4 text-left font-sans">
          <p class="text-sm text-gray-500 mb-6 font-medium leading-relaxed">Prepare an official invoice document for <span class="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">${admin.name}</span>.</p>
          <div class="mb-5">
            <label class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Company Name (Recipient)</label>
            <input id="invoice-company" class="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3.5 transition-all outline-none" placeholder="Enter Company Name" value="${admin.name || ''}">
          </div>
          <div class="mb-5">
            <label class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Salesperson</label>
            <input id="invoice-salesperson" class="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm font-semibold rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3.5 transition-all outline-none" placeholder="Enter Salesperson Name" value="System">
          </div>
          <div>
            <label class="block text-[11px] font-black text-gray-400 uppercase tracking-widest mb-2 ml-1">Recipient Address</label>
            <textarea id="invoice-address" class="w-full bg-gray-50/50 border border-gray-200 text-gray-900 text-sm font-medium rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-500 block p-3.5 transition-all outline-none leading-relaxed" placeholder="Enter precise billing address..." style="height: 100px; resize: none;"></textarea>
          </div>
        </div>
      `,
      customClass: {
        popup: 'rounded-2xl shadow-2xl border border-gray-100 !p-8 max-w-lg',
        confirmButton: 'bg-blue-600 text-white font-bold rounded-xl px-7 py-3 hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all ml-3 shadow-lg shadow-blue-200/50',
        cancelButton: 'bg-white text-gray-600 border border-gray-200 font-bold rounded-xl px-7 py-3 hover:bg-gray-50 hover:text-gray-900 focus:ring-4 focus:ring-gray-50 transition-all'
      },
      buttonsStyling: false,
      showCancelButton: true,
      confirmButtonText: 'Generate PDF',
      cancelButtonText: 'Cancel',
      focusConfirm: false,
      preConfirm: () => {
        return {
          companyName: document.getElementById('invoice-company').value,
          address: document.getElementById('invoice-address').value,
          salesperson: document.getElementById('invoice-salesperson').value
        }
      }
    });

    if (!formValues) return; // User cancelled

    const totalAmount = admin.planDetails?.lastPaymentAmount || admin.planDetails?.price || 0;
    const subtotal = (totalAmount / 1.18).toFixed(2);
    const cgst = (subtotal * 0.09).toFixed(2);
    const sgst = (subtotal * 0.09).toFixed(2);
    const maxUsers = admin.planDetails?.maxUsers || 1;
    const unitPrice = admin.planDetails?.maxUsers ? (subtotal / admin.planDetails.maxUsers).toFixed(2) : subtotal;
    const billToAddress = "Manjula Nilayam 2, 602, 6th Floor, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081";

    const invoiceHtml = `
<div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 15px; box-sizing: border-box; min-height: 281mm; position: relative;">
  <!-- Professional Header: Logo left | Company centre | TAX INVOICE right -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
    <!-- Left: Arah Infotech Logo -->
    <div style="flex: 0 0 auto;">
      <img src="https://image2url.com/r2/default/images/1774247571292-e7459e42-1868-4206-bd5c-bb4c59de5716.png" alt="Arah Infotech" style="height: 64px; object-fit: contain;" crossorigin="anonymous" />
    </div>
    <!-- Centre: Company Info -->
    <div style="flex: 1; text-align: center; padding: 0 15px;">
      <div style="font-size: 17px; font-weight: 900; color: #1e3a8a; letter-spacing: 0.5px;">ARAH INFOTECH PVT. LTD.</div>
      <div style="font-size: 11px; font-weight: bold; color: #374151; margin: 2px 0;">VSync – HRMS &amp; Workforce Management Platform</div>
      <div style="font-size: 9.5px; color: #6b7280; line-height: 1.5;">
        Manjula Nilayam 2, 602, 6th Floor, Ayyappa Society, Main Road, Madhapur, Hyderabad, TG – 500081<br/>
        GSTIN: 36ABCDE1234F1Z5 &nbsp;|&nbsp; Email: support@vsync.com &nbsp;|&nbsp; Phone: +91 90632 22383<br/>
        Website: <span style="color:#0ea5e9;">https://arahinfotech.net/</span>
      </div>
    </div>
    <!-- Right: TAX INVOICE label -->
    <div style="flex: 0 0 auto; text-align: right;">
      <div style="font-size: 20px; font-weight: 900; color: #1e3a8a; letter-spacing: 2px; border: 2px solid #1e3a8a; padding: 6px 14px; border-radius: 4px;">TAX INVOICE</div>
    </div>
  </div>

  <!-- Invoice Meta Row -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
    <tr>
      <td style="padding: 6px 10px; border-right: 1px solid #e2e8f0;"><strong>Invoice No.:</strong> ARAH/VSYNC/2026-27/${(admin.planDetails?.razorpayPaymentId || '000').slice(-4).toUpperCase()}</td>
      <td style="padding: 6px 10px; border-right: 1px solid #e2e8f0;"><strong>Invoice Date:</strong> ${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td style="padding: 6px 10px; border-right: 1px solid #e2e8f0;"><strong>Payment Status:</strong> <span style="color:#16a34a; font-weight:bold;">PAID</span></td>
      <td style="padding: 6px 10px; border-right: 1px solid #e2e8f0;"><strong>Payment Date:</strong> ${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td style="padding: 6px 10px;"><strong>Payment Mode:</strong> Razorpay</td>
    </tr>
  </table>

  <!-- Bill To / Ship To -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #bfdbfe;">
    <thead>
      <tr style="background-color: #dbeafe; color: #1e3a8a; font-size: 12px;">
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: left; width: 50%; font-weight: bold;">From</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: left; width: 50%; font-weight: bold;">To</th>
      </tr>
    </thead>
    <tbody style="font-size: 11px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #bfdbfe; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width: 90px; font-weight: bold; padding-bottom: 4px;">Company</td><td style="padding-bottom: 4px;">ARAH INFOTECH PVT. LTD.</td></tr>
            <tr><td style="font-weight: bold; padding-bottom: 4px; vertical-align: top;">Address</td><td style="padding-bottom: 4px; line-height: 1.4;">Manjula Nilayam 2, 602, 6th Floor, Ayyappa Society, Main Road, Madhapur, Hyderabad, Telangana - 500081</td></tr>
            <tr><td style="font-weight: bold; padding-bottom: 4px;">GSTIN</td><td style="padding-bottom: 4px;">36ABCDE1234F1Z5</td></tr>
            <tr><td style="font-weight: bold;">Phone</td><td>+91 90632 22383</td></tr>
          </table>
        </td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width: 90px; font-weight: bold; padding-bottom: 4px;">Customer Name</td><td style="padding-bottom: 4px;">${admin.name || "N/A"}</td></tr>
            <tr><td style="font-weight: bold; padding-bottom: 4px;">Company Name</td><td style="padding-bottom: 4px;">${formValues.companyName || "N/A"}</td></tr>
            <tr><td style="font-weight: bold; padding-bottom: 4px; vertical-align: top;">Address</td><td style="padding-bottom: 4px; line-height: 1.4; word-wrap: break-word; word-break: break-word; max-width: 200px;">${(formValues.address || "-").replace(/\n/g, ', ')}</td></tr>
            <tr><td style="font-weight: bold;">Phone</td><td>${admin.phone || "N/A"}</td></tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 8px; border: 1px solid #bfdbfe; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width: 90px; font-weight: bold; padding-bottom: 4px;">Payment Due</td><td style="padding-bottom: 4px;">${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
            <tr><td style="font-weight: bold; padding-bottom: 4px;">Salesperson</td><td style="padding-bottom: 4px;">${formValues.salesperson || "System"}</td></tr>
            <tr><td style="font-weight: bold;">Payment Terms</td><td>Online</td></tr>
          </table>
        </td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; vertical-align: top;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="width: 90px; font-weight: bold;">Delivery Date</td><td>${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-US", { month: 'long', day: 'numeric', year: 'numeric' })}</td></tr>
          </table>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Items Table -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border: 1px solid #bfdbfe;">
    <thead>
      <tr style="background-color: #dbeafe; color: #1e3a8a; font-weight: bold; font-size: 11px;">
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: left; width: 6%;">Qty.</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: left; width: 10%;">Item#</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: left; width: 34%;">Description</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: right; width: 20%;">Unit price</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: right; width: 15%;">Discount</th>
        <th style="padding: 8px; border: 1px solid #bfdbfe; text-align: right; width: 15%;">Line total</th>
      </tr>
    </thead>
    <tbody style="font-size: 11px;">
      <tr>
        <td style="padding: 8px; border: 1px solid #bfdbfe;">${maxUsers}</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe;">123</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe;">V-SYNC - ${admin.planDetails?.planName || admin.plan}</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${unitPrice} Rs</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">0 Rs</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${subtotal} Rs</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #bfdbfe; border-bottom: none; border-top: none;"></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">Total Discount</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">0 Rs</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #bfdbfe; border-bottom: none; border-top: none;"></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">Subtotal</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${subtotal} Rs</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #bfdbfe; border-bottom: none; border-top: none;"></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">CGST <span style="font-size:10px">(9%)</span></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${cgst} Rs</td>
      </tr>
      <tr>
        <td colspan="4" style="border: 1px solid #bfdbfe; border-bottom: none; border-top: none;"></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">SGST <span style="font-size:10px">(9%)</span></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${sgst} Rs</td>
      </tr>
      <tr style="background-color: #93c5fd; font-weight: bold;">
        <td colspan="4" style="border: 1px solid #bfdbfe; border-top: none;"></td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">Total</td>
        <td style="padding: 8px; border: 1px solid #bfdbfe; text-align: right;">${totalAmount} Rs</td>
      </tr>
    </tbody>
  </table>

  <!-- Subscription Info -->
  <div style="margin-top: 10px; margin-bottom: 10px; font-size: 11px; color: #374151; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; display: flex; gap: 20px;">
    <span><strong>Subscription Period:</strong> ${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })} &ndash; ${new Date(admin.planExpiresAt || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
    <span><strong>Plan:</strong> ${admin.planDetails?.planName || admin.plan || 'N/A'}</span>
    <span><strong>Employee Licenses:</strong> ${maxUsers}</span>
  </div>

  <!-- Amount Payable + Amount in Words -->
  <div style="margin-bottom: 10px; font-size: 11px; color: #374151; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; background: #fff;">
    <div><strong>Amount Payable:</strong> &#8377;${totalAmount} Rs</div>
    <div style="margin-top: 4px;"><strong>Amount in Words:</strong> <em style="color: #1e3a8a;">${numberToWords(totalAmount)}</em></div>
  </div>

  <!-- Payment Details -->
  <div style="margin-bottom: 12px; border: 1px solid #bfdbfe; border-radius: 4px; overflow: hidden; font-size: 11px;">
    <div style="background-color: #dbeafe; color: #1e3a8a; font-weight: bold; padding: 6px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px;">Payment Details</div>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 5px 10px; border-bottom: 1px solid #e2e8f0; width: 50%;"><strong>Payment Status:</strong> <span style="color: #16a34a; font-weight: bold;">PAID</span></td>
        <td style="padding: 5px 10px; border-bottom: 1px solid #e2e8f0;"><strong>Payment Date:</strong> ${new Date(admin.planDetails?.lastPaymentAt || admin.planActivatedAt || Date.now()).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      </tr>
      <tr>
        <td style="padding: 5px 10px;"><strong>Transaction / Payment Reference:</strong> ${admin.planDetails?.razorpayPaymentId || 'N/A'}</td>
        <td style="padding: 5px 10px;"><strong>Payment Gateway / Bank:</strong> Razorpay</td>
      </tr>
    </table>
  </div>

  <!-- Thank You -->
  <div style="color: #0284c7; font-size: 13px; font-weight: bold; margin-top: 10px; margin-bottom: 10px;">
    Thank you for your business!
  </div>

  <!-- Footer -->
  <div style="position: absolute; bottom: 15px; left: 15px; right: 15px;">
    <table style="width: 100%; border-top: 1px solid #e5e7eb; padding-top: 15px; margin-top: 15px;">
      <tr>
        <td style="font-size: 11px; color: #374151; line-height: 1.4; text-align: left; vertical-align: bottom;">
          <div style="font-weight: bold; color: #1e3a8a; margin-bottom: 3px; font-size: 12px;">ARAH INFOTECH PVT.LTD</div>
          <div style="margin-bottom: 5px;">Manjula Nilayam 2, 602, 6th Floor, Ayyappa Society, Main Road,<br/>Madhapur, Hyderabad, Telangana - 500081</div>
          <a href="https://arahinfotech.net/" style="color: #0ea5e9; text-decoration: underline; display: block;">https://arahinfotech.net/</a>
          <div style="margin-top: 3px;">9063222383 | support@vsync.com</div>
        </td>
        <td style="text-align: right; vertical-align: bottom;">
          <div style="font-size: 13px; font-weight: bold; color: #1e3a8a; display: inline-block;">
            <span style="vertical-align: middle; display: inline-block; transform: translateY(1px);">Powered by</span>
            <img src="/arah-logo.png" alt="Arah Infotech" style="height: 28px; object-fit: contain; vertical-align: middle; margin-left: 8px;" />
          </div>
        </td>
      </tr>
    </table>
  </div>
</div>
    `;

    const element = document.createElement('div');
    element.innerHTML = invoiceHtml;

    html2pdf().set({
      margin: [8, 8, 8, 8],
      filename: `Invoice_${admin.name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 1.5, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all'] }
    }).from(element).save();
  };

  // 3. Helper: Calculate Time Left
  const getTimeRemaining = (expiryDate) => {
    const total = Date.parse(expiryDate) - Date.parse(currentTime);
    if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 };

    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));

    return { total, days, hours, minutes, seconds };
  };

  // --- STATS CALCULATION ---
  const totalCompanies = admins.length;
  const activePlans = admins.filter(a => new Date(a.planExpiresAt) > currentTime).length;
  const expiredPlans = totalCompanies - activePlans;

  // --- FILTERED ADMINS ---
  const filteredAdmins = useMemo(() => {
    return admins.filter(admin => {
      const time = getTimeRemaining(admin.planExpiresAt);
      const isExpired = time.total <= 0;

      if (statusFilter === "active" && isExpired) return false;
      if (statusFilter === "expired" && !isExpired) return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = admin.name?.toLowerCase().includes(query);
        const matchesEmail = admin.email?.toLowerCase().includes(query);
        return matchesName || matchesEmail;
      }

      return true;
    });
  }, [admins, statusFilter, searchQuery, currentTime]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600 font-medium">Loading Real-time Monitor...</p>
    </div>
  );

  return (
    <div className="animate-[fadeIn_0.4s_ease-out]">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Subscription <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Monitor</span>
          </h1>
          <p className="text-slate-550 text-sm mt-1">Live tracking of company subscription plan statuses and countdown expirations.</p>
        </div>
        <button
          onClick={fetchAdmins}
          className="flex items-center gap-2 bg-white text-slate-700 border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl shadow-sm hover:shadow active:scale-95 transition-all font-bold text-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Sync Now
        </button>
      </div>

      {/* --- INTERACTIVE FILTER CARDS --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">

        {/* Total Companies Card (Filter All) */}
        <div
          onClick={() => setStatusFilter("all")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${statusFilter === "all"
            ? "bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20 shadow-md -translate-y-0.5"
            : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
            }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${statusFilter === "all"
              ? "bg-blue-600 text-white shadow-sm"
              : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
              }`}>
              <svg xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Total Companies
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{totalCompanies}</h3>
            </div>
          </div>

          {statusFilter === "all" && (
            <span className="text-[9px] font-extrabold text-blue-700 bg-blue-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-blue-200/60 shadow-2xs">
              Showing All
            </span>
          )}
        </div>

        {/* Active Plans Card (Filter Active) */}
        <div
          onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${statusFilter === "active"
            ? "bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-md -translate-y-0.5"
            : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
            }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${statusFilter === "active"
              ? "bg-emerald-600 text-white shadow-sm"
              : "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white"
              }`}>
              <svg xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Active Plans
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{activePlans}</h3>
            </div>
          </div>

          {statusFilter === "active" && (
            <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-200/60 shadow-2xs">
              Active ✓
            </span>
          )}
        </div>

        {/* Expired Plans Card (Filter Expired) */}
        <div
          onClick={() => setStatusFilter(statusFilter === "expired" ? "all" : "expired")}
          className={`p-5 rounded-2xl border transition-all duration-300 cursor-pointer select-none group relative flex items-center justify-between ${statusFilter === "expired"
            ? "bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-md -translate-y-0.5"
            : "bg-white border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 hover:-translate-y-0.5"
            }`}
        >
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-all duration-300 ${statusFilter === "expired"
              ? "bg-rose-600 text-white shadow-sm"
              : "bg-rose-50 text-rose-600 group-hover:bg-rose-600 group-hover:text-white"
              }`}>
              <svg xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                Expired Plans
              </p>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">{expiredPlans}</h3>
            </div>
          </div>

          {statusFilter === "expired" && (
            <span className="text-[9px] font-extrabold text-rose-700 bg-rose-100/90 px-2.5 py-1 rounded-full uppercase tracking-wider border border-rose-200/60 shadow-2xs">
              Expired ✓
            </span>
          )}
        </div>

      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        {/* Modern Tab Filters */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200/60 shadow-inner w-full md:w-auto overflow-x-auto">
          {[
            { id: "all", label: "All Companies", count: totalCompanies },
            { id: "active", label: "Active Plans", count: activePlans },
            { id: "expired", label: "Expired", count: expiredPlans }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(statusFilter === tab.id && tab.id !== "all" ? "all" : tab.id)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${statusFilter === tab.id
                ? "bg-white text-slate-900 shadow-sm border border-slate-200/40"
                : "text-slate-500 hover:text-slate-800"
                }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${statusFilter === tab.id
                ? "bg-slate-900 text-white"
                : "bg-slate-200 text-slate-600"
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Results Count & Search Bar */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-semibold text-slate-400 hidden sm:inline whitespace-nowrap">
            Showing <strong className="text-slate-700">{filteredAdmins.length}</strong> of {totalCompanies}
          </span>
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search by company or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500 hover:border-slate-350 transition-colors shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* --- DYNAMIC TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Company / Admin</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider text-center">Plan Type</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Status</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Activation Date</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider">Expiry Date</th>
                <th className="p-5 font-bold text-blue-600 border-b border-slate-100 text-[10px] uppercase tracking-wider text-right">Countdown (Live)</th>
                <th className="p-5 font-bold text-slate-400 border-b border-slate-100 text-[10px] uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAdmins.map((admin) => {
                const time = getTimeRemaining(admin.planExpiresAt);
                const isExpired = time.total <= 0;

                return (
                  <tr key={admin._id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold border bg-blue-50 text-blue-600 border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                          {admin.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 text-sm leading-snug">{admin.name}</div>
                          <div className="text-xs text-slate-400 font-semibold">{admin.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border ${admin.plan === 'Premium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                        admin.plan === 'Free' ? 'bg-slate-50 text-slate-600 border-slate-200' :
                          'bg-blue-50 text-blue-755 border-blue-100'
                        }`}>
                        {admin.plan}
                      </span>
                    </td>
                    <td className="p-5">
                      {isExpired ? (
                        <div className="inline-flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-100 px-2.5 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping"></span>
                          <span className="text-xs font-bold uppercase tracking-wider">Expired</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg">
                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></span>
                          <span className="text-xs font-bold uppercase tracking-wider">Active</span>
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-xs font-semibold text-slate-700">
                      <div>{new Date(admin.planActivatedAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        at {new Date(admin.planActivatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-5 text-xs font-semibold text-slate-700">
                      <div>{new Date(admin.planExpiresAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        at {new Date(admin.planExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="p-5 text-right">
                      {isExpired ? (
                        <span className="inline-flex bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-wider">Renewal Overdue</span>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-xl font-mono text-xs font-bold text-slate-700 shadow-inner">
                          <span className="text-blue-600">{time.days}d</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-slate-705">{String(time.hours).padStart(2, '0')}h</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-slate-606">{String(time.minutes).padStart(2, '0')}m</span>
                          <span className="text-slate-300">:</span>
                          <span className="text-indigo-500 animate-pulse">{String(time.seconds).padStart(2, '0')}s</span>
                        </div>
                      )}
                    </td>
                    <td className="p-5 text-center flex flex-col gap-2 justify-center items-center h-full">
                      <button
                        onClick={() => handleSendEmail(admin)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 border border-blue-100 hover:border-blue-600"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                        Email
                      </button>
                      <button
                        onClick={() => handleDownloadInvoice(admin)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-600 hover:bg-slate-700 hover:text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors duration-200 border border-slate-200 hover:border-slate-700"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        Invoice
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredAdmins.length === 0 && (
          <div className="p-20 text-center flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
            </div>
            <p className="text-slate-550 font-semibold tracking-tight">No companies found</p>
            <p className="text-xs text-slate-405 mt-1">Try adjusting your filters or search query to find subscriber accounts.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminMonitoring;