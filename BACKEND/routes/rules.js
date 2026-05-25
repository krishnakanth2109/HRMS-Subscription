import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { v4 as uuidv4 } from 'uuid';
import Rule from '../models/Rule.js';
import { protect } from '../middleware/protect.js';

const router = express.Router();

// 1. Config Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 2. Memory Storage for Multipurpose File Uploads (Images, PDFs, PPTs)
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// 3. POST Route
router.post('/', protect, upload.array('images', 10), async (req, res) => {
  try {
    if (!req.body.title) return res.status(400).json({ error: "Title is required" });
    if (!req.body.description) return res.status(400).json({ error: "Description is required" });

    const { title, description, category } = req.body;
    const adminId = req.body.adminId || req.user?._id;
    const companyId = req.body.companyId || req.user?.companyId;

    let imageArray = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const b64 = Buffer.from(file.buffer).toString('base64');
        const dataURI = `data:${file.mimetype};base64,${b64}`;
        
        const originalName = file.originalname || '';
        const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
        const isPdf = file.mimetype === 'application/pdf' || ext.toLowerCase() === '.pdf';
        const isPpt = file.mimetype.includes('powerpoint') || 
                      file.mimetype.includes('presentation') || 
                      ext.toLowerCase() === '.ppt' || 
                      ext.toLowerCase() === '.pptx';
                      
        const isRaw = isPdf || isPpt;
        
        const cldRes = await cloudinary.uploader.upload(dataURI, {
          folder: 'company_rules',
          resource_type: isRaw ? 'raw' : 'image',
          public_id: isRaw ? `${uuidv4()}${ext}` : undefined,
        });

        imageArray.push({
          url: cldRes.secure_url,
          publicId: cldRes.public_id
        });
      }
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