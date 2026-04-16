import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import Rule from '../models/Rule.js';
import { protect } from '../middleware/protect.js';

const router = express.Router();

// 1. Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. UPDATED STORAGE CONFIGURATION
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'company_rules',
    // CHANGED: Restrict to image formats only (removed PDF logic)
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    // Optional: Transformation to resize images if they are too huge
    // transformation: [{ width: 1000, crop: "limit" }]
  },
});

// CHANGED: Use 'array' instead of 'single'. 
// 'images' must match the formData.append('images', ...) in frontend.
// 10 is the max number of files allowed per upload.
const upload = multer({ storage });

// 3. POST Route
router.post('/', protect, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.body.title) return res.status(400).json({ error: "Title is required" });
    if (!req.body.description) return res.status(400).json({ error: "Description is required" });

    const { title, description, category } = req.body;
    const adminId = req.body.adminId || req.user?._id;
    const companyId = req.body.companyId || req.user?.companyId;

    // CHANGED: Handle Multiple Files
    let imageArray = [];

    // req.files contains the array of files from Cloudinary
    if (req.files && req.files.length > 0) {
      imageArray = req.files.map((file) => ({
        url: file.path,       // Cloudinary URL
        publicId: file.filename // Cloudinary Public ID
      }));
    }

    const newRule = new Rule({
      title,
      description,
      category,
      images: imageArray,
      adminId,
      companyId,
    });

    const savedRule = await newRule.save();
    res.status(201).json(savedRule);

  } catch (err) {
    console.error("❌ ROUTE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. GET Route
router.get('/', async (req, res) => {
  try {
    const rules = await Rule.find().sort({ createdAt: -1 });
    
    // Transform data for frontend convenience (optional)
    // This ensures the frontend gets a clean array of URLs
    const formattedRules = rules.map(rule => ({
      ...rule._doc,
      // Map the object array to a simple URL array for easier frontend display
      // If using the frontend code I gave you, it expects rule.images to be an array of strings (URLs)
      images: rule.images ? rule.images.map(img => img.url) : [],
      // Keep backward compatibility for old single files
      fileUrl: rule.fileUrl || null 
    }));

    res.status(200).json(formattedRules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. DELETE Route
router.delete('/:id', async (req, res) => {
  try {
    // 1. Find the rule first to get image IDs
    const rule = await Rule.findById(req.params.id);
    if (!rule) return res.status(404).json({ msg: "Rule not found" });

    // 2. (Optional but recommended) Delete images from Cloudinary
    if (rule.images && rule.images.length > 0) {
      const deletePromises = rule.images.map(img => 
        cloudinary.uploader.destroy(img.publicId)
      );
      await Promise.all(deletePromises);
    }

    // 3. Delete from Database
    await Rule.findByIdAndDelete(req.params.id);
    
    res.json({ msg: "Rule and associated images deleted successfully" });
  } catch (err) {
    console.error("Delete Error", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;