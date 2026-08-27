import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { sosAPI, authAPI } from '../../models/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { AlertTriangle, Users, Shield, Clock, MapPin, CheckCircle, UploadCloud, Plus, Trash2, ShieldAlert, EyeOff, Navigation, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '../../lib/utils.js';
import { queueLocation } from '../../utils/offlineQueue.js';

// Fix Leaflet default marker icon paths in bundler build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const CitizenDashboard = () => {
  const { user, refreshUser } = useAuth();
  const socket = useSocket();

  // Single source of truth location state
  const [locationState, setLocationState] = useState({
    latitude: null,
    longitude: null,
    accuracy: null,
    locality: '',
    city: '',
    state: '',
    country: '',
    loading: true,
    permissionDenied: false,
    error: ''
  });

  // Derived telemetry state variables for compatibility
  const currentLocation = locationState.latitude && locationState.longitude 
    ? [locationState.latitude, locationState.longitude] 
    : null;
  const fetchingLocation = locationState.loading;
  const locationError = locationState.error;
  const locationAccuracy = locationState.accuracy;
  const locationSource = locationState.latitude ? 'gps' : 'fallback';

  const currentArea = locationState.locality || locationState.city 
    ? (locationState.locality && locationState.city && locationState.locality.toLowerCase() !== locationState.city.toLowerCase()
      ? `${locationState.locality}, ${locationState.city}`
      : locationState.locality || locationState.city)
    : (locationState.state || locationState.country || '');

  // Construct a formatted locality/city area name dynamically from the state
  const displayLocality = () => {
    if (locationState.loading && !locationState.locality && !locationState.city) {
      return 'Pinpointing...';
    }
    if (locationState.permissionDenied) {
      return 'Location permission denied';
    }
    if (locationState.error && !locationState.latitude) {
      return 'Unable to determine location';
    }
    
    const parts = [];
    if (locationState.locality) parts.push(locationState.locality);
    if (locationState.city) parts.push(locationState.city);
    else if (locationState.state) parts.push(locationState.state);
    
    if (parts.length > 0) {
      return parts.join(', ');
    }
    
    if (locationState.country) return locationState.country;
    
    return 'Fetching Location...';
  };

  // Welcome location notification states
  const [welcomeToast, setWelcomeToast] = useState(null);
  const welcomeShownRef = useRef(false);
  const lastGeocodedCoordsRef = useRef({ lat: null, lng: null });
  const lastGeocodeTimeRef = useRef(0);
  const geocodeRequestCounterRef = useRef(0);

  useEffect(() => {
    if (currentArea && !welcomeShownRef.current) {
      setWelcomeToast({
        title: `Welcome back, ${user?.name || 'User'}!`,
        message: `Current location: ${currentArea}`,
        coords: currentLocation 
          ? `Coords: ${currentLocation[0].toFixed(5)}°, ${currentLocation[1].toFixed(5)}°` 
          : ''
      });
      welcomeShownRef.current = true;
      const timer = setTimeout(() => {
        setWelcomeToast(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [currentArea, currentLocation, user?.name]);

  const fetchAreaName = async (lat, lng) => {
    const now = Date.now();
    const lastTime = lastGeocodeTimeRef.current;
    const lastCoords = lastGeocodedCoordsRef.current;

    // Check if coordinates changed by a meaningful distance (approx 0.0005 degrees ~ 50 meters)
    const hasMovedSignificantly = 
      lastCoords.lat === null ||
      lastCoords.lng === null ||
      Math.abs(lat - lastCoords.lat) > 0.0005 ||
      Math.abs(lng - lastCoords.lng) > 0.0005;

    const isCooldownElapsed = (now - lastTime) > 15000; // 15 seconds cooldown

    if (!hasMovedSignificantly && !isCooldownElapsed) {
      return;
    }

    // Increment request ID to prevent race conditions
    const requestId = ++geocodeRequestCounterRef.current;

    try {
      // Update refs immediately to avoid duplicate parallel requests
      lastGeocodedCoordsRef.current = { lat, lng };
      lastGeocodeTimeRef.current = now;

      const res = await sosAPI.reverseGeocode(lat, lng);
      
      // If a newer request has started in the meantime, discard this response
      if (requestId !== geocodeRequestCounterRef.current) {
        return;
      }

      if (res.success && res.data) {
        const addr = res.data.address || {};
        
        // Find locality based on prioritized fields
        const locality = addr.locality || addr.suburb || addr.neighbourhood || addr.city_district || addr.village || addr.town || addr.city || '';
        const city = addr.city || addr.town || addr.county || '';
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
      console.error('Error reverse geocoding:', err);
    }
  };

  // SOS state
  const [activeCase, setActiveCase] = useState(null);
  const [loadingSOS, setLoadingSOS] = useState(false);
  const [silentSOS, setSilentSOS] = useState(false);
  const [description, setDescription] = useState('');

  // SOS countdown states
  const [sosCountdown, setSosCountdown] = useState(null);
  const sosIntervalRef = useRef(null);

  // Clear countdown interval on unmount
  useEffect(() => {
    return () => {
      if (sosIntervalRef.current) {
        clearInterval(sosIntervalRef.current);
      }
    };
  }, []);

  // History state
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Profile verifications & Contacts states
  const [uploadingId, setUploadingId] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [contactForm, setContactForm] = useState({ name: '', relation: '', phone: '' });
  const [updatingContacts, setUpdatingContacts] = useState(false);

  // Map state
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const citizenMarkerRef = useRef(null);
  const responderMarkerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const userHasPannedRef = useRef(false);

  const currentLocationRef = useRef(currentLocation);
  useEffect(() => {
    currentLocationRef.current = currentLocation;
  }, [currentLocation]);

  useEffect(() => {
    fetchActiveCase();
    fetchHistory();
  }, []);

  // Handle offline SOS request sync on connection recovery
  useEffect(() => {
    const handleOnline = () => {
      const pendingSosStr = localStorage.getItem('pending_offline_sos');
      if (pendingSosStr) {
        const pendingSos = JSON.parse(pendingSosStr);
        console.log('[Offline Sync] Syncing queued offline SOS request:', pendingSos);
        
        setLoadingSOS(true);
        sosAPI.trigger(pendingSos)
          .then((res) => {
            if (res.success) {
              setActiveCase(res.case);
              localStorage.removeItem('pending_offline_sos');
              setDescription('');
              fetchHistory();
              alert('Successfully synchronized and dispatched your offline SOS request!');
            }
          })
          .catch((err) => {
            console.error('[Offline Sync] Sync SOS failed:', err);
          })
          .finally(() => {
            setLoadingSOS(false);
          });
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [socket, activeCase]);

  const trackUserLocation = () => {
    setLocationState(prev => ({
      ...prev,
      loading: true,
      error: '',
      permissionDenied: false
    }));

    if (!navigator.geolocation) {
      setLocationState(prev => ({
        ...prev,
        loading: false,
        error: 'Geolocation is not supported by this browser.'
      }));
      return null;
    }

    let watchId;

    const startWatch = (highAccuracy = true) => {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          setLocationState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            loading: false,
            permissionDenied: false,
            error: ''
          }));

          fetchAreaName(lat, lng);

          // Emit real-time tracking update if there's an active distress case
          if (activeCase && socket) {
            socket.emit('update_location', {
              userId: user.id,
              role: user.role,
              latitude: lat,
              longitude: lng,
              sosId: activeCase._id
            });
          }

          // If offline, queue the coordinate for later sync
          if (!navigator.onLine) {
            queueLocation(lat, lng);
          }
        },
        (err) => {
          console.error(`HTML5 Geolocation watch error (HighAccuracy=${highAccuracy}):`, err);
          
          if (highAccuracy && (err.code === err.POSITION_UNAVAILABLE || err.code === err.TIMEOUT)) {
            console.log('High accuracy GPS unavailable. Switching to low accuracy...');
            navigator.geolocation.clearWatch(watchId);
            startWatch(false);
            return;
          }

          let reason = 'Failed to fetch location.';
          let isPermissionDenied = false;

          if (err.code === err.PERMISSION_DENIED) {
            reason = 'Location permission is required to show your current location.';
            isPermissionDenied = true;
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            reason = 'Unable to determine your current location. Please check your GPS/location settings.';
          } else if (err.code === err.TIMEOUT) {
            reason = 'Location request timed out. Please try again.';
          }
          
          setLocationState(prev => ({
            ...prev,
            loading: false,
            permissionDenied: isPermissionDenied,
            error: reason
          }));
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 0 }
      );
    };

    startWatch(true);
    return watchId;
  };

  // Live location tracking and socket synchronization
  useEffect(() => {
    const watchId = trackUserLocation();
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [activeCase, socket, user.id]);

  // Emit join case room on activeCase load
  useEffect(() => {
    if (socket && activeCase) {
      socket.emit('join', { role: user.role, userId: user.id, sosId: activeCase._id });
    }
  }, [socket, activeCase, user.id, user.role]);

  useEffect(() => {
    if (!socket) return;

    const handleSOSAccepted = (data) => {
      if (activeCase && (data.case?._id === activeCase._id || data.caseId === activeCase._id)) {
        fetchActiveCase();
      }
    };

    const handleSOSUpdate = (data) => {
      if (activeCase && (data.case?._id === activeCase._id || data.caseId === activeCase._id)) {
        fetchActiveCase();
      }
    };

    const handleSOSResolved = (data) => {
      if (activeCase && (data.case?._id === activeCase._id || data.caseId === activeCase._id)) {
        setActiveCase(null);
        fetchHistory();
      }
    };

    const handleResponderLocation = (data) => {
      if (activeCase && data.caseId === activeCase._id && data.coordinates) {
        updateMapResponderLocation({ lat: data.coordinates[1], lng: data.coordinates[0] });
      }
    };

    const handleAmbulanceLocation = (data) => {
      if (activeCase && data.caseId === activeCase._id && data.location) {
        updateMapResponderLocation({ lat: data.location.lat, lng: data.location.lng });
      }
    };

    socket.on('sos:accepted', handleSOSAccepted);
    socket.on('sos:status_updated', handleSOSUpdate);
    socket.on('sos:resolved', handleSOSResolved);
    socket.on('responder:location_updated', handleResponderLocation);
    socket.on('ambulance:location_updated', handleAmbulanceLocation);

    return () => {
      socket.off('sos:accepted', handleSOSAccepted);
      socket.off('sos:status_updated', handleSOSUpdate);
      socket.off('sos:resolved', handleSOSResolved);
      socket.off('responder:location_updated', handleResponderLocation);
      socket.off('ambulance:location_updated', handleAmbulanceLocation);
    };
  }, [socket, activeCase]);

  // Handle map rendering for both safe (current location) and active distress tracking
  useEffect(() => {
    const coordinates = activeCase?.location?.coordinates || 
      (locationState.latitude && locationState.longitude ? [locationState.longitude, locationState.latitude] : null);

    if (!coordinates) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        citizenMarkerRef.current = null;
        accuracyCircleRef.current = null;
      }
      return;
    }

    const latLng = [coordinates[1], coordinates[0]];

    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        dragging: true,
        zoomControl: true,
        doubleClickZoom: true,
        touchZoom: true
      }).setView(latLng, 15);

      mapRef.current.dragging.enable();

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);

      mapRef.current.on('dragstart zoomstart', () => {
        userHasPannedRef.current = true;
      });

      citizenMarkerRef.current = L.marker(latLng, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: activeCase 
            ? `<div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #EF4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;"><div style="background: #EF4444; width: 14px; height: 14px; border-radius: 50%;"></div></div>`
            : `<div style="background: rgba(99, 102, 241, 0.2); border: 2px solid #6366F1; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #6366F1; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
      }).addTo(mapRef.current).bindPopup(activeCase ? '<b>Active SOS Distress Point</b>' : '<b>Your Tracked GPS Location</b>').openPopup();
    } else if (mapRef.current) {
      if (!userHasPannedRef.current) {
        mapRef.current.setView(latLng);
      }
      if (!citizenMarkerRef.current) {
        citizenMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: activeCase 
              ? `<div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #EF4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;"><div style="background: #EF4444; width: 14px; height: 14px; border-radius: 50%;"></div></div>`
              : `<div style="background: rgba(99, 102, 241, 0.2); border: 2px solid #6366F1; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #6366F1; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        }).addTo(mapRef.current).bindPopup(activeCase ? '<b>Active SOS Distress Point</b>' : '<b>Your Tracked GPS Location</b>').openPopup();
      } else {
        citizenMarkerRef.current.setLatLng(latLng);
        citizenMarkerRef.current.setPopupContent(activeCase ? '<b>Active SOS Distress Point</b>' : '<b>Your Tracked GPS Location</b>');
        
        citizenMarkerRef.current.setIcon(L.divIcon({
          className: 'custom-div-icon',
          html: activeCase 
            ? `<div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #EF4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;"><div style="background: #EF4444; width: 14px; height: 14px; border-radius: 50%;"></div></div>`
            : `<div style="background: rgba(99, 102, 241, 0.2); border: 2px solid #6366F1; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #6366F1; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        }));
      }
    }

    // Update GPS accuracy circle
    const accuracy = locationState.accuracy;
    if (accuracy && !activeCase && mapRef.current) {
      if (!accuracyCircleRef.current) {
        accuracyCircleRef.current = L.circle(latLng, {
          radius: accuracy,
          color: '#6366F1',
          fillColor: '#6366F1',
          fillOpacity: 0.08,
          weight: 1,
          interactive: false
        }).addTo(mapRef.current);
      } else {
        accuracyCircleRef.current.setLatLng(latLng);
        accuracyCircleRef.current.setRadius(accuracy);
      }
    } else {
      if (accuracyCircleRef.current) {
        accuracyCircleRef.current.remove();
        accuracyCircleRef.current = null;
      }
    }

    // Handle responder tracking marker updates
    if (activeCase && activeCase.status === 'accepted' && activeCase.assignedResponder) {
      const respLoc = activeCase.assignedResponder.location?.coordinates;
      if (respLoc) {
        const respLatLng = [respLoc[1], respLoc[0]];
        if (!responderMarkerRef.current) {
          responderMarkerRef.current = L.marker(respLatLng, {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background: rgba(37, 99, 235, 0.2); border: 2px solid #2563EB; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #2563EB; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            })
          }).addTo(mapRef.current).bindPopup(`<b>Assigned Responder: ${activeCase.assignedResponder.name || 'Help Unit'}</b>`);
        } else {
          responderMarkerRef.current.setLatLng(respLatLng);
        }

        if (!userHasPannedRef.current) {
          const group = new L.featureGroup([citizenMarkerRef.current, responderMarkerRef.current]);
          mapRef.current.fitBounds(group.getBounds().pad(0.2));
        }
      }
    } else {
      if (responderMarkerRef.current) {
        responderMarkerRef.current.remove();
        responderMarkerRef.current = null;
      }
    }
  }, [activeCase, locationState.latitude, locationState.longitude, locationState.accuracy]);

  // Separate map lifecycle cleanup hook
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchCurrentLocation = () => {
    userHasPannedRef.current = false;
    setLocationState(prev => ({ ...prev, loading: true }));
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const acc = pos.coords.accuracy;

          setLocationState(prev => ({
            ...prev,
            latitude: lat,
            longitude: lng,
            accuracy: acc,
            loading: false,
            permissionDenied: false,
            error: ''
          }));

          fetchAreaName(lat, lng);
          
          if (mapRef.current) {
            mapRef.current.setView([lat, lng], 15);
          }
        },
        (err) => {
          console.error('Refresh GPS error:', err);
          let reason = 'Failed to fetch location.';
          let isPermissionDenied = false;

          if (err.code === err.PERMISSION_DENIED) {
            reason = 'Location permission is required to show your current location.';
            isPermissionDenied = true;
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            reason = 'Unable to determine your current location. Please check your GPS/location settings.';
          } else if (err.code === err.TIMEOUT) {
            reason = 'Location request timed out. Please try again.';
          }

          setLocationState(prev => ({
            ...prev,
            loading: false,
            permissionDenied: isPermissionDenied,
            error: reason
          }));
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const handleRecenterMap = () => {
    userHasPannedRef.current = false;
    fetchCurrentLocation();
  };

  const updateMapResponderLocation = (loc) => {
    if (mapRef.current && loc) {
      const latLng = [loc.lat || loc.latitude, loc.lng || loc.longitude];
      if (responderMarkerRef.current) {
        responderMarkerRef.current.setLatLng(latLng);
      } else {
        responderMarkerRef.current = L.marker(latLng, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background: rgba(37, 99, 235, 0.2); border: 2px solid #2563EB; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #2563EB; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        }).addTo(mapRef.current).bindPopup('<b>Responder Dispatched Unit</b>');
      }
    }
  };

  const fetchActiveCase = async () => {
    try {
      const res = await sosAPI.getActive();
      if (res.success && res.cases) {
        const myActive = res.cases.find(c => c.user?._id === user.id || c.user === user.id);
        setActiveCase(myActive || null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await sosAPI.getHistory();
      if (res.success) {
        setHistory(res.cases || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startSOSCountdown = () => {
    if (sosIntervalRef.current) return;
    setSosCountdown(60);
    sosIntervalRef.current = setInterval(() => {
      setSosCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(sosIntervalRef.current);
          sosIntervalRef.current = null;
          triggerSOS();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelSOSCountdown = () => {
    if (sosIntervalRef.current) {
      clearInterval(sosIntervalRef.current);
      sosIntervalRef.current = null;
      setSosCountdown(null);
    }
  };

  const sendSOSImmediately = () => {
    cancelSOSCountdown();
    triggerSOS();
  };

  const triggerSOS = () => {
    setLoadingSOS(true);
    const clientRequestId = 'req_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    const sendSOS = (lat, lng) => {
      const payload = { 
        latitude: lat, 
        longitude: lng, 
        silent: silentSOS, 
        description, 
        clientRequestId 
      };

      if (!navigator.onLine) {
        localStorage.setItem('pending_offline_sos', JSON.stringify(payload));
        alert('You are offline. Your SOS request has been saved and queued locally. It will automatically dispatch once network connectivity is restored.');
        setLoadingSOS(false);
        return;
      }

      sosAPI.trigger(payload)
        .then((res) => {
          if (res.success) {
            setActiveCase(res.case);
            setDescription('');
            fetchHistory();
          }
        })
        .catch((err) => {
          alert('SOS trigger failed: ' + err.message);
        })
        .finally(() => {
          setLoadingSOS(false);
        });
    };

    if (locationState.latitude && locationState.longitude) {
      sendSOS(locationState.latitude, locationState.longitude);
    } else {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => sendSOS(pos.coords.latitude, pos.coords.longitude),
          (err) => {
            alert('SOS failed: High-accuracy GPS coordinates are required to request emergency dispatch. Please grant location access in your browser settings.');
            setLoadingSOS(false);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        alert('SOS failed: Geolocation is not supported by your browser.');
        setLoadingSOS(false);
      }
    }
  };

  const resolveSOSCase = async () => {
    if (!activeCase || !window.confirm('Resolve this active case?')) return;
    try {
      const res = await sosAPI.resolve(activeCase._id, 5, 'Resolved by citizen user');
      if (res.success) {
        setActiveCase(null);
        fetchHistory();
      }
    } catch (err) {
      alert('Error resolving SOS: ' + err.message);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.phone || !contactForm.relation) return;

    setUpdatingContacts(true);
    try {
      const updated = [...(user.emergencyContacts || []), contactForm];
      const res = await authAPI.updateProfile({ emergencyContacts: updated });
      if (res.success) {
        refreshUser();
        setContactForm({ name: '', relation: '', phone: '' });
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingContacts(false);
    }
  };

  const handleDeleteContact = async (index) => {
    if (!window.confirm('Delete contact?')) return;

    setUpdatingContacts(true);
    try {
      const updated = (user.emergencyContacts || []).filter((_, i) => i !== index);
      const res = await authAPI.updateProfile({ emergencyContacts: updated });
      if (res.success) {
        refreshUser();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setUpdatingContacts(false);
    }
  };

  const handleIdUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadError('');
    setUploadingId(true);
    const formData = new FormData();
    formData.append('idImage', file);

    try {
      const res = await authAPI.uploadId(formData);
      if (res.success) {
        refreshUser();
      }
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadingId(false);
    }
  };

  return (
    <>
      {/* Premium Welcome & Location Toast */}
      {welcomeToast && (
        <div 
          style={{
            position: 'fixed',
            top: '24px',
            right: '24px',
            zIndex: 9999,
            width: '360px',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '16px 20px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4), 0 0 30px rgba(16, 185, 129, 0.15)',
            display: 'flex',
            gap: '14px',
            animation: 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Green active pulse ring icon */}
          <div 
            style={{ 
              background: 'rgba(16, 185, 129, 0.15)', 
              border: '1px solid rgba(16, 185, 129, 0.3)', 
              borderRadius: '50%', 
              width: '40px', 
              height: '40px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              flexShrink: 0,
              marginTop: '2px'
            }}
          >
            <MapPin size={20} color="#10B981" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <h4 style={{ color: 'white', fontWeight: 800, fontSize: '14px', margin: '0 0 4px 0', fontFamily: "'Space Grotesk', sans-serif" }}>
              {welcomeToast.title}
            </h4>
            <p style={{ color: '#CBD5E1', fontSize: '12px', margin: '0 0 6px 0', fontWeight: 500, lineHeight: '1.4' }}>
              {welcomeToast.message}
            </p>
            {welcomeToast.coords && (
              <span style={{ display: 'inline-block', fontFamily: 'monospace', fontSize: '10px', color: '#06B6D4', background: 'rgba(6, 182, 212, 0.1)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                {welcomeToast.coords}
              </span>
            )}
          </div>

          <button 
            onClick={() => setWelcomeToast(null)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: '#64748B', 
              cursor: 'pointer', 
              fontSize: '16px', 
              fontWeight: 'bold', 
              padding: '0 4px', 
              alignSelf: 'flex-start' 
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="animate-fade-in dashboard-grid citizen-grid">
      
      {/* Left Area: distress Map & immediate SOS triggers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Safety & Real-Time Location Status Banner */}
        <div 
          className="glass-panel" 
          style={{ 
            padding: '20px 24px', 
            background: activeCase 
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(17, 24, 39, 0.7) 100%)' 
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(17, 24, 39, 0.7) 100%)',
            border: `1px solid ${activeCase ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: activeCase 
              ? '0 10px 30px -10px rgba(239, 68, 68, 0.2)' 
              : '0 10px 30px -10px rgba(16, 185, 129, 0.15)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Decorative ambient background glows */}
          <div 
            style={{ 
              position: 'absolute', 
              top: '-20%', 
              right: '-10%', 
              width: '180px', 
              height: '180px', 
              background: activeCase ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', 
              borderRadius: '50%', 
              filter: 'blur(30px)', 
              pointerEvents: 'none' 
            }} 
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div 
                style={{ 
                  background: activeCase ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                  border: `1px solid ${activeCase ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                  borderRadius: '14px', 
                  padding: '12px',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  boxShadow: activeCase ? '0 0 15px rgba(239, 68, 68, 0.1)' : '0 0 15px rgba(16, 185, 129, 0.1)'
                }}
              >
                {activeCase ? (
                  <ShieldAlert size={28} style={{ color: '#EF4444', animation: 'pulse 1.5s infinite' }} />
                ) : (
                  <CheckCircle size={28} style={{ color: '#10B981' }} />
                )}
              </div>
              <div>
                <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  System Security Status
                </span>
                <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'white', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeCase ? (
                    <>
                      Distress SOS Active 
                      <span style={{ fontSize: '11px', background: 'rgba(239,68,68,0.2)', color: '#FCA5A5', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 700 }}>LIVE TRACKING</span>
                    </>
                  ) : (
                    <>
                      You are Safe 
                      <span style={{ fontSize: '11px', background: 'rgba(16,185,129,0.2)', color: '#A7F3D0', padding: '2px 8px', borderRadius: '999px', border: '1px solid rgba(16,185,129,0.3)', fontWeight: 700 }}>SECURED</span>
                    </>
                  )}
                </h3>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {!activeCase && (
                <button
                  onClick={fetchCurrentLocation}
                  disabled={fetchingLocation}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '8px 16px',
                    color: '#E2E8F0',
                    fontSize: '12px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'; }}
                  title="Update GPS coordinates"
                >
                  <RefreshCw size={14} className={fetchingLocation ? 'animate-spin' : ''} style={{ color: '#06B6D4' }} />
                  Refresh GPS
                </button>
              )}
            </div>
          </div>

          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: '12px', 
              borderTop: '1px solid rgba(255, 255, 255, 0.06)', 
              paddingTop: '16px',
              marginTop: '4px'
            }}
          >
            {/* Locality Panel */}
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.015)', 
                border: '1px solid rgba(255, 255, 255, 0.04)', 
                borderRadius: '14px', 
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div 
                style={{ 
                  background: activeCase ? 'rgba(239, 68, 68, 0.1)' : 'rgba(99, 102, 241, 0.1)', 
                  border: `1px solid ${activeCase ? 'rgba(239, 68, 68, 0.2)' : 'rgba(99, 102, 241, 0.2)'}`, 
                  borderRadius: '10px', 
                  padding: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <MapPin size={16} color={activeCase ? '#EF4444' : '#818CF8'} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '9px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Area / Locality</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={displayLocality()}>
                  {displayLocality()}
                </span>
              </div>
            </div>

            {/* GPS Coordinates Panel */}
            <div 
              style={{ 
                background: 'rgba(255, 255, 255, 0.015)', 
                border: '1px solid rgba(255, 255, 255, 0.04)', 
                borderRadius: '14px', 
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <div 
                style={{ 
                  background: 'rgba(6, 182, 212, 0.1)', 
                  border: '1px solid rgba(6, 182, 212, 0.2)', 
                  borderRadius: '10px', 
                  padding: '8px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <Navigation size={16} color="#06B6D4" />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: 'block', fontSize: '9px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Exact GPS Coordinates</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'white', display: 'block', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {locationState.permissionDenied
                    ? 'Location permission denied'
                    : locationState.error && !locationState.latitude
                      ? 'Unable to determine location'
                      : locationState.loading && !locationState.latitude
                        ? 'Searching...'
                        : (locationState.latitude && locationState.longitude 
                          ? `${locationState.latitude.toFixed(5)}°, ${locationState.longitude.toFixed(5)}°` 
                          : 'Searching...')}
                </span>
                {locationState.latitude && locationState.accuracy !== null && (
                  <span style={{ display: 'block', fontSize: '9px', color: '#06B6D4', marginTop: '2px', fontWeight: 600 }}>
                    Accuracy: &plusmn;{Math.round(locationState.accuracy)}m (GPS)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className={`glass-panel ${activeCase ? 'distress-glow' : ''}`} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={22} style={{ color: activeCase ? '#EF4444' : '#6366F1' }} />
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>
                  Live Emergency Tracking Map
                </h2>
                <span style={{ fontSize: '11px', color: '#94A3B8', display: 'block', marginTop: '2px' }}>
                  {activeCase ? `SOS Active Incident Ref: ${activeCase._id}` : 'Leaflet 2D Real-time Spatial Map'}
                </span>
              </div>
            </div>
            
            <div>
              <span className={`badge ${activeCase ? 'badge-error' : 'badge-success'}`} style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                {activeCase ? activeCase.status : 'Safe'}
              </span>
            </div>
          </div>

          {locationError && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', padding: '10px 14px', color: '#F87171', fontSize: '12px' }}>
              ⚠️ {locationError}
            </div>
          )}

          {/* Leaflet GPS map is only initialized and rendered when valid coordinates are available */}
          <div style={{ position: 'relative' }}>
            {!(locationState.latitude && locationState.longitude) && !activeCase?.location?.coordinates ? (
              <div style={{ height: '320px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15, 23, 42, 0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '24px', textAlign: 'center' }}>
                <MapPin size={40} color="#6366F1" style={{ opacity: 0.6, animation: 'pulse 2s infinite' }} />
                <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: 500 }}>
                  {locationState.permissionDenied 
                    ? 'Location permission denied. Please enable GPS access in your browser settings.' 
                    : locationState.error 
                      ? 'Unable to determine GPS location. Please check your location settings.'
                      : 'Acquiring high-accuracy GPS coordinates...'}
                </span>
              </div>
            ) : (
              <>
                <div ref={mapContainerRef} style={{ height: '320px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', zIndex: 1 }} />
                
                {/* Custom Floating GPS Control */}
                <button 
                  onClick={handleRecenterMap}
                  style={{
                    position: 'absolute',
                    top: '80px',
                    left: '10px',
                    zIndex: 999,
                    width: '34px',
                    height: '34px',
                    background: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#f8fafc',
                    cursor: 'pointer',
                    boxShadow: '0 1px 5px rgba(0,0,0,0.65)',
                    transition: 'all 0.2s',
                  }}
                  className="hover:bg-white/10"
                  title="My Location"
                >
                  <Navigation size={16} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </>
            )}
          </div>

          {/* Context controls based on distress states */}
          {activeCase ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeCase.status === 'accepted' && activeCase.responderTimeline?.[0] && (
                <div style={{ background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '12px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Clock size={20} style={{ color: '#3B82F6' }} />
                  <div>
                    <h4 style={{ color: 'white', fontWeight: 600, fontSize: '13px' }}>Responder En Route</h4>
                    <p style={{ color: '#94A3B8', fontSize: '12px', margin: '2px 0 0' }}>Estimated Arrival: {activeCase.responderTimeline[0].eta || 'Pending'} mins</p>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <p style={{ color: '#94A3B8', fontSize: '11px', maxWidth: '400px' }}>Your coordinates are streaming live to the nearest help provider.</p>
                <button onClick={resolveSOSCase} style={{ background: 'linear-gradient(135deg, #10B981, #059669)', border: 'none', color: 'white', fontWeight: 600, padding: '10px 18px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} /> Resolve Case
                </button>
              </div>
            </div>
          ) : sosCountdown !== null ? (
              <div style={{ display: 'flex', width: '100%', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={18} className="text-red-400 animate-pulse" />
                    <span style={{ fontSize: '12px', color: '#F87171', fontWeight: 700 }}>
                      SOS Pending Auto-Send: {sosCountdown}s
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={cancelSOSCountdown} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: '#CBD5E1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}>
                      Cancel SOS
                    </button>
                    <button onClick={sendSOSImmediately} style={{ background: '#EF4444', border: 'none', color: 'white', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>
                      Send Now
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '18px', width: '100%' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '10.5px', color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Distress details (Optional - classified by Gemini AI)
                  </label>
                  <textarea
                    placeholder="Describe your emergency (e.g. chest pain, active fire, major crash with injuries)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: '100%',
                      height: '54px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: 'white',
                      fontSize: '12px',
                      outline: 'none',
                      resize: 'none',
                      transition: 'border 0.2s',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.02)', padding: '6px 12px', borderRadius: '10px' }}>
                    <EyeOff size={14} style={{ color: silentSOS ? '#EF4444' : '#64748B' }} />
                    <span style={{ fontSize: '11px', color: '#CBD5E1', fontWeight: 600 }}>Silent SOS Alert</span>
                    <input type="checkbox" className="toggle toggle-error toggle-xs" checked={silentSOS} onChange={(e) => setSilentSOS(e.target.checked)} />
                  </div>

                  <button
                    onClick={startSOSCountdown}
                    disabled={loadingSOS}
                    style={{
                      background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                      border: 'none', color: 'white',
                      fontSize: '12px', fontWeight: 900, cursor: 'pointer',
                      padding: '10px 24px', borderRadius: '8px',
                      boxShadow: '0 4px 15px rgba(239,68,68,0.2)', transition: 'all 0.2s',
                      display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                  >
                    <AlertTriangle size={14} /> TRIGGER SOS
                  </button>
                </div>
              </div>
            )}

        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '16px' }}>Incident Logs</h3>
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '16px' }}><span className="loading loading-spinner"></span></div>
          ) : history.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center' }}>No incidents logged.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {history.map((h) => (
                <div key={h._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Ref: {h._id.slice(-6)}</span>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>{formatDate(h.createdAt)}</span>
                  </div>
                  <span className={`badge badge-sm ${h.status === 'resolved' ? 'badge-success' : 'badge-error'}`} style={{ textTransform: 'uppercase', fontSize: '9px', fontWeight: 700 }}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Area: ID uploads & Contacts list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>Account Status</h3>
          <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '16px' }}>{user.idVerification?.status === 'verified' ? '🟢' : '🔴'}</span>
            <div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>Verification status</span>
              <span style={{ display: 'block', fontSize: '11px', color: '#64748B' }}>{user.idVerification?.status || 'unverified'}</span>
            </div>
          </div>
          {user.idVerification?.status !== 'verified' && (
            <div style={{ marginTop: '14px' }}>
              <label className="shine-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'linear-gradient(135deg, #6366F1, #4F46E5)', border: 'none', color: 'white', fontSize: '12px', fontWeight: 600, padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                <UploadCloud size={14} /> Upload verification document
                <input type="file" style={{ display: 'none' }} accept="image/*" onChange={handleIdUpload} />
              </label>
              {uploadError && <p style={{ color: '#EF4444', fontSize: '11px', marginTop: '6px' }}>{uploadError}</p>}
            </div>
          )}
        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>Contacts</h3>
          <form onSubmit={handleAddContact} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px' }}>
            <input type="text" placeholder="Name" value={contactForm.name} onChange={(e) => setContactForm(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px' }} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <input type="text" placeholder="Relation" value={contactForm.relation} onChange={(e) => setContactForm(p => ({ ...p, relation: e.target.value }))} style={{ width: '100%', minWidth: '0', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px' }} required />
              <input type="tel" placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm(p => ({ ...p, phone: e.target.value }))} style={{ width: '100%', minWidth: '0', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px' }} required />
            </div>
            <button type="submit" style={{ background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', color: '#06B6D4', borderRadius: '6px', padding: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Add Contact</button>
          </form>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {(user.emergencyContacts || []).map((c, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', display: 'block' }}>{c.name}</span>
                  <span style={{ fontSize: '10px', color: '#64748B' }}>{c.relation} • {c.phone}</span>
                </div>
                <button onClick={() => handleDeleteContact(idx)} style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
    </>
  );
};

export default CitizenDashboard;
