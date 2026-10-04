import { PersonManager } from '../people/PersonManager.jsx';
import { studentsApi } from '../../../api/studentsApi.js';
import { formatStudentCode, getMaxBirthDate, formatDate } from '../../../lib/format.js';

const studentConfig = {
  queryKey: 'students',
  api: studentsApi,
  title: 'Quản lý sinh viên',
  subtitle: 'Thêm, sửa, xóa sinh viên và nhập/xuất Excel',
  entityLabel: 'sinh viên',
  exportName: 'sinh-vien.xlsx',
  formatCode: formatStudentCode,
  enableClassFilter: true,
  emptyForm: {
    hoTen: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    address: '',
    departmentId: '',
    className: '',
    password: '123',
  },
  fields: [
    { name: 'hoTen', label: 'Họ tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'className', label: 'Lớp sinh hoạt', placeholder: 'Ví dụ: 20DTH01' },
    { name: 'phone', label: 'Số điện thoại' },
    {
      name: 'dob',
      label: 'Ngày sinh',
      type: 'date',
      get max() {
        return getMaxBirthDate(17);
      },
      get hint() {
        return `Tối đa: ${formatDate(getMaxBirthDate(17))} (từ 17 tuổi trở lên)`;
      },
      maxError: 'Sinh viên phải từ 17 tuổi trở lên',
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
    { name: 'address', label: 'Địa chỉ' },
  ],
  columns: ({ formatCode, renderAvatar, renderStatus, actions }) => [
    { key: 'avatar', header: '', className: 'w-14', render: renderAvatar },
    { key: 'id', header: 'Mã', className: 'font-semibold text-gray-800', render: (s) => formatCode(s.id) },
    { key: 'hoTen', header: 'Họ tên', className: 'font-medium text-gray-900', render: (s) => <span className="truncate max-w-[180px] block" title={s.hoTen}>{s.hoTen}</span> },
    { key: 'className', header: 'Lớp sinh hoạt', render: (s) => (
      s.className ? (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
          {s.className}
        </span>
      ) : (
        <span className="text-gray-400 text-xs italic">Chưa phân lớp</span>
      )
    )},
    { key: 'email', header: 'Email', render: (s) => <span className="truncate max-w-[180px] block text-xs" title={s.email}>{s.email}</span> },
    { key: 'department', header: 'Khoa', render: (s) => s.department ? <span className="truncate max-w-[180px] block text-xs" title={s.department}>{s.department}</span> : <span className="text-gray-400 text-xs">Chưa xác định</span> },
    { key: 'status', header: 'Tài khoản', className: 'text-center w-32', render: renderStatus },
    { key: 'actions', header: 'Thao tác', className: 'text-right w-44', render: actions },
  ],
};

export function ManageStudents() {
  return <PersonManager config={studentConfig} />;
}

export default ManageStudents;
