import { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../../hooks/useNotifications.js';
import { timeAgo } from '../../lib/utils.js';

const typeIcon = {
  sos_alert: '🚨',
  sos_update: '📍',
  sos_resolved: '✅',
  hospital: '🏥',
  police: '👮',
  rescue: '🚒',
  system: '⚙️',
  general: '🔔',
};

const typeColor = {
  sos_alert: '#EF4444',
  sos_update: '#F97316',
  sos_resolved: '#22C55E',
  hospital: '#06B6D4',
  police: '#3B82F6',
  rescue: '#F59E0B',
  system: '#8B5CF6',
  general: '#94A3B8',
};

const NotificationBell = () => {
  const { notifications, unreadCount, loading, fetchNotifications, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  // Fetch on mount
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Close panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        style={{
          position: 'relative',
          background: open ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${open ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: '12px',
          padding: '8px 10px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s',
          color: open ? '#818CF8' : '#94A3B8',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)'; e.currentTarget.style.color = '#A5B4FC'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = open ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = open ? '#818CF8' : '#94A3B8'; }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '-6px', right: '-6px',
            background: 'linear-gradient(135deg, #EF4444, #DC2626)',
            color: 'white', borderRadius: '999px',
            fontSize: '10px', fontWeight: 800,
            minWidth: '18px', height: '18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 4px', border: '2px solid #0b0f19',
            animation: unreadCount > 0 ? 'pulse 2s infinite' : 'none',
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div id="notification-panel" style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0,
          width: '360px', maxWidth: 'calc(100vw - 24px)',
          background: '#0F172A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(99,102,241,0.1)',
          zIndex: 9999,
          overflow: 'hidden',
          animation: 'slideDown 0.2s ease',
        }}>
          {/* Panel Header */}
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#F1F5F9' }}>Notifications</span>
              {unreadCount > 0 && (
                <span style={{
                  background: 'rgba(99,102,241,0.2)', color: '#818CF8',
                  border: '1px solid rgba(99,102,241,0.3)',
                  borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                  padding: '1px 8px',
                }}>{unreadCount} new</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.target.style.background = 'rgba(99,102,241,0.1)'}
                onMouseLeave={(e) => e.target.style.background = 'none'}
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                <div style={{ width: '24px', height: '24px', border: '2px solid #334155', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔔</div>
                <p style={{ color: '#64748B', fontSize: '13px', fontWeight: 500 }}>No notifications yet</p>
                <p style={{ color: '#475569', fontSize: '12px' }}>SOS alerts and system updates will appear here</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.read && markRead(n._id)}
                  style={{
                    padding: '14px 20px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    background: n.read ? 'transparent' : 'rgba(99,102,241,0.05)',
                    cursor: n.read ? 'default' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => { if (!n.read) e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
                  onMouseLeave={(e) => { if (!n.read) e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                >
                  {/* Type icon */}
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: `${typeColor[n.type] || '#94A3B8'}18`,
                    border: `1px solid ${typeColor[n.type] || '#94A3B8'}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                  }}>
                    {typeIcon[n.type] || '🔔'}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: n.read ? 500 : 700, color: n.read ? '#94A3B8' : '#F1F5F9', truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#6366F1', flexShrink: 0 }} />
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {n.message}
                    </p>
                    <span style={{ fontSize: '11px', color: '#475569', marginTop: '4px', display: 'block' }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <button
                onClick={() => { fetchNotifications(); }}
                style={{ background: 'none', border: 'none', color: '#6366F1', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
              >
                Refresh notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
