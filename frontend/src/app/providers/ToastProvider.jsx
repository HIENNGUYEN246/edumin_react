import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useInRouterContext, useLocation } from 'react-router-dom';

const ToastContext = createContext(null);

let idSeq = 0;

function RouteWatcherInner({ onClear }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    if (prevPathRef.current !== location.pathname) {
      prevPathRef.current = location.pathname;
      onClear();
    }
  }, [location.pathname, onClear]);

  return null;
}

function RouteWatcher({ onClear }) {
  const inRouter = useInRouterContext();
  if (!inRouter) return null;
  return <RouteWatcherInner onClear={onClear} />;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const clearAll = useCallback(() => {
    timers.current.forEach((timer) => clearTimeout(timer));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const handleClear = () => {
      clearAll();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('edumin:clear-toasts', handleClear);
      window.addEventListener('popstate', handleClear);
      return () => {
        window.removeEventListener('edumin:clear-toasts', handleClear);
        window.removeEventListener('popstate', handleClear);
      };
    }
  }, [clearAll]);

  const show = useCallback(
    (message, type = 'success', duration = 3000) => {
      idSeq += 1;
      const id = idSeq;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
      return id;
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      show,
      success: (m, d) => show(m, 'success', d),
      error: (m, d) => show(m, 'error', d),
      info: (m, d) => show(m, 'info', d),
      warning: (m, d) => show(m, 'warning', d),
      dismiss,
      clearAll,
    }),
    [show, dismiss, clearAll]
  );

  return (
    <ToastContext.Provider value={value}>
      <RouteWatcher onClear={clearAll} />
      {children}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`${
              toast.type === 'success'
                ? 'bg-green-500'
                : toast.type === 'error'
                  ? 'bg-red-500'
                  : 'bg-indigo-500'
            } text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300`}
          >
            <i
              className={`fas ${
                toast.type === 'success'
                  ? 'fa-check-circle'
                  : toast.type === 'error'
                    ? 'fa-exclamation-circle'
                    : 'fa-info-circle'
              } text-xl`}
            />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show: () => {},
      success: () => {},
      error: () => {},
      info: () => {},
      warning: () => {},
      dismiss: () => {},
      clearAll: () => {},
    };
  }
  return ctx;
}

export default ToastProvider;
