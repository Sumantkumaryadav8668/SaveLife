import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.js';
import { ROLE_LABELS, ROLES } from '../../constants/roles.js';
import NotificationBell from '../notifications/NotificationBell.jsx';
import RapidBot from '../../components/RapidBot.jsx';

// Import dashboards & sub-views
import CitizenDashboard from './CitizenDashboard.jsx';
import HospitalDashboard from './HospitalDashboard.jsx';
import ResponderDashboard from './ResponderDashboard.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import BedBooking from './BedBooking.jsx';
import FullPageBot from './FullPageBot.jsx';

import { Shield, Moon, Sun, LogOut, User, Activity, AlertTriangle, ShieldAlert, HeartPulse } from 'lucide-react';

const DashboardShell = () => {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('rapidaid_theme') || 'dark');
  const [currentTab, setCurrentTab] = useState('console');
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);

  // Sync theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rapidaid_theme', theme);
  }, [theme]);

  // Click outside handler to dismiss profile dropdown
  useEffect(() => {
    if (!showProfileDropdown) return;
    const handleClose = () => setShowProfileDropdown(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [showProfileDropdown]);

  // Dev mode service worker unregistration helper on mount
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const r of registrations) {
          r.unregister().then((success) => {
            if (success) {
              console.log('[LifeSave] Cleared stale worker on dashboard mount:', r);
              window.location.reload();
            }
          });
        }
      });
    }
  }, []);

  const toggleTheme = () => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  };

  const renderRoleDashboard = () => {
    switch (user?.role) {
      case ROLES.SYSTEM_ADMIN:
        return <AdminDashboard />;
      case ROLES.HOSPITAL_ADMIN:
        return <HospitalDashboard />;
      case ROLES.POLICE:
      case ROLES.RESCUE_PERSON:
        return <ResponderDashboard />;
      case ROLES.USER:
      default:
        return <CitizenDashboard />;
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'beds':
        return <BedBooking />;
      case 'bot':
        return <FullPageBot />;
      case 'console':
      default:
        return renderRoleDashboard();
    }
  };

  const getRoleIcon = () => {
    switch (user?.role) {
      case ROLES.SYSTEM_ADMIN:
        return <ShieldAlert size={14} className="text-red-400" />;
      case ROLES.HOSPITAL_ADMIN:
        return <HeartPulse size={14} className="text-cyan-400" />;
      case ROLES.POLICE:
        return <Shield size={14} className="text-blue-400" />;
      case ROLES.RESCUE_PERSON:
        return <Activity size={14} className="text-amber-400" />;
      case ROLES.USER:
      default:
        return <User size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="app-shell min-h-screen flex flex-col" style={{ background: theme === 'dark' ? '#0b0f19' : '#f8fafc', transition: 'background 0.3s' }}>
      
      {/* Premium Glassmorphic Navbar */}
      <header className="dashboard-header py-6 px-10 flex justify-between items-center shadow-xl border-b border-white/5 sticky top-0 z-50" style={{ height: '96px', background: theme === 'dark' ? 'rgba(11, 15, 25, 0.85)' : 'rgba(255, 255, 255, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)' }}>
        
        {/* Brand details */}
        <div className="flex items-center gap-4">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#2563EB" fillOpacity="0.1"/>
            <path d="M13 10h5l-6 8v-6H7l6-8v6z" fill="#06B6D4" stroke="none"/>
          </svg>
          <div>
            <div className="font-black text-xl tracking-wider leading-none" style={{ color: theme === 'dark' ? 'white' : '#0f172a', fontFamily: "'Space Grotesk',sans-serif" }}>
              SAVE <span style={{ color: '#EF4444' }}>LIFE</span>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold block mt-1.5">DISASTER CONTROLLER</span>
          </div>
        </div>

        {/* Tab Selector Links */}
        <nav className="flex gap-3">
          {[
            { id: 'console', label: 'Distress Console' },
            { id: 'beds', label: 'Bed Bookings' },
            { id: 'bot', label: 'RapidBot AI' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCurrentTab(tab.id)}
              style={{
                background: currentTab === tab.id ? 'rgba(99, 102, 241, 0.12)' : 'transparent',
                border: `1px solid ${currentTab === tab.id ? 'rgba(99, 102, 241, 0.3)' : 'transparent'}`,
                color: currentTab === tab.id ? '#818CF8' : '#64748B',
                borderRadius: '10px', padding: '10px 20px', fontSize: '13px', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User profile controls & triggers */}
        <div className="flex items-center gap-5">
          <NotificationBell />

          <button 
            onClick={toggleTheme}
            className="p-3 rounded-xl border border-white/10 cursor-pointer text-slate-400 hover:text-white transition"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            {theme === 'dark' ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
          </button>

          {user && (
            <div className="relative pl-5 border-l border-white/10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowProfileDropdown(!showProfileDropdown); }}
                className="flex items-center gap-3.5 cursor-pointer outline-none select-none text-left"
                style={{ background: 'none', border: 'none' }}
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center font-black text-indigo-400 text-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-sm" style={{ color: theme === 'dark' ? 'white' : '#0f172a' }}>{user.name}</span>
                  <span className="text-xs text-slate-500 font-medium block">{user.email}</span>
                </div>
              </button>

              {showProfileDropdown && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl border shadow-2xl p-2 z-50 flex flex-col gap-1" style={{ background: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
                  <div className="px-3 py-2 border-b flex flex-col" style={{ borderBottomColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Role</span>
                    <div className="flex items-center gap-1.5 mt-1 text-xs font-bold text-slate-300">
                      {getRoleIcon()}
                      <span className="uppercase tracking-wide">{ROLE_LABELS[user.role]}</span>
                    </div>
                  </div>
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition cursor-pointer"
                    style={{ background: 'none', border: 'none' }}
                  >
                    <LogOut size={14} /> Log Out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main dashboard content container */}
      <main className="flex-1 w-full max-w-[1520px] mx-auto py-6 px-4">
        {renderContent()}
      </main>

      <RapidBot />

    </div>
  );
};

export default DashboardShell;
