import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { hospitalAPI } from '../../models/api.js';
import { HeartPulse, Search, Calendar, User, Phone, MapPin, CheckCircle, AlertTriangle } from 'lucide-react';

const BedBooking = () => {
  const { user } = useAuth();
  
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Booking modal state
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [bookingForm, setBookingForm] = useState({
    patientName: user?.name || '',
    bedType: 'general'
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  useEffect(() => {
    fetchHospitals();
  }, []);

  const fetchHospitals = async () => {
    setLoading(true);
    try {
      const res = await hospitalAPI.getNearby();
      if (res.success) {
        setHospitals(res.hospitals || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = (hosp) => {
    setSelectedHospital(hosp);
    setBookingForm({
      patientName: user?.name || '',
      bedType: 'general'
    });
    setBookingSuccess(null);
  };

  const handleConfirmBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.patientName) return alert('Enter patient name');

    setBookingLoading(true);
    try {
      const res = await hospitalAPI.bookBed(selectedHospital._id, bookingForm);
      if (res.success) {
        setBookingSuccess(`Bed successfully booked for ${bookingForm.patientName}!`);
        fetchHospitals();
        setTimeout(() => {
          setSelectedHospital(null);
        }, 2000);
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBookingLoading(false);
    }
  };

  const filteredHospitals = hospitals.filter(h =>
    h.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="animate-fade-in dashboard-container-padding" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Title & Search bar */}
      <div className="bed-booking-header">
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'white' }}>Emergency Bed Booking Portal</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>Search and secure hospital beds for yourself or other citizens in distress.</p>
        </div>

        <div className="bed-booking-search">
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
          <input
            type="text"
            placeholder="Search hospitals by name or area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '10px 12px 10px 36px', color: 'white', fontSize: '13px', outline: 'none' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading loading-spinner loading-md"></span></div>
      ) : filteredHospitals.length === 0 ? (
        <p style={{ color: '#64748B', textAlign: 'center', padding: '40px' }}>No hospitals found matching your criteria.</p>
      ) : (
        <div className="hospital-grid">
          {filteredHospitals.map((h) => {
            const genBedsAvail = Math.max(0, (h.hospitalResources?.bedsGeneralTotal || 0) - (h.hospitalResources?.bedsGeneralOccupied || 0));
            const icuBedsAvail = Math.max(0, (h.hospitalResources?.bedsIcuTotal || 0) - (h.hospitalResources?.bedsIcuOccupied || 0));

            return (
              <div key={h._id} className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(6, 182, 212, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <HeartPulse size={20} style={{ color: '#06B6D4' }} />
                  </div>
                  <div>
                    <h4 style={{ color: 'white', fontWeight: 800, fontSize: '14px' }}>{h.name}</h4>
                    <span style={{ fontSize: '10px', color: '#64748B', display: 'block', marginTop: '2px' }}>{h.contactNumber}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px', color: '#94A3B8' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={12} /> {h.address}
                  </span>
                </div>

                {/* Bed Status metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '10px', borderRadius: '10px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block' }}>General Beds</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: genBedsAvail > 0 ? '#10B981' : '#EF4444', display: 'block', marginTop: '2px' }}>
                      {genBedsAvail} <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>/ {h.hospitalResources?.bedsGeneralTotal || 0}</span>
                    </span>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: '10px', color: '#94A3B8', display: 'block' }}>ICU Beds</span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: icuBedsAvail > 0 ? '#10B981' : '#EF4444', display: 'block', marginTop: '2px' }}>
                      {icuBedsAvail} <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>/ {h.hospitalResources?.bedsIcuTotal || 0}</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleOpenBooking(h)}
                  disabled={genBedsAvail === 0 && icuBedsAvail === 0}
                  className="shine-btn"
                  style={{
                    width: '100%',
                    background: (genBedsAvail > 0 || icuBedsAvail > 0) ? 'linear-gradient(135deg, #06B6D4, #3B82F6)' : 'rgba(255,255,255,0.03)',
                    border: 'none',
                    color: (genBedsAvail > 0 || icuBedsAvail > 0) ? 'white' : '#64748B',
                    fontWeight: 600,
                    padding: '8px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    cursor: (genBedsAvail > 0 || icuBedsAvail > 0) ? 'pointer' : 'not-allowed'
                  }}
                >
                  {(genBedsAvail > 0 || icuBedsAvail > 0) ? 'Book Bed Now' : 'No Beds Available'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Booking Form Dialog Modal */}
      {selectedHospital && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'white' }}>Confirm Bed Booking</h3>
              <button onClick={() => setSelectedHospital(null)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '16px' }}>×</button>
            </div>

            {bookingSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px', display: 'flex', flexDirection: 'column', alignitems: 'center', gap: '8px' }}>
                <CheckCircle size={36} style={{ color: '#10B981', margin: '0 auto' }} />
                <p style={{ color: 'white', fontWeight: 700, fontSize: '14px', marginTop: '8px' }}>{bookingSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleConfirmBooking} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '6px' }}>Hospital</label>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{selectedHospital.name}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8' }}>Patient Name</label>
                  <input
                    type="text"
                    value={bookingForm.patientName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, patientName: e.target.value }))}
                    placeholder="Enter patient full name..."
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px 10px', color: 'white', fontSize: '12px', outline: 'none' }}
                    required
                  />
                  <span style={{ fontSize: '9px', color: '#64748B' }}>You can book on behalf of another citizen.</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', color: '#94A3B8' }}>Bed Type</label>
                  <select
                    value={bookingForm.bedType}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, bedType: e.target.value }))}
                    style={{ background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '6px', padding: '8px', color: 'white', fontSize: '12px', outline: 'none' }}
                  >
                    <option value="general">General Ward Bed</option>
                    <option value="icu">ICU Care Bed</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={bookingLoading}
                  style={{
                    background: 'linear-gradient(135deg, #10B981, #059669)',
                    border: 'none',
                    color: 'white',
                    fontWeight: 700,
                    padding: '10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    marginTop: '8px'
                  }}
                >
                  {bookingLoading ? 'Securing Bed...' : 'Confirm Reservation'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default BedBooking;
