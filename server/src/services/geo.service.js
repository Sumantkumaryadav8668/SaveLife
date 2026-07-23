import Entity from '../modules/hospitals/entity.model.js';

// Find nearest entities (Hospitals, Police stations, Rescue teams) using GeoJSON spatial queries
export const findNearestEntities = async (longitude, latitude, type, maxCount = 3) => {
  try {
    const query = {
      location: {
        $nearSphere: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          }
        }
      }
    };

    if (type) {
      query.type = type;
    }

    const results = await Entity.find(query).limit(maxCount).exec();
    return results;
  } catch (error) {
    console.error('Error in findNearestEntities:', error);
    throw error;
  }
};

// Haversine formula to calculate distance between two coordinates in kilometers
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};
