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
  const [uploadForm, setUploadForm] = useState({ courseId: '', name: '', files: [], link: '' });
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', link: '' });

  const docs = data?.data || [];

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files || []);
    setUploadForm((f) => ({ ...f, files: selected }));
  };

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!uploadForm.courseId) {
      toast.error('Vui lòng chọn học phần');
      return;
    }
    if (uploadForm.files.length === 0 && !uploadForm.link.trim()) {
      toast.error('Vui lòng chọn tệp tài liệu hoặc nhập đường link liên kết');
      return;
    }

    try {
      await create.mutateAsync({
        courseId: uploadForm.courseId,
        name: uploadForm.name.trim(),
        files: uploadForm.files,
        link: uploadForm.link.trim(),
      });
      const count = uploadForm.files.length;
      toast.success(count > 1 ? `Đã tải lên ${count} tài liệu thành công` : 'Đã tải lên tài liệu thành công');
      setUploadModal(false);
      setUploadForm({ courseId: '', name: '', files: [], link: '' });
      if (fileRef.current) fileRef.current.value = '';
    } catch (error) {
      toast.error(error.message);
    }
  };

  const openEdit = (d) => {
    setEditTarget(d);
    setEditForm({ name: d.name, link: d.link || '' });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Vui lòng nhập tên tài liệu');
      return;
    }
    try {
      await update.mutateAsync({
        id: editTarget._id,
        name: editForm.name.trim(),
        link: editForm.link.trim(),
      });
      toast.success('Đã cập nhật tài liệu');
      setEditTarget(null);
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
    { key: 'courseId', header: 'Học phần' },
    {
      key: 'link',
      header: 'Link cá nhân / Ngoài',
      render: (d) =>
        d.link ? (
          <a
            href={d.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition border border-blue-100"
            title={d.link}
          >
            <i className="fas fa-external-link-alt text-[10px]" />
            <span>Mở link</span>
          </a>
        ) : (
          <span className="text-gray-300 text-xs italic">Không có</span>
        ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      render: (d) => (
        <button
          type="button"
          onClick={() => toggleStatus(d)}
          className={`text-xs font-bold px-2.5 py-1 rounded-full transition ${
            d.status === 'Công khai' ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'
          }`}
        >
          {d.status}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-40',
      render: (d) => (
        <div className="flex justify-end gap-1.5">
          {(d.hasFile || d.size > 0) && (
            <button
              type="button"
              onClick={() => downloadDocument(d._id).catch((e) => toast.error(e.message))}
              className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100 flex items-center justify-center transition"
              title="Tải tệp"
            >
              <i className="fas fa-download text-xs" />
            </button>
          )}
          {d.link && (
            <a
              href={d.link}
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 rounded-lg text-blue-600 hover:bg-blue-50 flex items-center justify-center transition"
              title="Mở link ngoài"
            >
              <i className="fas fa-external-link-alt text-xs" />
            </a>
          )}
          <button
            type="button"
            onClick={() => openEdit(d)}
            className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition"
            title="Chỉnh sửa thông tin & link"
          >
            <i className="fas fa-pen text-xs" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(d)}
            className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50 flex items-center justify-center transition"
            title="Xóa"
          >
            <i className="fas fa-trash-alt text-xs" />
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
            <button
              type="button"
              onClick={() => {
                setUploadForm({ courseId: courseId || '', name: '', files: [], link: '' });
                setUploadModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap transition flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <i className="fas fa-upload text-xs" />
              <span>Tải lên tài liệu</span>
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={docs} isLoading={isLoading} emptyText="Chưa có tài liệu" />

      {/* Upload Modal with multi-files and link input */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title="Tải lên tài liệu" size="md">
        <form onSubmit={submitUpload} className="space-y-4">
          <FormField label="Học phần" required>
            <select
              className={inputClass}
              value={uploadForm.courseId}
              onChange={(e) => setUploadForm((f) => ({ ...f, courseId: e.target.value }))}
            >
              <option value="">Chọn học phần</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Chọn tệp tài liệu (chọn được 2 - 3 tệp cùng lúc)"
            hint="Hỗ trợ các định dạng PDF, Word, Excel, PowerPoint, ZIP, hình ảnh..."
          >
            <input
              ref={fileRef}
              type="file"
              multiple
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition cursor-pointer"
              onChange={handleFilesChange}
            />
            {uploadForm.files.length > 0 && (
              <div className="mt-3 p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-1.5">
                <p className="text-xs font-bold text-gray-700">Đã chọn {uploadForm.files.length} tệp:</p>
                <div className="flex flex-wrap gap-1.5">
                  {uploadForm.files.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100"
                    >
                      <i className="fas fa-file-alt text-[10px]" />
                      <span className="truncate max-w-[180px]">{file.name}</span>
                      <span className="text-gray-400 text-[10px]">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </FormField>

          <FormField
            label="Đường link tài liệu cá nhân / ngoài (nếu có)"
            hint="VD: Liên kết chia sẻ Google Drive, OneDrive, GitHub, tài liệu tham khảo trực tuyến..."
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="fas fa-link text-xs" />
              </div>
              <input
                type="url"
                className={`${inputClass} pl-9`}
                placeholder="https://drive.google.com/..."
                value={uploadForm.link}
                onChange={(e) => setUploadForm((f) => ({ ...f, link: e.target.value }))}
              />
            </div>
          </FormField>

          {uploadForm.files.length <= 1 && (
            <FormField label="Tên hiển thị (Tùy chọn)">
              <input
                className={inputClass}
                value={uploadForm.name}
                onChange={(e) => setUploadForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mặc định lấy tên tệp hoặc đường link"
              />
            </FormField>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setUploadModal(false)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition flex items-center gap-2"
            >
              {create.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin" />
                  <span>Đang tải lên...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-upload text-xs" />
                  <span>Tải lên</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal for Name & Link */}
      <Modal open={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Chỉnh sửa tài liệu" size="sm">
        <form onSubmit={submitEdit} className="space-y-4">
          <FormField label="Tên tài liệu" required>
            <input
              className={inputClass}
              value={editForm.name}
              onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            />
          </FormField>

          <FormField
            label="Đường link tài liệu cá nhân / ngoài"
            hint="Liên kết Google Drive, OneDrive, GitHub..."
          >
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <i className="fas fa-link text-xs" />
              </div>
              <input
                type="url"
                className={`${inputClass} pl-9`}
                value={editForm.link}
                onChange={(e) => setEditForm((f) => ({ ...f, link: e.target.value }))}
                placeholder="https://drive.google.com/..."
              />
            </div>
          </FormField>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setEditTarget(null)}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={update.isPending}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition"
            >
              {update.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default TeacherDocumentList;
