import express from 'express';
const router = express.Router();

router.get('/version', (req, res) => {
    // When you release a new version (e.g., 2.4), update these values
    // and push to Render.
    res.json({
        latest_version: ""2.3"",
        download_url: ""https://your-hosting-link.com/VW_Sync_Tracker_Setup.exe""
    });
});

export default router;
