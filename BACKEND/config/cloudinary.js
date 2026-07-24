// --- START OF FILE config/cloudinary.js ---
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "employee_docs", // Folder name in Cloudinary
    allowed_formats: ["jpg", "jpeg", "png", "pdf"],
    resource_type: "auto",
    type: "upload", // Ensure files are public
  },
});

const upload = multer({ storage: storage });

export { upload, cloudinary };
// --- END OF FILE config/cloudinary.js ---