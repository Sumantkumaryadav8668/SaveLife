import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { sosAPI } from '../../models/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Shield, AlertTriangle, MapPin, Clock, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
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

const ResponderDashboard = () => {
  const { user } = useAuth();
  const socket = useSocket();

  // Active cases and history states
  const [activeCases, setActiveCases] = useState([]);
  const [loadingCases, setLoadingCases] = useState(false);
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Selected Active Case for tracking
  const [selectedCase, setSelectedCase] = useState(null);
  const [etaInput, setEtaInput] = useState('');
  const [acceptingCaseId, setAcceptingCaseId] = useState(null);

  // Abuse report modal states
  const [showAbuseModal, setShowAbuseModal] = useState(false);
  const [abuseComment, setAbuseComment] = useState('');
  const [flaggingAbuse, setFlaggingAbuse] = useState(false);

  // Map state
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const citizenMarkerRef = useRef(null);
  const userHasPannedRef = useRef(false);

  useEffect(() => {
    fetchActiveCases();
    fetchHistory();
  }, []);

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
        if (citizenMarkerRef.current) {
          citizenMarkerRef.current.setLatLng(latLng);
          if (mapRef.current) {
            mapRef.current.setView(latLng);
          }
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

  // Leaflet map init
  // Reset user pan on selection change
  useEffect(() => {
    userHasPannedRef.current = false;
  }, [selectedCase?._id]);

  // Leaflet component trigger
  const [selectedLat, selectedLng] = selectedCase?.location?.coordinates || [null, null];
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

      citizenMarkerRef.current = L.marker(latLng, {
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
      if (citizenMarkerRef.current) {
        citizenMarkerRef.current.setLatLng(latLng);
      }
    }
  }, [selectedCase?._id, selectedLat, selectedLng]);

  // Separate map unmount hook
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
    if (!window.confirm('Resolve this case?')) return;
    try {
      const res = await sosAPI.resolve(caseId, 5, 'Resolved by Dispatch Unit');
      if (res.success) {
        setSelectedCase(null);
        fetchActiveCases();
        fetchHistory();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleFlagFalseAlarm = async (e) => {
    e.preventDefault();
    if (!abuseComment) return alert('Provide false alarm description');

    setFlaggingAbuse(true);
    try {
      const res = await sosAPI.flagAbuse(selectedCase._id, abuseComment);
      if (res.success) {
        alert('Flagged as false alarm successfully.');
        setShowAbuseModal(false);
        setAbuseComment('');
        setSelectedCase(null);
        fetchActiveCases();
        fetchHistory();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setFlaggingAbuse(false);
    }
  };

  return (
    <div className="animate-fade-in dashboard-grid responder-grid">
      
      {/* Left Column: Active incidents & operational histories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Shield size={22} style={{ color: user.role === 'police' ? '#3B82F6' : '#F59E0B' }} />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>
                  {user.role === 'police' ? 'Police Dispatch Center' : 'Rescue Command Console'}
                </h3>
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Operational Distress Terminal</span>
              </div>
            </div>
            <button onClick={fetchActiveCases} disabled={loadingCases} className="btn btn-ghost btn-sm btn-circle text-[#06B6D4]">
              <RefreshCw size={16} className={loadingCases ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingCases ? (
            <div style={{ textAlign: 'center', padding: '40px' }}><span className="loading loading-spinner loading-md"></span></div>
          ) : activeCases.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px' }}>🟢 No active incidents.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                      borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px',
                      boxShadow: isP0 ? '0 0 10px rgba(239,68,68,0.08)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <div>
                        <span style={{ fontWeight: 700, color: 'white' }}>{c.user?.name || 'Citizen Distress'}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>
                          Category: <span style={{ color: '#06B6D4', fontWeight: 600 }}>{c.category?.toUpperCase() || 'UNKNOWN'}</span> | {formatDate(c.createdAt)}
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
                        {isMyAccept && <span style={{ display: 'block', fontSize: '9.5px', color: '#10B981', fontWeight: 600 }}>Responding</span>}
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

        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '14px' }}>Dispatch Logs</h3>
          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '10px' }}><span className="loading loading-spinner"></span></div>
          ) : history.length === 0 ? (
            <p style={{ color: '#475569', fontSize: '11px', textAlign: 'center' }}>No history recorded.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {history.map((h) => (
                <div key={h._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                  <div>
                    <span style={{ fontWeight: 700, color: 'white' }}>{h.user?.name || 'Citizen'}</span>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>{formatDate(h.createdAt)}</span>
                  </div>
                  <span className={`badge badge-sm ${h.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>{h.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Right Column: Tracking maps & Action triggers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {selectedCase ? (
          <div className="glass-panel distress-glow" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4 style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>Incident: {selectedCase.user?.name || 'Citizen'}</h4>
                <p style={{ fontSize: '10px', color: '#94A3B8' }}>Ref ID: {selectedCase._id}</p>
              </div>
              <button onClick={() => setSelectedCase(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer' }}>×</button>
            </div>

            <div ref={mapContainerRef} style={{ height: '240px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }} />

            {selectedCase.status === 'pending' ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <input type="number" placeholder="ETA Mins" value={etaInput} onChange={(e) => setEtaInput(e.target.value)} style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '6px 10px', color: 'white', fontSize: '12px' }} />
                <button onClick={() => handleAcceptSOS(selectedCase._id)} disabled={acceptingCaseId !== null} style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)', border: 'none', color: 'white', fontWeight: 600, padding: '0 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>Accept</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)', padding: '10px 14px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 700 }}>RESPONDING ACTIVE</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#10B981' }}>{selectedCase.responderTimeline?.[0]?.eta || 10}m ETA</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => handleResolveSOS(selectedCase._id)} style={{ background: '#10B981', border: 'none', color: 'white', fontWeight: 600, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>Resolve</button>
                  <button onClick={() => setShowAbuseModal(true)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#F87171', fontWeight: 600, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>False Alarm</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span style={{ fontSize: '24px' }}>📡</span>
            <h4 style={{ color: 'white', fontWeight: 700, fontSize: '13px', marginTop: '10px' }}>Dispatch Control Board</h4>
            <p style={{ color: '#64748B', fontSize: '11px', marginTop: '4px' }}>Select an active incident card to map client coordinates and manage response telemetry.</p>
          </div>
        )}

      </div>

      {showAbuseModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifycontent: 'center', zIndex: 9999 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '380px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={18} style={{ color: '#EF4444' }} /> Flag False Alarm
            </h3>
            <p style={{ color: '#94A3B8', fontSize: '11px' }}>
              Flagging this incident as a false alarm will log a policy warning to the citizen account and increment their violation counter.
            </p>
            <form onSubmit={handleFlagFalseAlarm} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <textarea placeholder="Reason (e.g. Accidental click, testing platforms...)" value={abuseComment} onChange={(e) => setAbuseComment(e.target.value)} style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 10px', color: 'white', fontSize: '12px', resize: 'none' }} required />
              <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowAbuseModal(false); setAbuseComment(''); }} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                <button type="submit" disabled={flaggingAbuse} style={{ background: '#EF4444', border: 'none', color: 'white', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Submit Flag</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ResponderDashboard;
