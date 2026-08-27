import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { authAPI } from '../../services/api.service.js';

// ── Password strength helper ──
const getPasswordStrength = (pass) => {
  if (!pass) return { label: 'Empty', score: 0 };
  let score = 0;
  if (pass.length >= 6) score++;
  if (/[A-Z]/.test(pass)) score++;
  if (/[0-9]/.test(pass)) score++;
  if (/[^A-Za-z0-9]/.test(pass)) score++;
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const colors = ['', '#EF4444', '#F97316', '#22C55E', '#3B82F6'];
  return { label: labels[score] || 'Too short', score, color: colors[score] || '#334155' };
};

const handleRoleMap = (roleName) => {
  if (roleName === 'Citizen') return 'user';
  if (['Hospital', 'Doctor', 'Blood Bank'].includes(roleName)) return 'hospital_admin';
  if (roleName === 'Police') return 'police';
  if (['Fire Department', 'Volunteer', 'Government'].includes(roleName)) return 'rescue_person';
  return 'user';
};

// ── Login Page ──
export const LoginPage = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const validate = () => {
    const e = {};
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.login({ email: form.email, password: form.password });
      if (res.success) {
        login(res.accessToken, res.user);
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-card" style={{ width: '100%', maxWidth: '500px', background: 'rgba(17,24,39,0.75)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', padding: '48px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(37,99,235,0.14)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }} />
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '38px', color: '#F8FAFC', marginBottom: '8px' }}>Welcome Back</h1>
        <p style={{ color: '#94A3B8', fontSize: '15px', marginBottom: '28px' }}>Sign in to access your SaveLife emergency account.</p>

        {authError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '11px 15px', marginBottom: '18px', color: '#FCA5A5', fontSize: '13px', fontWeight: 500 }}>⚠ {authError}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#CBD5E1', marginBottom: '8px', fontFamily: "'Inter',sans-serif" }}>Email / Username</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
              </span>
              <input type="email" placeholder="citizen@sdec.org" value={form.email}
                onChange={(e) => { setForm(p => ({...p, email: e.target.value})); setErrors(p => ({...p, email: ''})); }}
                className={`auth-input${errors.email ? ' err' : ''}`} />
            </div>
            {errors.email && <p style={{ color: '#F87171', fontSize: '12px', marginTop: '5px', fontWeight: 500 }}>{errors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: '#CBD5E1', fontFamily: "'Inter',sans-serif" }}>Password</label>
              <a href="#" style={{ fontSize: '12px', color: '#06B6D4', fontWeight: 500, textDecoration: 'none' }}>Forgot Password?</a>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              <input type={showPw ? 'text' : 'password'} placeholder="Enter your password" value={form.password}
                onChange={(e) => { setForm(p => ({...p, password: e.target.value})); setErrors(p => ({...p, password: ''})); }}
                className={`auth-input${errors.password ? ' err' : ''}`} style={{ paddingRight: '46px' }} />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{showPw ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}</svg>
              </button>
            </div>
            {errors.password && <p style={{ color: '#F87171', fontSize: '12px', marginTop: '5px', fontWeight: 500 }}>{errors.password}</p>}
          </div>

          <button type="submit" disabled={loading} className="shine-btn"
            style={{ width: '100%', height: '52px', background: 'linear-gradient(135deg, #2563EB, #06B6D4)', border: 'none', borderRadius: '14px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 24px rgba(37,99,235,0.35)', transition: 'transform 0.2s, box-shadow 0.2s', marginTop: '8px', opacity: loading ? 0.7 : 1 }}>
            {loading ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} /> Authenticating...</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In</>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '14px', color: '#64748B' }}>
          Don't have an account?{' '}
          <button onClick={() => navigate('/register')} style={{ background: 'none', border: 'none', color: '#06B6D4', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: "'Inter',sans-serif" }}>
            Register Now →
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

