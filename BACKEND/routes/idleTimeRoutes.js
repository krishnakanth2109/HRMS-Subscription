import express from "express";
import LiveTracking from "../models/LiveTrackingModel.js"; 
import { cloudinary } from "../config/cloudinary.js";
import Employee from "../models/employeeModel.js";

const router = express.Router();
import OfficeSettings from "../models/OfficeSettings.js";

// ------------------------------------------
// GET /settings/tracker
// (Fetch tracker settings like screenshot interval)
// ------------------------------------------
router.get("/settings/tracker", async (req, res) => {
  try {
    const settings = await OfficeSettings.findOne({ type: "Global" }).sort({ updatedAt: -1 });
    return res.json({ screenshotIntervalMinutes: settings?.screenshotIntervalMinutes || 60 });
  } catch (err) {
    console.error("Fetch tracker settings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// PUT /settings/tracker
// (Update tracker settings)
// ------------------------------------------
router.put("/settings/tracker", async (req, res) => {
  try {
    const { screenshotIntervalMinutes } = req.body;
    let settings = await OfficeSettings.findOne({ type: "Global" }).sort({ updatedAt: -1 });
    if (!settings) {
      return res.status(404).json({
        message: "Office settings not found. Configure office settings before saving tracker settings.",
      });
    }
    settings.screenshotIntervalMinutes = Math.max(1, Number(screenshotIntervalMinutes) || 60);
    await settings.save();
    return res.json({ message: "Settings updated successfully", screenshotIntervalMinutes: settings.screenshotIntervalMinutes });
  } catch (err) {
    console.error("Update tracker settings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// Helper to upload base64 to Cloudinary
const uploadBase64ToCloudinary = async (base64Data, folder = "idle_screenshots") => {
  try {
    const uploadResult = await cloudinary.uploader.upload(base64Data, {
      folder: folder,
      resource_type: "image",
    });
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Cloudinary Upload Error:", error);
    return null;
  }
};

// ------------------------------------------
// POST /live-status 
// (Live Telemetry Heartbeat from Python Desktop App)
// ------------------------------------------
router.post('/live-status', async (req, res) => {
  try {
    const { employeeId, status, timestamp, total_work_seconds, total_idle_seconds } = req.body;
    // Idle screenshots removed — only working screenshots are captured
    
    // Ensure date is consistent (YYYY-MM-DD)
    const date = new Date().toISOString().split('T')[0];
    
    // Python sends timestamp in seconds, JS needs milliseconds
    const pingTime = new Date(timestamp * 1000);
    const idleSinceTime = req.body.idle_since ? new Date(req.body.idle_since * 1000) : null;

    let doc = await LiveTracking.findOne({ employeeId: employeeId });
    if (!doc) {
      doc = new LiveTracking({ employeeId: employeeId, dates: {} });
    }

    if (!doc.dates.has(date)) {
      // Initialize today's date structure
      doc.dates.set(date, {
        currentStatus: status,
        lastPing: pingTime,
        idleSince: idleSinceTime,
        activeWindow: req.body.activeWindow || null,
        idleTimeline: [],
        trackedWorkSeconds: total_work_seconds || 0,
        trackedIdleSeconds: total_idle_seconds || 0,
        currentIdleScreenshot: null,
        screenshotCapturedAt: null
      });
    } else {
      // Update existing date's data
      const todayData = doc.dates.get(date);
      todayData.currentStatus = status;
      todayData.lastPing = pingTime;
      todayData.idleSince = idleSinceTime;
      todayData.activeWindow = req.body.activeWindow || null;
      
      if (total_work_seconds !== undefined) todayData.trackedWorkSeconds = total_work_seconds;
      if (total_idle_seconds !== undefined) todayData.trackedIdleSeconds = total_idle_seconds;

      // Crucial: Set it back into the Map to trigger Mongoose save
      doc.dates.set(date, todayData);
    }

    await doc.save();
    res.status(200).json({ message: "Live Telemetry Updated" });
  } catch (error) {
    console.error("Live Status Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ------------------------------------------
// GET /live-status
// (Fetches flat array of today's statuses for Admin Dashboard)
// ------------------------------------------
router.get('/live-status', async (req, res) => {
  try {
    const date = new Date().toISOString().split('T')[0];
    const allDocs = await LiveTracking.find({});

    const liveArray = [];
    allDocs.forEach((doc) => {
      if (doc.dates && doc.dates.has(date)) {
        const todayData = doc.dates.get(date);
        liveArray.push({
          _id: `${doc._id}_${date}`,
          employeeId: doc.employeeId,
          date: date,
          currentStatus: todayData.currentStatus,
          lastPing: todayData.lastPing,
          idleSince: todayData.idleSince,
          activeWindow: todayData.activeWindow || null,
          idleTimeline: todayData.idleTimeline || [],
          trackedWorkSeconds: todayData.trackedWorkSeconds || 0,
          trackedIdleSeconds: todayData.trackedIdleSeconds || 0,
          currentIdleScreenshot: todayData.currentIdleScreenshot || null,
          screenshotCapturedAt: todayData.screenshotCapturedAt || null
        });
      }
    });

    res.status(200).json(liveArray);
  } catch (error) {
    console.error("Fetch Live Status Error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

// ------------------------------------------
// POST /live-screenshot
// (Receives screenshot URL immediately from tracker — before session ends)
// ------------------------------------------
router.post('/live-screenshot', async (req, res) => {
  try {
    const { employeeId, screenshot, capturedAt, type } = req.body;
    if (!employeeId || !screenshot) {
      return res.status(400).json({ message: "Missing employeeId or screenshot" });
    }

    const date = new Date().toISOString().split('T')[0];
    const capturedDate = capturedAt ? new Date(capturedAt * 1000) : new Date();

    let screenshotUrl = null;
    if (typeof screenshot === 'string' && screenshot.startsWith('http')) {
      screenshotUrl = screenshot;
    } else {
      console.log(`📸 [Live Screenshot] Uploading base64 for ${employeeId}...`);
      screenshotUrl = await uploadBase64ToCloudinary(screenshot);
    }

    let doc = await LiveTracking.findOne({ employeeId });
    if (!doc) {
      doc = new LiveTracking({ employeeId, dates: {} });
    }

    if (!doc.dates.has(date)) {
      const newDateData = { 
        idleTimeline: [], 
        workingScreenshots: [{ screenshotUrl, capturedAt: capturedDate }],
        currentIdleScreenshot: null, 
        screenshotCapturedAt: null 
      };
      doc.dates.set(date, newDateData);
    } else {
      const todayData = doc.dates.get(date);
      if (!todayData.workingScreenshots) todayData.workingScreenshots = [];
      todayData.workingScreenshots.push({ screenshotUrl, capturedAt: capturedDate });
      doc.dates.set(date, todayData);
    }

    await doc.save();
    console.log(`✅ [Live Screenshot] Stored for ${employeeId}: ${screenshotUrl}`);
    return res.json({ message: "Screenshot stored live", screenshotUrl });
  } catch (err) {
    console.error("❌ Live screenshot error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------------------
// GET /screenshots/:employeeId
// Returns all idle sessions that have a screenshot URL for an employee
// ------------------------------------------
router.get("/screenshots/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { date } = req.query; // Optional: ?date=YYYY-MM-DD to filter by specific date
    const doc = await LiveTracking.findOne({
      employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") }
    });

    if (!doc || !doc.dates) {
      return res.json([]);
    }

    const screenshots = [];
    for (const [dateStr, dailyData] of doc.dates.entries()) {
      // If a date filter is provided, skip non-matching dates
      if (date && dateStr !== date) continue;

      const timeline = dailyData.idleTimeline || [];
      timeline.forEach((seg) => {
        if (seg.screenshotUrl) {
          screenshots.push({
            date: dateStr,
            type: 'IDLE',
            idleStart: seg.startTime,
            idleEnd: seg.endTime,
            idleDurationSeconds: seg.idleDurationSeconds,
            screenshotUrl: seg.screenshotUrl,
            capturedAt: seg.startTime
          });
        }
      });

      const working = dailyData.workingScreenshots || [];
      working.forEach((seg) => {
        if (seg.screenshotUrl) {
          screenshots.push({
            date: dateStr,
            type: 'WORKING',
            screenshotUrl: seg.screenshotUrl,
            capturedAt: seg.capturedAt
          });
        }
      });
    }

    // Sort newest first
    screenshots.sort((a, b) => new Date(b.capturedAt) - new Date(a.capturedAt));
    return res.json(screenshots);
  } catch (err) {
    console.error("❌ Get screenshots error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});


// ------------------------------------------
// POST /
// (Saves a COMPLETED Idle Session when user resumes work)
// Python Payload maps `idleStart` -> `startTime`, `idleEnd` -> `endTime`
// ------------------------------------------
router.post("/", async (req, res) => {
  console.log("📥 [Idle Time] Received completed session for:", req.body.employeeId);
  try {
    const { employeeId, date, idleStart, idleEnd, idleDurationSeconds } = req.body;
    const screenshot = req.body.screenshot || req.body.image || req.body.screenshot_url;

    if (!employeeId || !idleStart || !idleEnd || !date) {
      console.warn("⚠️ [Idle Time] Missing required fields:", { employeeId, date, idleStart, idleEnd });
      return res.status(400).json({ message: "Missing required values" });
    }

    let screenshotUrl = null;
    if (screenshot) {
      if (typeof screenshot === 'string' && screenshot.startsWith('http')) {
        console.log(`🔗 [Idle Time] Using existing URL for ${employeeId}:`, screenshot);
        screenshotUrl = screenshot;
      } else {
        console.log(`📸 [Idle Time] Uploading base64 screenshot for ${employeeId}...`);
        screenshotUrl = await uploadBase64ToCloudinary(screenshot);
      }
    } else {
      console.log(`ℹ️ [Idle Time] No screenshot provided for ${employeeId} session`);
    }

    let doc = await LiveTracking.findOne({ employeeId });
    if (!doc) {
      doc = new LiveTracking({ employeeId, dates: {} });
    }

    if (!doc.dates.has(date)) {
      doc.dates.set(date, { idleTimeline: [] });
    }

    const todayData = doc.dates.get(date);
    
    // Create new segment (Python sends milliseconds, which `new Date()` accepts perfectly)
    const newSegment = {
      startTime: new Date(idleStart),
      endTime: new Date(idleEnd),
      idleDurationSeconds: Number(idleDurationSeconds),
      screenshotUrl: screenshotUrl
    };

    // Prevent duplicate entries (if python script retries due to poor network)
    const isDuplicate = todayData.idleTimeline.some(
      (seg) => seg.startTime.getTime() === newSegment.startTime.getTime() &&
               seg.endTime.getTime() === newSegment.endTime.getTime()
    );

    if (!isDuplicate) {
      todayData.idleTimeline.push(newSegment);
      doc.dates.set(date, todayData);
      await doc.save();
      console.log(`✅ [Idle Time] Saved ${idleDurationSeconds}s idle session ${screenshotUrl ? "with screenshot" : ""} to DB`);
    } else {
      console.log(`⚠️ [Idle Time] Ignored duplicate idle session.`);
    }

    return res.json({ message: "Idle session saved successfully", screenshotUrl });
  } catch (err) {
    console.error("❌ Idle time save error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ------------------------------------------
// GET /:employeeId/:date
// (Fetch specific employee's timeline for a specific date)
// ------------------------------------------
router.get("/:employeeId/:date", async (req, res) => {
  const { employeeId, date } = req.params;

  try {
    const doc = await LiveTracking.findOne({ employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") } });

    if (doc && doc.dates && doc.dates.has(date)) {
      const todayData = doc.dates.get(date);
      const record = {
        employeeId: doc.employeeId,
        date: date,
        currentStatus: todayData.currentStatus,
        lastPing: todayData.lastPing,
        idleSince: todayData.idleSince,
        idleTimeline: todayData.idleTimeline || [],
        trackedWorkSeconds: todayData.trackedWorkSeconds || 0,
        trackedIdleSeconds: todayData.trackedIdleSeconds || 0
      };
      return res.json(record);
    }

    return res.json({ employeeId, date, idleTimeline: [] });
  } catch (err) {
    console.error("❌ Get idle time error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// GET /employee/:employeeId
// (Fetch all historical dates for an employee)
// ------------------------------------------
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const doc = await LiveTracking.findOne({
      employeeId: { $regex: new RegExp(`^${req.params.employeeId}$`, "i") }
    });

    const rows = [];
    if (doc && doc.dates) {
      for (const [dateStr, dailyData] of doc.dates.entries()) {
        rows.push({
          employeeId: doc.employeeId,
          date: dateStr,
          currentStatus: dailyData.currentStatus,
          lastPing: dailyData.lastPing,
          idleSince: dailyData.idleSince,
          idleTimeline: dailyData.idleTimeline || [],
          trackedWorkSeconds: dailyData.trackedWorkSeconds || 0,
          trackedIdleSeconds: dailyData.trackedIdleSeconds || 0
        });
      }
    }

    // Sort descending by date (newest first)
    rows.sort((a, b) => new Date(b.date) - new Date(a.date));

    return res.json(rows);
  } catch (err) {
    console.error("❌ Get employee history error:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

// ------------------------------------------
// GET /admin/stats
// (Admin route to fetch stats filtered by Company and/or Employee)
// ------------------------------------------
router.get("/admin/stats", async (req, res) => {
  try {
    const { companyId, employeeId, date } = req.query;
    let employeeIds = [];

    if (employeeId) {
      // If specific employee is requested, just use that
      employeeIds = [employeeId];
    } else if (companyId) {
      // If company is requested, find all employees in that company
      const employees = await Employee.find({ company: companyId }).select("employeeId");
      employeeIds = employees.map(emp => emp.employeeId);
    } else {
      // If neither, we might want to return all (or restrict if needed)
      // For now, let's allow fetching all if no filters provided (not recommended for large datasets)
      const allTracking = await LiveTracking.find({}).select("employeeId");
      employeeIds = allTracking.map(t => t.employeeId);
    }

    const query = { employeeId: { $in: employeeIds } };
    const trackingDocs = await LiveTracking.find(query);

    const results = [];
    trackingDocs.forEach(doc => {
      if (date) {
        // Filter for specific date
        if (doc.dates && doc.dates.has(date)) {
          const dailyData = doc.dates.get(date);
          results.push({
            employeeId: doc.employeeId,
            date: date,
            ...dailyData.toObject()
          });
        }
      } else {
        // Return all dates for these employees
        for (const [dateStr, dailyData] of doc.dates.entries()) {
          results.push({
            employeeId: doc.employeeId,
            date: dateStr,
            ...dailyData.toObject()
          });
        }
      }
    });

    // Sort by date descending
    results.sort((a, b) => new Date(b.date) - new Date(a.date));

    res.status(200).json(results);
  } catch (error) {
    console.error("❌ Admin stats error:", error);
    res.status(500).json({ error: "Server Error" });
  }
});

export default router;
