import { PersonManager } from '../people/PersonManager.jsx';
import { teachersApi } from '../../../api/teachersApi.js';
import { formatTeacherCode } from '../../../lib/format.js';

const teacherConfig = {
  queryKey: 'teachers',
  api: teachersApi,
  title: 'Quản lý giáo viên',
  subtitle: 'Thêm, sửa, xóa giáo viên và nhập/xuất Excel',
  entityLabel: 'giáo viên',
  showSerialNumber: true,
  profilePanel: true,
  createTitle: 'Thêm Giảng Viên Mới',
  editTitle: 'Cập nhật thông tin giảng viên',
  exportName: 'giao-vien.xlsx',
  exportSheetName: 'Giáo viên',
  exportRows: (teachers) => teachers.map((teacher) => ({
    MaGV: teacher.id,
    HoTen: teacher.hoTen || '',
    TrinhDo: teacher.education || '',
    NgaySinh: teacher.dob || '',
    GioiTinh: teacher.gender || '',
    Khoa: teacher.department || '',
    SDT: teacher.phone || '',
    Email: teacher.email || '',
    DiaChi: teacher.address || '',
  })),
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
    { name: 'hoTen', label: 'Họ và tên', required: true, validation: 'name', maxLength: 100, section: 'personal' },
    { name: 'dob', label: 'Ngày sinh', type: 'date', required: true, validation: 'birthDate', section: 'personal' },
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
    { name: 'email', label: 'Email giảng viên', type: 'email', required: true, validation: 'teacherEmail', placeholder: 'VD: gv.an@university.edu.vn', maxLength: 254, section: 'work' },
    { name: 'education', label: 'Trình độ', required: true, validation: 'education', maxLength: 80, section: 'work' },
    { name: 'departmentId', label: 'Khoa', type: 'select', required: true, validation: 'department', placeholder: 'Chọn khoa công tác', section: 'work', fullWidth: true },
  ],
  columns: ({ formatCode, actions }) => [
    { key: 'serialNumber', header: 'STT', className: 'w-16 text-center' },
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
