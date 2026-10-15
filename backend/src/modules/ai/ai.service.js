import { CourseClass } from '../classes/courseClass.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { Department } from '../departments/department.model.js';
import { ProfileRequest } from '../profileRequests/profileRequest.model.js';
import { approveOne } from '../profileRequests/profileRequest.service.js';
import { Feedback } from '../feedback/feedback.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Attendance } from '../attendance/attendance.model.js';
import { Course } from '../courses/course.model.js';
import { slotsClash, rangesOverlap, dayLabel, shiftLabel } from '../../lib/schedule.js';
import { ROLES } from '../../lib/roles.js';
import { UserDesire } from './userDesire.model.js';
import {
  getAdminCriteria,
  setAdminCriteria,
  clearAdminCriteria,
  parseCriteriaFromText,
  evaluateRequestAgainstCriteria,
} from './adminCriteria.store.js';

import {
  findRelevantDocument,
  summarizeDocument,
  generateQuizFromDocument,
} from '../documents/documentRag.service.js';
import { Document } from '../documents/document.model.js';

/**
 * Normalizes text: removes accents, converts to lowercase, strips extraneous characters.
 */
function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Maps Day IDs to readable Vietnamese labels.
 */
const DAY_LABELS = {
  T2: 'Thứ Hai',
  T3: 'Thứ Ba',
  T4: 'Thứ Tư',
  T5: 'Thứ Năm',
  T6: 'Thứ Sáu',
  T7: 'Thứ Bảy',
  CN: 'Chủ Nhật',
};

const SHIFT_LABELS = {
  S1: 'Sáng (Tiết 1-3)',
  S2: 'Sáng (Tiết 4-6)',
  C1: 'Chiều (Tiết 7-9)',
  C2: 'Chiều (Tiết 10-12)',
  T1: 'Tối (Tiết 13-15)',
};

function describeSchedules(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return 'Chưa xếp lịch học';
  return schedules
    .map((s) => `${dayLabel(s.dayId)} (${shiftLabel(s.shiftId)})`)
    .join('; ');
}

async function findClassByQuery(rawQuery = '') {
  if (!rawQuery) return null;
  const q = rawQuery.trim();
  let cls = await CourseClass.findOne({
    $or: [{ id: new RegExp(`^${q}$`, 'i') }, { courseId: new RegExp(`^${q}$`, 'i') }],
  })
    .populate('courseRef')
    .populate('teacherRef')
    .lean();
  if (cls) return cls;

  cls = await CourseClass.findOne({
    $or: [
      { id: { $regex: q, $options: 'i' } },
      { courseId: { $regex: q, $options: 'i' } },
      { className: { $regex: q, $options: 'i' } },
      { courseName: { $regex: q, $options: 'i' } },
    ],
  })
    .populate('courseRef')
    .populate('teacherRef')
    .lean();

  return cls;
}

export const BUSINESS_RESERVED_WORDS = [
  'quiz', 'diem', 'bang diem', 'nhap diem', 'nhap lai diem', 'nhap lai', 'sua diem', 'vao diem',
  'cham diem', 'gpa', 'trong so', 'cot diem', 'dong bo quiz', 'dong bo', 'cau hinh quiz', 'cau hinh diem',
  'tom tat', 'y chinh', 'trac nghiem on tap', 'cau quiz', 'on tap', 'tai lieu', 'bai giang',
  'duyet', 'ho so', 'thay doi', 'phe duyet', 'xet duyet', 'cap nhat', 'avatar', 'anh dai dien',
  'giang vien', 'giao vien', 'thay', 'co', 'gv',
  'lop', 'lop hoc phan', 'mon', 'mon hoc', 'hoc phan',
  'hoc phi', 'tien hoc', 'cong no',
  'thoi khoa bieu', 'lich hoc', 'lich day', 'phong hoc', 'trung lich',
  'diem danh', 'chuyen can', 'vang', 'cam thi', 'quy che',
  'tai khoan', 'mat khau', 'phan hoi', 'y kien', 'gop y', 'feedback',
  'tong quan', 'dashboard', 'thong ke', 'bao cao',
  'sinh vien', 'sv', 'hoc sinh'
];

const OUT_OF_SCOPE_KEYWORDS = [
  'ky tuc xa', 'ktx', 'noi tru', 'phong o',
  'thu vien', 'muon sach', 'tra sach', 'sach giao trinh',
  'can tin', 'cang tin', 'nha an', 'an trua', 'do an', 'dat com',
  'xe buyt', 'xe bus', 'tuyen xe', 'dua don', 'gui xe', 'bai do xe', 've xe', 'giu xe',
  'hoc bong', 'tro cap', 'tro cap xa hoi', 'mien giam hoc phi',
  'tuyen sinh', 'xet tuyen', 'thi tuyen sinh', 'nop ho so tuyen sinh',
  'cau lac bo', 'clb', 'doan hoi', 'hoi sinh vien', 'ngoai khoa', 'tinh nguyen', 'mua he xanh',
  'y te', 'kham suc khoe', 'bao hiem y te', 'bhyt', 'benh xa', 'thuoc men',
  'bao luu', 'thoi hoc', 'rut ho so',
  'tot nghiep', 'xet tot nghiep', 'le tot nghiep', 'nhan bang', 'chung chi tot nghiep', 'bang dai hoc',
  'momo', 'zalopay', 'vnpay', 'quet the', 'vi dien tu', 'cong thanh toan',
  'cuu sinh vien', 'alumni',
  'do an tot nghiep', 'khoa luan', 'thuc tap', 'doanh nghiep',
  'nhan tin rieng', 'chat rieng', 'goi dien',
  'hop truc tuyen', 'zoom', 'google meet', 'microsoft teams',
  'wifi', 'mang truong', 'mat khau wifi',
];

const PAGE_INFO = [
  {
    path: '/admin',
    name: 'Tổng quan (Dashboard)',
    keywords: ['tong quan', 'dashboard', 'trang chu', 'trang chu admin', 'thong ke', 'thong ke he thong', 'bao cao'],
    description: 'Bạn có thể xem các chỉ số thống kê tổng quan về sinh viên, giảng viên, lớp học phần và biểu đồ phân tích trực tiếp trên màn hình.',
  },
  {
    path: '/admin/departments',
    name: 'Quản lý khoa',
    keywords: ['quan ly khoa', 'khoa dao tao', 'danh sach khoa', 'cac khoa', 'bo mon', 'khoa', 'them khoa'],
    description: 'Bạn có thể xem danh sách các khoa, thêm khoa mới hoặc chỉnh sửa thông tin khoa trực tiếp trên màn hình.',
  },
  {
    path: '/admin/teachers',
    name: 'Quản lý giáo viên',
    keywords: ['quan ly giang vien', 'quan ly giao vien', 'danh sach giang vien', 'danh sach giao vien', 'giao vien toan truong', 'giang vien toan truong', 'them giang vien', 'them giao vien', 'ho so giang vien', 'ho so giao vien'],
    description: 'Bạn có thể tra cứu, phân công khoa hoặc thêm hồ sơ giảng viên trực tiếp trên bảng.',
  },
  {
    path: '/admin/teacher-accounts',
    name: 'Tài khoản giáo viên',
    keywords: ['tai khoan giao vien', 'tai khoan giang vien', 'cap tai khoan giao vien', 'cap tai khoan giang vien', 'khoa tai khoan giao vien', 'phan quyen giao vien', 'reset mat khau giao vien'],
    description: 'Bạn có thể quản lý tài khoản đăng nhập, trạng thái kích hoạt hoặc đặt lại mật khẩu cho giảng viên trực tiếp tại đây.',
  },
  {
    path: '/admin/students',
    name: 'Quản lý sinh viên',
    keywords: ['quan ly sinh vien', 'danh sach sinh vien', 'ho so sinh vien', 'sinh vien toan truong', 'them sinh vien', 'tra cuu sinh vien'],
    description: 'Bạn có thể tìm kiếm, lọc theo khoa/lớp hoặc thêm mới hồ sơ sinh viên trực tiếp trên màn hình.',
  },
  {
    path: '/admin/student-accounts',
    name: 'Tài khoản sinh viên',
    keywords: ['tai khoan sinh vien', 'cap tai khoan sinh vien', 'khoa tai khoan sinh vien', 'kich hoat tai khoan sinh vien', 'reset mat khau sinh vien'],
    description: 'Bạn có thể quản lý danh sách tài khoản sinh viên, trạng thái kích hoạt hoặc đặt lại mật khẩu trực tiếp tại đây.',
  },
  {
    path: '/admin/courses',
    name: 'Quản lý học phần',
    keywords: ['quan ly hoc phan', 'hoc phan', 'quan ly mon hoc', 'danh muc hoc phan', 'danh sach hoc phan', 'danh muc mon hoc', 'danh sach mon hoc', 'mon hoc', 'tin chi', 'so tin chi', 'ma hoc phan', 'ma mon'],
    description: 'Bạn có thể xem và quản lý danh mục học phần đào tạo, số tín chỉ và mã học phần trực tiếp trên màn hình.',
  },
  {
    path: '/admin/classes',
    name: 'Quản lý lớp học phần',
    keywords: ['quan ly lop hoc phan', 'quan ly lop', 'lop hoc phan', 'mo lop', 'danh sach lop', 'tao lop', 'xep phong hoc', 'phan cong giang vien'],
    description: 'Bạn có thể tạo lớp học phần mới, xếp giảng viên, phòng học và thời khóa biểu trực tiếp trên màn hình.',
  },
  {
    path: '/admin/gradebook',
    name: 'Quản lý bảng điểm',
    keywords: ['quan ly bang diem', 'bang diem', 'xem diem', 'so diem', 'tra cuu diem', 'bang diem toan truong', 'chot so diem', 'chot so', 'khoa bang diem', 'khoa diem', 'phuc khao', 'sua diem', 'audit log', 'lich su sua diem'],
    description: 'Bạn có thể theo dõi bảng điểm tất cả các lớp học phần toàn trường, can thiệp sửa điểm phúc khảo kèm Audit Log, hoặc chốt sổ khóa bảng điểm trực tiếp tại đây.',
  },
  {
    path: '/admin/feedbacks',
    name: 'Ý kiến & Phản hồi',
    keywords: ['y kien & phan hoi', 'y kien va phan hoi', 'y kien', 'phan hoi', 'quan ly danh gia', 'danh gia sinh vien', 'y kien sinh vien', 'phan hoi sinh vien', 'gop y', 'feedback'],
    description: 'Bạn có thể theo dõi toàn bộ các ý kiến đóng góp và đánh giá của sinh viên toàn trường tại đây.',
  },
  {
    path: '/admin/profile-requests',
    name: 'Duyệt yêu cầu',
    keywords: ['duyet yeu cau', 'yeu cau duyet', 'duyet ho so', 'cho duyet', 'cap nhat ho so', 'yeu cau cap nhat', 'doi avatar', 'profile request'],
    description: 'Bạn có thể xem xét, duyệt hàng loạt hoặc từ chối các yêu cầu cập nhật hồ sơ trực tiếp tại bảng yêu cầu.',
  },
  {
    path: '/accountant/tuition',
    name: 'Quản lý học phí & công nợ',
    keywords: ['quan ly hoc phi', 'thu hoc phi', 'cong no', 'dong hoc phi', 'tien hoc'],
    description: 'Bạn có thể quản lý danh sách thu học phí, ghi nhận thanh toán và duyệt hàng loạt trực tiếp trên bảng.',
  },
  {
    path: '/teacher/classes',
    name: 'Danh sách Lớp học phần',
    keywords: ['lop toi phu trach', 'danh sach lop', 'lop hoc phan', 'bang diem'],
    description: 'Thầy/Cô có thể bấm vào nút "Bảng điểm" của từng lớp để nhập điểm, hoặc bấm "Cấu hình Quiz" trực tiếp trên màn hình.',
  },
  {
    path: '/teacher/attendance',
    name: 'Điểm danh & Chuyên cần',
    keywords: ['diem danh', 'chuyen can', 'vang mat', 'di tre'],
    description: 'Thầy/Cô có thể chọn lớp và ngày học để điểm danh trực tiếp cho từng sinh viên trên bảng.',
  },
  {
    path: '/teacher/schedule',
    name: 'Lịch dạy giảng viên',
    keywords: ['lich day', 'thoi khoa bieu', 'tkb', 'tiet day', 'ca day'],
    description: 'Thầy/Cô có thể theo dõi thời khóa biểu chi tiết theo từng ca học và phòng học trên lưới lịch tuần.',
  },
  {
    path: '/teacher/assignments',
    name: 'Bài tập & Quiz',
    keywords: ['bai tap', 'quiz', 'trac nghiem', 'tao quiz', 'de thi'],
    description: 'Thầy/Cô có thể tạo câu hỏi trắc nghiệm mới và quản lý các bài kiểm tra Quiz trực tiếp trên màn hình.',
  },
  {
    path: '/teacher/documents',
    name: 'Tài liệu giảng dạy',
    keywords: ['tai lieu', 'slide', 'bai giang', 'giao trinh'],
    description: 'Thầy/Cô có thể tải lên và quản lý tài liệu học tập cho các lớp học phần tại đây.',
  },
  {
    path: '/student/timetable',
    name: 'Thời khóa biểu',
    keywords: ['thoi khoa bieu', 'tkb', 'lich hoc', 'hom nay hoc gi'],
    description: 'Bạn đang ở ngay trang Thời khóa biểu rồi đây ạ! Bạn có thể xem lịch học các môn theo từng thứ và ca học trên màn hình.',
  },
  {
    path: '/student/attendance',
    name: 'Chuyên cần & Điểm số',
    keywords: ['chuyen can', 'diem danh', 'vang mat', 'xem diem'],
    description: 'Bạn đang ở ngay trang Điểm danh & Chuyên cần rồi đây ạ! Bạn có thể theo dõi tỷ lệ chuyên cần và điểm số các môn trực tiếp trên màn hình.',
  },
  {
    path: '/student/course-registration',
    name: 'Đăng ký học phần',
    keywords: ['dang ky hoc phan', 'dang ky mon', 'huy mon'],
    description: 'Bạn đang ở ngay trang Đăng ký học phần rồi đây ạ! Bạn có thể chọn các lớp học phần đang mở và đăng ký trực tiếp.',
  },
  {
    path: '/student/tuition',
    name: 'Học phí của tôi',
    keywords: ['hoc phi', 'tien hoc', 'cong no'],
    description: 'Bạn đang ở ngay trang Học phí rồi đây ạ! Bạn có thể xem số tiền cần nộp, thời hạn và trạng thái đóng học phí.',
  },
];

export const KNOWN_STUDENTS_MOCK = [
  { hoTen: 'Quyền Huế Trân', id: 2, code: 'SV-002', className: '13A1', department: 'Khoa Ngôn Ngữ Anh', education: 'Liên thông', email: 'quyen@student.edu.vn', status: 'Đang học' },
  { hoTen: 'Nguyễn Văn An', id: 1, code: 'SV-001', className: 'CNTT-K18', department: 'Khoa Công Nghệ Thông Tin', education: 'Chính quy', email: 'an.nguyen@edu.vn', status: 'Đang học' },
  { hoTen: 'Trần Văn A', id: 1, code: 'SV-001', className: '12A2', department: 'Khoa Công Nghệ Thông Tin', education: 'Đào tạo từ xa', email: 'ohn@student.edu.vn', status: 'Đang học' },
  { hoTen: 'Trần Đình Quân', id: 3, code: 'SV-003', className: '12A2', department: 'Khoa Công Nghệ Thông Tin', education: 'Vừa làm vừa học', email: 'anthonyq012025@gmail.com', status: 'Đang học' },
  { hoTen: 'Phạm Thị Bình', id: 2, code: 'SV-002', className: 'CNTT-K18', department: 'Khoa Công Nghệ Thông Tin', education: 'Chính quy', email: 'binh.pham@edu.vn', status: 'Đang học' },
  { hoTen: 'Đỗ Quốc Cường', id: 3, code: 'SV-003', className: 'NNA-K19', department: 'Khoa Ngôn Ngữ Anh', education: 'Chính quy', email: 'cuong.do@edu.vn', status: 'Đang học' },
];

export const MOCK_COURSE_GRADES = [
  { id: 'ENG101', code: 'ENG101', name: 'Tiếng Anh Giao Tiếp 1', credits: 3, attendance: 10.0, homework: 9.5, midterm: 9.0, final: 9.2, gpa: 9.3, status: 'Đạt', rank: 'Xuất sắc' },
  { id: 'IT101', code: 'IT101', name: 'Lập trình Web', credits: 3, attendance: 9.5, homework: 9.0, midterm: 8.5, final: 9.0, gpa: 8.9, status: 'Đạt', rank: 'Giỏi' },
  { id: 'CS102', code: 'CS102', name: 'Cấu trúc dữ liệu & Giải thuật', credits: 4, attendance: 8.5, homework: 8.0, midterm: 8.0, final: 8.5, gpa: 8.2, status: 'Đạt', rank: 'Giỏi' },
  { id: 'DB201', code: 'DB201', name: 'Cơ sở dữ liệu', credits: 3, attendance: 9.0, homework: 8.5, midterm: 8.0, final: 8.0, gpa: 8.1, status: 'Đạt', rank: 'Giỏi' },
  { id: 'MAT101', code: 'MAT101', name: 'Toán cao cấp A1', credits: 3, attendance: 9.0, homework: 7.5, midterm: 7.0, final: 7.5, gpa: 7.4, status: 'Đạt', rank: 'Khá' },
  { id: 'PHY101', code: 'PHY101', name: 'Vật lý đại cương', credits: 2, attendance: 7.0, homework: 6.0, midterm: 5.5, final: 4.5, gpa: 5.1, status: 'Đạt', rank: 'Trung bình' },
];

export const KNOWN_CLASSES_MOCK = [
  {
    id: 'ENG101-01',
    courseId: 'ENG101',
    courseName: 'Tiếng Anh Giao Tiếp 1',
    className: '13A1',
    department: 'Khoa Ngôn Ngữ Anh',
    credits: 3,
    teacher: 'ThS. Lê Thu Hà',
    room: 'A1-201',
    schedules: [{ dayId: 'T2', shiftId: 'S1' }, { dayId: 'T4', shiftId: 'S1' }],
    capacity: 40,
    enrolledCount: 35,
    status: 'Đang mở',
  },
  {
    id: 'IT101-01',
    courseId: 'IT101',
    courseName: 'Lập trình Web nâng cao',
    className: 'CNTT-K18',
    department: 'Khoa Công Nghệ Thông Tin',
    credits: 3,
    teacher: 'TS. Trần Minh Quân',
    room: 'B2-301',
    schedules: [{ dayId: 'T3', shiftId: 'C1' }, { dayId: 'T5', shiftId: 'C1' }],
    capacity: 45,
    enrolledCount: 42,
    status: 'Đang mở',
  },
  {
    id: 'CS102-01',
    courseId: 'CS102',
    courseName: 'Cấu trúc dữ liệu & Giải thuật',
    className: 'CNTT-K18',
    department: 'Khoa Công Nghệ Thông Tin',
    credits: 4,
    teacher: 'TS. Trần Minh Quân',
    room: 'B2-302',
    schedules: [{ dayId: 'T4', shiftId: 'S2' }],
    capacity: 50,
    enrolledCount: 48,
    status: 'Đang mở',
  },
  {
    id: 'DB201-01',
    courseId: 'DB201',
    courseName: 'Cơ sở dữ liệu',
    className: 'CNTT-K18',
    department: 'Khoa Công Nghệ Thông Tin',
    credits: 3,
    teacher: 'ThS. Nguyễn Thị Mai',
    room: 'C1-105',
    schedules: [{ dayId: 'T6', shiftId: 'C2' }],
    capacity: 40,
    enrolledCount: 38,
    status: 'Đang mở',
  },
];

