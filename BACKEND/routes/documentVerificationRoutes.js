import express from 'express';
import multer from 'multer';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import DocumentVerification from '../models/DocumentVerification.js';
import Company from '../models/CompanyModel.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';
import customTransporter from '../config/nodemailer.js';

const router = express.Router();

// ---------------------------------------------------
// FIRE-AND-FORGET MAIL HELPER
// Mirrors offerLetterRoutes.js pattern — DO NOT AWAIT
// Backend responds instantly; mail delivers in background
// ---------------------------------------------------
const fireDocVerifyMail = ({ to, name, role, department, employmentType, companyName, formLink, emailSubject, emailMessage }) => {
  try {
    const parsedMessage = (emailMessage || '')
      .replace(/\[NAME\]/gi, name || 'Candidate')
      .replace(/\[ROLE\]/gi, role || 'Team Member')
      .replace(/\[DEPT\]/gi, department || 'General')
      .replace(/\[EMPLOYMENT_TYPE\]/gi, employmentType || 'Full Time')
      .replace(/\[COMPANY\]/gi, companyName || 'Our Company')
      .replace(/\[FORM_LINK\]/gi, '<a href="' + formLink + '" style="color:#6d28d9;font-weight:bold;">' + formLink + '</a>');

    const htmlBody = '<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.7;color:#333;max-width:600px;margin:auto;">' + parsedMessage.replace(/\n/g, '<br>') + '</div>';

    const mailOptions = {
      from: `"${companyName} HR" <${process.env.SMTP_USER}>`,
      to,
      subject: emailSubject || 'Document Verification Required',
      html: htmlBody,
    };

    // Fire-and-forget — same pattern as offerLetterRoutes.js — DO NOT AWAIT
    customTransporter.sendMail(mailOptions).catch(err => {
      console.error('🔥 BACKGROUND DOC VERIFY MAIL ERROR:', err.message);
    });

  } catch (err) {
    console.error('fireDocVerifyMail setup error:', err.message);
  }
};

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MULTER CONFIG ---
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// All document fields with their keys and labels
const DOCUMENT_FIELDS = [
  // Education
  { fieldKey: 'resume', label: 'Resume', category: 'resume' },
  { fieldKey: 'cert_10th', label: '10th Certificate', category: 'education' },
  { fieldKey: 'cert_intermediate', label: 'Intermediate Certificate', category: 'education' },
  { fieldKey: 'cert_graduation', label: 'Graduation Certificate', category: 'education' },
  { fieldKey: 'cert_post_graduation', label: 'Post Graduation Certificate', category: 'education' },
  // ID Proof
  { fieldKey: 'pan_card', label: 'PAN Card', category: 'id_proof' },
  { fieldKey: 'aadhaar_card', label: 'Aadhaar Card', category: 'id_proof' },
  { fieldKey: 'passport', label: 'Passport', category: 'id_proof' },
  // Photograph
  { fieldKey: 'passport_photo', label: 'Passport Size Photograph', category: 'photograph' },
  // Experience
  { fieldKey: 'exp_offer_letter', label: 'Offer Letter', category: 'experience' },
  { fieldKey: 'exp_hike_letter', label: 'Hike Letter', category: 'experience' },
  { fieldKey: 'exp_relieving_letter', label: 'Relieving Letter', category: 'experience' },
  { fieldKey: 'exp_resignation_acceptance', label: 'Resignation Acceptance Document', category: 'experience' },
  { fieldKey: 'exp_bank_statement', label: 'Bank Statement', category: 'experience' },
  { fieldKey: 'exp_experience_letter', label: 'Experience Letter', category: 'experience' },
  // Bank
  { fieldKey: 'passbook_photo', label: 'Pass Book (Photo)', category: 'bank' },
];

