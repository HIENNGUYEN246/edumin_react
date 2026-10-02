import { useState } from 'react';
import { PageHeader } from '../../../components/ui/PageHeader.jsx';
import { DataTable } from '../../../components/ui/DataTable.jsx';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { useToast } from '../../../app/providers/ToastProvider.jsx';
import { useConfirm } from '../../../app/providers/ConfirmProvider.jsx';
import { useCourseOptions, useCourseClassesOptions } from '../../shared/useCourseOptions.js';
import { useAssignments, useAssignmentMutations } from '../../shared/useAssignments.js';
import { QuizEditor, newQuestion } from './QuizEditor.jsx';
import { SubmissionTable } from './SubmissionTable.jsx';

const emptyForm = () => ({ courseId: '', classId: '', type: 'quiz', title: '', description: '', dueDate: '', status: 'Công khai', questions: [newQuestion()] });

export function TeacherAssignmentList() {
  const toast = useToast();
  const confirm = useConfirm();
  const { courses } = useCourseOptions();
  const [courseId, setCourseId] = useState('');
  const { data, isLoading } = useAssignments(courseId);
  const { create, update, remove } = useAssignmentMutations();

  const [editor, setEditor] = useState(null); // {mode, assignment?}
  const [form, setForm] = useState(emptyForm());
  const [viewing, setViewing] = useState(null); // assignment for submissions

  const { classes: courseClasses } = useCourseClassesOptions(form.courseId);

  const assignments = data?.data || [];

  const openCreate = () => {
    setForm(emptyForm());
    setEditor({ mode: 'create' });
  };
  const openEdit = (a) => {
    setForm({
      courseId: a.courseId,
      classId: a.classId || '',
      type: a.type,
      title: a.title,
      description: a.description || '',
      dueDate: a.dueDate || '',
      status: a.status,
      questions: a.questions?.length ? a.questions : [newQuestion()],
    });
    setEditor({ mode: 'edit', assignment: a });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.courseId) return toast.error('Chọn học phần');
    if (!form.title.trim()) return toast.error('Nhập tiêu đề');
    try {
      if (editor.mode === 'create') {
        await create.mutateAsync({
          courseId: form.courseId,
          classId: form.classId || '',
          type: form.type,
          title: form.title.trim(),
          description: form.description,
          dueDate: form.dueDate,
          status: form.status,
          questions: form.type === 'quiz' ? form.questions : [],
        });
        toast.success('Đã tạo bài tập');
      } else {
        await update.mutateAsync({
          id: editor.assignment._id,
          classId: form.classId || '',
          title: form.title.trim(),
          description: form.description,
          dueDate: form.dueDate,
          status: form.status,
          questions: form.type === 'quiz' ? form.questions : undefined,
        });
        toast.success('Đã cập nhật');
      }
      setEditor(null);
    } catch (error) {
      toast.error(error.message, 5000);
    }
  };

  const onDelete = async (a) => {
    const ok = await confirm({ title: 'Xóa bài tập', message: `Xóa "${a.title}"? Các bài nộp cũng sẽ bị xóa.`, confirmText: 'Xóa' });
    if (!ok) return;
    try {
      await remove.mutateAsync(a._id);
      toast.success('Đã xóa');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const columns = [
    { key: 'title', header: 'Tiêu đề', className: 'font-semibold text-gray-800' },
    { key: 'courseId', header: 'Học phần' },
    {
      key: 'classId',
      header: 'Lớp',
      render: (a) =>
        a.classId ? (
          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
            {a.classId}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">Tất cả lớp</span>
        ),
    },
    { key: 'type', header: 'Loại', render: (a) => (a.type === 'quiz' ? 'Trắc nghiệm' : 'Tệp') },
    { key: 'dueDate', header: 'Hạn nộp', render: (a) => a.dueDate || '—' },
    { key: 'status', header: 'Trạng thái' },
    {
      key: 'actions',
      header: '',
      className: 'text-right w-40',
      render: (a) => (
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setViewing(a)} className="w-8 h-8 rounded-lg text-gray-600 hover:bg-gray-100" title="Bài nộp">
            <i className="fas fa-list-check" />
          </button>
          <button type="button" onClick={() => openEdit(a)} className="w-8 h-8 rounded-lg text-indigo-600 hover:bg-indigo-50" title="Sửa">
            <i className="fas fa-pen" />
          </button>
          <button type="button" onClick={() => onDelete(a)} className="w-8 h-8 rounded-lg text-red-600 hover:bg-red-50" title="Xóa">
            <i className="fas fa-trash-alt" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Bài tập"
        subtitle="Tạo và chấm bài tập trắc nghiệm"
        actions={
          <>
            <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">Tất cả học phần</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
              ))}
            </select>
            <button type="button" onClick={openCreate} className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 whitespace-nowrap">
              <i className="fas fa-plus mr-1.5" /> Tạo quiz
            </button>
          </>
        }
      />

      <DataTable columns={columns} rows={assignments} isLoading={isLoading} emptyText="Chưa có bài tập" />

      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.mode === 'create' ? 'Tạo bài tập' : 'Sửa bài tập'} size="xl">
        {editor && (
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Học phần" required>
                <select className={inputClass} value={form.courseId} disabled={editor.mode === 'edit'} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}>
                  <option value="">Chọn học phần</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.id} — {c.name}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Tiêu đề" required>
                <input className={inputClass} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
              </FormField>
              <FormField label="Hạn nộp">
                <input type="date" className={inputClass} value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </FormField>
              <FormField label="Giao cho lớp" hint="Để trống nếu giao cho tất cả lớp học phần">
                <select className={inputClass} value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}>
                  <option value="">Tất cả các lớp trong môn</option>
                  {courseClasses.map((cls) => (
                    <option key={cls._id} value={cls.id}>
                      {cls.id} {cls.room ? `(${cls.room})` : ''}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Trạng thái">
                <select className={inputClass} value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="Công khai">Công khai</option>
                  <option value="Ẩn">Ẩn</option>
                </select>
              </FormField>
            </div>
            <FormField label="Mô tả">
              <textarea rows="2" className={inputClass} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </FormField>

            {form.type === 'quiz' && (
              <QuizEditor value={form.questions} onChange={(questions) => setForm((f) => ({ ...f, questions }))} />
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setEditor(null)} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">Hủy</button>
              <button type="submit" disabled={create.isPending || update.isPending} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">Lưu</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={`Bài nộp — ${viewing?.title || ''}`} size="lg">
        {viewing && <SubmissionTable assignmentId={viewing._id} />}
      </Modal>
    </div>
  );
}

export default TeacherAssignmentList;
