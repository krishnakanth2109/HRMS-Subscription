import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { protect } from "../controllers/authController.js";
import {
  getEmployeeTripsByDate,
  getFieldTrackingSetting,
  getMyActiveTrip,
  getMyTripsByDate,
  getRecentFieldTrips,
  listTrackingEmployees,
  postFieldWorkLocation,
  startFieldWorkTrip,
  stopFieldWorkTrip,
  updateFieldTrackingSetting,
  uploadBreakPhoto,
} from "../controllers/fieldTrackingController.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure Multer Storage for Break Photos
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const employeeId = req.user?.employeeId || req.user?._id || "unknown";
    return {
      folder: "field-break-photos",
      allowed_formats: ["jpeg", "png", "jpg", "gif", "webp"],
      public_id: `break-${employeeId}-${Date.now()}`,
    };
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    if (allowedTypes.test(file.mimetype)) cb(null, true);
    else cb(new Error("Images only"));
  },
});

const router = express.Router();

router.use(protect);

router.get("/setting", getFieldTrackingSetting);
router.put("/admin/setting", updateFieldTrackingSetting);
router.get("/admin/employees", listTrackingEmployees);
router.get("/admin/recent-trips", getRecentFieldTrips);
router.get("/admin/employees/:employeeId/trips", getEmployeeTripsByDate);

router.get("/employee/active-trip", getMyActiveTrip);
router.get("/employee/trips", getMyTripsByDate);
router.post("/employee/trips/start", startFieldWorkTrip);
router.post("/employee/trips/:tripId/location", postFieldWorkLocation);
router.post("/employee/location", postFieldWorkLocation);
router.post("/employee/trips/:tripId/stop", stopFieldWorkTrip);
router.post("/employee/trips/:tripId/break-photo", upload.single("image"), uploadBreakPhoto);

export default router;
