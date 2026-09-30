import { Spinner } from './Spinner.jsx';

/**
 * Presentational table driven by a `columns` config.
 * columns: [{ key, header, render?, className? }]
 */
export function DataTable({ columns, rows, rowKey = (r) => r._id, isLoading, emptyText = 'Không có dữ liệu' }) {
  if (isLoading) return <Spinner />;

  return (
    <div className="overflow-x-auto custom-scrollbar rounded-2xl border border-gray-100 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-500 text-left">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 font-semibold uppercase text-xs tracking-wider ${col.className || ''}`}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                {emptyText}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-indigo-50/40 transition">
                {columns.map((col) => (
                  <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className || ''}`}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default DataTable;
