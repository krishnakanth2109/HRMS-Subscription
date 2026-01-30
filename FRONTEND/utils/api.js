// --- START OF FILE api.js ---

import axios from "axios";

// Automatically determine API base URL depending on environment
const baseURL =
  import.meta.env.MODE === "production"
    ? import.meta.env.VITE_API_URL_PRODUCTION
    : import.meta.env.VITE_API_URL_DEVELOPMENT || "http://localhost:5000";

// Create a single, consistent Axios instance
const api = axios.create({
  baseURL,
  timeout: 500000, 
  headers: { "Content-Type": "application/json" },
});

/* =============================================================================
   REQUEST INTERCEPTOR
============================================================================= */

// ... (Keep existing exports) ...
export default api;