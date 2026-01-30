// --- START OF FILE routes/ProfilePicRoute.js ---
import dotenv from "dotenv";
dotenv.config();
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import ProfilePic from '../models/ProfilePicModel.js';
import { protect } from '../controllers/authController.js'; // Correct import path

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const employeeId = req.body.employeeId || req.user?.employeeId || 'unknown';
    return {
      folder: 'employee-profile-photos',
      allowed_formats: ['jpeg', 'png', 'jpg', 'gif', 'webp'],
      public_id: `profile-${employeeId}-${Date.now()}`,
    };
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(file.mimetype)) cb(null, true);
    else cb(new Error('Images only'));
  }
});

// GET ME
router.get('/me', protect, async (req, res) => {
  try {
    const employeeProfile = await ProfilePic.findOne({ employeeId: req.user.employeeId });
    if (!employeeProfile || !employeeProfile.profilePhoto) {
      return res.status(200).json({ profilePhoto: null });
    }
    res.status(200).json(employeeProfile);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET BY ID (Admin/Colleague logic)
router.get('/:employeeId', protect, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employeeProfile = await ProfilePic.findOne({ employeeId });
    if (!employeeProfile) return res.status(404).json({ message: 'Profile not found' });
    res.status(200).json(employeeProfile);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// UPLOAD PHOTO
router.put('/photo', protect, upload.single('image'), async (req, res) => {
  try {
    const { employeeId, name, email, phone } = req.body;
    // Inject Hierarchy
    const adminId = req.user.role === 'admin' ? req.user._id : req.user.adminId;
    const companyId = req.user.role === 'admin' ? null : req.user.company;

    if (!employeeId || !name || !email) return res.status(400).json({ message: 'Required fields missing' });
    if (!req.file) return res.status(400).json({ message: 'No image' });

    const newPhotoData = { public_id: req.file.filename, url: req.file.path };

    let profile = await ProfilePic.findOne({ employeeId });

    if (profile) {
      if (profile.profilePhoto.public_id) {
        try { await cloudinary.uploader.destroy(profile.profilePhoto.public_id); } catch (e) {}
      }
      profile.name = name;
      profile.email = email;
      profile.phone = phone || '';
      profile.profilePhoto = newPhotoData;
      const updatedProfile = await profile.save();
      return res.status(200).json({ success: true, profilePhoto: updatedProfile.profilePhoto });
    } else {
      const newProfile = await ProfilePic.create({
        adminId,
        companyId,
        employeeId,
        name,
        email,
        phone: phone || '',
        profilePhoto: newPhotoData,
      });
      return res.status(201).json({ success: true, profilePhoto: newProfile.profilePhoto });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE PHOTO
router.delete('/photo', protect, async (req, res) => {
  try {
    const profile = await ProfilePic.findOne({ employeeId: req.user.employeeId });
    if (!profile) return res.status(404).json({ message: 'No profile found' });

    if (profile.profilePhoto.public_id) {
      try { await cloudinary.uploader.destroy(profile.profilePhoto.public_id); } catch (e) {}
    }

    profile.profilePhoto = { public_id: '', url: '' };
    await profile.save();
    res.status(200).json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;