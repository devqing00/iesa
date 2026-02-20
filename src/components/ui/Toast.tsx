'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const DEFAULT_DURATION = 5000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `toast-${++toastIdRef.current}`;
      const duration = toast.duration ?? DEFAULT_DURATION;
      const newToast: Toast = { ...toast, id, duration };

      setToasts((prev) => [...prev, newToast]);
      if (duration > 0) {
        setTimeout(() => { removeToast(id); }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => { addToast({ type: 'success', title, message }); }, [addToast]);
  const error = useCallback((title: string, message?: string) => { addToast({ type: 'error', title, message }); }, [addToast]);
  const warning = useCallback((title: string, message?: string) => { addToast({ type: 'warning', title, message }); }, [addToast]);
  const info = useCallback((title: string, message?: string) => { addToast({ type: 'info', title, message }); }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

const emptySubscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  const mounted = useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
  if (!mounted) return null;

  return createPortal(
    <div className="fixed bottom-4 right-4 z-100 flex flex-col gap-2 w-full max-w-sm" role="region" aria-label="Notifications">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>,
    document.body
  );
}

const typeStyles: Record<ToastType, { bg: string; icon: React.ReactNode; border: string }> = {
  success: {
    bg: 'bg-teal-light',
    border: 'border-teal/30',
    icon: <svg className="w-5 h-5 text-teal" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
  },
  error: {
    bg: 'bg-coral-light',
    border: 'border-coral/30',
    icon: <svg className="w-5 h-5 text-coral" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  },
  warning: {
    bg: 'bg-sunny-light',
    border: 'border-sunny/30',
    icon: <svg className="w-5 h-5 text-sunny" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
  },
  info: {
    bg: 'bg-lavender-light',
    border: 'border-lavender/30',
    icon: <svg className="w-5 h-5 text-lavender" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>,
  },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const styles = typeStyles[toast.type];
  return (
    <div
      className={`${styles.bg} ${styles.border} border-[3px] p-4 rounded-2xl flex items-start gap-3 animate-fade-in-up shadow-[6px_6px_0_0_#000]`}
      role="alert"
    >
      <div className="shrink-0">{styles.icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-navy">{toast.title}</p>
        {toast.message && <p className="mt-1 text-xs text-navy/60">{toast.message}</p>}
      </div>
      <button onClick={onDismiss} className="shrink-0 p-1 text-slate hover:text-navy transition-colors" aria-label="Dismiss notification">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
}
