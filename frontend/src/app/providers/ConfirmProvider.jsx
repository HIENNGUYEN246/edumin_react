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

  const isDanger =
    state?.tone === 'danger' ||
    /xóa|delete|hủy môn|gỡ|remove/i.test(state?.title || '') ||
    /xóa|delete|hủy/i.test(state?.confirmText || '');

  const isEmail =
    state?.tone === 'email' ||
    /gửi|email|mail|send|thư/i.test(state?.title || '') ||
    /gửi|email|mail|send/i.test(state?.confirmText || '');

  const isSuccessOrApprove =
    state?.tone === 'success' ||
    /duyệt|approve|đồng ý|phê duyệt|xác nhận|thành công/i.test(state?.title || '') ||
    /duyệt|approve|áp dụng/i.test(state?.confirmText || '');

  const resolveIcon = () => {
    if (state?.icon) {
      const clean = state.icon.replace(/^(fas|far|fal|fad)\s+/, '').replace(/^fa-/, '');
      return `fa-${clean}`;
    }
    if (isDanger) return 'fa-trash-can';
    if (isEmail) return 'fa-paper-plane';
    if (isSuccessOrApprove) return 'fa-circle-check';
    return 'fa-circle-info';
  };

  const currentIcon = resolveIcon();

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(state)}
        onClose={() => close(false)}
        title={state?.title}
        icon={
          isDanger
            ? 'fas fa-triangle-exclamation text-rose-600'
            : isEmail
            ? 'fas fa-paper-plane text-indigo-600'
            : isSuccessOrApprove
            ? 'fas fa-circle-check text-emerald-600'
            : `fas ${currentIcon} text-indigo-600`
        }
        size="sm"
      >
        {state && (
          <div className="pt-2 sm:pt-4 pb-1">
            <div className="text-center">
              <div
                className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5 transition-transform hover:scale-105 shadow-xs ${
                  isDanger
                    ? 'bg-rose-50 text-rose-600 border border-rose-200/70 ring-8 ring-rose-50/60 shadow-rose-100'
                    : isEmail
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200/70 ring-8 ring-indigo-50/60 shadow-indigo-100'
                    : isSuccessOrApprove
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/70 ring-8 ring-emerald-50/60 shadow-emerald-100'
                    : 'bg-indigo-50 text-indigo-600 border border-indigo-200/70 ring-8 ring-indigo-50/60 shadow-indigo-100'
                }`}
              >
                <i className={`fas ${currentIcon} text-2xl`} />
              </div>
              <p className="text-slate-800 text-sm sm:text-base font-semibold leading-relaxed px-1">
                {state.message}
              </p>
              {isDanger && (
                <div className="mt-4 mx-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200/70 text-amber-800 text-xs font-semibold">
                  <i className="fas fa-triangle-exclamation text-amber-500 text-xs shrink-0" />
                  <span>Hành động này không thể hoàn tác</span>
                </div>
              )}
            </div>

            <div className="mt-7 pt-5 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => close(false)}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] transition-all cursor-pointer"
              >
                {state.cancelText}
              </button>
              <button
                type="button"
                onClick={() => close(true)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold text-white shadow-md active:scale-[0.98] transition-all cursor-pointer flex items-center gap-2 ${
                  isDanger
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 shadow-rose-200 hover:shadow-lg hover:shadow-rose-300'
                    : isSuccessOrApprove
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300'
                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300'
                }`}
              >
                {isDanger && <i className="fas fa-trash-can text-xs opacity-90" />}
                {isEmail && <i className="fas fa-paper-plane text-xs opacity-90" />}
                {!isDanger && !isEmail && isSuccessOrApprove && <i className="fas fa-check text-xs opacity-90" />}
                <span>{state.confirmText}</span>
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
