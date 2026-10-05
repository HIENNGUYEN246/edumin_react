import { PersonManager } from '../people/PersonManager.jsx';
import { teachersApi, TEACHER_EDUCATION_LEVELS } from '../../../api/teachersApi.js';
import { formatTeacherCode, getMaxBirthDate, formatDate } from '../../../lib/format.js';

const teacherConfig = {
  queryKey: 'teachers',
  api: teachersApi,
  title: 'Quản lý giáo viên',
  subtitle: 'Thêm, sửa, xóa giáo viên và nhập/xuất Excel',
  entityLabel: 'giáo viên',
  exportName: 'giao-vien.xlsx',
  formatCode: formatTeacherCode,
  emptyForm: {
    hoTen: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    address: '',
    education: '',
    departmentId: '',
    password: '123',
  },
  fields: [
    { name: 'hoTen', label: 'Họ tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true, emailDomain: '@university.edu.vn', placeholder: 'VD: nguyenvana' },
    { name: 'phone', label: 'Số điện thoại' },
    {
      name: 'dob',
      label: 'Ngày sinh',
      type: 'date',
      get max() {
        return getMaxBirthDate(24);
      },
      get hint() {
        return `Tối đa: ${formatDate(getMaxBirthDate(24))} (từ 24 tuổi trở lên)`;
      },
      maxError: 'Giảng viên phải từ 24 tuổi trở lên',
    },
    {
      name: 'gender',
      label: 'Giới tính',
      type: 'select',
      options: [
        { value: 'Nam', label: 'Nam' },
        { value: 'Nữ', label: 'Nữ' },
        { value: 'Khác', label: 'Khác' },
      ],
    },
    { name: 'departmentId', label: 'Khoa', type: 'select', placeholder: 'Chọn khoa' },
    {
      name: 'education',
      label: 'Trình độ',
      type: 'select',
      placeholder: '-- Chọn trình độ học vị --',
      options: TEACHER_EDUCATION_LEVELS,
    },
    { name: 'address', label: 'Địa chỉ' },
  ],
  columns: ({ formatCode, renderAvatar, renderStatus, actions }) => [
    { key: 'avatar', header: '', className: 'w-14', render: renderAvatar },
    { key: 'id', header: 'Mã', className: 'font-semibold text-gray-800', render: (t) => formatCode(t.id) },
    {
      key: 'hoTen',
      header: 'Họ tên & Trình độ',
      render: (t) => (
        <div className="max-w-[200px]">
          <div className="font-bold text-gray-900 truncate" title={t.hoTen}>{t.hoTen}</div>
          {t.education ? (
            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150 shadow-2xs">
              <i className="fas fa-graduation-cap text-[10px] text-indigo-500" />
              <span>{t.education}</span>
            </span>
          ) : (
            <span className="text-gray-400 text-[11px] italic">Chưa cập nhật trình độ</span>
          )}
        </div>
      ),
    },
    { key: 'email', header: 'Email', render: (t) => <span className="truncate max-w-[180px] block text-xs" title={t.email}>{t.email}</span> },
    { key: 'department', header: 'Khoa', render: (t) => t.department ? <span className="truncate max-w-[180px] block text-xs" title={t.department}>{t.department}</span> : <span className="text-gray-400 text-xs">Chưa xác định</span> },
    { key: 'phone', header: 'SĐT' },
    { key: 'status', header: 'Tài khoản', className: 'text-center w-32', render: renderStatus },
    { key: 'actions', header: 'Thao tác', className: 'text-right w-44', render: actions },
  ],
};

export function ManageTeachers() {
  return <PersonManager config={teacherConfig} />;
}

export default ManageTeachers;
