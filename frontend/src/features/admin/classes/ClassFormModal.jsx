import { useEffect, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { SchedulePicker } from '../../../components/schedule/SchedulePicker.jsx';
import {
  formatTeacherCode,
  formatCurrency,
  getTodayDate,
  getNextDate,
  addWeeksToDate,
  addDaysToDate,
  DEFAULT_GRADE_WEIGHTS,
  GRADE_COMPONENTS,
  DEFAULT_CREDIT_PRICE,
  calculateCourseFee,
  suggestGradeWeights,
  getWeightSuggestionLabel,
} from '../../../lib/format.js';
import { teachersApi } from '../../../api/teachersApi.js';
import { classesApi, CLASS_STATUSES } from '../../../api/classesApi.js';
import { coursesApi } from '../../../api/coursesApi.js';

const CLASS_DURATION_WEEKS = 15;
const emptyForm = (courseId = '') => ({
  id: '',
  courseId: courseId || '',
  className: '',
  teacherId: '',
  room: '',
  capacity: '',
  fee: '',
  schedules: [],
  studyStart: '',
  studyEnd: '',
  registrationStart: '',
  registrationEnd: '',
  gradeWeights: { ...DEFAULT_GRADE_WEIGHTS },
  status: 'Nháp',
});

/**
 * Create/edit a class within a course. If `courseId` is provided, it is fixed;
 * otherwise the user can choose from available courses.
 */
export function ClassFormModal({ open, mode, courseId, initial, onClose, onSubmit, saving }) {
  const [form, setForm] = useState(emptyForm(courseId));
  const [errors, setErrors] = useState({});
  const [isCustomFee, setIsCustomFee] = useState(false);

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
  const allTeachers = useMemo(() => teacherData?.data || [], [teacherData]);

  const { data: courseData } = useQuery({
    queryKey: ['courses', { limit: 500 }],
    queryFn: () => coursesApi.list({ limit: 500 }),
    enabled: open,
  });
  const courses = courseData?.data || [];

  // Find the selected course and its department
  const selectedCourse = courses.find((c) => c.id === targetCourseId);
  const courseDepartment = selectedCourse?.department || '';
  const autoFee = useMemo(() => calculateCourseFee(selectedCourse), [selectedCourse]);

  // Filter teachers strictly by the course's department
  const teachers = allTeachers.filter((t) => {
    if (!courseDepartment) return true;
    if (!t.department) return true;
    return t.department.trim().toLowerCase() === courseDepartment.trim().toLowerCase();
  });

  useEffect(() => {
    if (open) {
      const suggestedWeights = suggestGradeWeights(selectedCourse);
      const calculatedAutoFee = calculateCourseFee(selectedCourse);
      if (initial) {
        const hasCustomFee = initial.fee !== undefined && initial.fee !== null && initial.fee !== '';
        setIsCustomFee(hasCustomFee);
        setForm({
          ...emptyForm(courseId),
          ...initial,
          fee: hasCustomFee ? String(initial.fee) : (calculatedAutoFee > 0 ? String(calculatedAutoFee) : ''),
          registrationStart: initial.registrationStart ? String(initial.registrationStart).slice(0, 10) : '',
          registrationEnd: initial.registrationEnd ? String(initial.registrationEnd).slice(0, 10) : '',
          gradeWeights: initial.gradeWeights
            ? { ...suggestedWeights, ...initial.gradeWeights }
            : { ...suggestedWeights },
        });
      } else {
        setIsCustomFee(false);
        setForm({
          ...emptyForm(courseId),
          fee: calculatedAutoFee > 0 ? String(calculatedAutoFee) : '',
          gradeWeights: { ...suggestedWeights },
        });
      }
      setErrors({});
    }
  }, [open, initial, courseId, selectedCourse]);

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

  const handleCourseChange = (e) => {
    const newCourseId = e.target.value;
    const newCourse = courses.find((c) => c.id === newCourseId);
    const suggested = suggestGradeWeights(newCourse);
    const newAutoFee = calculateCourseFee(newCourse);

    setForm((f) => ({
      ...f,
      courseId: newCourseId,
      gradeWeights: { ...suggested },
      fee: isCustomFee ? f.fee : (newAutoFee > 0 ? String(newAutoFee) : ''),
    }));
    if (errors.courseId) setErrors((prev) => ({ ...prev, courseId: null }));
  };

  const handleFeeChange = (e) => {
    const val = e.target.value;
    setIsCustomFee(val !== '');
    setForm((f) => ({ ...f, fee: val }));
    if (errors.fee) setErrors((prev) => ({ ...prev, fee: null }));
  };

  const handleApplyAutoFee = () => {
    setIsCustomFee(false);
    setForm((f) => ({ ...f, fee: autoFee > 0 ? String(autoFee) : '' }));
    if (errors.fee) setErrors((prev) => ({ ...prev, fee: null }));
  };

  const handleRegistrationStartChange = (e) => {
    const val = e.target.value;
    const autoEnd = val ? addDaysToDate(val, 7) : '';
    setForm((f) => ({
      ...f,
      registrationStart: val,
      registrationEnd: autoEnd || f.registrationEnd,
    }));
    setErrors((prev) => ({ ...prev, registrationStart: '', registrationEnd: '' }));
  };

  const totalWeight = useMemo(() => {
    const weights = form.gradeWeights || DEFAULT_GRADE_WEIGHTS;
    return Object.values(weights).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [form.gradeWeights]);

  const handleGradeWeightChange = (key, val) => {
    const num = Math.max(0, Math.min(100, Number(val) || 0));
    setForm((f) => ({
      ...f,
      gradeWeights: {
        ...(f.gradeWeights || DEFAULT_GRADE_WEIGHTS),
        [key]: num,
      },
    }));
    if (errors.gradeWeights) setErrors((prev) => ({ ...prev, gradeWeights: '' }));
  };

  const applyWeightPreset = (preset) => {
    setForm((f) => ({
      ...f,
      gradeWeights: { ...preset },
    }));
    if (errors.gradeWeights) setErrors((prev) => ({ ...prev, gradeWeights: '' }));
  };

  const handleStudyStartChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({
      ...f,
      studyStart: val,
      studyEnd: val ? addWeeksToDate(val, CLASS_DURATION_WEEKS) : f.studyEnd,
    }));
    setErrors((prev) => ({ ...prev, studyStart: '', studyEnd: '' }));
  };

  const handleSchedulesChange = (schedules) => {
    setForm((current) => ({ ...current, schedules }));
    if (errors.schedules) setErrors((current) => ({ ...current, schedules: '' }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!targetCourseId) next.courseId = 'Vui lòng chọn học phần';
    if (!form.className.trim()) next.className = 'Vui lòng nhập tên lớp học phần';
    if (!form.teacherId) next.teacherId = 'Vui lòng chọn giáo viên phụ trách';
    if (!form.room.trim()) next.room = 'Vui lòng nhập phòng học';
    if (form.capacity === '' || !Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 10) {
      next.capacity = 'Sĩ số tối đa phải là số nguyên lớn hơn hoặc bằng 10';
    }
    if (!form.registrationStart) next.registrationStart = 'Vui lòng chọn ngày bắt đầu đăng ký';
    if (!form.registrationEnd) next.registrationEnd = 'Vui lòng chọn ngày kết thúc đăng ký';
    if (!form.studyStart) next.studyStart = 'Vui lòng chọn ngày bắt đầu học';
    if (!form.studyEnd) next.studyEnd = 'Vui lòng chọn ngày kết thúc học';
    if (!form.schedules.length) next.schedules = 'Chọn ít nhất một buổi học';
    const today = getTodayDate();
    if (mode === 'create' && form.registrationStart && form.registrationStart < today) {
      next.registrationStart = 'Thời gian bắt đầu đăng ký không được ở quá khứ';
    }
    if (
      form.registrationStart &&
      form.registrationEnd &&
      form.registrationEnd <= form.registrationStart
    ) {
      next.registrationEnd = 'Thời gian kết thúc phải sau thời gian bắt đầu đăng ký';
    }
    if (mode === 'create' && form.studyStart && form.studyStart < today) {
      next.studyStart = 'Ngày bắt đầu học không được ở quá khứ';
    }
    if (
      form.studyStart &&
      form.registrationEnd &&
      form.studyStart <= form.registrationEnd
    ) {
      next.studyStart = 'Thời điểm bắt đầu học bắt buộc phải diễn ra sau thời điểm kết thúc đăng ký';
    }
    if (form.studyEnd && form.studyStart && form.studyEnd < form.studyStart) {
      next.studyEnd = 'Ngày kết thúc phải sau ngày bắt đầu';
    }
    if (
      form.studyStart &&
      form.studyEnd &&
      form.studyEnd < addWeeksToDate(form.studyStart, CLASS_DURATION_WEEKS)
    ) {
      next.studyEnd = `Ngày kết thúc phải cách ngày bắt đầu ít nhất ${CLASS_DURATION_WEEKS} tuần`;
    }
    if (Math.abs(totalWeight - 100) > 0.01) {
      next.gradeWeights = `Tổng trọng số các cột điểm phải bằng đúng 100% (hiện tại: ${totalWeight}%)`;
    }
    if (
      form.fee !== '' &&
      form.fee !== null &&
      form.fee !== undefined &&
      (Number.isNaN(Number(form.fee)) || Number(form.fee) < 0)
    ) {
      next.fee = 'Học phí phải là số lớn hơn hoặc bằng 0';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    const finalFee = (form.fee !== '' && form.fee !== null && form.fee !== undefined)
      ? Number(form.fee)
      : autoFee;

    onSubmit({
      id: String(form.id || nextClassCode || '').trim(),
      courseId: targetCourseId,
      className: form.className.trim(),
      teacherId: form.teacherId ? Number(form.teacherId) : null,
      room: form.room.trim(),
      capacity: Number(form.capacity),
      fee: finalFee,
      schedules: form.schedules,
      studyStart: form.studyStart,
      studyEnd: form.studyEnd,
      registrationStart: form.registrationStart,
      registrationEnd: form.registrationEnd,
      gradeWeights: form.gradeWeights || DEFAULT_GRADE_WEIGHTS,
      status: form.status,
    }, setErrors);
  };

  return (
    <Modal open={open} onClose={onClose} title={mode === 'create' ? 'Mở lớp học phần mới' : 'Chỉnh sửa thông tin lớp học phần'} size="xl">
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="fas fa-circle-info text-indigo-500" />
            <span>Thông tin lớp học phần</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Mã lớp học phần"
              error={errors.id}
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
              <FormField label="Học phần" error={errors.courseId} required>
                <input
                  className={`${inputClass} bg-white text-gray-700 font-medium cursor-not-allowed`}
                  value={`${selectedCourse?.name || courseId} (${courseId})`}
                  disabled
                  readOnly
                />
              </FormField>
            ) : (
              <FormField label="Học phần" error={errors.courseId} required>
                <select className={inputClass} value={form.courseId} disabled={mode === 'edit'} required onChange={handleCourseChange}>
                  <option value="">-- Chọn học phần --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name} ({c.credits} TC)
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Tên lớp học phần" error={errors.className} required>
              <input
                className={inputClass}
                value={form.className}
                required
                maxLength={120}
                onChange={set('className')}
              />
            </FormField>

            <FormField
              label="Giáo viên phụ trách"
              error={errors.teacherId}
              required
            >
              <select
                className={inputClass}
                value={form.teacherId}
                disabled={!targetCourseId}
                required
                onChange={set('teacherId')}
              >
                {!targetCourseId ? (
                  <option value="">-- Vui lòng chọn học phần trước --</option>
                ) : (
                  <>
                    <option value="">-- Chọn giáo viên --</option>
                    {teachers.map((t) => (
                      <option key={t._id || t.id} value={t.id}>
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

            <FormField label="Phòng học" error={errors.room} required>
              <input className={inputClass} value={form.room} required onChange={set('room')} />
            </FormField>

            <FormField label="Sĩ số tối đa" error={errors.capacity} required>
              <input
                type="number"
                min="10"
                step="1"
                required
                className={inputClass}
                value={form.capacity}
                onChange={set('capacity')}
              />
            </FormField>

            <FormField
              label={
                <div className="flex items-center justify-between w-full">
                  <span>Học phí (VND)</span>
                  <button
                    type="button"
                    onClick={handleApplyAutoFee}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    title="Tính tự động dựa trên số tín chỉ của môn học × 500.000đ"
                  >
                    <i className="fas fa-wand-magic-sparkles mr-1" />
                    Tự động tính
                  </button>
                </div>
              }
              error={errors.fee}
            >
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="10000"
                  className={inputClass}
                  placeholder={autoFee > 0 ? `Tự động: ${formatCurrency(autoFee)}` : 'Nhập học phí hoặc để trống'}
                  value={form.fee}
                  onChange={handleFeeChange}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 pointer-events-none">
                  đ
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {form.fee === '' ? (
                  <span className="text-emerald-700 font-medium">
                    ✓ Để trống: Tự động tính {formatCurrency(autoFee)} ({selectedCourse?.credits || 0} TC × {formatCurrency(DEFAULT_CREDIT_PRICE)})
                  </span>
                ) : isCustomFee ? (
                  <span>
                    Số tiền tùy chỉnh ({formatCurrency(Number(form.fee) || 0)}).{' '}
                    <button type="button" onClick={handleApplyAutoFee} className="text-indigo-600 underline font-medium cursor-pointer">
                      Dùng định mức ({formatCurrency(autoFee)})
                    </button>
                  </span>
                ) : (
                  <span className="text-indigo-700 font-medium">
                    Đã điền tự động theo {selectedCourse?.credits || 0} tín chỉ.
                  </span>
                )}
              </p>
            </FormField>

            <FormField label="Trạng thái" error={errors.status} required>
              <select className={inputClass} required value={form.status} onChange={set('status')}>
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
            <i className="far fa-calendar-check text-indigo-500" />
            <span>Thời gian đăng ký</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Bắt đầu đăng ký"
              error={errors.registrationStart}
              required
            >
              <input
                type="date"
                required
                min={mode === 'create' ? todayStr : undefined}
                className={inputClass}
                value={form.registrationStart}
                onChange={handleRegistrationStartChange}
              />
            </FormField>
            <FormField
              label="Kết thúc đăng ký"
              error={errors.registrationEnd}
              required
            >
              <input
                type="date"
                required
                min={form.registrationStart ? getNextDate(form.registrationStart) : (mode === 'create' ? todayStr : undefined)}
                className={inputClass}
                value={form.registrationEnd}
                onChange={set('registrationEnd')}
              />
            </FormField>
          </div>
        </div>

        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="far fa-calendar text-indigo-500" />
            <span>Thời gian đào tạo (Tối thiểu {CLASS_DURATION_WEEKS} tuần)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Bắt đầu học"
              error={errors.studyStart}
              required
            >
              <input
                type="date"
                required
                min={
                  form.registrationEnd
                    ? getNextDate(form.registrationEnd)
                    : (mode === 'create' ? todayStr : undefined)
                }
                className={inputClass}
                value={form.studyStart}
                aria-invalid={Boolean(errors.studyStart)}
                onChange={handleStudyStartChange}
              />
            </FormField>

            <FormField
              label="Kết thúc học"
              error={errors.studyEnd}
              required
            >
              <input
                type="date"
                required
                min={
                  form.studyStart
                    ? addWeeksToDate(form.studyStart, CLASS_DURATION_WEEKS)
                    : mode === 'create'
                      ? todayStr
                      : undefined
                }
                className={inputClass}
                value={form.studyEnd}
                aria-invalid={Boolean(errors.studyEnd)}
                onChange={set('studyEnd')}
              />
            </FormField>
          </div>
        </div>

        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
              <i className="fas fa-sliders text-indigo-500" />
              <span>Cấu hình trọng số điểm (%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                totalWeight === 100
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                Tổng: {totalWeight}% {totalWeight === 100 ? '✓ Hợp lệ' : '(Cần đúng 100%)'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3 text-xs">
            <span className="text-slate-500 font-medium">Gợi ý & Mẫu:</span>
            {selectedCourse && (
              <button
                type="button"
                onClick={() => applyWeightPreset(suggestGradeWeights(selectedCourse))}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-semibold transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Tự động áp dụng khung trọng số chuẩn gợi ý cho học phần này"
              >
                <i className="fas fa-wand-magic-sparkles text-indigo-500 text-[11px]" />
                Gợi ý cho môn ({getWeightSuggestionLabel(selectedCourse)})
              </button>
            )}
            <button
              type="button"
              onClick={() => applyWeightPreset({ attendance: 10, homework: 10, midterm: 30, presentation: 0, final: 50 })}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
            >
              Chuẩn 3 TC (10-10-30-50)
            </button>
            <button
              type="button"
              onClick={() => applyWeightPreset({ attendance: 10, homework: 0, midterm: 40, presentation: 0, final: 50 })}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
            >
              2 TC / 3 cột (10-40-50)
            </button>
            <button
              type="button"
              onClick={() => applyWeightPreset({ attendance: 10, homework: 20, midterm: 10, presentation: 20, final: 40 })}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-slate-700 font-medium transition cursor-pointer"
            >
              Thực hành / Đồ án (10-20-10-20-40)
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {GRADE_COMPONENTS.map((comp) => (
              <div key={comp.key} className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1 truncate" title={comp.label}>
                  {comp.label}
                </label>
                <div className="relative">
                  <input
                    aria-label={`Trọng số ${comp.label}`}
                    type="number"
                    min="0"
                    max="100"
                    step="5"
                    className="w-full text-center font-bold text-sm text-slate-800 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-lg py-1.5 px-2 outline-hidden transition"
                    value={form.gradeWeights?.[comp.key] ?? 0}
                    onChange={(e) => handleGradeWeightChange(comp.key, e.target.value)}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">%</span>
                </div>
              </div>
            ))}
          </div>

          {errors.gradeWeights && (
            <p className="mt-2 text-xs font-semibold text-rose-600 flex items-center gap-1">
              <i className="fas fa-circle-exclamation" /> {errors.gradeWeights}
            </p>
          )}
        </div>

        <div className="bg-slate-50/60 p-4 rounded-2xl border border-gray-100">
          <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 mb-3 flex items-center gap-1.5">
            <i className="far fa-clock text-indigo-500" />
            <span>Xếp lịch học trong tuần</span>
          </div>
          <FormField error={errors.schedules} required>
            <SchedulePicker value={form.schedules} onChange={handleSchedulesChange} />
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
