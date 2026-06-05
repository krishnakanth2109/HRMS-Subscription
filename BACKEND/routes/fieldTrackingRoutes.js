import express from "express";
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
} from "../controllers/fieldTrackingController.js";

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

export default router;
