import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { StudentAuthProvider } from './context/StudentAuthContext.jsx';
import FacultyShell from './components/FacultyShell.jsx';
import StudentShell from './components/StudentShell.jsx';
import StartPage from './pages/StartPage.jsx';
import Login from './pages/Login.jsx';
import SignUp from './pages/SignUp.jsx';
import Dashboard from './pages/faculty/Dashboard.jsx';
import TableLayout from './pages/faculty/TableLayout.jsx';
import Rewards from './pages/faculty/Rewards.jsx';
import History from './pages/faculty/History.jsx';
import Settings from './pages/faculty/Settings.jsx';
import StudentLogin from './pages/student/StudentLogin.jsx';
import StudentSignUp from './pages/student/StudentSignUp.jsx';
import StudentTable from './pages/student/StudentTable.jsx';

function Splash() {
  return <div className="min-h-screen bg-[#1b2d5a]" aria-busy="true" />;
}

// Only signed-in faculty may open the console.
function Protected({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <Splash />;
  return user ? children : <Navigate to="/login" replace />;
}

// Signed-in faculty skip the faculty login / sign-up pages.
function GuestOnly({ children }) {
  const { user, checking } = useAuth();
  if (checking) return <Splash />;
  return user ? <Navigate to="/console" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StartPage />} />

      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/console" element={<Protected><FacultyShell /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="layout" element={<TableLayout />} />
        <Route path="rewards" element={<Rewards />} />
        <Route path="history" element={<History />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="dashboard" replace />} />
      </Route>

      <Route
        path="/student"
        element={<StudentAuthProvider><StudentShell /></StudentAuthProvider>}
      >
        <Route index element={<Navigate to="login" replace />} />
        <Route path="login" element={<StudentLogin />} />
        <Route path="signup" element={<StudentSignUp />} />
        <Route path="table" element={<StudentTable />} />
        <Route path="*" element={<Navigate to="login" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
