import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Ctrl+Shift+F opens the faculty sign-in. Deliberately not shown anywhere on screen.
export default function useFacultyShortcut() {
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(e) {
      if (e.repeat || !e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey) return;
      // e.code keeps it working on non-QWERTY layouts.
      if (e.code !== 'KeyF' && e.key.toLowerCase() !== 'f') return;
      e.preventDefault();
      navigate('/login');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate]);
}
