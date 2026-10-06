import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { Decrypt } from './Decrypt';

const ToastContext = createContext<(text: string) => void>(() => {});

/** A short notice at the bottom of the screen that decrypts itself, as on the homepage. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState({ text: '', n: 0, on: false });
  const toast = useCallback((text: string) => setMsg((m) => ({ text, n: m.n + 1, on: true })), []);

  useEffect(() => {
    if (!msg.on) return;
    const t = setTimeout(() => setMsg((m) => ({ ...m, on: false })), 4200);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <p className={`toast ${msg.on ? 'on' : ''}`} role="status" aria-live="polite">
        {msg.on && <Decrypt key={msg.n} text={msg.text} />}
      </p>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
