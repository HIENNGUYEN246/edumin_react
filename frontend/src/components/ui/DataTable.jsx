import React from 'react';
import { Spinner } from './Spinner.jsx';

/**
 * Presentational table driven by a `columns` config with optional multi-selection.
 * columns: [{ key, header, render?, className? }]
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (r) => r._id || r.id,
  isLoading,
  emptyText = 'Không có dữ liệu',
  onRowClick,
  selectable = false,
  selectedKeys = [],
  onSelectKey,
  onSelectAll,
  bulkActions,
}) {
  if (isLoading) return <Spinner />;

  const isSelected = (row) => selectedKeys.includes(String(rowKey(row)));
  const allRowKeys = rows.map((r) => String(rowKey(r)));
  const allSelected = rows.length > 0 && allRowKeys.every((k) => selectedKeys.includes(k));
  const partiallySelected = !allSelected && allRowKeys.some((k) => selectedKeys.includes(k));

  const totalCols = columns.length + (selectable ? 1 : 0);

  return (
    <div className="space-y-2">
      {selectable && selectedKeys.length > 0 && bulkActions && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-indigo-50 border border-indigo-200/80 rounded-2xl shadow-xs transition-all">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-600 text-white text-xs font-bold">
              {selectedKeys.length}
            </span>
            <span className="text-sm font-semibold text-indigo-900">
              Đã chọn {selectedKeys.length} mục
            </span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions}
          </div>
        </div>
      )}

      <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-left">
              {selectable && (
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = partiallySelected;
                    }}
                    onChange={() => onSelectAll && onSelectAll(allRowKeys)}
                    title="Chọn tất cả trên trang này"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3.5 font-semibold uppercase text-xs tracking-wider text-gray-500 ${
                    col.headerClassName || col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-10 text-center text-gray-400">
                  {emptyText}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = String(rowKey(row));
                const checked = selectedKeys.includes(key);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition ${checked ? 'bg-indigo-50/50' : 'hover:bg-indigo-50/40'} ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3.5 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
                          checked={checked}
                          onChange={() => onSelectKey && onSelectKey(key, row)}
                          title="Chọn mục này"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-gray-700 align-middle ${
                          col.cellClassName || col.className || ''
                        }`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DataTable;

