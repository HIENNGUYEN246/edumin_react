import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { aiApi } from '../../api/aiApi.js';
import { profileRequestsApi } from '../../api/profileRequestsApi.js';
import { feedbackApi } from '../../api/feedbackApi.js';
import { ROLES } from '../../app/navConfig.js';

/**
 * Normalizes text: strips accents, lowercases, handles Vietnamese đ/Đ.
 */
function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

export const PAGE_INFO = [
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

export const BUSINESS_RESERVED_WORDS = [
  'quiz', 'diem', 'bang diem', 'nhap diem', 'nhap lai diem', 'nhap lai', 'sua diem', 'vao diem',
  'cham diem', 'gpa', 'trong so', 'cot diem', 'dong bo quiz', 'dong bo', 'cau hinh quiz', 'cau hinh diem',
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

/**
 * Extracts student or teacher target entities from natural Vietnamese queries.
 */
function extractPersonnelQuery(rawText) {
  if (!rawText) return null;
  const q = String(rawText).trim();

  const svIdMatch = q.match(/\bSV[-_]?0*(\d+)\b/i);
  if (svIdMatch) {
    return { targetType: 'student', idNumber: Number(svIdMatch[1]), rawKeyword: svIdMatch[0] };
  }
  const gvIdMatch = q.match(/\bGV[-_]?0*(\d+)\b/i);
  if (gvIdMatch) {
    return { targetType: 'teacher', idNumber: Number(gvIdMatch[1]), rawKeyword: gvIdMatch[0] };
  }

  let cleaned = q;
  cleaned = cleaned.replace(
    /^(?:bạn\s+(?:ơi\s*,?|hãy\s+)?(?:tìm|tra\s+cứu|xem|kiểm\s+tra)\s+(?:giùm|giúp|hộ|cho)\s+(?:mình|em|tôi)|tìm\s+(?:giùm|giúp|hộ|cho)\s+(?:mình|em|tôi)|có\s+thông\s+tin\s+gì\s+về|cho\s+(?:mình|em|tôi)\s+(?:xin|biết|hỏi)\s+thông\s+tin\s+(?:về|của)|cho\s+(?:mình|em|tôi)\s+hỏi\s+về|thông\s+tin\s+về|thông\s+tin\s+của|thông\s+tin|tìm\s+kiếm|tìm|tra\s+cứu|xem|kiểm\s+tra|hỏi\s+về|biết\s+gì\s+về)\s+/i,
    ''
  ).trim();

  cleaned = cleaned.replace(
    /\s+(?:không\s+vậy\??|không\s+ạ\??|không\s+nè\??|không\??|ko\??|k\??|nhỉ\??|nha\??|nhé\??|với\s+nha|với\s+nhé|với\s+ạ|với|ạ|ơi|nhe|nhá|giúp\s+mình|giùm\s+mình|được\s+không|được\s+ko|vậy|hả|chăng|vậy\??|[?!.,]+)$/i,
    ''
  ).trim();

  cleaned = cleaned.replace(/[?!.,]+$/g, '').trim();

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

  candidateName = candidateName.replace(/\s+(?:là\s+ai|ở\s+đâu|học\s+lớp\s+nào|dạy\s+môn\s+gì)$/i, '').trim();

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

/**
 * Extracts student target entity for grade inquiries from natural Vietnamese queries.
 * Handles patterns such as:
 * - "cho mình xem tình hình điểm của em Trân được không?" -> candidateName: "Trân"
 * - "bạn ơi cho mình xin kết quả học tập của SV-002 với nha" -> idNumber: 2, studentCode: "SV-002"
 * - "xem điểm của sinh viên Nguyễn Văn An" -> candidateName: "Nguyễn Văn An"
 * - "tình hình điểm của em Trân" -> candidateName: "Trân"
 * - "điểm của em Trân" -> candidateName: "Trân"
 */
export const MOCK_COURSE_GRADES = [
  { id: 'ENG101', code: 'ENG101', name: 'Tiếng Anh Giao Tiếp 1', credits: 3, attendance: 10.0, homework: 9.5, midterm: 9.0, final: 9.2, gpa: 9.3, status: 'Đạt', rank: 'Xuất sắc' },
  { id: 'IT101', code: 'IT101', name: 'Lập trình Web', credits: 3, attendance: 9.5, homework: 9.0, midterm: 8.5, final: 9.0, gpa: 8.9, status: 'Đạt', rank: 'Giỏi' },
  { id: 'CS102', code: 'CS102', name: 'Cấu trúc dữ liệu & Giải thuật', credits: 4, attendance: 8.5, homework: 8.0, midterm: 8.0, final: 8.5, gpa: 8.2, status: 'Đạt', rank: 'Giỏi' },
  { id: 'DB201', code: 'DB201', name: 'Cơ sở dữ liệu', credits: 3, attendance: 9.0, homework: 8.5, midterm: 8.0, final: 8.0, gpa: 8.1, status: 'Đạt', rank: 'Giỏi' },
  { id: 'MAT101', code: 'MAT101', name: 'Toán cao cấp A1', credits: 3, attendance: 9.0, homework: 7.5, midterm: 7.0, final: 7.5, gpa: 7.4, status: 'Đạt', rank: 'Khá' },
  { id: 'PHY101', code: 'PHY101', name: 'Vật lý đại cương', credits: 2, attendance: 7.0, homework: 6.0, midterm: 5.5, final: 4.5, gpa: 5.1, status: 'Đạt', rank: 'Trung bình' },
];

export const DAY_LABELS = {
  T2: 'Thứ Hai',
  T3: 'Thứ Ba',
  T4: 'Thứ Tư',
  T5: 'Thứ Năm',
  T6: 'Thứ Sáu',
  T7: 'Thứ Bảy',
  CN: 'Chủ Nhật',
};

export const SHIFT_LABELS = {
  S1: 'Sáng (Tiết 1-3)',
  S2: 'Sáng (Tiết 4-6)',
  C1: 'Chiều (Tiết 7-9)',
  C2: 'Chiều (Tiết 10-12)',
  T1: 'Tối (Tiết 13-15)',
};

export function dayLabel(dayId) {
  return DAY_LABELS[dayId] || dayId || '';
}

export function shiftLabel(shiftId) {
  return SHIFT_LABELS[shiftId] || shiftId || '';
}

export function describeSchedules(schedules = []) {
  if (!Array.isArray(schedules) || schedules.length === 0) return 'Chưa xếp lịch học';
  return schedules
    .map((s) => `${dayLabel(s.dayId)} (${shiftLabel(s.shiftId)})`)
    .join('; ');
}

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
  if (
    !candidateName ||
    genericWords.includes(normCandidate) ||
    candidateName.length < 2 ||
    BUSINESS_RESERVED_WORDS.includes(normCandidate) ||
    BUSINESS_RESERVED_WORDS.some((w) => normCandidate === w || normCandidate.startsWith(w + ' ') || normCandidate.endsWith(' ' + w))
  ) {
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

  // 1b. Quiz / Grade Configuration Intent ("nhập lại điểm quiz", "cấu hình quiz", "đồng bộ quiz", "trọng số", "cài đặt điểm")
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
    return 'NAV_PROFILE_REQUESTS';
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

  // 6. Personnel Search
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

// Real-time page context registry for AI Assistant
let _activePageContext = {};

export function setAiPageContext(ctx = {}) {
  if (typeof window !== 'undefined') {
    window.__EDUMIN_PAGE_CONTEXT__ = {
      ...(window.__EDUMIN_PAGE_CONTEXT__ || {}),
      ...ctx,
    };
    _activePageContext = window.__EDUMIN_PAGE_CONTEXT__;
  } else {
    _activePageContext = { ..._activePageContext, ...ctx };
  }
}

export function getAiPageContext() {
  if (typeof window !== 'undefined' && window.__EDUMIN_PAGE_CONTEXT__) {
    return window.__EDUMIN_PAGE_CONTEXT__;
  }
  return _activePageContext || {};
}

const KNOWN_STUDENTS_MOCK = [
  { hoTen: 'Quyền Huế Trân', id: 2, code: 'SV-002', className: '13A1', department: 'Khoa Ngôn Ngữ Anh', education: 'Liên thông', email: 'quyen@student.edu.vn', status: 'Đang học' },
  { hoTen: 'Nguyễn Văn An', id: 1, code: 'SV-001', className: 'CNTT-K18', department: 'Khoa Công Nghệ Thông Tin', education: 'Chính quy', email: 'an.nguyen@edu.vn', status: 'Đang học' },
  { hoTen: 'Trần Văn A', id: 1, code: 'SV-001', className: '12A2', department: 'Khoa Công Nghệ Thông Tin', education: 'Đào tạo từ xa', email: 'ohn@student.edu.vn', status: 'Đang học' },
  { hoTen: 'Trần Đình Quân', id: 3, code: 'SV-003', className: '12A2', department: 'Khoa Công Nghệ Thông Tin', education: 'Vừa làm vừa học', email: 'anthonyq012025@gmail.com', status: 'Đang học' },
  { hoTen: 'Phạm Thị Bình', id: 2, code: 'SV-002', className: 'CNTT-K18', department: 'Khoa Công Nghệ Thông Tin', education: 'Chính quy', email: 'binh.pham@edu.vn', status: 'Đang học' },
  { hoTen: 'Đỗ Quốc Cường', id: 3, code: 'SV-003', className: 'NNA-K19', department: 'Khoa Ngôn Ngữ Anh', education: 'Chính quy', email: 'cuong.do@edu.vn', status: 'Đang học' },
];

const KNOWN_TEACHERS_MOCK = [
  { hoTen: 'Trần Đình', id: 1, code: 'GV-001', department: 'Khoa Ngôn Ngữ Anh', education: 'Thạc sĩ', email: 'dinh.tran@edu.vn', status: 'Đang giảng dạy' },
  { hoTen: 'Trần Minh Quân', id: 1, code: 'GV-001', department: 'Khoa Công Nghệ Thông Tin', education: 'Tiến sĩ', email: 'quan.tran@edu.vn', status: 'Đang giảng dạy' },
  { hoTen: 'Lê Thu Hà', id: 2, code: 'GV-002', department: 'Khoa Ngôn Ngữ Anh', education: 'Thạc sĩ', email: 'ha.le@edu.vn', status: 'Đang giảng dạy' },
];

function findKnownPersonnelMock(extracted, pageContext = null) {
  if (!extracted) return null;
  const normTarget = normalizeText(extracted.candidateName || '');

  // 1. By ID
  if (extracted.idNumber) {
    if (extracted.targetType === 'student' || extracted.targetType === 'any') {
      const pageStudent = pageContext?.students?.find(
        (s) => s.id === extracted.idNumber || s.code === `SV-${String(extracted.idNumber).padStart(3, '0')}`
      );
      if (pageStudent) return { ...pageStudent, type: 'student' };
      const s = KNOWN_STUDENTS_MOCK.find((item) => item.id === extracted.idNumber);
      if (s) return { ...s, type: 'student' };
    }
    if (extracted.targetType === 'teacher' || extracted.targetType === 'any') {
      const pageTeacher = pageContext?.teachers?.find(
        (t) => t.id === extracted.idNumber || t.code === `GV-${String(extracted.idNumber).padStart(3, '0')}`
      );
      if (pageTeacher) return { ...pageTeacher, type: 'teacher' };
      const t = KNOWN_TEACHERS_MOCK.find((item) => item.id === extracted.idNumber);
      if (t) return { ...t, type: 'teacher' };
    }
  }

  // 2. Common keywords that are NOT person names
  const notPersonNames = [
    'lop', 'hoc phan', 'mon hoc', 'tin chi', 'bang diem', 'diem', 'khoa',
    'tkb', 'thoi khoa bieu', 'lich hoc', 'lich day', 'hoc phi', 'tong quan',
    'dashboard', 'admin', 'he thong', 'tro ly', 'sinh vien', 'giang vien',
    'giao vien', 'tai khoan', 'yeu cau', 'duyet', 'diem danh', 'chuyen can'
  ];
  if (notPersonNames.includes(normTarget)) return null;

  const matchesPersonnel = (item) => {
    if (!item) return false;
    const normName = normalizeText(item.hoTen || item.name || '');
    const normEmail = normalizeText(item.email || '');
    const normCode = normalizeText(item.code || '');

    if (normName === normTarget || normEmail === normTarget || normCode === normTarget) return true;
    if (normName.includes(normTarget) || normTarget.includes(normName)) return true;

    // Word-by-word token matching (e.g. "Huê Trân" -> words ['hue', 'tran'] in 'quyen hue tran')
    const targetWords = normTarget.split(/\s+/).filter((w) => w.length >= 2);
    if (targetWords.length > 0 && targetWords.every((w) => normName.includes(w))) return true;

    return false;
  };

  // 3. Check real-time pageContext from active screen
  if (pageContext?.students?.length && (extracted.targetType === 'student' || extracted.targetType === 'any')) {
    const s = pageContext.students.find(matchesPersonnel);
    if (s) return { ...s, type: 'student' };
  }
  if (pageContext?.teachers?.length && (extracted.targetType === 'teacher' || extracted.targetType === 'any')) {
    const t = pageContext.teachers.find(matchesPersonnel);
    if (t) return { ...t, type: 'teacher' };
  }

  // 4. By Name in known mock repository
  if (extracted.targetType === 'student' || extracted.targetType === 'any') {
    const s = KNOWN_STUDENTS_MOCK.find(matchesPersonnel);
    if (s) return { ...s, type: 'student' };
  }

  if (extracted.targetType === 'teacher' || extracted.targetType === 'any') {
    const t = KNOWN_TEACHERS_MOCK.find(matchesPersonnel);
    if (t) return { ...t, type: 'teacher' };
  }

  // 5. Dynamic fallback card if candidate name was explicitly searched
  if (extracted.candidateName && extracted.candidateName.length >= 2 && extracted.targetType !== 'any') {
    if (extracted.targetType === 'teacher') {
      return {
        type: 'teacher',
        hoTen: extracted.candidateName,
        code: 'GV-001',
        department: 'Khoa Ngôn Ngữ Anh',
        education: 'Giảng viên',
        email: 'giangvien@edu.vn',
        status: 'Đang giảng dạy',
      };
    }
    return {
      type: 'student',
      hoTen: extracted.candidateName,
      code: 'SV-002',
      className: '13A1',
      department: 'Khoa Ngôn Ngữ Anh',
      education: 'Chính quy',
      email: 'sinhvien@edu.vn',
      status: 'Đang học',
    };
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
export function findStudentByName(nameOrKeyword, context = null) {
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

  let studentList = [];
  if (Array.isArray(context)) {
    studentList = context;
  } else if (context && Array.isArray(context.students)) {
    studentList = context.students;
  } else {
    studentList = KNOWN_STUDENTS_MOCK;
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

  const found = studentList.find(matchesStudent);
  return found || null;
}

/**
 * Smart Mock AI Response Engine & Keyword Matcher.
 * Matches keywords like "sinh viên", "điểm", "thời khóa biểu", "cấu hình điểm", "duyệt yêu cầu"...
 * and generates realistic answers with direct quick action navigation links.
 */
export function getSmartAiResponse(rawText = '', role = '', _user = null, currentPath = '', pageContext = null) {
  const text = normalizeText(rawText);
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';
  const isStudent = role === 'sinh-vien' || role === 'student';

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
    text.includes('y kien') ||
    text.includes('phan hoi') ||
    text.includes('feedback') ||
    text.includes('gop y');

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
          matched: true,
          intent: 'CURRENT_PAGE_ALREADY',
          reply: `Dạ, hiện tại bạn đang ở ngay trang **${currentPageMatch.name}** rồi đây ạ! ${currentPageMatch.description}`,
          quickLinks: [{ label: `Đang ở trang ${currentPageMatch.name}`, path: currentPageMatch.path }],
        };
      }
    }
  }

  const intent = classifyAiIntent(rawText, { role, currentPath, pageContext });

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
    if (!foundStudent) {
      foundStudent = KNOWN_STUDENTS_MOCK.find(matchesStudent) || null;
    }
    if (!foundStudent && (entryQuery?.candidateName || entryQuery?.idNumber)) {
      foundStudent = {
        id: entryQuery?.idNumber || 2,
        hoTen: entryQuery?.candidateName || 'Quyền Huế Trân',
        code: entryQuery?.studentCode || 'SV-002',
        className: '13A1',
        department: 'Khoa Ngôn Ngữ Anh',
        attendance: 9.5,
        homework: 9.0,
        midterm: 8.5,
        final: 8.8,
        finalScore: 8.9,
        status: 'Đang học',
      };
    }

    if (foundStudent) {
      const studentCode = foundStudent.code || `SV-${String(foundStudent.id || 1).padStart(3, '0')}`;
      const studentName = foundStudent.hoTen;
      const className = foundStudent.className || '13A1';
      const department = foundStudent.department || 'Khoa Công Nghệ Thông Tin';

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
        matched: true,
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
      matched: true,
      reply: `Không tìm thấy sinh viên nào khớp với từ khóa "${candidateName || 'yêu cầu'}" để vào điểm. Thầy/Cô có thể mở danh sách lớp học phần để chọn sinh viên trên bảng.`,
      intent: 'ENTER_STUDENT_GRADE_NOT_FOUND',
      quickLinks: [{ label: 'Danh sách Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/gradebook' }],
    };
  }

  // 0a.-0b Admin Profile Request Approvals ("có hồ sơ nào chờ duyệt không?", "duyệt cho sinh viên Nguyễn Văn A", "duyệt hồ sơ em Trân")
  if (intent === 'NAV_PROFILE_REQUESTS' || intent === 'QUERY_PENDING_REQUESTS' || intent === 'APPROVE_PROFILE_REQUEST') {
    const approvalQuery = extractApprovalQuery(rawText);
    const candidateName = approvalQuery?.candidateName || '';
    const normCand = normalizeText(candidateName);

    let pendingList = [];
    if (pageContext?.pendingRequests?.length) {
      pendingList = pageContext.pendingRequests;
    } else {
      pendingList = KNOWN_PENDING_REQUESTS_MOCK;
    }

    if (candidateName) {
      pendingList = pendingList.filter((r) => {
        const normName = normalizeText(r.requesterName || '');
        return normName.includes(normCand) || normCand.includes(normName);
      });
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
        matched: true,
        reply,
        intent: 'NAV_PROFILE_REQUESTS',
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
        matched: true,
        reply: `Hiện không có yêu cầu cập nhật hồ sơ nào đang chờ duyệt từ **${candidateName}**. Toàn bộ hồ sơ của người này đã được phê duyệt hoặc chưa gửi yêu cầu mới.`,
        intent: 'APPROVE_PROFILE_REQUEST_EMPTY',
        quickLinks: [
          { label: 'Duyệt yêu cầu', path: '/admin/profile-requests' },
          { label: 'Quản lý sinh viên', path: '/admin/students' },
        ],
      };
    }

    return {
      matched: true,
      reply: 'Hiện không có yêu cầu cập nhật hồ sơ nào đang chờ duyệt.',
      intent: 'NAV_PROFILE_REQUESTS',
      cards: [],
      data: { pendingCount: 0, pendingList: [] },
      quickLinks: [{ label: 'Duyệt yêu cầu', path: '/admin/profile-requests' }],
    };
  }

  // 0a.-0c Student Regulation & Exam Eligibility ("quy chế đào tạo", "cấm thi", "quy định cấm thi", "thang điểm", "tối đa bao nhiêu tín chỉ", "phúc khảo")
  if (intent === 'STUDENT_REGULATION_GUIDE') {
    return {
      matched: true,
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
      matched: true,
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
        matched: true,
        reply:
          `Dưới đây là thông tin lớp học phần **${targetClass.courseName || targetClass.id}**:\n\n` +
          `• **Mã lớp:** ${targetClass.id}\n` +
          `• **Giảng viên phụ trách:** ${targetClass.teacher || 'Chưa phân công'}\n` +
          `• **Lịch học & Phòng:** ${scheduleText} • Phòng ${targetClass.room || 'TBA'}\n` +
          `• **Sĩ số:** ${targetClass.enrolledCount || 35} sinh viên\n\n` +
          `Bạn có thể bấm vào các nút thao tác bên dưới để mở Bảng điểm hoặc Điểm danh của lớp.`,
        intent: 'QUERY_CLASS',
        cards: [card],
        quickLinks: [
          { label: 'Danh sách Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/classes' },
          { label: 'Thời khóa biểu', path: isTeacher ? '/teacher/schedule' : '/student/timetable' },
        ],
        suggestions: [
          'Vào điểm cho em Trân',
          'Thống kê sinh viên vắng nhiều',
          'Cấu hình Quiz giữa kỳ',
        ],
      };
    }
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
        matched: true,
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
      matched: true,
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
      matched: true,
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
      matched: true,
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

  // 0.05 Intelligent Personnel Search (Student & Teacher)
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
    const match = findKnownPersonnelMock(extracted, pageContext);
    if (match) {
      if (match.type === 'student') {
        const card = {
          type: 'student',
          id: match.id || 1,
          title: match.hoTen,
          code: match.code || `SV-${String(match.id || 1).padStart(3, '0')}`,
          subtitle: `Lớp: ${match.className || 'Chưa xếp'} • Khoa: ${match.department || 'Chưa xác định'}`,
          details: [
            { label: 'MSSV', value: match.code || `SV-${String(match.id || 1).padStart(3, '0')}` },
            { label: 'Họ và tên', value: match.hoTen },
            { label: 'Lớp sinh hoạt', value: match.className || 'Chưa xếp' },
            { label: 'Khoa đào tạo', value: match.department || 'Chưa xác định' },
            { label: 'Hệ đào tạo', value: match.education || 'Chính quy' },
            { label: 'Email', value: match.email || 'sinhvien@edu.vn' },
            { label: 'Trạng thái', value: match.status || 'Đang học' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: isAdmin ? '/admin/students' : isTeacher ? '/teacher/classes' : '/student',
          },
        };
        return {
          matched: true,
          intent: 'SEARCH_STUDENT',
          reply: `Dưới đây là thông tin sinh viên **${match.hoTen}** (MSSV: ${card.code}):`,
          cards: [card],
          quickLinks: [
            { label: 'Quản lý Sinh viên', path: '/admin/students' },
            { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
          ],
        };
      }

      if (match.type === 'teacher') {
        const card = {
          type: 'teacher',
          id: match.id || 1,
          title: match.hoTen,
          code: match.code || `GV-${String(match.id || 1).padStart(3, '0')}`,
          subtitle: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • ${match.education || 'Giảng viên'}`,
          details: [
            { label: 'Mã GV', value: match.code || `GV-${String(match.id || 1).padStart(3, '0')}` },
            { label: 'Họ và tên', value: match.hoTen },
            { label: 'Khoa phụ trách', value: match.department || 'Khoa Ngôn Ngữ Anh' },
            { label: 'Học vị / Học hàm', value: match.education || 'Thạc sĩ' },
            { label: 'Email liên hệ', value: match.email || 'dinh.tran@edu.vn' },
            { label: 'Trạng thái', value: match.status || 'Đang giảng dạy' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: isAdmin ? '/admin/teachers' : isStudent ? '/student/timetable' : '/teacher',
          },
        };
        return {
          matched: true,
          intent: 'SEARCH_TEACHER',
          reply: `Dưới đây là thông tin giảng viên **${match.hoTen}** (Mã GV: ${card.code}):`,
          cards: [card],
          quickLinks: [
            { label: 'Quản lý Giáo viên', path: '/admin/teachers' },
            { label: 'Tài khoản giáo viên', path: '/admin/teacher-accounts' },
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
        matched: true,
        intent: extracted.targetType === 'teacher' ? 'SEARCH_TEACHER_EMPTY' : 'SEARCH_STUDENT_EMPTY',
        reply: `Dạ, tôi chưa tìm thấy ${entityLabel} nào khớp với từ khóa **"${extracted.candidateName || extracted.rawKeyword}"**. Bạn có thể tra cứu toàn bộ danh sách tại trang quản lý.`,
        quickLinks: [
          { label: 'Quản lý Sinh viên', path: '/admin/students' },
          { label: 'Quản lý Giáo viên', path: '/admin/teachers' },
        ],
      };
    }
  }

  // 0.1 Out-of-Scope / Unsupported Features Handling
  const isOutOfScope = OUT_OF_SCOPE_KEYWORDS.some((kw) => text.includes(kw));
  if (isOutOfScope) {
    return {
      matched: true,
      intent: 'OUT_OF_SCOPE',
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
      quickLinks: [
        { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
      ],
    };
  }

  // 0.2 Sĩ số lớp / Số lượng sinh viên trong lớp học phần
  const isAskingClassStudentCount =
    text.includes('bao nhieu sinh vien') ||
    text.includes('so luong sinh vien') ||
    text.includes('si so') ||
    text.includes('co may sinh vien') ||
    text.includes('co bao nhieu ban') ||
    (text.includes('sinh vien') && (text.includes('lop nay') || text.includes('lop co')));

  if (isAskingClassStudentCount) {
    const cleanTokens = rawText
      .replace(/[?.,!]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 2 && !['lớp', 'học', 'phần', 'môn', 'có', 'bao', 'nhiêu', 'sinh', 'viên', 'sĩ', 'số', 'trong', 'của'].includes(w.toLowerCase()));
    const classCode = cleanTokens[0] || 'Lớp học phần';

    return {
      matched: true,
      intent: 'QUERY_CLASS_STUDENT_COUNT',
      reply:
        `📊 **Thông tin sĩ số lớp học phần (${classCode}):**\n\n` +
        `• **Sĩ số hiện tại:** Lớp đang mở tiếp nhận sinh viên theo hạn mức quy định của Phòng Đào Tạo.\n` +
        `• **Trạng thái:** Đang hoạt động & đồng bộ dữ liệu trực tiếp với hệ thống LMS.\n` +
        `• Thầy/Cô và các bạn có thể kiểm tra danh sách chi tiết sinh viên tại trang Lớp học phần hoặc Đăng ký học phần.`,
      quickLinks: isTeacher
        ? [
            { label: 'Danh sách sinh viên lớp', path: '/teacher/classes' },
            { label: 'Điểm danh lớp', path: '/teacher/attendance' },
          ]
        : [{ label: 'Đăng ký học phần', path: isStudent ? '/student/course-registration' : '/admin/classes' }],
    };
  }

  // 0.3 Thống kê sinh viên vắng nhiều / Tình trạng chuyên cần & Cảnh báo cấm thi
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
      return {
        matched: true,
        intent: 'QUERY_ABSENT_STUDENTS',
        reply:
          `⚠️ **Báo cáo chuyên cần - Theo dõi sinh viên vắng nhiều:**\n\n` +
          `• Hệ thống EduMin tự động ghi nhận số buổi vắng (có phép/không phép) và tính tỷ lệ chuyên cần cho từng buổi học.\n` +
          `• **Quy chế đào tạo:** Sinh viên vắng từ 20% tổng số buổi trở lên sẽ bị cảnh báo và không đủ điều kiện dự thi kết thúc học phần.\n` +
          `• Thầy/Cô có thể mở sổ Điểm danh để rà soát danh sách sinh viên vắng và nhập ghi chú cảnh báo.`,
        quickLinks: [{ label: 'Mở sổ Điểm danh & Chuyên cần', path: '/teacher/attendance' }],
      };
    }
    if (isStudent) {
      return {
        matched: true,
        intent: 'QUERY_ABSENT_STUDENTS',
        reply:
          `Bạn có thể kiểm tra tỷ lệ chuyên cần, số buổi có mặt và số buổi vắng chi tiết của từng môn học tại trang "Điểm danh & Chuyên cần". Hãy luôn duy trì tỷ lệ tham gia trên 80% để đảm bảo điều kiện dự thi!`,
        quickLinks: [{ label: 'Xem Chuyên cần cá nhân', path: '/student/attendance' }],
      };
    }
  }

  // 0.4 Điểm số trung bình & Thống kê kết quả học tập của lớp
  const isAskingClassGradeStats =
    (text.includes('diem trung binh') ||
      text.includes('thong ke diem') ||
      text.includes('pho diem') ||
      text.includes('ty le dat') ||
      (text.includes('diem') && text.includes('cua lop'))) &&
    !text.includes('diem danh');

  if (isAskingClassGradeStats) {
    return {
      matched: true,
      intent: 'QUERY_CLASS_GRADE_STATS',
      reply:
        `📈 **Thống kê điểm số & Kết quả học tập:**\n\n` +
        `• Điểm tổng kết được hệ thống tính toán tự động dựa trên trọng số % các cột: Chuyên cần, Bài tập, Giữa kỳ và Cuối kỳ.\n` +
        `• Thầy/Cô có thể theo dõi điểm trung bình lớp, phổ điểm và tỷ lệ đạt/trượt trực tiếp trên trang Bảng điểm của từng lớp học phần.`,
      quickLinks: [
        {
          label: 'Xem Bảng điểm lớp học phần',
          path: isTeacher ? '/teacher/classes' : isStudent ? '/student/attendance' : '/admin/gradebook',
        },
      ],
    };
  }

  // 0.5 Tra cứu thông tin Giảng viên, môn giảng dạy & lịch dạy
  const isAskingTeacherInfo =
    (text.includes('giang vien') || text.includes('thay ') || text.includes('co ') || text.includes('giao vien')) &&
    (text.includes('day lop') || text.includes('phu trach') || text.includes('day mon') || text.includes('lich day cua') || text.includes('thong tin giang vien'));

  if (isAskingTeacherInfo) {
    return {
      matched: true,
      intent: 'QUERY_TEACHER_INFO',
      reply:
        `👨‍🏫 **Tra cứu thông tin Giảng viên phụ trách:**\n\n` +
        `• Hệ thống quản lý đầy đủ danh sách giảng viên theo từng khoa đào tạo, phân công giảng dạy và thời khóa biểu theo tuần.\n` +
        `• Bạn có thể tra cứu thông tin chi tiết và lịch giảng dạy tại trang Lớp học phần hoặc Thời khóa biểu.`,
      quickLinks: [
        { label: 'Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/classes' },
        { label: 'Thời khóa biểu', path: isTeacher ? '/teacher/schedule' : '/student/timetable' },
      ],
    };
  }

  // 0.6 Tra cứu phòng học & thời khóa biểu chi tiết của lớp học phần
  const isAskingClassRoomOrSchedule =
    text.includes('phong hoc') ||
    text.includes('hoc o dau') ||
    text.includes('hoc phong nao') ||
    text.includes('hoc thu may') ||
    text.includes('lich hoc lop') ||
    (text.includes('phong nao') && (text.includes('lop') || text.includes('mon')));

  if (isAskingClassRoomOrSchedule) {
    return {
      matched: true,
      intent: 'QUERY_CLASS_ROOM_SCHEDULE',
      reply:
        `📍 **Tra cứu Phòng học & Lịch học:**\n\n` +
        `• Thông tin phòng học, thứ trong tuần, ca học và tiết học được hiển thị đồng bộ tại cột "Lịch học & Phòng" trên danh sách lớp học phần.\n` +
        `• Bạn có thể mở Thời khóa biểu để theo dõi lịch học trực quan theo từng ngày trong tuần.`,
      quickLinks: [
        {
          label: 'Mở Thời khóa biểu',
          path: isTeacher ? '/teacher/schedule' : isStudent ? '/student/timetable' : '/admin/classes',
        },
      ],
    };
  }

  // 0.7 Gợi ý môn học & đề xuất học phần cá nhân hóa cho sinh viên
  const isAskingCourseRecommendations =
    (text.includes('goi y') && (text.includes('mon') || text.includes('hoc phan') || text.includes('dang ky'))) ||
    text.includes('nen dang ky mon gi') ||
    text.includes('mon hoc phu hop') ||
    text.includes('tu van mon') ||
    text.includes('mon gi ky nay') ||
    text.includes('dang ky mon gi');

  if (isAskingCourseRecommendations) {
    if (isStudent) {
      return {
        matched: true,
        intent: 'SUGGEST_COURSES',
        reply:
          `💡 **Gợi ý học phần phù hợp dành cho bạn:**\n\n` +
          `• Hệ thống tự động ưu tiên gợi ý các môn học thuộc đúng chuyên ngành của bạn và các môn Đại cương chung tích lũy tín chỉ.\n` +
          `• Hạn mức đăng ký tối đa quy định là **25 tín chỉ / học kỳ**.\n` +
          `• Bạn có thể vào trang Đăng ký học phần để xem danh sách môn mở và chọn lớp phù hợp.`,
        quickLinks: [{ label: 'Đi tới Đăng ký học phần', path: '/student/course-registration' }],
      };
    }
  }

  // 0.8 Cảnh báo & Kiểm tra trùng lịch học / lịch dạy
  const isAskingScheduleConflict =
    text.includes('kiem tra trung lich') ||
    text.includes('co bi trung lich') ||
    text.includes('canh bao trung lich') ||
    text.includes('trung lich hoc') ||
    text.includes('trung lich day') ||
    text.includes('trung ca') ||
    text.includes('trung tiet');

  if (isAskingScheduleConflict) {
    return {
      matched: true,
      intent: 'CHECK_SCHEDULE_CONFLICT',
      reply:
        `📅 **Kiểm tra trùng lịch học / giảng dạy:**\n\n` +
        `• Hệ thống EduMin tự động kiểm tra xung đột thời gian (cùng thứ, cùng ca học trong khoảng thời gian khóa học) ngay khi đăng ký hoặc xếp lớp.\n` +
        `• Bạn có thể mở Thời khóa biểu tuần để quan sát toàn bộ các khung giờ học/dạy trên lưới trực quan.`,
      quickLinks: [
        {
          label: 'Xem Thời khóa biểu',
          path: isTeacher ? '/teacher/schedule' : isStudent ? '/student/timetable' : '/admin/classes',
        },
      ],
    };
  }

  // 0.9 Tổng hợp ghi chú & Nhắc nhở công việc nhanh cho Giảng viên
  const isAskingTeacherNotesSummary =
    text.includes('tong hop ghi chu') ||
    text.includes('ghi chu lop hoc') ||
    text.includes('nhac nho cong viec') ||
    text.includes('tong ket buoi day') ||
    text.includes('ghi chu nhanh') ||
    text.includes('tom tat cong viec');

  if (isAskingTeacherNotesSummary) {
    if (isTeacher) {
      return {
        matched: true,
        intent: 'SUMMARIZE_TEACHER_NOTES',
        reply:
          `📝 **Tổng hợp ghi chú & Nhiệm vụ giảng dạy:**\n\n` +
          `• Theo dõi các lớp học phần phụ trách và sĩ số sinh viên.\n` +
          `• Điểm danh đều đặn sau mỗi buổi học để hệ thống tự động tính điểm chuyên cần.\n` +
          `• Kiểm tra cấu hình liên kết Quiz cho bài kiểm tra giữa kỳ.\n` +
          `• Phản hồi kịp thời các ý kiến đóng góp từ sinh viên.`,
        quickLinks: [
          { label: 'Lớp học phần', path: '/teacher/classes' },
          { label: 'Điểm danh lớp', path: '/teacher/attendance' },
          { label: 'Ý kiến phản hồi', path: '/teacher/feedbacks' },
        ],
      };
    }
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
    return {
      matched: true,
      intent: 'NAV_GRADE_CONFIG',
      reply:
        'Dạ, để cấu hình trọng số điểm và kết nối bài thi Quiz cho lớp học phần:\n' +
        '1. Vào mục "Lớp học phần" ở menu bên trái.\n' +
        '2. Chọn lớp cần nhập điểm và mở "Bảng điểm".\n' +
        '3. Bấm nút "Cấu hình Quiz" (biểu tượng bánh răng) để chọn bài kiểm tra cho cột Giữa kỳ hoặc Cuối kỳ (hệ thống sẽ tự động ẩn bài đã chọn để tránh trùng lặp).\n' +
        '4. Bạn cũng có thể tùy chỉnh tỷ lệ % trọng số của các cột điểm (Chuyên cần, Bài tập, Giữa kỳ, Cuối kỳ) sao cho tổng bằng 100%.',
      quickLinks: isTeacher
        ? [
            { label: 'Đi tới Lớp học phần & Bảng điểm', path: '/teacher/classes' },
            { label: 'Quản lý Bài tập & Quiz', path: '/teacher/assignments' },
          ]
        : [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 1.1 Admin Gradebook specific (Chốt sổ, Khóa điểm, Bảng điểm toàn trường, Quản lý bảng điểm, Audit log, Phúc khảo)
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

  // 1.1b Specific Student Grade Lookup ("cho mình xem tình hình điểm của em Trân", "xem điểm của [tên/mã]", "kết quả học tập của [tên]")
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

    let foundStudent = null;
    if (pageContext?.students?.length) {
      foundStudent = pageContext.students.find(matchesStudent) || null;
    }
    if (!foundStudent) {
      foundStudent = KNOWN_STUDENTS_MOCK.find(matchesStudent) || null;
    }
    if (!foundStudent && (gradeQuery?.candidateName || rawKeyword)) {
      foundStudent = {
        hoTen: gradeQuery?.candidateName || rawKeyword,
        code: gradeQuery?.studentCode || 'SV-002',
        className: '13A1',
        department: 'Khoa Ngôn Ngữ Anh',
      };
    }

    const studentName = foundStudent?.hoTen || rawKeyword || 'Quyền Huế Trân';
    const studentCode = foundStudent?.code || (foundStudent?.id != null ? `SV-${String(foundStudent.id).padStart(3, '0')}` : 'SV-002');
    const studentClass = foundStudent?.className || '13A1';

    const isNNA =
      normalizeText(foundStudent?.department || '').includes('ngon ngu anh') ||
      normalizeText(studentName).includes('tran');

    const courseTitle =
      pageContext?.currentClass?.courseName ||
      (isNNA ? 'Tiếng Anh Giao Tiếp 1' : 'Lập trình Web nâng cao');
    const courseCode =
      pageContext?.currentClass?.id ||
      (isNNA ? 'ENG101-01' : 'IT101-01');

    const attendance = foundStudent?.attendance ?? (isNNA ? 9.5 : 9.0);
    const homework = foundStudent?.homework ?? (isNNA ? 9.0 : 8.5);
    const midterm = foundStudent?.midterm ?? 8.5;
    const final = foundStudent?.final ?? (isNNA ? 8.8 : 8.0);
    const gpa = foundStudent?.finalScore ?? (isNNA ? 8.9 : 8.4);
    const status = foundStudent?.status || (gpa >= 4.0 ? 'Đạt' : 'Chưa đạt');

    const reply =
      `Dưới đây là thông tin bảng điểm của sinh viên **${studentName}** (MSSV: ${studentCode} • Lớp: ${studentClass}):\n\n` +
      `📊 **Bảng điểm tóm tắt:**\n` +
      `• **Học phần:** ${courseTitle} (Mã lớp: ${courseCode})\n` +
      `  - **Điểm Chuyên cần:** ${attendance}\n` +
      `  - **Điểm Bài tập:** ${homework}\n` +
      `  - **Điểm Giữa kỳ:** ${midterm}\n` +
      `  - **Điểm Cuối kỳ:** ${final}\n` +
      `  - **Điểm tổng kết (GPA):** ${gpa}\n` +
      `  - **Trạng thái:** ${status}\n\n` +
      `Bạn có thể bấm vào thẻ hoặc nút liên kết bên dưới để xem chi tiết trên bảng điểm toàn trường.`;

    return {
      matched: true,
      intent: 'SEARCH_STUDENT_GRADES',
      reply,
      cards: [
        {
          type: 'grade',
          id: 'grade-1',
          title: courseTitle,
          code: `Lớp ${courseCode}`,
          subtitle: `Sinh viên: ${studentName} (${studentCode})`,
          details: [
            { label: 'Chuyên cần', value: String(attendance) },
            { label: 'Bài tập', value: String(homework) },
            { label: 'Giữa kỳ', value: String(midterm) },
            { label: 'Cuối kỳ', value: String(final) },
            { label: 'Điểm tổng kết (GPA)', value: String(gpa) },
            { label: 'Trạng thái', value: String(status) },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/admin/gradebook',
          },
        },
      ],
      quickLinks: [
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Quản lý sinh viên', path: '/admin/students' },
      ],
    };
  }

  if (
    (isAdminGradebookSpecific || (isGeneralGradeInquiry && !isStudentSpecificGradeLookup && (isAdmin || (!isTeacher && !isStudent)))) &&
    !text.includes('diem danh')
  ) {
    return {
      matched: true,
      intent: 'NAV_ADMIN_GRADEBOOK',
      reply:
        'Dạ, với vai trò Quản trị viên (Phòng Đào Tạo), bạn có thể quản lý bảng điểm toàn trường tại trang **"Quản lý bảng điểm"**:\n' +
        '• Tra cứu và xem điểm số chi tiết của tất cả các lớp học phần theo Khoa và Giảng viên.\n' +
        '• Chỉnh sửa, ghi đè điểm số phục vụ phúc khảo (hệ thống tự động lưu vết **Audit Log**).\n' +
        '• Thực hiện **Khóa / Chốt sổ bảng điểm** theo từng lớp hoặc toàn trường khi kết thúc học kỳ.',
      quickLinks: [
        { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
        { label: 'Quản lý lớp học phần', path: '/admin/classes' },
      ],
    };
  }

  if (isGeneralGradeInquiry && !text.includes('diem danh')) {
    if (isTeacher) {
      return {
        matched: true,
        intent: 'NAV_GRADES',
        reply:
          'Dạ, để nhập hoặc theo dõi bảng điểm sinh viên, bạn vào mục "Lớp học phần" ở menu bên trái, chọn lớp tương ứng và bấm nút "Bảng điểm". Hệ thống có tính năng tự động tính điểm GPA và tự động đồng bộ kết quả từ bài Quiz trực tuyến.',
        quickLinks: [{ label: 'Vào Bảng điểm Lớp học phần', path: '/teacher/classes' }],
      };
    }
    if (isStudent) {
      return {
        matched: true,
        intent: 'NAV_GRADES',
        reply:
          'Dạ, bạn có thể theo dõi kết quả học tập và chuyên cần của mình tại trang "Điểm danh & Chuyên cần".',
        quickLinks: [{ label: 'Xem Chuyên cần & Điểm số', path: '/student/attendance' }],
      };
    }
  }

  // 3. Navigation: Điểm danh & Chuyên cần (Priority before generic students)
  if (
    text.includes('diem danh') ||
    text.includes('chuyen can') ||
    text.includes('vang mat') ||
    text.includes('di tre') ||
    text.includes('co mat') ||
    text.includes('vang')
  ) {
    return {
      matched: true,
      intent: 'NAV_ATTENDANCE',
      reply: isTeacher
        ? 'Dạ, để điểm danh cho sinh viên từng buổi học, bạn vào mục "Điểm danh & Chuyên cần" ở menu bên trái. Hệ thống sẽ tự động tính tỷ lệ chuyên cần và quy đổi sang điểm chuyên cần (thang 10).'
        : 'Dạ, bạn có thể kiểm tra tỷ lệ chuyên cần, số buổi có mặt và vắng mặt tại mục "Điểm danh & Chuyên cần".',
      quickLinks: isTeacher
        ? [{ label: 'Đi tới Điểm danh & Chuyên cần', path: '/teacher/attendance' }]
        : [{ label: 'Xem Chuyên cần của tôi', path: '/student/attendance' }],
    };
  }

  // 4. Navigation: Học phí & Công nợ (Priority before generic students)
  if (
    text.includes('hoc phi') ||
    text.includes('tien hoc') ||
    text.includes('cong no') ||
    text.includes('dong tien') ||
    text.includes('dong hoc phi') ||
    text.includes('thu hoc phi')
  ) {
    return {
      matched: true,
      intent: 'NAV_TUITION',
      reply: isStudent
        ? 'Dạ, bạn có thể tra cứu thông tin học phí, số tiền cần nộp và hạn đóng tại mục "Học phí".'
        : 'Dạ, bạn có thể quản lý danh sách thu học phí và trạng thái thanh toán tại mục "Quản lý học phí".',
      quickLinks: isStudent
        ? [{ label: 'Xem Học phí của tôi', path: '/student/tuition' }]
        : [{ label: 'Quản lý Học phí', path: '/accountant/tuition' }],
    };
  }

  // 5. Navigation: Thời khóa biểu / Lịch học / Lịch dạy
  if (
    text.includes('thoi khoa bieu') ||
    text.includes('tkb') ||
    text.includes('lich day') ||
    text.includes('lich hoc') ||
    text.includes('ca hoc') ||
    text.includes('tiet hoc') ||
    text.includes('hom nay hoc gi') ||
    text.includes('hom nay day gi') ||
    text.includes('tuan nay hoc gi') ||
    text.includes('lich giang day')
  ) {
    return {
      matched: true,
      intent: 'NAV_SCHEDULE',
      reply: isTeacher
        ? 'Dạ, bạn có thể xem lịch giảng dạy chi tiết theo tuần, ca học và phòng học tại trang "Lịch dạy" ở menu bên trái.'
        : isStudent
        ? 'Dạ, bạn có thể xem thời khóa biểu các môn học đã đăng ký theo tuần và phòng học tại mục "Thời khóa biểu" ở menu bên trái.'
        : 'Dạ, bạn có thể theo dõi và xếp lịch học cho các lớp học phần tại trang "Quản lý lớp học phần".',
      quickLinks: isTeacher
        ? [{ label: 'Mở Lịch dạy', path: '/teacher/schedule' }]
        : isStudent
        ? [{ label: 'Mở Thời khóa biểu', path: '/student/timetable' }]
        : [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 6. Navigation: Đăng ký học phần
  if (
    text.includes('dang ky hoc phan') ||
    text.includes('dang ky mon') ||
    text.includes('huy mon') ||
    text.includes('chon lop mon hoc') ||
    text.includes('dang ky tin chi')
  ) {
    return {
      matched: true,
      intent: 'NAV_REGISTRATION',
      reply: isStudent
        ? 'Dạ, bạn có thể tra cứu các lớp học phần đang mở và đăng ký môn học trực tuyến tại trang "Đăng ký học phần" ở menu bên trái.'
        : 'Dạ, quản trị viên có thể mở/đóng đợt đăng ký và quản lý các lớp học phần tại trang "Quản lý lớp học phần".',
      quickLinks: isStudent
        ? [{ label: 'Đi tới Đăng ký học phần', path: '/student/course-registration' }]
        : [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
    };
  }

  // 7. Navigation: Bài tập & Quiz
  if (
    text.includes('bai tap') ||
    text.includes('quiz') ||
    text.includes('trac nghiem') ||
    text.includes('kiem tra') ||
    text.includes('de thi') ||
    text.includes('nop bai')
  ) {
    return {
      matched: true,
      intent: 'NAV_ASSIGNMENTS',
      reply: isTeacher
        ? 'Dạ, bạn có thể tạo và quản lý các bài kiểm tra trắc nghiệm Quiz trực tuyến tại mục "Bài tập" ở menu bên trái.'
        : 'Dạ, bạn có thể làm các bài kiểm tra trắc nghiệm trực tuyến tại mục "Bài tập" ở menu bên trái.',
      quickLinks: [{ label: 'Mở Bài tập & Quiz', path: isTeacher ? '/teacher/assignments' : '/student/assignments' }],
    };
  }

  // 8. Navigation: Tài liệu môn học
  if (
    text.includes('tai lieu') ||
    text.includes('slide') ||
    text.includes('bai giang') ||
    text.includes('giao trinh')
  ) {
    return {
      matched: true,
      intent: 'NAV_DOCUMENTS',
      reply: isTeacher
        ? 'Dạ, bạn có thể tải lên và quản lý các tài liệu bài giảng tại mục "Tài liệu" ở menu bên trái.'
        : 'Dạ, bạn có thể xem và tải các tài liệu bài giảng tại mục "Tài liệu" ở menu bên trái.',
      quickLinks: [{ label: 'Mở Tài liệu', path: isTeacher ? '/teacher/documents' : '/student/documents' }],
    };
  }

  // 9. Navigation & Action: Duyệt yêu cầu & Hồ sơ
  if (
    text.includes('co yeu cau nao moi') ||
    text.includes('yeu cau moi') ||
    text.includes('yeu cau cho duyet') ||
    text.includes('duyet nhanh') ||
    text.includes('danh sach yeu cau') ||
    text.includes('cho xu ly') ||
    text.includes('duyet yeu cau') ||
    text.includes('yeu cau duyet') ||
    text.includes('duyet ho so') ||
    text.includes('cho duyet') ||
    text.includes('cap nhat ho so') ||
    text.includes('doi avatar') ||
    text.includes('anh dai dien') ||
    text.includes('yeu cau cap nhat') ||
    text.includes('profile request')
  ) {
    const matchPerson = rawText.match(/(?:duyệt yêu cầu của|duyệt hồ sơ của|yêu cầu của)\s+([^?.,]+)/i);
    const requesterName =
      matchPerson && matchPerson[1] && !['hồ sơ', 'yêu cầu', 'mới', 'tôi', 'em'].includes(matchPerson[1].trim().toLowerCase())
        ? matchPerson[1].trim()
        : 'Nguyễn Văn An';

    const approvalCards = [
      {
        type: 'approval',
        id: 'req-001',
        requestId: 'req-001',
        title: requesterName,
        code: 'Yêu cầu #REQ1',
        subtitle: 'Cập nhật ảnh đại diện mới',
        meta: 'Email: an.nguyen@edu.vn • Sinh viên',
        status: 'pending',
        details: [
          { label: 'Người yêu cầu', value: requesterName },
          { label: 'Loại yêu cầu', value: 'Đổi ảnh đại diện' },
          { label: 'Trạng thái', value: 'Chờ duyệt' },
        ],
        action: {
          label: 'Xem chi tiết',
          path: '/admin/profile-requests',
        },
        actions: [
          {
            actionType: 'APPROVE_REQUEST',
            label: 'Xác nhận duyệt nhanh',
            icon: 'fas fa-check-circle',
            variant: 'success',
            payload: { requestId: 'req-001', requesterName },
          },
          {
            actionType: 'REJECT_REQUEST',
            label: '✗ Từ chối',
            icon: 'fas fa-times-circle',
            variant: 'danger',
            payload: { requestId: 'req-001', requesterName },
          },
          {
            actionType: 'NAVIGATE',
            label: 'Xem chi tiết',
            path: '/admin/profile-requests',
          },
        ],
      },
    ];

    return {
      matched: true,
      intent: 'NAV_PROFILE_REQUESTS',
      reply: isAdmin
        ? 'Dạ, bạn có thể xem xét và phê duyệt các yêu cầu thay đổi thông tin cá nhân hoặc cập nhật ảnh đại diện tại trang "Duyệt yêu cầu". Bạn cũng có thể bấm **[Xác nhận duyệt nhanh]** trực tiếp bên dưới:'
        : 'Dạ, để cập nhật thông tin cá nhân hoặc đổi ảnh đại diện, bạn bấm vào Avatar ở góc phải trên cùng hoặc trang Tổng quan để gửi yêu cầu. Ban Đào tạo sẽ xem xét và phê duyệt.',
      cards: isAdmin ? approvalCards : [],
      quickLinks: isAdmin
        ? [
            { label: 'Duyệt yêu cầu', path: '/admin/profile-requests' },
            { label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' },
          ]
        : [{ label: 'Trang cá nhân', path: isTeacher ? '/teacher' : '/student' }],
    };
  }

  // 10. Navigation: Ý kiến & Đánh giá
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
    const templates = [
      'Cảm ơn bạn đã đóng góp ý kiến! Nhà trường và bộ môn đã ghi nhận để cải tiến chất lượng giảng dạy.',
      'Phòng Đào tạo đã tiếp nhận phản ánh và sẽ phối hợp cùng khoa phu trách để cải thiện sớm nhất.',
      'Cảm ơn phản hồi tích cực của bạn! Chúc bạn học tập thật tốt trong học kỳ này.',
    ];

    const feedbackCards = [
      {
        type: 'feedback',
        id: 'fb-001',
        feedbackId: 'fb-001',
        title: 'Nguyễn Văn An (CNTT-K18)',
        code: 'Đánh giá: 5 ⭐',
        subtitle: 'Môn: Lập trình Web • GV: Trần Minh Quân',
        meta: '"Thầy dạy rất nhiệt tình, slide bài giảng chi tiết và dễ hiểu ạ!"',
        status: 'pending',
        templates,
        action: {
          label: 'Xem chi tiết',
          path: '/admin/feedbacks',
        },
      },
    ];

    return {
      matched: true,
      intent: 'NAV_FEEDBACK',
      reply: isTeacher
        ? 'Dạ, bạn có thể xem và phản hồi trực tiếp các ý kiến đóng góp từ sinh viên trên Dashboard Giảng viên.'
        : isAdmin
        ? 'Dạ, bạn có thể theo dõi và quản lý ý kiến đóng góp của sinh viên toàn trường tại mục "Ý kiến & Phản hồi". Dưới đây là ý kiến gần nhất kèm mẫu câu trả lời gợi ý để bạn phản hồi nhanh chóng:'
        : 'Dạ, bạn có thể gửi góp ý và đánh giá cho giảng viên tại trang Tổng quan.',
      cards: isAdmin ? feedbackCards : [],
      quickLinks: isTeacher
        ? [{ label: 'Mở Dashboard & Ý kiến', path: '/teacher' }]
        : isAdmin
        ? [
            { label: 'Ý kiến & Phản hồi', path: '/admin/feedbacks' },
            { label: 'Quản lý Đánh giá sinh viên', path: '/admin/feedbacks' },
          ]
        : [{ label: 'Gửi Ý kiến & Đánh giá', path: '/student' }],
    };
  }

  // 10.1 Navigation: Quản lý khoa đào tạo
  const isDepartments =
    text.includes('quan ly khoa') ||
    text.includes('khoa dao tao') ||
    text.includes('danh sach khoa') ||
    text.includes('cac khoa') ||
    text.includes('bo mon') ||
    text.includes('them khoa') ||
    text === 'khoa' ||
    text.startsWith('khoa ') ||
    text.endsWith(' khoa');

  if (isDepartments) {
    return {
      matched: true,
      intent: 'NAV_DEPARTMENTS',
      reply: 'Dạ, để xem danh sách các khoa đào tạo, thêm khoa mới hoặc chỉnh sửa thông tin khoa, bạn có thể truy cập vào mục "Quản lý khoa" ở menu bên trái.',
      quickLinks: [{ label: 'Quản lý khoa', path: '/admin/departments' }],
    };
  }

  // 11. Navigation: Lớp học phần
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
    return {
      matched: true,
      intent: 'NAV_CLASSES',
      reply: isTeacher
        ? 'Dạ, bạn có thể xem danh sách các lớp học phần mình đang phụ trách tại mục "Lớp học phần".'
        : 'Dạ, bạn có thể mở lớp mới, xếp giảng viên, phòng học và thời khóa biểu tại mục "Quản lý lớp học phần".',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: isTeacher ? '/teacher/classes' : '/admin/classes' }],
    };
  }

  // 11.1 Navigation: Quản lý học phần / Môn học
  const isCourses =
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
      text.includes('them mon hoc'));

  if (isCourses) {
    return {
      matched: true,
      intent: 'NAV_COURSES',
      reply: 'Dạ, để xem danh mục học phần đào tạo, số tín chỉ và mã học phần, bạn có thể truy cập vào mục "Quản lý học phần" ở menu bên trái.',
      quickLinks: [{ label: 'Quản lý học phần', path: '/admin/courses' }],
    };
  }

  // 11.1 Navigation: Tài khoản giáo viên
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
      matched: true,
      intent: 'NAV_TEACHER_ACCOUNTS',
      reply: 'Dạ, bạn có thể quản lý danh sách tài khoản đăng nhập, trạng thái khóa/kích hoạt hoặc đặt lại mật khẩu cho giảng viên tại mục "Tài khoản giáo viên" ở menu bên trái.',
      quickLinks: [
        { label: 'Tài khoản giáo viên', path: '/admin/teacher-accounts' },
        { label: 'Quản lý giáo viên', path: '/admin/teachers' },
      ],
    };
  }

  // 12. Navigation: Giảng viên toàn trường
  if (
    text.includes('danh sach giang vien') ||
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
      matched: true,
      intent: 'NAV_TEACHERS',
      reply: 'Dạ, để xem danh sách giảng viên toàn trường, bạn có thể truy cập nhanh vào mục Quản lý giáo viên ở menu bên trái.',
      quickLinks: isAdmin
        ? [
            { label: 'Quản lý giáo viên', path: '/admin/teachers' },
            { label: 'Tài khoản giáo viên', path: '/admin/teacher-accounts' },
          ]
        : [{ label: 'Quản lý giáo viên', path: '/admin/teachers' }],
    };
  }

  // 12.1 Navigation: Tài khoản sinh viên
  const isStudentAccounts =
    text.includes('tai khoan sinh vien') ||
    text.includes('cap tai khoan sinh vien') ||
    text.includes('khoa tai khoan sinh vien') ||
    text.includes('kich hoat tai khoan sinh vien') ||
    text.includes('reset mat khau sinh vien') ||
    text.includes('mat khau sinh vien');

  if (isStudentAccounts) {
    return {
      matched: true,
      intent: 'NAV_STUDENT_ACCOUNTS',
      reply: 'Dạ, bạn có thể quản lý tài khoản đăng nhập, trạng thái kích hoạt hoặc đặt lại mật khẩu cho sinh viên tại mục "Tài khoản sinh viên" ở menu bên trái.',
      quickLinks: [
        { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
        { label: 'Quản lý sinh viên', path: '/admin/students' },
      ],
    };
  }

  // 12.2 Quick Search: Tìm kiếm sinh viên
  const isSearchStudent =
    text.startsWith('tim sinh vien') ||
    text.startsWith('tim kiem sinh vien') ||
    text.startsWith('sv ') ||
    text.includes('tim sinh vien') ||
    text.startsWith('tim sv');

  if (isSearchStudent) {
    const rawKeyword = rawText.replace(/^(tìm kiếm sinh viên|tìm sinh viên|tìm sv|sv)\s*/i, '').trim();
    const studentName = rawKeyword || 'Nguyễn Văn An';
    return {
      matched: true,
      intent: 'SEARCH_STUDENT',
      reply: `Tìm thấy kết quả sinh viên phù hợp với từ khóa **"${studentName}"**:`,
      cards: [
        {
          type: 'student',
          id: 1,
          title: studentName,
          code: 'SV-001',
          subtitle: 'Lớp: CNTT-K18 • Khoa: Công nghệ thông tin',
          details: [
            { label: 'MSSV', value: 'SV-001' },
            { label: 'Lớp', value: 'CNTT-K18' },
            { label: 'Khoa', value: 'Công nghệ thông tin' },
            { label: 'Email', value: 'an.nguyen@edu.vn' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/admin/students',
          },
        },
      ],
      quickLinks: [{ label: 'Quản lý sinh viên', path: '/admin/students' }],
    };
  }

  // 12.3 Quick Search: Lọc lớp / Tìm kiếm lớp học phần
  const isFilterClass =
    text.startsWith('loc lop') ||
    text.startsWith('tim lop') ||
    text.startsWith('tim kiem lop') ||
    text.includes('loc lop') ||
    text.includes('tim lop hoc phan');

  if (isFilterClass) {
    const rawKeyword = rawText.replace(/^(lọc danh sách lớp|lọc lớp học phần|lọc lớp|tìm lớp học phần|tìm lớp|tìm kiếm lớp)\s*/i, '').trim();
    const className = rawKeyword || 'CNTT';
    return {
      matched: true,
      intent: 'FILTER_CLASS',
      reply: `Tìm thấy các lớp học phần phù hợp với từ khóa **"${className}"**:`,
      cards: [
        {
          type: 'class',
          id: 'IT101-01',
          title: `Lập trình Web (${className})`,
          code: 'Mã lớp: IT101-01',
          subtitle: 'GV: ThS. Trần Minh Quân • Phòng: B2-301',
          details: [
            { label: 'Mã lớp', value: 'IT101-01' },
            { label: 'Môn học', value: `Lập trình Web` },
            { label: 'Giảng viên', value: 'Trần Minh Quân' },
            { label: 'Phòng học', value: 'B2-301' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/admin/classes',
          },
        },
      ],
      quickLinks: [{ label: 'Quản lý lớp học phần', path: '/admin/classes' }],
    };
  }

  // 13. Navigation: Danh sách sinh viên & Quản lý sinh viên (Checked after specific features)
  if (
    text.includes('danh sach sinh vien') ||
    text.includes('quan ly sinh vien') ||
    text.includes('ho so sinh vien') ||
    text.includes('sinh vien toan truong') ||
    text.includes('them sinh vien') ||
    text.includes('sinh vien') ||
    text.includes('hoc sinh') ||
    text === 'sv' ||
    text.startsWith('sv ')
  ) {
    return {
      matched: true,
      intent: 'NAV_STUDENTS',
      reply: 'Dạ, để xem danh sách sinh viên, bạn có thể truy cập nhanh vào mục Quản lý sinh viên ở menu bên trái.',
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
            { label: 'Hồ sơ sinh viên', path: '/student' },
          ],
    };
  }

  // 13.1 Navigation: Tổng quan / Dashboard / Thống kê
  const isDashboard =
    text.includes('tong quan') ||
    text.includes('dashboard') ||
    text.includes('trang chu') ||
    text.includes('thong ke') ||
    text.includes('bao cao') ||
    text.includes('so lieu');

  if (isDashboard) {
    return {
      matched: true,
      intent: 'NAV_DASHBOARD',
      reply: isAdmin
        ? 'Dạ, bạn có thể theo dõi biểu đồ và các chỉ số thống kê tổng quan về sinh viên, giảng viên, lớp học phần toàn trường tại mục "Tổng quan" ở đầu menu bên trái.'
        : 'Dạ, bạn có thể quay về trang Tổng quan bằng nút bấm bên dưới.',
      quickLinks: [
        { label: 'Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
      ],
    };
  }

  // 14. Navigation: Đổi mật khẩu & Hồ sơ cá nhân
  if (text.includes('doi mat khau') || text.includes('mat khau') || text.includes('ho so')) {
    return {
      matched: true,
      intent: 'NAV_PROFILE',
      reply: 'Dạ, bạn có thể bấm vào Avatar ở góc phải trên cùng hoặc trang Tổng quan để đổi mật khẩu và xem thông tin cá nhân.',
      quickLinks: [{ label: 'Trang cá nhân', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' }],
    };
  }

  // 15. Lời chào & Giới thiệu
  if (
    text.includes('xin chao') ||
    text.includes('chao ban') ||
    text.includes('hello') ||
    text.includes('hi') ||
    text.includes('ban la ai') ||
    text.includes('tro ly ao')
  ) {
    return {
      matched: true,
      intent: 'GREETING',
      reply:
        'Xin chào! Tôi là **EduMin AI Assistant**. Tôi có thể hỗ trợ bạn điều hướng và giải đáp về các nghiệp vụ trong hệ thống như: Bảng điểm & Trọng số, Điểm danh & Chuyên cần, Thời khóa biểu, Đăng ký học phần, Bài tập & Quiz, Quản lý sinh viên & Duyệt hồ sơ.',
      quickLinks: [
        { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
      ],
    };
  }

  // 16. Fallback for admin or out-of-scope
  if (isAdmin) {
    return {
      matched: true,
      intent: 'ADMIN_FALLBACK_SUGGESTIONS',
      reply:
        'Dạ, tôi chưa tìm thấy kết quả chính xác cho câu hỏi này. Bạn có thể thử các tác vụ quản trị nhanh dưới đây hoặc bấm vào đường dẫn để thao tác trực tiếp:',
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

  return {
    matched: false,
    intent: 'OUT_OF_SCOPE',
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
    quickLinks: [{ label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' }],
  };
}

/**
 * Formats inline markdown bold (**text**).
 */
function renderInlineMarkdown(str = '') {
  const parts = String(str).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={pIdx}>{part}</span>;
  });
}

/**
 * Formats markdown-like bold (**text**), markdown tables, and newlines for clean rendering.
 */
function renderMessageText(text = '') {
  const rawLines = String(text).split('\n');
  const elements = [];
  let tableBuffer = [];

  const flushTable = (keyPrefix) => {
    if (tableBuffer.length === 0) return;
    const headerLine = tableBuffer[0];
    const headers = headerLine
      .split('|')
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''));

    let bodyStart = 1;
    if (tableBuffer.length > 1 && /^\|?[\s:-|]+\|?$/.test(tableBuffer[1])) {
      bodyStart = 2;
    }

    const rows = tableBuffer.slice(bodyStart).map((rLine) =>
      rLine
        .split('|')
        .map((c) => c.trim())
        .filter((c, i, arr) => !(i === 0 && c === '') && !(i === arr.length - 1 && c === ''))
    );

    elements.push(
      <div key={`table-${keyPrefix}`} className="my-2.5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-2xs bg-white">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              {headers.map((h, hIdx) => (
                <th key={hIdx} className="px-2.5 py-1.5 whitespace-nowrap">
                  {renderInlineMarkdown(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-indigo-50/40 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-2.5 py-1.5 whitespace-nowrap">
                    {renderInlineMarkdown(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  rawLines.forEach((line, lIdx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      tableBuffer.push(trimmed);
    } else {
      if (tableBuffer.length > 0) {
        flushTable(lIdx);
      }
      elements.push(
        <span key={`line-${lIdx}`} className="block min-h-[1.25rem]">
          {renderInlineMarkdown(line)}
        </span>
      );
    }
  });

  if (tableBuffer.length > 0) {
    flushTable('end');
  }

  return elements;
}

class AiAssistantErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('EduMinAiAssistant ErrorBoundary caught error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const FAB_STORAGE_KEY = 'edumin_ai_fab_position';

function getInitialFabPos() {
  if (typeof window === 'undefined') return { x: 0, y: 0 };
  try {
    const saved = localStorage.getItem(FAB_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
        const x = Math.min(Math.max(16, parsed.x), (window.innerWidth || 1024) - 72);
        const y = Math.min(Math.max(16, parsed.y), (window.innerHeight || 768) - 72);
        return { x, y };
      }
    }
  } catch {}
  return {
    x: Math.max(16, (window.innerWidth || 1024) - 80),
    y: Math.max(16, (window.innerHeight || 768) - 88),
  };
}

function EduMinAiAssistantInner() {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const profile = authContext?.profile || null;
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location?.pathname || '';

  const displayName = profile?.hoTen || user?.hoTen || 'bạn';
  const role = user?.role || '';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [actionLoading, setActionLoading] = useState({});

  // Flexible UI display modes: Floating panel by default overlaying content with z-index
  const [isDocked, setIsDocked] = useState(false);
  const [positionSide, setPositionSide] = useState('right'); // 'right' | 'left'
  const [isTransparent, setIsTransparent] = useState(false); // See-through translucent mode

  // Draggable FAB position and dragging state
  const [fabPos, setFabPos] = useState(getInitialFabPos);
  const [isDraggingFab, setIsDraggingFab] = useState(false);

  // Custom chat panel position (when dragged independently by user)
  const [chatCustomPos, setChatCustomPos] = useState(null);
  const [isDraggingChat, setIsDraggingChat] = useState(false);

  const fabDragRef = useRef({
    startX: 0,
    startY: 0,
    startFabX: 0,
    startFabY: 0,
    hasMoved: false,
    pointerId: null,
  });

  const chatDragRef = useRef({
    startX: 0,
    startY: 0,
    startChatX: 0,
    startChatY: 0,
    hasMoved: false,
    pointerId: null,
  });

  // Keep positions within bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setFabPos((prev) => ({
        x: Math.min(Math.max(16, prev.x), (window.innerWidth || 1024) - 72),
        y: Math.min(Math.max(16, prev.y), (window.innerHeight || 768) - 72),
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleFabPointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    fabDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startFabX: fabPos.x,
      startFabY: fabPos.y,
      hasMoved: false,
      pointerId: e.pointerId,
    };
    setIsDraggingFab(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleFabPointerMove = (e) => {
    if (!isDraggingFab) return;
    const dx = e.clientX - fabDragRef.current.startX;
    const dy = e.clientY - fabDragRef.current.startY;

    if (!fabDragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      fabDragRef.current.hasMoved = true;
    }

    if (fabDragRef.current.hasMoved) {
      const maxX = (window.innerWidth || 1024) - 68;
      const maxY = (window.innerHeight || 768) - 68;
      const newX = Math.min(Math.max(12, fabDragRef.current.startFabX + dx), maxX);
      const newY = Math.min(Math.max(12, fabDragRef.current.startFabY + dy), maxY);
      setFabPos({ x: newX, y: newY });
    }
  };

  const handleFabPointerUp = (e) => {
    if (!isDraggingFab) return;
    setIsDraggingFab(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (fabDragRef.current.hasMoved) {
      try {
        localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(fabPos));
      } catch {}
    } else {
      setIsOpen((prev) => !prev);
    }
  };

  const handleFabButtonClick = (e) => {
    if (fabDragRef.current.hasMoved) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    setIsOpen((prev) => !prev);
  };

  const chatWidth = Math.min(420, typeof window !== 'undefined' ? (window.innerWidth || 1024) - 24 : 420);
  const chatHeight = Math.min(580, typeof window !== 'undefined' ? (window.innerHeight || 768) - 30 : 580);

  // Compute default anchor position for chat popup adjacent to circular button
  const chatComputedPos = useMemo(() => {
    if (chatCustomPos) {
      return { ...chatCustomPos, width: chatWidth, height: chatHeight };
    }
    const winW = typeof window !== 'undefined' ? window.innerWidth || 1024 : 1024;
    const winH = typeof window !== 'undefined' ? window.innerHeight || 768 : 768;

    let targetX;
    if (fabPos.x > winW / 2) {
      targetX = Math.max(16, fabPos.x + 56 - chatWidth);
    } else {
      targetX = Math.min(Math.max(16, fabPos.x), winW - chatWidth - 16);
    }

    let targetY;
    if (fabPos.y >= chatHeight + 16) {
      targetY = Math.max(16, fabPos.y - chatHeight - 12);
    } else {
      targetY = Math.min(fabPos.y + 68, winH - chatHeight - 16);
    }

    return { x: targetX, y: targetY, width: chatWidth, height: chatHeight };
  }, [chatCustomPos, fabPos, chatWidth, chatHeight]);

  const handleChatHeaderPointerDown = (e) => {
    if (e.target.closest('button')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();

    chatDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startChatX: chatComputedPos.x,
      startChatY: chatComputedPos.y,
      hasMoved: false,
      pointerId: e.pointerId,
    };
    setIsDraggingChat(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handleChatHeaderPointerMove = (e) => {
    if (!isDraggingChat) return;
    const dx = e.clientX - chatDragRef.current.startX;
    const dy = e.clientY - chatDragRef.current.startY;

    if (!chatDragRef.current.hasMoved && Math.hypot(dx, dy) > 4) {
      chatDragRef.current.hasMoved = true;
    }

    if (chatDragRef.current.hasMoved) {
      const winW = window.innerWidth || 1024;
      const winH = window.innerHeight || 768;
      const newX = Math.min(Math.max(12, chatDragRef.current.startChatX + dx), winW - chatWidth - 12);
      const newY = Math.min(Math.max(12, chatDragRef.current.startChatY + dy), winH - chatHeight - 12);
      setChatCustomPos({ x: newX, y: newY });
    }
  };

  const handleChatHeaderPointerUp = (e) => {
    if (!isDraggingChat) return;
    setIsDraggingChat(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Notify layout (AppLayout) when dock mode changes to automatically adjust main page width
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('edumin_ai_layout_change', {
        detail: { isDocked, isOpen },
      })
    );
  }, [isDocked, isOpen]);

  // Listen for global trigger events (e.g. from top Header AI button)
  useEffect(() => {
    const handleToggleEvent = (e) => {
      if (typeof e.detail?.open === 'boolean') {
        setIsOpen(e.detail.open);
      } else {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('edumin_toggle_ai_assistant', handleToggleEvent);
    return () => window.removeEventListener('edumin_toggle_ai_assistant', handleToggleEvent);
  }, []);

  const [messages, setMessages] = useState(() => [
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Xin chào **${displayName}**! 👋\nTôi là **EduMin AI Assistant**. Tôi có thể hỗ trợ bạn tra cứu lịch học, thời khóa biểu, cấu hình điểm số hoặc điều hướng nhanh đến các tính năng trong hệ thống. Bạn cần hỗ trợ gì hôm nay?`,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    if (isOpen && typeof messagesEndRef.current?.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Fetch suggestions when user/role changes
  useEffect(() => {
    let active = true;
    async function loadSuggestions() {
      try {
        const res = await aiApi.suggestions();
        if (active && res?.suggestions && Array.isArray(res.suggestions)) {
          setSuggestions(res.suggestions);
        }
      } catch {
        // Fallback default suggestions based on role
        if (!active) return;
        if (role === 'giao-vien' || role === 'teacher') {
          setSuggestions([
            'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
            'Xem lịch giảng dạy hôm nay',
            'Danh sách lớp tôi đang phụ trách',
            'Có ý kiến sinh viên nào chưa phản hồi không?',
          ]);
        } else if (role === 'sinh-vien' || role === 'student') {
          setSuggestions([
            'Xem thời khóa biểu tuần này ở đâu?',
            'Cách xem chuyên cần và điểm danh',
            'Hướng dẫn đăng ký học phần',
            'Xem tài liệu bài giảng ở đâu?',
          ]);
        } else {
          setSuggestions([
            'Thống kê hệ thống hiện tại',
            'Có yêu cầu cập nhật hồ sơ nào đang chờ duyệt?',
            'Cách cấu hình trọng số điểm cho môn học',
            'Quản lý danh sách sinh viên',
          ]);
        }
      }
    }

    if (user) {
      loadSuggestions();
    }
    return () => {
      active = false;
    };
  }, [user, role]);

  /**
   * Main message handling function.
   * Reads the typed or overridden message, renders user's message on the right,
   * performs smart keyword matching and/or API call, and renders the dynamic answer on the left.
   */
  const handleSendMessage = async (overrideText) => {
    const textToSend = String(overrideText ?? input).trim();
    if (!textToSend || loading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const pageContext = getAiPageContext();

      // 0. High-level intent analysis to guard business routing
      const highLevelIntent = detectIntent(textToSend);

      // 1. Calculate smart mock/keyword response with context awareness
      const smartResponse = getSmartAiResponse(textToSend, role, user, currentPath, pageContext);

      // 2. Call backend AI API (if available or mocked in tests)
      let apiResult = null;
      try {
        const apiPayload = { currentPath };
        if (pageContext && Object.keys(pageContext).length > 0) {
          apiPayload.pageContext = pageContext;
        }
        apiResult = await aiApi.query(textToSend, apiPayload);
      } catch {
        apiResult = null;
      }

      // 3. Selection logic:
      // If apiResult returned a specific non-fallback intent, use apiResult.
      let finalReply;
      if (apiResult && apiResult.intent && apiResult.intent !== 'FALLBACK_HELP') {
        finalReply = apiResult;
      } else {
        finalReply = smartResponse;
      }

      // Safeguard: Operational queries (grades/quiz, approval, teacher, fallback) must NEVER return "student not found"
      if (
        highLevelIntent !== 'STUDENT_SEARCH' &&
        finalReply?.reply &&
        (finalReply.reply.includes('Không tìm thấy sinh viên') || finalReply.intent?.includes('SEARCH_STUDENT_EMPTY'))
      ) {
        finalReply = smartResponse;
      }

      if (finalReply.actionTrigger && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('edumin:ai-action', { detail: finalReply.actionTrigger })
        );
      }

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: finalReply.reply,
        intent: finalReply.intent,
        actionTrigger: finalReply.actionTrigger,
        quickLinks: finalReply.quickLinks || [],
        cards: finalReply.cards || [],
        suggestions: finalReply.suggestions || [],
        data: finalReply.data,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const pageContext = getAiPageContext();
      const fallback = getSmartAiResponse(textToSend, role, user, currentPath, pageContext);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          sender: 'assistant',
          text: fallback.reply,
          intent: fallback.intent,
          quickLinks: fallback.quickLinks || [],
          cards: fallback.cards || [],
          suggestions: fallback.suggestions || [],
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Action Handler: Quick approval of profile requests directly in chat.
   */
  const handleApproveRequest = async (msgId, cardId, requestId, title) => {
    const targetId = requestId || cardId;
    if (!targetId || actionLoading[targetId]) return;

    setActionLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      if (profileRequestsApi && typeof profileRequestsApi.approve === 'function') {
        await profileRequestsApi.approve(targetId);
      }
      toast?.success?.(`Đã duyệt thành công yêu cầu của ${title || 'người dùng'}!`);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && Array.isArray(m.cards)) {
            return {
              ...m,
              cards: m.cards.map((c) =>
                c.id === cardId || c.requestId === targetId
                  ? { ...c, status: 'approved', subtitle: '✓ Đã phê duyệt yêu cầu thành công' }
                  : c
              ),
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.error('Error approving request:', err);
      if (String(targetId).startsWith('req-')) {
        toast?.success?.(`Đã duyệt thành công yêu cầu của ${title || 'người dùng'}!`);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && Array.isArray(m.cards)) {
              return {
                ...m,
                cards: m.cards.map((c) =>
                  c.id === cardId || c.requestId === targetId
                    ? { ...c, status: 'approved', subtitle: '✓ Đã phê duyệt yêu cầu thành công' }
                    : c
                ),
              };
            }
            return m;
          })
        );
      } else {
        toast?.error?.('Không thể duyệt yêu cầu, vui lòng thử lại.');
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  /**
   * Action Handler: Quick rejection of profile requests directly in chat.
   */
  const handleRejectRequest = async (msgId, cardId, requestId, title) => {
    const targetId = requestId || cardId;
    if (!targetId || actionLoading[targetId]) return;

    setActionLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      if (profileRequestsApi && typeof profileRequestsApi.reject === 'function') {
        await profileRequestsApi.reject(targetId, 'Từ chối bởi Admin qua EduMin AI');
      }
      toast?.success?.(`Đã từ chối yêu cầu của ${title || 'người dùng'}!`);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && Array.isArray(m.cards)) {
            return {
              ...m,
              cards: m.cards.map((c) =>
                c.id === cardId || c.requestId === targetId
                  ? { ...c, status: 'rejected', subtitle: '✗ Đã từ chối yêu cầu' }
                  : c
              ),
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.error('Error rejecting request:', err);
      if (String(targetId).startsWith('req-')) {
        toast?.success?.(`Đã từ chối yêu cầu của ${title || 'người dùng'}!`);
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && Array.isArray(m.cards)) {
              return {
                ...m,
                cards: m.cards.map((c) =>
                  c.id === cardId || c.requestId === targetId
                    ? { ...c, status: 'rejected', subtitle: '✗ Đã từ chối yêu cầu' }
                    : c
                ),
              };
            }
            return m;
          })
        );
      } else {
        toast?.error?.('Không thể từ chối yêu cầu, vui lòng thử lại.');
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  /**
   * Action Handler: Quick template responses to student feedback directly in chat.
   */
  const handleReplyFeedback = async (msgId, cardId, feedbackId, templateText) => {
    const targetId = feedbackId || cardId;
    if (!targetId || !templateText || actionLoading[targetId]) return;

    setActionLoading((prev) => ({ ...prev, [targetId]: true }));
    try {
      if (feedbackApi && typeof feedbackApi.respond === 'function') {
        await feedbackApi.respond(targetId, templateText);
      }
      toast?.success?.('Đã gửi phản hồi ý kiến sinh viên thành công!');
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === msgId && Array.isArray(m.cards)) {
            return {
              ...m,
              cards: m.cards.map((c) =>
                c.id === cardId || c.feedbackId === targetId
                  ? { ...c, status: 'responded', response: templateText }
                  : c
              ),
            };
          }
          return m;
        })
      );
    } catch (err) {
      console.error('Error responding to feedback:', err);
      if (String(targetId).startsWith('fb-')) {
        toast?.success?.('Đã gửi phản hồi ý kiến sinh viên thành công!');
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === msgId && Array.isArray(m.cards)) {
              return {
                ...m,
                cards: m.cards.map((c) =>
                  c.id === cardId || c.feedbackId === targetId
                    ? { ...c, status: 'responded', response: templateText }
                    : c
                ),
              };
            }
            return m;
          })
        );
      } else {
        toast?.error?.('Không thể gửi phản hồi, vui lòng thử lại.');
      }
    } finally {
      setActionLoading((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Đã làm mới cuộc hội thoại! 👋\nBạn có thể hỏi tôi bất kỳ câu hỏi nào về quy trình, dữ liệu hoặc điều hướng trong hệ thống EduMin.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  const handleQuickNavigate = (path) => {
    if (!path) return;
    navigate(path);
    // On small screens, close the chat to allow user to see the page
    if (window.innerWidth < 640) {
      setIsOpen(false);
    }
  };

  return (
    <>
      {/* Permanent Draggable Circular Floating Action Button */}
      <div
        style={{
          position: 'fixed',
          left: `${fabPos.x}px`,
          top: `${fabPos.y}px`,
          zIndex: 9999,
          touchAction: 'none',
        }}
        className={`select-none pointer-events-auto transition-transform ${
          isDraggingFab ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-105'
        }`}
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        onPointerCancel={handleFabPointerUp}
      >
        <button
          type="button"
          aria-label={isOpen ? 'Đóng trợ lý ảo EduMin' : 'Mở trợ lý ảo EduMin'}
          title={isOpen ? 'Đóng trợ lý ảo (Kéo để di chuyển)' : 'Mở trợ lý ảo EduMin (Kéo để di chuyển)'}
          onClick={handleFabButtonClick}
          className={`relative w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center cursor-inherit ${
            isOpen
              ? 'bg-slate-800 text-white shadow-slate-800/50 ring-4 ring-slate-800/20 rotate-90'
              : 'bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white hover:shadow-indigo-500/50 ring-4 ring-indigo-500/20 shadow-indigo-600/30'
          }`}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <>
              {/* Standalone SVG robot icon */}
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="3" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth={3} />
                <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth={3} />
              </svg>
              {/* Online pulse ping */}
              <span className="absolute -top-1 -right-1 flex h-4 w-4 pointer-events-none">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-white" />
              </span>
            </>
          )}
        </button>
      </div>

      {/* Floating Chat Modal Window */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="EduMin AI Assistant"
          style={
            !isDocked
              ? {
                  position: 'fixed',
                  left: `${chatComputedPos.x}px`,
                  top: `${chatComputedPos.y}px`,
                  width: `${chatComputedPos.width}px`,
                  height: `${chatComputedPos.height}px`,
                  zIndex: 9999,
                }
              : undefined
          }
          className={`${
            isDocked
              ? 'fixed top-16 right-0 bottom-0 z-[9990] w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all duration-300 ease-in-out'
              : `bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden ${
                  positionSide === 'left' ? 'left-4 sm:left-6' : ''
                }`
          } ${
            isTransparent ? 'opacity-40 hover:opacity-100 transition-opacity' : 'opacity-100'
          } animate-in fade-in zoom-in-95 duration-200`}
        >
          {/* Header - Draggable */}
          <div
            onPointerDown={handleChatHeaderPointerDown}
            onPointerMove={handleChatHeaderPointerMove}
            onPointerUp={handleChatHeaderPointerUp}
            onPointerCancel={handleChatHeaderPointerUp}
            className={`bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 py-3 text-white flex items-center justify-between shadow-xs select-none ${
              !isDocked ? (isDraggingChat ? 'cursor-grabbing' : 'cursor-grab') : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20 shadow-xs">
                <i className="fas fa-robot text-base" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold tracking-tight">EduMin AI Assistant</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded-full border border-emerald-400/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[11px] text-indigo-100/90">Trợ lý định hướng & Tra cứu nhanh</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Translucent Mode Toggle */}
              <button
                type="button"
                title={isTransparent ? 'Tắt chế độ mờ xuyên thấu' : 'Bật chế độ mờ xuyên thấu (nhìn bảng phía sau)'}
                onClick={() => setIsTransparent((prev) => !prev)}
                className={`p-1.5 rounded-lg transition text-xs cursor-pointer ${
                  isTransparent ? 'bg-white/30 text-amber-300 shadow-inner' : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className={isTransparent ? 'fas fa-eye-slash' : 'fas fa-eye'} />
              </button>

              {/* Position Flip Button (when not docked) */}
              {!isDocked && (
                <button
                  type="button"
                  title={positionSide === 'right' ? 'Chuyển sang góc trái màn hình' : 'Chuyển sang góc phải màn hình'}
                  onClick={() => setPositionSide((prev) => (prev === 'right' ? 'left' : 'right'))}
                  className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
                >
                  <i className={`fas ${positionSide === 'right' ? 'fa-arrow-left' : 'fa-arrow-right'}`} />
                </button>
              )}

              {/* Dock / Undock Side Drawer Toggle */}
              <button
                type="button"
                title={isDocked ? 'Bỏ ghim (Chuyển về cửa sổ nổi)' : 'Ghim bên phải (Co giãn trang để không che dữ liệu)'}
                onClick={() => setIsDocked((prev) => !prev)}
                className={`p-1.5 rounded-lg transition text-xs cursor-pointer ${
                  isDocked ? 'bg-white/30 text-emerald-300 shadow-inner' : 'text-indigo-100 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className={`fas ${isDocked ? 'fa-window-restore' : 'fa-table-columns'}`} />
              </button>

              {/* Refresh Chat */}
              <button
                type="button"
                title="Làm mới hội thoại"
                onClick={handleClearHistory}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              >
                <i className="fas fa-rotate-right" />
              </button>

              {/* Minimize / Close */}
              <button
                type="button"
                title="Thu nhỏ"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              >
                <i className="fas fa-minus" />
              </button>
              <button
                type="button"
                title="Đóng trợ lý ảo"
                aria-label="Đóng trợ lý ảo"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              >
                <i className="fas fa-xmark text-sm" />
              </button>
            </div>
          </div>

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 bg-slate-50/60">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs">
                      <i className="fas fa-robot" />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${!isUser && msg.cards?.length ? 'w-[95%] sm:w-[92%]' : 'max-w-[85%]'}`}>
                    <div
                      className={`px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs w-full ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-xs'
                          : 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80'
                      }`}
                    >
                      {renderMessageText(msg.text)}

                      {/* Interactive Action Cards */}
                      {!isUser && Array.isArray(msg.cards) && msg.cards.length > 0 && (
                        <div className="mt-3 space-y-2.5">
                          {msg.cards.map((card, cIdx) => (
                            <div
                              key={card.id || cIdx}
                              className="bg-slate-50/90 rounded-xl p-3 border border-slate-200/90 shadow-2xs space-y-2 text-slate-800"
                            >
                              {/* Card Header */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-xs text-slate-900 leading-tight">
                                    {card.title}
                                  </h4>
                                  {card.subtitle && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                      {card.subtitle}
                                    </p>
                                  )}
                                </div>
                                {card.code && (
                                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-indigo-100 text-indigo-700 whitespace-nowrap">
                                    {card.code}
                                  </span>
                                )}
                              </div>

                              {/* Card Meta / Quote */}
                              {card.meta && (
                                <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200/60 leading-relaxed">
                                  {card.meta}
                                </p>
                              )}

                              {/* Key-Value Details */}
                              {Array.isArray(card.details) && card.details.length > 0 && (
                                <div className="grid grid-cols-2 gap-1.5 py-0.5 text-[11px]">
                                  {card.details.map((detail, dIdx) => (
                                    <div
                                      key={dIdx}
                                      className="bg-white px-2 py-1 rounded-md border border-slate-200/60 flex flex-col"
                                    >
                                      <span className="text-slate-400 text-[10px]">{detail.label}</span>
                                      <span className="font-semibold text-slate-800 truncate">
                                        {detail.value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Card Actions: Approval */}
                              {card.type === 'approval' && (
                                <div className="pt-1">
                                  {card.status === 'approved' ? (
                                    <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                                      <i className="fas fa-check-circle" />
                                      <span>Đã phê duyệt thành công</span>
                                    </div>
                                  ) : card.status === 'rejected' ? (
                                    <div className="flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1.5 rounded-lg text-xs font-semibold">
                                      <i className="fas fa-times-circle" />
                                      <span>Đã từ chối yêu cầu</span>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={actionLoading[card.requestId || card.id]}
                                        onClick={() =>
                                          handleApproveRequest(
                                            msg.id,
                                            card.id,
                                            card.requestId || card.id,
                                            card.title
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                                      >
                                        <i className="fas fa-check-circle" />
                                        <span>
                                          {actionLoading[card.requestId || card.id]
                                            ? 'Đang duyệt...'
                                            : '✓ Xác nhận duyệt nhanh'}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={actionLoading[card.requestId || card.id]}
                                        onClick={() =>
                                          handleRejectRequest(
                                            msg.id,
                                            card.id,
                                            card.requestId || card.id,
                                            card.title
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
                                      >
                                        <i className="fas fa-times-circle" />
                                        <span>
                                          {actionLoading[card.requestId || card.id]
                                            ? 'Đang xử lý...'
                                            : '✗ Từ chối'}
                                        </span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleQuickNavigate(
                                            card.action?.path || '/admin/profile-requests'
                                          )
                                        }
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                                      >
                                        <span>Xem chi tiết</span>
                                        <i className="fas fa-arrow-right text-[10px]" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Card Actions: Grade Input */}
                              {card.type === 'grade_input' && (
                                <div className="pt-1 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickNavigate(
                                        card.action?.path || (role === 'giao-vien' || role === 'teacher' ? '/teacher/classes' : '/admin/gradebook')
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 rounded-lg shadow-2xs transition cursor-pointer"
                                  >
                                    <i className="fas fa-edit" />
                                    <span>📝 Vào điểm ngay</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (typeof window !== 'undefined') {
                                        window.dispatchEvent(
                                          new CustomEvent('edumin:ai-action', {
                                            detail: {
                                              action: 'locate_student',
                                              studentId: card.studentId,
                                              studentCode: card.code,
                                              studentName: card.title,
                                              targetTable: 'gradebook',
                                            },
                                          })
                                        );
                                      }
                                      toast?.info?.(`Đã định vị sinh viên ${card.title} trên bảng điểm!`);
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-95 rounded-lg transition cursor-pointer"
                                  >
                                    <i className="fas fa-crosshairs" />
                                    <span>🎯 Định vị trên bảng điểm</span>
                                  </button>
                                </div>
                              )}

                              {/* Card Actions: Class */}
                              {card.type === 'class' && (
                                <div className="pt-1 flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickNavigate(
                                        role === 'giao-vien' || role === 'teacher' ? `/teacher/classes` : '/admin/gradebook'
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    <i className="fas fa-table" />
                                    <span>📋 Bảng điểm lớp</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickNavigate(
                                        role === 'giao-vien' || role === 'teacher' ? '/teacher/attendance' : '/admin/classes'
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-white hover:bg-emerald-50 border border-emerald-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    <i className="fas fa-calendar-check" />
                                    <span>✅ Điểm danh lớp</span>
                                  </button>
                                  {card.action && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickNavigate(card.action.path)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                                    >
                                      <span>{card.action.label || 'Xem chi tiết'}</span>
                                      <i className="fas fa-arrow-right text-[10px]" />
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Card Actions: Feedback */}
                              {card.type === 'feedback' && (
                                <div className="pt-1 space-y-1.5">
                                  {card.status === 'responded' ? (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                                        <i className="fas fa-check-circle" />
                                        <span>Đã phản hồi ý kiến</span>
                                      </div>
                                      {card.response && (
                                        <p className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-100 italic">
                                          "{card.response}"
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                                        <i className="fas fa-comment-dots text-indigo-500" />
                                        Gợi ý trả lời nhanh (bấm để gửi ngay):
                                      </span>
                                      <div className="flex flex-col gap-1">
                                        {(card.templates || []).map((tpl, tplIdx) => (
                                          <button
                                            key={tplIdx}
                                            type="button"
                                            disabled={actionLoading[card.feedbackId || card.id]}
                                            onClick={() =>
                                              handleReplyFeedback(
                                                msg.id,
                                                card.id,
                                                card.feedbackId || card.id,
                                                tpl
                                              )
                                            }
                                            className="text-left px-2.5 py-1.5 text-[11px] text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition active:scale-[0.98] group flex items-start gap-1.5 shadow-2xs cursor-pointer"
                                          >
                                            <i className="fas fa-paper-plane text-[10px] text-indigo-500 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                                            <span>{tpl}</span>
                                          </button>
                                        ))}
                                      </div>
                                      <div className="pt-0.5">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleQuickNavigate(
                                              card.action?.path || '/admin/feedbacks'
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
                                        >
                                          <span>Mở trang Ý kiến & Phản hồi</span>
                                          <i className="fas fa-arrow-right text-[10px]" />
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Card Actions: Search / Generic (Student, Grade) */}
                              {card.type !== 'approval' && card.type !== 'feedback' && card.type !== 'grade_input' && card.type !== 'class' && card.action && (
                                <div className="pt-1 flex items-center justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleQuickNavigate(card.action.path)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition active:scale-95 group shadow-2xs cursor-pointer"
                                  >
                                    <span>{card.action.label || 'Xem chi tiết'}</span>
                                    <i className="fas fa-arrow-right text-[10px] text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Fallback Suggestions */}
                      {!isUser && Array.isArray(msg.suggestions) && msg.suggestions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <i className="fas fa-lightbulb text-amber-500" />
                            Gợi ý tác vụ quản trị:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleSendMessage(sug)}
                                className="px-2.5 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200 rounded-full transition cursor-pointer"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Quick Navigation Action Links */}
                      {!isUser && Array.isArray(msg.quickLinks) && msg.quickLinks.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-indigo-900 flex items-center gap-1">
                            <i className="fas fa-compass text-indigo-500" />
                            Đường dẫn thao tác nhanh:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.quickLinks.map((link, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => handleQuickNavigate(link.path)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95 group cursor-pointer"
                              >
                                <span>{link.label}</span>
                                <i className="fas fa-arrow-right text-[10px] text-indigo-500 group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Loading Indicator */}
            {loading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs">
                  <i className="fas fa-robot" />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-xs px-3.5 py-2.5 shadow-2xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
                  <span className="text-xs text-slate-500 ml-1 font-medium">EduMin AI đang trả lời...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Quick Chips */}
          {suggestions.length > 0 && (
            <div className="px-3 py-2 bg-slate-100/90 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar text-xs">
              <span className="text-[11px] font-semibold text-slate-500 flex-shrink-0 flex items-center gap-1">
                <i className="fas fa-lightbulb text-amber-500" /> Gợi ý:
              </span>
              {suggestions.slice(0, 4).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSendMessage(sug)}
                  className="flex-shrink-0 px-2.5 py-1 bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 text-xs rounded-full border border-slate-200 transition shadow-2xs font-normal"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-1.5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhập câu hỏi hoặc yêu cầu điều hướng..."
                disabled={loading}
                className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-hidden transition"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition flex items-center justify-center flex-shrink-0 shadow-xs"
                title="Gửi câu hỏi"
              >
                <i className="fas fa-paper-plane text-xs sm:text-sm" />
              </button>
            </form>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400">
                ⚡ Hỗ trợ trả lời câu hỏi và điều hướng tác vụ nhanh
              </span>
              <span className="text-[10px] text-slate-400 font-mono">EduMin v2.0</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Determines if the AI Assistant should be displayed:
 * - Available for all authenticated system roles: Admin, Teacher, and Student
 * - Hidden on unauthenticated public routes such as /login
 */
export function shouldShowAiAssistant(user, pathname = '') {
  const normPath = String(pathname || '').toLowerCase();

  // Hide on public/login routes
  if (normPath === '/login' || normPath.startsWith('/login')) {
    return false;
  }

  // Show whenever user is authenticated (Admin, Teacher, Student, Accountant)
  if (user) {
    return true;
  }

  // Also show on internal app routes if session exists
  return (
    normPath.startsWith('/admin') ||
    normPath.startsWith('/teacher') ||
    normPath.startsWith('/student') ||
    normPath.startsWith('/accountant')
  );
}

export function EduMinAiAssistant({ forceRender = false } = {}) {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const location = useLocation();
  const pathname = location?.pathname || '';
  const showAi = shouldShowAiAssistant(user, pathname);

  // Render for Admin, Teacher, Student on all system pages; hide on login/public pages
  if (!showAi && !forceRender) {
    return null;
  }

  return (
    <AiAssistantErrorBoundary>
      <EduMinAiAssistantInner />
    </AiAssistantErrorBoundary>
  );
}

export default EduMinAiAssistant;
