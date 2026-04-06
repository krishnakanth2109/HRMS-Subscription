import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import InvitedEmployee from '../models/Invitedemployee.js'; // Adjust path as needed
import Company from '../models/CompanyModel.js'; // Adjust path as needed
import CompanyDocument from '../models/Companydocument.js'; // Added for document management

const router = express.Router();

// --- CLOUDINARY CONFIG ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// --- MULTER CONFIG (Memory Storage) ---
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ========================================
// DOCUMENT MANAGEMENT ROUTES
// ========================================

// --- UPLOAD DOCUMENT (ADMIN) ---
router.post('/documents/upload', upload.single('file'), async (req, res) => {
  try {
    const { companyId, uploadedBy, description } = req.body;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'No file uploaded' 
      });
    }

    if (!companyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Company ID is required' 
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      });
    }

    // Upload to Cloudinary with proper resource type
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    // Determine resource type based on file
    let resourceType = 'raw'; // Default for documents
    if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      resourceType = 'video';
    }
    
    const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, { 
      folder: "hrms_documents",
      resource_type: resourceType,
      format: req.file.originalname.split('.').pop() // Preserve original format
    });

    // Extract file extension
    const fileType = req.file.originalname.split('.').pop().toLowerCase();

    // Create document record in DB
    const newDocument = new CompanyDocument({
      fileName: req.file.originalname,
      fileUrl: cloudinaryResponse.secure_url,
      fileType: fileType,
      fileSize: req.file.size,
      cloudinaryPublicId: cloudinaryResponse.public_id,
      company: companyId,
      uploadedBy: uploadedBy || null,
      description: description || ''
    });

    await newDocument.save();

    res.status(201).json({ 
      success: true, 
      message: 'Document uploaded successfully',
      data: newDocument 
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to upload document' 
    });
  }
});

// --- GET ALL DOCUMENTS FOR A COMPANY ---
router.get('/documents/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;

    const documents = await CompanyDocument.find({ company: companyId })
      .sort({ uploadedAt: -1 });

    res.status(200).json({ 
      success: true, 
      data: documents 
    });

  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch documents' 
    });
  }
});

// --- DELETE DOCUMENT ---
router.delete('/documents/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const document = await CompanyDocument.findById(documentId);
    
    if (!document) {
      return res.status(404).json({ 
        success: false, 
        error: 'Document not found' 
      });
    }

    // Delete from Cloudinary
    if (document.cloudinaryPublicId) {
      try {
        // Determine resource type from public ID or file type
        let resourceType = 'raw';
        if (document.fileType && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(document.fileType.toLowerCase())) {
          resourceType = 'image';
        }
        
        await cloudinary.uploader.destroy(document.cloudinaryPublicId, {
          resource_type: resourceType,
          invalidate: true
        });
      } catch (cloudinaryError) {
        console.error('Cloudinary deletion error:', cloudinaryError);
        // Continue with DB deletion even if Cloudinary fails
      }
    }

    // Delete from DB
    await CompanyDocument.findByIdAndDelete(documentId);

    res.status(200).json({ 
      success: true, 
      message: 'Document deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete document' 
    });
  }
});

// ========================================
// EMPLOYEE INVITATION ROUTES
// ========================================

// --- INVITE SINGLE EMPLOYEE ---
router.post('/invite', async (req, res) => {
  try {
    const { email, companyId, invitedBy, name, role, department, employmentType, salary, requiredDocuments } = req.body;

    if (!email || !companyId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and Company ID are required' 
      });
    }

    // Check if company exists
    const company = await Company.findById(companyId);
    if (!company) {
      return res.status(404).json({ 
        success: false, 
        error: 'Company not found' 
      });
    }

    // Check if email already invited
    const existingInvite = await InvitedEmployee.findOne({ email: email.toLowerCase() });
    
    if (existingInvite) {
      // Update existing invite (handles re-inviting revoked users or updating details)
      if (existingInvite.status === 'revoked' || existingInvite.status === 'pending') {
        existingInvite.company = companyId;
        existingInvite.status = 'pending';
        existingInvite.name = name || existingInvite.name;
        existingInvite.role = role || existingInvite.role;
        existingInvite.department = department || existingInvite.department;
        existingInvite.employmentType = employmentType || existingInvite.employmentType;
        existingInvite.salary = salary || existingInvite.salary;
        existingInvite.requiredDocuments = requiredDocuments || existingInvite.requiredDocuments;
        existingInvite.invitedAt = new Date();
        if (invitedBy) existingInvite.invitedBy = invitedBy;
        
        await existingInvite.save();
        
        return res.status(200).json({ 
          success: true, 
          message: 'Invitation updated successfully',
          data: existingInvite 
        });
      } else {
        return res.status(400).json({ 
          success: false, 
          error: 'Email already invited or onboarded' 
        });
      }
    }

    // Create new invitation
    const newInvite = new InvitedEmployee({
      email: email.toLowerCase(),
      company: companyId,
      invitedBy: invitedBy || null,
      name,
      role,
      department,
      employmentType,
      salary,
      requiredDocuments: requiredDocuments || [],
      status: 'pending'
    });

    await newInvite.save();

    res.status(201).json({ 
      success: true, 
      message: 'Invitation sent successfully',
      data: newInvite 
    });

  } catch (error) {
    console.error('Error sending invitation:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to send invitation' 
    });
  }
});

