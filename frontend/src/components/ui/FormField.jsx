/** Labeled input wrapper with inline error text. */
export function FormField({ label, error, required, children, hint }) {
  return (
    <label className="block">
      {label && (
        <span className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
          {label}
          {required && <span className="text-rose-500 ml-1 font-bold">*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
      {error && (
        <span className="block text-xs text-rose-500 font-medium mt-1">
          <i className="fas fa-circle-exclamation mr-1" />
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300 outline-none transition duration-150 shadow-2xs';

export default FormField;
