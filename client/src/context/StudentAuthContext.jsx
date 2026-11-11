import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

// Students sign in separately from faculty, with their own cookie.
const StudentAuthContext = createContext(null);

export function StudentAuthProvider({ children }) {
  const [student, setStudent] = useState(null);
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.studentMe();
      setStudent(data.student);
      setSession(data.session);
      return data;
    } catch {
      setStudent(null);
      setSession(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    refresh().finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.studentLogout();
    } finally {
      setStudent(null);
      setSession(null);
    }
  }, []);

  const value = useMemo(
    () => ({ student, session, checking, refresh, logout, setStudent }),
    [student, session, checking, refresh, logout]
  );
  return <StudentAuthContext.Provider value={value}>{children}</StudentAuthContext.Provider>;
}

export function useStudentAuth() {
  const ctx = useContext(StudentAuthContext);
  if (!ctx) throw new Error('useStudentAuth must be used inside <StudentAuthProvider>.');
  return ctx;
}
