import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage, RegisterPage } from './features/auth/AuthPages.jsx';
import AuthGuard from './features/auth/AuthGuard.jsx';
import DashboardShell from './features/dashboard/DashboardShell.jsx';

/**
 * App.jsx – routes only.
 * All logic lives in features/, hooks/, and context/.
 */
const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardShell />
            </AuthGuard>
          }
        />
        {/* Redirect root and unknown paths to login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
