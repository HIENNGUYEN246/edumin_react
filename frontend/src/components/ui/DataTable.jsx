import React from 'react';
import { Spinner } from './Spinner.jsx';

/**
 * Presentational table driven by a `columns` config with optional multi-selection.
 * columns: [{ key, header, render?, className?, headerClassName?, cellClassName? }]
 */
export function DataTable({
  columns,
  rows = [],
  rowKey = (r) => r._id || r.id,
  isLoading,
  emptyText = 'Không có dữ liệu',
  onRowClick,
  rowClassName,
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

      <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50/80 text-slate-600 text-left border-b border-slate-200/70">
              {selectable && (
                <th className="w-12 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer transition"
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
                  className={`px-4 py-3.5 font-semibold uppercase text-[11px] tracking-wider text-slate-500 ${
                    col.headerClassName || col.className || ''
                  }`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-4 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <i className="far fa-folder-open text-3xl text-slate-300 mb-1" />
                    <span className="text-sm font-medium">{emptyText}</span>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, rowIndex) => {
                const key = String(rowKey(row));
                const checked = isSelected(row);
                const customRowClass = rowClassName ? rowClassName(row, rowIndex) : '';
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`transition-colors duration-150 ${checked ? 'bg-indigo-50/60' : 'hover:bg-slate-50/80'} ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${customRowClass}`}
                  >
                    {selectable && (
                      <td
                        className="w-12 px-4 py-3.5 text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer transition"
                          checked={checked}
                          onChange={() => onSelectKey && onSelectKey(key, row)}
                          title="Chọn mục này"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3.5 text-slate-700 align-middle ${
                          col.cellClassName || col.className || ''
                        }`}
                      >
                        {col.render ? col.render(row, rowIndex) : row[col.key]}
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
