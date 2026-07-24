import axios from "axios";

/**
 * Reverse geocode coordinates to get address using LocationIQ API
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<string>} Address string
 */
export const reverseGeocode = async (latitude, longitude) => {
  try {
    const apiKey = process.env.LOCATIONIQ_API_KEY;
    
    if (!apiKey) {
      console.error("LocationIQ API key not found in environment variables");
      return "Address unavailable (API key missing)";
    }

    const url = `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${latitude}&lon=${longitude}&format=json`;
    
    const response = await axios.get(url);
    
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
    
    return "Address not found";
  } catch (error) {
    console.error("Reverse geocoding error:", error.message);
    
    if (error.response) {
      // LocationIQ API returned an error
      console.error("LocationIQ API error:", error.response.data);
      return `Address lookup failed: ${error.response.data.error || 'Unknown error'}`;
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