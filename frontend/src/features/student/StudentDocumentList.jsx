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
    { key: 'name', header: 'Tên tài liệu', className: 'font-semibold text-gray-800' },
    { key: 'courseId', header: 'Học phần' },
    { key: 'format', header: 'Định dạng', render: (d) => d.format || '—' },
    {
      key: 'action',
      header: '',
      className: 'text-right w-28',
      render: (d) => (
        <button type="button" onClick={() => onDownload(d)} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700">
          <i className="fas fa-download mr-1" /> Tải
        </button>
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
