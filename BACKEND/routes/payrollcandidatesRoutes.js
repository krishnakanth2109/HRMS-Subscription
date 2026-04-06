import express from 'express';
import Candidate from '../models/Candidate.js';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

const router = express.Router();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'payroll_docs', allowed_formats: ['jpg', 'png', 'pdf', 'jpeg'] }
});

const upload = multer({ storage });


// ================= CONTROLLERS =================

// Save or Update Candidate
export const saveCandidate = async (req, res) => {
    try {
        const data = req.body;

        // Handle file uploads
        if (req.files?.profilePic) data.profilePic = req.files.profilePic[0].path;
        if (req.files?.panDoc) data.panDoc = req.files.panDoc[0].path;
        if (req.files?.aadhaarDoc) data.aadhaarDoc = req.files.aadhaarDoc[0].path;

        // Calculate net salary if salary fields exist
        if (data.agreedSalary || data.pfDeduction || data.ptDeduction || data.otherDeductions) {
            const agreedSalary = parseFloat(data.agreedSalary) || 0;
            const pfDeduction = parseFloat(data.pfDeduction) || 0;
            const ptDeduction = parseFloat(data.ptDeduction) || 0;
            const otherDeductions = parseFloat(data.otherDeductions) || 0;
            
            const totalDeductions = pfDeduction + ptDeduction + otherDeductions;
            data.netSalary = agreedSalary - totalDeductions;
        }

        let result;

        if (req.params.id) {
            result = await Candidate.findByIdAndUpdate(req.params.id, data, { new: true });
        } else {
            result = new Candidate(data);
            await result.save();
        }

        res.status(200).json(result);

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Get All Candidates
export const getAll = async (req, res) => {
    try {
        const list = await Candidate.find().sort({ createdAt: -1 });
        res.json(list);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Delete Candidate
export const remove = async (req, res) => {
    try {
        await Candidate.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// ================= ROUTES =================

router.post(
    '/manage',
    upload.fields([
        { name: 'profilePic', maxCount: 1 },
        { name: 'panDoc', maxCount: 1 },
        { name: 'aadhaarDoc', maxCount: 1 }
    ]),
    saveCandidate
);

router.post(
    '/manage/:id',
    upload.fields([
        { name: 'profilePic', maxCount: 1 },
        { name: 'panDoc', maxCount: 1 },
        { name: 'aadhaarDoc', maxCount: 1 }
    ]),
    saveCandidate
);

router.get('/all', getAll);
router.delete('/:id', remove);

export default router;