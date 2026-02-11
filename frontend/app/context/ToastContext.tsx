'use client';
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'processing';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  processing: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, message: string, duration = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, type, message, duration };
    
    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => {
    showToast('success', message, duration);
  }, [showToast]);

  const error = useCallback((message: string, duration?: number) => {
    showToast('error', message, duration);
  }, [showToast]);

  const warning = useCallback((message: string, duration?: number) => {
    showToast('warning', message, duration);
  }, [showToast]);

  const processing = useCallback((message: string, duration?: number) => {
    showToast('processing', message, duration);
  }, [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, processing }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container Component
const ToastContainer: React.FC<{ toasts: Toast[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 max-w-md">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

// Individual Toast Component
const ToastItem: React.FC<{ toast: Toast; onClose: () => void }> = ({ toast, onClose }) => {
  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-gradient-to-r from-emerald-500 to-green-500',
          border: 'border-emerald-400',
          icon: <CheckCircle className="w-5 h-5 text-white" />,
        };
      case 'error':
        return {
          bg: 'bg-gradient-to-r from-red-500 to-rose-500',
          border: 'border-red-400',
          icon: <AlertCircle className="w-5 h-5 text-white" />,
        };
      case 'warning':
        return {
          bg: 'bg-gradient-to-r from-amber-500 to-orange-500',
          border: 'border-amber-400',
          icon: <AlertTriangle className="w-5 h-5 text-white" />,
        };
      case 'processing':
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-cyan-500',
          border: 'border-blue-400',
          icon: <Loader2 className="w-5 h-5 text-white animate-spin" />,
        };
      default:
        return {
          bg: 'bg-slate-800',
          border: 'border-slate-700',
          icon: <CheckCircle className="w-5 h-5 text-white" />,
        };
    }
  };

  const styles = getToastStyles(toast.type);

  return (
    <div
      className={`${styles.bg} border ${styles.border} rounded-lg shadow-2xl p-4 flex items-center gap-3 min-w-[320px] animate-slideIn backdrop-blur-sm`}
    >
      <div className="shrink-0">{styles.icon}</div>
      <p className="flex-1 text-white font-medium text-sm">{toast.message}</p>
      <button
        onClick={onClose}
        className="shrink-0 text-white/80 hover:text-white transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};