// --- BULK INVITE ---
router.post('/bulk-invite', async (req, res) => {
  try {
    const { employees, companyId, invitedBy } = req.body;

    if (!employees || !Array.isArray(employees) || employees.length === 0) {
      return res.status(400).json({ success: false, error: 'Employees array is required' });
    }

    if (!companyId) {
      return res.status(400).json({ success: false, error: 'Company ID is required' });
    }

    const results = { success: [], alreadyInvited: [], failed: [] };

    for (const emp of employees) {
      const emailLower = emp.email?.toLowerCase();
      if (!emailLower) {
        results.failed.push({ email: 'unknown', reason: 'Email is required' });
        continue;
      }

      try {
        const existingInvite = await InvitedEmployee.findOne({ email: emailLower });

        if (existingInvite) {
          if (existingInvite.status === 'revoked' || existingInvite.status === 'pending') {
            existingInvite.company = companyId;
            existingInvite.status = 'pending';
            existingInvite.name = emp.name;
            existingInvite.role = emp.role;
            existingInvite.department = emp.department;
            existingInvite.employmentType = emp.employmentType;
            existingInvite.salary = emp.salary;
            existingInvite.requiredDocuments = emp.requiredDocuments || [];
            existingInvite.invitedAt = new Date();
            if (invitedBy) existingInvite.invitedBy = invitedBy;
            await existingInvite.save();
            results.success.push(emailLower);
          } else {
            results.alreadyInvited.push(emailLower);
          }
        } else {
          await InvitedEmployee.create({
            ...emp,
            email: emailLower,
            company: companyId,
            invitedBy,
            requiredDocuments: emp.requiredDocuments || [],
            status: 'pending'
          });
          results.success.push(emailLower);
        }
      } catch (err) {
        results.failed.push({ email: emailLower, reason: err.message });
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `Processed ${employees.length} invitations`,
      results 
    });

  } catch (error) {
    console.error('Error in bulk invite:', error);
    res.status(500).json({ success: false, error: 'Failed to process bulk invite' });
  }
});


router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOne({ 
      email: email.toLowerCase()
    })
    .populate('company', 'name _id prefix')
    .populate('requiredDocuments');

    if (!invite) {
      return res.status(404).json({ success: false, error: 'Email not found in invitation list' });
    }

    if (invite.status === 'revoked') {
      return res.status(400).json({ success: false, error: 'Your invitation has been revoked.' });
    }

    // --- NEW LOGIC START ---
    // If status is onboarded, check if they finished the compliance/policy step
    if (invite.status === 'onboarded') {
      if (invite.policyStatus === 'accepted') {
        // Truly finished everything
        return res.status(200).json({ 
          success: false, 
          alreadyOnboarded: true,
          message: `Your account is already fully set up.`,
          companyName: invite.company?.name,
          name: invite.name
        });
      } else {
        // Profile exists, but policies are missing -> Go to Compliance
        return res.status(200).json({ 
          success: true, 
          needsComplianceOnly: true, // Flag for frontend
          data: {
            email: invite.email,
            company: invite.company,
            name: invite.name,
            role: invite.role,
            department: invite.department,
            employmentType: invite.employmentType,
            salary: invite.salary,
            requiredDocuments: invite.requiredDocuments
          }
        });
      }
    }
    // --- NEW LOGIC END ---

    // Default: New user needs to fill the whole onboarding form
    res.status(200).json({ 
      success: true, 
      data: {
        email: invite.email,
        company: invite.company,
        name: invite.name,
        role: invite.role,
        department: invite.department,
        employmentType: invite.employmentType,
        salary: invite.salary,
        requiredDocuments: invite.requiredDocuments,
        invitedAt: invite.invitedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify email' });
  }
});


