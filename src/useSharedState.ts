import { useEffect, useState } from 'react';

/** Native windows share an origin; storage events keep their player choices aligned. */
export function useSharedString(key: string, fallback: string) {
  const [value, setValue] = useState(() => {
    try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
  });
  useEffect(() => {
    const receive = (event: StorageEvent) => {
      if (event.key === key) setValue(event.newValue ?? fallback);
    };
    window.addEventListener('storage', receive);
    return () => window.removeEventListener('storage', receive);
  }, [key, fallback]);
  const update = (next: string) => {
    setValue(next);
    try { localStorage.setItem(key, next); } catch { /* Session-only mode. */ }
  };
  return [value, update] as const;
}
