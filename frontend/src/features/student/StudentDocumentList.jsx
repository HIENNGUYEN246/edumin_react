import { useState } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { FormField, inputClass } from '../../components/ui/FormField.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, downloadDocument } from '../shared/useDocuments.js';

export function StudentDocumentList() {
  const toast = useToast();
  const { courses } = useCourseOptions();
  const [courseId, setCourseId] = useState('');
  const { data, isLoading } = useDocuments(courseId);
  const docs = data?.data || [];

  const onDownload = async (doc) => {
    try {
      await downloadDocument(doc._id);
    } catch (error) {
      toast.error(error.message || 'Không tải được tài liệu');
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Tên tài liệu',
      className: 'font-semibold text-gray-800',
      render: (d) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-xs">
            <i className={`fas ${d.link && !d.hasFile && !d.size ? 'fa-link' : 'fa-file-lines'}`} />
          </div>
          <div>
            <p className="font-semibold text-gray-800 leading-tight">{d.name}</p>
            {d.format && (
              <span className="text-[10px] text-gray-400 uppercase font-mono">{d.format}</span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'courseId',
      header: 'Học phần',
      render: (d) => {
        const c = courses.find((crs) => crs.id === d.courseId);
        return (
          <div>
            <span className="font-mono font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100">
              {d.courseId}
            </span>
            {c?.name && <p className="text-xs text-gray-800 font-medium mt-1">{c.name}</p>}
          </div>
        );
      },
    },
    { key: 'format', header: 'Định dạng', render: (d) => d.format || (d.link ? 'Liên kết' : '—') },
    {
      key: 'link',
      header: 'Tài liệu cá nhân / Ngoài',
      render: (d) =>
        d.link ? (
          <a
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition border border-blue-200"
            title="Mở liên kết tài liệu cá nhân / bài giảng ngoài"
          >
            <i className="fas fa-external-link-alt text-[10px]" />
            <span>Link cá nhân</span>
          </a>
        ) : (
          <span className="text-gray-300 text-xs italic">—</span>
        ),
    },
    {
      key: 'action',
      header: '',
      className: 'text-right w-32',
      render: (d) => (
        <div className="flex justify-end gap-1.5">
          {(d.hasFile || d.size > 0 || (d.format && d.format !== 'Liên kết')) && (
            <button
              type="button"
              onClick={() => onDownload(d)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition"
              title="Tải tệp về máy"
            >
              <i className="fas fa-download text-[11px]" />
              <span>Tải về</span>
            </button>
          )}
          {d.link && !d.hasFile && !d.size && (
            <a
              href={d.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              <i className="fas fa-external-link-alt text-[11px]" />
              <span>Xem</span>
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tài liệu"
        subtitle="Tài liệu học phần bạn đang theo học"
        actions={
          <FormField>
            <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Tất cả học phần</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>
          </FormField>
        }
      />
      <DataTable columns={columns} rows={docs} isLoading={isLoading} emptyText="Chưa có tài liệu" />
    </div>
  );
}

export default StudentDocumentList;
