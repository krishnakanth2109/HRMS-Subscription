import express from "express";
import LiveTracking from "../models/LiveTrackingModel.js"; // Adjust path if needed

const router = express.Router();

// ------------------------------------------
// POST /live-status 
// (Live Telemetry Heartbeat from Python Desktop App)
// ------------------------------------------
router.post('/live-status', async (req, res) => {
  try {
    const { employeeId, status, timestamp, total_work_seconds, total_idle_seconds } = req.body;
    
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

      if (total_work_seconds !== undefined) todayData.trackedWorkSeconds = total_work_seconds;
      if (total_idle_seconds !== undefined) todayData.trackedIdleSeconds = total_idle_seconds;

      // Clear screenshot when employee resumes WORKING
      if (status === "WORKING" || status === "OFFLINE") {
        todayData.currentIdleScreenshot = null;
        todayData.screenshotCapturedAt = null;
      }

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
    const { employeeId, screenshotUrl, capturedAt } = req.body;
    if (!employeeId || !screenshotUrl) {
      return res.status(400).json({ message: "Missing employeeId or screenshotUrl" });
    }

    const date = new Date().toISOString().split('T')[0];
    const capturedDate = capturedAt ? new Date(capturedAt * 1000) : new Date();

    let doc = await LiveTracking.findOne({ employeeId });
    if (!doc) {
      return res.status(404).json({ message: "Employee tracking record not found" });
    }

    if (!doc.dates.has(date)) {
      doc.dates.set(date, { idleTimeline: [], currentIdleScreenshot: screenshotUrl, screenshotCapturedAt: capturedDate });
    } else {
      const todayData = doc.dates.get(date);
      todayData.currentIdleScreenshot = screenshotUrl;
      todayData.screenshotCapturedAt = capturedDate;

      // Also attach to the most recent open idle segment (if any, and doesn't have one yet)
      if (todayData.idleTimeline && todayData.idleTimeline.length > 0) {
        const last = todayData.idleTimeline[todayData.idleTimeline.length - 1];
        if (!last.screenshotUrl) {
          last.screenshotUrl = screenshotUrl;
        }
      }

      doc.dates.set(date, todayData);
    }

    await doc.save();
    console.log(`📸 [Live Screenshot] Stored for ${employeeId}: ${screenshotUrl}`);
    return res.json({ message: "Screenshot stored live" });
  } catch (err) {
    console.error("❌ Live screenshot error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
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
    const { employeeId, date, idleStart, idleEnd, idleDurationSeconds, screenshotUrl } = req.body;

    if (!employeeId || !idleStart || !idleEnd || !date) {
      return res.status(400).json({ message: "Missing required values" });
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
      screenshotUrl: screenshotUrl || null
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
      console.log(`✅ [Idle Time] Saved ${idleDurationSeconds}s idle session. Screenshot: ${screenshotUrl ? 'YES' : 'none'}`);
    } else {
      console.log(`⚠️ [Idle Time] Ignored duplicate idle session.`);
    }

    return res.json({ message: "Idle session saved successfully" });
  } catch (err) {
    console.error("❌ Idle time save error:", err);
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
    const doc = await LiveTracking.findOne({
      employeeId: { $regex: new RegExp(`^${employeeId}$`, "i") }
    });

    if (!doc || !doc.dates) {
      return res.json([]);
    }

    const screenshots = [];
    for (const [dateStr, dailyData] of doc.dates.entries()) {
      const timeline = dailyData.idleTimeline || [];
      timeline.forEach((seg) => {
        if (seg.screenshotUrl) {
          screenshots.push({
            date: dateStr,
            idleStart: seg.startTime,
            idleEnd: seg.endTime,
            idleDurationSeconds: seg.idleDurationSeconds,
            screenshotUrl: seg.screenshotUrl
          });
        }
      });
    }

    // Sort newest first
    screenshots.sort((a, b) => new Date(b.idleStart) - new Date(a.idleStart));
    return res.json(screenshots);
  } catch (err) {
    console.error("❌ Get screenshots error:", err);
    return res.status(500).json({ message: "Server error" });
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

export default router;