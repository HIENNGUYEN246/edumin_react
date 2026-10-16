/** Standard page title row with an optional action slot. */
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-slate-500 mt-1 text-sm">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Tìm kiếm...', className = '' }) {
  return (
    <div className={`relative ${className ? className : 'w-64'}`}>
      <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 pr-8 py-2 w-full border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none text-xs bg-white text-slate-800 placeholder-slate-400 hover:border-slate-300 transition shadow-2xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex items-center justify-center text-[10px]"
          title="Xóa tìm kiếm"
        >
          <i className="fas fa-times" />
        </button>
      )}
    </div>
  );
}

export default PageHeader;
