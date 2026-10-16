import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal } from '../../components/ui/Modal.jsx';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialog. `confirm(options)` resolves to
 * true/false, replacing scattered window.confirm and Swal usage.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolver.current = resolve;
      setState({
        title: 'Xác nhận',
        message: '',
        confirmText: 'Đồng ý',
        cancelText: 'Hủy',
        tone: 'danger',
        ...options,
      });
    });
  }, []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal open={Boolean(state)} onClose={() => close(false)} title={state?.title} size="sm">
        {state && (
          <div>
            <p className="text-gray-600 text-sm leading-6">{state.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white ${
                  state.tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {state.confirmText}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx.confirm;
}

export default ConfirmProvider;
