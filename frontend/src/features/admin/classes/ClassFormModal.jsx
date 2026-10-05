import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { SchedulePicker } from '../../../components/schedule/SchedulePicker.jsx';
import { formatTeacherCode, formatDate, addWeeksToDate, getTodayDate } from '../../../lib/format.js';
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
  const todayStr = getTodayDate();

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
  const allTeachers = teacherData?.data || [];

  const { data: courseData } = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
    enabled: open,
  });
  const courses = courseData?.data || [];

  // Find the selected course and its department
  const selectedCourse = courses.find((c) => c.id === targetCourseId);
  const courseDepartment = selectedCourse?.department || '';

  // Filter teachers strictly by the course's department
  const teachers = allTeachers.filter((t) => {
    if (!courseDepartment) return true;
    if (!t.department) return true;
    return t.department.trim().toLowerCase() === courseDepartment.trim().toLowerCase();
  });

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

  // Auto-reset teacher if selected teacher does not belong to the course's department
  useEffect(() => {
    if (form.teacherId && courseDepartment) {
      const currentTeacher = allTeachers.find((t) => t.id === Number(form.teacherId));
      if (
        currentTeacher?.department &&
        currentTeacher.department.trim().toLowerCase() !== courseDepartment.trim().toLowerCase()
      ) {
        setForm((f) => ({ ...f, teacherId: '' }));
      }
    }
  }, [targetCourseId, courseDepartment, allTeachers, form.teacherId]);

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
    
    const todayStr = getTodayDate();
    // Validate 15 weeks minimum and strictly non-past
    if (!form.studyStart) {
      next.studyStart = 'Vui lòng chọn ngày bắt đầu học phần';
    } else if (mode === 'create' && form.studyStart < todayStr) {
      next.studyStart = 'Ngày bắt đầu học phần phải từ hôm nay trở về sau';
    }

    if (!form.studyEnd) {
      next.studyEnd = 'Vui lòng chọn ngày kết thúc học phần';
    } else if (form.studyEnd < todayStr) {
      next.studyEnd = 'Ngày kết thúc học phần không được ở quá khứ';
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
    <Modal open={open} onClose={onClose} title={mode === 'create' ? 'Mở lớp học phần mới' : 'Chỉnh sửa thông tin lớp học phần'} size="xl">
      <form onSubmit={submit} className="space-y-5">
        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="fas fa-circle-info text-indigo-500" />
            <span>Thông tin lớp học phần</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Mã lớp học phần"
              error={errors.id}
              hint={mode === 'create' ? 'Hệ thống tự động sinh theo mã môn' : undefined}
            >
              <div className="relative">
                <input
                  className={`${inputClass} bg-white text-gray-700 font-mono font-bold cursor-not-allowed`}
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

            {courseId ? (
              <FormField label="Học phần">
                <input
                  className={`${inputClass} bg-white text-gray-700 font-medium cursor-not-allowed`}
                  value={`${selectedCourse?.name || courseId} (${courseId})`}
                  disabled
                  readOnly
                />
              </FormField>
            ) : (
              <FormField label="Học phần" error={errors.courseId} required>
                <select className={inputClass} value={form.courseId} disabled={mode === 'edit'} onChange={set('courseId')}>
                  <option value="">-- Chọn học phần --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name} ({c.credits} TC)
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField
              label="Giáo viên phụ trách"
              hint={
                !targetCourseId
                  ? 'Vui lòng chọn học phần trước để lọc giảng viên theo khoa'
                  : courseDepartment
                  ? `Lọc theo khoa: ${courseDepartment} (${teachers.length} GV)`
                  : 'Giảng viên giảng dạy'
              }
            >
              <select
                className={inputClass}
                value={form.teacherId}
                disabled={!targetCourseId}
                onChange={set('teacherId')}
              >
                {!targetCourseId ? (
                  <option value="">-- Vui lòng chọn học phần trước --</option>
                ) : (
                  <>
                    <option value="">Chưa phân công</option>
                    {teachers.map((t) => (
                      <option key={t._id} value={t.id}>
                        {t.hoTen} ({formatTeacherCode(t.id)}){t.department ? ` - ${t.department}` : ''}
                      </option>
                    ))}
                    {teachers.length === 0 && (
                      <option value="" disabled>
                        Khoa {courseDepartment} hiện chưa có giảng viên
                      </option>
                    )}
                  </>
                )}
              </select>
            </FormField>

            <FormField label="Phòng học">
              <input className={inputClass} value={form.room} onChange={set('room')} placeholder="VD: A101, B204..." />
            </FormField>

            <FormField label="Sĩ số tối đa" hint="0 = Không giới hạn sĩ số">
              <input type="number" min="0" className={inputClass} value={form.capacity} onChange={set('capacity')} />
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
        </div>

        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="far fa-calendar text-indigo-500" />
            <span>Thời gian đào tạo (Tối thiểu 15 tuần)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Bắt đầu học"
              error={errors.studyStart}
              required
              hint="Ngày học buổi đầu tiên"
            >
              <input
                type="date"
                required
                min={mode === 'create' ? todayStr : undefined}
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
                min={form.studyStart ? addWeeksToDate(form.studyStart, 15) : todayStr}
                className={inputClass}
                value={form.studyEnd}
                onChange={set('studyEnd')}
              />
            </FormField>
          </div>
        </div>

        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="far fa-clock text-indigo-500" />
            <span>Xếp lịch học trong tuần</span>
          </div>
          <FormField error={errors.schedules} required>
            <SchedulePicker value={form.schedules} onChange={(schedules) => setForm((f) => ({ ...f, schedules }))} />
          </FormField>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition">
            Hủy
          </button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs hover:shadow disabled:opacity-60 transition active:scale-[0.98]">
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export { emptyForm };
export default ClassFormModal;
