export function Pagination({ page, pages, total, onPageChange }) {
  if (!total) return null;
  const canPrev = page > 1;
  const canNext = page < pages;
  return (
    <div className="flex items-center justify-between mt-4 text-xs font-medium text-slate-500">
      <span>
        Trang <strong className="text-slate-700">{page}</strong>/<strong className="text-slate-700">{pages || 1}</strong> · <strong className="text-slate-700">{total}</strong> bản ghi
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white transition duration-150"
        >
          <i className="fas fa-chevron-left text-xs" />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-white transition duration-150"
        >
          <i className="fas fa-chevron-right text-xs" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
