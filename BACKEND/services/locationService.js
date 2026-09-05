import axios from 'axios';

export const validateCoordinates = (latitude, longitude) => {
  const lat = parseFloat(latitude);
  const lng = parseFloat(longitude);
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lng < -180 || lng > 180) return false;
  return true;
};

export const reverseGeocode = async (latitude, longitude) => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    // Provide a User-Agent to respect Nominatim's usage policy
    const response = await axios.get(url, { headers: { 'User-Agent': 'HRMS-App' } });
    
    if (response.data && response.data.display_name) {
      return response.data.display_name;
    }
    return 'Unknown Location';
  } catch (error) {
    console.error('Reverse geocode error:', error.message);
    return 'Unknown Location';
  }
};
