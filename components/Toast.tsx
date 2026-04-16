'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  showToast: (type: ToastType, message: string, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (type: ToastType, message: string, duration: number = 5000) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { id, type, message, duration };
    
    setToasts(prev => [...prev, newToast]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const value: ToastContextType = {
    showToast,
    success: (message: string) => showToast('success', message),
    error: (message: string) => showToast('error', message),
    warning: (message: string) => showToast('warning', message),
    info: (message: string) => showToast('info', message),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animación de entrada
    setTimeout(() => setIsVisible(true), 10);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const config = {
    success: {
      icon: CheckCircle,
      bgClass: 'bg-green-500',
      borderClass: 'border-green-600'
    },
    error: {
      icon: XCircle,
      bgClass: 'bg-red-500',
      borderClass: 'border-red-600'
    },
    warning: {
      icon: AlertCircle,
      bgClass: 'bg-yellow-500',
      borderClass: 'border-yellow-600'
    },
    info: {
      icon: Info,
      bgClass: 'bg-blue-500',
      borderClass: 'border-blue-600'
    }
  };

  const { icon: Icon, bgClass, borderClass } = config[toast.type];

  return (
    <div
      className={`
        pointer-events-auto
        flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl
        min-w-[320px] max-w-[400px]
        ${bgClass} text-white
        border-2 ${borderClass}
        transition-all duration-300 transform
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      
      <p className="flex-1 text-sm font-medium leading-relaxed">
        {toast.message}
      </p>
      
      <button
        onClick={handleClose}
        className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Componente de ejemplo de uso
export function ToastExample() {
  const toast = useToast();

  return (
    <div className="space-x-2">
      <button
        onClick={() => toast.success('¡Operación exitosa!')}
        className="px-4 py-2 bg-green-500 text-white rounded"
      >
        Success
      </button>
      <button
        onClick={() => toast.error('Hubo un error')}
        className="px-4 py-2 bg-red-500 text-white rounded"
      >
        Error
      </button>
      <button
        onClick={() => toast.warning('Advertencia importante')}
        className="px-4 py-2 bg-yellow-500 text-white rounded"
      >
        Warning
      </button>
      <button
        onClick={() => toast.info('Información útil')}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Info
      </button>
    </div>
  );
}