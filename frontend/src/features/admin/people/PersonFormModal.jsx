import { useEffect, useState } from 'react';
import { Modal } from '../../../components/ui/Modal.jsx';
import { FormField, inputClass } from '../../../components/ui/FormField.jsx';
import { Avatar } from '../../../components/ui/Avatar.jsx';

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
      } else {
        setAvatarPreview(URL.createObjectURL(file));
      }
    } catch {
      // toast handled in caller
    } finally {
      setUploadingAvatar(false);
    }
  };

  const set = (name) => (e) => {
    setForm((f) => ({ ...f, [name]: e.target.value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    fields.forEach((field) => {
      if (field.required && !String(form[field.name] || '').trim()) {
        next[field.name] = `${field.label} là bắt buộc`;
      }
      if (field.type === 'email' && form[field.name] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form[field.name])) {
        next[field.name] = 'Email không hợp lệ';
      }
    });
    if (mode === 'create' && form.password && form.password.length < 6) {
      next.password = 'Mật khẩu phải từ 6 ký tự';
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit(form, setErrors);
  };

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
        {fields.map((field) => (
          <FormField key={field.name} label={field.label} error={errors[field.name]} required={field.required}>
            {field.type === 'select' ? (
              <select className={inputClass} value={form[field.name] || ''} onChange={set(field.name)}>
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
                placeholder={field.placeholder}
                {...(field.type === 'date' && field.max ? { max: field.max } : {})}
              />
            )}
          </FormField>
        ))}

        {mode === 'create' && (
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

        <div className="md:col-span-2 flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default PersonFormModal;
