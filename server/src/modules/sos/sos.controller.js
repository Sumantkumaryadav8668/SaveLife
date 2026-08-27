import SOSCase from './sos-case.model.js';
import * as sosService from '../../services/sos.service.js';
import * as geoService from '../../services/geo.service.js';

export const triggerSOS = async (req, res) => {
  const { longitude, latitude, silent, description, clientRequestId } = req.body;
  if (!longitude || !latitude) {
    return res.status(400).json({ success: false, message: 'Coordinates are required' });
  }

  try {
    const sosCase = await sosService.triggerSOS(
      req.user._id,
      longitude,
      latitude,
      silent,
      description,
      clientRequestId
    );
    res.status(201).json({ success: true, case: sosCase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const acceptSOS = async (req, res) => {
  const { id } = req.params;
  const { eta } = req.body;

  try {
    if (!req.user.entityId) {
      return res.status(400).json({ success: false, message: 'Responder must be associated with an Entity (Hospital/Station)' });
    }
    const sosCase = await sosService.acceptSOS(id, req.user._id, req.user.entityId, eta);
    res.json({ success: true, case: sosCase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const resolveSOS = async (req, res) => {
  const { id } = req.params;
  const { rating, comment } = req.body;

  try {
    const sosCase = await sosService.resolveSOS(id, rating, comment);
    res.json({ success: true, case: sosCase });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const flagFalseAlarm = async (req, res) => {
  const { id } = req.params;
  const { comment } = req.body;

  try {
    const result = await sosService.flagFalseAlarm(id, req.user._id, comment);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getActiveCases = async (req, res) => {
  try {
    let query = { status: { $in: ['pending', 'accepted'] } };
    
    if (['police', 'rescue_person', 'hospital_admin'].includes(req.user.role) && req.user.entityId) {
      query = {
        $or: [
          { status: 'pending', 'notifiedEntities.entity': req.user.entityId },
          { status: 'accepted', assignedResponder: req.user.entityId }
        ]
      };
    }

    const cases = await SOSCase.find(query).populate('user', 'name phone').populate('assignedResponder').sort({ createdAt: -1 }).exec();
    res.json({ success: true, cases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'user') {
      query = { user: req.user._id };
    } else if (req.user.entityId) {
      query = {
        $or: [
          { assignedResponder: req.user.entityId },
          { 'notifiedEntities.entity': req.user.entityId }
        ]
      };
    }
    const cases = await SOSCase.find(query)
      .populate('user', 'name phone')
      .populate('assignedResponder')
      .sort({ createdAt: -1 })
      .exec();
    
    res.json({ success: true, cases });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const geocodeCache = new Map();

export const reverseGeocode = async (req, res) => {
  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
  }

  // Create a cache key by rounding coordinates to 4 decimal places (~11m accuracy)
  const latKey = parseFloat(lat).toFixed(4);
  const lngKey = parseFloat(lng).toFixed(4);
  const cacheKey = `${latKey},${lngKey}`;

  if (geocodeCache.has(cacheKey)) {
    return res.json({ success: true, data: geocodeCache.get(cacheKey) });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LifeSaveApp/1.0 (contact@lifesave.example.com)',
        'Accept-Language': 'en'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // Cache the result
    geocodeCache.set(cacheKey, data);

    // Bound the cache size to avoid memory leaks
    if (geocodeCache.size > 1000) {
      const firstKey = geocodeCache.keys().next().value;
      geocodeCache.delete(firstKey);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error in reverseGeocode proxy:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

