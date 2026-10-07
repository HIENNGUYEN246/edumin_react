import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';
<<<<<<< HEAD

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*(?:(?: |, )[\p{L}\p{M}\p{N}]+(?:[./-][\p{L}\p{M}\p{N}]+)*)*$/u;

function getPersonAge(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const birthDate = new Date(year, month - 1, day);
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (birthDate > today) return -1;

  let age = today.getFullYear() - year;
  if (today.getMonth() < month - 1 || (today.getMonth() === month - 1 && today.getDate() < day)) age -= 1;
  return age;
}

function normalizeEmailWithDomain(rawEmail, expectedDomain) {
  if (!rawEmail) return '';
  const trimmed = rawEmail.trim();
  if (!trimmed) return '';
  if (!expectedDomain) return trimmed;

  if (!trimmed.includes('@')) {
    return `${trimmed}@${expectedDomain}`;
  }
  const [username] = trimmed.split('@');
  if (!username) return trimmed;
  return `${username}@${expectedDomain}`;
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
  if (field.validation === 'birthDate') {
    const age = getPersonAge(value);
    if (age === null) return 'Ngày sinh không hợp lệ';
    if (age < 0) return 'Ngày sinh không thể ở tương lai';
    if (age < 24) return 'Giảng viên phải từ 24 tuổi trở lên';
  }
  if (field.validation === 'birthDateNoFuture') {
    const age = getPersonAge(value);
    if (age === null) return 'Ngày sinh không hợp lệ';
    if (age < 0) return 'Ngày sinh không thể ở tương lai';
    if (age < 17) return 'Sinh viên phải từ 17 tuổi trở lên';
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

=======
>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5
/**
 * Config-driven create/edit form for a person.
 * `fields` describe inputs; `departments` populates the department select.
 */
export function PersonFormModal({ open, mode, title, initial, fields, departments, onClose, onSubmit, onAvatar, saving }) {
  const [form, setForm] = useState(initial);
  const [avatarPreview, setAvatarPreview] = useState(initial?.avatar?.url || initial?.avatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setForm(initial);
    setAvatarPreview(initial?.avatar?.url || initial?.avatar);
    setErrors({});
  }, [initial, open]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onAvatar) return;
    try {
      setUploadingAvatar(true);
      const res = await onAvatar(file);
      if (res?.avatar?.url) {
        setAvatarPreview(res.avatar.url);
        setForm((f) => ({ ...f, avatar: res.avatar }));
      } else {
        setAvatarPreview(URL.createObjectURL(file));
      }
    } catch {
      // toast handled in caller
    } finally {
      setUploadingAvatar(false);
    }
  };

  const set = (field) => (e) => {
    let value = e.target.value;
    const maxVal = typeof field.max === 'function' ? field.max() : field.max;
    if (field.type === 'date' && maxVal && value && value > maxVal) {
      value = maxVal;
    }
    setForm((f) => ({ ...f, [field.name]: value }));
    setErrors((prev) => ({ ...prev, [field.name]: '' }));
  };

  const handleBlur = (field) => () => {
    const maxVal = typeof field.max === 'function' ? field.max() : field.max;
    if (field.type === 'date' && maxVal && form[field.name] && form[field.name] > maxVal) {
      setForm((f) => ({ ...f, [field.name]: maxVal }));
      setErrors((prev) => ({ ...prev, [field.name]: '' }));
    }
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
      const normalized = normalizeEmailWithDomain(raw, domain);
      if (normalized !== form[field.name]) {
        setForm((f) => ({ ...f, [field.name]: normalized }));
        const msg = getFieldError(field, normalized, departments);
        setErrors((p) => ({ ...p, [field.name]: msg }));
        return;
      }
    }
    validateField(field);
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
    const nextForm = { ...form };

    // Tự động gắn ngầm chuẩn đuôi email trước khi validate & submit
    fields.forEach((field) => {
      if (field.type === 'email' && nextForm[field.name]) {
        const domain =
          field.validation === 'teacherEmail' || entityLabel?.toLowerCase().includes('giáo viên')
            ? 'university.edu.vn'
            : field.validation === 'studentEmail' || entityLabel?.toLowerCase().includes('sinh viên')
            ? 'student.edu.vn'
            : null;
        if (domain) {
          nextForm[field.name] = normalizeEmailWithDomain(nextForm[field.name], domain);
        }
      }
    });

    const next = {};
    fields.forEach((field) => {
      if (mode === 'edit' && field.type === 'email') return;
<<<<<<< HEAD
      const message = getFieldError(field, nextForm[field.name], departments);
      if (message) next[field.name] = message;
    });
    if (mode === 'create' && nextForm.password && nextForm.password.length < 6) {
      next.password = 'Mật khẩu phải từ 6 ký tự';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    setForm(nextForm);
    onSubmit(nextForm, setErrors);
  };

  const renderField = (field) => (
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
        )}
      </FormField>
    </div>
  );

  const departmentName = departments.find((department) => String(department.id) === String(form.departmentId))?.name;
  const avatarPreview = form.avatarPreview || form.avatar?.url || '';
=======
      const maxVal = typeof field.max === 'function' ? field.max() : field.max;
      if (field.required && !String(form[field.name] || '').trim()) {
        next[field.name] = `${field.label} là bắt buộc`;
      }
      if (field.type === 'email' && form[field.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form[field.name])) {
        next[field.name] = 'Email không hợp lệ';
      }
      if (field.type === 'date' && maxVal && form[field.name] && form[field.name] > maxVal) {
        next[field.name] = field.maxError || `${field.label} không hợp lệ (tối đa là ngày ${maxVal})`;
      }
    });
    setErrors(next);
    if (Object.keys(next).length) return;
    if (typeof onSubmit === 'function') {
      onSubmit({ ...form, password: form.password || '123' }, setErrors);
    }
  };