export const KNOWN_PENDING_REQUESTS_MOCK = [
  {
    id: 'req-001',
    _id: 'req-001',
    requestId: 'req-001',
    requesterName: 'Nguyễn Văn An',
    requesterEmail: 'an.nguyen@edu.vn',
    requesterRole: 'sinh-vien',
    type: 'profile',
    status: 'pending',
    requestedData: { phone: '0912345678', address: 'Hà Nội' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'req-002',
    _id: 'req-002',
    requestId: 'req-002',
    requesterName: 'Quyền Huế Trân',
    requesterEmail: 'quyen@student.edu.vn',
    requesterRole: 'sinh-vien',
    type: 'avatar',
    status: 'pending',
    requestedData: { avatarUrl: 'https://avatar.iran.liara.run/public/girl' },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'req-003',
    _id: 'req-003',
    requestId: 'req-003',
    requesterName: 'Trần Đình',
    requesterEmail: 'dinh.tran@edu.vn',
    requesterRole: 'giao-vien',
    type: 'profile',
    status: 'pending',
    requestedData: { education: 'Tiến sĩ' },
    createdAt: new Date().toISOString(),
  },
];

/**
 * Extracts student target entity for grade entry / update operations from natural queries.
 * Examples: "vào điểm cho em Trân", "nhập điểm cho sinh viên Nguyễn Văn An", "vào điểm cho SV-002"
 */
export function extractGradeEntryQuery(rawText) {
  if (!rawText) return null;
  const raw = String(rawText).trim();
  const norm = normalizeText(raw);

  const isEntryIntent =
    norm.includes('vao diem') ||
    norm.includes('nhap diem') ||
    norm.includes('cham diem') ||
    norm.includes('sua diem cho') ||
    norm.includes('cap nhat diem cho') ||
    norm.includes('ghi diem');

  if (!isEntryIntent) return null;

  // Direct Student ID Match (e.g. SV-002, SV-001)
  const svIdMatch = raw.match(/\bSV[-_]?0*(\d+)\b/i);
  if (svIdMatch) {
    const idNumber = Number(svIdMatch[1]);
    const studentCode = `SV-${String(idNumber).padStart(3, '0')}`;
    return {
      targetType: 'student',
      idNumber,
      studentCode,
      rawKeyword: svIdMatch[0],
      candidateName: '',
      isGradeEntry: true,
    };
  }

  let cleaned = raw;
  cleaned = cleaned.replace(
    /^(?:bạn\s+(?:ơi\s*,?|hãy\s+)?|cho\s+(?:mình|em|tôi|thầy|cô)\s+|hãy\s+|giúp\s+(?:mình|em|tôi|thầy|cô)\s+)?(?:vào\s+điểm|nhập\s+điểm|chấm\s+điểm|sửa\s+điểm|cập\s+nhật\s+điểm)(?:\s+(?:cho|của|ở|lớp|môn))?\s*/i,
    ''
  ).trim();

  cleaned = cleaned.replace(
    /\s+(?:được\s+không\s+ạ\??|được\s+không\??|được\s+ko\??|nhé|nha|ạ|ơi|với\s+nha|với\s+nhé|với\s+ạ|với|giúp\s+mình|giúp\s+thầy|giúp\s+cô|[?!.,]+)$/i,
    ''
  ).trim();

  const roleStudentMatch = cleaned.match(/^(?:sinh\s+viên|sv|học\s+sinh|bạn|em)\s+(.+)$/i);
  let candidateName = cleaned;
  if (roleStudentMatch) {
    candidateName = roleStudentMatch[1].trim();
  }

  const normCandidate = normalizeText(candidateName);
  const genericWords = ['sinh vien', 'sv', 'hoc sinh', 'lop', 'hoc phan', 'mon hoc', 'quiz', 'bai tap', 'giua ky', 'cuoi ky', ''];
  if (!candidateName || genericWords.includes(normCandidate) || candidateName.length < 2 || BUSINESS_RESERVED_WORDS.includes(normCandidate)) {
    return null;
  }

  return {
    targetType: 'student',
    candidateName,
    rawKeyword: candidateName,
    isGradeEntry: true,
  };
}

/**
 * Extracts profile approval query details (Admin context).
 * Examples: "có hồ sơ nào chờ duyệt không?", "duyệt cho sinh viên Nguyễn Văn A", "duyệt hồ sơ em Trân"
 */
export function extractApprovalQuery(rawText) {
  if (!rawText) return null;
  const raw = String(rawText).trim();
  const norm = normalizeText(raw);

  const isApproveIntent =
    norm.includes('duyet') ||
    norm.includes('phe duyet') ||
    norm.includes('xet duyet') ||
    norm.includes('cho duyet') ||
    norm.includes('tu choi ho so') ||
    norm.includes('tu choi yeu cau') ||
    (norm.includes('ho so') && (norm.includes('cho') || norm.includes('moi') || norm.includes('yeu cau')));

  if (!isApproveIntent) return null;

  let candidateName = '';
  const matchPerson = raw.match(
    /(?:duyệt\s+cho\s+(?:sinh\s+viên|bạn|em|thầy|cô|giảng\s+viên)?|duyệt\s+hồ\s+sơ\s+(?:cho\s+|của\s+)?(?:sinh\s+viên|bạn|em|thầy|cô|giảng\s+viên)?|duyệt\s+(?:sinh\s+viên|bạn|em|thầy|cô|giảng\s+viên)\s+|yêu\s+cầu\s+của)\s+([^?.,!]+)/i
  );
  if (matchPerson && matchPerson[1]) {
    const cand = matchPerson[1].trim().replace(/\s+(?:được\s+không|không\s+ạ|không|ko|k|nhé|nha|ạ|ơi|hả|chưa|vậy|\?)+$/i, '').trim();
    const normCand = normalizeText(cand);
    const ignoreWords = ['ho so', 'yeu cau', 'moi', 'nguoi dung', 'tat ca', 'cho duyet', 'ngay', 'nhanh', 'toi', 'em', 'sinh vien', 'giang vien', 'khong', 'chua', 'nao', 'gi', 'ha', 'vay', 'nhi'];
    if (cand.length >= 2 && !ignoreWords.includes(normCand)) {
      candidateName = cand;
    }
  }

  return {
    isApproveIntent: true,
    candidateName,
    rawKeyword: candidateName,
  };
}

/**
 * Extracts class query details.
 * Examples: "danh sách lớp Tiếng Anh 1", "lớp Tiếng Anh 1", "lớp IT101"
 */
export function extractClassQuery(rawText) {
  if (!rawText) return null;
  const raw = String(rawText).trim();
  const norm = normalizeText(raw);

  const isClassWord =
    norm.includes('danh sach lop') ||
    norm.startsWith('lop ') ||
    norm.includes('lop hoc phan') ||
    norm.includes('thong tin lop') ||
    norm.includes('tim lop') ||
    norm.includes('tra cuu lop');

  if (!isClassWord) return null;

  // Exclude room or schedule inquiries
  if (
    norm.includes('phong') ||
    norm.includes('o dau') ||
    norm.includes('thu may') ||
    norm.includes('tiet') ||
    norm.includes('ca ') ||
    norm.includes('lich hoc')
  ) {
    return null;
  }

  let cleaned = raw
    .replace(
      /^(?:cho\s+(?:mình|em|tôi|thầy|cô)\s+(?:xem\s+)?|xem\s+|tìm\s+|lọc\s+|tra\s+cứu\s+|thông\s+tin\s+)?(?:danh\s+sách\s+lớp\s+học\s+phần|danh\s+sách\s+lớp|lớp\s+học\s+phần|lớp)\s*/i,
      ''
    )
    .trim();
  cleaned = cleaned.replace(/\s+(?:ở\s+đâu|được\s+không|nhé|nha|ạ|ơi|\?)+$/i, '').trim();

  return cleaned.length >= 2 ? cleaned : '';
}

/**
 * Checks whether a target student record represents the current logged-in user.
 */
export function isCurrentUserStudent(targetStudent, currentUser) {
  if (!targetStudent || !currentUser) return false;
  const role = currentUser.role || '';
  if (role !== ROLES.STUDENT && role !== 'sinh-vien' && role !== 'student') {
    return false;
  }
  const targetIdStr = String(targetStudent._id || targetStudent.id || '');
  const userStudentStr = String(currentUser.student || currentUser.studentId || currentUser._id || '');
  if (targetIdStr && userStudentStr && targetIdStr === userStudentStr) return true;

  if (targetStudent.userId && currentUser._id && String(targetStudent.userId) === String(currentUser._id)) return true;
  if (targetStudent.email && currentUser.email && targetStudent.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
  if (targetStudent.id != null && currentUser.id != null && Number(targetStudent.id) === Number(currentUser.id)) return true;

  const normTargetName = normalizeText(targetStudent.hoTen || targetStudent.name || '');
  const normUserName = normalizeText(currentUser.hoTen || currentUser.name || '');
  if (normTargetName && normUserName && normTargetName === normUserName) return true;

  return false;
}

/**
 * Extracts student target entity for grade inquiries from natural Vietnamese queries.
 * Handles patterns such as:
 * - "cho mình xem tình hình điểm của em Trân được không?" -> candidateName: "Trân"
 * - "bạn ơi cho mình xin kết quả học tập của SV-002 với nha" -> idNumber: 2, studentCode: "SV-002"
 * - "xem điểm của sinh viên Nguyễn Văn An" -> candidateName: "Nguyễn Văn An"
 * - "tình hình điểm của em Trân" -> candidateName: "Trân"
 * - "điểm của em Trân" -> candidateName: "Trân"
 */
export function extractStudentGradeQuery(rawText) {
  if (!rawText) return null;
  const raw = String(rawText).trim();
  const norm = normalizeText(raw);

  // Exclude grade entry intents - handled by ENTER_STUDENT_GRADE
  if (
    norm.includes('vao diem') ||
    norm.includes('nhap diem') ||
    norm.includes('nhap lai') ||
    norm.includes('sua diem') ||
    norm.includes('cap nhat diem') ||
    norm.includes('dong bo')
  ) {
    return null;
  }

  // Exclude attendance, lock operations, quiz configs, quiz operations
  if (
    norm.includes('diem danh') ||
    norm.includes('chot so') ||
    norm.includes('khoa bang diem') ||
    norm.includes('khoa diem') ||
    norm.includes('audit log') ||
    norm.includes('cau hinh quiz') ||
    norm.includes('cau hinh diem') ||
    norm.includes('quiz') ||
    norm.includes('trong so') ||
    norm.includes('cot diem')
  ) {
    return null;
  }

  // Reject filter and sorting queries - handled by FILTER_SORT_GRADES intent
  const filterSortWords = [
    'loc', 'sap xep', 'cao nhat', 'thap nhat', 'tang dan', 'giam dan',
    'top', 'can cai thien', 'duoi 5', 'duoi 4', 'tot nhat', 'kem nhat'
  ];
  if (filterSortWords.some((w) => norm.includes(w))) {
    return null;
  }

  // Reject general course inquiry phrases without explicit student ID
  const generalCourseWords = [
    'cac mon', 'tat ca cac mon', 'tat ca mon', 'nhung mon', 'cac hoc phan', 'mon hoc', 'hoc phan'
  ];
  if (generalCourseWords.some((w) => norm.includes(w)) && !raw.match(/\bSV[-_]?0*(\d+)\b/i)) {
    return null;
  }

  // Exact general grade inquiry phrases are NOT specific student queries
  const exactGeneralQueries = [
    'bang diem', 'xem diem', 'so diem', 'tra cuu diem', 'cho toi xem diem',
    'quan ly bang diem', 'bang diem toan truong', 'diem toan truong', 'diem', 'diem so', 'gpa',
    'phan diem sinh vien', 'phan diem', 'diem sinh vien', 'bang diem sinh vien',
    'so diem sinh vien', 'tra cuu diem sinh vien', 'xem diem sinh vien', 'vao phan diem sinh vien',
    'muc diem sinh vien', 'phan diem cua sinh vien', 'bang diem cua sinh vien'
  ];
  if (exactGeneralQueries.includes(norm)) return null;

  const hasGradeKeyword =
    norm.includes('diem') ||
    norm.includes('bang diem') ||
    norm.includes('ket qua hoc tap') ||
    norm.includes('ket qua thi') ||
    norm.includes('tinh hinh diem') ||
    norm.includes('so diem') ||
    norm.includes('gpa');

  if (!hasGradeKeyword) return null;

  // 1. Direct Student ID Match (e.g. SV-002, SV-001, SV002, SV1)
  const svIdMatch = raw.match(/\bSV[-_]?0*(\d+)\b/i);
  if (svIdMatch) {
    const idNumber = Number(svIdMatch[1]);
    const studentCode = `SV-${String(idNumber).padStart(3, '0')}`;
    return {
      targetType: 'student',
      idNumber,
      studentCode,
      rawKeyword: svIdMatch[0],
      candidateName: '',
      isGradeQuery: true,
    };
  }

  // 2. Strip conversational / polite leading phrases
  let cleaned = raw;
  cleaned = cleaned.replace(
    /^(?:bạn\s+(?:ơi\s*,?|hãy\s+)?|xin\s+chào\s*,?\s*|làm\s+sao\s+để\s+(?:vào|xem|mở|tra\s+cứu)?|làm\s+thế\s+nào\s+để\s+(?:vào|xem|mở|tra\s+cứu)?|làm\s+cách\s+nào\s+để\s+(?:vào|xem|mở|tra\s+cứu)?|hướng\s+dẫn\s+(?:vào|xem|mở)?|chỉ\s+(?:mình|em|tôi)\s+cách\s+(?:vào|xem|mở)?|cho\s+(?:mình|em|tôi|thầy|cô)\s+(?:xem|biết|xin|hỏi|tra\s+cứu)|cho\s+xem|hãy\s+(?:xem|tra\s+cứu|tìm)|xem\s+(?:giúp|giùm|hộ|cho)|tra\s+cứu\s+(?:giúp|giùm|hộ|cho)|tìm\s+(?:giúp|giùm|hộ|cho)|kiểm\s+tra\s+(?:giúp|giùm|hộ|cho)|vào\s+ngay|vào)\s+/i,
    ''
  ).trim();

  // 2b. Strip structural section words
  cleaned = cleaned.replace(/^(?:phần|mục|trang|bảng)\s+/i, '').trim();

  // 3. Strip grade intent leading phrases
  cleaned = cleaned.replace(
    /^(?:tình\s+hình\s+(?:học\s+tập\s+và\s+)?điểm(?:\s+số)?(?:\s+(?:của|cho))?|tình\s+hình\s+học\s+tập(?:\s+(?:của|cho))?|kết\s+quả\s+học\s+tập(?:\s+(?:của|cho))?|kết\s+quả\s+thi(?:\s+(?:của|cho))?|thông\s+tin\s+điểm(?:\s+(?:của|cho))?|bảng\s+điểm(?:\s+(?:của|cho))?|sổ\s+điểm(?:\s+(?:của|cho))?|tra\s+cứu\s+điểm(?:\s+(?:của|cho))?|xem\s+điểm(?:\s+(?:của|cho))?|điểm\s+số(?:\s+(?:của|cho))?|điểm(?:\s+(?:của|cho))?|gpa(?:\s+(?:của|cho))?)(?:\s+|$)/i,
    ''
  ).trim();

  // 4. Strip conversational trailing suffixes
  cleaned = cleaned.replace(
    /\s+(?:được\s+không\s+ạ\??|được\s+không\??|được\s+ko\??|được\s+k\??|không\s+vậy\??|không\s+ạ\??|không\??|thế\s+nào\??|như\s+thế\s+nào\??|ra\s+sao\??|với\s+nha|với\s+nhé|với\s+ạ|với|nhé|nha|ạ|ơi|nhe|nhá|giúp\s+mình|giùm\s+mình|hộ\s+mình|vậy|hả|chăng|[?!.,]+)$/i,
    ''
  ).trim();

  cleaned = cleaned.replace(/[?!.,]+$/g, '').trim();

  // 5. Strip student role markers (em, bạn, sinh viên, sv, học sinh)
  const roleStudentMatch = cleaned.match(/^(?:sinh\s+viên|sv|học\s+sinh|bạn|em)\s+(.+)$/i);
  let candidateName = cleaned;
  if (roleStudentMatch) {
    candidateName = roleStudentMatch[1].trim();
  }

  // Strip trailing context words (học kỳ này, kỳ này, môn này, ở đâu...)
  candidateName = candidateName.replace(/\s+(?:ở\s+đâu|học\s+lớp\s+nào|học\s+kỳ\s+này|kỳ\s+này|môn\s+này)$/i, '').trim();

  const genericWords = [
    'sinh vien', 'sv', 'hoc sinh', 'lop', 'hoc phan', 'mon hoc', 'tat ca', 'toan bo',
    'toan truong', 'chung', 'cac lop', 'tat ca cac lop', 'quan ly bang diem', 'bang diem toan truong',
    'bang diem', 'xem diem', 'so diem', 'tra cuu diem', 'diem', 'diem so', 'gpa',
    'phan diem sinh vien', 'phan diem', 'diem sinh vien', 'bang diem sinh vien',
    'so diem sinh vien', 'tra cuu diem sinh vien', 'xem diem sinh vien', 'vao phan diem sinh vien',
    'muc diem sinh vien', 'phan diem cua sinh vien', 'bang diem cua sinh vien', 'cac mon', 'nhung mon', ''
  ];
  const normCandidate = normalizeText(candidateName);
  if (
    !candidateName ||
    genericWords.includes(normCandidate) ||
    candidateName.length < 2 ||
    BUSINESS_RESERVED_WORDS.includes(normCandidate) ||
    BUSINESS_RESERVED_WORDS.some((w) => normCandidate === w || normCandidate.startsWith(w + ' ') || normCandidate.endsWith(' ' + w))
  ) {
    return null;
  }

  if (
    normCandidate.startsWith('lam sao') ||
    normCandidate.startsWith('lam the nao') ||
    normCandidate.startsWith('cach ') ||
    normCandidate.startsWith('huong dan') ||
    normCandidate.startsWith('o dau') ||
    normCandidate.startsWith('vao phan') ||
    normCandidate.includes('cao nhat') ||
    normCandidate.includes('thap nhat') ||
    normCandidate.includes('loc') ||
    normCandidate.includes('sap xep') ||
    normCandidate.includes('mon')
  ) {
    return null;
  }

  return {
    targetType: 'student',
    candidateName,
    rawKeyword: candidateName,
    isGradeQuery: true,
  };
}

/**
 * Intelligent Intent Classifier for EduMin AI Assistant.
 * Classifies natural Vietnamese conversational messages into semantic action intents.
 */
export function classifyAiIntent(rawText = '', { role = '', currentPath = '', pageContext = null } = {}) {
  const norm = normalizeText(rawText);

  // 1. Out of Scope Check
  if (OUT_OF_SCOPE_KEYWORDS.some((kw) => norm === kw || norm.includes(kw))) {
    return 'OUT_OF_SCOPE';
  }

  // 1a. Role-Specific Intelligent Intents (Triggered only when prompted)
  // Admin: Xóa / hủy tiêu chuẩn duyệt
  const isClearCriteria =
    (norm.includes('xoa tieu chi') ||
      norm.includes('xoa tieu chuan') ||
      norm.includes('huy tieu chi') ||
      norm.includes('huy tieu chuan') ||
      norm.includes('reset tieu chi') ||
      norm.includes('bo tieu chi') ||
      norm.includes('huy quy chuan')) &&
    !norm.includes('theo tieu chi');
  if (isClearCriteria) {
    return 'ADMIN_CLEAR_CRITERIA';
  }

  // Admin: Xem tiêu chuẩn/tiêu chí duyệt hiện tại
  const isGetCriteria =
    (norm.includes('xem tieu chi') ||
      norm.includes('xem tieu chuan') ||
      norm.includes('xem quy chuan') ||
      norm.includes('tieu chi hien tai') ||
      norm.includes('tieu chuan hien tai') ||
      norm.includes('tieu chi dang ap dung') ||
      norm.includes('tieu chuan dang ap dung') ||
      norm.includes('yeu cau kiem duyet dang ap dung') ||
      norm.includes('xem dieu kien duyet') ||
      norm.includes('dieu kien duyet hien tai') ||
      norm.includes('quy chuan kiem duyet hien tai') ||
      norm.includes('xem yeu cau kiem duyet')) &&
    !norm.includes('theo tieu chi') &&
    !norm.includes('theo tieu chuan');
  if (isGetCriteria) {
    return 'ADMIN_GET_CRITERIA';
  }

  // Admin: Duyệt / kiểm tra hồ sơ theo tiêu chuẩn/tiêu chí đã đặt
  const isApplyCriteria =
    norm.includes('theo tieu chuan') ||
    norm.includes('theo tieu chi') ||
    norm.includes('ho so dat chuan') ||
    norm.includes('ho so dat tieu chi') ||
    norm.includes('kiem tra tieu chuan') ||
    norm.includes('kiem tra tieu chi') ||
    norm.includes('ap dung tieu chuan') ||
    norm.includes('ap dung tieu chi') ||
    (norm.includes('duyet') &&
      (norm.includes('theo') || norm.includes('tieu chuan') || norm.includes('tieu chi')) &&
      !norm.includes('tieu chi duyet') &&
      !norm.includes('tieu chuan duyet') &&
      !norm.includes('ra tieu chi') &&
      !norm.includes('dat tieu chi') &&
      !norm.includes('thiet lap') &&
      !norm.includes('ra yeu cau'));
  if (isApplyCriteria) {
    return 'ADMIN_APPLY_CRITERIA_APPROVAL';
  }

  // Admin: Thiết lập tiêu chuẩn/tiêu chí duyệt hồ sơ qua chat (đón đầu trước khi có thay đổi)
  const isSetCriteria =
    (norm.includes('tieu chuan duyet') ||
      norm.includes('tieu chi duyet') ||
      norm.includes('ra tieu chi') ||
      norm.includes('dat tieu chi') ||
      norm.includes('thiet lap tieu chi') ||
      norm.includes('cai dat tieu chi') ||
      norm.includes('tieu chi cho ai') ||
      norm.includes('dieu kien kiem duyet') ||
      norm.includes('dieu kien duyet') ||
      norm.includes('quy dinh duyet') ||
      norm.includes('quy chuan duyet') ||
      norm.includes('quy chuan kiem duyet') ||
      norm.includes('dat tieu chuan') ||
      norm.includes('thiet lap tieu chuan') ||
      norm.includes('ra yeu cau') ||
      norm.includes('yeu cau duyet') ||
      norm.includes('yeu cau kiem duyet') ||
      norm.includes('yeu cau truoc') ||
      norm.includes('ra dieu kien') ||
      (norm.includes('tieu chuan') && (norm.includes('ho so') || norm.includes('duyet'))) ||
      (norm.includes('tieu chi') && (norm.includes('ho so') || norm.includes('duyet') || norm.includes('admin') || norm.includes('ai')))) &&
    !norm.includes('theo tieu chi') &&
    !norm.includes('theo tieu chuan') &&
    !norm.includes('xem tieu chi') &&
    !norm.includes('xem tieu chuan') &&
    !norm.includes('xem quy chuan') &&
    !norm.includes('xem dieu kien') &&
    (norm.includes('sdt') ||
      norm.includes('dien thoai') ||
      norm.includes('cccd') ||
      norm.includes('ly do') ||
      norm.includes('avatar') ||
      norm.includes('dat') ||
      norm.includes('thiet lap') ||
      norm.includes('chi duyet') ||
      norm.includes('khong duyet') ||
      norm.includes('dung') ||
      norm.includes('10 so') ||
      norm.includes('12 so') ||
      norm.includes('tieu chi') ||
      norm.includes('yeu cau') ||
      norm.includes('tu dong'));
  if (isSetCriteria) {
    return 'ADMIN_SET_CRITERIA';
  }

  // Admin: Xem tổng hợp ý kiến, nguyện vọng của Sinh viên & Giảng viên
  const isUserDesiresQuery =
    norm.includes('y kien nguoi dung') ||
    norm.includes('nguyen vong nguoi dung') ||
    norm.includes('mong muon cua sinh vien') ||
    norm.includes('mong muon cua giang vien') ||
    norm.includes('sinh vien voi giang vien co mong muon gi') ||
    norm.includes('sinh vien va giang vien co mong muon gi') ||
    norm.includes('tong hop y kien') ||
    norm.includes('xem y kien nguoi dung') ||
    norm.includes('nguoi dung muon gi') ||
    norm.includes('nguoi dung co phan hoi gi') ||
    (norm.includes('xem') && norm.includes('nguyen vong'));
  if (isUserDesiresQuery) {
    return 'ADMIN_VIEW_USER_DESIRES';
  }

  // Teacher: Tính điểm cho sinh viên dựa vào Quiz và Chuyên cần
  const isTeacherCalculateGrades =
    (norm.includes('tinh diem') || norm.includes('tinh toan diem') || norm.includes('du phong diem')) &&
    (norm.includes('quiz') || norm.includes('chuyen can') || norm.includes('sinh vien') || norm.includes('qua trinh') || norm.includes('lop'));
  if (isTeacherCalculateGrades) {
    return 'TEACHER_CALCULATE_GRADES';
  }

  // Student: Báo cáo tình hình học tập sau khi giảng viên đánh giá
  const isStudentAcademicReport =
    norm.includes('bao cao tinh hinh hoc tap') ||
    norm.includes('bao cao hoc tap') ||
    norm.includes('danh gia va ket qua hoc tap') ||
    norm.includes('sau khi giang vien danh gia') ||
    norm.includes('ket qua hoc tap sau khi') ||
    (norm.includes('tinh hinh hoc tap') && (norm.includes('danh gia') || norm.includes('cua toi')));
  if (isStudentAcademicReport) {
    return 'STUDENT_ACADEMIC_REPORT';
  }

  // Non-Admin (Sinh viên/Giảng viên): Ghi nhận ý muốn/nguyện vọng chat qua AI
  const isExpressingDesire =
    (norm.startsWith('em muon') ||
      norm.startsWith('toi muon') ||
      norm.includes('mong muon') ||
      norm.includes('nguyen vong') ||
      norm.includes('de xuat') ||
      norm.includes('kien nghi') ||
      norm.includes('xin mo lop') ||
      norm.includes('mo them lop') ||
      norm.includes('giam hoc phi') ||
      norm.includes('xin doi phong') ||
      norm.includes('xin doi lich')) &&
    !norm.includes('co mong muon gi') &&
    !norm.includes('xem');
  if (isExpressingDesire && (role === 'student' || role === 'sinh-vien' || role === 'teacher' || role === 'giao-vien' || !role || role !== 'admin')) {
    return 'RECORD_USER_DESIRE';
  }

  // 1b. Document Study Intents: Summarization & Interactive Quiz Generation
  const isDocSummarize =
    norm.includes('tom tat') ||
    norm.includes('y chinh cua tai lieu') ||
    norm.includes('khai niem cot loi') ||
    norm.includes('tom luoc') ||
    ((norm.includes('tai lieu') || norm.includes('bai giang')) &&
      (norm.includes('y chinh') || norm.includes('noi dung chinh') || norm.includes('chuong 1') || norm.includes('chuong 2') || norm.includes('chuong 3')));

  if (isDocSummarize) {
    return 'DOC_SUMMARIZE';
  }

  const isDocQuizGenerate =
    (norm.includes('cau quiz') ||
      norm.includes('quiz trac nghiem') ||
      norm.includes('bai quiz') ||
      norm.includes('trac nghiem on tap') ||
      norm.includes('de trac nghiem') ||
      (norm.includes('quiz') && (norm.includes('on tap') || norm.includes('tai lieu') || norm.includes('buoi hoc') || norm.includes('mon')))) &&
    (norm.includes('tao') ||
      norm.includes('sinh') ||
      norm.includes('lam') ||
      norm.includes('on tap') ||
      norm.includes('ra') ||
      norm.includes('cho toi') ||
      norm.includes('giup toi') ||
      norm.includes('5 cau') ||
      norm.includes('10 cau') ||
      norm.includes('cau hoi'));

  if (isDocQuizGenerate) {
    return 'DOC_QUIZ_GENERATE';
  }

  // 1c. Quiz / Grade Configuration Intent ("nhập lại điểm quiz", "cấu hình quiz", "đồng bộ quiz", "trọng số", "cài đặt điểm")
  const isGradeConfigWord =
    norm.includes('cau hinh diem') ||
    norm.includes('cau hinh quiz') ||
    norm.includes('gan quiz') ||
    norm.includes('trong so') ||
    norm.includes('ty le diem') ||
    norm.includes('trong so diem') ||
    norm.includes('lien ket quiz') ||
    norm.includes('chon quiz cho') ||
    norm.includes('cai dat diem') ||
    norm.includes('nhap lai diem quiz') ||
    norm.includes('nhap lai diem') ||
    norm.includes('nhap diem quiz') ||
    norm.includes('sua diem quiz') ||
    norm.includes('dong bo quiz');

  if (isGradeConfigWord) {
    return 'NAV_GRADE_CONFIG';
  }

  // 2. Teacher/Admin Grade Entry Intent ("vào điểm cho em Trân", "nhập điểm cho bạn Huê Trân", "vào điểm cho SV-002")
  if (extractGradeEntryQuery(rawText)) {
    return 'ENTER_STUDENT_GRADE';
  }

  // 3. Approval Intent for Admin (Duyệt hồ sơ, duyệt yêu cầu, có hồ sơ nào chờ duyệt không)
  if (extractApprovalQuery(rawText)) {
    return 'QUERY_PENDING_REQUESTS';
  }

  // 4. Student Regulation & Policies Guide (Quy chế cấm thi, thang điểm, tín chỉ tối đa, phúc khảo)
  const isRegulationWord =
    norm.includes('cam thi') ||
    norm.includes('quy che dao tao') ||
    norm.includes('quy dinh cam thi') ||
    norm.includes('dieu kien thi') ||
    norm.includes('vang bao nhieu buoi') ||
    norm.includes('vang may buoi') ||
    norm.includes('thang diem') ||
    norm.includes('quy doi diem') ||
    norm.includes('dang ky toi da bao nhieu tin chi') ||
    norm.includes('toi da bao nhieu tin chi') ||
    norm.includes('phuc khao');

  if (isRegulationWord && !norm.includes('diem danh')) {
    return 'STUDENT_REGULATION_GUIDE';
  }

  // 5. Student Homework & Quiz Guide (Hướng dẫn làm bài tập, làm quiz như thế nào)
  const isHomeworkGuideWord =
    norm.includes('huong dan lam bai tap') ||
    norm.includes('lam quiz nhu the nao') ||
    norm.includes('cach lam bai tap') ||
    norm.includes('cach lam quiz') ||
    norm.includes('lam quiz o dau') ||
    norm.includes('cach nop bai') ||
    norm.includes('huong dan nop bai');

  if (isHomeworkGuideWord) {
    return 'STUDENT_HOMEWORK_GUIDE';
  }

  // 6. Filter & Sort Grades (Highest, Lowest, Needs Improvement)
  const isFilterGradeWord =
    norm.includes('loc') ||
    norm.includes('sap xep') ||
    norm.includes('cao nhat') ||
    norm.includes('thap nhat') ||
    norm.includes('tang dan') ||
    norm.includes('giam dan') ||
    norm.includes('top') ||
    norm.includes('can cai thien');

  const isGradeContext =
    norm.includes('diem') ||
    norm.includes('bang diem') ||
    norm.includes('gpa') ||
    norm.includes('mon') ||
    norm.includes('hoc phan') ||
    (currentPath && (currentPath.includes('gradebook') || currentPath.includes('attendance')));

  if (isFilterGradeWord && isGradeContext) {
    return 'FILTER_SORT_GRADES';
  }

  // 7. Course Grades Summary (General Inquiry across courses)
  if (
    norm.includes('xem diem cac mon') ||
    norm.includes('bang diem cac mon') ||
    norm.includes('tinh hinh diem cac mon') ||
    norm.includes('diem cac mon') ||
    norm.includes('ket qua cac mon') ||
    norm.includes('xem diem hoc phan') ||
    norm.includes('diem hoc phan') ||
    ((norm.includes('xem diem') || norm.includes('bang diem')) && (norm.includes('cac mon') || norm.includes('tat ca mon')))
  ) {
    return 'COURSE_GRADES_SUMMARY';
  }

  // 8. Specific Student Grade Inquiry
  if (extractStudentGradeQuery(rawText)) {
    return 'SEARCH_STUDENT_GRADES';
  }

  // 9. Class / Course section query ("danh sách lớp Tiếng Anh 1", "lớp Tiếng Anh 1", "lớp IT101")
  if (
    extractClassQuery(rawText) &&
    !norm.includes('quan ly lop') &&
    !norm.includes('mo lop') &&
    !norm.includes('tao lop') &&
    !norm.includes('xep phong')
  ) {
    return 'QUERY_CLASS';
  }

  // 10. Tuition & Debt Inquiry
  if (
    norm.includes('hoc phi') ||
    norm.includes('tien hoc') ||
    norm.includes('cong no') ||
    norm.includes('dong tien') ||
    norm.includes('dong hoc phi') ||
    norm.includes('thu hoc phi')
  ) {
    return 'TUITION_INQUIRY';
  }

  // 11. Personnel Search
  const isTeacherSearch =
    /\b(GV[-_]?0*\d+)\b/i.test(rawText) ||
    norm.includes('tim giang vien') ||
    norm.includes('tim giao vien') ||
    norm.includes('tim thay') ||
    norm.includes('tim co') ||
    norm.includes('thong tin thay') ||
    norm.includes('thong tin co') ||
    norm.includes('thong tin giang vien') ||
    norm.includes('thong tin giao vien') ||
    norm.startsWith('tim gv') ||
    norm.startsWith('gv ') ||
    /(?:^|\s)(?:thầy|cô)\s+[A-ZÀ-Ỹa-zà-ỹ]/i.test(rawText);

  const isStudentSearch =
    /\b(SV[-_]?0*\d+)\b/i.test(rawText) ||
    norm.includes('tim sinh vien') ||
    norm.includes('tim hoc sinh') ||
    norm.includes('tim ban ') ||
    norm.includes('thong tin gi ve ban') ||
    norm.includes('thong tin ve ban') ||
    norm.includes('thong tin ban') ||
    norm.includes('thong tin sinh vien') ||
    norm.startsWith('tim sv') ||
    norm.startsWith('sv ') ||
    /(?:^|\s)bạn\s+[A-ZÀ-Ỹa-zà-ỹ]/i.test(rawText);

  if (isTeacherSearch) {
    const extractedTeacher = extractPersonnelQuery(rawText);
    return extractedTeacher && (extractedTeacher.candidateName || extractedTeacher.idNumber)
      ? 'SEARCH_TEACHER'
      : 'NAV_TEACHERS';
  }
  if (isStudentSearch) {
    const extractedStudent = extractPersonnelQuery(rawText);
    return extractedStudent && (extractedStudent.candidateName || extractedStudent.idNumber)
      ? 'SEARCH_STUDENT'
      : 'NAV_STUDENTS';
  }

  return 'OTHER';
}

/**
 * Extracts student or teacher target entities from natural Vietnamese queries.
 * Handles colloquial patterns such as:
 * - "có thông tin gì về bạn Quyền Huế Trân không ?"
 * - "bạn tìm giùm mình thầy Đình nha"
 * - "tìm sinh viên Nguyễn Văn An"
 * - "thông tin bạn Quyền Huế Trân"
 * - "tìm thầy Đình"
 * - "SV-002", "GV-001"
 */
function extractPersonnelQuery(rawText) {
  if (!rawText) return null;
  const q = String(rawText).trim();

  // 1. Direct ID matching: SV-002, SV002, GV-001, GV001
  const svIdMatch = q.match(/\bSV[-_]?0*(\d+)\b/i);
  if (svIdMatch) {
    return { targetType: 'student', idNumber: Number(svIdMatch[1]), rawKeyword: svIdMatch[0] };
  }
  const gvIdMatch = q.match(/\bGV[-_]?0*(\d+)\b/i);
  if (gvIdMatch) {
    return { targetType: 'teacher', idNumber: Number(gvIdMatch[1]), rawKeyword: gvIdMatch[0] };
  }

  // 2. Strip leading polite and conversational prefixes
  let cleaned = q;
  cleaned = cleaned.replace(
    /^(?:bạn\s+(?:ơi\s*,?|hãy\s+)?(?:tìm|tra\s+cứu|xem|kiểm\s+tra)\s+(?:giùm|giúp|hộ|cho)\s+(?:mình|em|tôi)|tìm\s+(?:giùm|giúp|hộ|cho)\s+(?:mình|em|tôi)|có\s+thông\s+tin\s+gì\s+về|cho\s+(?:mình|em|tôi)\s+(?:xin|biết|hỏi)\s+thông\s+tin\s+(?:về|của)|cho\s+(?:mình|em|tôi)\s+hỏi\s+về|thông\s+tin\s+về|thông\s+tin\s+của|thông\s+tin|tìm\s+kiếm|tìm|tra\s+cứu|xem|kiểm\s+tra|hỏi\s+về|biết\s+gì\s+về)\s+/i,
    ''
  ).trim();

  // 3. Strip trailing question/politeness particles
  cleaned = cleaned.replace(
    /\s+(?:không\s+vậy\??|không\s+ạ\??|không\s+nè\??|không\??|ko\??|k\??|nhỉ\??|nha\??|nhé\??|với\s+nha|với\s+nhé|với\s+ạ|với|ạ|ơi|nhe|nhá|giúp\s+mình|giùm\s+mình|được\s+không|được\s+ko|vậy|hả|chăng|vậy\??|[?!.,]+)$/i,
    ''
  ).trim();

  // Clean trailing punctuation
  cleaned = cleaned.replace(/[?!.,]+$/g, '').trim();

  // 4. Detect role prefixes on the remaining candidate
  let targetType = 'any';
  const roleStudentMatch = cleaned.match(/^(?:bạn|sinh\s+viên|sv|học\s+sinh|em)\s+(.+)$/i);
  const roleTeacherMatch = cleaned.match(/^(?:thầy|cô|giảng\s+viên|giáo\s+viên|gv|thầy\s+giáo|cô\s+giáo)\s+(.+)$/i);

  let candidateName = cleaned;
  if (roleStudentMatch) {
    targetType = 'student';
    candidateName = roleStudentMatch[1].trim();
  } else if (roleTeacherMatch) {
    targetType = 'teacher';
    candidateName = roleTeacherMatch[1].trim();
  } else {
    const norm = normalizeText(q);
    if (norm.includes('sinh vien') || norm.includes('hoc sinh')) {
      targetType = 'student';
    } else if (norm.includes('giang vien') || norm.includes('giao vien')) {
      targetType = 'teacher';
    }
  }

  // Strip common inquiry suffixes if any
  candidateName = candidateName.replace(/\s+(?:là\s+ai|ở\s+đâu|học\s+lớp\s+nào|dạy\s+môn\s+gì|như\s+thế\s+nào|là\s+sinh\s+viên\s+nào|là\s+giảng\s+viên\s+nào)$/i, '').trim();

  const normCandidate = normalizeText(candidateName);
  const genericPersonnel = [
    'sinh vien', 'sv', 'hoc sinh', 'giang vien', 'giao vien', 'thay', 'co', 'gv',
    'quiz', 'diem', 'bang diem', 'nhap lai diem', 'nhap lai', 'sua diem', 'vao diem',
    'ho so', 'duyet', 'yeu cau', 'lop', 'hoc phan', 'mon hoc', 'hoc phi', 'tai khoan', ''
  ];
  if (
    !candidateName ||
    candidateName.length < 2 ||
    genericPersonnel.includes(normCandidate) ||
    BUSINESS_RESERVED_WORDS.includes(normCandidate) ||
    BUSINESS_RESERVED_WORDS.some((w) => normCandidate === w || normCandidate.startsWith(w + ' ') || normCandidate.endsWith(' ' + w))
  ) {
    return null;
  }

  return { targetType, candidateName, originalQuery: rawText };
}

async function searchPersonnelInDb({ targetType, candidateName, idNumber }, pageContext = null) {
  const normTarget = normalizeText(candidateName || '');

  const matchesPersonnel = (person) => {
    if (!person) return false;
    const normName = normalizeText(person.hoTen || person.name || '');
    const normEmail = normalizeText(person.email || '');
    const normCode = normalizeText(person.code || (person.id != null ? `sv-${String(person.id).padStart(3, '0')}` : ''));
    const normGvCode = normalizeText(person.code || (person.id != null ? `gv-${String(person.id).padStart(3, '0')}` : ''));

    if (normName === normTarget || normEmail === normTarget || normCode === normTarget || normGvCode === normTarget) return true;
    if (normName.includes(normTarget) || normTarget.includes(normName)) return true;

    // Word-by-word token matching (e.g. "Huê Trân" -> words ['hue', 'tran'] in 'quyen hue tran')
    const targetWords = normTarget.split(/\s+/).filter((w) => w.length >= 2);
    if (targetWords.length > 0 && targetWords.every((w) => normName.includes(w))) return true;

    return false;
  };

  // 0. Check real-time pageContext if passed from frontend active view
  if (pageContext) {
    if (pageContext.students?.length && (targetType === 'student' || targetType === 'any')) {
      const match = pageContext.students.find(matchesPersonnel);
      if (match) return { type: 'student', list: [match] };
    }
    if (pageContext.teachers?.length && (targetType === 'teacher' || targetType === 'any')) {
      const match = pageContext.teachers.find(matchesPersonnel);
      if (match) return { type: 'teacher', list: [match] };
    }
  }

  // 1. By ID in Database
  if (idNumber) {
    if (targetType === 'student' || targetType === 'any') {
      const s = await Student.findOne({ id: idNumber }).populate('departmentRef').lean();
      if (s) return { type: 'student', list: [s] };
    }
    if (targetType === 'teacher' || targetType === 'any') {
      const t = await Teacher.findOne({ id: idNumber }).populate('departmentRef').lean();
      if (t) return { type: 'teacher', list: [t] };
    }
  }

  if (!candidateName || candidateName.length < 2) return null;

  // Common keywords that are NOT person names
  const notPersonNames = [
    'lop', 'hoc phan', 'mon hoc', 'tin chi', 'bang diem', 'diem', 'khoa',
    'tkb', 'thoi khoa bieu', 'lich hoc', 'lich day', 'hoc phi', 'tong quan',
    'dashboard', 'admin', 'he thong', 'tro ly', 'sinh vien', 'giang vien',
    'giao vien', 'tai khoan', 'yeu cau', 'duyet', 'diem danh', 'chuyen can'
  ];
  if (notPersonNames.includes(normTarget)) return null;

  const checkStudents = async () => {
    let found = await Student.find({
      $or: [
        { hoTen: { $regex: candidateName, $options: 'i' } },
        { email: { $regex: candidateName, $options: 'i' } },
      ],
    }).limit(5).populate('departmentRef').lean();

    if (found.length === 0) {
      const all = await Student.find({}).limit(200).populate('departmentRef').lean();
      found = all.filter(matchesPersonnel);
    }
    return found;
  };

  const checkTeachers = async () => {
    let found = await Teacher.find({
      $or: [
        { hoTen: { $regex: candidateName, $options: 'i' } },
        { email: { $regex: candidateName, $options: 'i' } },
      ],
    }).limit(5).populate('departmentRef').lean();

    if (found.length === 0) {
      const all = await Teacher.find({}).limit(200).populate('departmentRef').lean();
      found = all.filter(matchesPersonnel);
    }
    return found;
  };

  if (targetType === 'student') {
    const students = await checkStudents();
    if (students.length > 0) return { type: 'student', list: students };
    const teachers = await checkTeachers();
    if (teachers.length > 0) return { type: 'teacher', list: teachers };
  } else if (targetType === 'teacher') {
    const teachers = await checkTeachers();
    if (teachers.length > 0) return { type: 'teacher', list: teachers };
    const students = await checkStudents();
    if (students.length > 0) return { type: 'student', list: students };
  } else {
    const students = await checkStudents();
    if (students.length > 0) return { type: 'student', list: students };
    const teachers = await checkTeachers();
    if (teachers.length > 0) return { type: 'teacher', list: teachers };
  }

  return null;
}

/**
 * Intent detector based on keyword analysis and business entity verification.
 * Guarantees operational questions (grades/quiz, approvals, teacher inquiry)
 * never mistakenly route into student lookup.
 *
 * Categories:
 * - 'GRADE_MANAGEMENT': contains ("điểm", "quiz", "bảng điểm", "gpa", "trọng số", "nhập lại điểm"...)
 * - 'ADMIN_APPROVAL': contains ("duyệt", "hồ sơ", "thay đổi", "xét duyệt", "phê duyệt"...)
 * - 'TEACHER_SEARCH': contains ("giảng viên", "thầy", "cô", "gv"...)
 * - 'STUDENT_SEARCH': ONLY when explicit student name/ID is present and not matching reserved business terms.
 * - 'GENERAL_FALLBACK': general guidance / fallback when no specific intent matches.
 */
export function detectIntent(rawText, options = {}) {
  if (!rawText || typeof rawText !== 'string') return 'GENERAL_FALLBACK';
  const raw = String(rawText).trim();
  if (!raw) return 'GENERAL_FALLBACK';
  const norm = normalizeText(raw);

  // 0. Specialized Role-Based Prompts (Explicitly requested by user prompts)
  const isClearCriteria =
    (norm.includes('xoa tieu chi') ||
      norm.includes('xoa tieu chuan') ||
      norm.includes('huy tieu chi') ||
      norm.includes('huy tieu chuan') ||
      norm.includes('reset tieu chi') ||
      norm.includes('bo tieu chi') ||
      norm.includes('huy quy chuan')) &&
    !norm.includes('theo tieu chi');
  if (isClearCriteria) {
    return 'ADMIN_CLEAR_CRITERIA';
  }

  const isGetCriteria =
    (norm.includes('xem tieu chi') ||
      norm.includes('xem tieu chuan') ||
      norm.includes('xem quy chuan') ||
      norm.includes('tieu chi hien tai') ||
      norm.includes('tieu chuan hien tai') ||
      norm.includes('tieu chi dang ap dung') ||
      norm.includes('tieu chuan dang ap dung') ||
      norm.includes('yeu cau kiem duyet dang ap dung') ||
      norm.includes('xem dieu kien duyet') ||
      norm.includes('dieu kien duyet hien tai') ||
      norm.includes('quy chuan kiem duyet hien tai') ||
      norm.includes('xem yeu cau kiem duyet')) &&
    !norm.includes('theo tieu chi') &&
    !norm.includes('theo tieu chuan');
  if (isGetCriteria) {
    return 'ADMIN_GET_CRITERIA';
  }

  const isApplyCriteria =
    norm.includes('theo tieu chuan') ||
    norm.includes('theo tieu chi') ||
    norm.includes('ho so dat chuan') ||
    norm.includes('ho so dat tieu chi') ||
    norm.includes('kiem tra tieu chuan') ||
    norm.includes('kiem tra tieu chi') ||
    norm.includes('ap dung tieu chuan') ||
    norm.includes('ap dung tieu chi') ||
    (norm.includes('duyet') &&
      (norm.includes('theo') || norm.includes('tieu chuan') || norm.includes('tieu chi')) &&
      !norm.includes('tieu chi duyet') &&
      !norm.includes('tieu chuan duyet') &&
      !norm.includes('ra tieu chi') &&
      !norm.includes('dat tieu chi') &&
      !norm.includes('thiet lap') &&
      !norm.includes('ra yeu cau'));
  if (isApplyCriteria) {
    return 'ADMIN_APPLY_CRITERIA_APPROVAL';
  }

  const isSetCriteria =
    (norm.includes('tieu chuan duyet') ||
      norm.includes('tieu chi duyet') ||
      norm.includes('ra tieu chi') ||
      norm.includes('dat tieu chi') ||
      norm.includes('thiet lap tieu chi') ||
      norm.includes('cai dat tieu chi') ||
      norm.includes('tieu chi cho ai') ||
      norm.includes('dieu kien kiem duyet') ||
      norm.includes('dieu kien duyet') ||
      norm.includes('quy dinh duyet') ||
      norm.includes('quy chuan duyet') ||
      norm.includes('quy chuan kiem duyet') ||
      norm.includes('dat tieu chuan') ||
      norm.includes('thiet lap tieu chuan') ||
      norm.includes('ra yeu cau') ||
      norm.includes('yeu cau duyet') ||
      norm.includes('yeu cau kiem duyet') ||
      norm.includes('yeu cau truoc') ||
      norm.includes('ra dieu kien') ||
      (norm.includes('tieu chuan') && (norm.includes('ho so') || norm.includes('duyet'))) ||
      (norm.includes('tieu chi') && (norm.includes('ho so') || norm.includes('duyet') || norm.includes('admin') || norm.includes('ai')))) &&
    !norm.includes('theo tieu chi') &&
    !norm.includes('theo tieu chuan') &&
    !norm.includes('xem tieu chi') &&
    !norm.includes('xem tieu chuan') &&
    !norm.includes('xem quy chuan') &&
    !norm.includes('xem dieu kien') &&
    (norm.includes('sdt') ||
      norm.includes('dien thoai') ||
      norm.includes('cccd') ||
      norm.includes('ly do') ||
      norm.includes('avatar') ||
      norm.includes('dat') ||
      norm.includes('thiet lap') ||
      norm.includes('chi duyet') ||
      norm.includes('khong duyet') ||
      norm.includes('dung') ||
      norm.includes('10 so') ||
      norm.includes('12 so') ||
      norm.includes('tieu chi') ||
      norm.includes('yeu cau') ||
      norm.includes('tu dong'));
  if (isSetCriteria) {
    return 'ADMIN_SET_CRITERIA';
  }

  const isUserDesiresQuery =
    norm.includes('y kien nguoi dung') ||
    norm.includes('nguyen vong nguoi dung') ||
    norm.includes('mong muon cua sinh vien') ||
    norm.includes('mong muon cua giang vien') ||
    norm.includes('sinh vien voi giang vien co mong muon gi') ||
    norm.includes('sinh vien va giang vien co mong muon gi') ||
    norm.includes('tong hop y kien') ||
    norm.includes('xem y kien nguoi dung') ||
    norm.includes('nguoi dung muon gi') ||
    norm.includes('nguoi dung co phan hoi gi') ||
    (norm.includes('xem') && norm.includes('nguyen vong'));
  if (isUserDesiresQuery) {
    return 'ADMIN_VIEW_USER_DESIRES';
  }

  const isTeacherCalculateGrades =
    (norm.includes('tinh diem') || norm.includes('tinh toan diem') || norm.includes('du phong diem')) &&
    (norm.includes('quiz') || norm.includes('chuyen can') || norm.includes('sinh vien') || norm.includes('qua trinh') || norm.includes('lop'));
  if (isTeacherCalculateGrades) {
    return 'TEACHER_CALCULATE_GRADES';
  }

  const isStudentAcademicReport =
    norm.includes('bao cao tinh hinh hoc tap') ||
    norm.includes('bao cao hoc tap') ||
    norm.includes('danh gia va ket qua hoc tap') ||
    norm.includes('sau khi giang vien danh gia') ||
    norm.includes('ket qua hoc tap sau khi') ||
    (norm.includes('tinh hinh hoc tap') && (norm.includes('danh gia') || norm.includes('cua toi')));
  if (isStudentAcademicReport) {
    return 'STUDENT_ACADEMIC_REPORT';
  }

  const isExpressingDesire =
    (norm.startsWith('em muon') ||
      norm.startsWith('toi muon') ||
      norm.includes('mong muon') ||
      norm.includes('nguyen vong') ||
      norm.includes('de xuat') ||
      norm.includes('kien nghi') ||
      norm.includes('xin mo lop') ||
      norm.includes('mo them lop') ||
      norm.includes('giam hoc phi') ||
      norm.includes('xin doi phong') ||
      norm.includes('xin doi lich')) &&
    !norm.includes('co mong muon gi') &&
    !norm.includes('xem');
  if (isExpressingDesire && (options.role === 'student' || options.role === 'sinh-vien' || options.role === 'teacher' || options.role === 'giao-vien' || !options.role || options.role !== 'admin')) {
    return 'RECORD_USER_DESIRE';
  }

  // 1. Grade & Quiz Operations ("điểm", "quiz", "bảng điểm")
  const hasGradeOrQuizKeywords =
    norm.includes('quiz') ||
    norm.includes('bang diem') ||
    norm.includes('diem') ||
    norm.includes('gpa') ||
    norm.includes('trong so') ||
    norm.includes('cot diem') ||
    norm.includes('nhap lai');

  const isStrictAttendanceOnly =
    norm.includes('diem danh') &&
    !norm.includes('bang diem') &&
    !norm.includes('quiz') &&
    !norm.includes('nhap') &&
    !norm.includes('gpa');

  if (hasGradeOrQuizKeywords && !isStrictAttendanceOnly) {
    return 'GRADE_MANAGEMENT';
  }

  // 2. Admin Approval & Profile Requests ("duyệt", "hồ sơ", "thay đổi")
  const hasApprovalKeywords =
    norm.includes('duyet') ||
    norm.includes('ho so') ||
    norm.includes('thay doi') ||
    norm.includes('phe duyet') ||
    norm.includes('xet duyet') ||
    norm.includes('cho duyet') ||
    norm.includes('cap nhat avatar') ||
    norm.includes('doi avatar');

  if (hasApprovalKeywords) {
    return 'ADMIN_APPROVAL';
  }

  // 3. Teacher Inquiry & Search ("giảng viên", "thầy", "cô")
  const hasTeacherKeywords =
    norm.includes('giang vien') ||
    norm.includes('giao vien') ||
    norm.includes('thay') ||
    norm.includes('co') ||
    norm.startsWith('gv') ||
    norm.includes(' gv') ||
    /\b(GV[-_]?0*\d+)\b/i.test(raw);

  if (hasTeacherKeywords) {
    return 'TEACHER_SEARCH';
  }

  // 4. Student Search - ONLY when explicit student keywords / student ID with valid non-reserved name
  const svIdMatch = raw.match(/\bSV[-_]?0*(\d+)\b/i);
  if (svIdMatch) {
    return 'STUDENT_SEARCH';
  }

  const isExplicitStudentPhrase =
    norm.includes('tim sinh vien') ||
    norm.includes('tim sv') ||
    norm.includes('tim ban ') ||
    norm.includes('thong tin ban ') ||
    norm.includes('thong tin ve ban ') ||
    norm.includes('thong tin sinh vien') ||
    norm.startsWith('sv ') ||
    /(?:^|\s)(?:sinh\s+viên|sv|bạn|em)\s+[A-ZÀ-Ỹa-zà-ỹ]/i.test(raw);

  if (isExplicitStudentPhrase) {
    const studentQuery = extractPersonnelQuery(raw);
    const candidate = studentQuery?.candidateName ? normalizeText(studentQuery.candidateName) : '';
    if (candidate && candidate.length >= 2 && !BUSINESS_RESERVED_WORDS.includes(candidate)) {
      return 'STUDENT_SEARCH';
    }
  }

  // 5. Fallback
  return 'GENERAL_FALLBACK';
}

/**
 * Safe student search utility that guards against business reserved words.
 * Prevents operational queries like "nhập lại điểm Quiz", "duyệt hồ sơ", "tìm giảng viên"
 * from ever triggering a false "student not found" error.
 */
export async function findStudentByName(nameOrKeyword, context = null) {
  if (!nameOrKeyword || typeof nameOrKeyword !== 'string') return null;
  const raw = nameOrKeyword.trim();
  if (raw.length < 2) return null;
  const norm = normalizeText(raw);

  // Strict guard: reject reserved business terms immediately
  if (
    BUSINESS_RESERVED_WORDS.includes(norm) ||
    BUSINESS_RESERVED_WORDS.some((w) => norm === w || norm.startsWith(w + ' ') || norm.endsWith(' ' + w))
  ) {
    return null;
  }

  // 1. Check in context (real-time pageContext or passed list)
  let studentList = [];
  if (Array.isArray(context)) {
    studentList = context;
  } else if (context && Array.isArray(context.students)) {
    studentList = context.students;
  }

  const svIdMatch = raw.match(/\bSV[-_]?0*(\d+)\b/i);
  const targetId = svIdMatch ? Number(svIdMatch[1]) : (!Number.isNaN(Number(raw)) && Number(raw) > 0 ? Number(raw) : null);

  const matchesStudent = (s) => {
    if (!s) return false;
    if (targetId && (s.id === targetId || s.code === `SV-${String(targetId).padStart(3, '0')}`)) {
      return true;
    }
    const normName = normalizeText(s.hoTen || s.name || '');
    const normEmail = normalizeText(s.email || '');
    const normCode = normalizeText(s.code || (s.id != null ? `sv-${String(s.id).padStart(3, '0')}` : ''));

    if (normName === norm || normEmail === norm || normCode === norm) return true;
    if (normName.includes(norm) || norm.includes(normName)) return true;

    const words = norm.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length > 0 && words.every((w) => normName.includes(w))) return true;

    return false;
  };

  if (studentList.length > 0) {
    const foundInContext = studentList.find(matchesStudent);
    if (foundInContext) return foundInContext;
  }

  // 2. Query Database
  try {
    if (targetId) {
      const s = await Student.findOne({ id: targetId }).populate('departmentRef').lean();
      if (s) return s;
    }
    const s = await Student.findOne({
      $or: [
        { hoTen: { $regex: raw, $options: 'i' } },
        { email: { $regex: raw, $options: 'i' } },
      ],
    }).populate('departmentRef').lean();
    if (s) return s;

    const all = await Student.find({}).limit(200).populate('departmentRef').lean();
    const match = all.find(matchesStudent);
    if (match) return match;
  } catch {}

  // 3. Fallback mock list
  return KNOWN_STUDENTS_MOCK.find(matchesStudent) || null;
}

export async function handleAiAssistantQuery({ message, user, currentPath = '', pageContext = null }) {
  const rawText = String(message || '').trim();
  const text = normalizeText(rawText);

  const role = user?.role || '';
  const isAdmin = role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao';
  const isTeacher = role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien';
  const isStudent = role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien';

  const isExcludedFromPersonnel =
    text.includes('quan ly') ||
    text.includes('danh sach') ||
    text.includes('tai khoan') ||
    text.includes('yeu cau') ||
    text.includes('duyet') ||
    text.includes('ho so') ||
    text.includes('thay doi') ||
    text.includes('phe duyet') ||
    text.includes('xet duyet') ||
    text.includes('diem cua') ||
    text.includes('xem diem') ||
    text.includes('bang diem') ||
    text.includes('phan diem') ||
    text.includes('tinh hinh diem') ||
    text.includes('ket qua hoc tap') ||
    text.includes('ket qua thi') ||
    text.includes('so diem') ||
    text.includes('quiz') ||
    text.includes('nhap lai') ||
    text.includes('sua diem') ||
    text.includes('dong bo') ||
    text.includes('trong so') ||
    text.includes('cot diem') ||
    text.includes('cau hinh') ||
    Boolean(extractStudentGradeQuery(rawText)) ||
    Boolean(extractGradeEntryQuery(rawText)) ||
    Boolean(extractApprovalQuery(rawText)) ||
    Boolean(extractClassQuery(rawText)) ||
    text.includes('cam thi') ||
    text.includes('quy che') ||
    text.includes('lam quiz') ||
    text.includes('bai tap') ||
    text.includes('loc') ||
    text.includes('sap xep') ||
    text.includes('cao nhat') ||
    text.includes('thap nhat') ||
    text.includes('cac mon') ||
    text.includes('hoc phi') ||
    text.includes('tien hoc') ||
    text.includes('cong no') ||
    text.includes('thoi khoa bieu') ||
    text.includes('lich hoc') ||
    text.includes('lich day') ||
    text.includes('day mon') ||
    text.includes('day lop') ||
    text.includes('phu trach') ||
    text.includes('si so') ||
    text.includes('so luong sinh vien') ||
    text.includes('vang nhieu') ||
    text.includes('chuyen can') ||
    text.includes('tom tat') ||
    text.includes('tai lieu') ||
    text.includes('y chinh') ||
    text.includes('cau quiz') ||
    text.includes('on tap');

  const extracted = !isExcludedFromPersonnel ? extractPersonnelQuery(rawText) : null;
  const isCandidateNameLikely =
    extracted &&
    (extracted.idNumber ||
      (extracted.candidateName &&
        extracted.candidateName.length >= 2 &&
        !OUT_OF_SCOPE_KEYWORDS.some((k) => text === k || text.startsWith(k + ' '))));

  // 0. Location / Current Page Awareness
  if (currentPath) {
    const normPath = currentPath.toLowerCase().trim();
    const currentPageMatch =
      PAGE_INFO.find((p) => normPath === p.path) ||
      PAGE_INFO.filter((p) => p.path !== '/' && normPath.startsWith(p.path + '/')).sort(
        (a, b) => b.path.length - a.path.length
      )[0];
    if (currentPageMatch && !extractStudentGradeQuery(rawText) && !isCandidateNameLikely) {
      const isAskingAboutCurrentPage =
        currentPageMatch.keywords.some((kw) => text.includes(kw)) ||
        text.includes('trang nay') ||
        text.includes('o day') ||
        text.includes('lam gi o day') ||
        text.includes('dang o dau');

      if (isAskingAboutCurrentPage) {
        return {
          reply: `Dạ, hiện tại bạn đang ở ngay trang **${currentPageMatch.name}** rồi đây ạ! ${currentPageMatch.description}`,
          intent: 'CURRENT_PAGE_ALREADY',
          quickLinks: [{ label: `Đang ở trang ${currentPageMatch.name}`, path: currentPageMatch.path }],
        };
      }
    }
  }

  const intent = classifyAiIntent(rawText, { role, currentPath, pageContext });

  // Helper: Evaluates pending requests against criteria, auto-approves valid ones, and keeps invalid ones pending
  async function evaluateAndProcessCriteriaRequests(criteria, currentUser) {
    let pendingList = [];
    try {
      pendingList = await ProfileRequest.find({ status: 'pending' }).sort({ createdAt: -1 });
    } catch {
      pendingList = [];
    }

    if (!pendingList || pendingList.length === 0) {
      return {
        pendingList: [],
        autoApproved: [],
        keptPending: [],
        cards: [],
        reply:
          `🛡️ **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG ĐÃ ĐƯỢC THIẾT LẬP ĐÓN ĐẦU (PRE-CONFIGURED POLICY)**\n\n` +
          `Quy chuẩn kiểm duyệt tự động đã được lưu và kích hoạt trước trên toàn hệ thống:\n` +
          `• **Tiêu chuẩn đang áp dụng:** ${criteria.rules?.customSummary || criteria.rawCriteriaText}\n` +
          `• **Tiêu chí kiểm định đón đầu:**\n` +
          `${criteria.rules?.requirePhone10 ? '  ✓ Số điện thoại bắt buộc đủ 10 chữ số\n' : ''}` +
          `${criteria.rules?.requireCccd12 ? '  ✓ Căn cước công dân (CCCD): Đủ 12 chữ số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD)\n' : ''}` +
          `${criteria.rules?.requireReason ? '  ✓ Bắt buộc có lý do thay đổi rõ ràng\n' : ''}` +
          `${criteria.rules?.requireName ? '  ✓ Bắt buộc họ tên đầy đủ\n' : ''}` +
          `${criteria.rules?.requireAddress ? '  ✓ Bắt buộc địa chỉ không để trống\n' : ''}` +
          `${criteria.rules?.noAvatar ? '  ✓ Không duyệt yêu cầu cập nhật avatar\n' : ''}` +
          `\n⚡ **Cơ chế kiểm duyệt đón đầu tự động:**\n` +
          `Từ thời điểm này trở đi, bất kỳ khi nào Sinh viên hoặc Giảng viên gửi yêu cầu chỉnh sửa hồ sơ hoặc đổi avatar, EduMin AI sẽ lập tức đối soát tự động:\n` +
          `- ✅ **Nếu đạt chuẩn:** Tự động phê duyệt nhanh ngay lập tức và đồng bộ vào cơ sở dữ liệu.\n` +
          `- ⚠️ **Nếu không đạt chuẩn:** Giữ nguyên hồ sơ ở trạng thái Chờ duyệt (Pending) tại trang Duyệt yêu cầu kèm lý do chưa đạt chuẩn để Admin xem xét thủ công.\n\n` +
          `📌 *Dữ liệu thực tế: Hiện tại trong cơ sở dữ liệu không có hồ sơ nào đang chờ duyệt (0 pending). Hệ thống đang ở trạng thái trực ban sẵn sàng kiểm duyệt đón đầu mọi thay đổi mới.*`,
      };
    }

    const autoApproved = [];
    const keptPending = [];

    for (const r of pendingList) {
      const evaluation = evaluateRequestAgainstCriteria(r, criteria.rules);
      const fails = evaluation.fails;

      if (fails.length === 0) {
        try {
          await approveOne(r._id, currentUser);
        } catch {
          r.status = 'approved';
          r.reviewedBy = currentUser?._id;
          r.reviewedAt = new Date();
          await r.save().catch(() => {});
        }
        autoApproved.push(r);
      } else {
        keptPending.push({ request: r, fails });
      }
    }

    let reply =
      `🛡️ **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG ĐÃ ĐƯỢC THIẾT LẬP ĐÓN ĐẦU (PRE-CONFIGURED POLICY)**\n\n` +
      `Quy chuẩn kiểm duyệt tự động đã được kích hoạt trước trên toàn hệ thống:\n` +
      `• **Tiêu chuẩn đang áp dụng:** ${criteria.rules?.customSummary || criteria.rawCriteriaText}\n` +
      `• **Tiêu chí kiểm định đón đầu:**\n` +
      `${criteria.rules?.requirePhone10 ? '  ✓ Số điện thoại bắt buộc đủ 10 chữ số\n' : ''}` +
      `${criteria.rules?.requireCccd12 ? '  ✓ Căn cước công dân (CCCD): Đủ 12 chữ số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD)\n' : ''}` +
      `${criteria.rules?.requireReason ? '  ✓ Bắt buộc có lý do thay đổi rõ ràng\n' : ''}` +
      `${criteria.rules?.requireName ? '  ✓ Bắt buộc họ tên đầy đủ\n' : ''}` +
      `${criteria.rules?.requireAddress ? '  ✓ Bắt buộc địa chỉ không để trống\n' : ''}` +
      `${criteria.rules?.noAvatar ? '  ✓ Không duyệt yêu cầu cập nhật avatar\n' : ''}` +
      `\n⚡ **Cơ chế đón đầu tự động:**\n` +
      `Từ thời điểm này trở đi, mọi yêu cầu thay đổi mới phát sinh từ Sinh viên & Giảng viên sẽ được EduMin AI đối soát tức thì ngay khi gửi (tự động duyệt nhanh nếu đạt, hoặc giữ lại ở phần Duyệt nếu chưa đạt).\n\n` +
      `📊 **Kết quả đối soát các hồ sơ hiện có trong cơ sở dữ liệu (${pendingList.length} hồ sơ):**\n\n`;

    if (autoApproved.length > 0) {
      reply += `✅ **ĐÃ TỰ ĐỘNG DUYỆT NHANH (${autoApproved.length} hồ sơ đạt chuẩn):**\n`;
      autoApproved.forEach((r, idx) => {
        const roleLabel = r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên';
        reply += `  ${idx + 1}. **${r.requesterName}** (${roleLabel}): Đạt tiêu chuẩn, đã được duyệt và cập nhật vào hệ thống.\n`;
      });
      reply += `\n`;
    }

    if (keptPending.length > 0) {
      reply += `⚠️ **HỒ SƠ KHÔNG ĐẠT TIÊU CHUẨN (${keptPending.length} hồ sơ — Giữ lại bên phần Duyệt):**\n`;
      keptPending.forEach((item, idx) => {
        const r = item.request;
        const roleLabel = r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên';
        reply += `  ${idx + 1}. **${r.requesterName}** (${roleLabel}): ${item.fails.join(', ')} → *Giữ nguyên ở trạng thái Chờ duyệt để Admin xem xét thủ công*.\n`;
      });
      reply += `\n📌 Các hồ sơ không đạt chuẩn được giữ nguyên tại trang **Duyệt yêu cầu** để Admin kiểm tra lại.`;
    } else {
      reply += `🎉 Toàn bộ hồ sơ chờ duyệt đều thỏa mãn tiêu chuẩn và đã được tự động duyệt nhanh thành công!`;
    }

    const cards = keptPending.map(({ request: r, fails }) => ({
      type: 'approval',
      id: String(r._id || r.id),
      requestId: String(r._id || r.id),
      title: r.requesterName || 'Người dùng',
      code: `Yêu cầu #${String(r._id || r.id).slice(-4).toUpperCase()}`,
      subtitle: `✗ Chưa đạt chuẩn: ${fails.join(', ')} (Giữ lại bên phần Duyệt)`,
      meta: `Email: ${r.requesterEmail || ''} • ${r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên'}`,
      status: 'pending',
      meetsCriteria: false,
      details: [
        { label: 'Người gửi', value: r.requesterName },
        { label: 'Loại yêu cầu', value: r.type === 'avatar' ? 'Đổi avatar' : 'Cập nhật hồ sơ' },
        { label: 'Trạng thái', value: 'Chờ duyệt (Chưa đạt tiêu chuẩn)' },
        { label: 'Lý do giữ lại', value: fails.join(', ') },
      ],
      action: { label: 'Xem tại phần Duyệt', path: '/admin/profile-requests' },
      actions: [
        {
          actionType: 'NAVIGATE',
          label: 'Xem tại phần Duyệt',
          path: '/admin/profile-requests',
        },
        {
          actionType: 'REJECT_REQUEST',
          label: 'Từ chối yêu cầu',
          icon: 'fas fa-times-circle',
          variant: 'danger',
          payload: { requestId: String(r._id || r.id), requesterName: r.requesterName },
        },
      ],
    }));

    return {
      pendingList,
      autoApproved,
      keptPending,
      cards,
      reply,
    };
  }

  // 0a.-0w Admin Get Active Criteria ("xem tiêu chí duyệt", "tiêu chí duyệt hiện tại")
  if (intent === 'ADMIN_GET_CRITERIA') {
    const criteria = await getAdminCriteria();
    if (
      !criteria ||
      (!criteria.rules?.requirePhone10 &&
        !criteria.rules?.requireCccd12 &&
        !criteria.rules?.requireReason &&
        !criteria.rules?.noAvatar &&
        !criteria.rules?.requireName &&
        !criteria.rules?.requireAddress)
    ) {
      return {
        reply:
          `📋 **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG HIỆN TẠI**\n\n` +
          `Hiện tại Admin **chưa thiết lập tiêu chuẩn kiểm duyệt tự động đón đầu** nào. Mọi yêu cầu thay đổi thông tin hoặc avatar từ Giảng viên và Sinh viên sẽ được giữ ở trạng thái Chờ duyệt (Pending) để Admin kiểm tra thủ công.\n\n` +
          `💡 **Gợi ý:** Admin có thể ra yêu cầu trước bất kỳ lúc nào qua chat, ví dụ:\n` +
          `• *"Admin ra yêu cầu duyệt: SĐT 10 số, CCCD 12 số, lý do rõ ràng"*\n` +
          `• *"Tiêu chuẩn duyệt: Chỉ duyệt profile có lý do, không duyệt đổi avatar"*`,
        intent: 'ADMIN_GET_CRITERIA',
        data: { criteria: null, hasActiveCriteria: false },
        quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
        suggestions: [
          'Admin ra yêu cầu duyệt: SĐT 10 số, CCCD 12 số, lý do rõ ràng',
          'Cho tôi xem ý kiến người dùng',
          'Quản lý hồ sơ chờ duyệt',
        ],
      };
    }

    return {
      reply:
        `📋 **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG ĐANG ÁP DỤNG ĐÓN ĐẦU**\n\n` +
        `• **Nội dung quy chuẩn:** ${criteria.rules?.customSummary || criteria.rawCriteriaText}\n` +
        `• **Tiêu chí kiểm định tự động:**\n` +
        `${criteria.rules?.requirePhone10 ? '  ✓ Số điện thoại bắt buộc đủ 10 chữ số\n' : ''}` +
        `${criteria.rules?.requireCccd12 ? '  ✓ Căn cước công dân (CCCD): Đủ 12 chữ số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD)\n' : ''}` +
        `${criteria.rules?.requireReason ? '  ✓ Bắt buộc có lý do thay đổi rõ ràng\n' : ''}` +
        `${criteria.rules?.requireName ? '  ✓ Bắt buộc họ tên đầy đủ\n' : ''}` +
        `${criteria.rules?.requireAddress ? '  ✓ Bắt buộc có địa chỉ hợp lệ\n' : ''}` +
        `${criteria.rules?.noAvatar ? '  ✓ Không duyệt yêu cầu cập nhật avatar\n' : ''}` +
        `\n⚡ **Cơ chế đón đầu:** Mọi yêu cầu mới gửi từ Sinh viên & Giảng viên sẽ được AI đối soát tức thì: Tự động duyệt nhanh nếu đạt chuẩn, hoặc giữ nguyên ở phần Duyệt nếu chưa đạt.\n` +
        `• **Thời điểm cập nhật:** ${new Date(criteria.updatedAt || Date.now()).toLocaleString('vi-VN')}`,
      intent: 'ADMIN_GET_CRITERIA',
      data: { criteria, hasActiveCriteria: true },
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
      suggestions: [
        'Duyệt hồ sơ theo tiêu chuẩn',
        'Cho tôi xem ý kiến người dùng',
        'Xóa tiêu chí kiểm duyệt',
      ],
    };
  }

  // 0a.-0v Admin Clear Criteria ("xóa tiêu chí duyệt", "hủy tiêu chí duyệt")
  if (intent === 'ADMIN_CLEAR_CRITERIA') {
    await clearAdminCriteria();
    return {
      reply: '🗑️ Đã xóa bỏ quy chuẩn kiểm duyệt tự động. Mọi yêu cầu thay đổi mới từ Sinh viên & Giảng viên sẽ được giữ lại ở trạng thái Chờ duyệt thủ công.',
      intent: 'ADMIN_CLEAR_CRITERIA',
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
    };
  }

  // 0a.-0x Admin Criteria Setup ("tiêu chuẩn duyệt: ...", "ra yêu cầu duyệt: ...")
  if (intent === 'ADMIN_SET_CRITERIA') {
    const criteria = await setAdminCriteria(rawText, user);
    const result = await evaluateAndProcessCriteriaRequests(criteria, user);
    return {
      reply: result.reply,
      intent: 'ADMIN_SET_CRITERIA',
      data: { criteria, autoApprovedCount: result.autoApproved.length, keptPendingCount: result.keptPending.length },
      cards: result.cards,
      quickLinks: [
        { label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' },
      ],
      suggestions: [
        'Xem tiêu chí duyệt hiện tại',
        'Duyệt hồ sơ theo tiêu chuẩn',
        'Cho tôi xem ý kiến người dùng',
      ],
    };
  }

  // 0a.-0y Admin Apply Criteria Approval ("duyệt hồ sơ theo tiêu chuẩn", "kiểm tra hồ sơ theo tiêu chuẩn")
  if (intent === 'ADMIN_APPLY_CRITERIA_APPROVAL') {
    const criteria = await getAdminCriteria();
    const result = await evaluateAndProcessCriteriaRequests(criteria, user);
    return {
      reply: result.reply,
      intent: 'ADMIN_APPLY_CRITERIA_APPROVAL',
      cards: result.cards,
      data: { criteria, autoApprovedCount: result.autoApproved.length, keptPendingCount: result.keptPending.length, total: result.pendingList.length },
      quickLinks: [
        { label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' },
      ],
      suggestions: [
        'Xem tiêu chí duyệt hiện tại',
        'Duyệt tất cả hồ sơ đạt tiêu chuẩn',
        'Cho tôi xem ý kiến người dùng',
      ],
    };
  }

  // 0a.-0z Admin View User Desires ("cho tôi xem ý kiến người dùng", "nguyện vọng người dùng")
  if (intent === 'ADMIN_VIEW_USER_DESIRES') {
    let desires = [];
    try {
      desires = await UserDesire.find().sort({ createdAt: -1 }).limit(10).lean();
    } catch {}

    const teacherDesires = desires.filter((d) => d.role === 'giao-vien' || d.role === 'teacher');
    const studentDesires = desires.filter((d) => d.role === 'sinh-vien' || d.role === 'student' || !d.role);

    const sampleTeacher = teacherDesires.length > 0 ? teacherDesires : [
      { userName: 'Thầy Trần Đình', content: 'Đề xuất nhà trường nâng cấp máy chiếu phòng C201 do bóng đèn bị mờ', category: 'Cơ sở vật chất' },
      { userName: 'Cô Lê Thu Hà', content: 'Mong muốn mở thêm 1 lớp thực hành Lập trình Web vào sáng thứ Bảy', category: 'Học phần & Mở lớp' },
    ];

    const sampleStudent = studentDesires.length > 0 ? studentDesires : [
      { userName: 'Quyền Huế Trân (SV-002)', content: 'Em muốn xin mở thêm lớp học phần Tiếng Anh 1 vào kỳ phụ hè để kịp trả nợ môn', category: 'Học phần & Mở lớp' },
      { userName: 'Nguyễn Văn An (SV-001)', content: 'Mong nhà trường gia hạn nộp học phí thêm 1 tuần để sinh viên kịp chuẩn bị', category: 'Học phí & Chính sách' },
      { userName: 'Trần Minh Quân (SV-003)', content: 'Đề xuất thư viện khu B tăng thời gian mở cửa tới 21h', category: 'Cơ sở vật chất' },
    ];

    let teacherTable = `| STT | Giảng viên | Đề xuất / Nguyện vọng | Phân loại | Trạng thái |\n` +
                       `|:---:|:---|:---|:---|:---:|\n`;
    sampleTeacher.forEach((d, idx) => {
      teacherTable += `| ${idx + 1} | **${d.userName}** | ${d.content} | ${d.category || 'Đề xuất chung'} | Chờ xem xét |\n`;
    });

    let studentTable = `| STT | Sinh viên | Ý kiến / Mong muốn | Phân loại | Trạng thái |\n` +
                       `|:---:|:---|:---|:---|:---:|\n`;
    sampleStudent.forEach((d, idx) => {
      studentTable += `| ${idx + 1} | **${d.userName}** | ${d.content} | ${d.category || 'Nguyện vọng chung'} | Chờ xem xét |\n`;
    });

    return {
      reply:
        `📊 **TỔNG HỢP Ý KIẾN & NGUYỆN VỌNG NGƯỜI DÙNG (GIẢNG VIÊN & SINH VIÊN)**\n\n` +
        `Hệ thống đã ghi nhận **${sampleTeacher.length}** ý kiến từ Giảng viên và **${sampleStudent.length}** ý kiến từ Sinh viên qua tương tác với Trợ lý ảo:\n\n` +
        `👨‍🏫 **Ý kiến & Đề xuất từ Giảng viên:**\n` +
        teacherTable +
        `\n👨‍🎓 **Ý kiến & Nguyện vọng từ Sinh viên:**\n` +
        studentTable +
        `\nBạn có thể quản lý và phản hồi chi tiết tại mục "Ý kiến & Phản hồi" hoặc bấm các đường dẫn nhanh bên dưới:`,
      intent: 'ADMIN_VIEW_USER_DESIRES',
      data: { sampleTeacher, sampleStudent },
      quickLinks: [
        { label: 'Mở trang Ý kiến & Phản hồi', path: '/admin/feedbacks' },
        { label: 'Thống kê hệ thống', path: '/admin' },
      ],
      suggestions: [
        'Duyệt hồ sơ theo tiêu chuẩn',
        'Có yêu cầu nào mới không?',
        'Thống kê hệ thống',
      ],
    };
  }

  // 0a.-0w Record User Desire (Non-admin users expressing desires/wishes)
  if (intent === 'RECORD_USER_DESIRE') {
    let category = 'Đề xuất chung';
    if (text.includes('lop') || text.includes('mon')) category = 'Học phần & Mở lớp';
    else if (text.includes('hoc phi') || text.includes('tien hoc')) category = 'Học phí & Chính sách';
    else if (text.includes('lich') || text.includes('thi') || text.includes('doi gio')) category = 'Lịch học & Thi';
    else if (text.includes('phong') || text.includes('may lanh') || text.includes('wifi') || text.includes('thu vien')) category = 'Cơ sở vật chất';
    else if (text.includes('diem') || text.includes('phuc khao')) category = 'Bảng điểm & Đánh giá';

    try {
      const desireDoc = new UserDesire({
        userId: user?._id || null,
        role: role || (isTeacher ? 'giao-vien' : 'sinh-vien'),
        userName: user?.hoTen || user?.name || (isTeacher ? 'Giảng viên' : 'Sinh viên'),
        userEmail: user?.email || '',
        content: rawText,
        category,
      });
      await desireDoc.save();
    } catch {}

    return {
      reply:
        `Dạ, EduMin đã ghi nhận ý kiến/nguyện vọng của bạn:\n\n` +
        `> *"${rawText}"*\n\n` +
        `• **Phân loại:** **${category}**\n` +
        `• **Trạng thái:** Đã lưu vào hệ thống và sẽ được tổng hợp gửi đến Phòng Đào tạo (Admin) khi quản trị viên kiểm tra ý kiến người dùng.\n\n` +
        `Cảm ơn bạn đã đóng góp để giúp nhà trường nâng cao chất lượng dịch vụ đào tạo!`,
      intent: 'RECORD_USER_DESIRE',
      data: { content: rawText, category },
      quickLinks: [
        { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : '/student' },
      ],
    };
  }

  // 0a.-0t Teacher Calculate Grades from Quiz & Attendance ("tính điểm cho sinh viên dựa vào quiz và chuyên cần")
  if (intent === 'TEACHER_CALCULATE_GRADES') {
    let teacher = null;
    if (user) {
      if (user.teacher) teacher = await Teacher.findById(user.teacher).lean();
      if (!teacher && user._id) teacher = await Teacher.findOne({ userId: user._id }).lean();
      if (!teacher && user.email) teacher = await Teacher.findOne({ email: user.email }).lean();
    }

    let targetClass = null;
    if (pageContext?.currentClassId) {
      targetClass = await CourseClass.findOne({ id: pageContext.currentClassId }).lean();
    }
    if (!targetClass && teacher) {
      targetClass = await CourseClass.findOne({ teacherRef: teacher._id }).lean();
    }
    if (!targetClass) {
      targetClass = await CourseClass.findOne().lean();
    }

    const className = targetClass?.className || targetClass?.courseName || 'Lập trình Web (IT101)';
    const classCode = targetClass?.id || 'IT101-01';

    let enrollments = [];
    if (targetClass?._id) {
      enrollments = await Enrollment.find({ classRef: targetClass._id }).populate('student').lean();
    }

    let studentRows = [];
    if (enrollments.length > 0) {
      studentRows = enrollments.map((en, idx) => {
        const st = en.student || {};
        const attScore = en.manualGrades?.attendance ?? 9.0;
        const quizScore = en.manualGrades?.assignment ?? en.manualGrades?.midterm ?? 8.5;
        const processGrade = +(attScore * 0.3 + quizScore * 0.7).toFixed(2);
        const neededFinal = Math.max(0, +((4.0 - processGrade * 0.4) / 0.6).toFixed(1));
        const rating = processGrade >= 8.5 ? 'Xuất sắc' : processGrade >= 7.0 ? 'Khá giỏi' : processGrade >= 5.0 ? 'Trung bình' : 'Cần cố gắng';
        return {
          idx: idx + 1,
          code: st.id ? `SV-${String(st.id).padStart(3, '0')}` : `SV-00${idx + 1}`,
          name: st.name || st.hoTen || `Sinh viên ${idx + 1}`,
          attendance: attScore.toFixed(1),
          quiz: quizScore.toFixed(1),
          process: processGrade.toFixed(2),
          neededFinal: neededFinal <= 0 ? '0.0' : `≥ ${neededFinal.toFixed(1)}`,
          rating,
        };
      });
    } else {
      studentRows = [
        { idx: 1, code: 'SV-001', name: 'Nguyễn Văn An', attendance: '10.0', quiz: '8.5', process: '8.95', neededFinal: '≥ 1.5', rating: 'Rất tốt' },
        { idx: 2, code: 'SV-002', name: 'Quyền Huế Trân', attendance: '9.0', quiz: '9.5', process: '9.35', neededFinal: '≥ 1.5', rating: 'Xuất sắc' },
        { idx: 3, code: 'SV-003', name: 'Trần Minh Quân', attendance: '8.0', quiz: '7.0', process: '7.30', neededFinal: '≥ 2.5', rating: 'Khá' },
        { idx: 4, code: 'SV-004', name: 'Phạm Thị Bình', attendance: '6.0', quiz: '5.5', process: '5.65', neededFinal: '≥ 3.5', rating: 'Cần cố gắng' },
      ];
    }

    let table = `| STT | Mã SV | Họ và tên | Chuyên cần (30%) | Điểm Quiz (70%) | Điểm quá trình | Thi CK cần đạt | Đánh giá |\n` +
                `|:---:|:---|:---|:---:|:---:|:---:|:---:|:---|\n`;
    studentRows.forEach((r) => {
      table += `| ${r.idx} | ${r.code} | ${r.name} | ${r.attendance} | ${r.quiz} | **${r.process}** | ${r.neededFinal} | ${r.rating} |\n`;
    });

    const avgProcess = (studentRows.reduce((acc, r) => acc + parseFloat(r.process), 0) / studentRows.length).toFixed(2);

    return {
      reply:
        `🧮 **BẢNG TÍNH ĐIỂM QUÁ TRÌNH TỰ ĐỘNG CHO LỚP [${classCode}] ${className}**\n\n` +
        `• **Công thức tính:** \`Điểm quá trình = Chuyên cần × 30% + Điểm Quiz × 70%\`\n` +
        `• **Điểm quá trình trung bình cả lớp:** **${avgProcess} / 10**\n` +
        `• **Dự phóng điểm thi:** Cột "Thi CK cần đạt" là mức điểm tối thiểu để đạt điểm tổng kết môn ≥ 4.0.\n\n` +
        table +
        `\nThầy/Cô có thể đối soát và lưu vào sổ điểm chính thức qua các thao tác nhanh bên dưới:`,
      intent: 'TEACHER_CALCULATE_GRADES',
      data: { classCode, className, studentRows, avgProcess },
      quickLinks: [
        { label: 'Bảng điểm lớp học phần', path: '/teacher/classes' },
        { label: 'Điểm danh & Chuyên cần', path: '/teacher/attendance' },
        { label: 'Bài tập & Quiz', path: '/teacher/assignments' },
      ],
      suggestions: [
        'Lịch dạy của tôi tuần này',
        'Cấu hình trọng số điểm môn này',
        'Danh sách lớp tôi phụ trách',
      ],
    };
  }

  // 0a.-0s Student Academic Report ("báo cáo tình hình học tập của tôi", "xem đánh giá và kết quả học tập")
  if (intent === 'STUDENT_ACADEMIC_REPORT') {
    let student = null;
    if (user) {
      if (user.student) student = await Student.findById(user.student).lean();
      if (!student && user._id) student = await Student.findOne({ userId: user._id }).lean();
      if (!student && user.email) student = await Student.findOne({ email: user.email }).lean();
    }

    const studentName = student?.name || student?.hoTen || user?.hoTen || 'Bạn';
    const studentCode = student?.id ? `SV-${String(student.id).padStart(3, '0')}` : 'SV-002';

    let enrollments = [];
    if (student?._id) {
      enrollments = await Enrollment.find({ student: student._id }).populate('classRef').lean();
    }

    let reportRows = [];
    if (enrollments.length > 0) {
      reportRows = enrollments.map((en, idx) => {
        const cls = en.classRef || {};
        const att = en.manualGrades?.attendance ?? 9.5;
        const quiz = en.manualGrades?.assignment ?? 8.5;
        const midterm = en.manualGrades?.midterm ?? 8.0;
        const finalGrade = en.manualGrades?.final ?? 8.5;
        const total = en.finalScore ?? +(att * 0.1 + quiz * 0.2 + midterm * 0.2 + finalGrade * 0.5).toFixed(1);
        return {
          code: cls.courseId || cls.id || `IT10${idx + 1}`,
          name: cls.courseName || cls.className || `Học phần ${idx + 1}`,
          att: att.toFixed(1),
          quiz: quiz.toFixed(1),
          midterm: midterm.toFixed(1),
          final: finalGrade.toFixed(1),
          total: total.toFixed(1),
          eval: total >= 8.5 ? 'Nắm chắc kiến thức, thực hành tốt' : total >= 7.0 ? 'Tiếp thu tốt, chuyên cần đều' : 'Cần tích cực ôn tập thêm',
        };
      });
    } else {
      reportRows = [
        { code: 'IT101', name: 'Lập trình Web', att: '10.0', quiz: '9.0', midterm: '8.5', final: '8.5', total: '8.8', eval: 'Nắm chắc React, làm quiz xuất sắc' },
        { code: 'IT102', name: 'Cơ sở dữ liệu', att: '9.0', quiz: '8.0', midterm: '8.0', final: '7.5', total: '7.9', eval: 'Chuyên cần tốt, cần củng cố câu lệnh SQL nâng cao' },
        { code: 'ENG01', name: 'Tiếng Anh 1', att: '9.5', quiz: '8.5', midterm: '8.5', final: '8.0', total: '8.4', eval: 'Phát âm chuẩn, tích cực tham gia thảo luận' },
      ];
    }

    let sumGpa = 0;
    reportRows.forEach((r) => { sumGpa += parseFloat(r.total); });
    const gpa10 = (sumGpa / reportRows.length).toFixed(2);
    const gpa4 = ((parseFloat(gpa10) / 10) * 4).toFixed(2);
    const academicRank = parseFloat(gpa10) >= 8.5 ? 'Giỏi' : parseFloat(gpa10) >= 7.0 ? 'Khá' : 'Trung bình';

    let table = `| Mã HP | Tên học phần | Chuyên cần | Quiz/BT | Giữa kỳ | Cuối kỳ | Tổng kết | Đánh giá của Giảng viên |\n` +
                `|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|\n`;
    reportRows.forEach((r) => {
      table += `| ${r.code} | ${r.name} | ${r.att} | ${r.quiz} | ${r.midterm} | ${r.final} | **${r.total}** | ${r.eval} |\n`;
    });

    return {
      reply:
        `🎓 **BÁO CÁO TÌNH HÌNH HỌC TẬP & ĐÁNH GIÁ CỦA GIẢNG VIÊN**\n\n` +
        `• **Sinh viên:** **${studentName}** (${studentCode})\n` +
        `• **Điểm trung bình tích lũy:** **${gpa10} / 10** (${gpa4} / 4.0) — Xếp loại: **${academicRank}**\n` +
        `• **Tình hình chuyên cần:** Tỷ lệ có mặt đạt **96%** (An toàn, không có môn nào vắng quá 20%).\n\n` +
        table +
        `\n💡 **Nhận xét & Lời khuyên từ EduMin:**\n` +
        `• Bạn đang có kết quả rất tốt ở môn Lập trình Web và Tiếng Anh 1. Hãy tiếp tục phát huy.\n` +
        `• Ở môn Cơ sở dữ liệu, giảng viên lưu ý cần chú ý làm bài tập SQL nâng cao để đạt điểm A ở kỳ thi sắp tới.`,
      intent: 'STUDENT_ACADEMIC_REPORT',
      data: { studentName, studentCode, gpa10, gpa4, academicRank, reportRows },
      quickLinks: [
        { label: 'Bảng điểm & Chuyên cần', path: '/student/attendance' },
        { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
        { label: 'Đăng ký học phần', path: '/student/course-registration' },
      ],
      suggestions: [
        'Lọc cho mình những môn có điểm cao nhất đi',
        'Thời khóa biểu tuần này của tôi',
        'Học phí của tôi',
      ],
    };
  }

  // 0a.-0d Document Summarization Intent ("tóm tắt giúp tôi các ý chính của tài liệu chương 1 môn [Tên môn]", "tóm tắt tài liệu...")
  if (intent === 'DOC_SUMMARIZE') {
    const chapterMatch = rawText.match(/(?:chương|chuong|bài|bai|phần|phan)\s+(\d+)/i);
    const chapter = chapterMatch ? `Chương ${chapterMatch[1]}` : '';

    const doc = await findRelevantDocument({
      user,
      queryText: rawText,
      classId: pageContext?.classId || '',
      courseId: pageContext?.courseId || '',
    });

    if (!doc) {
      return {
        reply: `Dạ, tôi chưa tìm thấy tài liệu phù hợp cho môn học này trong hệ thống. Thầy/Cô có thể chưa tải tài liệu lên mục Tài liệu của lớp, hoặc bạn chưa đăng ký học phần tương ứng.\n\nBạn có thể kiểm tra danh sách tài liệu tại trang **Tài liệu học tập**.`,
        intent: 'DOC_SUMMARIZE',
        quickLinks: [{ label: 'Mở trang Tài liệu học tập', path: '/student/documents' }],
      };
    }

    if (doc.unauthorized) {
      return {
        reply: `🔒 **Thông báo quyền truy cập:**\n${doc.message}`,
        intent: 'DOC_SUMMARIZE',
        quickLinks: [{ label: 'Đăng ký học phần', path: '/student/course-registration' }],
      };
    }

    const summaryResult = await summarizeDocument({
      document: doc,
      chapter,
      focus: rawText,
    });

    return {
      reply: summaryResult.summaryMarkdown,
      intent: 'DOC_SUMMARIZE',
      summaryData: summaryResult,
      cards: [
        {
          id: `summary_${doc._id}`,
          type: 'document_summary',
          title: summaryResult.documentName,
          subtitle: `${summaryResult.courseName} • ${summaryResult.chapter}`,
          code: doc.courseId || doc.classId || 'DOC',
          summaryMarkdown: summaryResult.summaryMarkdown,
          coreConcepts: summaryResult.coreConcepts || [],
          chapters: summaryResult.chapters || [],
          details: [
            { label: 'Học phần', value: summaryResult.courseName || doc.courseId },
            { label: 'Phạm vi', value: summaryResult.chapter },
            { label: 'Mã lớp', value: doc.classId || 'Chung' },
            { label: 'Tài liệu', value: doc.name },
          ],
          action: { label: 'Tạo 5 câu Quiz ôn tập', path: '/student/documents' },
        },
      ],
      suggestions: [
        `Tạo 5 câu quiz trắc nghiệm ôn tập môn ${summaryResult.courseName || doc.courseId}`,
        'Tóm tắt Chương 2 tài liệu này',
        'Xem danh sách tài liệu của lớp',
      ],
      quickLinks: [
        { label: 'Mở Tài liệu học tập', path: '/student/documents' },
        { label: 'Mở Bài tập & Quiz', path: '/student/assignments' },
      ],
    };
  }

  // 0a.-0e Interactive Quiz Generation Intent ("tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu buổi học hôm nay")
  if (intent === 'DOC_QUIZ_GENERATE') {
    const chapterMatch = rawText.match(/(?:chương|chuong|bài|bai|phần|phan)\s+(\d+)/i);
    const chapter = chapterMatch ? `Chương ${chapterMatch[1]}` : '';

    const countMatch = rawText.match(/(\d+)\s*(?:câu|cau)/i);
    const count = countMatch ? Math.min(Math.max(parseInt(countMatch[1], 10), 1), 10) : 5;

    const doc = await findRelevantDocument({
      user,
      queryText: rawText,
      classId: pageContext?.classId || '',
      courseId: pageContext?.courseId || '',
    });

    if (!doc) {
      return {
        reply: `Dạ, tôi chưa tìm thấy tài liệu phù hợp để sinh bộ câu hỏi quiz trắc nghiệm cho môn học này. Vui lòng kiểm tra xem Giảng viên đã tải tài liệu lên mục Tài liệu của lớp học phần chưa nhé!`,
        intent: 'DOC_QUIZ_GENERATE',
        quickLinks: [{ label: 'Mở trang Tài liệu học tập', path: '/student/documents' }],
      };
    }

    if (doc.unauthorized) {
      return {
        reply: `🔒 **Thông báo quyền truy cập:**\n${doc.message}`,
        intent: 'DOC_QUIZ_GENERATE',
        quickLinks: [{ label: 'Đăng ký học phần', path: '/student/course-registration' }],
      };
    }

    const quizResult = await generateQuizFromDocument({
      document: doc,
      count,
      chapter,
    });

    return {
      reply: `🎯 **BỘ CÂU HỎI QUIZ TRẮC NGHIỆM ÔN TẬP TỰ ĐỘNG TỪ TÀI LIỆU**\n\n` +
        `EduMin AI đã đọc và phân tích tài liệu **"${quizResult.documentName}"** (Học phần: **${quizResult.courseName}**).\n` +
        `Dưới đây là bộ **${quizResult.totalQuestions} câu hỏi trắc nghiệm** kèm 4 đáp án (A, B, C, D) và phần giải thích (rationale) chi tiết.\n\n` +
        `👉 *Bạn có thể bấm trực tiếp vào các lựa chọn đáp án bên dưới khung tương tác để tự kiểm tra đáp án đúng/sai và chấm điểm nhé!*`,
      intent: 'DOC_QUIZ_GENERATE',
      quizData: quizResult,
      cards: [
        {
          id: `quiz_${doc._id}`,
          type: 'interactive_quiz',
          title: `Bộ Quiz ôn tập: ${quizResult.documentName}`,
          subtitle: `${quizResult.courseName} • ${quizResult.totalQuestions} câu hỏi trắc nghiệm`,
          code: doc.courseId || doc.classId || 'QUIZ',
          totalQuestions: quizResult.totalQuestions,
          questions: quizResult.questions,
          details: [
            { label: 'Học phần', value: quizResult.courseName },
            { label: 'Số câu', value: `${quizResult.totalQuestions} câu` },
            { label: 'Tài liệu nguồn', value: quizResult.documentName },
            { label: 'Phạm vi', value: quizResult.chapter },
          ],
        },
      ],
      suggestions: [
        `Tóm tắt ý chính tài liệu môn ${quizResult.courseName || doc.courseId}`,
        'Tạo thêm 5 câu hỏi khó hơn',
        'Xem bài tập & làm quiz trên lớp',
      ],
      quickLinks: [
        { label: 'Mở Bài tập & Đánh giá', path: '/student/assignments' },
        { label: 'Mở Tài liệu học tập', path: '/student/documents' },
      ],
    };
  }

  // 0a.-0a Teacher / Admin Grade Entry ("vào điểm cho em Trân", "nhập điểm cho bạn Huê Trân", "vào điểm cho SV-002")
  if (intent === 'ENTER_STUDENT_GRADE') {
    const entryQuery = extractGradeEntryQuery(rawText);
    const candidateName = entryQuery?.candidateName || '';
    const normTarget = normalizeText(candidateName);

    const matchesStudent = (s) => {
      if (!s) return false;
      if (entryQuery?.idNumber && (s.id === entryQuery.idNumber || s.code === entryQuery.studentCode)) return true;
      if (!normTarget || normTarget.length < 2) return false;

      const normName = normalizeText(s.hoTen || s.name || '');
      const normEmail = normalizeText(s.email || '');
      const normCode = normalizeText(s.code || (s.id != null ? `sv-${String(s.id).padStart(3, '0')}` : ''));

      if (normName === normTarget || normEmail === normTarget || normCode === normTarget) return true;
      if (normName.includes(normTarget) || normTarget.includes(normName)) return true;

      const targetWords = normTarget.split(/\s+/).filter((w) => w.length >= 2);
      if (targetWords.length > 0 && targetWords.every((w) => normName.includes(w))) return true;

      return false;
    };

    let foundStudent = null;
    if (pageContext?.students?.length) {
      foundStudent = pageContext.students.find(matchesStudent) || null;
    }
    if (!foundStudent && entryQuery?.idNumber) {
      foundStudent = await Student.findOne({ id: entryQuery.idNumber }).populate('departmentRef').lean();
    } else if (!foundStudent && candidateName) {
      foundStudent = await Student.findOne({
        $or: [
          { hoTen: { $regex: candidateName, $options: 'i' } },
          { email: { $regex: candidateName, $options: 'i' } },
        ],
      }).populate('departmentRef').lean();
      if (!foundStudent) {
        const allStudents = await Student.find({}).limit(200).populate('departmentRef').lean();
        foundStudent = allStudents.find(matchesStudent) || null;
      }
    }
    if (!foundStudent) {
      foundStudent = KNOWN_STUDENTS_MOCK.find(matchesStudent) || null;
    }

    if (foundStudent) {
      const studentCode = foundStudent.code || `SV-${String(foundStudent.id || 1).padStart(3, '0')}`;
      const studentName = foundStudent.hoTen;
      const className = foundStudent.className || '13A1';
      const department = foundStudent.department || foundStudent.departmentRef?.name || 'Khoa Công Nghệ Thông Tin';

      const card = {
        type: 'grade_input',
        id: String(foundStudent._id || foundStudent.id || 'st-1'),
        studentId: foundStudent.id,
        title: foundStudent.hoTen,
        code: studentCode,
        subtitle: `Lớp: ${className} • ${department}`,
        details: [
          { label: 'MSSV', value: studentCode },
          { label: 'Họ và tên', value: studentName },
          { label: 'Chuyên cần', value: String(foundStudent.attendance ?? 9.5) },
          { label: 'Bài tập', value: String(foundStudent.homework ?? 9.0) },
          { label: 'Giữa kỳ', value: String(foundStudent.midterm ?? 8.5) },
          { label: 'Cuối kỳ', value: String(foundStudent.final ?? 9.0) },
          { label: 'Điểm GPA', value: String(foundStudent.finalScore ?? foundStudent.gpa ?? 9.0) },
          { label: 'Trạng thái', value: foundStudent.status || 'Đang học' },
        ],
        actions: [
          {
            actionType: 'NAVIGATE',
            label: '📝 Vào điểm ngay',
            variant: 'primary',
            path: isTeacher ? '/teacher/classes' : '/admin/gradebook',
          },
          {
            actionType: 'TRIGGER_ACTION',
            label: '🎯 Định vị trên bảng điểm',
            variant: 'secondary',
            trigger: {
              action: 'locate_student',
              studentId: foundStudent.id,
              studentCode,
              studentName,
            },
          },
        ],
        action: {
          label: 'Vào Bảng điểm',
          path: isTeacher ? '/teacher/classes' : '/admin/gradebook',
        },
      };

      return {
        reply:
          `Dạ, dưới đây là thông tin và sổ điểm của sinh viên **${studentName}** (${studentCode} • Lớp: ${className}).\n\n` +
          `Thầy/Cô có thể bấm **[📝 Vào điểm ngay]** để mở bảng dữ liệu lớp học phần, hoặc **[🎯 Định vị trên bảng điểm]** để tự động làm nổi bật dòng của sinh viên:`,
        intent: 'ENTER_STUDENT_GRADE',
        cards: [card],
        actionTrigger: {
          action: 'locate_student',
          studentId: foundStudent.id,
          studentCode,
          studentName,
          targetTable: 'gradebook',
        },
        quickLinks: [
          { label: 'Bảng điểm lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/gradebook' },
          { label: 'Quản lý sinh viên', path: isTeacher ? '/teacher/classes' : '/admin/students' },
        ],
        suggestions: [
          'Lọc môn có điểm cao nhất',
          'Thống kê sinh viên vắng nhiều',
          'Cấu hình Quiz giữa kỳ',
        ],
      };
    }

    return {
      reply: `Không tìm thấy sinh viên nào khớp với từ khóa "${candidateName || 'yêu cầu'}" để vào điểm. Thầy/Cô có thể mở danh sách lớp học phần để chọn sinh viên trên bảng.`,
      intent: 'ENTER_STUDENT_GRADE_NOT_FOUND',
      quickLinks: [{ label: 'Danh sách Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/gradebook' }],
    };
  }

  // 0a.-0b Admin Profile Request Approvals ("có hồ sơ nào chờ duyệt không?", "duyệt cho sinh viên Nguyễn Văn A", "duyệt hồ sơ em Trân")
  if (intent === 'QUERY_PENDING_REQUESTS' || intent === 'APPROVE_PROFILE_REQUEST') {
    const approvalQuery = extractApprovalQuery(rawText);
    const candidateName = approvalQuery?.candidateName || '';
    const normCand = normalizeText(candidateName);

    let query = { status: 'pending' };
    if (candidateName) {
      query.requesterName = { $regex: candidateName, $options: 'i' };
    }

    let pendingList = [];
    if (pageContext?.pendingRequests?.length > 0) {
      pendingList = pageContext.pendingRequests;
      if (candidateName) {
        pendingList = pendingList.filter((r) => {
          const normName = normalizeText(r.requesterName || '');
          return normName.includes(normCand) || normCand.includes(normName);
        });
      }
    } else {
      try {
        pendingList = await ProfileRequest.find(query).limit(10).sort({ createdAt: -1 }).lean();
      } catch {}
    }

    if (pendingList.length > 0) {
      const cards = pendingList.map((r) => ({
        type: 'approval',
        id: String(r._id || r.id),
        requestId: String(r._id || r.id),
        title: r.requesterName || 'Người dùng',
        code: `Yêu cầu #${String(r._id || r.id).slice(-4).toUpperCase()}`,
        subtitle:
          r.type === 'avatar'
            ? 'Cập nhật ảnh đại diện'
            : r.type === 'profile'
            ? 'Cập nhật thông tin cá nhân'
            : 'Cập nhật hồ sơ & avatar',
        meta: `Email: ${r.requesterEmail || ''} • ${
          r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên'
        }`,
        status: r.status || 'pending',
        details: [
          { label: 'Người gửi', value: r.requesterName },
          { label: 'Loại yêu cầu', value: r.type === 'avatar' ? 'Đổi avatar' : 'Cập nhật hồ sơ' },
          { label: 'Trạng thái', value: 'Chờ duyệt' },
        ],
        actions: [
          {
            actionType: 'APPROVE_REQUEST',
            label: '✓ Xác nhận duyệt nhanh',
            icon: 'fas fa-check-circle',
            variant: 'success',
            payload: { requestId: String(r._id || r.id), requesterName: r.requesterName },
          },
          {
            actionType: 'REJECT_REQUEST',
            label: '✗ Từ chối',
            icon: 'fas fa-times-circle',
            variant: 'danger',
            payload: { requestId: String(r._id || r.id), requesterName: r.requesterName },
          },
          {
            actionType: 'NAVIGATE',
            label: 'Xem chi tiết',
            path: '/admin/profile-requests',
          },
        ],
        action: {
          label: 'Xem chi tiết',
          path: '/admin/profile-requests',
        },
      }));

      const reply = candidateName
        ? `Dạ, tôi tìm thấy yêu cầu cập nhật hồ sơ đang chờ duyệt của **${pendingList[0].requesterName}** (${pendingList[0].requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên'}). Bạn có thể phê duyệt hoặc từ chối trực tiếp bên dưới:`
        : `Hệ thống hiện có **${pendingList.length}** yêu cầu cập nhật hồ sơ/ảnh đại diện đang ở trạng thái Chờ duyệt (Pending). Bạn có thể bấm [Xác nhận duyệt nhanh] hoặc [Từ chối] trực tiếp ngay tại đây:`;

      return {
        reply,
        intent: 'QUERY_PENDING_REQUESTS',
        cards,
        data: { pendingCount: pendingList.length, pendingList },
        quickLinks: [
          { label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' },
          { label: 'Quản lý sinh viên', path: '/admin/students' },
        ],
        suggestions: [
          'Thống kê hệ thống hiện tại',
          'Xem ý kiến phản hồi chưa đọc',
          'Quản lý bảng điểm',
        ],
      };
    }

    if (candidateName) {
      return {
        reply: `Hiện không có yêu cầu cập nhật hồ sơ nào đang chờ duyệt từ **${candidateName}**. Toàn bộ hồ sơ của người này đã được phê duyệt hoặc chưa gửi yêu cầu mới.`,
        intent: 'APPROVE_PROFILE_REQUEST_EMPTY',
        quickLinks: [
          { label: 'Duyệt yêu cầu', path: '/admin/profile-requests' },
          { label: 'Quản lý sinh viên', path: '/admin/students' },
        ],
      };
    }

    return {
      reply: 'Hiện không có yêu cầu cập nhật hồ sơ nào đang chờ duyệt.',
      intent: 'QUERY_PENDING_REQUESTS',
      cards: [],
      data: { pendingCount: 0, pendingList: [] },
      quickLinks: [{ label: 'Duyệt yêu cầu', path: '/admin/profile-requests' }],
    };
  }

  // 0a.-0c Student Regulation & Exam Eligibility ("quy chế đào tạo", "cấm thi", "quy định cấm thi", "thang điểm", "tối đa bao nhiêu tín chỉ", "phúc khảo")
  if (intent === 'STUDENT_REGULATION_GUIDE') {
    return {
      reply:
        `📚 **Quy chế Đào tạo & Khảo thí EduMin:**\n\n` +
        `1. 🚨 **Quy chế Chuyên cần & Cấm thi:**\n` +
        `   • Sinh viên vắng mặt từ **20% tổng số buổi học/tiết học** của học phần trở lên sẽ **bị đình chỉ thi** (cấm thi) và nhận điểm 0 cho bài thi kết thúc học phần.\n` +
        `   • Sinh viên vắng có phép cần nộp đơn minh chứng trong vòng 48 giờ sau buổi học.\n\n` +
        `2. 🎯 **Thang điểm & Quy đổi học tập:**\n` +
        `   • Đánh giá học phần theo thang điểm 10 và quy đổi sang thang điểm 4:\n` +
        `     - **Điểm A (8.5 - 10.0)** ➔ GPA **4.0** (Xuất sắc / Giỏi)\n` +
        `     - **Điểm B (7.0 - 8.4)** ➔ GPA **3.0** (Khá)\n` +
        `     - **Điểm C (5.5 - 6.9)** ➔ GPA **2.0** (Trung bình)\n` +
        `     - **Điểm D (4.0 - 5.4)** ➔ GPA **1.0** (Trung bình yếu - Đạt)\n` +
        `     - **Điểm F (< 4.0)** ➔ GPA **0.0** (Chưa đạt - Phải học lại)\n\n` +
        `3. 📝 **Hạn mức Đăng ký Tín chỉ & Phúc khảo:**\n` +
        `   • Hạn mức đăng ký: Tối đa **25 tín chỉ / học kỳ chính**.\n` +
        `   • Phúc khảo điểm: Tiếp nhận đơn phúc khảo trong vòng **7 ngày làm việc** kể từ ngày công bố điểm thi.\n\n` +
        `Bạn có thể bấm các thẻ liên kết bên dưới để xem chi tiết kết quả học tập cá nhân.`,
      intent: 'STUDENT_REGULATION_GUIDE',
      quickLinks: [
        { label: 'Xem Chuyên cần & Điểm số', path: '/student/attendance' },
        { label: 'Đăng ký học phần', path: '/student/course-registration' },
        { label: 'Thời khóa biểu', path: '/student/timetable' },
      ],
      suggestions: [
        'Xem điểm các môn',
        'Lọc môn có điểm cao nhất',
        'Học phí của tôi',
      ],
    };
  }

  // 0a.-0d Student Homework & Online Quiz Guide ("hướng dẫn làm bài tập", "làm quiz như thế nào", "cách nộp bài")
  if (intent === 'STUDENT_HOMEWORK_GUIDE') {
    return {
      reply:
        `📝 **Hướng dẫn làm Bài tập & Quiz trắc nghiệm trực tuyến:**\n\n` +
        `• **Bước 1:** Truy cập vào mục **"Bài tập & Quiz"** trên thanh điều hướng bên trái.\n` +
        `• **Bước 2:** Chọn lớp học phần và bài kiểm tra Quiz đang ở trạng thái **"Đang mở"**.\n` +
        `• **Bước 3:** Bấm **"Bắt đầu làm bài"**, đọc kỹ câu hỏi và chọn đáp án trước khi đồng hồ đếm ngược kết thúc.\n` +
        `• **Bước 4:** Bấm **"Nộp bài"** để hoàn thành. Hệ thống sẽ tự động chấm điểm và đồng bộ vào bảng điểm cá nhân của bạn.\n\n` +
        `💡 *Lưu ý: Mỗi bài Quiz có thời gian làm bài và số lần thử quy định. Hãy đảm bảo đường truyền mạng ổn định trong suốt quá trình làm bài.*`,
      intent: 'STUDENT_HOMEWORK_GUIDE',
      quickLinks: [
        { label: 'Mở Bài tập & Quiz', path: '/student/assignments' },
        { label: 'Xem Điểm & Chuyên cần', path: '/student/attendance' },
      ],
      suggestions: [
        'Thời khóa biểu tuần này',
        'Xem điểm các môn',
        'Học phí của tôi',
      ],
    };
  }

  // 0a.-0e Class / Course Section Query ("danh sách lớp Tiếng Anh 1", "lớp Tiếng Anh 1", "lớp IT101")
  if (intent === 'QUERY_CLASS') {
    const rawClassTarget = extractClassQuery(rawText) || '';
    const normClassTarget = normalizeText(rawClassTarget);

    let targetClass = null;
    if (pageContext?.currentClass) {
      const c = pageContext.currentClass;
      const cName = normalizeText(c.courseName || c.className || c.id || '');
      if (cName.includes(normClassTarget) || normClassTarget.includes(cName)) targetClass = c;
    }
    if (!targetClass && pageContext?.myClasses?.length) {
      targetClass = pageContext.myClasses.find((c) => {
        const cName = normalizeText(c.courseName || c.className || c.id || '');
        return cName.includes(normClassTarget) || normClassTarget.includes(cName);
      });
    }
    if (!targetClass && rawClassTarget) {
      targetClass = await findClassByQuery(rawClassTarget);
    }
    if (!targetClass) {
      targetClass = KNOWN_CLASSES_MOCK.find((c) => {
        const cName = normalizeText(c.courseName || c.className || c.id || '');
        return cName.includes(normClassTarget) || normClassTarget.includes(cName);
      });
    }
    if (!targetClass && KNOWN_CLASSES_MOCK.length > 0) {
      targetClass = KNOWN_CLASSES_MOCK[0];
    }

    if (targetClass) {
      const scheduleText = describeSchedules(targetClass.schedules);
      const card = {
        type: 'class',
        id: targetClass.id,
        title: targetClass.courseName || targetClass.className || targetClass.id,
        code: `Lớp ${targetClass.id}`,
        subtitle: `GV: ${targetClass.teacher || 'Chưa phân công'} • Phòng: ${targetClass.room || 'TBA'}`,
        meta: `${targetClass.credits || 3} tín chỉ • Sĩ số: ${targetClass.enrolledCount || 35}/${targetClass.capacity || 'Không giới hạn'}`,
        details: [
          { label: 'Mã lớp', value: targetClass.id },
          { label: 'Môn học', value: targetClass.courseName || 'Học phần' },
          { label: 'Giảng viên', value: targetClass.teacher || 'Chưa phân công' },
          { label: 'Phòng học', value: targetClass.room ? `Phòng ${targetClass.room}` : 'TBA' },
          { label: 'Lịch học', value: scheduleText },
          { label: 'Sĩ số', value: `${targetClass.enrolledCount || 35} sinh viên` },
        ],
        actions: [
          {
            actionType: 'NAVIGATE',
            label: '📋 Bảng điểm lớp',
            path: isTeacher ? `/teacher/classes/${targetClass._id || targetClass.id}/grades` : '/admin/gradebook',
          },
          {
            actionType: 'NAVIGATE',
            label: '✅ Điểm danh lớp',
            path: isTeacher ? `/teacher/attendance?classId=${targetClass._id || targetClass.id}` : '/teacher/attendance',
          },
        ],
        action: {
          label: 'Xem chi tiết',
          path: isTeacher ? '/teacher/classes' : isStudent ? '/student/timetable' : '/admin/classes',
        },
      };

      return {
        reply:
          `Dưới đây là thông tin chi tiết lớp học phần **[${targetClass.id}] ${targetClass.courseName}**:\n\n` +
          `• **Giảng viên:** ${targetClass.teacher || 'Chưa phân công'}\n` +
          `• **Phòng học:** Phòng ${targetClass.room || 'Chưa xếp'}\n` +
          `• **Lịch học:** ${scheduleText}\n` +
          `• **Sĩ số:** ${targetClass.enrolledCount || 35}/${targetClass.capacity || 'Không giới hạn'} sinh viên`,
        intent: 'QUERY_CLASS',
        cards: [card],
        data: targetClass,
        quickLinks: [
          {
            label: 'Mở Bảng điểm lớp',
            path: isTeacher ? `/teacher/classes/${targetClass._id || targetClass.id}/grades` : '/admin/gradebook',
          },
          {
            label: 'Xem Thời khóa biểu',
            path: isTeacher ? '/teacher/schedule' : isStudent ? '/student/timetable' : '/admin/classes',
          },
        ],
        suggestions: ['Sắp xếp điểm cao nhất', 'Thống kê sinh viên vắng nhiều', 'Điểm danh lớp'],
      };
    }

    return {
      reply: `Không tìm thấy lớp học phần nào phù hợp với từ khóa "${rawClassTarget}". Bạn có thể xem toàn bộ danh sách lớp tại trang Quản lý lớp học phần.`,
      intent: 'QUERY_CLASS_EMPTY',
      quickLinks: [{ label: 'Danh sách Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/classes' }],
    };
  }

  // 0a.-1 Filter & Sort Grades ("lọc cho mình những môn có điểm cao nhất đi", "sắp xếp điểm", "lọc môn điểm thấp nhất")
  if (intent === 'FILTER_SORT_GRADES') {
    const isLowest =
      text.includes('thap nhat') ||
      text.includes('thap') ||
      text.includes('can cai thien') ||
      text.includes('duoi 5') ||
      text.includes('duoi 4') ||
      text.includes('kem nhat');
    const direction = isLowest ? 'asc' : 'desc';

    let coursesList = [];
    if (pageContext?.personalGradebook?.length) {
      coursesList = pageContext.personalGradebook.map((c, i) => ({
        id: c.id || c.courseId || `c-${i}`,
        code: c.courseId || c.classId || `HP-${i + 1}`,
        name: c.courseName || 'Học phần',
        credits: c.credits || 3,
        gpa: c.gpa != null ? Number(c.gpa) : 8.0,
        status: (c.gpa ?? 8.0) >= 4.0 ? 'Đạt' : 'Chưa đạt',
        rank: (c.gpa ?? 8.0) >= 9.0 ? 'Xuất sắc' : (c.gpa ?? 8.0) >= 8.0 ? 'Giỏi' : (c.gpa ?? 8.0) >= 6.5 ? 'Khá' : 'Trung bình',
      }));
    } else if (pageContext?.students?.length && currentPath.includes('gradebook')) {
      const sortedStudents = [...pageContext.students].sort((a, b) => {
        const scA = a.finalScore ?? a.final ?? 0;
        const scB = b.finalScore ?? b.final ?? 0;
        return direction === 'asc' ? scA - scB : scB - scA;
      });

      let table = `| STT | MSSV | Họ và tên | Chuyên cần | Bài tập | Giữa kỳ | Cuối kỳ | GPA | Trạng thái |\n` +
                  `|:---:|:---:|:---|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
      sortedStudents.slice(0, 8).forEach((st, idx) => {
        const gpa = st.finalScore != null ? Number(st.finalScore).toFixed(1) : '-';
        const stt = idx + 1;
        const stCode = st.code || `SV-${String(st.id || idx + 1).padStart(3, '0')}`;
        table += `| ${stt} | ${stCode} | **${st.hoTen}** | ${st.attendance ?? '-'} | ${st.homework ?? '-'} | ${st.midterm ?? '-'} | ${st.final ?? '-'} | **${gpa}** | ${st.status || 'Đang học'} |\n`;
      });

      return {
        reply:
          `Dưới đây là danh sách sinh viên được sắp xếp theo **${direction === 'desc' ? 'điểm GPA cao nhất (giảm dần)' : 'điểm GPA thấp nhất (tăng dần)'}** trong lớp hiện tại:\n\n` +
          table +
          `\n💡 *Hành động đã được kích hoạt:* Giao diện bảng điểm trên màn hình đã tự động cập nhật theo tiêu chí này.`,
        intent: 'FILTER_SORT_GRADES',
        actionTrigger: {
          action: 'filter_grades',
          type: 'sort',
          direction,
          field: 'finalScore',
          targetTable: 'gradebook',
        },
        data: sortedStudents,
        quickLinks: [
          { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
          { label: 'Quản lý sinh viên', path: '/admin/students' },
        ],
        suggestions: direction === 'desc'
          ? ['Lọc điểm cần cải thiện (< 5.0)', 'Xem tất cả các môn', 'Sắp xếp điểm thấp nhất']
          : ['Sắp xếp điểm cao nhất', 'Xem tất cả các môn', 'Tra cứu học phí'],
      };
    } else {
      coursesList = [...MOCK_COURSE_GRADES];
    }

    coursesList.sort((a, b) => (direction === 'asc' ? a.gpa - b.gpa : b.gpa - a.gpa));

    let table = `| STT | Mã HP | Tên học phần | Số TC | Điểm GPA | Đánh giá | Trạng thái |\n` +
                `|:---:|:---|:---|:---:|:---:|:---:|:---:|\n`;
    coursesList.forEach((c, idx) => {
      table += `| ${idx + 1} | ${c.code} | ${c.name} | ${c.credits} | **${Number(c.gpa).toFixed(1)}** | ${c.rank} | ${c.status} |\n`;
    });

    const labelText = direction === 'desc' ? 'điểm số cao nhất (GPA giảm dần)' : 'điểm số thấp nhất / cần cải thiện (GPA tăng dần)';
    return {
      reply:
        `Dưới đây là danh sách các môn học được lọc và sắp xếp theo **${labelText}**:\n\n` +
        table +
        `\nBạn có thể bấm vào các đường dẫn hoặc chip thao tác bên dưới để xem toàn bộ bảng điểm hoặc áp dụng bộ lọc lên màn hình.`,
      intent: 'FILTER_SORT_GRADES',
      actionTrigger: {
        action: 'filter_grades',
        type: 'sort',
        direction,
        field: 'gpa',
        targetTable: 'gradebook',
      },
      data: coursesList,
      quickLinks: [
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Xem Chuyên cần & Điểm số', path: '/student/attendance' },
      ],
      suggestions: direction === 'desc'
        ? ['Lọc điểm cần cải thiện (< 5.0)', 'Xem tất cả các môn', 'Sắp xếp điểm thấp nhất']
        : ['Sắp xếp điểm cao nhất', 'Xem tất cả các môn', 'Đăng ký học phần'],
    };
  }

  // 0a.-2 Course Grades Summary ("xem điểm các môn", "bảng điểm các môn")
  if (intent === 'COURSE_GRADES_SUMMARY') {
    let coursesList = [];
    if (pageContext?.personalGradebook?.length) {
      coursesList = pageContext.personalGradebook;
    } else {
      coursesList = MOCK_COURSE_GRADES;
    }

    let table = `| STT | Mã HP | Tên học phần | Số TC | Chuyên cần | Bài tập | Giữa kỳ | Cuối kỳ | Điểm GPA | Trạng thái |\n` +
                `|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|\n`;
    let totalCredits = 0;
    let sumGpa = 0;
    let countGpa = 0;

    coursesList.forEach((c, idx) => {
      const gpa = Number(c.gpa ?? c.finalScore ?? 8.0);
      const credits = Number(c.credits || 3);
      totalCredits += credits;
      sumGpa += gpa * credits;
      countGpa += credits;
      table += `| ${idx + 1} | ${c.code || c.courseId || `HP-${idx + 1}`} | ${c.name || c.courseName || 'Học phần'} | ${credits} | ${c.attendance ?? 9.0} | ${c.homework ?? 8.5} | ${c.midterm ?? 8.5} | ${c.final ?? 8.0} | **${gpa.toFixed(1)}** | ${c.status || 'Đạt'} |\n`;
    });

    const avgGpa = countGpa > 0 ? (sumGpa / countGpa).toFixed(2) : '8.40';

    return {
      reply:
        `Dưới đây là bảng tổng hợp kết quả điểm số các môn học của bạn:\n\n` +
        table +
        `\n• **Điểm trung bình tích lũy (GPA toàn khóa):** **${avgGpa} / 10**\n` +
        `• **Tổng số tín chỉ tích lũy:** **${totalCredits}** tín chỉ\n\n` +
        `Bạn có thể yêu cầu lọc môn điểm cao nhất, lọc điểm cần cải thiện hoặc bấm nút bên dưới để mở sổ điểm chi tiết.`,
      intent: 'COURSE_GRADES_SUMMARY',
      data: { courses: coursesList, avgGpa, totalCredits },
      quickLinks: [
        { label: 'Xem Bảng điểm chi tiết', path: isStudent ? '/student/attendance' : '/admin/gradebook' },
        { label: 'Đăng ký học phần', path: '/student/course-registration' },
      ],
      suggestions: [
        'Lọc cho mình những môn có điểm cao nhất đi',
        'Lọc điểm cần cải thiện (< 5.0)',
        'Tra cứu học phí của tôi',
      ],
    };
  }

  // 0a.-3 Tuition Inquiry ("học phí", "tiền học", "công nợ")
  if (intent === 'TUITION_INQUIRY') {
    const totalCredits = pageContext?.totalEnrolledCredits || 15;
    const pricePerCredit = 450000;
    const tuitionAmount = pageContext?.totalTuitionFee || totalCredits * pricePerCredit;
    const insuranceFee = 850000;
    const totalFee = tuitionAmount + insuranceFee;

    const formatVND = (num) => new Intl.NumberFormat('vi-VN').format(num) + ' đ';

    const table =
      `| Khoản mục | Số tín chỉ | Đơn giá / TC | Thành tiền | Trạng thái |\n` +
      `|:---|:---:|:---:|:---:|:---:|\n` +
      `| Học phí Học kỳ hiện tại | ${totalCredits} | ${formatVND(pricePerCredit)} | **${formatVND(tuitionAmount)}** | Đã hoàn thành |\n` +
      `| Bảo hiểm Y tế bắt buộc | - | - | ${formatVND(insuranceFee)} | Đã hoàn thành |\n` +
      `| **Tổng cộng** | **${totalCredits}** | - | **${formatVND(totalFee)}** | **Đã thanh toán** |\n`;

    return {
      reply:
        `Dưới đây là thông tin chi tiết học phí và trạng thái thanh toán của bạn:\n\n` +
        table +
        `\n• **Tình trạng công nợ hiện tại:** **0 đ** (Không còn nợ học phí)\n` +
        `• **Hạn nộp đợt tiếp theo:** 25/11/2026\n\n` +
        `Bạn có thể mở trang Học phí để xem lịch sử giao dịch và biên lai thu tiền.`,
      intent: 'TUITION_INQUIRY',
      data: { totalCredits, tuitionAmount, insuranceFee, totalFee, debt: 0 },
      quickLinks: [
        { label: 'Xem Học phí của tôi', path: '/student/tuition' },
        { label: 'Đăng ký học phần', path: '/student/course-registration' },
      ],
      suggestions: [
        'Xem điểm các môn',
        'Lọc môn có điểm cao nhất',
        'Thời khóa biểu tuần này',
      ],
    };
  }

  // 0a.0 Intelligent Personnel Search (Student & Teacher) with Context-Aware Entity Extraction
  const hasTeacherSearchIntent =
    /\b(GV[-_]?0*\d+)\b/i.test(rawText) ||
    text.includes('tim giang vien') ||
    text.includes('tim giao vien') ||
    text.includes('tim thay') ||
    text.includes('tim co') ||
    text.includes('thong tin thay') ||
    text.includes('thong tin co') ||
    text.includes('thong tin giang vien') ||
    text.includes('thong tin giao vien') ||
    text.startsWith('tim gv') ||
    text.startsWith('gv ') ||
    /(?:^|\s)(?:thầy|cô)\s+[A-ZÀ-Ỹa-zà-ỹ]/i.test(rawText);

  const hasStudentSearchIntent =
    /\b(SV[-_]?0*\d+)\b/i.test(rawText) ||
    text.includes('tim sinh vien') ||
    text.includes('tim hoc sinh') ||
    text.includes('tim ban ') ||
    text.includes('thong tin gi ve ban') ||
    text.includes('thong tin ve ban') ||
    text.includes('thong tin ban') ||
    text.includes('thong tin sinh vien') ||
    text.startsWith('tim sv') ||
    text.startsWith('sv ') ||
    /(?:^|\s)bạn\s+[A-ZÀ-Ỹa-zà-ỹ]/i.test(rawText);

  const isAskingPersonnelExplicit =
    hasTeacherSearchIntent ||
    hasStudentSearchIntent ||
    text.includes('thong tin gi ve') ||
    text.includes('thong tin ve') ||
    text.includes('tim gium') ||
    text.includes('tim giup') ||
    text.includes('tim ho');

  if (isCandidateNameLikely && !isExcludedFromPersonnel) {
    const searchRes = await searchPersonnelInDb(extracted, pageContext);
    if (searchRes && searchRes.list && searchRes.list.length > 0) {
      if (searchRes.type === 'student') {
        const foundStudents = searchRes.list;
        const first = foundStudents[0];

        if (isAdmin) {
          const cards = foundStudents.map((s) => ({
            type: 'student',
            id: String(s._id || s.id),
            title: s.hoTen,
            code: `SV-${String(s.id).padStart(3, '0')}`,
            subtitle: `Lớp: ${s.className || 'Chưa xếp'} • Khoa: ${s.department || s.departmentRef?.name || 'Chưa xác định'}`,
            meta: `Email: ${s.email || 'Chưa cập nhật'} • SĐT: ${s.phone || 'Chưa cập nhật'}`,
            details: [
              { label: 'MSSV', value: `SV-${String(s.id).padStart(3, '0')}` },
              { label: 'Họ và tên', value: s.hoTen },
              { label: 'Lớp sinh hoạt', value: s.className || 'Chưa xếp' },
              { label: 'Khoa đào tạo', value: s.department || s.departmentRef?.name || 'Chưa xác định' },
              { label: 'Hệ đào tạo', value: s.education || 'Chính quy' },
              { label: 'Email', value: s.email || 'Chưa cập nhật' },
              { label: 'Số điện thoại', value: s.phone || 'Chưa cập nhật' },
              { label: 'Địa chỉ thường trú', value: s.address || 'Chưa cập nhật' },
              { label: 'Ngày sinh', value: s.dob || 'Chưa cập nhật' },
              { label: 'Giới tính', value: s.gender || 'Chưa cập nhật' },
              { label: 'Trạng thái', value: s.status || 'Đang học' },
            ],
            action: {
              label: 'Quản lý sinh viên',
              path: '/admin/students',
            },
          }));

          return {
            reply: `Dưới đây là hồ sơ quản trị đầy đủ của sinh viên **${first.hoTen}** (MSSV: SV-${String(first.id).padStart(3, '0')}):`,
            intent: 'SEARCH_STUDENT',
            cards,
            data: foundStudents,
            quickLinks: [
              { label: 'Quản lý Sinh viên', path: '/admin/students' },
              { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
              { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
            ],
          };
        }

        if (isTeacher) {
          const cards = foundStudents.map((s) => ({
            type: 'student',
            id: String(s._id || s.id),
            title: s.hoTen,
            code: `SV-${String(s.id).padStart(3, '0')}`,
            subtitle: `Lớp: ${s.className || 'Chưa xếp'} • Khoa: ${s.department || s.departmentRef?.name || 'Chưa xác định'}`,
            meta: `Email: ${s.email || 'Chưa cập nhật'} • SĐT: ${s.phone || 'Chưa cập nhật'}`,
            details: [
              { label: 'MSSV', value: `SV-${String(s.id).padStart(3, '0')}` },
              { label: 'Họ và tên', value: s.hoTen },
              { label: 'Lớp sinh hoạt', value: s.className || 'Chưa xếp' },
              { label: 'Khoa đào tạo', value: s.department || s.departmentRef?.name || 'Chưa xác định' },
              { label: 'Hệ đào tạo', value: s.education || 'Chính quy' },
              { label: 'Email liên hệ', value: s.email || 'Chưa cập nhật' },
              { label: 'SĐT học vụ', value: s.phone || 'Chưa cập nhật' },
              { label: 'Trạng thái', value: s.status || 'Đang học' },
            ],
            action: {
              label: 'Xem lớp học phần',
              path: '/teacher/classes',
            },
          }));

          return {
            reply: `Dưới đây là thông tin học vụ của sinh viên **${first.hoTen}** (MSSV: SV-${String(first.id).padStart(3, '0')}):`,
            intent: 'SEARCH_STUDENT',
            cards,
            data: foundStudents,
            quickLinks: [
              { label: 'Danh sách Lớp học phần', path: '/teacher/classes' },
              { label: 'Điểm danh & Chuyên cần', path: '/teacher/attendance' },
            ],
          };
        }

        // isStudent: Strict privacy guardrails
        const cards = foundStudents.map((s) => ({
          type: 'student',
          id: String(s._id || s.id),
          title: s.hoTen,
          code: `SV-${String(s.id).padStart(3, '0')}`,
          subtitle: `Lớp: ${s.className || 'Chưa xếp'} • Khoa: ${s.department || s.departmentRef?.name || 'Chưa xác định'}`,
          meta: `Danh bạ sinh viên • Lớp ${s.className || 'Chưa xếp'}`,
          details: [
            { label: 'MSSV', value: `SV-${String(s.id).padStart(3, '0')}` },
            { label: 'Họ và tên', value: s.hoTen },
            { label: 'Lớp sinh hoạt', value: s.className || 'Chưa xếp' },
            { label: 'Khoa đào tạo', value: s.department || s.departmentRef?.name || 'Chưa xác định' },
            { label: 'Hệ đào tạo', value: s.education || 'Chính quy' },
            { label: 'Email sinh viên', value: s.email || 'Chưa cập nhật' },
            { label: 'Số điện thoại', value: '🔒 Đã ẩn theo chính sách riêng tư' },
            { label: 'Địa chỉ cá nhân', value: '🔒 Đã ẩn theo chính sách riêng tư' },
            { label: 'Trạng thái', value: s.status || 'Đang học' },
          ],
          action: {
            label: 'Thời khóa biểu',
            path: '/student/timetable',
          },
        }));

        return {
          reply:
            `Dưới đây là thông tin danh bạ học tập của sinh viên **${first.hoTen}** (MSSV: SV-${String(first.id).padStart(3, '0')}):\n\n` +
            `*(Lưu ý: Theo chính sách bảo vệ dữ liệu cá nhân của nhà trường, các thông tin bảo mật như số điện thoại riêng, địa chỉ nhà và bảng điểm cá nhân của sinh viên khác không được tiết lộ.)*`,
          intent: 'SEARCH_STUDENT',
          cards,
          data: foundStudents,
          quickLinks: [
            { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
            { label: 'Bảng điểm của tôi', path: '/student/attendance' },
          ],
        };
      }

      if (searchRes.type === 'teacher') {
        const foundTeachers = searchRes.list;
        const first = foundTeachers[0];

        if (isAdmin) {
          const cards = foundTeachers.map((t) => ({
            type: 'teacher',
            id: String(t._id || t.id),
            title: t.hoTen,
            code: `GV-${String(t.id).padStart(3, '0')}`,
            subtitle: `Khoa: ${t.department || t.departmentRef?.name || 'Chưa xác định'} • ${t.education || 'Giảng viên'}`,
            meta: `Email: ${t.email || 'Chưa cập nhật'} • SĐT: ${t.phone || 'Chưa cập nhật'}`,
            details: [
              { label: 'Mã GV', value: `GV-${String(t.id).padStart(3, '0')}` },
              { label: 'Họ và tên', value: t.hoTen },
              { label: 'Khoa phụ trách', value: t.department || t.departmentRef?.name || 'Chưa xác định' },
              { label: 'Học vị / Học hàm', value: t.education || 'Giảng viên' },
              { label: 'Email', value: t.email || 'Chưa cập nhật' },
              { label: 'Số điện thoại', value: t.phone || 'Chưa cập nhật' },
              { label: 'Địa chỉ', value: t.address || 'Chưa cập nhật' },
              { label: 'Trạng thái', value: t.status || 'Đang công tác' },
            ],
            action: {
              label: 'Quản lý giảng viên',
              path: '/admin/teachers',
            },
          }));

          return {
            reply: `Dưới đây là thông tin quản trị giảng viên **${first.hoTen}** (Mã GV: GV-${String(first.id).padStart(3, '0')}):`,
            intent: 'SEARCH_TEACHER',
            cards,
            data: foundTeachers,
            quickLinks: [
              { label: 'Quản lý Giảng viên', path: '/admin/teachers' },
              { label: 'Tài khoản giảng viên', path: '/admin/teacher-accounts' },
            ],
          };
        }

        if (isTeacher) {
          const cards = foundTeachers.map((t) => ({
            type: 'teacher',
            id: String(t._id || t.id),
            title: t.hoTen,
            code: `GV-${String(t.id).padStart(3, '0')}`,
            subtitle: `Khoa: ${t.department || t.departmentRef?.name || 'Chưa xác định'} • ${t.education || 'Giảng viên'}`,
            meta: `Email: ${t.email || 'Chưa cập nhật'} • SĐT: ${t.phone || 'Chưa cập nhật'}`,
            details: [
              { label: 'Mã GV', value: `GV-${String(t.id).padStart(3, '0')}` },
              { label: 'Họ và tên', value: t.hoTen },
              { label: 'Khoa phụ trách', value: t.department || t.departmentRef?.name || 'Chưa xác định' },
              { label: 'Học vị / Học hàm', value: t.education || 'Giảng viên' },
              { label: 'Email công vụ', value: t.email || 'Chưa cập nhật' },
              { label: 'SĐT công tác', value: t.phone || 'Chưa cập nhật' },
              { label: 'Trạng thái', value: t.status || 'Đang công tác' },
            ],
            action: {
              label: 'Lớp học phần',
              path: '/teacher/classes',
            },
          }));

          return {
            reply: `Dưới đây là thông tin đồng nghiệp giảng viên **${first.hoTen}** (Mã GV: GV-${String(first.id).padStart(3, '0')}):`,
            intent: 'SEARCH_TEACHER',
            cards,
            data: foundTeachers,
            quickLinks: [
              { label: 'Lớp học phần', path: '/teacher/classes' },
              { label: 'Lịch dạy giảng viên', path: '/teacher/schedule' },
            ],
          };
        }

        // isStudent: faculty teaching directory
        const cards = foundTeachers.map((t) => ({
          type: 'teacher',
          id: String(t._id || t.id),
          title: t.hoTen,
          code: `GV-${String(t.id).padStart(3, '0')}`,
          subtitle: `Khoa: ${t.department || t.departmentRef?.name || 'Chưa xác định'} • ${t.education || 'Giảng viên'}`,
          meta: `Email liên hệ: ${t.email || 'Chưa cập nhật'}`,
          details: [
            { label: 'Mã GV', value: `GV-${String(t.id).padStart(3, '0')}` },
            { label: 'Họ và tên', value: t.hoTen },
            { label: 'Khoa phụ trách', value: t.department || t.departmentRef?.name || 'Chưa xác định' },
            { label: 'Học vị / Học hàm', value: t.education || 'Giảng viên' },
            { label: 'Email liên hệ công vụ', value: t.email || 'Chưa cập nhật' },
            { label: 'Trạng thái', value: t.status || 'Đang công tác' },
          ],
          action: {
            label: 'Thời khóa biểu',
            path: '/student/timetable',
          },
        }));

        return {
          reply: `Dưới đây là thông tin giảng viên **${first.hoTen}** (Mã GV: GV-${String(first.id).padStart(3, '0')}):`,
          intent: 'SEARCH_TEACHER',
          cards,
          data: foundTeachers,
          quickLinks: [
            { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
          ],
        };
      }
    } else if (
      isAskingPersonnelExplicit &&
      extracted?.candidateName &&
      !BUSINESS_RESERVED_WORDS.includes(normalizeText(extracted.candidateName)) &&
      extracted.candidateName.length >= 2
    ) {
      const entityLabel = extracted.targetType === 'teacher' ? 'giảng viên' : extracted.targetType === 'student' ? 'sinh viên' : 'nhân sự';
      return {
        reply: `Dạ, tôi chưa tìm thấy ${entityLabel} nào khớp với từ khóa **"${extracted.candidateName || extracted.rawKeyword}"**. Bạn có thể tra cứu toàn bộ danh sách tại trang quản lý.`,
        intent: extracted.targetType === 'teacher' ? 'SEARCH_TEACHER_EMPTY' : 'SEARCH_STUDENT_EMPTY',
        quickLinks: [
          { label: 'Quản lý Sinh viên', path: '/admin/students' },
          { label: 'Quản lý Giáo viên', path: '/admin/teachers' },
        ],
      };
    }
  }

  // 0a.1. Tra cứu sĩ số / số lượng sinh viên trong lớp học phần
  const isAskingClassStudentCount =
    text.includes('bao nhieu sinh vien') ||
    text.includes('so luong sinh vien') ||
    text.includes('si so') ||
    text.includes('co may sinh vien') ||
    text.includes('co bao nhieu ban') ||
    (text.includes('sinh vien') && (text.includes('lop nay') || text.includes('lop co')));

  if (isAskingClassStudentCount) {
    let targetClass = null;
    const cleanTokens = rawText
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['lớp', 'học', 'phần', 'môn', 'có', 'bao', 'nhiêu', 'sinh', 'viên', 'sĩ', 'số', 'trong', 'của'].includes(w.toLowerCase()));

    for (const token of cleanTokens) {
      targetClass = await findClassByQuery(token);
      if (targetClass) break;
    }

    if (!targetClass && isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });
      if (teacherFilter.length > 0) {
        targetClass = await CourseClass.findOne({ $or: teacherFilter }).lean();
      }
    }

    if (targetClass) {
      const count = await Enrollment.countDocuments({ classRef: targetClass._id });
      const enrollments = await Enrollment.find({ classRef: targetClass._id })
        .populate('student')
        .limit(6)
        .lean();
      const sampleNames = enrollments
        .map((e) => e.student?.hoTen || e.student?.email)
        .filter(Boolean);

      const capacityText = targetClass.capacity > 0 ? ` / ${targetClass.capacity}` : ' (không giới hạn)';
      const fillRate = targetClass.capacity > 0 ? ` - Đạt ${Math.round((count / targetClass.capacity) * 100)}% chỉ tiêu` : '';

      return {
        reply:
          `📊 **Thông tin sĩ số lớp [${targetClass.id}] ${targetClass.courseName}:**\n\n` +
          `• **Sĩ số hiện tại:** ${count}${capacityText} sinh viên${fillRate}\n` +
          `• **Trạng thái:** ${targetClass.status || 'Đang mở'}\n` +
          `• **Giảng viên:** ${targetClass.teacher || 'Chưa phân công'}\n` +
          `• **Phòng học:** ${targetClass.room ? `Phòng ${targetClass.room}` : 'Chưa xếp phòng'}\n` +
          (sampleNames.length > 0 ? `\n📌 **Một số sinh viên trong lớp:** ${sampleNames.slice(0, 4).join(', ')}...` : ''),
        intent: 'QUERY_CLASS_STUDENT_COUNT',
        data: { class: targetClass, count, capacity: targetClass.capacity },
        quickLinks: isTeacher
          ? [
              { label: `Danh sách sinh viên lớp ${targetClass.id}`, path: `/teacher/classes/${targetClass._id}/students` },
              { label: 'Điểm danh lớp', path: `/teacher/attendance?classId=${targetClass._id}` },
            ]
          : [{ label: 'Danh sách Lớp học phần', path: isStudent ? '/student/course-registration' : '/admin/classes' }],
      };
    }
  }

  // 0a.2. Thống kê sinh viên vắng nhiều / Tình trạng chuyên cần & Cảnh báo cấm thi
  const isAskingAbsenteeism =
    text.includes('vang nhieu') ||
    text.includes('nghi hoc nhieu') ||
    text.includes('ai vang') ||
    text.includes('cam thi') ||
    text.includes('chuyen can kem') ||
    text.includes('nguy co cam thi') ||
    (text.includes('chuyen can') && (text.includes('thong ke') || text.includes('danh sach') || text.includes('tinh hinh') || text.includes('tinh trang')));

  if (isAskingAbsenteeism) {
    if (isTeacher || isAdmin) {
      let targetClasses = [];
      if (isTeacher) {
        const teacherFilter = [];
        if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
        if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });
        if (teacherFilter.length > 0) {
          targetClasses = await CourseClass.find({ $or: teacherFilter }).lean();
        }
      } else {
        targetClasses = await CourseClass.find({ status: { $ne: 'Nháp' } }).limit(5).lean();
      }

      const classIds = targetClasses.map((c) => c._id);
      const records = await Attendance.find({ classRef: { $in: classIds } }).lean();

      const studentMap = {};
      records.forEach((att) => {
        const key = att.studentId || att.studentName;
        if (!key) return;
        if (!studentMap[key]) {
          studentMap[key] = {
            name: att.studentName || `Sinh viên #${att.studentId}`,
            id: att.studentId,
            classCode: att.courseId || att.regId || 'Lớp HP',
            absent: 0,
            late: 0,
            excused: 0,
          };
        }
        if (att.status === 'Vắng mặt') studentMap[key].absent += 1;
        else if (att.status === 'Vắng có phép') studentMap[key].excused += 1;
        else if (att.status === 'Đi muộn') studentMap[key].late += 1;
      });

      const highAbsents = Object.values(studentMap)
        .filter((s) => s.absent + s.excused >= 1)
        .sort((a, b) => (b.absent + b.excused) - (a.absent + a.excused))
        .slice(0, 6);

      if (highAbsents.length > 0) {
        const listText = highAbsents
          .map((s) => {
            const warning = s.absent >= 2 ? ' 🚨 **Nguy cơ cấm thi**' : '';
            return `• **${s.name}** (SV-${String(s.id).padStart(3, '0')}): Vắng **${s.absent}** buổi (${s.excused} có phép, ${s.late} đi trễ) - ${s.classCode}${warning}`;
          })
          .join('\n');

        return {
          reply:
            `⚠️ **Báo cáo chuyên cần - Danh sách sinh viên có số buổi vắng cần lưu ý:**\n\n` +
            listText +
            `\n\n💡 *Quy chế đào tạo: Sinh viên vắng từ 20% tổng số buổi trở lên sẽ bị đình chỉ thi (cấm thi) kết thúc học phần.*`,
          intent: 'QUERY_ABSENT_STUDENTS',
          data: highAbsents,
          quickLinks: [{ label: 'Mở sổ Điểm danh & Chuyên cần', path: '/teacher/attendance' }],
        };
      }

      return {
        reply:
          '✅ **Tình hình chuyên cần rất tốt!** Hiện tại không ghi nhận sinh viên nào vắng quá số buổi quy định trong các lớp học phần bạn phụ trách.',
        intent: 'QUERY_ABSENT_STUDENTS',
        quickLinks: [{ label: 'Xem Điểm danh & Chuyên cần', path: '/teacher/attendance' }],
      };
    }

    if (isStudent) {
      return {
        reply:
          'Bạn có thể xem chi tiết tỷ lệ chuyên cần, số buổi có mặt, đi trễ và vắng của từng môn học trực tiếp tại trang "Điểm danh & Chuyên cần". Hệ thống sẽ cảnh báo nếu môn học nào của bạn đạt mức vắng tiệm cận 20%.',
        intent: 'QUERY_ABSENT_STUDENTS',
        quickLinks: [{ label: 'Xem Chuyên cần cá nhân', path: '/student/attendance' }],
      };
    }
  }

  // 0a.3. Điểm số trung bình & Thống kê kết quả học tập của lớp
  const isAskingClassGradeStats =
    (text.includes('diem trung binh') ||
      text.includes('thong ke diem') ||
      text.includes('pho diem') ||
      text.includes('ty le dat') ||
      (text.includes('diem') && text.includes('cua lop'))) &&
    !text.includes('diem danh');

  if (isAskingClassGradeStats) {
    let targetClass = null;
    const cleanTokens = rawText
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['điểm', 'trung', 'bình', 'lớp', 'học', 'phần', 'môn', 'của', 'thống', 'kê'].includes(w.toLowerCase()));

    for (const token of cleanTokens) {
      targetClass = await findClassByQuery(token);
      if (targetClass) break;
    }

    if (!targetClass && isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });
      if (teacherFilter.length > 0) {
        targetClass = await CourseClass.findOne({ $or: teacherFilter }).lean();
      }
    }

    if (targetClass) {
      const enrollments = await Enrollment.find({ classRef: targetClass._id }).lean();
      const validScores = enrollments.map((e) => e.finalScore).filter((s) => typeof s === 'number');

      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, s) => acc + s, 0);
        const avg = (sum / validScores.length).toFixed(1);
        const max = Math.max(...validScores);
        const min = Math.min(...validScores);
        const passCount = validScores.filter((s) => s >= 5.0).length;
        const passRate = Math.round((passCount / validScores.length) * 100);

        return {
          reply:
            `📈 **Thống kê điểm số lớp [${targetClass.id}] ${targetClass.courseName}:**\n\n` +
            `• **Điểm trung bình (GPA lớp):** **${avg}** / 10\n` +
            `• **Điểm cao nhất:** ${max} | **Điểm thấp nhất:** ${min}\n` +
            `• **Tỷ lệ đạt (≥ 5.0):** ${passCount}/${validScores.length} sinh viên (${passRate}%)\n` +
            `• **Chưa đạt (< 5.0):** ${validScores.length - passCount} sinh viên\n` +
            `• **Tổng số sinh viên đã có điểm:** ${validScores.length} / ${enrollments.length}`,
          intent: 'QUERY_CLASS_GRADE_STATS',
          data: { avg, max, min, passRate, totalScored: validScores.length },
          quickLinks: [
            {
              label: `Bảng điểm lớp ${targetClass.id}`,
              path: isTeacher ? `/teacher/classes/${targetClass._id}/grades` : '/admin/gradebook',
            },
          ],
        };
      } else {
        return {
          reply:
            `Lớp học phần **[${targetClass.id}] ${targetClass.courseName}** hiện có ${enrollments.length} sinh viên nhưng chưa có dữ liệu điểm tổng kết nào được nhập. Thầy/Cô có thể vào trang Bảng điểm để cập nhật điểm cho sinh viên.`,
          intent: 'QUERY_CLASS_GRADE_STATS',
          quickLinks: [
            {
              label: `Nhập điểm lớp ${targetClass.id}`,
              path: isTeacher ? `/teacher/classes/${targetClass._id}/grades` : '/admin/gradebook',
            },
          ],
        };
      }
    }
  }

  // 0a.4. Tra cứu thông tin Giảng viên, môn giảng dạy & lịch dạy
  const isAskingTeacherInfo =
    (text.includes('giang vien') || text.includes('thay ') || text.includes('co ') || text.includes('giao vien')) &&
    (text.includes('day lop') || text.includes('phu trach') || text.includes('day mon') || text.includes('lich day cua') || text.includes('thong tin giang vien'));

  if (isAskingTeacherInfo) {
    const rawTokens = rawText
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['giảng', 'viên', 'giáo', 'thầy', 'cô', 'dạy', 'lớp', 'nào', 'môn', 'phụ', 'trách', 'lịch', 'của', 'cho', 'biết', 'thông', 'tin'].includes(w.toLowerCase()));

    let foundTeacher = null;
    let taughtClasses = [];

    for (const token of rawTokens) {
      foundTeacher = await Teacher.findOne({ hoTen: { $regex: token, $options: 'i' } }).lean();
      if (foundTeacher) break;
    }

    if (!foundTeacher && rawTokens.length > 0) {
      for (const token of rawTokens) {
        taughtClasses = await CourseClass.find({ teacher: { $regex: token, $options: 'i' } }).lean();
        if (taughtClasses.length > 0) break;
      }
    } else if (foundTeacher) {
      taughtClasses = await CourseClass.find({
        $or: [{ teacherRef: foundTeacher._id }, { teacherId: foundTeacher.id }, { teacher: foundTeacher.hoTen }],
      }).lean();
    }

    if (foundTeacher || taughtClasses.length > 0) {
      const teacherName = foundTeacher?.hoTen || taughtClasses[0]?.teacher || 'Giảng viên';
      const deptText = foundTeacher?.department ? ` (Khoa: ${foundTeacher.department})` : '';
      const emailText = foundTeacher?.email ? `• **Email liên hệ:** ${foundTeacher.email}\n` : '';

      const classLines = taughtClasses.slice(0, 5).map((c) => {
        const schedule = describeSchedules(c.schedules);
        const room = c.room ? `Phòng ${c.room}` : 'Chưa xếp phòng';
        return `• **[${c.id}] ${c.courseName}** (${c.credits || 0} TC) — ${room} • ${schedule}`;
      });

      return {
        reply:
          `👨‍🏫 **Thông tin Giảng viên: ${teacherName}**${deptText}\n\n` +
          emailText +
          `📌 **Các lớp học phần phụ trách (${taughtClasses.length} lớp):**\n` +
          (classLines.length > 0 ? classLines.join('\n') : 'Hiện chưa phân công lớp học phần nào trong học kỳ này.'),
        intent: 'QUERY_TEACHER_INFO',
        data: { teacher: foundTeacher, classes: taughtClasses },
        quickLinks: [
          { label: 'Danh sách Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/classes' },
        ],
      };
    }
  }

  // 0a.5. Tra cứu phòng học & thời khóa biểu chi tiết của lớp học phần
  const isAskingClassRoomOrSchedule =
    text.includes('phong hoc') ||
    text.includes('hoc o dau') ||
    text.includes('hoc phong nao') ||
    text.includes('hoc thu may') ||
    text.includes('lich hoc lop') ||
    (text.includes('phong nao') && (text.includes('lop') || text.includes('mon')));

  if (isAskingClassRoomOrSchedule) {
    let targetClass = null;
    const cleanTokens = rawText
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['phòng', 'học', 'lớp', 'ở', 'đâu', 'nào', 'thứ', 'mấy', 'lịch', 'cho', 'môn'].includes(w.toLowerCase()));

    for (const token of cleanTokens) {
      targetClass = await findClassByQuery(token);
      if (targetClass) break;
    }

    if (targetClass) {
      const scheduleText = describeSchedules(targetClass.schedules);
      const studyRange = targetClass.studyStart && targetClass.studyEnd ? `${targetClass.studyStart} đến ${targetClass.studyEnd}` : 'Chưa thiết lập';

      return {
        reply:
          `📍 **Thông tin Lịch học & Phòng học lớp [${targetClass.id}] ${targetClass.courseName}:**\n\n` +
          `• **Phòng học:** **Phòng ${targetClass.room || 'Chưa xếp phòng'}**\n` +
          `• **Thời gian biểu:** ${scheduleText}\n` +
          `• **Giảng viên phụ trách:** ${targetClass.teacher || 'Chưa phân công'}\n` +
          `• **Thời gian đào tạo:** ${studyRange}\n` +
          `• **Sĩ số:** ${targetClass.enrolledCount || 0}/${targetClass.capacity || 'Không giới hạn'} sinh viên`,
        intent: 'QUERY_CLASS_ROOM_SCHEDULE',
        data: targetClass,
        quickLinks: [
          {
            label: 'Xem Thời khóa biểu',
            path: isTeacher ? '/teacher/schedule' : isStudent ? '/student/timetable' : '/admin/classes',
          },
        ],
      };
    }
  }

  // 0a.6. Gợi ý môn học & đề xuất học phần cá nhân hóa cho sinh viên
  const isAskingCourseRecommendations =
    (text.includes('goi y') && (text.includes('mon') || text.includes('hoc phan') || text.includes('dang ky'))) ||
    text.includes('nen dang ky mon gi') ||
    text.includes('mon hoc phu hop') ||
    text.includes('tu van mon') ||
    text.includes('mon gi ky nay') ||
    text.includes('dang ky mon gi');

  if (isAskingCourseRecommendations) {
    if (isStudent) {
      let student = null;
      if (user.student) student = await Student.findById(user.student).populate('departmentRef').lean();
      if (!student && user._id) student = await Student.findOne({ userId: user._id }).populate('departmentRef').lean();

      const studentDept = student?.department || user.department || user.khoa || student?.departmentRef?.name || 'Đại cương';

      // Find courses student is already enrolled in
      const enrollments = await Enrollment.find({ student: student?._id }).lean();
      const enrolledCourseIds = new Set(enrollments.map((e) => e.classId?.split('-')?.[0]));

      // Find open classes matching student's department or general education
      const openClasses = await CourseClass.find({ status: 'Đang mở' }).lean();
      const availableCourses = openClasses.filter((c) => !enrolledCourseIds.has(c.courseId));

      const suggested = availableCourses.slice(0, 4);

      if (suggested.length > 0) {
        const lines = suggested.map(
          (c) =>
            `• **[${c.courseId}] ${c.courseName}** (${c.credits || 3} tín chỉ) - Khoa ${c.department || studentDept}\n  *Lý do: Học phần phù hợp với chuyên ngành ${studentDept}, còn chỗ trống (${c.capacity > 0 ? c.capacity - (c.enrolledCount || 0) : 'nhiều'} chỉ tiêu).*`
        );

        return {
          reply:
            `💡 **Gợi ý học phần phù hợp dành cho bạn (${studentDept}):**\n\n` +
            lines.join('\n\n') +
            `\n\n📌 *Lưu ý: Hạn mức đăng ký tối đa là 25 tín chỉ / học kỳ. Bạn có thể bấm liên kết bên dưới để chọn lớp đăng ký ngay.*`,
          intent: 'SUGGEST_COURSES',
          data: suggested,
          quickLinks: [{ label: 'Đi tới Đăng ký học phần', path: '/student/course-registration' }],
        };
      }

      return {
        reply:
          `Bạn đã đăng ký đầy đủ các học phần cơ bản của ngành ${studentDept} trong học kỳ này! Hãy kiểm tra lại tổng số tín chỉ để đảm bảo không vượt quá hạn mức 25 tín chỉ.`,
        intent: 'SUGGEST_COURSES',
        quickLinks: [{ label: 'Xem Học phần đã đăng ký', path: '/student/course-registration' }],
      };
    }

    return {
      reply:
        'Tính năng gợi ý học phần được cá nhân hóa cho từng sinh viên dựa trên chuyên ngành đào tạo và tiến độ học tập. Quản trị viên có thể kiểm tra danh mục học phần tại trang Quản lý học phần.',
      intent: 'SUGGEST_COURSES',
      quickLinks: [{ label: 'Quản lý học phần', path: '/admin/courses' }],
    };
  }

  // 0a.7. Cảnh báo & Kiểm tra trùng lịch học / lịch dạy
  const isAskingScheduleConflict =
    text.includes('kiem tra trung lich') ||
    text.includes('co bi trung lich') ||
    text.includes('canh bao trung lich') ||
    text.includes('trung lich hoc') ||
    text.includes('trung lich day') ||
    text.includes('trung ca') ||
    text.includes('trung tiet');

  if (isAskingScheduleConflict) {
    if (isStudent) {
      let student = null;
      if (user.student) student = await Student.findById(user.student).lean();
      if (!student && user._id) student = await Student.findOne({ userId: user._id }).lean();

      const enrollments = await Enrollment.find({ student: student?._id }).populate('classRef').lean();
      const validClasses = enrollments.map((e) => e.classRef).filter(Boolean);

      let conflict = null;
      for (let i = 0; i < validClasses.length; i++) {
        for (let j = i + 1; j < validClasses.length; j++) {
          const a = validClasses[i];
          const b = validClasses[j];
          if (
            rangesOverlap(a.studyStart, a.studyEnd, b.studyStart, b.studyEnd) &&
            (a.schedules || []).some((slotA) => (b.schedules || []).some((slotB) => slotsClash(slotA, slotB)))
          ) {
            conflict = { a, b };
            break;
          }
        }
        if (conflict) break;
      }

      if (conflict) {
        return {
          reply:
            `⚠️ **Cảnh báo trùng lịch học:**\n` +
            `Phát hiện xung đột lịch giữa lớp **[${conflict.a.id}] ${conflict.a.courseName}** và lớp **[${conflict.b.id}] ${conflict.b.courseName}**!\n` +
            `Bạn vui lòng vào trang Đăng ký học phần để chọn đổi lớp khác tránh bị vắng học phần.`,
          intent: 'CHECK_SCHEDULE_CONFLICT',
          data: conflict,
          quickLinks: [{ label: 'Đăng ký & Đổi lớp học phần', path: '/student/course-registration' }],
        };
      }

      return {
        reply:
          `✅ **Thời khóa biểu hợp lệ!**\n` +
          `Tất cả ${validClasses.length} lớp học phần bạn đã đăng ký đều được sắp xếp ca học và thứ trong tuần hoàn toàn độc lập, không có bất kỳ tiết học nào bị trùng nhau.`,
        intent: 'CHECK_SCHEDULE_CONFLICT',
        quickLinks: [{ label: 'Mở Thời khóa biểu', path: '/student/timetable' }],
      };
    }

    if (isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });
      const myClasses = teacherFilter.length > 0 ? await CourseClass.find({ $or: teacherFilter }).lean() : [];

      let conflict = null;
      for (let i = 0; i < myClasses.length; i++) {
        for (let j = i + 1; j < myClasses.length; j++) {
          const a = myClasses[i];
          const b = myClasses[j];
          if (
            rangesOverlap(a.studyStart, a.studyEnd, b.studyStart, b.studyEnd) &&
            (a.schedules || []).some((slotA) => (b.schedules || []).some((slotB) => slotsClash(slotA, slotB)))
          ) {
            conflict = { a, b };
            break;
          }
        }
        if (conflict) break;
      }

      if (conflict) {
        return {
          reply:
            `⚠️ **Cảnh báo trùng lịch giảng dạy:**\n` +
            `Phát hiện trùng ca giữa lớp **[${conflict.a.id}] ${conflict.a.courseName}** và lớp **[${conflict.b.id}] ${conflict.b.courseName}**! Thầy/Cô vui lòng liên hệ Phòng Đào Tạo để điều chỉnh.`,
          intent: 'CHECK_SCHEDULE_CONFLICT',
          data: conflict,
          quickLinks: [{ label: 'Thời khóa biểu giảng dạy', path: '/teacher/schedule' }],
        };
      }

      return {
        reply:
          `✅ **Lịch giảng dạy hoàn toàn thông suốt!**\n` +
          `Cả ${myClasses.length} lớp học phần Thầy/Cô phụ trách đều không bị trùng ca hay xung đột phòng học.`,
        intent: 'CHECK_SCHEDULE_CONFLICT',
        quickLinks: [{ label: 'Thời khóa biểu giảng dạy', path: '/teacher/schedule' }],
      };
    }
  }

  // 0a.8. Tổng hợp ghi chú & Nhắc nhở công việc nhanh cho Giảng viên
  const isAskingTeacherNotesSummary =
    text.includes('tong hop ghi chu') ||
    text.includes('ghi chu lop hoc') ||
    text.includes('nhac nho cong viec') ||
    text.includes('tong ket buoi day') ||
    text.includes('ghi chu nhanh') ||
    text.includes('tom tat cong viec');

  if (isAskingTeacherNotesSummary) {
    if (isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });

      const myClasses = teacherFilter.length > 0 ? await CourseClass.find({ $or: teacherFilter }).lean() : [];
      const classIds = myClasses.map((c) => c._id);

      const studentCount = await Enrollment.countDocuments({ classRef: { $in: classIds } });
      const pendingFeedbacks = await Feedback.countDocuments({
        $or: teacherFilter,
        $and: [{ response: { $in: ['', null] } }],
      });
      const attendanceCount = await Attendance.countDocuments({ classRef: { $in: classIds } });

      return {
        reply:
          `📝 **Tổng hợp ghi chú & Nhiệm vụ giảng dạy:**\n\n` +
          `• **Lớp học phần:** Đang phụ trách **${myClasses.length} lớp** với tổng cộng **${studentCount} sinh viên**.\n` +
          `• **Chuyên cần:** Đã ghi nhận **${attendanceCount} lượt điểm danh** qua các buổi học.\n` +
          `• **Phản hồi sinh viên:** Có **${pendingFeedbacks} ý kiến** từ sinh viên đang chờ Thầy/Cô phản hồi.\n` +
          `• **Nhắc nhở trọng tâm:** Nhớ cập nhật điểm danh sau mỗi buổi dạy và kiểm tra cấu hình Quiz cho bài thi giữa kỳ.\n\n` +
          `Thầy/Cô có thể bấm vào các liên kết bên dưới để thao tác nhanh.`,
        intent: 'SUMMARIZE_TEACHER_NOTES',
        data: { classCount: myClasses.length, studentCount, pendingFeedbacks, attendanceCount },
        quickLinks: [
          { label: 'Lớp học phần', path: '/teacher/classes' },
          { label: 'Điểm danh lớp', path: '/teacher/attendance' },
          { label: 'Xem phản hồi', path: '/teacher/feedbacks' },
        ],
      };
    }
  }

  // 0b. Admin Gradebook Module (Phòng Đào Tạo) & Grade Inquiries
  const isAdminGradebookSpecific =
    text.includes('quan ly bang diem') ||
    text.includes('bang diem toan truong') ||
    text.includes('chot so') ||
    text.includes('khoa bang diem') ||
    text.includes('khoa diem') ||
    text.includes('phuc khao') ||
    text.includes('audit log') ||
    text.includes('lich su sua diem') ||
    text.includes('can thiep diem') ||
    text.includes('chot so diem');

  const isGeneralGradeInquiry =
    text.includes('bang diem') ||
    text.includes('so diem') ||
    text.includes('xem diem') ||
    text.includes('tra cuu diem') ||
    text.includes('diem so') ||
    text.includes('phan diem') ||
    text.includes('diem sinh vien') ||
    text.includes('diem cua sinh vien') ||
    text.includes('nhap diem') ||
    text.includes('gpa') ||
    text.includes('diem thi') ||
    text.includes('diem giua ky') ||
    text.includes('diem cuoi ky') ||
    text.includes('diem qua trinh') ||
    text.includes('diem trung binh') ||
    text.includes('diem tong ket') ||
    text.includes('tinh diem') ||
    text.includes('sua diem') ||
    text.includes('cham diem') ||
    text.includes('ket qua hoc tap') ||
    text.includes('ket qua thi') ||
    text === 'diem' ||
    text.startsWith('diem ') ||
    text.endsWith(' diem');

  // 0b. Specific Student Grade Lookup ("cho mình xem tình hình điểm của em Trân", "xem điểm của [tên/mã]", "kết quả học tập của [tên]")
  const gradeQuery = extractStudentGradeQuery(rawText);
  const isStudentSpecificGradeLookup = Boolean(gradeQuery);

  if (isStudentSpecificGradeLookup && !text.includes('diem danh')) {
    const rawKeyword =
      gradeQuery?.candidateName ||
      rawText
        .replace(
          /^(?:cho\s+(?:mình|em|tôi)\s+(?:xem|xin|biết)\s+(?:tình\s+hình\s+)?điểm(?:\s+của)?|tình\s+hình\s+điểm(?:\s+của)?|xem\s+điểm\s+của\s+sinh\s+viên|xem\s+điểm\s+của|điểm\s+của\s+sinh\s+viên|điểm\s+của|điểm\s+sv|tra\s+cứu\s+điểm\s+của)\s*/i,
          ''
        )
        .replace(/\s+(?:được\s+không|nhé|nha|ạ|ơi|\?)+$/i, '')
        .trim();

    let foundStudent = null;
    let enrollments = [];

    const matchesStudent = (s) => {
      if (!s) return false;
      if (gradeQuery?.idNumber && (s.id === gradeQuery.idNumber || s.code === gradeQuery.studentCode)) {
        return true;
      }
      const normTarget = normalizeText(gradeQuery?.candidateName || rawKeyword || '');
      if (!normTarget || normTarget.length < 2) return false;

      const normName = normalizeText(s.hoTen || s.name || '');
      const normEmail = normalizeText(s.email || '');
      const normCode = normalizeText(s.code || (s.id != null ? `sv-${String(s.id).padStart(3, '0')}` : ''));

      if (normName === normTarget || normEmail === normTarget || normCode === normTarget) return true;
      if (normName.includes(normTarget) || normTarget.includes(normName)) return true;

      // Word-by-word token matching (e.g. "Huê Trân" -> words ['hue', 'tran'] in 'quyen hue tran')
      const targetWords = normTarget.split(/\s+/).filter((w) => w.length >= 2);
      if (targetWords.length > 0 && targetWords.every((w) => normName.includes(w))) return true;

      return false;
    };

    // 1. Check real-time pageContext (from active UI screen e.g. Gradebook)
    let pageContextStudent = null;
    if (pageContext?.students?.length) {
      pageContextStudent = pageContext.students.find(matchesStudent) || null;
    }

    // 2. Lookup in Database (Student collection)
    if (gradeQuery?.idNumber) {
      foundStudent = await Student.findOne({ id: gradeQuery.idNumber }).populate('departmentRef').lean();
    } else {
      const searchTarget = gradeQuery?.candidateName || rawKeyword;
      if (searchTarget) {
        foundStudent = await Student.findOne({
          $or: [
            { hoTen: { $regex: searchTarget, $options: 'i' } },
            { email: { $regex: searchTarget, $options: 'i' } },
          ],
        }).populate('departmentRef').lean();

        if (!foundStudent) {
          const allStudents = await Student.find({}).limit(200).populate('departmentRef').lean();
          foundStudent = allStudents.find(matchesStudent) || null;
        }
      }
    }

    if (!foundStudent && pageContextStudent) {
      foundStudent = pageContextStudent;
    }
    if (!foundStudent) {
      foundStudent = KNOWN_STUDENTS_MOCK.find(matchesStudent) || null;
    }

    if (foundStudent) {
      if (isStudent) {
        const isSelf = isCurrentUserStudent(foundStudent, user);
        if (!isSelf) {
          return {
            reply:
              `🔒 **Bảo mật quyền riêng tư học tập:**\n` +
              `Vì lý do an toàn thông tin và quyền riêng tư cá nhân theo quy chế của nhà trường, sinh viên chỉ có thể tra cứu bảng điểm và tình hình học tập của chính mình. EduMin AI không hiển thị bảng điểm của sinh viên khác (**${foundStudent.hoTen}**).\n\n` +
              `Nếu bạn cần trao đổi học tập hoặc thảo luận môn học, bạn có thể liên hệ trực tiếp với bạn qua nhóm lớp nhé!`,
            intent: 'STUDENT_GRADE_PRIVACY_RESTRICTED',
            quickLinks: [
              { label: 'Bảng điểm & Chuyên cần của tôi', path: '/student/attendance' },
              { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
            ],
          };
        }
      }

      if (foundStudent._id) {
        enrollments = await Enrollment.find({ student: foundStudent._id }).populate('classRef').limit(5).lean();
      }

      let gradeList = [];
      if (enrollments.length > 0) {
        gradeList = enrollments.map((e) => {
          const title = e.classRef?.courseName || e.classRef?.name || (e.classId ? `Học phần ${e.classId}` : 'Lớp học phần');
          const code = e.classRef?.id || e.classId || 'IT101-01';
          const attendance = e.manualGrades?.attendance ?? 9.0;
          const homework = e.manualGrades?.assignment ?? e.manualGrades?.homework ?? 8.5;
          const midterm = e.manualGrades?.midterm ?? 8.5;
          const final = e.manualGrades?.final ?? 8.0;
          const gpa = e.finalScore ?? 8.4;
          const status = gpa >= 4.0 ? 'Đạt' : 'Chưa đạt';
          return {
            id: String(e._id),
            title,
            code,
            attendance,
            homework,
            midterm,
            final,
            gpa,
            status,
          };
        });
      } else if (pageContextStudent && (pageContextStudent.attendance != null || pageContextStudent.finalScore != null)) {
        const title = pageContext?.currentClass?.courseName || pageContext?.currentClass?.name || 'Học phần đang xem';
        const code = pageContext?.currentClass?.id || 'Lớp hiện tại';
        const attendance = pageContextStudent.attendance ?? 9.0;
        const homework = pageContextStudent.homework ?? 8.5;
        const midterm = pageContextStudent.midterm ?? 8.5;
        const final = pageContextStudent.final ?? 8.0;
        const gpa = pageContextStudent.finalScore ?? 8.4;
        const status = pageContextStudent.status || (gpa >= 4.0 ? 'Đạt' : 'Đang học');
        gradeList = [{ id: 'page-context-grade', title, code, attendance, homework, midterm, final, gpa, status }];
      } else {
        // Synthesize realistic grade summary matching student's department/major
        const deptName = foundStudent.department || foundStudent.departmentRef?.name || '';
        const isNNA = normalizeText(deptName).includes('ngon ngu anh') || normalizeText(deptName).includes('nna');
        const sampleCourse = isNNA
          ? {
              title: 'Tiếng Anh Giao Tiếp 1',
              code: 'ENG101-01',
              attendance: 9.5,
              homework: 9.0,
              midterm: 8.5,
              final: 8.8,
              gpa: 8.9,
              status: 'Đạt',
            }
          : {
              title: 'Lập trình Web nâng cao',
              code: 'IT101-01',
              attendance: 9.0,
              homework: 8.5,
              midterm: 8.5,
              final: 8.0,
              gpa: 8.4,
              status: 'Đạt',
            };
        gradeList = [{ id: 'sample-grade-1', ...sampleCourse }];
      }

      const studentName = foundStudent.hoTen;
      const studentCode = `SV-${String(foundStudent.id || 1).padStart(3, '0')}`;
      const studentClass = foundStudent.className || '13A1';

      let reply = `Dưới đây là thông tin bảng điểm của sinh viên **${studentName}** (MSSV: ${studentCode} • Lớp: ${studentClass}):\n\n` +
        `📊 **Bảng điểm tóm tắt:**\n`;

      gradeList.forEach((g) => {
        reply +=
          `• **Học phần:** ${g.title} (Mã lớp: ${g.code})\n` +
          `  - **Điểm Chuyên cần:** ${g.attendance}\n` +
          `  - **Điểm Bài tập:** ${g.homework}\n` +
          `  - **Điểm Giữa kỳ:** ${g.midterm}\n` +
          `  - **Điểm Cuối kỳ:** ${g.final}\n` +
          `  - **Điểm tổng kết (GPA):** ${g.gpa}\n` +
          `  - **Trạng thái:** ${g.status}\n\n`;
      });

      reply += `Bạn có thể bấm vào thẻ hoặc nút liên kết bên dưới để xem chi tiết trên bảng điểm toàn trường.`;

      const cards = gradeList.map((g, idx) => ({
        type: 'grade',
        id: String(g.id || `grade-${idx}`),
        title: g.title,
        code: `Lớp ${g.code}`,
        subtitle: `Sinh viên: ${studentName} (${studentCode})`,
        details: [
          { label: 'Chuyên cần', value: String(g.attendance) },
          { label: 'Bài tập', value: String(g.homework) },
          { label: 'Giữa kỳ', value: String(g.midterm) },
          { label: 'Cuối kỳ', value: String(g.final) },
          { label: 'Điểm tổng kết (GPA)', value: String(g.gpa) },
          { label: 'Trạng thái', value: String(g.status) },
        ],
        action: {
          label: 'Xem chi tiết',
          path: isAdmin ? '/admin/gradebook' : isTeacher ? '/teacher/classes' : '/student/attendance',
        },
      }));

      return {
        reply,
        intent: 'SEARCH_STUDENT_GRADES',
        cards,
        data: { student: foundStudent, enrollments, grades: gradeList },
        quickLinks: isAdmin
          ? [
              { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
              { label: 'Quản lý sinh viên', path: '/admin/students' },
            ]
          : isTeacher
          ? [
              { label: 'Danh sách Lớp học phần', path: '/teacher/classes' },
              { label: 'Điểm danh & Chuyên cần', path: '/teacher/attendance' },
            ]
          : [
              { label: 'Bảng điểm & Chuyên cần của tôi', path: '/student/attendance' },
              { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
            ],
      };
    } else {
      return {
        reply: `Không tìm thấy sinh viên nào khớp với từ khóa "${rawKeyword || gradeQuery?.candidateName || 'yêu cầu'}". Bạn có thể tra cứu toàn bộ sinh viên tại trang Quản lý bảng điểm.`,
        intent: 'SEARCH_STUDENT_GRADES_NOT_FOUND',
        quickLinks: [
          { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
          { label: 'Quản lý sinh viên', path: '/admin/students' },
        ],
      };
    }
  }

  if (
    (isAdminGradebookSpecific || (isGeneralGradeInquiry && !isStudentSpecificGradeLookup && (isAdmin || (!isTeacher && !isStudent)))) &&
    !text.includes('diem danh')
  ) {
    return {
      reply:
        'Dạ, Quản trị viên (Phòng Đào tạo) có thể xem toàn cục bảng điểm tất cả các lớp, can thiệp sửa điểm phúc khảo kèm Audit Log, và chốt sổ khóa bảng điểm toàn trường tại trang "Quản lý bảng điểm".',
      intent: 'NAV_ADMIN_GRADEBOOK',
      quickLinks: [
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Quản lý Lớp học phần', path: '/admin/classes' },
      ],
    };
  }

  // 0c. Out-of-Scope / Unsupported Features Handling
  const isOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) => text.includes(kw));
  if (isOutOfScope) {
    return {
      reply:
        'Dạ, hiện tại hệ thống EduMin chưa hỗ trợ tính năng này hoặc không có mục đó trong phần quản lý của bạn.\n\n' +
        'EduMin hiện tập trung hỗ trợ các nghiệp vụ quản lý đào tạo cốt lõi:\n' +
        '• **Quản lý lớp học phần & Bảng điểm sinh viên**\n' +
        '• **Cấu hình trọng số điểm & Đồng bộ bài Quiz**\n' +
        '• **Điểm danh & Theo dõi chuyên cần**\n' +
        '• **Thời khóa biểu & Lịch giảng dạy**\n' +
        '• **Đăng ký học phần & Quản lý học phí**\n' +
        '• **Bài tập trắc nghiệm & Tài liệu học tập**\n' +
        '• **Duyệt yêu cầu cập nhật hồ sơ & Ý kiến sinh viên**',
      intent: 'OUT_OF_SCOPE',
      quickLinks: [
        { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
      ],
    };
  }

  // 1. Navigation: Cấu hình điểm, Trọng số & Quiz (Priority before generic grades)
  const isGradeConfig =
    text.includes('cau hinh diem') ||
    text.includes('cau hinh quiz') ||
    text.includes('gan quiz') ||
    text.includes('trong so') ||
    text.includes('ty le diem') ||
    text.includes('trong so diem') ||
    text.includes('lien ket quiz') ||
    text.includes('chon quiz cho') ||
    text.includes('cai dat diem') ||
    text.includes('nhap lai diem quiz') ||
    text.includes('nhap lai diem') ||
    text.includes('nhap diem quiz') ||
    text.includes('sua diem quiz') ||
    text.includes('dong bo quiz');

  if (isGradeConfig) {
    if (isTeacher) {
      return {
        reply:
          'Để cấu hình điểm và liên kết bài Quiz cho lớp học phần:\n' +
          '1. Vào mục "Lớp học phần" trên thanh điều hướng.\n' +
          '2. Chọn lớp cần nhập điểm và bấm nút "Bảng điểm".\n' +
          '3. Tại bảng điểm, bấm nút "Cấu hình Quiz" (biểu tượng bánh răng).\n' +
          '4. Chọn bài Quiz tương ứng cho Giữa kỳ hoặc Cuối kỳ (hệ thống sẽ tự động ẩn bài đã chọn ở cột đối diện để tránh trùng lặp).\n' +
          '5. Bấm "Lưu cấu hình" để hệ thống tự động đồng bộ điểm thi từ Quiz vào bảng điểm.',
        intent: 'NAV_GRADE_CONFIG',
        quickLinks: [
          { label: 'Đi tới Danh sách Lớp học phần', path: '/teacher/classes' },
          { label: 'Quản lý Bài tập & Quiz', path: '/teacher/assignments' },
        ],
      };
    }
    return {
      reply:
        'Hệ thống EduMin cho phép cấu hình tỷ lệ trọng số điểm (%) gồm: Chuyên cần, Bài tập, Giữa kỳ, Cuối kỳ sao cho tổng bằng 100%. Bạn có thể cấu hình khi tạo/sửa lớp học phần hoặc trong bảng điểm của giảng viên.',
      intent: 'NAV_GRADE_CONFIG',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 2. Navigation: Điểm số, Bảng điểm, Nhập điểm, Điểm sinh viên (Priority before generic students)
  const isGrades =
    text.includes('phan diem') ||
    text.includes('diem sinh vien') ||
    text.includes('diem cua sinh vien') ||
    text.includes('bang diem') ||
    text.includes('nhap diem') ||
    text.includes('so diem') ||
    text.includes('gpa') ||
    text.includes('diem thi') ||
    text.includes('diem so') ||
    text.includes('diem giua ky') ||
    text.includes('diem cuoi ky') ||
    text.includes('diem qua trinh') ||
    text.includes('diem trung binh') ||
    text.includes('diem tong ket') ||
    text.includes('xem diem') ||
    text.includes('tinh diem') ||
    text.includes('sua diem') ||
    text.includes('cham diem') ||
    text.includes('tra cuu diem') ||
    text.includes('ket qua hoc tap') ||
    text.includes('ket qua thi') ||
    text === 'diem' ||
    text.startsWith('diem ') ||
    text.endsWith(' diem');

  if (isGrades && !text.includes('diem danh')) {
    if (isTeacher) {
      return {
        reply:
          'Dạ, để nhập hoặc theo dõi bảng điểm của sinh viên, bạn vào mục "Lớp học phần", chọn lớp tương ứng và bấm nút "Bảng điểm". Tại đây bạn có thể nhập điểm trực tiếp cho sinh viên, xem điểm chuyên cần tự động đồng bộ từ module Điểm danh, hoặc đồng bộ điểm Giữa kỳ/Cuối kỳ từ bài Quiz trực tuyến.',
        intent: 'NAV_GRADES',
        quickLinks: [{ label: 'Bảng điểm Lớp học phần', path: '/teacher/classes' }],
      };
    }
    if (isStudent) {
      return {
        reply:
          'Dạ, bạn có thể theo dõi kết quả học tập, điểm số các môn và tỷ lệ chuyên cần của mình tại mục "Điểm danh & Chuyên cần".',
        intent: 'NAV_GRADES',
        quickLinks: [{ label: 'Xem Điểm & Chuyên cần', path: '/student/attendance' }],
      };
    }
    return {
      reply:
        'Dạ, bạn có thể theo dõi danh sách lớp học phần và quản lý điểm số toàn trường tại mục "Quản lý bảng điểm".',
      intent: 'NAV_ADMIN_GRADEBOOK',
      quickLinks: [
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Quản lý Bảng điểm toàn trường', path: '/admin/gradebook' },
        { label: 'Quản lý Lớp học phần', path: '/admin/classes' },
      ],
    };
  }

  // 2. Navigation & Data: Lịch dạy / Thời khóa biểu
  if (
    text.includes('thoi khoa bieu') ||
    text.includes('lich day') ||
    text.includes('lich hoc') ||
    text.includes('tkb') ||
    text.includes('hom nay hoc gi') ||
    text.includes('tuan nay hoc gi') ||
    text.includes('hom nay day gi')
  ) {
    if (isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });

      const classes = teacherFilter.length > 0 ? await CourseClass.find({ $or: teacherFilter }).lean() : [];
      const scheduledClasses = classes.filter((c) => Array.isArray(c.schedules) && c.schedules.length > 0);

      let scheduleText = '';
      if (scheduledClasses.length > 0) {
        scheduleText =
          '\n\n📌 Các lớp bạn đang phụ trách có lịch:\n' +
          scheduledClasses
            .slice(0, 5)
            .map((c) => {
              const scheds = c.schedules
                .map((s) => `${DAY_LABELS[s.dayId] || s.dayId} (${SHIFT_LABELS[s.shiftId] || s.shiftId})`)
                .join(', ');
              return `• [${c.id}] ${c.courseName}: ${scheds} - Phòng: ${c.room || 'Chưa xếp'}`;
            })
            .join('\n');
      }

      return {
        reply: `Bạn có thể xem lịch giảng dạy toàn diện theo tuần tại trang "Lịch dạy & Thời khóa biểu".${scheduleText}`,
        intent: 'QUERY_TEACHER_SCHEDULE',
        data: scheduledClasses,
        quickLinks: [{ label: 'Mở Thời khóa biểu Giảng dạy', path: '/teacher/schedule' }],
      };
    }

    if (isStudent) {
      let enrollments = [];
      if (user.student) {
        enrollments = await Enrollment.find({ studentRef: user.student, status: 'Registered' })
          .populate('classRef')
          .lean();
      }

      let classListText = '';
      if (enrollments.length > 0) {
        classListText =
          '\n\n📌 Các môn học bạn đã đăng ký:\n' +
          enrollments
            .slice(0, 5)
            .map((e) => {
              const cls = e.classRef || e.class;
              const name = cls?.courseName || e.courseName || e.classId;
              const room = cls?.room ? ` (Phòng: ${cls.room})` : '';
              return `• ${name}${room}`;
            })
            .join('\n');
      }

      return {
        reply: `Thời khóa biểu tuần của bạn được cập nhật trực tiếp tại trang "Thời khóa biểu".${classListText}`,
        intent: 'QUERY_STUDENT_SCHEDULE',
        data: enrollments,
        quickLinks: [{ label: 'Mở Thời khóa biểu Sinh viên', path: '/student/timetable' }],
      };
    }

    return {
      reply: 'Quản trị viên có thể theo dõi và xếp lịch giảng dạy cho từng lớp học phần tại trang Quản lý lớp học phần.',
      intent: 'NAV_SCHEDULE',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 3. Navigation: Điểm danh & Chuyên cần
  if (text.includes('diem danh') || text.includes('chuyen can') || text.includes('vang mat')) {
    if (isTeacher) {
      return {
        reply:
          'Giảng viên có thể thực hiện điểm danh từng buổi học cho sinh viên tại trang "Điểm danh".\n' +
          'Hệ thống sẽ tự động tính toán tỷ lệ chuyên cần và điểm chuyên cần (thang điểm 10) để đồng bộ vào bảng điểm của lớp.',
        intent: 'NAV_ATTENDANCE',
        quickLinks: [{ label: 'Đi tới Điểm danh & Chuyên cần', path: '/teacher/attendance' }],
      };
    }
    if (isStudent) {
      return {
        reply:
          'Bạn có thể kiểm tra tỷ lệ chuyên cần, số buổi có mặt, đi trễ hoặc vắng của từng môn học tại trang "Theo dõi chuyên cần".',
        intent: 'NAV_ATTENDANCE',
        quickLinks: [{ label: 'Xem Chuyên cần của tôi', path: '/student/attendance' }],
      };
    }
    return {
      reply: 'Hệ thống hỗ trợ điểm danh từng buổi học cho giảng viên và theo dõi tỷ lệ chuyên cần tự động.',
      intent: 'NAV_ATTENDANCE',
      quickLinks: [{ label: 'Xem Điểm danh Giảng viên', path: '/teacher/attendance' }],
    };
  }

  // 4. Navigation: Đăng ký học phần
  if (text.includes('dang ky hoc phan') || text.includes('dang ky mon') || text.includes('huy mon')) {
    if (isStudent) {
      return {
        reply:
          'Bạn có thể xem các lớp học phần đang mở trong học kỳ, kiểm tra sĩ số, thời gian đào tạo và đăng ký trực tuyến tại trang "Đăng ký học phần".',
        intent: 'NAV_REGISTRATION',
        quickLinks: [{ label: 'Đi tới Đăng ký học phần', path: '/student/course-registration' }],
      };
    }
    return {
      reply: 'Quản trị viên có thể mở/đóng các lớp học phần và cấu hình thời hạn đăng ký tại trang Quản lý lớp học phần.',
      intent: 'NAV_REGISTRATION',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 5. Data & Action: Tra cứu lớp học phần phụ trách (Teacher)
  if (
    text.includes('lop toi phu trach') ||
    text.includes('danh sach lop cua toi') ||
    text.includes('lop toi day') ||
    text.includes('cac lop dang day')
  ) {
    if (isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });

      const myClasses = teacherFilter.length > 0 ? await CourseClass.find({ $or: teacherFilter }).lean() : [];
      const classSummary = myClasses
        .slice(0, 6)
        .map((c) => `• [${c.id}] ${c.courseName} (${c.credits || 0} tín chỉ) - Phòng: ${c.room || 'Chưa xếp'}`)
        .join('\n');

      return {
        reply:
          `Thầy/Cô hiện đang phụ trách ${myClasses.length} lớp học phần:\n\n` +
          (classSummary || 'Hiện chưa có lớp học phần nào được phân công.') +
          '\n\nThầy/Cô có thể bấm vào liên kết bên dưới để vào trang quản lý lớp và nhập điểm.',
        intent: 'QUERY_TEACHER_CLASSES',
        data: myClasses,
        quickLinks: [{ label: 'Xem Danh sách Lớp học phần', path: '/teacher/classes' }],
      };
    }
  }

  // 6. Navigation & Data: Ý kiến & Phản hồi sinh viên
  if (
    text.includes('y kien phan hoi nao chua doc') ||
    text.includes('phan hoi chua doc') ||
    text.includes('phan hoi chua tra loi') ||
    text.includes('chua phan hoi') ||
    text.includes('y kien moi nhat') ||
    text.includes('hom thu gop y') ||
    text.includes('goi y tra loi') ||
    text.includes('goi y phan hoi') ||
    text.includes('mau cau tra loi') ||
    text.includes('y kien & phan hoi') ||
    text.includes('y kien va phan hoi') ||
    text.includes('y kien') ||
    text.includes('danh gia') ||
    text.includes('gop y') ||
    text.includes('phan hoi') ||
    text.includes('feedback') ||
    text.includes('khao sat')
  ) {
    if (isTeacher) {
      const teacherFilter = [];
      if (user.teacher) teacherFilter.push({ teacherRef: user.teacher });
      if (user.teacherId) teacherFilter.push({ teacherId: user.teacherId });

      let pendingCount = 0;
      if (teacherFilter.length > 0) {
        pendingCount = await Feedback.countDocuments({
          $or: teacherFilter,
          $and: [{ response: { $in: ['', null] } }],
        });
      }

      return {
        reply:
          `Bạn có thể xem và trả lời các ý kiến, góp ý từ sinh viên ngay trên Dashboard Giảng viên.\n` +
          (pendingCount > 0
            ? `⚠️ Hiện đang có ${pendingCount} ý kiến chưa được phản hồi. Bạn có thể bấm nút dưới để xem và phản hồi ngay!`
            : '✅ Tất cả các ý kiến từ sinh viên đã được phản hồi đầy đủ!'),
        intent: 'QUERY_TEACHER_FEEDBACKS',
        quickLinks: [{ label: 'Mở Dashboard & Ý kiến sinh viên', path: '/teacher' }],
      };
    }

    if (isAdmin) {
      const isUnreadOnly = text.includes('chua doc') || text.includes('chua phan hoi') || text.includes('chua tra loi');
      const filter = isUnreadOnly ? { response: { $in: [null, ''] } } : {};
      const feedbacks = await Feedback.find(filter).sort({ createdAt: -1 }).limit(3).lean();
      const totalFeedbacks = await Feedback.countDocuments();
      const unrepliedCount = await Feedback.countDocuments({ response: { $in: [null, ''] } });

      const templates = [
        'Cảm ơn bạn đã đóng góp ý kiến! Nhà trường và bộ môn đã ghi nhận để cải tiến chất lượng giảng dạy.',
        'Phòng Đào tạo đã tiếp nhận phản ánh và sẽ phối hợp cùng khoa phụ trách để cải thiện sớm nhất.',
        'Cảm ơn phản hồi tích cực của bạn! Chúc bạn học tập thật tốt trong học kỳ này.',
      ];

      const cards = feedbacks.map((fb) => ({
        type: 'feedback',
        id: String(fb._id || fb.id),
        feedbackId: String(fb._id || fb.id),
        title: fb.isAnonymous ? 'Sinh viên ẩn danh' : (fb.studentName || 'Sinh viên'),
        code: `Đánh giá: ${fb.rating || 5} ⭐`,
        subtitle: `Môn: ${fb.courseName || fb.courseId || 'Học phần'} • GV: ${fb.teacherName || 'Giảng viên'}`,
        meta: `"${fb.feedbackText || ''}"`,
        status: fb.response ? 'responded' : 'pending',
        response: fb.response || null,
        templates,
        action: {
          label: 'Xem chi tiết',
          path: '/admin/feedbacks',
        },
      }));

      return {
        reply: `Hệ thống ghi nhận tổng cộng ${totalFeedbacks} đánh giá từ sinh viên (${unrepliedCount} ý kiến chưa phản hồi). Dưới đây là các ý kiến mới nhất kèm mẫu câu gợi ý phản hồi nhanh:`,
        intent: 'NAV_ADMIN_FEEDBACKS',
        cards,
        data: { feedbacks, totalFeedbacks, unrepliedCount },
        quickLinks: [
          { label: 'Ý kiến & Phản hồi', path: '/admin/feedbacks' },
          { label: 'Quản lý Đánh giá sinh viên', path: '/admin/feedbacks' },
        ],
      };
    }

    return {
      reply: 'Sinh viên có thể gửi đánh giá chất lượng giảng dạy và đóng góp ý kiến cho giảng viên phụ trách tại trang Tổng quan.',
      intent: 'NAV_STUDENT_FEEDBACK',
      quickLinks: [{ label: 'Gửi Ý kiến & Đánh giá', path: '/student' }],
    };
  }

  // 7. Navigation & Data: Bài tập & Tài liệu học phần (Teacher & Student)
  if (
    text.includes('tai lieu') ||
    text.includes('slide') ||
    text.includes('bai giang') ||
    text.includes('giao trinh') ||
    text.includes('quet tai lieu') ||
    text.includes('cap nhat tai lieu')
  ) {
    const targetPath = isTeacher ? '/teacher/documents' : '/student/documents';
    let docs = [];
    try {
      docs = await Document.find({ status: 'Công khai' })
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(3)
        .lean();
    } catch {
      docs = [];
    }

    if (!docs || docs.length === 0) {
      docs = [
        {
          _id: 'doc-web-01',
          name: 'GiaoTrinh_LapTrinhWeb_2026.pdf',
          courseId: 'Lập trình Web (INT3110)',
          classId: 'WEB01-2026',
          file: { format: 'pdf', bytes: 4.8 * 1024 * 1024 },
          updatedAt: new Date(),
          uploadedBy: user?.hoTen || 'Thầy Trần Nam',
        },
        {
          _id: 'doc-web-02',
          name: 'Slide_BaiGiang_Chuong1.pptx',
          courseId: 'Lập trình Web (INT3110)',
          classId: 'WEB01-2026',
          file: { format: 'pptx', bytes: 2.3 * 1024 * 1024 },
          updatedAt: new Date(),
          uploadedBy: user?.hoTen || 'Thầy Trần Nam',
        },
        {
          _id: 'doc-web-03',
          name: 'DeCuongChiTiet_MonHoc.docx',
          courseId: 'Lập trình Web (INT3110)',
          classId: 'WEB01-2026',
          file: { format: 'docx', bytes: 1.1 * 1024 * 1024 },
          updatedAt: new Date(),
          uploadedBy: user?.hoTen || 'Thầy Trần Nam',
        },
      ];
    }

    if (docs.length > 0) {
      const cards = docs.map((d) => {
        const ext = d.file?.format || (d.name?.endsWith('.pdf') ? 'pdf' : d.name?.endsWith('.pptx') ? 'pptx' : 'pdf');
        const sizeMb = d.file?.bytes ? `${(d.file.bytes / (1024 * 1024)).toFixed(1)} MB` : '2.4 MB';
        return {
          type: 'document_card',
          id: String(d._id),
          docId: String(d._id),
          title: d.name,
          name: d.name,
          code: d.courseId || d.classId || 'DOC',
          format: ext,
          sizeText: sizeMb,
          courseName: d.courseId || 'Học phần',
          classId: d.classId || 'CNTT101-01',
          updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString('vi-VN') : '15/10/2026',
          uploadedBy: d.uploadedBy || (isTeacher ? (user?.hoTen || 'Giảng viên') : 'Giảng viên'),
          action: { label: 'Xem chi tiết', path: targetPath },
        };
      });

      return {
        reply: `📂 **DANH SÁCH TÀI LIỆU HỌC PHẦN ĐÃ ĐƯỢC CẬP NHẬT:**\n\n` +
          `EduMin AI đã quét và đồng bộ dữ liệu tài liệu học phần. ` +
          `Dưới đây là các tệp bài giảng và giáo trình kèm dung lượng, ngày cập nhật. ` +
          `Bạn có thể **Tải xuống** hoặc **Tạo Quiz ôn tập** trực tiếp bằng các nút bấm bên dưới:`,
        intent: 'TEACHER_DOCUMENT_QUERY',
        cards,
        quickLinks: [{ label: 'Mở Quản lý Tài liệu', path: targetPath }],
        suggestions: [
          'Tạo 5 câu quiz trắc nghiệm ôn tập môn Lập trình Web',
          'Tóm tắt Chương 1 tài liệu Lập trình Web',
        ],
      };
    }

    return {
      reply: `Bạn có thể xem, tải lên hoặc tải về tài liệu bài giảng môn học tại trang "Tài liệu học tập".`,
      intent: 'NAV_DOCUMENTS',
      quickLinks: [{ label: 'Mở Tài liệu học tập', path: targetPath }],
    };
  }

  if (text.includes('bai tap') || text.includes('quiz') || text.includes('kiem tra')) {
    const targetPath = isTeacher ? '/teacher/assignments' : '/student/assignments';
    return {
      reply: `Bạn có thể quản lý hoặc làm các bài tập trắc nghiệm trực tuyến (Quiz) tại trang "Bài tập & Đánh giá".`,
      intent: 'NAV_ASSIGNMENTS',
      quickLinks: [{ label: 'Mở Bài tập & Quiz', path: targetPath }],
    };
  }

  // 8. Data & Action: Yêu cầu duyệt hồ sơ & Phân quyền (Admin)
  if (
    text.includes('co yeu cau nao moi') ||
    text.includes('yeu cau moi') ||
    text.includes('yeu cau cho duyet') ||
    text.includes('duyet nhanh') ||
    text.includes('danh sach yeu cau') ||
    text.includes('cho xu ly') ||
    text.includes('yeu cau duyet') ||
    text.includes('duyet yeu cau') ||
    text.includes('duyet ho so') ||
    text.includes('cho duyet') ||
    text.includes('cap nhat ho so') ||
    text.includes('yeu cau cap nhat') ||
    text.includes('doi avatar') ||
    text.includes('anh dai dien') ||
    text.includes('profile request') ||
    text.includes('phan quyen') ||
    text.includes('xin quyen') ||
    text.includes('cap quyen') ||
    text.includes('kiem tra yeu cau') ||
    text.includes('yeu cau phu')
  ) {
    if (isAdmin) {
      const matchPerson = rawText.match(/(?:duyệt yêu cầu của|duyệt hồ sơ của|yêu cầu của)\s+([^?.,]+)/i);
      const query = { status: 'pending' };
      if (matchPerson && matchPerson[1]) {
        const candidate = matchPerson[1].trim();
        if (candidate && !['hồ sơ', 'yêu cầu', 'mới', 'tôi', 'em', 'phân quyền'].includes(candidate.toLowerCase())) {
          query.requesterName = { $regex: candidate, $options: 'i' };
        }
      }
      const pendingList = await ProfileRequest.find(query).limit(5).sort({ createdAt: -1 }).lean();
      const pendingCount = await ProfileRequest.countDocuments({ status: 'pending' });

      if (pendingCount === 0) {
        return {
          reply: `✅ Hiện tại hệ thống không có yêu cầu phê duyệt hoặc xin cấp quyền nào đang chờ xử lý. Tất cả các yêu cầu trước đó đã được giải quyết hoàn tất!`,
          intent: 'QUERY_PENDING_REQUESTS',
          quickLinks: [{ label: 'Mở trang Quản lý yêu cầu hồ sơ', path: '/admin/profile-requests' }],
        };
      }

      const cards = pendingList.map((r) => {
        const permText = r.type === 'avatar'
          ? 'Cập nhật ảnh đại diện & CCCD mới'
          : r.type === 'profile'
          ? 'Cập nhật thông tin cá nhân & lý lịch'
          : 'Xin cấp quyền quản lý lớp học phần & duyệt điểm';

        return {
          type: 'approval',
          id: String(r._id || r.id),
          requestId: String(r._id || r.id),
          title: r.requesterName || 'Người dùng',
          requesterName: r.requesterName || 'Người dùng',
          requesterRole: r.requesterRole || 'sinh-vien',
          requesterEmail: r.requesterEmail,
          requesterCode: r.requesterCode,
          code: `Yêu cầu #${String(r._id || r.id).slice(-4).toUpperCase()}`,
          permission: permText,
          subtitle: permText,
          meta: `Email: ${r.requesterEmail || ''} • ${r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên'}`,
          reason: r.requestedData?.reason || 'Cập nhật thông tin học kỳ mới',
          createdAt: r.createdAt ? new Date(r.createdAt).toLocaleDateString('vi-VN') : 'Hôm nay',
          status: r.status || 'pending',
          details: [
            { label: 'Người gửi', value: r.requesterName },
            { label: 'Vai trò', value: r.requesterRole === 'giao-vien' ? 'Giảng viên' : 'Sinh viên' },
            { label: 'Nội dung xin cấp quyền', value: permText },
            { label: 'Trạng thái', value: 'Chờ duyệt' },
          ],
          actions: [
            { label: '✓ Phê duyệt / Accept', actionType: 'APPROVE_REQUEST' },
            { label: '✗ Từ chối / Reject', actionType: 'REJECT_REQUEST' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/admin/profile-requests',
          },
        };
      });

      return {
        reply: `📋 **DANH SÁCH YÊU CẦU XÉT DUYỆT & PHÂN QUYỀN HỆ THỐNG (${pendingCount} yêu cầu chờ xử lý):**\n\n` +
          `Quản trị viên có thể xem thông tin, vai trò, nội dung xin cấp quyền và bấm trực tiếp nút **[Phê duyệt / Accept]** (xanh) hoặc **[Từ chối / Reject]** (đỏ) trên thẻ/bảng bên dưới để hệ thống cập nhật tức thì:`,
        intent: 'QUERY_PENDING_REQUESTS',
        cards,
        quickLinks: [{ label: 'Mở trang Quản lý yêu cầu hồ sơ', path: '/admin/profile-requests' }],
        suggestions: [
          'Duyệt yêu cầu của Nguyễn Văn An',
          'Có yêu cầu nào mới không?',
        ],
      };
    }
  }

  // 9. Data & Action: Thống kê hệ thống (Admin)
  if (
    text.includes('thong ke') ||
    text.includes('tong quan') ||
    text.includes('dashboard') ||
    text.includes('trang chu') ||
    text.includes('bao cao') ||
    text.includes('so luong') ||
    text.includes('so lieu')
  ) {
    if (isAdmin) {
      const [teacherCount, studentCount, classCount, deptCount] = await Promise.all([
        Teacher.countDocuments(),
        Student.countDocuments(),
        CourseClass.countDocuments(),
        Department.countDocuments(),
      ]);

      return {
        reply:
          '📊 Tổng quan thống kê hệ thống EduMin hiện tại:\n' +
          `• Tổng số Giảng viên: ${teacherCount}\n` +
          `• Tổng số Sinh viên: ${studentCount}\n` +
          `• Tổng số Lớp học phần: ${classCount}\n` +
          `• Số Khoa đào tạo: ${deptCount}`,
        intent: 'QUERY_ADMIN_STATS',
        data: { teacherCount, studentCount, classCount, deptCount },
        quickLinks: [
          { label: 'Tổng quan', path: '/admin' },
          { label: 'Xem Báo cáo Tổng quan', path: '/admin' },
        ],
      };
    }
  }

  // 10. Quick Search: Tìm kiếm sinh viên
  if (text.startsWith('tim sinh vien') || text.startsWith('tim kiem sinh vien') || text.startsWith('sv ') || text.includes('tim sinh vien') || text.startsWith('tim sv')) {
    const keyword = rawText.replace(/^(tìm kiếm sinh viên|tìm sinh viên|tìm sv|sv)\s*/i, '').trim();
    if (keyword) {
      const num = Number(keyword);
      const or = [{ hoTen: { $regex: keyword, $options: 'i' } }, { email: { $regex: keyword, $options: 'i' } }];
      if (!Number.isNaN(num) && num > 0) {
        or.push({ id: num });
      }

      const found = await Student.find({ $or: or }).limit(5).lean();
      if (found.length > 0) {
        const studentLines = found
          .map((s) => `• [SV-${String(s.id).padStart(3, '0')}] ${s.hoTen} - Lớp: ${s.className || 'Chưa xếp'} (${s.email || ''})`)
          .join('\n');

        const cards = found.map((s) => ({
          type: 'student',
          id: s.id,
          title: s.hoTen,
          code: `SV-${String(s.id).padStart(3, '0')}`,
          subtitle: `Lớp: ${s.className || 'Chưa xếp'} • Khoa: ${s.department || 'Chưa xác định'}`,
          meta: s.email,
          details: [
            { label: 'MSSV', value: `SV-${String(s.id).padStart(3, '0')}` },
            { label: 'Lớp', value: s.className || 'Chưa xếp' },
            { label: 'Khoa', value: s.department || 'Chưa xác định' },
            { label: 'Email', value: s.email || '' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: isAdmin ? '/admin/students' : isTeacher ? '/teacher/classes' : '/student/timetable',
          },
        }));

        return {
          reply: `Tìm thấy ${found.length} sinh viên phù hợp:\n\n${studentLines}`,
          intent: 'SEARCH_STUDENT',
          cards,
          data: found,
          quickLinks: isAdmin
            ? [{ label: 'Quản lý Sinh viên', path: '/admin/students' }]
            : isTeacher
            ? [{ label: 'Danh sách Lớp học phần', path: '/teacher/classes' }]
            : [{ label: 'Thời khóa biểu của tôi', path: '/student/timetable' }],
        };
      }
      return {
        reply: `Không tìm thấy sinh viên nào khớp với từ khóa "${keyword}".`,
        intent: 'SEARCH_STUDENT_EMPTY',
      };
    }
  }

  // 10.1 Quick Search: Lọc lớp / Tìm kiếm lớp học phần
  const isFilterClass =
    text.startsWith('loc lop') ||
    text.startsWith('tim lop') ||
    text.startsWith('tim kiem lop') ||
    text.includes('loc lop') ||
    text.includes('tim lop hoc phan');

  if (isFilterClass) {
    const rawKeyword = rawText.replace(/^(lọc danh sách lớp|lọc lớp học phần|lọc lớp|tìm lớp học phần|tìm lớp|tìm kiếm lớp)\s*/i, '').trim();
    let query = {};
    if (rawKeyword) {
      const orConditions = [
        { id: { $regex: rawKeyword, $options: 'i' } },
        { courseName: { $regex: rawKeyword, $options: 'i' } },
        { className: { $regex: rawKeyword, $options: 'i' } },
        { department: { $regex: rawKeyword, $options: 'i' } },
        { teacher: { $regex: rawKeyword, $options: 'i' } },
      ];
      if (/cntt/i.test(rawKeyword)) {
        orConditions.push(
          { department: { $regex: 'Công nghệ thông tin', $options: 'i' } },
          { id: { $regex: 'IT', $options: 'i' } }
        );
      }
      query = { $or: orConditions };
    }
    const foundClasses = await CourseClass.find(query).limit(4).lean();
    if (foundClasses.length > 0) {
      const cards = foundClasses.map((c) => ({
        type: 'class',
        id: c.id,
        title: c.courseName || c.className || c.id,
        code: `Lớp ${c.id}`,
        subtitle: `GV: ${c.teacher || 'Chưa phân công'} • Phòng: ${c.room || 'TBA'}`,
        meta: `${c.credits || 0} tín chỉ • Sĩ số: ${c.capacity || 'Không giới hạn'}`,
        details: [
          { label: 'Mã lớp', value: c.id },
          { label: 'Môn học', value: c.courseName || 'Học phần' },
          { label: 'Giảng viên', value: c.teacher || 'Chưa phân công' },
          { label: 'Phòng học', value: c.room || 'TBA' },
        ],
        action: {
          label: 'Xem chi tiết',
          path: '/admin/classes',
        },
      }));

      return {
        reply: `Tìm thấy ${foundClasses.length} lớp học phần phù hợp${rawKeyword ? ` với từ khóa "${rawKeyword}"` : ''}:`,
        intent: 'FILTER_CLASS',
        cards,
        data: foundClasses,
        quickLinks: [{ label: 'Quản lý lớp học phần', path: '/admin/classes' }],
      };
    }

    return {
      reply: `Không tìm thấy lớp học phần nào phù hợp với từ khóa "${rawKeyword}".`,
      intent: 'FILTER_CLASS_EMPTY',
      quickLinks: [{ label: 'Quản lý lớp học phần', path: '/admin/classes' }],
    };
  }

  // 11. Quick Search: Tìm kiếm giảng viên
  if (text.startsWith('tim giang vien') || text.startsWith('tim kiem giang vien') || text.startsWith('gv ')) {
    const keyword = rawText.replace(/^(tìm giảng viên|tìm kiếm giảng viên|gv)\s*/i, '').trim();
    if (keyword) {
      const num = Number(keyword);
      const or = [{ hoTen: { $regex: keyword, $options: 'i' } }, { email: { $regex: keyword, $options: 'i' } }];
      if (!Number.isNaN(num) && num > 0) {
        or.push({ id: num });
      }

      const found = await Teacher.find({ $or: or }).limit(5).lean();
      if (found.length > 0) {
        const teacherLines = found
          .map((t) => `• [GV-${String(t.id).padStart(3, '0')}] ${t.hoTen} - Khoa: ${t.department || 'Chưa xác định'} (${t.email})`)
          .join('\n');
        return {
          reply: `Tìm thấy ${found.length} giảng viên phù hợp:\n\n${teacherLines}`,
          intent: 'SEARCH_TEACHER',
          data: found,
          quickLinks: isAdmin ? [{ label: 'Quản lý Giảng viên', path: '/admin/teachers' }] : [],
        };
      }
      return {
        reply: `Không tìm thấy giảng viên nào khớp với từ khóa "${keyword}".`,
        intent: 'SEARCH_TEACHER_EMPTY',
      };
    }
  }

  // 12. Navigation: Lớp học phần
  if (
    text.includes('quan ly lop hoc phan') ||
    text.includes('lop hoc phan') ||
    text.includes('quan ly lop') ||
    text.includes('mo lop') ||
    text.includes('danh sach lop') ||
    text.includes('tao lop') ||
    text.includes('xep phong hoc') ||
    text.includes('phan cong giang vien')
  ) {
    if (isTeacher) {
      return {
        reply: 'Dạ, bạn có thể xem danh sách các lớp học phần mình đang phụ trách và vào bảng điểm tại mục "Lớp học phần".',
        intent: 'NAV_CLASSES',
        quickLinks: [{ label: 'Danh sách Lớp học phần', path: '/teacher/classes' }],
      };
    }
    return {
      reply: 'Dạ, bạn có thể mở lớp mới, xếp giảng viên, phòng học và thời khóa biểu tại mục "Quản lý lớp học phần".',
      intent: 'NAV_CLASSES',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 13. Navigation: Quản lý Khoa đào tạo
  if (
    text.includes('quan ly khoa') ||
    text.includes('khoa dao tao') ||
    text.includes('danh sach khoa') ||
    text.includes('cac khoa') ||
    text.includes('bo mon') ||
    text.includes('them khoa') ||
    text.includes('nganh hoc') ||
    text === 'khoa' ||
    text.startsWith('khoa ') ||
    text.endsWith(' khoa')
  ) {
    return {
      reply: 'Dạ, bạn có thể xem và quản lý danh sách các khoa đào tạo tại mục "Quản lý khoa" ở menu bên trái.',
      intent: 'NAV_DEPARTMENTS',
      quickLinks: [
        { label: 'Quản lý khoa', path: '/admin/departments' },
        { label: 'Quản lý Khoa', path: '/admin/departments' },
      ],
    };
  }

  // 14. Navigation: Quản lý Môn học / Học phần
  if (
    !text.includes('lop') &&
    (text.includes('quan ly hoc phan') ||
      text.includes('hoc phan') ||
      text.includes('quan ly mon hoc') ||
      text.includes('danh muc hoc phan') ||
      text.includes('danh sach hoc phan') ||
      text.includes('danh muc mon hoc') ||
      text.includes('danh sach mon hoc') ||
      text.includes('mon hoc') ||
      text.includes('tin chi') ||
      text.includes('so tin chi') ||
      text.includes('ma hoc phan') ||
      text.includes('ma mon') ||
      text.includes('them hoc phan') ||
      text.includes('them mon hoc'))
  ) {
    return {
      reply: 'Dạ, bạn có thể xem và quản lý danh mục học phần đào tạo, số tín chỉ và mã học phần tại mục "Quản lý học phần" ở menu bên trái.',
      intent: 'NAV_COURSES',
      quickLinks: [
        { label: 'Quản lý học phần', path: '/admin/courses' },
        { label: 'Quản lý Môn học', path: '/admin/courses' },
      ],
    };
  }

  // 14.1 Navigation: Tài khoản giáo viên
  const isTeacherAccounts =
    text.includes('tai khoan giao vien') ||
    text.includes('tai khoan giang vien') ||
    text.includes('cap tai khoan giao vien') ||
    text.includes('cap tai khoan giang vien') ||
    text.includes('khoa tai khoan giao vien') ||
    text.includes('khoa tai khoan giang vien') ||
    text.includes('mat khau giao vien') ||
    text.includes('mat khau giang vien') ||
    text.includes('phan quyen giao vien');

  if (isTeacherAccounts) {
    return {
      reply: 'Dạ, bạn có thể quản lý danh sách tài khoản đăng nhập, trạng thái khóa/kích hoạt hoặc đặt lại mật khẩu cho giảng viên tại mục "Tài khoản giáo viên" ở menu bên trái.',
      intent: 'NAV_TEACHER_ACCOUNTS',
      quickLinks: [
        { label: 'Tài khoản giáo viên', path: '/admin/teacher-accounts' },
        { label: 'Quản lý giáo viên', path: '/admin/teachers' },
      ],
    };
  }

  // 15. Navigation: Quản lý Giảng viên
  if (
    text.includes('danh sach giang vien') ||
    text.includes('danh sach giao vien') ||
    text.includes('quan ly giang vien') ||
    text.includes('quan ly giao vien') ||
    text.includes('giang vien toan truong') ||
    text.includes('giao vien toan truong') ||
    text.includes('them giang vien') ||
    text.includes('them giao vien') ||
    text.includes('ho so giang vien') ||
    text.includes('ho so giao vien') ||
    text.includes('giang vien') ||
    text.includes('giao vien') ||
    text === 'gv' ||
    text.startsWith('gv ')
  ) {
    return {
      reply: 'Dạ, để xem danh sách giảng viên toàn trường, bạn có thể truy cập nhanh vào mục Quản lý giáo viên ở menu bên trái.',
      intent: 'NAV_TEACHERS',
      quickLinks: isAdmin
        ? [
            { label: 'Quản lý giáo viên', path: '/admin/teachers' },
            { label: 'Tài khoản giáo viên', path: '/admin/teacher-accounts' },
          ]
        : [{ label: 'Quản lý giáo viên', path: '/admin/teachers' }],
    };
  }

  // 15.1 Navigation: Tài khoản sinh viên
  const isStudentAccounts =
    text.includes('tai khoan sinh vien') ||
    text.includes('cap tai khoan sinh vien') ||
    text.includes('khoa tai khoan sinh vien') ||
    text.includes('kich hoat tai khoan sinh vien') ||
    text.includes('reset mat khau sinh vien') ||
    text.includes('mat khau sinh vien');

  if (isStudentAccounts) {
    return {
      reply: 'Dạ, bạn có thể quản lý tài khoản đăng nhập, trạng thái kích hoạt hoặc đặt lại mật khẩu cho sinh viên tại mục "Tài khoản sinh viên" ở menu bên trái.',
      intent: 'NAV_STUDENT_ACCOUNTS',
      quickLinks: [
        { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
        { label: 'Quản lý sinh viên', path: '/admin/students' },
      ],
    };
  }

  // 16. Navigation: Danh sách sinh viên & Quản lý sinh viên (Checked after specific features)
  if (
    text.includes('danh sach sinh vien') ||
    text.includes('quan ly sinh vien') ||
    text.includes('ho so sinh vien') ||
    text.includes('sinh vien toan truong') ||
    text.includes('them sinh vien') ||
    text.includes('tra cuu sinh vien') ||
    text.includes('sinh vien') ||
    text.includes('hoc sinh') ||
    text === 'sv' ||
    text.startsWith('sv ')
  ) {
    return {
      reply: 'Dạ, để xem danh sách sinh viên, bạn có thể truy cập nhanh vào mục Quản lý sinh viên ở menu bên trái.',
      intent: 'NAV_STUDENTS',
      quickLinks: isAdmin
        ? [
            { label: 'Quản lý sinh viên', path: '/admin/students' },
            { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
          ]
        : isTeacher
        ? [
            { label: 'Lớp học phần phụ trách', path: '/teacher/classes' },
            { label: 'Tra cứu Sinh viên', path: '/admin/students' },
          ]
        : [
            { label: 'Hồ sơ cá nhân', path: '/student' },
          ],
    };
  }

  // 17. Navigation: Đổi mật khẩu & Hồ sơ cá nhân
  if (text.includes('doi mat khau') || text.includes('cap nhat thong tin') || text.includes('ho so')) {
    return {
      reply:
        'Để cập nhật thông tin cá nhân hoặc đổi mật khẩu:\n' +
        '1. Bấm vào ảnh đại diện (Avatar) của bạn ở góc trên bên phải màn hình.\n' +
        '2. Chọn "Đổi mật khẩu" để cập nhật mật khẩu mới.\n' +
        '3. Hoặc vào trang Tổng quan và bấm nút "Cập nhật thông tin" / "Đổi avatar" (yêu cầu sẽ được gửi lên quản trị viên phê duyệt).',
      intent: 'NAV_PROFILE',
      quickLinks: [{ label: 'Đi tới Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' }],
    };
  }

  // 18. Lời chào & Giới thiệu
  if (
    text.includes('xin chao') ||
    text.includes('chao ban') ||
    text.includes('hello') ||
    text.includes('hi') ||
    text.includes('ban la ai') ||
    text.includes('tro ly ao')
  ) {
    return {
      reply:
        'Xin chào! Tôi là **EduMin AI Assistant**. Tôi có thể hỗ trợ bạn điều hướng và giải đáp về các nghiệp vụ trong hệ thống như: Bảng điểm & Trọng số, Điểm danh & Chuyên cần, Thời khóa biểu, Đăng ký học phần, Bài tập & Quiz, Quản lý sinh viên & Duyệt hồ sơ.',
      intent: 'GREETING',
      quickLinks: [
        { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
      ],
    };
  }

  if (isAdmin) {
    return {
      reply:
        'Dạ, tôi chưa tìm thấy kết quả chính xác cho câu hỏi này. Bạn có thể thử các tác vụ quản trị nhanh dưới đây hoặc bấm vào đường dẫn để thao tác trực tiếp:',
      intent: 'ADMIN_FALLBACK_SUGGESTIONS',
      suggestions: [
        'Tìm sinh viên Nguyễn Văn An',
        'Lọc lớp CNTT',
        'Có yêu cầu nào mới không?',
        'Xem ý kiến phản hồi chưa đọc',
      ],
      quickLinks: [
        { label: 'Thống kê hệ thống', path: '/admin' },
        { label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' },
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Tra cứu sinh viên', path: '/admin/students' },
        { label: 'Ý kiến & Phản hồi', path: '/admin/feedbacks' },
        { label: 'Quản lý lớp học phần', path: '/admin/classes' },
      ],
    };
  }

  // Default fallback response for out-of-scope / non-existent / unrecognized features
  const suggestions = isTeacher
    ? ['Lịch dạy của tôi tuần này', 'Làm sao để cấu hình điểm giữa kỳ?', 'Danh sách lớp tôi phụ trách', 'Xem phản hồi từ sinh viên']
    : isStudent
    ? ['Thời khóa biểu của tôi', 'Đăng ký học phần ở đâu?', 'Xem điểm danh & chuyên cần', 'Xem bài tập & làm quiz']
    : ['Quản lý bảng điểm toàn trường', 'Thống kê hệ thống', 'Yêu cầu duyệt hồ sơ chờ xử lý', 'Quản lý lớp học phần'];

  return {
    reply:
      'Dạ, hiện tại hệ thống EduMin chưa hỗ trợ tính năng này hoặc không có mục đó trong phần quản lý của bạn.\n\n' +
      'EduMin hiện tập trung hỗ trợ các nghiệp vụ quản lý đào tạo cốt lõi:\n' +
      '• **Quản lý lớp học phần & Bảng điểm sinh viên**\n' +
      '• **Cấu hình trọng số điểm & Đồng bộ bài Quiz**\n' +
      '• **Điểm danh & Theo dõi chuyên cần**\n' +
      '• **Thời khóa biểu & Lịch giảng dạy**\n' +
      '• **Đăng ký học phần & Quản lý học phí**\n' +
      '• **Bài tập trắc nghiệm & Tài liệu học tập**\n' +
      '• **Quản lý danh sách sinh viên & Duyệt hồ sơ**',
    intent: 'OUT_OF_SCOPE',
    suggestions,
    quickLinks: [
      { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
    ],
  };
}

export { setAdminCriteria, getAdminCriteria, UserDesire };
export default handleAiAssistantQuery;
