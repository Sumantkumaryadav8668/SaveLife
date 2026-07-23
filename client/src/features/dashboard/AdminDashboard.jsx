import React, { useState, useEffect } from 'react';
import { adminAPI, chatbotAPI } from '../../models/api.js';
import { useSocket } from '../../hooks/useSocket.js';
import { Shield, Users, AlertTriangle, Calendar, FileText, CheckCircle, BarChart2, Check, X, ShieldAlert, Ban, Clock, Search } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { formatDate } from '../../lib/utils.js';

const COLORS = ['#06B6D4', '#3B82F6', '#EF4444'];

const AdminDashboard = () => {
  const socket = useSocket();

  // Tab views
  const [activeTab, setActiveTab] = useState('overview');

  // Operational states
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [updatingRole, setUpdatingRole] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(null);

  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loadingVerifications, setLoadingVerifications] = useState(false);

  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'verifications') fetchPendingVerifications();
    if (activeTab === 'tickets') fetchTickets();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;
    const handleSOS = () => {
      if (activeTab === 'overview') fetchAnalytics();
    };
    socket.on('sos_alert', handleSOS);
    socket.on('sos_resolved', handleSOS);
    return () => {
      socket.off('sos_alert', handleSOS);
      socket.off('sos_resolved', handleSOS);
    };
  }, [socket, activeTab]);

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await adminAPI.getAnalytics();
      if (res.success) {
        setAnalytics(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminAPI.getUsers();
      if (res.success) {
        setUsers(res.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPendingVerifications = async () => {
    setLoadingVerifications(true);
    try {
      const res = await adminAPI.getPendingVerifications();
      if (res.success) {
        setPendingVerifications(res.users || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVerifications(false);
    }
  };

  const fetchTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await chatbotAPI.getTickets();
      if (res.success) {
        setTickets(res.tickets || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTickets(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await adminAPI.getAuditLogs();
      if (res.success) {
        setAuditLogs(res.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleRoleElevation = async (userId, currentRole) => {
    const nextRoleMap = {
      'user': 'hospital_admin',
      'hospital_admin': 'police',
      'police': 'rescue_person',
      'rescue_person': 'system_admin',
      'system_admin': 'user'
    };
    const nextRole = nextRoleMap[currentRole] || 'user';

    if (!window.confirm(`Elevate user role to "${nextRole}"?`)) return;
    setUpdatingRole(userId);
    try {
      const res = await adminAPI.updateUserRole(userId, nextRole);
      if (res.success) {
        alert('Role promoted.');
        fetchUsers();
      }
    } catch (err) {
      alert('Error updating role: ' + err.message);
    } finally {
      setUpdatingRole(null);
    }
  };

  const handleUpdateStatus = async (userId, currentStatus) => {
    let targetStatus = 'active';
    let duration = 0;

    if (currentStatus === 'active') {
      const option = window.confirm('Suspend account? (Click Cancel to Block Permanently)');
      if (option) {
        targetStatus = 'suspended';
        const hours = prompt('Suspend duration (Hours):', '24');
        duration = parseInt(hours) || 24;
      } else {
        targetStatus = 'blocked';
      }
    }

    if (currentStatus !== 'active' && !window.confirm('Re-activate account?')) return;

    setUpdatingStatus(userId);
    try {
      const res = await adminAPI.updateUserStatus(userId, targetStatus, duration);
      if (res.success) {
        alert(`Status updated successfully.`);
        fetchUsers();
      }
    } catch (err) {
      alert('Error updating user status: ' + err.message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleVerification = async (userId, approveStatus) => {
    try {
      const res = await adminAPI.updateVerificationStatus(userId, approveStatus);
      if (res.success) {
        alert(`Verification updated.`);
        fetchPendingVerifications();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleResolveTicket = async (ticketId) => {
    try {
      const res = await chatbotAPI.resolveTicket(ticketId);
      if (res.success) {
        alert('Ticket resolved.');
        fetchTickets();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredUsers = users.filter(u =>
    u.name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.phone?.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Summaries Header */}
      {analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          
          <div className="glass-panel stat-card stat-glow-indigo">
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Total Incidents Logged</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: 'white' }}>{analytics.summary?.totalCases || 0}</span>
            </div>
          </div>

          <div className="glass-panel stat-card stat-glow-red">
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Active distress Cases</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#EF4444' }}>
                {(analytics.summary?.pending || 0) + (analytics.summary?.accepted || 0)}
              </span>
              <span style={{ fontSize: '9px', color: '#EF4444', fontWeight: 700, animation: 'pulse 1s infinite' }}>LIVE</span>
            </div>
          </div>

          <div className="glass-panel stat-card stat-glow-green">
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Resolved Incidents</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{analytics.summary?.resolved || 0}</span>
              <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
                {Math.round(((analytics.summary?.resolved || 0) / (analytics.summary?.totalCases || 1)) * 100)}%
              </span>
            </div>
          </div>

          <div className="glass-panel stat-card stat-glow-blue">
            <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>Response Duration</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '8px' }}>
              <span style={{ fontSize: '24px', fontWeight: 900, color: '#06B6D4' }}>{analytics.summary?.averageResponseTimeMins || 0}m</span>
              <span style={{ fontSize: '11px', color: '#06B6D4', fontWeight: 600 }}>Dispatch ETA</span>
            </div>
          </div>

        </div>
      )}

      {/* Navigation Menu */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px' }}>
        {[
          { id: 'overview', label: 'Analytics', icon: <BarChart2 size={14} /> },
          { id: 'users', label: 'User Directory', icon: <Users size={14} /> },
          { id: 'verifications', label: 'Verification Center', icon: <Shield size={14} />, badge: pendingVerifications.length },
          { id: 'tickets', label: 'Bot Tickets', icon: <AlertTriangle size={14} />, badge: tickets.filter(t => t.status === 'open').length },
          { id: 'audit', label: 'System Audits', icon: <FileText size={14} /> }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: activeTab === t.id ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
              border: `1px solid ${activeTab === t.id ? 'rgba(99, 102, 241, 0.25)' : 'transparent'}`,
              color: activeTab === t.id ? '#818CF8' : '#94A3B8',
              borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            {t.icon}
            {t.label}
            {t.badge > 0 && (
              <span style={{ background: '#EF4444', color: 'white', fontSize: '9px', fontWeight: 700, borderRadius: '99px', padding: '1px 4px', marginLeft: '2px' }}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '380px' }}>
        
        {/* Analytics charts overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {loadingAnalytics ? (
              <div style={{ textAlign: 'center', padding: '60px' }}><span className="loading loading-spinner loading-md"></span></div>
            ) : analytics ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
                
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ fontSize: '14px', color: 'white', fontWeight: 700 }}>Distress Case Frequency</h4>
                  <div style={{ height: '300px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={analytics.history || []}>
                        <defs>
                          <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} tickLine={false} />
                        <YAxis stroke="#475569" fontSize={10} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="cases" stroke="#6366F1" fillOpacity={1} fill="url(#colorCases)" strokeWidth={2} name="Distress Cases" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '14px', color: 'white', fontWeight: 700, width: '100%' }}>Case Classifications</h4>
                  <div style={{ height: '200px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={analytics.types || []}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={70}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {(analytics.types || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#0F172A', border: 'none', borderRadius: '8px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
                    {(analytics.types || []).map((entry, idx) => (
                      <div key={entry.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS[idx % COLORS.length] }}></span>
                          {entry.name}
                        </span>
                        <span style={{ color: 'white', fontWeight: 700 }}>{entry.value} Cases</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ) : (
              <p style={{ color: '#64748B', textAlign: 'center' }}>Analytics load error.</p>
            )}
          </div>
        )}

        {/* Directory users list */}
        {activeTab === 'users' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 800 }}>Users Management Console</h4>
              <div style={{ position: 'relative', width: '260px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }} />
                <input
                  type="text"
                  placeholder="Search user email or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '8px 10px 8px 30px', color: 'white', fontSize: '12px' }}
                />
              </div>
            </div>

            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><span className="loading loading-spinner"></span></div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table w-full text-left" style={{ borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#94A3B8' }}>
                      <th style={{ padding: '10px' }}>User Details</th>
                      <th style={{ padding: '10px' }}>Role</th>
                      <th style={{ padding: '10px' }}>False Alarms</th>
                      <th style={{ padding: '10px' }}>Status</th>
                      <th style={{ padding: '10px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => (
                      <tr key={u.id || u._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', color: '#CBD5E1' }}>
                        <td style={{ padding: '10px' }}>
                          <span style={{ display: 'block', fontWeight: 700, color: 'white' }}>{u.name}</span>
                          <span style={{ fontSize: '10px', color: '#64748B' }}>{u.email}</span>
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span className="badge badge-sm badge-ghost">{u.role}</span>
                        </td>
                        <td style={{ padding: '10px', fontWeight: 700, color: u.falseAlarmsCount > 0 ? '#EF4444' : '#64748B' }}>
                          {u.falseAlarmsCount || 0}
                        </td>
                        <td style={{ padding: '10px' }}>
                          <span className={`badge badge-sm ${u.status === 'active' ? 'badge-success' : 'badge-warning'}`}>{u.status}</span>
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => handleRoleElevation(u.id || u._id, u.role)}
                            disabled={updatingRole === (u.id || u._id)}
                            style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', color: '#818CF8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(u.id || u._id, u.status)}
                            disabled={updatingStatus === (u.id || u._id)}
                            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}
                          >
                            {u.status === 'active' ? 'Sanction' : 'Reactivate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Pending ID lists */}
        {activeTab === 'verifications' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 800 }}>ID Verifications Queue</h4>

            {loadingVerifications ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><span className="loading loading-spinner"></span></div>
            ) : pendingVerifications.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>🟢 No requests pending.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {pendingVerifications.map((v) => (
                  <div key={v._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <h5 style={{ color: 'white', fontWeight: 700, fontSize: '13px' }}>{v.name}</h5>
                      <span style={{ fontSize: '10px', color: '#64748B', display: 'block' }}>Email: {v.email}</span>
                    </div>

                    {v.idVerification?.idImage && (
                      <div style={{ height: '140px', borderRadius: '6px', overflow: 'hidden', background: '#090d16', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <img src={v.idVerification.idImage} alt="User Document ID" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <button onClick={() => handleVerification(v._id, 'verified')} style={{ flex: 1, background: '#10B981', border: 'none', color: 'white', borderRadius: '6px', padding: '6px', fontSize: '11px', cursor: 'pointer' }}>Verify</button>
                      <button onClick={() => handleVerification(v._id, 'rejected')} style={{ flex: 1, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)', color: '#EF4444', borderRadius: '6px', padding: '6px', fontSize: '11px', cursor: 'pointer' }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Chatbot escalated tickets */}
        {activeTab === 'tickets' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 800 }}>Chatbot Escalated Tickets</h4>

            {loadingTickets ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><span className="loading loading-spinner"></span></div>
            ) : tickets.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>🟢 No support tickets logged.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tickets.map((t) => (
                  <div key={t._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'white' }}>Ref: {t._id.slice(-6)}</span>
                        <span className={`badge badge-sm ${t.status === 'open' ? 'badge-error' : 'badge-success'}`}>{t.status}</span>
                      </div>
                      <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}><b>Query:</b> "{t.initialMessage}"</p>
                    </div>
                    {t.status === 'open' && (
                      <button onClick={() => handleResolveTicket(t._id)} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)', color: '#10B981', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', cursor: 'pointer' }}>Resolve</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Administrative logs audit trail */}
        {activeTab === 'audit' && (
          <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ fontSize: '15px', color: 'white', fontWeight: 800 }}>Audit Timeline Feed</h4>

            {loadingLogs ? (
              <div style={{ textAlign: 'center', padding: '20px' }}><span className="loading loading-spinner"></span></div>
            ) : auditLogs.length === 0 ? (
              <p style={{ color: '#475569', textAlign: 'center', padding: '20px' }}>No logs recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
                {auditLogs.map((l) => (
                  <div key={l._id} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div>
                      <span style={{ background: 'rgba(99,102,241,0.08)', color: '#818CF8', padding: '2px 4px', borderRadius: '4px', fontSize: '10px', fontWeight: 700 }}>{l.action}</span>
                      <p style={{ color: 'white', marginTop: '4px' }}>{l.details}</p>
                    </div>
                    <span style={{ fontSize: '10px', color: '#64748B', whiteSpace: 'nowrap' }}>{formatDate(l.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
};

export default AdminDashboard;
