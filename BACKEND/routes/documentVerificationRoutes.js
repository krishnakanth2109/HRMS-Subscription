import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import https from 'https';
import axios from 'axios';
import DocumentVerification from '../models/DocumentVerification.js';
import Company from '../models/CompanyModel.js';

const router = express.Router();

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MULTER CONFIG ---
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// --- BREVO CONFIG ---
const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY;
const brevoEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();


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
// SEND INVITATION (SINGLE)
// ---------------------------------------------------
router.post('/invite', async (req, res) => {
  try {
    const { email, name, fullName, role, department, employmentType, companyId, invitedBy, emailSubject, emailMessage, formBaseUrl } = req.body;

    if (!email || !companyId) {
      return res.status(400).json({ success: false, error: 'Email and Company ID are required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    // Check existing
    let existing = await DocumentVerification.findOne({ email: email.toLowerCase(), company: companyId });
    const token = uuidv4();

    const docSlots = DOCUMENT_FIELDS.map(f => ({ fieldKey: f.fieldKey, label: f.label, fileUrl: null, adminVerified: false }));

    if (existing) {
      existing.name = name || existing.name;
      existing.fullName = fullName || existing.fullName;
      existing.role = role || existing.role;
      existing.department = department || existing.department;
      existing.employmentType = employmentType || existing.employmentType;
      existing.token = token;
      existing.status = 'pending';
      existing.invitedAt = new Date();
      await existing.save();
    } else {
      existing = await DocumentVerification.create({
        email: email.toLowerCase(),
        name, fullName, role, department, employmentType,
        company: companyId,
        invitedBy: invitedBy || null,
        token,
        status: 'pending',
        documents: docSlots,
      });
    }

    // Build form link
    const formLink = `${formBaseUrl || 'https://hrms-420.netlify.app'}/document-verification?token=${token}`;

    // Send via Brevo
    const htmlBody = (emailMessage || '')
      .replace(/\n/g, '<br>')
      .replace('[FORM_LINK]', `<a href="${formLink}" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:16px 0;">Upload Your Documents</a>`)
      .replace('[NAME]', name || 'Candidate')
      .replace('[COMPANY]', company.name)
      .replace('[ROLE]', role || '')
      .replace('[DEPT]', department || '')
      .replace('[EMPLOYMENT_TYPE]', employmentType || '');

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.to = [{ email: email.toLowerCase(), name: name || email }];
    sendSmtpEmail.sender = { name: 'HR Team', email: process.env.BREVO_SENDER_EMAIL };
    sendSmtpEmail.subject = (emailSubject || 'Document Verification – Action Required').replace('[Company Name]', company.name);
    sendSmtpEmail.htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:24px;">📄 Document Verification</h1>
          <p style="color:#c7d2fe;margin:8px 0 0;">${company.name}</p>
        </div>
        <div style="padding:32px;background:#fff;">
          <p>${htmlBody}</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-top:24px;">
            <p style="margin:0;font-size:13px;color:#64748b;">If the button doesn't work, copy this link:</p>
            <p style="margin:8px 0 0;word-break:break-all;color:#4f46e5;font-size:13px;">${formLink}</p>
          </div>
        </div>
        <div style="padding:16px;text-align:center;background:#f8fafc;">
          <p style="font-size:12px;color:#94a3b8;margin:0;">This is an automated message from ${company.name} HR Portal</p>
        </div>
      </div>`;

    await brevoEmailApi.sendTransacEmail(sendSmtpEmail);

    res.status(200).json({ success: true, message: 'Invitation sent successfully', data: existing });
  } catch (error) {
    console.error('DocVerify invite error:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to send invitation' });
  }
});

// ---------------------------------------------------
// SEND INVITATION (BULK)
// ---------------------------------------------------
router.post('/bulk-invite', async (req, res) => {
  try {
    const { employees, companyId, invitedBy, emailSubject, emailMessage, formBaseUrl } = req.body;

    if (!employees || !Array.isArray(employees) || !companyId) {
      return res.status(400).json({ success: false, error: 'employees[] and companyId required' });
    }

    const company = await Company.findById(companyId);
    if (!company) return res.status(404).json({ success: false, error: 'Company not found' });

    const results = { success: [], failed: [] };
    const docSlots = DOCUMENT_FIELDS.map(f => ({ fieldKey: f.fieldKey, label: f.label, fileUrl: null, adminVerified: false }));

    for (const emp of employees) {
      if (!emp.email) { results.failed.push({ email: 'unknown', reason: 'No email' }); continue; }
      try {
        const token = uuidv4();
        const emailLower = emp.email.toLowerCase();

        let existing = await DocumentVerification.findOne({ email: emailLower, company: companyId });
        if (existing) {
          existing.token = token; existing.status = 'pending'; existing.invitedAt = new Date();
          Object.assign(existing, { name: emp.name, fullName: emp.fullName, role: emp.role, department: emp.department, employmentType: emp.employmentType });
          await existing.save();
        } else {
          existing = await DocumentVerification.create({
            email: emailLower, name: emp.name, fullName: emp.fullName, role: emp.role,
            department: emp.department, employmentType: emp.employmentType,
            company: companyId, invitedBy: invitedBy || null, token, status: 'pending', documents: docSlots,
          });
        }

        const formLink = `${formBaseUrl || 'https://hrms-420.netlify.app'}/document-verification?token=${token}`;
        const htmlBody = (emailMessage || '')
          .replace(/\n/g, '<br>')
          .replace('[FORM_LINK]', `<a href="${formLink}" style="background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Upload Documents</a>`)
          .replace('[NAME]', emp.name || 'Candidate')
          .replace('[COMPANY]', company.name)
          .replace('[ROLE]', emp.role || '')
          .replace('[DEPT]', emp.department || '')
          .replace('[EMPLOYMENT_TYPE]', emp.employmentType || '');

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.to = [{ email: emailLower, name: emp.name || emailLower }];
        sendSmtpEmail.sender = { name: 'HR Team', email: process.env.BREVO_SENDER_EMAIL };
        sendSmtpEmail.subject = (emailSubject || 'Document Verification – Action Required').replace('[Company Name]', company.name);
        sendSmtpEmail.htmlContent = `<div style="font-family:Arial,sans-serif;padding:20px;"><h2>Document Verification – ${company.name}</h2><p>${htmlBody}</p><p style="font-size:12px;color:#64748b;">${formLink}</p></div>`;

        await brevoEmailApi.sendTransacEmail(sendSmtpEmail);
        results.success.push(emailLower);
      } catch (err) {
        results.failed.push({ email: emp.email, reason: err.message });
      }
    }

    res.status(200).json({ success: true, message: `Processed ${employees.length} invitations`, results });
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

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ success: false, error: 'Only image files (JPG, PNG) are allowed.' });
    }

    // Upload to Cloudinary (Enforced as Image Only)
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const cldRes = await cloudinary.uploader.upload(dataURI, {
      folder: 'hrms_doc_verification',
      resource_type: 'image',
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
router.get('/company/:companyId', async (req, res) => {
  try {
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
router.get('/all', async (req, res) => {
  try {
    const records = await DocumentVerification.find()
      .populate('company', 'name')
      .sort({ invitedAt: -1 });
    res.status(200).json({ success: true, data: records });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ---------------------------------------------------
// ADMIN TOGGLE VERIFY A SINGLE DOCUMENT
// ---------------------------------------------------
router.patch('/verify-doc/:id', async (req, res) => {
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
router.patch('/verify-all/:id', async (req, res) => {
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
router.patch('/notes/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await DocumentVerification.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, error: 'Record not found' });
    res.status(200).json({ success: true, message: 'Record deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
