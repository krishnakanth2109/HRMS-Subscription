import dotenv from "dotenv";
dotenv.config();
import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import ProfilePic from '../models/ProfilePicModel.js';
import { protect } from '../middleware/authMiddleware.js';
const router = express.Router();

// Cloudinary Configuration (loads from .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer Storage Configuration for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const employeeId = req.body.employeeId || req.user?.employeeId || 'unknown';
    return {
      folder: 'employee-profile-photos',
      allowed_formats: ['jpeg', 'png', 'jpg', 'gif', 'webp'],
      public_id: `profile-${employeeId}-${Date.now()}`,
      transformation: [
        { 
          width: 500, 
          height: 500, 
          crop: 'fill', 
          gravity: 'face',
          quality: 'auto:good'
        }
      ],
    };
  },
});

// File filter for validation
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(file.originalname.toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed!'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

/**
 * @route   GET /api/profile/me
 * @desc    Get the profile picture for the currently logged-in user
 * @access  Private
 */
router.get('/me', protect, async (req, res) => {
  try {
    const employeeProfile = await ProfilePic.findOne({ 
      employeeId: req.user.employeeId 
    });

    if (!employeeProfile || !employeeProfile.profilePhoto) {
      return res.status(200).json({
        message: 'No profile photo found',
        profilePhoto: null,
      });
    }

    res.status(200).json({
      profilePhoto: employeeProfile.profilePhoto,
      name: employeeProfile.name,
      email: employeeProfile.email,
      phone: employeeProfile.phone,
    });
  } catch (error) {
    console.error('Error fetching profile photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching photo.',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/profile/:employeeId
 * @desc    Get profile picture by employee ID (Admin access)
 * @access  Private
 */
router.get('/:employeeId', protect, async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employeeProfile = await ProfilePic.findOne({ employeeId });

    if (!employeeProfile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found for this employee',
      });
    }

    res.status(200).json({
      success: true,
      profilePhoto: employeeProfile.profilePhoto,
      name: employeeProfile.name,
      email: employeeProfile.email,
      phone: employeeProfile.phone,
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching profile.',
      error: error.message 
    });
  }
});

/**
 * @route   PUT /api/profile/photo
 * @desc    Upload or update employee profile photo
 * @access  Private
 */
router.put('/photo', protect, upload.single('image'), async (req, res) => {
  try {
    const { employeeId, name, email, phone } = req.body;

    // Validate required fields
    if (!employeeId || !name || !email) {
      return res.status(400).json({ 
        success: false,
        message: 'Employee ID, name, and email are required.',
        received: { employeeId, name, email }
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'No image file uploaded.' 
      });
    }

    const newPhotoData = {
      public_id: req.file.filename,
      url: req.file.path,
    };

    let profile = await ProfilePic.findOne({ employeeId });

    if (profile) {
      // Delete old image from Cloudinary if it exists
      if (profile.profilePhoto && profile.profilePhoto.public_id) {
        try {
          await cloudinary.uploader.destroy(profile.profilePhoto.public_id);
        } catch (deleteError) {
          console.error('Error deleting old image:', deleteError);
        }
      }

      // Update existing profile
      profile.name = name;
      profile.email = email;
      profile.phone = phone || '';
      profile.profilePhoto = newPhotoData;
      
      const updatedProfile = await profile.save();
      
      return res.status(200).json({
        success: true,
        message: 'Profile photo updated successfully!',
        profilePhoto: updatedProfile.profilePhoto,
      });

    } else {
      // Create new profile
      const newProfile = await ProfilePic.create({
        employeeId,
        name,
        email,
        phone: phone || '',
        profilePhoto: newPhotoData,
      });
      
      return res.status(201).json({
        success: true,
        message: 'Profile photo uploaded successfully!',
        profilePhoto: newProfile.profilePhoto,
      });
    }

  } catch (error) {
    console.error('Error in profile photo upload route:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A profile with this information already exists.',
        error: error.message
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages,
      });
    }

    // Handle multer errors
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({ 
      success: false,
      message: 'A server error occurred while updating the photo.',
      error: error.message 
    });
  }
});

/**
 * @route   DELETE /api/profile/photo
 * @desc    Delete employee profile photo
 * @access  Private
 */
router.delete('/photo', protect, async (req, res) => {
  try {
    const employeeId = req.user.employeeId;

    const profile = await ProfilePic.findOne({ employeeId });

    if (!profile || !profile.profilePhoto) {
      return res.status(404).json({
        success: false,
        message: 'No profile photo found to delete',
      });
    }

    // Delete from Cloudinary
    if (profile.profilePhoto.public_id) {
      try {
        await cloudinary.uploader.destroy(profile.profilePhoto.public_id);
      } catch (deleteError) {
        console.error('Error deleting from Cloudinary:', deleteError);
      }
    }

    // Remove photo data from database
    profile.profilePhoto = { public_id: '', url: '' };
    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Profile photo deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting profile photo:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while deleting photo.',
      error: error.message 
    });
  }
});

/**
 * @route   GET /api/profile/all/profiles
 * @desc    Get all employee profiles (Admin only)
 * @access  Private/Admin
 */
router.get('/all/profiles', protect, async (req, res) => {
  try {
    const profiles = await ProfilePic.find({}).select('-__v');

    res.status(200).json({
      success: true,
      count: profiles.length,
      profiles,
    });
  } catch (error) {
    console.error('Error fetching all profiles:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching profiles.',
      error: error.message 
    });
  }
});

export default router;