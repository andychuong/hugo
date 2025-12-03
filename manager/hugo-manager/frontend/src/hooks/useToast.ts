import { useState, useCallback } from 'react';
import { ToastData } from '../components/ui/ToastContainer';

export function useToast() {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = useCallback((message: string, type: ToastData['type'] = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastData = { id, message, type, duration };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const success = useCallback((message: string, duration?: number) => {
    return addToast(message, 'success', duration);
  }, [addToast]);

  const error = useCallback((message: string, duration?: number) => {
    return addToast(message, 'error', duration);
  }, [addToast]);

  const warning = useCallback((message: string, duration?: number) => {
    return addToast(message, 'warning', duration);
  }, [addToast]);

  const info = useCallback((message: string, duration?: number) => {
    return addToast(message, 'info', duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
}