// ── Register Page ──
export const RegisterPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'user' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState({});
  const [authError, setAuthError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  const validate = () => {
    const e = {};
    if (!form.name) e.name = 'Full name is required';
    if (!form.email) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone) e.phone = 'Phone number is required';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Minimum 6 characters';
    if (form.password !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (!termsAccepted) e.terms = 'You must accept the Terms & Conditions';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register(form);
      if (res.success) {
        setSuccess(true);
        setTimeout(() => navigate('/login', { replace: true }), 2000);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const pwStr = getPasswordStrength(form.password);

  return (
    <AuthLayout>
      {success && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: '#0b1329', padding: '40px', borderRadius: '20px', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', maxWidth: '340px' }}>
            <div style={{ width: '64px', height: '64px', background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', fontSize: '28px' }}>✓</div>
            <h3 style={{ color: 'white', fontWeight: 800, fontFamily: "'Space Grotesk',sans-serif", marginBottom: '8px' }}>Registration Successful!</h3>
            <p style={{ color: '#94A3B8', fontSize: '13px' }}>Redirecting to login...</p>
          </div>
        </div>
      )}

      <div className="auth-card" style={{ width: '100%', maxWidth: '680px', background: 'rgba(17,24,39,0.75)', backdropFilter: 'blur(20px)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', padding: '48px', position: 'relative', overflow: 'hidden', boxShadow: '0 0 60px rgba(37,99,235,0.14)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }} />
        <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '38px', color: '#F8FAFC', marginBottom: '8px' }}>Create Account</h1>
        <p style={{ color: '#94A3B8', fontSize: '15px', marginBottom: '28px' }}>Join the SaveLife Emergency Network and protect your community.</p>

        {authError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '11px 15px', marginBottom: '18px', color: '#FCA5A5', fontSize: '13px', fontWeight: 500 }}>⚠ {authError}</div>}

        <form onSubmit={handleSubmit}>
          {/* Row 1: Name + Phone */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Field label="Full Name" error={errors.name} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}>
              <input type="text" placeholder="John Doe" value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))} className={`auth-input${errors.name ? ' err' : ''}`} />
            </Field>
            <Field label="Mobile Number" error={errors.phone} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>}>
              <input type="tel" placeholder="+919876543210" value={form.phone} onChange={(e) => setForm(p => ({...p, phone: e.target.value}))} className={`auth-input${errors.phone ? ' err' : ''}`} />
            </Field>
          </div>

          {/* Row 2: Email + Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <Field label="Email Address" error={errors.email} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}>
              <input type="email" placeholder="citizen@sdec.org" value={form.email} onChange={(e) => setForm(p => ({...p, email: e.target.value}))} className={`auth-input${errors.email ? ' err' : ''}`} />
            </Field>
            <Field label="Role" icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}>
              <select onChange={(e) => setForm(p => ({...p, role: handleRoleMap(e.target.value)}))} className="auth-select">
                {['Citizen','Hospital','Police','Volunteer','System Design'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          {/* Row 3: Password + Confirm */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div>
              <Field label="Password" error={errors.password} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}>
                <input type={showPw ? 'text' : 'password'} placeholder="Min. 6 characters" value={form.password} onChange={(e) => setForm(p => ({...p, password: e.target.value}))} className={`auth-input${errors.password ? ' err' : ''}`} style={{ paddingRight: '46px' }} />
                <EyeBtn show={showPw} toggle={() => setShowPw(v => !v)} />
              </Field>
              {form.password && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Strength</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: pwStr.color }}>{pwStr.label}</span>
                  </div>
                  <div style={{ height: '3px', background: '#1E293B', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(pwStr.score / 4) * 100}%`, background: pwStr.color, borderRadius: '999px', transition: 'all 0.4s ease' }} />
                  </div>
                </div>
              )}
            </div>
            <div>
              <Field label="Confirm Password" error={errors.confirmPassword} icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}>
                <input type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={`auth-input${errors.confirmPassword ? ' err' : ''}`} style={{ paddingRight: '46px' }} />
                <EyeBtn show={showConfirm} toggle={() => setShowConfirm(v => !v)} />
              </Field>
              {confirmPassword && form.password && (
                <p style={{ fontSize: '12px', marginTop: '6px', fontWeight: 500, color: confirmPassword === form.password ? '#22C55E' : '#F87171', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {confirmPassword === form.password ? '✓ Passwords match' : '✗ Passwords don\'t match'}
                </p>
              )}
            </div>
          </div>

          {/* Terms */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
              <input type="checkbox" checked={termsAccepted} onChange={(e) => { setTermsAccepted(e.target.checked); setErrors(p => ({...p, terms: ''})); }} style={{ width: '18px', height: '18px', accentColor: '#2563EB', cursor: 'pointer', flexShrink: 0, marginTop: '2px' }} />
              <span style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5, fontFamily: "'Inter',sans-serif", userSelect: 'none' }}>
                I agree to the <span style={{ color: '#06B6D4', fontWeight: 500 }}>Terms of Service</span> and <span style={{ color: '#06B6D4', fontWeight: 500 }}>Privacy Policy</span> of SAVE LIFE – SDEC
              </span>
            </label>
            {errors.terms && <p style={{ color: '#F87171', fontSize: '12px', marginTop: '6px', fontWeight: 500, marginLeft: '30px' }}>{errors.terms}</p>}
          </div>

          <button type="submit" disabled={loading} className="shine-btn"
            style={{ width: '100%', height: '52px', background: 'linear-gradient(135deg, #2563EB, #06B6D4)', border: 'none', borderRadius: '14px', color: 'white', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 24px rgba(37,99,235,0.35)', opacity: loading ? 0.7 : 1 }}>
            {loading ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} /> Creating Account...</> : 'Create Account →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: '14px', color: '#64748B' }}>
          Already have an account?{' '}
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#06B6D4', fontWeight: 600, cursor: 'pointer', fontSize: '14px', fontFamily: "'Inter',sans-serif" }}>
            Login →
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};

// ── Sub-components ──
const AuthLayout = ({ children }) => (
  <div style={{ minHeight: '100vh', width: '100vw', background: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 16px', position: 'relative', overflowY: 'auto' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #020617, #0F172A, #111827)', zIndex: 0, pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px)', backgroundSize: '28px 28px', zIndex: 0, pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', top: '25%', left: '50%', transform: 'translate(-50%,-50%)', width: '600px', height: '600px', background: 'rgba(37,99,235,0.07)', borderRadius: '50%', filter: 'blur(80px)', zIndex: 0, pointerEvents: 'none' }} />
    {/* Brand top-left */}
    <div style={{ position: 'fixed', top: '24px', left: '24px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="#2563EB" fillOpacity="0.1"/>
        <path d="M13 10h5l-6 8v-6H7l6-8v6z" fill="#06B6D4" stroke="none"/>
      </svg>
      <div>
        <div style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 800, fontSize: '22px', color: 'white', lineHeight: 1 }}>
          SAVE <span style={{ color: '#EF4444' }}>LIFE</span> – <span style={{ background: '#2563EB', color: 'white', fontSize: '11px', fontWeight: 900, padding: '2px 6px', borderRadius: '5px', letterSpacing: '1px' }}>SDEC</span>
        </div>
        <div style={{ fontSize: '10px', color: '#94A3B8', letterSpacing: '1px', textTransform: 'uppercase', marginTop: '2px' }}>Smart Disaster & Emergency Controller</div>
      </div>
    </div>
    <div style={{ position: 'relative', zIndex: 10, width: '100%', display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
      {children}
    </div>
  </div>
);

const Field = ({ label, error, icon, children }) => (
  <div>
    <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#CBD5E1', marginBottom: '8px', fontFamily: "'Inter',sans-serif" }}>{label}</label>
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#64748B', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>{icon}</span>
      {children}
    </div>
    {error && <p style={{ color: '#F87171', fontSize: '12px', marginTop: '5px', fontWeight: 500 }}>{error}</p>}
  </div>
);

const EyeBtn = ({ show, toggle }) => (
  <button type="button" onClick={toggle} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', zIndex: 5 }}>
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{show ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></> : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>}</svg>
  </button>
);
