import { PersonManager } from '../people/PersonManager.jsx';
import { teachersApi } from '../../../api/teachersApi.js';
import { formatTeacherCode } from '../../../lib/format.js';

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
    password: '',
  },
  fields: [
    { name: 'hoTen', label: 'Họ tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Số điện thoại' },
    { name: 'dob', label: 'Ngày sinh', type: 'date' },
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
    { name: 'education', label: 'Trình độ' },
    { name: 'address', label: 'Địa chỉ' },
  ],
  columns: ({ formatCode, renderAvatar, actions }) => [
    { key: 'avatar', header: '', className: 'w-14', render: renderAvatar },
    { key: 'id', header: 'Mã', className: 'font-semibold text-gray-800', render: (t) => formatCode(t.id) },
    { key: 'hoTen', header: 'Họ tên' },
    { key: 'email', header: 'Email' },
    { key: 'department', header: 'Khoa', render: (t) => t.department || <span className="text-gray-400">Chưa xác định</span> },
    { key: 'phone', header: 'SĐT' },
    { key: 'actions', header: '', className: 'text-right w-24', render: actions },
  ],
};

export function ManageTeachers() {
  return <PersonManager config={teacherConfig} />;
}

export default ManageTeachers;
