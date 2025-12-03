import React, { useEffect } from 'react';
import Badge from './Badge';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export default function Toast({ message, type = 'info', duration = 5000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const typeConfig = {
    success: {
      bg: 'bg-green-900/50',
      border: 'border-green-700',
      text: 'text-green-200',
      icon: '✓',
    },
    error: {
      bg: 'bg-red-900/50',
      border: 'border-red-700',
      text: 'text-red-200',
      icon: '✕',
    },
    warning: {
      bg: 'bg-yellow-900/50',
      border: 'border-yellow-700',
      text: 'text-yellow-200',
      icon: '⚠',
    },
    info: {
      bg: 'bg-hugo-accent-teal/20',
      border: 'border-hugo-accent-teal/50',
      text: 'text-hugo-accent-tealLight',
      icon: 'ℹ',
    },
  };

  const config = typeConfig[type];

  return (
    <div
      className={`${config.bg} ${config.border} ${config.text} border rounded-lg p-4 shadow-hugo-lg flex items-center justify-between gap-4 min-w-[300px] max-w-md`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{config.icon}</span>
        <span className="text-sm font-medium">{message}</span>
      </div>
      <button
        onClick={onClose}
        className={`${config.text} hover:opacity-75 transition-opacity text-xl leading-none`}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}

