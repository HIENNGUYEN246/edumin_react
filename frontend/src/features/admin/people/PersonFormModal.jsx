import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*(?:(?: |, )[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*)*$/u;

function isValidAdultBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return false;

  const today = new Date();
  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age >= 22;
}

function isValidNonFutureBirthDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return birthDate <= today;
}

function getFieldError(field, rawValue, departments) {
  const raw = String(rawValue ?? '');
  const value = raw.trim();
  if (field.required && !value) return `${field.label} là bắt buộc`;
  if (raw !== value) return 'Không nhập khoảng trắng ở đầu hoặc cuối';
  if (!value) return '';

  if (field.validation === 'name') {
    if (value.length < 2 || value.length > field.maxLength) return `Họ tên phải từ 2 đến ${field.maxLength} ký tự`;
    if (!PERSON_NAME_PATTERN.test(value)) return 'Chỉ nhập chữ và một khoảng trắng giữa các từ';
  }
  if (field.validation === 'birthDate' && !isValidAdultBirthDate(value)) {
    return 'Ngày sinh không hợp lệ';
  }
  if (field.validation === 'birthDateNoFuture' && !isValidNonFutureBirthDate(value)) {
    return 'Ngày sinh không hợp lệ';
  }
  if (field.validation === 'phone' && !/^0\d{9}$/.test(value)) {
    return 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0';
  }
  if (field.validation === 'address') {
    if (value.length > field.maxLength) return `Địa chỉ không được vượt quá ${field.maxLength} ký tự`;
    if (!ADDRESS_PATTERN.test(value)) return 'Địa chỉ chỉ gồm chữ, số, dấu , . / - và khoảng trắng đơn';
  }
  if (field.validation === 'teacherEmail' && !/^[^\s@]+@university\.edu\.vn$/i.test(value)) {
    return 'Email giảng viên bắt buộc phải có đuôi @university.edu.vn';
  }
  if (field.validation === 'studentEmail' && !/^[^\s@]+@student\.edu\.vn$/i.test(value)) {
    return 'Email sinh viên bắt buộc phải có đuôi @student.edu.vn';
  }
  if (field.validation === 'eduEmail' && !/^[^\s@]+@(?:[a-z0-9-]+\.)*edu\.vn$/i.test(value)) {
    return 'Email nội bộ phải có đuôi edu.vn';
  }
  if (field.validation === 'education') {
    if (value.length < 2 || value.length > field.maxLength) return `Trình độ phải từ 2 đến ${field.maxLength} ký tự`;
    if (!PERSON_NAME_PATTERN.test(value)) return 'Trình độ chỉ gồm chữ và một khoảng trắng giữa các từ';
  }
  if (field.validation === 'studentClass') {
    if (value.length < 2 || value.length > field.maxLength) return `Lớp phải từ 2 đến ${field.maxLength} ký tự`;
    if (!/^[\p{L}\p{M}\p{N}]+(?:[-/][\p{L}\p{M}\p{N}]+)*(?: [\p{L}\p{M}\p{N}]+(?:[-/][\p{L}\p{M}\p{N}]+)*)*$/u.test(value)) {
      return 'Tên lớp chỉ gồm chữ, số, dấu gạch nối, dấu / và khoảng trắng đơn';
    }
  }
  if (field.validation === 'department' && !departments.some((department) => String(department.id) === value)) {
    return 'Vui lòng chọn khoa hợp lệ';
  }
  return '';
}

/**
 * Config-driven create/edit form for a person.
 * `fields` describe inputs; `departments` populates the department select.
 */