>>>>>>> 4e8ffb5c0a056164b568d493668162ccf16b4bd5

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {mode === 'edit' && (
          <div className="md:col-span-2 flex items-center justify-between p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100">
            <div className="flex items-center gap-3">
              <label className="relative group cursor-pointer inline-block" title="Bấm để đổi ảnh đại diện">
                <Avatar src={avatarPreview} name={initial?.hoTen || 'User'} size={48} />
                <span className="absolute inset-0 bg-black/40 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <i className="fas fa-camera text-xs" />
                </span>
                {uploadingAvatar && (
                  <span className="absolute inset-0 bg-black/60 text-white rounded-full flex items-center justify-center">
                    <i className="fas fa-spinner fa-spin text-xs" />
                  </span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarChange}
                />
              </label>
              <div>
                <p className="font-bold text-gray-900 text-sm">{initial?.hoTen}</p>
                <p className="text-xs text-gray-500">{initial?.email}</p>
              </div>
            </div>
            {onAvatar && (
              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition shadow-xs flex items-center gap-1.5">
                <i className={`fas ${uploadingAvatar ? 'fa-spinner fa-spin' : 'fa-camera'}`} />
                <span>{uploadingAvatar ? 'Đang tải...' : 'Đổi ảnh đại diện'}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarChange}
                />
              </label>
            )}
          </div>
        )}
        {fields.map((field) => {
          const maxVal = typeof field.max === 'function' ? field.max() : field.max;
          return (
            <FormField
              key={field.name}
              label={field.label}
              error={errors[field.name]}
              required={field.required}
              hint={field.hint}
            >
              {field.type === 'select' ? (
                (() => {
                  const opts = field.name === 'departmentId' ? departments : field.options || [];
                  const currentValue = form[field.name] || '';
                  const hasCurrent = !currentValue || opts.some((opt) => String(opt.id ?? opt.value) === String(currentValue));

                  return (
                    <select className={inputClass} value={currentValue} onChange={set(field)}>
                      <option value="">{field.placeholder || 'Chọn...'}</option>
                      {!hasCurrent && (
                        <option value={currentValue}>{currentValue} (Hiện tại)</option>
                      )}
                      {opts.map((opt) => (
                        <option key={opt.id ?? opt.value} value={opt.id ?? opt.value}>
                          {opt.name ?? opt.label}
                        </option>
                      ))}
                    </select>
                  );
                })()
              ) : field.type === 'email' && mode === 'edit' ? (
                <input className={`${inputClass} bg-gray-50`} value={form[field.name] || ''} disabled />
              ) : field.type === 'email' && field.emailDomain && mode === 'create' ? (
                <div className="flex rounded-xl overflow-hidden border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-400 focus-within:border-transparent bg-white shadow-2xs">
                  <input
                    type="text"
                    className="flex-1 px-4 py-2.5 outline-none text-sm text-gray-800 bg-transparent min-w-0"
                    value={
                      (form[field.name] || '').endsWith(field.emailDomain)
                        ? form[field.name].slice(0, -field.emailDomain.length)
                        : form[field.name] || ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value.trim().toLowerCase();
                      const clean = raw.endsWith(field.emailDomain)
                        ? raw.slice(0, -field.emailDomain.length)
                        : raw.replace(/@.*$/, '');
                      const full = clean ? `${clean}${field.emailDomain}` : '';
                      setForm((f) => ({ ...f, [field.name]: full }));
                      setErrors((prev) => ({ ...prev, [field.name]: '' }));
                    }}
                    placeholder={field.placeholder || 'Nhập tên tài khoản...'}
                  />
                  <span className="inline-flex items-center px-3.5 bg-indigo-50/70 text-indigo-700 font-bold text-xs border-l border-gray-200 select-none shrink-0 font-mono">
                    {field.emailDomain}
                  </span>
                </div>
              ) : (
                <input
                  type={field.type === 'email' ? 'email' : field.type === 'date' ? 'date' : 'text'}
                  className={inputClass}
                  value={form[field.name] || ''}
                  onChange={set(field)}
                  onBlur={handleBlur(field)}
                  placeholder={field.placeholder}
                  {...(field.type === 'date' && maxVal ? { max: maxVal } : {})}
                />
              )}
            </FormField>
          );
        })}

        {mode === 'create' && (
          <div className="md:col-span-2 p-3.5 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center gap-3 text-xs text-amber-900">
            <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
              <i className="fas fa-key text-sm" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-950">
                Mật khẩu khởi tạo mặc định:{' '}
                <span className="font-mono bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 font-bold text-indigo-700 text-sm">
                  123
                </span>
              </p>
              <p className="text-amber-800/90 mt-0.5">
                Tài khoản sẽ được tạo với mật khẩu là 123. Người dùng đăng nhập lần đầu và tự đổi lại mật khẩu cá nhân.
              </p>
            </div>
          </div>
        )}

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving || uploadingAvatar}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs hover:shadow disabled:opacity-60 flex items-center gap-2 transition active:scale-[0.98]"
          >
            {(saving || uploadingAvatar) && <i className="fas fa-spinner fa-spin text-xs" />}
            <span>{saving ? 'Đang lưu...' : uploadingAvatar ? 'Đang tải ảnh...' : 'Lưu'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default PersonFormModal;
