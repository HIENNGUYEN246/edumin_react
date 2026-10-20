import { useEffect } from 'react';
import { createPortal } from 'react-dom';

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
export function Modal({
  open,
  isOpen,
  onClose,
  title,
  icon,
  children,
  size = 'md',
  closable = true,
  className = '',
  zIndex = 'z-50',
}) {
  const isVisible = Boolean(open ?? isOpen);

  useEffect(() => {
    if (!isVisible) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && closable) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [isVisible, onClose, closable]);

  if (!isVisible) return null;

  const content = (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 sm:p-6 md:p-8 py-10 sm:py-14 md:py-16 overflow-y-auto`}>
      <div
        className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity"
        onClick={() => closable && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative w-full ${SIZES[size]} bg-white rounded-3xl shadow-2xl border border-slate-100/80 max-h-[88vh] overflow-y-auto custom-scrollbar transition-all transform duration-200 my-auto ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100 bg-white/95 backdrop-blur-sm sticky top-0 z-20">
            <div className="flex items-center gap-3">
              {icon && (
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100/60 shadow-xs">
                  {typeof icon === 'string' ? <i className={`${icon} text-sm`} /> : icon}
                </div>
              )}
              <h3 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">{title}</h3>
            </div>
            {closable && (
              <button
                type="button"
                onClick={() => onClose?.()}
                className="w-8 h-8 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 flex items-center justify-center transition cursor-pointer"
                aria-label="Đóng"
              >
                <i className="fas fa-times text-sm" />
              </button>
            )}
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

export default Modal;
