import { useEffect } from 'react';

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
};

/**
 * Accessible modal: closes on Escape and backdrop click, locks body scroll,
 * and renders a titled card. Used by every dialog in the app.
 */
export function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity" onClick={() => onClose?.()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${SIZES[size]} bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto custom-scrollbar transition-all transform duration-200`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-white/90 backdrop-blur-xs sticky top-0 z-20">
            <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
            <button
              type="button"
              onClick={() => onClose?.()}
              className="w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition"
              aria-label="Đóng"
            >
              <i className="fas fa-times text-sm" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default Modal;