// ---------------------------------------------------
// CHECK IF EMAIL ALREADY SENT (NEW ENDPOINT - FIXED)
// ---------------------------------------------------
router.get('/company/:companyId/check/:email', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const { companyId, email } = req.params;

    // Ensure admin owns this company
    const company = await Company.findOne({ _id: companyId, adminId: req.user._id });
    if (!company) {
      return res.status(403).json({ error: "Unauthorized access to this company" });
    }

    const decodedEmail = decodeURIComponent(email);

    const existing = await DocumentVerification.findOne({
      company: companyId,
      email: decodedEmail.toLowerCase()
    });

    res.json({ alreadySent: !!existing });
  } catch (error) {
    console.error('Check email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------
// SEND INVITATION (SINGLE) - MODIFIED TO PREVENT RESEND
// ---------------------------------------------------
router.post('/invite', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const { email, name, fullName, role, department, employmentType, companyId, formBaseUrl, emailSubject, emailMessage } = req.body;

    if (!email || !companyId) {
      return res.status(400).json({ success: false, error: 'Email and Company ID are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    // Check if already exists and prevent resend
    let existing = await DocumentVerification.findOne({ email: email.toLowerCase(), company: companyId });

    // If already exists and status is not 'rejected', prevent resend
    if (existing && existing.status !== 'rejected') {
      return res.status(400).json({
        success: false,
        error: 'Document verification already sent to this email. Please check history.'
      });
    }

    const token = uuidv4();
    const docSlots = DOCUMENT_FIELDS.map(f => ({ fieldKey: f.fieldKey, label: f.label, fileUrl: null, adminVerified: false }));

    if (existing) {
      // Update existing record with new token (only for rejected cases)
      existing.name = name || existing.name;
      existing.fullName = fullName || existing.fullName;
      existing.role = role || existing.role;
      existing.department = department || existing.department;
      existing.employmentType = employmentType || existing.employmentType;
      existing.invitedBy = req.user._id;
      existing.token = token;
      existing.status = 'pending';
      existing.invitedAt = new Date();
      await existing.save();
    } else {
      existing = await DocumentVerification.create({
        email: email.toLowerCase(),
        name, fullName, role, department, employmentType,
        company: companyId,
        invitedBy: req.user._id,
        token,
        status: 'pending',
        documents: docSlots,
      });
    }

    // Build form link
    const formLink = `${formBaseUrl || 'https://hrms-420.netlify.app'}/document-verification?token=${token}`;

    // Fire-and-forget email — same pattern as offerLetterRoutes.js
    fireDocVerifyMail({
      to: email,
      name: name || fullName,
      role, department, employmentType,
      companyName: company.name,
      formLink, emailSubject, emailMessage,
    });

    res.status(200).json({
      success: true,
      message: 'Invitation sent! Email is being delivered in the background.',
      data: existing,
      formLink
    });
  } catch (error) {
    console.error('DocVerify invite error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to save invitation' });
  }
});

// ---------------------------------------------------
// SEND INVITATION (BULK) - MODIFIED TO PREVENT RESEND
// ---------------------------------------------------
router.post('/bulk-invite', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const { employees, companyId, formBaseUrl, emailSubject, emailMessage } = req.body;

    if (!employees || !Array.isArray(employees) || !companyId) {
      return res.status(400).json({ success: false, error: 'employees[] and companyId required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    const results = { success: [], failed: [], skipped: [], employeesWithLinks: [] };
    const docSlots = DOCUMENT_FIELDS.map(f => ({ fieldKey: f.fieldKey, label: f.label, fileUrl: null, adminVerified: false }));

    for (const emp of employees) {
      if (!emp.email) { results.failed.push({ email: 'unknown', reason: 'No email' }); continue; }
      try {
        const token = uuidv4();
        const emailLower = emp.email.toLowerCase();

        let existing = await DocumentVerification.findOne({ email: emailLower, company: companyId });

        // Skip if already exists and not rejected
        if (existing && existing.status !== 'rejected') {
          results.skipped.push({ email: emailLower, reason: 'Already sent previously' });
          continue; // Skip this email without sending
        }

        if (existing) {
          // Update only for rejected cases
          existing.token = token;
          existing.status = 'pending';
          existing.invitedAt = new Date();
          existing.invitedBy = req.user._id;
          Object.assign(existing, { name: emp.name, fullName: emp.fullName, role: emp.role, department: emp.department, employmentType: emp.employmentType });
          await existing.save();
        } else {
          existing = await DocumentVerification.create({
            email: emailLower, name: emp.name, fullName: emp.fullName, role: emp.role,
            department: emp.department, employmentType: emp.employmentType,
            company: companyId, invitedBy: req.user._id, token, status: 'pending', documents: docSlots,
          });
        }

        // Build unique form link for this employee
        const formLink = `${formBaseUrl || 'https://hrms-420.netlify.app'}/document-verification?token=${token}`;

        // Fire-and-forget email
        fireDocVerifyMail({
          to: emailLower,
          name: emp.name || emp.fullName,
          role: emp.role, department: emp.department, employmentType: emp.employmentType,
          companyName: company.name,
          formLink, emailSubject, emailMessage,
        });

        results.employeesWithLinks.push({ ...emp, formLink });
        results.success.push(emailLower);

      } catch (err) {
        results.failed.push({ email: emp.email, reason: err.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${employees.length} invitations. Sent: ${results.success.length}, Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`,
      results
    });
  } catch (error) {
    console.error('Bulk invite error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// GET RECORD BY TOKEN (Candidate form access)
// ---------------------------------------------------
router.get('/by-token/:token', async (req, res) => {
  try {
    const record = await DocumentVerification.findOne({ token: req.params.token })
      .populate('company', 'name _id');
    if (!record) return res.status(404).json({ success: false, error: 'Invalid or expired link' });
    const docFields = DOCUMENT_FIELDS;
    res.status(200).json({ success: true, data: record, docFields });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// UPLOAD A SINGLE DOCUMENT (Candidate)
// ---------------------------------------------------
router.post('/upload-doc/:token', upload.single('file'), async (req, res) => {
  try {
    const { fieldKey } = req.body;
    const { token } = req.params;

    if (!req.file || !fieldKey) {
      return res.status(400).json({ success: false, error: 'File and fieldKey are required' });
    }

    const record = await DocumentVerification.findOne({ token });
    if (!record) return res.status(404).json({ success: false, error: 'Invalid link' });

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(req.file.mimetype)) {
      return res.status(400).json({ success: false, error: 'Only image files (JPG, PNG, WEBP) and PDF are allowed.' });
    }

    // Upload to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const isPdf = req.file.mimetype === 'application/pdf';
    const cldRes = await cloudinary.uploader.upload(dataURI, {
      folder: 'hrms_doc_verification',
      resource_type: isPdf ? 'raw' : 'image',
      public_id: isPdf ? `${uuidv4()}.pdf` : undefined,
    });

    // Update document in the array
    const docIndex = record.documents.findIndex(d => d.fieldKey === fieldKey);
    if (docIndex >= 0) {
      record.documents[docIndex].fileUrl = cldRes.secure_url;
      record.documents[docIndex].cloudinaryPublicId = cldRes.public_id;
      record.documents[docIndex].uploadedAt = new Date();
    } else {
      const fieldDef = DOCUMENT_FIELDS.find(f => f.fieldKey === fieldKey);
      record.documents.push({
        fieldKey, label: fieldDef?.label || fieldKey,
        fileUrl: cldRes.secure_url, cloudinaryPublicId: cldRes.public_id,
        uploadedAt: new Date(), adminVerified: false,
      });
    }

    await record.save();
    res.status(200).json({ success: true, fileUrl: cldRes.secure_url, message: 'Uploaded successfully' });
  } catch (error) {
    console.error('Upload doc error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// MARK AS SUBMITTED (Candidate finalizes)
// ---------------------------------------------------
router.post('/submit/:token', async (req, res) => {
  try {
    const record = await DocumentVerification.findOneAndUpdate(
      { token: req.params.token },
      { status: 'submitted', submittedAt: new Date() },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.status(200).json({ success: true, message: 'Documents submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// GET ALL SUBMISSIONS FOR A COMPANY (Admin)
// ---------------------------------------------------
router.get('/company/:companyId', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    // Ensure admin owns this company
    const company = await Company.findOne({ _id: req.params.companyId, adminId: req.user._id });
    if (!company) {
      return res.status(403).json({ error: "Unauthorized access to this company" });
    }

    const records = await DocumentVerification.find({ company: req.params.companyId })
      .populate('company', 'name')
      .sort({ invitedAt: -1 });
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// GET ALL SUBMISSIONS (Admin – all companies)
// ---------------------------------------------------
router.get('/all', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    // Determine which companies this user can see
    let companyFilter = {};

    if (req.user.role === 'admin' || req.user.role === 'support-admin') {
      // SaaS Admin: See candidates for all companies they own
      const myCompanies = await Company.find({ adminId: req.user._id }).select('_id');
      const companyIds = myCompanies.map(c => c._id);
      companyFilter = { company: { $in: companyIds } };
    } else {
      // Manager/Employee: See candidates only for their assigned company
      if (!req.user.company) {
        return res.status(403).json({ success: false, error: "No company assigned to your profile" });
      }
      companyFilter = { company: req.user.company };
    }

    const records = await DocumentVerification.find(companyFilter)
      .populate('company', 'name')
      .sort({ invitedAt: -1 });
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    console.error('Get all doc verification records error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// GET VERIFIED DOCUMENTS FOR AN EMPLOYEE BY EMAIL
// ---------------------------------------------------
router.get('/employee', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email query param is required' });
    }

    const record = await DocumentVerification.findOne({ email: email.toLowerCase().trim() })
      .populate('company', 'name');

    if (!record) {
      return res.status(404).json({ success: false, error: 'No document verification record found for this email' });
    }

    const verifiedDocs = record.documents.filter(doc => doc.fileUrl && doc.adminVerified);

    res.status(200).json({
      success: true,
      data: {
        email: record.email,
        company: record.company,
        verifiedDocs,
        recordId: record._id,
        status: record.status,
        invitedAt: record.invitedAt,
      }
    });
  } catch (error) {
    console.error('Failed to fetch verified documents by email:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// ADMIN TOGGLE VERIFY A SINGLE DOCUMENT
// ---------------------------------------------------
router.patch('/verify-doc/:id', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const { fieldKey, verified } = req.body;
    const record = await DocumentVerification.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    const doc = record.documents.find(d => d.fieldKey === fieldKey);
    if (!doc) return res.status(404).json({ success: false, error: 'Document field not found' });

    doc.adminVerified = verified;
    doc.adminVerifiedAt = verified ? new Date() : null;

    // Auto-mark record as verified if all uploaded docs are verified
    const uploaded = record.documents.filter(d => d.fileUrl);
    const allVerified = uploaded.length > 0 && uploaded.every(d => d.adminVerified);
    if (allVerified) record.status = 'verified';
    else if (record.status === 'verified') record.status = 'submitted';

    await record.save();
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// ADMIN VERIFY ALL UPLOADED DOCUMENTS
// ---------------------------------------------------
router.patch('/verify-all/:id', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const record = await DocumentVerification.findById(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });

    let verifiedCount = 0;
    record.documents.forEach(doc => {
      if (doc.fileUrl) {
        doc.adminVerified = true;
        doc.adminVerifiedAt = new Date();
        verifiedCount++;
      }
    });

    if (verifiedCount > 0) record.status = 'verified';
    await record.save();

    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// ADMIN UPDATE NOTES
// ---------------------------------------------------
router.patch('/notes/:id', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const record = await DocumentVerification.findByIdAndUpdate(
      req.params.id,
      { adminNotes: req.body.notes },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, error: 'Record not found' });
    res.status(200).json({ success: true, data: record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// DELETE RECORD
// ---------------------------------------------------
router.delete('/:id', protect, restrictTo('admin', 'support-admin'), async (req, res) => {
  try {
    const deleted = await DocumentVerification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Record not found' });
    res.status(200).json({ success: true, message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// SIGN URL FOR PPT ONLINE PREVIEW (MICROSOFT COMPATIBILITY)
// ---------------------------------------------------
router.get('/sign-url', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    let signedUrl = url;

    if (url.includes('cloudinary.com')) {
      const match = url.match(/\/(raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/);
      if (match) {
        const resourceType = match[1];
        let publicId = match[2].split('?')[0];
        publicId = decodeURIComponent(publicId);

        if (resourceType === 'raw') {
          signedUrl = cloudinary.utils.private_download_url(publicId, undefined, {
            resource_type: 'raw',
            type: 'upload',
          });
        } else {
          signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            type: 'upload',
            sign_url: true,
            secure: true,
          });
        }
      }
    }

    res.status(200).json({ signedUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------
// PROXY DOCUMENT FOR IFRAME PREVIEW
// ---------------------------------------------------
router.get('/proxy-doc', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('No URL provided');

    console.log('🔗 Proxy doc URL:', url);

    let fetchUrl = url;

    // If it is a Cloudinary URL, let's generate a signed URL using Cloudinary SDK
    if (url.includes('cloudinary.com')) {
      const match = url.match(/\/(raw|image|video)\/upload\/(?:v\d+\/)?(.+)$/);
      if (match) {
        const resourceType = match[1];
        let publicId = match[2].split('?')[0];
        publicId = decodeURIComponent(publicId);

        // Generate signed URL using Cloudinary SDK
        let signedUrl;
        if (resourceType === 'raw') {
          signedUrl = cloudinary.utils.private_download_url(publicId, undefined, {
            resource_type: 'raw',
            type: 'upload',
          });
        } else {
          signedUrl = cloudinary.url(publicId, {
            resource_type: resourceType,
            type: 'upload',
            sign_url: true,
            secure: true,
          });
        }

        console.log('🔑 Generated signed URL:', signedUrl);
        fetchUrl = signedUrl;
      }
    }

    // Fetch using Node's native fetch
    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      }
    });

    if (!response.ok) {
      throw new Error(`Cloudinary responded with status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('✅ Proxy doc fetch success, bytes:', buffer.length);

    let contentType = response.headers.get('content-type') || 'application/octet-stream';

    // Inspect magic bytes for PDF
    if (contentType === 'application/octet-stream' || contentType === 'text/plain') {
      const magic = buffer.slice(0, 4).toString('utf-8');
      if (magic === '%PDF') {
        contentType = 'application/pdf';
      } else if (url.toLowerCase().endsWith('.pdf') || url.toLowerCase().includes('pdf')) {
        contentType = 'application/pdf';
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (error) {
    console.error('❌ Proxy document error details:', {
      message: error.message,
      url: req.query.url,
    });
    res.status(500).send('Failed to proxy document: ' + error.message);
  }
});

export default router;