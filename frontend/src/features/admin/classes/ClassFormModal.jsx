import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { SchedulePicker } from '../../../components/schedule/SchedulePicker.jsx';
import { formatTeacherCode, getTodayDate } from '../../../lib/format.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { CLASS_STATUSES } from '../../../api/classesApi.js';

const emptyForm = (courseId) => ({
  id: '',
  courseId,
  teacherId: '',
  room: '',
  capacity: 0,
  schedules: [],
  studyStart: '',
  studyEnd: '',
  status: 'Nháp',
});

/**
 * Create/edit a class within a course. `courseId` is fixed (the class always
 * belongs to the course whose detail page opened this modal).
 */
export function ClassFormModal({ open, mode, courseId, initial, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm(courseId));
  const [errors, setErrors] = useState({});

  const { data: teacherData } = useQuery({
    queryKey: ['teachers', { limit: 500 }],
    queryFn: () => teachersApi.list({ limit: 500 }),
    enabled: open,
  });
  const teachers = teacherData?.data || [];

  useEffect(() => {
    if (open) {
      setForm(initial || emptyForm(courseId));
      setErrors({});
    }
  }, [open, initial, courseId]);

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (mode === 'create' && !String(form.id).trim()) next.id = 'Mã lớp là bắt buộc';
    if (!form.schedules.length) next.schedules = 'Chọn ít nhất một buổi học';
    const today = getTodayDate();
    if (mode === 'create' && form.studyStart && form.studyStart < today) {
      next.studyStart = 'Ngày bắt đầu học không được ở quá khứ';
    }
    if (form.studyEnd && form.studyStart && form.studyEnd < form.studyStart) {
      next.studyEnd = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    onSubmit({
      id: String(form.id).trim(),
      courseId,
      teacherId: form.teacherId ? Number(form.teacherId) : null,
      room: form.room.trim(),
      capacity: Number(form.capacity) || 0,
      schedules: form.schedules,
      studyStart: form.studyStart,
      studyEnd: form.studyEnd,
      status: form.status,
    }, setErrors);
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? 'Thêm lớp học phần' : 'Sửa lớp học phần'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Mã lớp" error={errors.id} required>
            <input className={inputClass} value={form.id} disabled={mode === 'edit'} onChange={set('id')} placeholder="VD: IT101-01" />
          </FormField>
          <FormField label="Giáo viên">
            <select className={inputClass} value={form.teacherId} onChange={set('teacherId')}>
              <option value="">Chưa phân công</option>
              {teachers.map((t) => (
                <option key={t._id} value={t.id}>
                  {t.hoTen} ({formatTeacherCode(t.id)})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Phòng học">
            <input className={inputClass} value={form.room} onChange={set('room')} placeholder="VD: A101" />
          </FormField>
          <FormField label="Sĩ số tối đa" hint="0 = không giới hạn">
            <input type="number" min="0" className={inputClass} value={form.capacity} onChange={set('capacity')} />
          </FormField>
          <FormField label="Bắt đầu học" error={errors.studyStart}>
            <input
              type="date"
              min={mode === 'create' ? getTodayDate() : undefined}
              className={inputClass}
              value={form.studyStart}
              onChange={set('studyStart')}
            />
          </FormField>
          <FormField label="Kết thúc học" error={errors.studyEnd}>
            <input
              type="date"
              min={form.studyStart || (mode === 'create' ? getTodayDate() : undefined)}
              className={inputClass}
              value={form.studyEnd}
              onChange={set('studyEnd')}
            />
          </FormField>
          <FormField label="Trạng thái" hint="Chọn 'Đang mở' để sinh viên thấy và đăng ký">
            <select className={inputClass} value={form.status} onChange={set('status')}>
              {CLASS_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </FormField>
        </div>

        <FormField label="Lịch học" error={errors.schedules} required>
          <SchedulePicker value={form.schedules} onChange={(schedules) => setForm((f) => ({ ...f, schedules }))} />
        </FormField>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export { emptyForm };
export default ClassFormModal;
