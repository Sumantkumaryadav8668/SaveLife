import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { hospitalAPI, sosAPI } from '../../models/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Shield, Activity, Users, Truck, Calendar, MapPin, Clock, CheckCircle, Save, Plus, Trash2, HeartPulse, RefreshCw } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDate } from '../../lib/utils.js';

// Fix Leaflet default marker icon paths in bundler build
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const DEFAULT_COORDS = [12.9716, 77.5946];

const HospitalDashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();

  // Resources operational state
  const [resources, setResources] = useState({
    roomsTotal: 0, roomsOccupied: 0,
    bedsGeneralTotal: 0, bedsGeneralOccupied: 0,
    bedsIcuTotal: 0, bedsIcuOccupied: 0,
    bloodBank: [],
    ambulances: [],
    doctors: []
  });
  const [hospitalName, setHospitalName] = useState('');
  const [loadingResources, setLoadingResources] = useState(false);
  const [savingResources, setSavingResources] = useState(false);

  // Cases operational state
  const [activeCases, setActiveCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Leaflet map hooks
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const citizenMarkersRef = useRef({});
  const responderMarkerRef = useRef(null);
  const userHasPannedRef = useRef(false);

  // Sub-resource lists form inputs state
  const [newDoctor, setNewDoctor] = useState({ name: '', department: 'Emergency Medicine', available: true });
  const [newAmbulance, setNewAmbulance] = useState({ ambulanceId: '', plateNumber: '', status: 'available' });

  // Currently active case detailed selection
  const [selectedCase, setSelectedCase] = useState(null);
  const [etaInput, setEtaInput] = useState('');
  const [acceptingCaseId, setAcceptingCaseId] = useState(null);

  useEffect(() => {
    if (user.entityId) {
      fetchResources();
      fetchActiveCases();
      fetchHistory();
    }
  }, [user.entityId]);

  // Join the selected case room when selectedCase changes
  useEffect(() => {
    if (socket && selectedCase) {
      socket.emit('join', { role: user.role, userId: user.id, sosId: selectedCase._id });
    }
  }, [socket, selectedCase, user.id, user.role]);

  useEffect(() => {
    if (!socket) return;

    const handleNewSOS = () => {
      fetchActiveCases();
    };

    const handleSOSUpdate = (data) => {
      fetchActiveCases();
      const cId = data.case?._id || data.caseId;
      if (selectedCase && selectedCase._id === cId) {
        refreshSelectedCase(cId);
      }
    };

    const handleSOSResolved = (data) => {
      fetchActiveCases();
      fetchHistory();
      const cId = data.case?._id || data.caseId;
      if (selectedCase && selectedCase._id === cId) {
        setSelectedCase(null);
      }
    };

    const handleCitizenLocation = (data) => {
      if (selectedCase && selectedCase._id === data.caseId && data.coordinates) {
        const latLng = [data.coordinates[1], data.coordinates[0]];
        if (citizenMarkersRef.current[data.caseId]) {
          citizenMarkersRef.current[data.caseId].setLatLng(latLng);
        }
      }
    };

    socket.on('sos:created', handleNewSOS);
    socket.on('sos:accepted', handleSOSUpdate);
    socket.on('sos:status_updated', handleSOSUpdate);
    socket.on('sos:resolved', handleSOSResolved);
    socket.on('citizen:location_updated', handleCitizenLocation);

    return () => {
      socket.off('sos:created', handleNewSOS);
      socket.off('sos:accepted', handleSOSUpdate);
      socket.off('sos:status_updated', handleSOSUpdate);
      socket.off('sos:resolved', handleSOSResolved);
      socket.off('citizen:location_updated', handleCitizenLocation);
    };
  }, [socket, selectedCase]);

  // Reset user pan on selection change
  useEffect(() => {
    userHasPannedRef.current = false;
  }, [selectedCase?._id]);

  // Leaflet component trigger
  const [selectedLat, selectedLng] = selectedCase?.location?.coordinates || [null, null];
  const [hospLng, hospLat] = resources.location?.coordinates || [null, null];
  useEffect(() => {
    if (!selectedCase) {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      return;
    }

    const coordinates = selectedCase.location?.coordinates || DEFAULT_COORDS;
    const latLng = [coordinates[1], coordinates[0]];

    if (!mapRef.current && mapContainerRef.current) {
      mapRef.current = L.map(mapContainerRef.current, {
        scrollWheelZoom: true,
        dragging: true,
        zoomControl: true,
        doubleClickZoom: true,
        touchZoom: true
      }).setView(latLng, 14);

      mapRef.current.dragging.enable();

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(mapRef.current);

      mapRef.current.on('dragstart zoomstart', () => {
        userHasPannedRef.current = true;
      });

      citizenMarkersRef.current[selectedCase._id] = L.marker(latLng, {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #EF4444; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pulse 1.5s infinite;"><div style="background: #EF4444; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        })
      }).addTo(mapRef.current).bindPopup(`<b>Citizen: ${selectedCase.user?.name || 'Emergency signal'}</b>`).openPopup();
    } else if (mapRef.current) {
      if (!userHasPannedRef.current) {
        mapRef.current.setView(latLng);
      }
      if (citizenMarkersRef.current[selectedCase._id]) {
        citizenMarkersRef.current[selectedCase._id].setLatLng(latLng);
      }
    }

    if (mapRef.current && resources.location?.coordinates) {
      const hospLoc = resources.location.coordinates;
      const hospLatLng = [hospLoc[1], hospLoc[0]];

      if (!responderMarkerRef.current) {
        responderMarkerRef.current = L.marker(hospLatLng, {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background: rgba(59, 130, 246, 0.2); border: 2px solid #2563EB; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center;"><div style="background: #2563EB; width: 14px; height: 14px; border-radius: 50%;"></div></div>`,
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          })
        }).addTo(mapRef.current).bindPopup(`<b>Hospital: ${hospitalName}</b>`);
      } else {
        responderMarkerRef.current.setLatLng(hospLatLng);
      }

      if (!userHasPannedRef.current) {
        const bounds = L.latLngBounds([latLng, hospLatLng]);
        mapRef.current.fitBounds(bounds.pad(0.2));
      }
    }
  }, [selectedCase?._id, selectedLat, selectedLng, hospLat, hospLng]);

  // Separate map unmount hook
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const fetchResources = async () => {
    setLoadingResources(true);
    try {
      const res = await hospitalAPI.getResources(user.entityId);
      if (res.success) {
        setResources(res.resources || {});
        setHospitalName(res.name || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingResources(false);
    }
  };

  const fetchActiveCases = async () => {
    setLoadingCases(true);
    try {
      const res = await sosAPI.getActive();
      if (res.success) {
        setActiveCases(res.cases || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCases(false);
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

  const refreshSelectedCase = async (id) => {
    try {
      const res = await sosAPI.getActive();
      if (res.success && res.cases) {
        const matching = res.cases.find(c => c._id === id);
        if (matching) setSelectedCase(matching);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateResources = async (e) => {
    e.preventDefault();
    setSavingResources(true);
    try {
      const res = await hospitalAPI.updateResources(user.entityId, resources);
      if (res.success) {
        alert('Operations inventory saved.');
        fetchResources();
      }
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally {
      setSavingResources(false);
    }
  };

  const handleAcceptSOS = async (caseId) => {
    if (!etaInput) return alert('Enter arrival ETA');
    setAcceptingCaseId(caseId);
    try {
      const res = await sosAPI.accept(caseId, parseInt(etaInput));
      if (res.success) {
        setEtaInput('');
        fetchActiveCases();
        refreshSelectedCase(caseId);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAcceptingCaseId(null);
    }
  };

  const handleResolveSOS = async (caseId) => {
    if (!window.confirm('Resolve case?')) return;
    try {
      const res = await sosAPI.resolve(caseId, 5, 'Resolved by Hospital Dispatch Team');
      if (res.success) {
        setSelectedCase(null);
        fetchActiveCases();
        fetchHistory();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddDoctor = (e) => {
    e.preventDefault();
    if (!newDoctor.name) return;
    setResources(prev => ({
      ...prev,
      doctors: [...(prev.doctors || []), newDoctor]
    }));
    setNewDoctor({ name: '', department: 'Emergency Medicine', available: true });
  };

  const handleDeleteDoctor = (idx) => {
    setResources(prev => ({
      ...prev,
      doctors: (prev.doctors || []).filter((_, i) => i !== idx)
    }));
  };

  const handleAddAmbulance = (e) => {
    e.preventDefault();
    if (!newAmbulance.ambulanceId || !newAmbulance.plateNumber) return;
    setResources(prev => ({
      ...prev,
      ambulances: [...(prev.ambulances || []), newAmbulance]
    }));
    setNewAmbulance({ ambulanceId: '', plateNumber: '', status: 'available' });
  };

  const handleDeleteAmbulance = (idx) => {
    setResources(prev => ({
      ...prev,
      ambulances: (prev.ambulances || []).filter((_, i) => i !== idx)
    }));
  };

  const handleBloodBankChange = (idx, val) => {
    const updated = [...(resources.bloodBank || [])];
    updated[idx].units = parseInt(val) || 0;
    setResources(prev => ({ ...prev, bloodBank: updated }));
  };

  return (
    <div className="animate-fade-in dashboard-grid hospital-grid">
      
      {/* Left Column: Hospital Inventory updates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HeartPulse size={22} style={{ color: '#EF4444' }} />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>{hospitalName || 'Hospital Resource Center'}</h3>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Hospital Admin Console</span>
              </div>
            </div>
            <button onClick={fetchResources} disabled={loadingResources} className="btn btn-ghost btn-sm btn-circle text-[#06B6D4]">
              <RefreshCw size={16} className={loadingResources ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingResources ? (
            <div style={{ textAlign: 'center', padding: '40px' }}><span className="loading loading-spinner loading-md"></span></div>
          ) : (
            <form onSubmit={handleUpdateResources} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>Rooms</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="number" placeholder="Occ" value={resources.roomsOccupied} onChange={(e) => setResources(p => ({ ...p, roomsOccupied: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                    <input type="number" placeholder="Total" value={resources.roomsTotal} onChange={(e) => setResources(p => ({ ...p, roomsTotal: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>General Beds</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="number" placeholder="Occ" value={resources.bedsGeneralOccupied} onChange={(e) => setResources(p => ({ ...p, bedsGeneralOccupied: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                    <input type="number" placeholder="Total" value={resources.bedsGeneralTotal} onChange={(e) => setResources(p => ({ ...p, bedsGeneralTotal: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '4px' }}>ICU Beds</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input type="number" placeholder="Occ" value={resources.bedsIcuOccupied} onChange={(e) => setResources(p => ({ ...p, bedsIcuOccupied: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                    <input type="number" placeholder="Total" value={resources.bedsIcuTotal} onChange={(e) => setResources(p => ({ ...p, bedsIcuTotal: parseInt(e.target.value) || 0 }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '4px', color: 'white', fontSize: '12px', textAlign: 'center' }} />
                  </div>
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>Blood Stocks (Units)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                  {(resources.bloodBank || []).map((b, i) => (
                    <div key={b.bloodGroup} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '6px', padding: '4px 6px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, color: '#EF4444', width: '22px' }}>{b.bloodGroup}</span>
                      <input type="number" value={b.units} onChange={(e) => handleBloodBankChange(i, e.target.value)} style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '12px', textAlign: 'center', padding: 0 }} />
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Doctors</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', marginBottom: '8px' }}>
                    {(resources.doctors || []).map((d, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' }}>
                        <span style={{ color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        <button type="button" onClick={() => handleDeleteDoctor(idx)} style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <input type="text" placeholder="Dr. Name" value={newDoctor.name} onChange={(e) => setNewDoctor(p => ({ ...p, name: e.target.value }))} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 6px', color: 'white', fontSize: '10px' }} />
                    <button type="button" onClick={handleAddDoctor} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'white', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>Ambulance Fleet</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', marginBottom: '8px' }}>
                    {(resources.ambulances || []).map((a, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', padding: '2px 6px', fontSize: '11px' }}>
                        <span style={{ color: 'white' }}>{a.ambulanceId}</span>
                        <button type="button" onClick={() => handleDeleteAmbulance(idx)} style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <input type="text" placeholder="ID" value={newAmbulance.ambulanceId} onChange={(e) => setNewAmbulance(p => ({ ...p, ambulanceId: e.target.value }))} style={{ width: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 6px', color: 'white', fontSize: '10px' }} />
                    <input type="text" placeholder="Plate" value={newAmbulance.plateNumber} onChange={(e) => setNewAmbulance(p => ({ ...p, plateNumber: e.target.value }))} style={{ width: '50%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '4px', padding: '3px 6px', color: 'white', fontSize: '10px' }} />
                    <button type="button" onClick={handleAddAmbulance} style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'white', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}>+</button>
                  </div>
                </div>

              </div>

              <button type="submit" disabled={savingResources} className="shine-btn" style={{ width: '100%', height: '42px', background: 'linear-gradient(135deg, #06B6D4, #3B82F6)', border: 'none', borderRadius: '10px', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Save size={14} /> {savingResources ? 'Saving...' : 'Save Inventory'}
              </button>

            </form>
          )}

        </div>

        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '12px' }}>Incident Logs</h3>
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '10px' }}><span className="loading loading-spinner"></span></div>
          ) : history.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center' }}>No historical logs.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {history.map((h) => (
                <div key={h._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '8px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'white' }}>{h.user?.name || 'Citizen'}</span>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>{formatDate(h.createdAt)}</span>
                  </div>
                  <span className="badge badge-sm badge-success">{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Column: SOS active response details & tracking maps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>Active Emergency Alerts</h3>
          {loadingCases ? (
            <div style={{ textAlign: 'center', padding: '10px' }}><span className="loading loading-spinner"></span></div>
          ) : activeCases.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '12px', textAlign: 'center' }}>🟢 No distress signals active.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {activeCases.map((c) => {
                const isSelected = selectedCase?._id === c._id;
                const isMyAccept = c.assignedResponder?._id === user.entityId || c.assignedResponder === user.entityId;
                const isP0 = c.priority === 'P0' || c.severity === 'critical';

                return (
                  <div
                    key={c._id}
                    onClick={() => setSelectedCase(c)}
                    style={{
                      background: isSelected 
                        ? 'rgba(99,102,241,0.05)' 
                        : (isP0 ? 'rgba(239,68,68,0.03)' : 'rgba(255,255,255,0.01)'),
                      border: `1px solid ${
                        isSelected 
                          ? '#6366F1' 
                          : (isP0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.04)')
                      }`,
                      borderRadius: '10px', padding: '12px 16px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px',
                      boxShadow: isP0 ? '0 0 10px rgba(239,68,68,0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'white' }}>{c.user?.name || 'Citizen Distress'}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          Category: <span style={{ color: '#06B6D4', fontWeight: 600 }}>{c.category?.toUpperCase() || 'UNKNOWN'}</span> | Phone: {c.user?.phone || 'N/A'}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          {isP0 && (
                            <span 
                              className="badge badge-error badge-xs animate-pulse" 
                              style={{ fontWeight: 800, background: '#EF4444', color: 'white', border: 'none', padding: '2px 6px' }}
                            >
                              P0 CRITICAL
                            </span>
                          )}
                          <span className={`badge badge-sm ${c.status === 'pending' ? 'badge-error' : 'badge-primary'}`}>{c.status}</span>
                        </div>
                        {isMyAccept && <span style={{ display: 'block', fontSize: '9.5px', color: '#10B981', fontWeight: 600 }}>Assigned</span>}
                      </div>
                    </div>
                    {c.description && (
                      <div style={{ fontSize: '11px', color: '#CBD5E1', fontStyle: 'italic', background: 'rgba(0,0,0,0.15)', padding: '6px 10px', borderRadius: '6px', marginTop: '2px' }}>
                        "{c.description.length > 60 ? c.description.substring(0, 60) + '...' : c.description}"
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedCase && (
          <div className="glass-panel distress-glow" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>Distress Track: {selectedCase.user?.name || 'Citizen'}</h4>
                <p style={{ fontSize: '10px', color: '#94A3B8' }}>Ref ID: {selectedCase._id}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>×</button>
            </div>

            <div ref={mapContainerRef} style={{ height: '220px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }} />

            {selectedCase.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="number" placeholder="ETA Mins" value={etaInput} onChange={(e) => setEtaInput(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px' }} />
                <button onClick={() => handleAcceptSOS(selectedCase._id)} disabled={acceptingCaseId !== null} style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', border: 'none', color: 'white', fontWeight: 600, padding: '0 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Accept</button>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', padding: '10px 14px', borderRadius: '8px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>Responding</span>
                  <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8' }}>ETA: {selectedCase.responderTimeline?.[0]?.eta || 10} mins</span>
                </div>
                <button onClick={() => handleResolveSOS(selectedCase._id)} style={{ background: '#10B981', border: 'none', color: 'white', fontWeight: 600, padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '11px' }}>Resolve</button>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

export default HospitalDashboard;
