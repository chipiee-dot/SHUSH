import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import Console from './pages/Console.jsx';

function Splash() {
  return <div className="min-h-screen bg-[#1b2d5a]" aria-busy="true" />;
}

// Only signed-in users may open the console.
function Protected({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <Splash />;
  return user ? children : <Navigate to="/login" replace />;
}

// Signed-in users skip the login / sign-up pages.
function GuestOnly({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <Splash />;
  return user ? <Navigate to="/console" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/console" element={<Protected><Console /></Protected>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
