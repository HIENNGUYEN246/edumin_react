import { PersonManager } from '../people/PersonManager.jsx';
import { studentsApi } from '../../../api/studentsApi.js';
import { formatStudentCode } from '../../../lib/format.js';

const studentConfig = {
  queryKey: 'students',
  api: studentsApi,
  title: 'Quản lý sinh viên',
  subtitle: 'Thêm, sửa, xóa sinh viên và nhập/xuất Excel',
  entityLabel: 'sinh viên',
  showSerialNumber: true,
  profilePanel: true,
  createTitle: 'Thêm Sinh Viên Mới',
  editTitle: 'Cập nhật thông tin sinh viên',
  profileCodeLabel: 'Mã SV',
  profileDetailField: 'className',
  profileDetailFallback: 'Lớp chưa cập nhật',
  exportName: 'sinh-vien.xlsx',
  exportSheetName: 'Sinh viên',
  exportRows: (students) => students.map((student) => ({
    MaSV: student.id,
    HoTen: student.hoTen || '',
    NgaySinh: student.dob || '',
    GioiTinh: student.gender || '',
    SDT: student.phone || '',
    Email: student.email || '',
    DiaChi: student.address || '',
    Khoa: student.department || '',
    Lop: student.className || '',
  })),
  formatCode: formatStudentCode,
  emptyForm: {
    hoTen: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    address: '',
    className: '',
    departmentId: '',
    password: '',
  },
  fields: [
    { name: 'hoTen', label: 'Họ và tên', required: true, validation: 'name', maxLength: 100, section: 'personal' },
    { name: 'dob', label: 'Ngày sinh', type: 'date', required: true, validation: 'birthDateNoFuture', section: 'personal' },
    { name: 'phone', label: 'Số điện thoại', type: 'tel', required: true, validation: 'phone', maxLength: 10, section: 'personal' },
    {
      name: 'gender',
      label: 'Giới tính',
      type: 'select',
      section: 'personal',
      options: [
        { value: 'Nam', label: 'Nam' },
        { value: 'Nữ', label: 'Nữ' },
        { value: 'Khác', label: 'Khác' },
      ],
    },
    { name: 'address', label: 'Địa chỉ cư trú', required: true, validation: 'address', maxLength: 200, section: 'personal', fullWidth: true },
    { name: 'email', label: 'Email sinh viên', type: 'email', required: true, validation: 'eduEmail', maxLength: 254, section: 'work' },
    { name: 'className', label: 'Lớp', required: true, validation: 'studentClass', maxLength: 40, section: 'work' },
    { name: 'departmentId', label: 'Khoa', type: 'select', required: true, validation: 'department', placeholder: 'Chọn khoa', section: 'work', fullWidth: true },
  ],
  columns: ({ formatCode, actions }) => [
    { key: 'serialNumber', header: 'STT', className: 'w-16 text-center' },
    { key: 'id', header: 'Mã', className: 'font-semibold text-gray-800', render: (s) => formatCode(s.id) },
    { key: 'hoTen', header: 'Họ tên' },
    { key: 'email', header: 'Email' },
    { key: 'className', header: 'Lớp' },
    { key: 'department', header: 'Khoa', render: (s) => s.department || <span className="text-gray-400">Chưa xác định</span> },
    { key: 'actions', header: '', className: 'text-right w-24', render: actions },
  ],
};

export function ManageStudents() {
  return <PersonManager config={studentConfig} />;
}

export default ManageStudents;
