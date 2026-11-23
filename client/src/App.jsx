import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { StudentAuthProvider } from './context/StudentAuthContext.jsx';
import StartPage from './pages/StartPage.jsx';

// Only the landing page is loaded up front. Every other page is fetched when it is first opened, so the first
// screen downloads far less code (a student never downloads the faculty console, and the other way round).
const FacultyShell = lazy(() => import('./components/FacultyShell.jsx'));
const StudentShell = lazy(() => import('./components/StudentShell.jsx'));
const Login = lazy(() => import('./pages/Login.jsx'));
const SignUp = lazy(() => import('./pages/SignUp.jsx'));
const Dashboard = lazy(() => import('./pages/faculty/Dashboard.jsx'));
const TableLayout = lazy(() => import('./pages/faculty/TableLayout.jsx'));
const Students = lazy(() => import('./pages/faculty/Students.jsx'));
const Rewards = lazy(() => import('./pages/faculty/Rewards.jsx'));
const History = lazy(() => import('./pages/faculty/History.jsx'));
const Settings = lazy(() => import('./pages/faculty/Settings.jsx'));
const StudentLogin = lazy(() => import('./pages/student/StudentLogin.jsx'));
const StudentSignUp = lazy(() => import('./pages/student/StudentSignUp.jsx'));
const StudentTable = lazy(() => import('./pages/student/StudentTable.jsx'));

function Splash() {
  return <div className="min-h-screen shush-cloud" aria-busy="true" />;
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
    <Suspense fallback={<Splash />}>
    <Routes>
      <Route path="/" element={<StartPage />} />

      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><SignUp /></GuestOnly>} />
      <Route path="/console" element={<Protected><FacultyShell /></Protected>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="layout" element={<TableLayout />} />
        <Route path="students" element={<Students />} />
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
    </Suspense>
  );
}
