import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { SchedulePicker } from '../../../components/schedule/SchedulePicker.jsx';
import { formatTeacherCode, formatDate, addWeeksToDate } from '../../../lib/format.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { classesApi, CLASS_STATUSES } from '../../../api/classesApi.js';
import { coursesApi } from '../../../api/coursesApi.js';

const emptyForm = (courseId = '') => ({
  id: '',
  courseId: courseId || '',
  teacherId: '',
  room: '',
  capacity: 0,
  schedules: [],
  studyStart: '',
  studyEnd: '',
  status: 'Nháp',
});

/**
 * Create/edit a class within a course. If `courseId` is provided, it is fixed;
 * otherwise the user can choose from available courses.
 */
export function ClassFormModal({ open, mode, courseId, initial, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm(courseId));
  const [errors, setErrors] = useState({});

  const targetCourseId = courseId || form.courseId;

  // Auto-generate class code for create mode
  const { data: nextCodeData, isLoading: nextCodeLoading } = useQuery({
    queryKey: ['classes', 'nextCode', targetCourseId],
    queryFn: () => classesApi.nextCode(targetCourseId),
    enabled: open && mode === 'create' && Boolean(targetCourseId),
  });
  const nextClassCode = nextCodeData?.data?.nextCode || '';

  const { data: teacherData } = useQuery({
    queryKey: ['teachers', { limit: 500 }],
    queryFn: () => teachersApi.list({ limit: 500 }),
    enabled: open,
  });
  const teachers = teacherData?.data || [];

  const { data: courseData } = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
    enabled: open && !courseId,
  });
  const courses = courseData?.data || [];

  useEffect(() => {
    if (open) {
      setForm(initial || emptyForm(courseId));
      setErrors({});
    }
  }, [open, initial, courseId]);

  // Sync auto-generated code into form in create mode
  useEffect(() => {
    if (mode === 'create' && nextClassCode) {
      setForm((f) => ({ ...f, id: nextClassCode }));
    }
  }, [mode, nextClassCode]);

  const set = (name) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [name]: val }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: null }));
  };

  const handleStudyStartChange = (e) => {
    const newStart = e.target.value;
    const suggestedEnd = addWeeksToDate(newStart, 15);
    setForm((f) => ({
      ...f,
      studyStart: newStart,
      studyEnd: !f.studyEnd || f.studyEnd < suggestedEnd ? suggestedEnd : f.studyEnd,
    }));
    if (errors.studyStart) setErrors((prev) => ({ ...prev, studyStart: null }));
    if (errors.studyEnd) setErrors((prev) => ({ ...prev, studyEnd: null }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!targetCourseId) next.courseId = 'Vui lòng chọn học phần';
    if (!form.schedules.length) next.schedules = 'Chọn ít nhất một buổi học';
    
    // Validate 15 weeks minimum
    if (!form.studyStart) {
      next.studyStart = 'Vui lòng chọn ngày bắt đầu học phần';
    }
    if (!form.studyEnd) {
      next.studyEnd = 'Vui lòng chọn ngày kết thúc học phần';
    } else if (form.studyStart) {
      const minEnd = addWeeksToDate(form.studyStart, 15);
      if (form.studyEnd < minEnd) {
        next.studyEnd = `Ngày kết thúc bắt buộc phải sau ít nhất 15 tuần kể từ ngày bắt đầu (tối thiểu từ ${formatDate(minEnd)})`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    onSubmit({
      id: String(form.id || nextClassCode || '').trim(),
      courseId: targetCourseId,
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
          <FormField
            label="Mã lớp học phần"
            error={errors.id}
            hint={mode === 'create' ? 'Hệ thống tự động sinh theo mã môn' : undefined}
          >
            <div className="relative">
              <input
                className={`${inputClass} bg-gray-50 text-gray-700 font-mono font-bold cursor-not-allowed`}
                value={
                  mode === 'create'
                    ? form.id || (nextCodeLoading ? 'Đang tạo mã...' : targetCourseId ? 'Đang sinh mã...' : 'Tự động tạo khi chọn môn')
                    : form.id
                }
                disabled
                readOnly
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                {mode === 'create' ? 'Tự động sinh' : 'Cố định'}
              </span>
            </div>
          </FormField>
          {!courseId && (
            <FormField label="Học phần" error={errors.courseId} required>
              <select className={inputClass} value={form.courseId} disabled={mode === 'edit'} onChange={set('courseId')}>
                <option value="">Chọn học phần</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </FormField>
          )}
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
          <FormField
            label="Bắt đầu học"
            error={errors.studyStart}
            required
            hint="Ngày bắt đầu học phần"
          >
            <input
              type="date"
              required
              className={inputClass}
              value={form.studyStart}
              onChange={handleStudyStartChange}
            />
          </FormField>
          <FormField
            label="Kết thúc học"
            error={errors.studyEnd}
            required
            hint={
              form.studyStart
                ? `Tối thiểu 15 tuần (từ ${formatDate(addWeeksToDate(form.studyStart, 15))})`
                : 'Bắt buộc sau ít nhất 15 tuần kể từ ngày bắt đầu'
            }
          >
            <input
              type="date"
              required
              min={form.studyStart ? addWeeksToDate(form.studyStart, 15) : undefined}
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