export function PersonFormModal({
  open,
  mode,
  title,
  initial,
  fields,
  departments,
  profilePanel = false,
  formatCode = (value) => value,
  entityLabel = 'nhân sự',
  profileCodeLabel = 'Mã GV',
  profileDetailField = 'education',
  profileDetailFallback = 'Trình độ chuyên môn',
  onClose,
  onSubmit,
  saving,
}) {
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(initial);
    setErrors({});
  }, [initial, open]);

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateField = (field) => {
    const message = getFieldError(field, form[field.name], departments);
    setErrors((previous) => ({ ...previous, [field.name]: message }));
  };

  const handleEmailBlur = (field) => {
    const raw = String(form[field.name] || '').trim();
    if (!raw) {
      validateField(field);
      return;
    }
    const domain =
      field.validation === 'teacherEmail' || entityLabel?.toLowerCase().includes('giáo viên')
        ? 'university.edu.vn'
        : field.validation === 'studentEmail' || entityLabel?.toLowerCase().includes('sinh viên')
        ? 'student.edu.vn'
        : null;

    if (domain) {
      let updated = raw;
      if (!raw.includes('@')) {
        updated = `${raw}@${domain}`;
      } else if (raw.endsWith('@')) {
        updated = `${raw}${domain}`;
      }
      if (updated !== raw) {
        setForm((f) => ({ ...f, [field.name]: updated }));
        const msg = getFieldError(field, updated, departments);
        setErrors((p) => ({ ...p, [field.name]: msg }));
        return;
      }
    }
    validateField(field);
  };

  const applyEmailDomain = (fieldName, domain) => {
    const current = String(form[fieldName] || '').trim();
    let prefix = current;
    if (current.includes('@')) {
      prefix = current.split('@')[0];
    }
    if (!prefix) prefix = 'user';
    const nextVal = `${prefix}@${domain}`;
    setForm((f) => ({ ...f, [fieldName]: nextVal }));
    setErrors((p) => ({ ...p, [fieldName]: '' }));
  };

  const selectAvatar = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrors((previous) => ({ ...previous, avatar: 'Chỉ hỗ trợ ảnh JPG, PNG, GIF hoặc WebP' }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({ ...current, avatarFile: file, avatarPreview: String(reader.result) }));
      setErrors((previous) => ({ ...previous, avatar: '' }));
    };
    reader.onerror = () => setErrors((previous) => ({ ...previous, avatar: 'Không đọc được ảnh đã chọn' }));
    reader.readAsDataURL(file);
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    fields.forEach((field) => {
      if (mode === 'edit' && field.type === 'email') return;
      const message = getFieldError(field, form[field.name], departments);
      if (message) next[field.name] = message;
    });
    if (mode === 'create' && form.password && form.password.length < 6) {
      next.password = 'Mật khẩu phải từ 6 ký tự';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit(form, setErrors);
  };

  const renderField = (field) => {
    const domain =
      field.type === 'email'
        ? field.validation === 'teacherEmail' || entityLabel?.toLowerCase().includes('giáo viên')
          ? 'university.edu.vn'
          : field.validation === 'studentEmail' || entityLabel?.toLowerCase().includes('sinh viên')
          ? 'student.edu.vn'
          : null
        : null;

    return (
      <div key={field.name} className={field.fullWidth ? 'sm:col-span-2' : ''}>
        <FormField label={field.label} error={errors[field.name]} required={field.required}>
          {field.type === 'select' ? (
            <select className={inputClass} value={form[field.name] || ''} onChange={set(field.name)} onBlur={() => validateField(field)}>
              <option value="">{field.placeholder || 'Chọn...'}</option>
              {(field.name === 'departmentId' ? departments : field.options || []).map((opt) => (
                <option key={opt.id ?? opt.value} value={opt.id ?? opt.value}>
                  {opt.name ?? opt.label}
                </option>
              ))}
            </select>
          ) : field.type === 'email' && mode === 'edit' ? (
            <input className={`${inputClass} bg-gray-50`} value={form[field.name] || ''} disabled />
          ) : (
            <div>
              <input
                type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
                className={inputClass}
                value={form[field.name] || ''}
                onChange={set(field.name)}
                onBlur={() => (field.type === 'email' ? handleEmailBlur(field) : validateField(field))}
                placeholder={field.placeholder}
                maxLength={field.maxLength}
                {...(field.type === 'tel' ? { inputMode: 'numeric' } : {})}
              />
              {domain && mode === 'create' && (
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Định dạng yêu cầu: <strong className="text-indigo-600 font-semibold">@{domain}</strong></span>
                  <button
                    type="button"
                    onClick={() => applyEmailDomain(field.name, domain)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                  >
                    + Điền @{domain}
                  </button>
                </div>
              )}
            </div>
          )}
        </FormField>
      </div>
    );
  };

  const departmentName = departments.find((department) => String(department.id) === String(form.departmentId))?.name;
  const avatarPreview = form.avatarPreview || form.avatar?.url || '';

  return (
    <Modal open={open} onClose={onClose} title={profilePanel ? undefined : title} size={profilePanel ? '2xl' : 'lg'}>
      <form
        onSubmit={submit}
        className={profilePanel ? '-m-6 grid grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}
      >
        {profilePanel && (
          <aside className="flex flex-col items-center justify-center bg-gradient-to-b from-indigo-600 to-indigo-700 px-7 py-8 text-center text-white">
            <label className="group relative mt-1 block cursor-pointer" title="Chọn ảnh đại diện">
              <Avatar
                src={avatarPreview}
                name={form.hoTen || 'Giảng viên'}
                size={132}
                className="border-4 border-white shadow-xl"
              />
              <span className="absolute bottom-1 right-1 grid h-10 w-10 place-items-center rounded-full border-2 border-indigo-600 bg-white text-indigo-600 shadow">
                <i className="fas fa-camera" />
              </span>
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={selectAvatar} />
            </label>
            {errors.avatar && <p className="mt-2 text-xs text-white">{errors.avatar}</p>}
            <p className="mt-5 text-xl font-bold">{form.hoTen || `Tên ${entityLabel}`}</p>
            <p className="mt-1 text-sm text-indigo-100">{form[profileDetailField] || profileDetailFallback}</p>

            <div className="mt-7 w-full space-y-4 border-t border-white/20 pt-5 text-left text-sm">
              <p className="flex items-start gap-3 break-all text-indigo-50">
                <i className="fas fa-id-card mt-0.5 w-4 shrink-0" />
                {form.id ? formatCode(form.id) : `${profileCodeLabel}: Sẽ tạo mới`}
              </p>
              <p className="flex items-start gap-3 break-all text-indigo-50">
                <i className="fas fa-envelope mt-0.5 w-4 shrink-0" />
                {form.email || 'Email chưa cập nhật'}
              </p>
              <p className="flex items-start gap-3 text-indigo-50">
                <i className="fas fa-building mt-0.5 w-4 shrink-0" />
                {departmentName || 'Khoa chưa chọn'}
              </p>
            </div>
          </aside>
        )}

        <div className={profilePanel ? 'min-w-0 p-6' : 'contents'}>
          {profilePanel && (
            <div className="mb-6 flex items-center justify-between border-b border-gray-100 pb-4">
              <h3 className="text-xl font-extrabold text-gray-800">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Đóng"
              >
                <i className="fas fa-times" />
              </button>
            </div>
          )}
          {profilePanel ? (
            <div className="space-y-6">
              {[
                { key: 'personal', title: 'THÔNG TIN CÁ NHÂN', icon: 'fa-user' },
                { key: 'work', title: 'THÔNG TIN CÔNG TÁC', icon: 'fa-briefcase' },
              ].map((section) => (
                <section key={section.key}>
                  <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-indigo-600">
                    <i className={`fas ${section.icon}`} />{section.title}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {fields.filter((field) => field.section === section.key).map(renderField)}
                    {section.key === 'work' && mode === 'create' && (
                      <FormField label="Mật khẩu" error={errors.password} hint="Để trống sẽ tạo mật khẩu ngẫu nhiên" className="sm:col-span-2">
                        <input
                          type="text"
                          className={inputClass}
                          value={form.password || ''}
                          onChange={set('password')}
                          placeholder="Tối thiểu 6 ký tự"
                        />
                      </FormField>
                    )}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            fields.map(renderField)
          )}

          {!profilePanel && mode === 'create' && (
            <FormField label="Mật khẩu" error={errors.password} hint="Để trống sẽ tạo mật khẩu ngẫu nhiên">
              <input
                type="text"
                className={inputClass}
                value={form.password || ''}
                onChange={set('password')}
                placeholder="Tối thiểu 6 ký tự"
              />
            </FormField>
          )}

          <div className={`flex justify-end gap-3 ${profilePanel ? 'mt-6 border-t border-gray-100 pt-5' : 'md:col-span-2 pt-2'}`}>
            <button type="button" onClick={onClose} className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200">
              Hủy bỏ
            </button>
            <button type="submit" disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Lưu dữ liệu'}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default PersonFormModal;
