import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { AlertTriangle, XCircle, CheckCircle2, Info, X } from 'lucide-react';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextData {
  showToast: (type: ToastType, title: string, message?: string, duration?: number) => void;
  error: (title: string, message?: string, duration?: number) => void;
  warning: (title: string, message?: string, duration?: number) => void;
  success: (title: string, message?: string, duration?: number) => void;
  info: (title: string, message?: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string, duration = 4500) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = { id, type, title, message, duration };

    setToasts(prev => [...prev.slice(-4), newToast]); // Mantém no máximo 5 toasts ativos simultaneamente

    if (duration > 0) {
      setTimeout(() => {
        dismissToast(id);
      }, duration);
    }
  }, [dismissToast]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    showToast('error', title, message, duration);
  }, [showToast]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    showToast('warning', title, message, duration);
  }, [showToast]);

  const success = useCallback((title: string, message?: string, duration?: number) => {
    showToast('success', title, message, duration);
  }, [showToast]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    showToast('info', title, message, duration);
  }, [showToast]);

  const contextValue = useMemo(() => ({
    showToast,
    error,
    warning,
    success,
    info,
    dismissToast
  }), [showToast, error, warning, success, info, dismissToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Container Flutuante Global de Toasts */}
      <div 
        aria-live="polite" 
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none"
      >
        {toasts.map(toast => {
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';
          const isSuccess = toast.type === 'success';
          const isInfo = toast.type === 'info';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full p-4 rounded-2xl shadow-2xl backdrop-blur-md border transition-all duration-300 animate-in slide-in-from-top-4 fade-in flex items-start justify-between gap-3 text-white ${
                isError 
                  ? 'bg-slate-950/95 border-red-500/80 shadow-red-950/40' 
                  : isWarning 
                  ? 'bg-slate-950/95 border-amber-500/80 shadow-amber-950/40' 
                  : isSuccess 
                  ? 'bg-slate-950/95 border-emerald-500/80 shadow-emerald-950/40' 
                  : 'bg-slate-950/95 border-blue-500/80 shadow-blue-950/40'
              }`}
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="shrink-0 mt-0.5">
                  {isError && <XCircle className="w-5 h-5 text-red-400" />}
                  {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                  {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                  {isInfo && <Info className="w-5 h-5 text-blue-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className={`text-xs font-black tracking-wide leading-tight ${
                    isError ? 'text-red-300' : isWarning ? 'text-amber-300' : isSuccess ? 'text-emerald-300' : 'text-blue-300'
                  }`}>
                    {toast.title}
                  </h4>
                  {toast.message && (
                    <p className="text-xs text-slate-200 mt-1 leading-relaxed font-medium">
                      {toast.message}
                    </p>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg transition-colors shrink-0 cursor-pointer"
                title="Fechar notificação"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser utilizado dentro de um ToastProvider');
  }
  return context;
};

export default ToastContext;
