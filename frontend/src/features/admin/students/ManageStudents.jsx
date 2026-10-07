import { PersonManager } from '../people/PersonManager.jsx';
import { studentsApi, STUDENT_EDUCATION_LEVELS } from '../../../api/studentsApi.js';
import { formatStudentCode, getMaxBirthDate, formatDate } from '../../../lib/format.js';

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
  enableClassFilter: true,
  emptyForm: {
    hoTen: '',
    email: '',
    phone: '',
    dob: '',
    gender: 'Nam',
    education: 'Chính quy',
    address: '',
    departmentId: '',
    className: '',
    password: '123',
  },
  fields: [
    { name: 'hoTen', label: 'Họ tên', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true, emailDomain: '@student.edu.vn', placeholder: 'VD: 2011001 hoặc nguyenvana' },
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
    { name: 'address', label: 'Địa chỉ cư trú', required: true, validation: 'address', maxLength: 200, section: 'personal', fullWidth: true },
    { name: 'email', label: 'Email sinh viên', type: 'email', required: true, validation: 'studentEmail', placeholder: 'VD: sv.an@student.edu.vn', maxLength: 254, section: 'work' },
    { name: 'className', label: 'Lớp', required: true, validation: 'studentClass', maxLength: 40, section: 'work' },
    { name: 'departmentId', label: 'Khoa', type: 'select', required: true, validation: 'department', placeholder: 'Chọn khoa', section: 'work', fullWidth: true },
    {
      name: 'education',
      label: 'Hệ đào tạo',
      type: 'select',
      placeholder: '-- Chọn hệ đào tạo --',
      options: STUDENT_EDUCATION_LEVELS,
      section: 'work',
    },
  ],
  columns: ({ formatCode, renderAvatar, renderStatus, actions }) => [
    { key: 'avatar', header: '', className: 'w-14', render: renderAvatar },
    { key: 'id', header: 'Mã', className: 'font-semibold text-gray-800', render: (s) => formatCode(s.id) },
    {
      key: 'hoTen',
      header: 'Họ tên & Hệ ĐT',
      className: 'font-medium text-gray-900',
      render: (s) => (
        <div className="max-w-[190px]">
          <span className="truncate block font-semibold text-gray-900" title={s.hoTen}>{s.hoTen}</span>
          {s.education ? (
            <span className="inline-flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
              <i className="fas fa-graduation-cap text-[10px] text-emerald-500" />
              <span>{s.education}</span>
            </span>
          ) : (
            <span className="text-gray-400 text-[11px] italic">Chưa xác định hệ ĐT</span>
          )}
        </div>
      ),
    },
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
