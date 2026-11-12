import { useEffect } from 'react';

// Calls onClose when the user clicks outside `ref` or presses Escape.
export default function useClickOutside(ref, open, onClose) {
  useEffect(() => {
    if (!open) return undefined;

    function handlePointer(event) {
      if (ref.current && !ref.current.contains(event.target)) onClose();
    }
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [ref, open, onClose]);
}
