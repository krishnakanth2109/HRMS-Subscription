import QRCode from 'qrcode';
import { cloudinary } from '../config/cloudinary.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generates a QR Code for an employee's public portfolio and uploads it to Cloudinary.
 * 
 * @param {Object} employee - The employee document (must contain `employeeId`).
 * @param {String} tenantId - The tenant (company) ID to scope the Cloudinary folder.
 * @returns {Promise<String|null>} - The secure URL of the uploaded QR Code, or null if failed.
 */
export const generateAndUploadQRCode = async (employee, tenantId) => {
  try {
    if (!employee || !employee.employeeId) {
      console.warn("generateAndUploadQRCode: Missing employee or employeeId.");
      return null;
    }

    if (!tenantId) {
      console.warn("generateAndUploadQRCode: Missing tenantId (company ID).");
      return null;
    }

    // Construct the stable portfolio URL
    // Using employee.employeeId (e.g. PRE-001) as per frontend route logic
    const baseUrl = process.env.CLIENT_URL || "https://vwsync.com" ;
    const portfolioUrl = `${baseUrl}/portfolio/${employee.employeeId}`;

    // Generate QR Code as Base64 Data URI (High Error Correction Level)
    const qrDataURI = await QRCode.toDataURL(portfolioUrl, { errorCorrectionLevel: 'H' });

    // Upload to Cloudinary under tenant-scoped folder
    const uploadResult = await cloudinary.uploader.upload(qrDataURI, {
      folder: `tenants/${tenantId}/employee-qr`,
      public_id: employee.employeeId, // Use immutable employeeId as the filename
      resource_type: "image",
      overwrite: true,
    });

    return uploadResult.secure_url;
  } catch (error) {
    console.error("❌ Error generating/uploading QR code for employee:", employee?.employeeId, error);
    return null;
  }
};
