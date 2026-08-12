import axios from "axios";

/**
 * Reverse geocode coordinates to get address using LocationIQ API
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Address string
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.error("Google Maps API key not found in environment variables");
      return "Address unavailable (API key missing)";
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    const response = await axios.get(url);
    
    if (response.data?.status === "OK" && response.data.results?.[0]) {
      return response.data.results[0].formatted_address;
    }
    
    return "Address not found";
  } catch (error) {
    console.error("Reverse geocoding error:", error.message);
    if (error.response) {
      console.error("Google Geocoding API error:", error.response.data);
      return `Address lookup failed: ${error.response.data.error_message || 'Unknown error'}`;
    }
    return "Address lookup failed";
  }
};

/**
 * Validate coordinates
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {boolean}
 */
export const validateCoordinates = (latitude, longitude) => {
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
};