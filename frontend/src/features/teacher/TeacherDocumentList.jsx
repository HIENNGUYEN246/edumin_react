import { useState, useRef } from 'react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../components/ui/FormField.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../app/providers/ConfirmProvider.jsx';
import { useCourseOptions } from '../shared/useCourseOptions.js';
import { useDocuments, useDocumentMutations, downloadDocument } from '../shared/useDocuments.js';

export function TeacherDocumentList() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const { courses } = useCourseOptions();
  const [courseId, setCourseId] = useState('');
  const { data, isLoading } = useDocuments(courseId);
  const { create, update, remove } = useDocumentMutations();

  const [uploadModal, setUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({ courseId: '', name: '', file: null });
  // Rename state is kept separate from delete to avoid coupling bugs.
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const docs = data?.data || [];

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.courseId || !uploadForm.file) {
      toast.error('Chọn học phần và tệp');
      return;
    }
    try {
      await create.mutateAsync({ courseId: uploadForm.courseId, name: uploadForm.name || uploadForm.file.name, file: uploadForm.file });
      toast.success('Đã tải lên tài liệu');
      setUploadModal(false);
      setUploadForm({ courseId: '', name: '', file: null });
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      toast.error(error.message);
    }
  };

  const submitRename = async (e) => {
    e.preventDefault();
    try {
      await update.mutateAsync({ id: renameTarget._id, name: renameValue.trim() });
      toast.success('Đã đổi tên');
      setRenameTarget(null);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const toggleStatus = async (doc) => {
    try {
      await update.mutateAsync({ id: doc._id, status: doc.status === 'Công khai' ? 'Ẩn' : 'Công khai' });
    } catch (error) {
      toast.error(error.message);
    }
  };

  const onDelete = async (doc) => {
    const ok = await confirm({ title: 'Xóa tài liệu', message: `Xóa "${doc.name}"?`, confirmText: 'Xóa' });
    if (!ok) return;
    try {
      await remove.mutateAsync(doc._id);
      toast.success('Đã xóa tài liệu');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'name', header: 'Tên tài liệu', className: 'font-semibold text-gray-800' },
    { key: 'courseId', header: 'Học phần' },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (d) => (
        <button type="button" onClick={() => toggleStatus(d)} className={`text-xs font-bold px-2.5 py-1 rounded-full ${d.status === 'Công khai' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}>
          {d.status}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-40',
      render: (d) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => downloadDocument(d._id).catch((e) => toast.error(e.message))} className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100" title="Tải">
            <i className="fas fa-download" />
          </button>
          <button type="button" onClick={() => { setRenameTarget(d); setRenameValue(d.name); }} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Đổi tên">
            <i className="fas fa-pen" />
          </button>
          <button type="button" onClick={() => onDelete(d)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Tài liệu"
        subtitle="Tải lên và quản lý tài liệu học phần"
        actions={
          <>
            <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Tất cả học phần</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>
            <button type="button" onClick={() => setUploadModal(true)} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap">
              <i className="fas fa-upload mr-1.5" /> Tải lên
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={docs} isLoading={isLoading} emptyText="Chưa có tài liệu" />

      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Tải lên tài liệu" size="sm">
        <form onSubmit={submitUpload} className="space-y-4">
          <FormField label="Học phần" required>
            <select className={inputClass} value={uploadForm.courseId} onChange={(e) => setUploadForm((f) => ({ ...f, courseId: e.target.value }))}>
              <option value="">Chọn học phần</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Tên hiển thị">
            <input className={inputClass} value={uploadForm.name} onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))} placeholder="Mặc định lấy tên tệp" />
          </FormField>
          <FormField label="Tệp" required>
            <input ref={fileRef} type="file" onChange={(e) => setUploadForm((f) => ({ ...f, file: e.target.files?.[0] || null }))} />
          </FormField>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setUploadModal(false)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Hủy</button>
            <button type="submit" disabled={create.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
              {create.isPending ? 'Đang tải...' : 'Tải lên'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(renameTarget)} onClose={() => setRenameTarget(null)} title="Đổi tên tài liệu" size="sm">
        <form onSubmit={submitRename} className="space-y-4">
          <FormField label="Tên mới" required>
            <input className={inputClass} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </FormField>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => setRenameTarget(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Hủy</button>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700">Lưu</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TeacherDocumentList;
