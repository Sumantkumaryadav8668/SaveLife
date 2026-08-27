import { useState, useEffect, useRef, useCallback } from 'react';
import { sosAPI } from '../models/api.js';

export const useDeviceLocation = (activeCase = null, socket = null, userId = null, role = null) => {
  const [locationState, setLocationState] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    locality: '',
    city: '',
    state: '',
    country: '',
    permissionState: 'prompt', // 'granted' | 'denied' | 'prompt'
    loading: true,
    error: ''
  });

  const watchIdRef = useRef(null);
  const permissionStatusRef = useRef(null);
  const lastGeocodedCoordsRef = useRef({ lat: null, lng: null });
  const lastGeocodeTimeRef = useRef(0);
  const geocodeRequestCounterRef = useRef(0);

  // Helper to clear watcher safely
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // Reverse Geocoding function
  const fetchAreaName = useCallback(async (lat, lng) => {
    const now = Date.now();
    const lastTime = lastGeocodeTimeRef.current;
    const lastCoords = lastGeocodedCoordsRef.current;

    // Check if coordinates changed by a meaningful distance (approx 50m)
    const hasMovedSignificantly = 
      lastCoords.lat === null ||
      lastCoords.lng === null ||
      Math.abs(lat - lastCoords.lat) > 0.0005 ||
      Math.abs(lng - lastCoords.lng) > 0.0005;

    const isCooldownElapsed = (now - lastTime) > 15000;

    if (!hasMovedSignificantly && !isCooldownElapsed) {
      return;
    }

    const requestId = ++geocodeRequestCounterRef.current;

    try {
      lastGeocodedCoordsRef.current = { lat, lng };
      lastGeocodeTimeRef.current = now;

      console.log('[GPS] Reverse geocode request for coordinates:', lat, lng);
      const res = await sosAPI.reverseGeocode(lat, lng);
      
      if (requestId !== geocodeRequestCounterRef.current) {
        return;
      }

      if (res.success && res.data) {
        const addr = res.data.address || {};
        console.log('[GPS] Reverse geocode response:', addr);
        
        // Priority parsing: neighbourhood -> suburb -> locality -> village -> town -> city -> municipality -> state -> country
        const locality = addr.neighbourhood || addr.suburb || addr.locality || addr.village || addr.town || addr.city || addr.municipality || '';
        const city = addr.city || addr.town || addr.county || addr.municipality || '';
        const state = addr.state || '';
        const country = addr.country || '';

        setLocationState(prev => ({
          ...prev,
          locality,
          city,
          state,
          country
        }));
      }
    } catch (err) {
      console.error('[GPS] Reverse geocoding failed:', err);
    }
  }, []);

  // Start watching position
  const startWatching = useCallback((highAccuracy = true) => {
    stopWatching();

    if (!navigator.geolocation) {
      setLocationState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser.'
      }));
      return;
    }

    setLocationState(prev => ({
      ...prev,
      loading: true,
      error: ''
    }));

    try {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          console.log('[GPS] Position watch update:', lat, lng, acc);

          setLocationState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            permissionState: 'granted',
            loading: false,
            error: ''
          }));

          fetchAreaName(lat, lng);

          // Emit real-time tracking update if socket & activeCase exist
          if (activeCase && socket && userId && role) {
            socket.emit('update_location', {
              userId,
              role,
              latitude: lat,
              longitude: lng,
              sosId: activeCase._id
            });
          }
        },
        (err) => {
          console.error(`HTML5 Geolocation watch error (HighAccuracy=${highAccuracy}):`, err);
          stopWatching();

          let reason = 'Failed to fetch location.';
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            reason = 'Location permission is blocked for this site. Enable Location permission in your browser Site Settings, then click Refresh GPS.';
            setLocationState(prev => ({
              ...prev,
              latitude: null,
              longitude: null,
              accuracy: null,
              loading: false,
              permissionState: 'denied',
              error: reason
            }));
          } else if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
            reason = 'Unable to determine your current location. Please check your GPS/location settings.';
            setLocationState(prev => ({
              ...prev,
              loading: false,
              error: reason
            }));
          } else if (err.code === 3 || err.code === err.TIMEOUT) {
            reason = 'Location request timed out. Please try again.';
            setLocationState(prev => ({
              ...prev,
              loading: false,
              error: reason
            }));
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 0 }
      );

      watchIdRef.current = watchId;
    } catch (e) {
      console.error('Error starting watchPosition:', e);
      setLocationState(prev => ({
        ...prev,
        loading: false,
        error: e.message
      }));
    }
  }, [activeCase, socket, userId, role, fetchAreaName, stopWatching]);

  // Refresh / request location manually
  const refreshLocation = useCallback(async () => {
    stopWatching();

    console.log('[GPS] Refresh GPS clicked. Checking current permission state...');
    let currentPermState = 'prompt';

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        console.log('[GPS] Permission check before Refresh:', permissionStatus.state);
        currentPermState = permissionStatus.state;
      } catch (err) {
        console.error('Error checking permission state:', err);
      }
    }

    if (currentPermState === 'denied') {
      setLocationState(prev => ({
        ...prev,
        permissionState: 'denied',
        latitude: null,
        longitude: null,
        accuracy: null,
        loading: false,
        error: 'Location permission is blocked for this site. Enable Location permission in your browser Site Settings, then click Refresh GPS.'
      }));
      return;
    }

    setLocationState(prev => ({
      ...prev,
      permissionState: currentPermState,
      loading: true,
      error: ''
    }));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          console.log('[GPS] Position fetched manually:', lat, lng, acc);

          setLocationState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            permissionState: 'granted',
            loading: false,
            error: ''
          }));

          fetchAreaName(lat, lng);
          startWatching(true);
        },
        (err) => {
          console.error('[GPS] Position fetch manual error:', err);
          stopWatching();

          let reason = 'Failed to fetch location.';
          if (err.code === 1 || err.code === err.PERMISSION_DENIED) {
            reason = 'Location permission is blocked for this site. Enable Location permission in your browser Site Settings, then click Refresh GPS.';
            setLocationState(prev => ({
              ...prev,
              latitude: null,
              longitude: null,
              accuracy: null,
              loading: false,
              permissionState: 'denied',
              error: reason
            }));
          } else {
            let nextPermState = currentPermState;
            if (err.code === 2 || err.code === err.POSITION_UNAVAILABLE) {
              reason = 'Unable to determine your current location. Please check your GPS/location settings.';
            } else if (err.code === 3 || err.code === err.TIMEOUT) {
              reason = 'Location request timed out. Please try again.';
            }
            setLocationState(prev => ({
              ...prev,
              permissionState: nextPermState,
              loading: false,
              error: reason
            }));
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocationState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser.'
      }));
    }
  }, [fetchAreaName, startWatching, stopWatching]);

  // Initial setup and Permissions query
  useEffect(() => {
    let active = true;

    const initPermissionCheck = async () => {
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          if (!active) return;
          
          permissionStatusRef.current = permissionStatus;
          
          console.log('[GPS] Initial Permission query:', permissionStatus.state);
          
          const handlePermissionStatusChange = () => {
            if (!active) return;
            console.log('[GPS] Permission changed:', permissionStatus.state);

            if (permissionStatus.state === 'granted') {
              setLocationState(prev => ({
                ...prev,
                permissionState: 'granted',
                error: '',
                loading: true
              }));
              startWatching(true);
            } else if (permissionStatus.state === 'denied') {
              stopWatching();
              setLocationState(prev => ({
                ...prev,
                permissionState: 'denied',
                latitude: null,
                longitude: null,
                accuracy: null,
                loading: false,
                error: 'Location permission is blocked for this site. Enable Location permission in your browser Site Settings, then click Refresh GPS.'
              }));
            } else {
              // prompt state
              stopWatching();
              setLocationState(prev => ({
                ...prev,
                permissionState: 'prompt',
                latitude: null,
                longitude: null,
                accuracy: null,
                loading: false,
                error: ''
              }));
            }
          };

          permissionStatus.onchange = handlePermissionStatusChange;

          // Initial routing based on permission state
          if (permissionStatus.state === 'granted') {
            setLocationState(prev => ({
              ...prev,
              permissionState: 'granted'
            }));
            startWatching(true);
          } else if (permissionStatus.state === 'denied') {
            stopWatching();
            setLocationState(prev => ({
              ...prev,
              permissionState: 'denied',
              latitude: null,
              longitude: null,
              accuracy: null,
              loading: false,
              error: 'Location permission is blocked for this site. Enable Location permission in your browser Site Settings, then click Refresh GPS.'
            }));
          } else {
            // Prompt state - do not request location automatically on render to prevent spamming
            stopWatching();
            setLocationState(prev => ({
              ...prev,
              permissionState: 'prompt',
              loading: false,
              error: ''
            }));
          }
        } catch (err) {
          console.error('Error in Permissions API setup:', err);
          // Fallback
          startWatching(true);
        }
      } else {
        // Fallback for browsers not supporting Permissions query
        startWatching(true);
      }
    };

    initPermissionCheck();

    return () => {
      active = false;
      stopWatching();
      if (permissionStatusRef.current) {
        permissionStatusRef.current.onchange = null;
      }
    };
  }, [startWatching, stopWatching]);

  return {
    ...locationState,
    refreshLocation,
    startWatching,
    stopWatching
  };
};