// ✅ NEW ROUTE: Fetch full onboarding/compliance data for EmployeeProfile
// Used by EmployeeProfile.jsx to display Onboarding Compliance, Signature, and Company Docs
router.get('/profile-by-email', async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ success: false, error: 'Email query param is required' });

    const invite = await InvitedEmployee.findOne({
      email: email.toLowerCase().trim()
    })
    .populate('company', 'name _id prefix')
    .populate('requiredDocuments');

    if (!invite) {
      return res.status(404).json({ success: false, error: 'No invitation record found for this email' });
    }

    res.status(200).json({
      success: true,
      data: {
        email: invite.email,
        name: invite.name,
        role: invite.role,
        department: invite.department,
        employmentType: invite.employmentType,
        salary: invite.salary,
        company: invite.company,
        status: invite.status,
        // ✅ Compliance fields — these drive the Onboarding Compliance section
        onboardedAt: invite.onboardedAt,
        policyStatus: invite.policyStatus,
        policyAcceptedAt: invite.policyAcceptedAt,
        // ✅ Signature uploaded during compliance step
        signatureUrl: invite.signatureUrl,
        // ✅ Assigned required documents (templates)
        requiredDocuments: invite.requiredDocuments,
        invitedAt: invite.invitedAt,
      }
    });
  } catch (error) {
    console.error('Error fetching profile by email:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile data' });
  }
});


router.post('/mark-onboarded', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOneAndUpdate(
      { email: email.toLowerCase(), status: 'pending' },
      { status: 'onboarded', onboardedAt: new Date() },
      { new: true }
    );

    if (!invite) return res.status(404).json({ success: false, error: 'Invitation not found' });

    res.status(200).json({ success: true, message: 'Email marked as onboarded', data: invite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});


router.post('/revoke', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const invite = await InvitedEmployee.findOneAndUpdate(
      { email: email.toLowerCase() },
      { status: 'revoked' },
      { new: true }
    );

    if (!invite) return res.status(404).json({ success: false, error: 'Invitation not found' });

    res.status(200).json({ success: true, message: 'Invitation revoked successfully', data: invite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to revoke invitation' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const history = await InvitedEmployee.find()
      .populate('company', 'name')
      .sort({ invitedAt: -1 });
    res.status(200).json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});


router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const invitations = await InvitedEmployee.find({ company: companyId })
      .populate('company', 'name')
      .sort({ invitedAt: -1 });

    res.status(200).json({ success: true, data: invitations });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch invitations' });
  }
});


router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await InvitedEmployee.findByIdAndDelete(id);
    
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Invitation not found' });
    }

    res.status(200).json({ 
      success: true, 
      message: 'Invitation deleted permanently from database' 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete record' });
  }
});

router.post('/complete-onboarding', upload.single('signature'), async (req, res) => {
  // --- ADD THESE LOGS ---
  console.log("--- ONBOARDING ATTEMPT ---");
  console.log("Received Email:", req.body.email);
  console.log("File Received:", req.file ? "YES" : "NO");

  try {
    const { email } = req.body;
    
    // Normalize the email
    const searchEmail = email ? email.toLowerCase().trim() : "";

    // 1. First, just check if the employee exists at all without updating
    const checkUser = await InvitedEmployee.findOne({ email: searchEmail });
    console.log("Database Lookup Result:", checkUser ? "FOUND" : "NOT FOUND");

    if (!checkUser) {
      return res.status(404).json({ 
        success: false, 
        error: `Employee with email ${searchEmail} not found in database.` 
      });
    }

    // 2. Proceed with Cloudinary...
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    const cldRes = await cloudinary.uploader.upload(dataURI, { folder: "hrms_signatures" });

    // 3. Update
    checkUser.signatureUrl = cldRes.secure_url;
    checkUser.policyStatus = 'accepted';
    checkUser.policyAcceptedAt = new Date();
    checkUser.status = 'onboarded';
    checkUser.onboardedAt = checkUser.onboardedAt || new Date(); // preserve if already set
    await checkUser.save();

    res.status(200).json({ success: true, message: 'Onboarding completed successfully' });

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;