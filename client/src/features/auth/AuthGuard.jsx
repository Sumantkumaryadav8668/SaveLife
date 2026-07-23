import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';
import { Loader2 } from 'lucide-react';

/**
 * AuthGuard – wraps protected routes.
 * Shows loader while session is being verified, redirects to /login if unauthenticated.
 */
const AuthGuard = ({ children }) => {
  const { user, appLoading } = useAuth();

  if (appLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0b0f19', color: '#94A3B8' }}>
        <Loader2 size={32} style={{ color: '#6366F1', marginBottom: '12px', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase' }}>RapidAid Core starting...</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
};

export default AuthGuard;
