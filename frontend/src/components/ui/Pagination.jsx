export function Pagination({ page, pages, total, onPageChange }) {
  if (!total) return null;
  const canPrev = page > 1;
  const canNext = page < pages;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
      <span>
        Trang {page}/{pages || 1} · {total} bản ghi
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPageChange(page - 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          <i className="fas fa-chevron-left" />
        </button>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
        >
          <i className="fas fa-chevron-right" />
        </button>
      </div>
    </div>
  );
}

export default Pagination;
