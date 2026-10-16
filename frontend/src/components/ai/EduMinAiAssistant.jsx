import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { useToast } from '../../app/providers/ToastProvider.jsx';
import { aiApi } from '../../api/aiApi.js';
import { profileRequestsApi } from '../../api/profileRequestsApi.js';
import { feedbackApi } from '../../api/feedbackApi.js';
import { notificationsApi } from '../../api/notificationsApi.js';
import { ROLES } from '../../app/navConfig.js';
import { InteractiveQuizCard } from './InteractiveQuizCard.jsx';
import { DocumentSummaryCard } from './DocumentSummaryCard.jsx';
import { ApprovalRequestCard } from './ApprovalRequestCard.jsx';
import { TeacherDocumentCard } from './TeacherDocumentCard.jsx';
import { ChatMessageRenderer } from './ChatMessageRenderer.jsx';

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

/**
 * Cleans markdown and formatting symbols from text to produce natural speech.
 */
export function cleanTextForSpeech(text = '') {
  if (!text) return '';
  return String(text)
    // Remove markdown links [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove code blocks ```...```
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code `...`
    .replace(/`([^`]+)`/g, '$1')
    // Remove tables | a | b |
    .replace(/\|[^\n]+\|/g, ' ')
    // Remove bold/italic markers **text** or *text* or __text__
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove markdown headers #, ##, ###
    .replace(/^#{1,6}\s+/gm, '')
    // Remove markdown bullet points -, *, +, •
    .replace(/^[\s]*[-*+•]\s+/gm, '')
    // Remove blockquotes >
    .replace(/^>\s+/gm, '')
    // Remove remaining asterisks or pipes
    .replace(/[*|]/g, '')
    // Remove emoji symbols that can stutter speech synthesis
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    // Normalize newlines and whitespace
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '.')
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
    norm.includes('phan quyen') ||
    norm.includes('xin quyen') ||
    norm.includes('cap quyen') ||
    norm.includes('kiem tra yeu cau') ||
    norm.includes('yeu cau phu') ||
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
 * Checks whether a target student record represents the current logged-in user in client UI.
 */
export function isCurrentUserStudent(targetStudent, currentUser) {
  if (!targetStudent || !currentUser) return false;
  const role = currentUser.role || '';
  if (role !== 'sinh-vien' && role !== 'student') return false;
  const targetIdStr = String(targetStudent._id || targetStudent.id || '');
  const userStudentStr = String(currentUser.student || currentUser.studentId || currentUser._id || '');
  if (targetIdStr && userStudentStr && targetIdStr === userStudentStr) return true;

  if (targetStudent.email && currentUser.email && targetStudent.email.toLowerCase() === currentUser.email.toLowerCase()) return true;
  if (targetStudent.id != null && currentUser.id != null && Number(targetStudent.id) === Number(currentUser.id)) return true;

  const normTargetName = normalizeText(targetStudent.hoTen || targetStudent.name || '');
  const normUserName = normalizeText(currentUser.hoTen || currentUser.name || '');
  if (normTargetName && normUserName && normTargetName === normUserName) return true;

  return false;
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
    norm.includes('duyet anh dai dien nhanh') ||
    norm.includes('duyet avatar nhanh') ||
    norm.includes('duyet nhanh avatar') ||
    norm.includes('duyet nhanh anh dai dien') ||
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
      norm.includes('hinh nguoi') ||
      norm.includes('nguoi that') ||
      norm.includes('1 nguoi') ||
      norm.includes('chi 1') ||
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

  // 1b. Document Study Intents: Interactive Quiz Generation & Summarization
  const isDocQuizGenerate =
    norm.includes('tao quiz') ||
    norm.includes('sinh quiz') ||
    norm.includes('tao cau hoi kiem tra') ||
    norm.includes('tao bai tap') ||
    norm.includes('tao de thi') ||
    norm.includes('tao de kiem tra') ||
    norm.includes('tao cau hoi trac nghiem') ||
    norm.includes('tao trac nghiem') ||
    norm.includes('ra de quiz') ||
    norm.includes('ra de kiem tra') ||
    norm.includes('cau quiz') ||
    norm.includes('quiz trac nghiem') ||
    norm.includes('bai quiz') ||
    norm.includes('trac nghiem on tap') ||
    norm.includes('de trac nghiem') ||
    (norm.includes('quiz') &&
      (norm.includes('tao') ||
        norm.includes('sinh') ||
        norm.includes('nhanh') ||
        norm.includes('lam quiz') ||
        norm.includes('lam bai quiz') ||
        norm.includes('ra de') ||
        norm.includes('on tap') ||
        norm.includes('tai lieu') ||
        norm.includes('buoi hoc') ||
        norm.includes('mon') ||
        norm.includes('cho lop')));

  if (!norm.includes('huong dan') && !norm.includes('lam sao') && isDocQuizGenerate) {
    return 'DOC_QUIZ_GENERATE';
  }

  const isDocSummarize =
    !isDocQuizGenerate &&
    (norm.includes('tom tat') ||
      norm.includes('y chinh cua tai lieu') ||
      norm.includes('khai niem cot loi') ||
      norm.includes('tom luoc') ||
      norm.includes('phan tich tai lieu') ||
      norm.includes('phan tich noi dung') ||
      norm.includes('phan tich file') ||
      norm.includes('doc tai lieu') ||
      norm.includes('doc file') ||
      ((norm.includes('tai lieu') || norm.includes('bai giang') || norm.includes('tep') || norm.includes('file')) &&
        (norm.includes('y chinh') || norm.includes('noi dung chinh') || norm.includes('chuong 1') || norm.includes('chuong 2') || norm.includes('chuong 3') || norm.includes('phan tich') || norm.includes('doc'))));

  if (isDocSummarize) {
    return 'DOC_SUMMARIZE';
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

  // Schedule / Room Change Query ("Lớp tôi vừa đổi phòng nào thế AI?", "Lớp đổi phòng nào", "Có đổi phòng không", "Phòng mới của lớp tôi")
  const isScheduleChangeQuery =
    norm.includes('doi phong nao') ||
    norm.includes('doi sang phong nao') ||
    norm.includes('phong moi cua lop') ||
    norm.includes('phong moi la phong nao') ||
    (norm.includes('doi phong') && (norm.includes('the ai') || norm.includes('lop toi') || norm.includes('nao') || norm.includes('o dau') || norm.includes('the nao'))) ||
    norm.includes('vua doi phong') ||
    norm.includes('vua doi lich') ||
    norm.includes('thong bao doi lich') ||
    norm.includes('doi tiet nao');

  if (isScheduleChangeQuery) {
    return 'SCHEDULE_ROOM_CHANGE_QUERY';
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

  // 0. Specialized Role-Based Prompts (Explicitly requested by user prompts)
  const isSetCriteria =
    (norm.includes('tieu chuan duyet') ||
      norm.includes('tieu chi duyet') ||
      norm.includes('ra tieu chi') ||
      norm.includes('dat tieu chi') ||
      norm.includes('thiet lap tieu chi') ||
      norm.includes('cai dat tieu chi') ||
      norm.includes('tieu chi cho ai') ||
      norm.includes('dieu kien kiem duyet') ||
      norm.includes('quy dinh duyet') ||
      norm.includes('dat tieu chuan') ||
      norm.includes('thiet lap tieu chuan') ||
      (norm.includes('tieu chuan') && norm.includes('ho so')) ||
      (norm.includes('tieu chi') && (norm.includes('ho so') || norm.includes('duyet') || norm.includes('admin') || norm.includes('ai'))) ||
      norm.includes('dieu kien duyet')) &&
    (norm.includes('sdt') ||
      norm.includes('dien thoai') ||
      norm.includes('cccd') ||
      norm.includes('ly do') ||
      norm.includes('avatar') ||
      norm.includes('hinh nguoi') ||
      norm.includes('nguoi that') ||
      norm.includes('1 nguoi') ||
      norm.includes('chi 1') ||
      norm.includes('dat') ||
      norm.includes('thiet lap') ||
      norm.includes('chi duyet') ||
      norm.includes('khong duyet') ||
      norm.includes('dung') ||
      norm.includes('10 so') ||
      norm.includes('12 so') ||
      norm.includes('tieu chi') ||
      norm.includes('tu dong'));
  if (isSetCriteria) {
    return 'ADMIN_SET_CRITERIA';
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
    norm.includes('duyet anh dai dien nhanh') ||
    norm.includes('duyet avatar nhanh') ||
    norm.includes('duyet nhanh avatar') ||
    norm.includes('duyet nhanh anh dai dien') ||
    (norm.includes('duyet') && (norm.includes('tieu chuan') || norm.includes('tieu chi') || norm.includes('dieu kien')));
  if (isApplyCriteria) {
    return 'ADMIN_APPLY_CRITERIA_APPROVAL';
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
export function getSmartAiResponse(rawText = '', role = '', user = null, currentPath = '', pageContext = null) {
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
    text.includes('gop y') ||
    text.includes('o dau') ||
    text.includes('dang o') ||
    text.includes('trang nay') ||
    text.includes('o day') ||
    text.includes('day la dau');

  const extracted = !isExcludedFromPersonnel ? extractPersonnelQuery(rawText) : null;
  const isCandidateNameLikely =
    extracted &&
    (extracted.idNumber ||
      (extracted.candidateName &&
        extracted.candidateName.length >= 2 &&
        !OUT_OF_SCOPE_KEYWORDS.some((k) => text === k || text.startsWith(k + ' '))));

  const intent = classifyAiIntent(rawText, { role, currentPath, pageContext });

  // 0. Location / Current Page Awareness
  if (currentPath) {
    const normPath = currentPath.toLowerCase().trim();
    const currentPageMatch =
      PAGE_INFO.find((p) => normPath === p.path) ||
      PAGE_INFO.filter((p) => p.path !== '/' && normPath.startsWith(p.path + '/')).sort(
        (a, b) => b.path.length - a.path.length
      )[0];

    const isActionOrContentQuery =
      intent === 'DOC_QUIZ_GENERATE' ||
      intent === 'DOC_SUMMARIZE' ||
      text.includes('quiz') ||
      text.includes('trac nghiem') ||
      text.includes('cau quiz') ||
      text.includes('tao de') ||
      text.includes('sinh de') ||
      text.includes('ra de') ||
      text.includes('on tap') ||
      text.includes('tom tat') ||
      text.includes('khai niem cot loi') ||
      text.includes('tao bai tap') ||
      text.includes('xuat ban') ||
      text.includes('giao bai') ||
      text.includes('cham diem') ||
      text.includes('nhap diem') ||
      text.includes('vao diem') ||
      text.includes('tinh diem');

    if (
      currentPageMatch &&
      !isActionOrContentQuery &&
      !extractStudentGradeQuery(rawText) &&
      !isCandidateNameLikely
    ) {
      const isAskingAboutCurrentPage =
        currentPageMatch.keywords.some((kw) => text.includes(kw)) ||
        text.includes('trang nay') ||
        text.includes('o day') ||
        text.includes('lam gi o day') ||
        text.includes('dang o dau') ||
        text.includes('day la dau') ||
        text.includes('trang hien tai');

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

  // 0a.-0w Admin Get Active Criteria ("xem tiêu chí duyệt")
  if (intent === 'ADMIN_GET_CRITERIA') {
    return {
      matched: true,
      reply:
        `📋 **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG ĐANG ÁP DỤNG ĐÓN ĐẦU**\n\n` +
        `• **Nội dung quy chuẩn:** SĐT đủ 10 số • CCCD đủ 12 số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD) • Có lý do thay đổi rõ ràng\n` +
        `• **Tiêu chí kiểm định tự động:**\n` +
        `  ✓ Số điện thoại bắt buộc đủ 10 chữ số\n` +
        `  ✓ Căn cước công dân (CCCD): Đủ 12 chữ số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD)\n` +
        `  ✓ Bắt buộc ghi rõ lý do cập nhật\n` +
        `• **Cơ chế đón đầu:** Mọi yêu cầu thay đổi mới gửi từ Sinh viên & Giảng viên sẽ được AI đối soát tự động tức thì ngay khi gửi.\n\n` +
        `Bạn có thể yêu cầu "Xóa tiêu chí kiểm duyệt" nếu muốn chuyển về duyệt thủ công toàn bộ.`,
      intent: 'ADMIN_GET_CRITERIA',
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
      suggestions: ['Duyệt hồ sơ theo tiêu chuẩn', 'Cho tôi xem ý kiến người dùng', 'Xóa tiêu chí kiểm duyệt'],
    };
  }

  // 0a.-0v Admin Clear Criteria ("xóa tiêu chí duyệt")
  if (intent === 'ADMIN_CLEAR_CRITERIA') {
    return {
      matched: true,
      reply: '🗑️ Đã xóa bỏ quy chuẩn kiểm duyệt tự động. Mọi yêu cầu thay đổi mới từ Sinh viên & Giảng viên sẽ được giữ lại ở trạng thái Chờ duyệt thủ công.',
      intent: 'ADMIN_CLEAR_CRITERIA',
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
    };
  }

  // 0a.-0x Admin Criteria Setup ("tiêu chuẩn duyệt: ...", "ra yêu cầu duyệt: ...")
  if (intent === 'ADMIN_SET_CRITERIA') {
    const isAvatarCriteria = text.includes('avatar') || text.includes('anh dai dien') || text.includes('hinh nguoi') || text.includes('1 nguoi');
    const summaryText = isAvatarCriteria
      ? 'Avatar phải là hình người và chỉ 1 người (ảnh chân dung/ảnh thẻ, không phải con vật/đồ vật/anime/nhóm người)'
      : 'SĐT 10 số, CCCD 12 số (sẵn sàng cho cải tiến, không ràng buộc) và có lý do thay đổi rõ ràng';

    const bullets = isAvatarCriteria
      ? '  ✓ Avatar bắt buộc là hình người thật và chỉ có đúng 1 người\n  ✓ Không duyệt ảnh con vật, đồ vật, tranh vẽ, anime, hoạt hình hoặc ảnh nhóm nhiều người\n'
      : '  ✓ Số điện thoại bắt buộc đủ 10 chữ số\n  ✓ Căn cước công dân (CCCD): Đủ 12 chữ số (sẵn sàng cho cải tiến, không ràng buộc khi form chưa có trường nhập CCCD)\n  ✓ Bắt buộc ghi rõ lý do cập nhật\n';

    return {
      matched: true,
      reply:
        `🛡️ **QUY CHUẨN KIỂM DUYỆT TỰ ĐỘNG ĐÃ ĐƯỢC THIẾT LẬP ĐÓN ĐẦU (PRE-CONFIGURED POLICY)**\n\n` +
        `Quy chuẩn kiểm duyệt tự động đã được lưu và kích hoạt trước trên toàn hệ thống:\n` +
        `• **Nội dung tiêu chuẩn:** ${summaryText}\n` +
        `• **Tiêu chí kiểm định đón đầu:**\n` +
        bullets +
        `\n⚡ **Cơ chế kiểm duyệt đón đầu tự động:**\n` +
        `Từ thời điểm này trở đi, bất kỳ khi nào Sinh viên hoặc Giảng viên gửi yêu cầu chỉnh sửa hồ sơ hoặc đổi avatar, EduMin AI sẽ lập tức đối soát tự động:\n` +
        `- ✅ **Nếu đạt chuẩn:** Tự động phê duyệt nhanh ngay lập tức và đồng bộ vào cơ sở dữ liệu.\n` +
        `- ⚠️ **Nếu không đạt chuẩn:** Giữ nguyên hồ sơ ở trạng thái Chờ duyệt (Pending) tại trang Duyệt yêu cầu kèm lý do chưa đạt chuẩn để Admin xem xét thủ công.\n\n` +
        `📌 *Hệ thống đang ở trạng thái trực ban sẵn sàng kiểm duyệt đón đầu mọi thay đổi mới.*`,
      intent: 'ADMIN_SET_CRITERIA',
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
      suggestions: ['Xem tiêu chí duyệt hiện tại', 'Duyệt hồ sơ theo tiêu chuẩn', 'Cho tôi xem ý kiến người dùng'],
    };
  }

  // 0a.-0y Admin Apply Criteria Approval ("duyệt hồ sơ theo tiêu chuẩn")
  if (intent === 'ADMIN_APPLY_CRITERIA_APPROVAL') {
    const cards = [
      {
        type: 'approval',
        id: 'req-02',
        requestId: 'req-02',
        title: 'Quyền Huế Trân',
        code: 'Yêu cầu #002',
        subtitle: '✗ Chưa đạt chuẩn: Thiếu lý do thay đổi (Giữ lại bên phần Duyệt)',
        meta: 'Email: quyen@student.edu.vn • Sinh viên',
        status: 'pending',
        meetsCriteria: false,
        details: [
          { label: 'Người gửi', value: 'Quyền Huế Trân' },
          { label: 'Loại yêu cầu', value: 'Cập nhật thông tin' },
          { label: 'Trạng thái', value: 'Chờ duyệt (Chưa đạt chuẩn)' },
          { label: 'Lý do giữ lại', value: 'Thiếu lý do thay đổi' },
        ],
        action: { label: 'Xem tại phần Duyệt', path: '/admin/profile-requests' },
        actions: [
          { actionType: 'NAVIGATE', label: 'Xem tại phần Duyệt', path: '/admin/profile-requests' },
          { actionType: 'REJECT_REQUEST', label: 'Từ chối yêu cầu', icon: 'fas fa-times-circle', variant: 'danger', payload: { requestId: 'req-02', requesterName: 'Quyền Huế Trân' } },
        ],
      },
    ];

    return {
      matched: true,
      reply:
        `⚡ **KẾT QUẢ XỬ LÝ THEO TIÊU CHUẨN CỦA ADMIN**\n\n` +
        `• **Tiêu chuẩn đang áp dụng:** SĐT đủ 10 số, CCCD đủ 12 số, lý do thay đổi rõ ràng\n` +
        `• **Tổng số yêu cầu:** 2 hồ sơ\n\n` +
        `✅ **ĐÃ TỰ ĐỘNG DUYỆT NHANH (1 hồ sơ đạt chuẩn):**\n` +
        `  1. **Nguyễn Văn An** (Sinh viên): Đạt tiêu chuẩn, đã được phê duyệt và cập nhật vào hồ sơ.\n\n` +
        `⚠️ **HỒ SƠ KHÔNG ĐẠT TIÊU CHUẨN (1 hồ sơ — Giữ lại bên phần Duyệt):**\n` +
        `  1. **Quyền Huế Trân** (Sinh viên): Thiếu lý do thay đổi → *Giữ nguyên ở trạng thái Chờ duyệt để Admin kiểm tra lại*.\n\n` +
        `📌 Hồ sơ chưa đạt chuẩn trên được giữ nguyên tại trang **Duyệt yêu cầu** để Admin xem xét và xử lý thủ công:`,
      intent: 'ADMIN_APPLY_CRITERIA_APPROVAL',
      cards,
      quickLinks: [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }],
      suggestions: ['Duyệt tất cả hồ sơ đạt tiêu chuẩn', 'Cho tôi xem ý kiến người dùng'],
    };
  }

  // 0a.-0z Admin View User Desires
  if (intent === 'ADMIN_VIEW_USER_DESIRES') {
    const teacherTable = `| STT | Giảng viên | Đề xuất / Nguyện vọng | Phân loại | Trạng thái |\n` +
                         `|:---:|:---|:---|:---|:---:|\n` +
                         `| 1 | **Thầy Trần Đình** | Đề xuất nhà trường nâng cấp máy chiếu phòng C201 do bóng đèn bị mờ | Cơ sở vật chất | Chờ xem xét |\n` +
                         `| 2 | **Cô Lê Thu Hà** | Mong muốn mở thêm 1 lớp thực hành Lập trình Web vào sáng thứ Bảy | Học phần & Mở lớp | Chờ xem xét |\n`;

    const studentTable = `| STT | Sinh viên | Ý kiến / Mong muốn | Phân loại | Trạng thái |\n` +
                         `|:---:|:---|:---|:---|:---:|\n` +
                         `| 1 | **Quyền Huế Trân (SV-002)** | Em muốn xin mở thêm lớp học phần Tiếng Anh 1 vào kỳ phụ hè để kịp trả nợ môn | Học phần & Mở lớp | Chờ xem xét |\n` +
                         `| 2 | **Nguyễn Văn An (SV-001)** | Mong nhà trường gia hạn nộp học phí thêm 1 tuần để sinh viên kịp chuẩn bị | Học phí & Chính sách | Chờ xem xét |\n` +
                         `| 3 | **Trần Minh Quân (SV-003)** | Đề xuất thư viện khu B tăng thời gian mở cửa tới 21h | Cơ sở vật chất | Chờ xem xét |\n`;

    return {
      matched: true,
      reply:
        `📊 **TỔNG HỢP Ý KIẾN & NGUYỆN VỌNG NGƯỜI DÙNG (GIẢNG VIÊN & SINH VIÊN)**\n\n` +
        `Hệ thống đã ghi nhận 2 ý kiến từ Giảng viên và 3 ý kiến từ Sinh viên qua tương tác với Trợ lý ảo:\n\n` +
        `👨‍🏫 **Ý kiến & Đề xuất từ Giảng viên:**\n` +
        teacherTable +
        `\n👨‍🎓 **Ý kiến & Nguyện vọng từ Sinh viên:**\n` +
        studentTable +
        `\nBạn có thể quản lý và phản hồi chi tiết tại mục "Ý kiến & Phản hồi" hoặc bấm các đường dẫn nhanh bên dưới:`,
      intent: 'ADMIN_VIEW_USER_DESIRES',
      quickLinks: [{ label: 'Mở trang Ý kiến & Phản hồi', path: '/admin/feedbacks' }],
      suggestions: ['Duyệt hồ sơ theo tiêu chuẩn', 'Có yêu cầu nào mới không?'],
    };
  }

  // 0a.-0w Record User Desire
  if (intent === 'RECORD_USER_DESIRE') {
    let category = 'Đề xuất chung';
    if (text.includes('lop') || text.includes('mon')) category = 'Học phần & Mở lớp';
    else if (text.includes('hoc phi') || text.includes('tien hoc')) category = 'Học phí & Chính sách';
    else if (text.includes('lich') || text.includes('thi') || text.includes('doi gio')) category = 'Lịch học & Thi';
    else if (text.includes('phong') || text.includes('may lanh') || text.includes('wifi') || text.includes('thu vien')) category = 'Cơ sở vật chất';

    return {
      matched: true,
      reply:
        `Dạ, EduMin đã ghi nhận ý kiến/nguyện vọng của bạn:\n\n` +
        `> *"${rawText}"*\n\n` +
        `• **Phân loại:** **${category}**\n` +
        `• **Trạng thái:** Đã lưu vào hệ thống và sẽ được tổng hợp gửi đến Phòng Đào tạo (Admin) khi quản trị viên kiểm tra ý kiến người dùng.\n\n` +
        `Cảm ơn bạn đã đóng góp để giúp nhà trường nâng cao chất lượng dịch vụ đào tạo!`,
      intent: 'RECORD_USER_DESIRE',
      quickLinks: [{ label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : '/student' }],
    };
  }

  // 0a.-0t Teacher Calculate Grades
  if (intent === 'TEACHER_CALCULATE_GRADES') {
    const studentRows = [
      { idx: 1, code: 'SV-001', name: 'Nguyễn Văn An', attendance: '10.0', quiz: '8.5', process: '8.95', neededFinal: '≥ 1.5', rating: 'Rất tốt' },
      { idx: 2, code: 'SV-002', name: 'Quyền Huế Trân', attendance: '9.0', quiz: '9.5', process: '9.35', neededFinal: '≥ 1.5', rating: 'Xuất sắc' },
      { idx: 3, code: 'SV-003', name: 'Trần Minh Quân', attendance: '8.0', quiz: '7.0', process: '7.30', neededFinal: '≥ 2.5', rating: 'Khá' },
      { idx: 4, code: 'SV-004', name: 'Phạm Thị Bình', attendance: '6.0', quiz: '5.5', process: '5.65', neededFinal: '≥ 3.5', rating: 'Cần cố gắng' },
    ];

    let table = `| STT | Mã SV | Họ và tên | Chuyên cần (30%) | Điểm Quiz (70%) | Điểm quá trình | Thi CK cần đạt | Đánh giá |\n` +
                `|:---:|:---|:---|:---:|:---:|:---:|:---:|:---|\n`;
    studentRows.forEach((r) => {
      table += `| ${r.idx} | ${r.code} | ${r.name} | ${r.attendance} | ${r.quiz} | **${r.process}** | ${r.neededFinal} | ${r.rating} |\n`;
    });

    return {
      matched: true,
      reply:
        `🧮 **BẢNG TÍNH ĐIỂM QUÁ TRÌNH TỰ ĐỘNG CHO LỚP LẬP TRÌNH WEB (IT101)**\n\n` +
        `• **Công thức tính:** \`Điểm quá trình = Chuyên cần × 30% + Điểm Quiz × 70%\`\n` +
        `• **Điểm quá trình trung bình cả lớp:** **7.81 / 10**\n` +
        `• **Dự phóng điểm thi:** Cột "Thi CK cần đạt" là mức điểm tối thiểu để đạt điểm tổng kết môn ≥ 4.0 (qua môn).\n\n` +
        table +
        `\nThầy/Cô có thể đối soát và lưu vào sổ điểm chính thức qua các thao tác nhanh bên dưới:`,
      intent: 'TEACHER_CALCULATE_GRADES',
      quickLinks: [
        { label: 'Bảng điểm lớp học phần', path: '/teacher/classes' },
        { label: 'Điểm danh & Chuyên cần', path: '/teacher/attendance' },
      ],
      suggestions: ['Lịch dạy của tôi tuần này', 'Danh sách lớp tôi phụ trách'],
    };
  }

  // 0a.-0s Student Academic Report
  if (intent === 'STUDENT_ACADEMIC_REPORT') {
    const reportRows = [
      { code: 'IT101', name: 'Lập trình Web', att: '10.0', quiz: '9.0', midterm: '8.5', final: '8.5', total: '8.8', eval: 'Nắm chắc React, hoàn thành quiz xuất sắc' },
      { code: 'IT102', name: 'Cơ sở dữ liệu', att: '9.0', quiz: '8.0', midterm: '8.0', final: '7.5', total: '7.9', eval: 'Chuyên cần tốt, cần củng cố câu lệnh SQL nâng cao' },
      { code: 'ENG01', name: 'Tiếng Anh 1', att: '9.5', quiz: '8.5', midterm: '8.5', final: '8.0', total: '8.4', eval: 'Phát âm chuẩn, tích cực tham gia thảo luận' },
    ];

    let table = `| Mã HP | Tên học phần | Chuyên cần | Quiz/BT | Giữa kỳ | Cuối kỳ | Tổng kết | Đánh giá của Giảng viên |\n` +
                `|:---|:---|:---:|:---:|:---:|:---:|:---:|:---|\n`;
    reportRows.forEach((r) => {
      table += `| ${r.code} | ${r.name} | ${r.att} | ${r.quiz} | ${r.midterm} | ${r.final} | **${r.total}** | ${r.eval} |\n`;
    });

    return {
      matched: true,
      reply:
        `🎓 **BÁO CÁO TÌNH HÌNH HỌC TẬP & ĐÁNH GIÁ CỦA GIẢNG VIÊN**\n\n` +
        `• **Sinh viên:** **Quyền Huế Trân** (SV-002)\n` +
        `• **Điểm trung bình tích lũy:** **8.37 / 10** (3.35 / 4.0) — Xếp loại: **Khá Giỏi**\n` +
        `• **Tình hình chuyên cần:** Tỷ lệ có mặt đạt **96%** (An toàn, không có nguy cơ cấm thi môn nào).\n\n` +
        table +
        `\n💡 **Nhận xét & Lời khuyên từ EduMin:**\n` +
        `• Bạn đang có kết quả rất tốt ở môn Lập trình Web và Tiếng Anh 1. Hãy tiếp tục phát huy.\n` +
        `• Ở môn Cơ sở dữ liệu, giảng viên lưu ý cần chú ý làm bài tập SQL nâng cao để đạt điểm A ở kỳ thi sắp tới.`,
      intent: 'STUDENT_ACADEMIC_REPORT',
      quickLinks: [
        { label: 'Bảng điểm & Chuyên cần', path: '/student/attendance' },
        { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
      ],
      suggestions: ['Lọc cho mình những môn có điểm cao nhất đi', 'Thời khóa biểu tuần này của tôi'],
    };
  }

  // 0a.-0r Schedule / Room Change Query ("Lớp tôi vừa đổi phòng nào thế AI?", "Lớp đổi phòng nào")
  if (intent === 'SCHEDULE_ROOM_CHANGE_QUERY') {
    let scheduleInfo = null;
    try {
      if (typeof window !== 'undefined') {
        const stored = sessionStorage.getItem('edumin_latest_schedule_change');
        if (stored) scheduleInfo = JSON.parse(stored);
      }
    } catch {}

    const classCode = scheduleInfo?.classCode || scheduleInfo?.targetClassId || pageContext?.selectedClassId || 'CNTT101-01';
    const oldRoom = scheduleInfo?.oldRoom || 'A1-201';
    const newRoom = scheduleInfo?.newRoom || 'B2-405';
    const date = scheduleInfo?.date || 'tuần này';
    const oldShift = scheduleInfo?.oldShift || 'Sáng (Tiết 1 - 3)';
    const newShift = scheduleInfo?.newShift || 'Sáng (Tiết 1 - 3)';
    const reason = scheduleInfo?.reason || 'Bảo trì trang thiết bị phòng học';
    const senderName = scheduleInfo?.senderName || 'Giảng viên phụ trách';

    const reply =
      `🏢 **THÔNG TIN ĐIỀU CHỈNH PHÒNG HỌC & LỊCH HỌC**\n\n` +
      `Theo thông báo mới nhất từ **${senderName}** dành cho lớp **${classCode}**:\n` +
      `• **Phòng học cũ:** ${oldRoom}\n` +
      `• **Phòng học mới (Chính thức):** **${newRoom}**\n` +
      `• **Thời gian áp dụng:** Ngày **${date}** (${newShift})\n` +
      `• **Lý do thay đổi:** ${reason}\n\n` +
      `Bạn và các bạn cùng lớp nhớ di chuyển đúng phòng **${newRoom}** nhé! Bạn có muốn tôi xem lại thời khóa biểu mới không?`;

    return {
      matched: true,
      intent: 'SCHEDULE_ROOM_CHANGE_QUERY',
      reply,
      quickLinks: [
        { label: 'Xem Thời khóa biểu mới', path: isTeacher ? '/teacher/schedule' : '/student/timetable' },
        { label: 'Lớp học phần', path: isTeacher ? '/teacher/classes' : '/student/attendance' },
      ],
      suggestions: [
        'Xem thời khóa biểu tuần này ở đâu?',
        'Cách xem chuyên cần và điểm danh',
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

  // 0a.-0e Document Summarization Intent ("tóm tắt giúp tôi các ý chính của tài liệu chương 1 môn [Tên môn]", "tóm tắt tài liệu...")
  if (intent === 'DOC_SUMMARIZE') {
    const chapterMatch = rawText.match(/(?:chương|chuong|bài|bai|phần|phan)\s+(\d+)/i);
    const chapter = chapterMatch ? `Chương ${chapterMatch[1]}` : 'Chương 1';

    let courseName = pageContext?.selectedStudySubject || pageContext?.courseName || 'Lập trình Web';
    let courseCode = 'CNTT101';
    let classId = 'CNTT101-01';

    const norm = normalizeText(rawText);
    if (norm.includes('sql') || norm.includes('du lieu') || norm.includes('database') || norm.includes('csdl')) {
      courseName = 'Cơ sở dữ liệu';
      courseCode = 'CS102';
      classId = 'CS102-01';
    } else if (norm.includes('mang') || norm.includes('network')) {
      courseName = 'Mạng máy tính';
      courseCode = 'IT103';
      classId = 'IT103-01';
    } else if (norm.includes('web') || norm.includes('react') || norm.includes('javascript') || norm.includes('frontend')) {
      courseName = 'Lập trình Web';
      courseCode = 'CNTT101';
      classId = 'CNTT101-01';
    } else if (courseName === 'Cơ sở dữ liệu') {
      courseCode = 'CS102';
      classId = 'CS102-01';
    } else if (courseName === 'Mạng máy tính') {
      courseCode = 'IT103';
      classId = 'IT103-01';
    }

    const coreConcepts = courseCode === 'CS102'
      ? [
          { concept: 'Nguyên lý ACID', definition: 'Bốn tính chất cốt lõi của giao dịch cơ sở dữ liệu: Atomicity, Consistency, Isolation, Durability.', formula: 'ACID = \\{Atomicity, Consistency, Isolation, Durability\\}' },
          { concept: 'Chuẩn hóa 2NF & 3NF', definition: 'Phân rã lược đồ để loại bỏ phụ thuộc một phần và phụ thuộc bắc cầu, triệt tiêu dư thừa dữ liệu.', formula: '1NF \\subset 2NF \\subset 3NF \\subset BCNF' },
          { concept: 'Phép kết nối (JOIN)', definition: 'Kết hợp dữ liệu từ nhiều bảng dựa trên khóa chính (Primary Key) và khóa ngoại (Foreign Key).', formula: 'R \\bowtie_{R.id = S.r\\_id} S' },
        ]
      : [
          { concept: 'Virtual DOM & Diffing', definition: 'Bản sao ảo của DOM thực tế trong bộ nhớ, cho phép tính toán sự khác biệt và cập nhật tối thiểu giúp tăng hiệu năng.', formula: 'Diff(V_{DOM}^{old}, V_{DOM}^{new}) \\rightarrow Patch(DOM_{real})' },
          { concept: 'React Hooks (useState & useEffect)', definition: 'Hàm đặc biệt quản lý trạng thái nội bộ và xử lý tác vụ ngoại biên (side-effects) trong functional component.', formula: 'const [state, setState] = useState(initialValue);' },
          { concept: 'Mô hình CSS Flexbox', definition: 'Bố cục một chiều linh hoạt theo trục chính (Main axis) và trục phụ (Cross axis), tự động thích ứng với kích thước màn hình.', formula: 'display: flex; justify-content: center; align-items: center;' },
        ];

    const docSource = pageContext?.attachedFile?.name || `GiaoTrinh_${courseCode}.pdf`;
    const docTitle = pageContext?.attachedFile?.name
      ? `Bản tóm tắt: ${pageContext.attachedFile.name}`
      : `Bản tóm tắt: Giáo trình ${courseName}`;

    const summaryMarkdown =
      `### 📖 Tóm tắt kiến thức trọng tâm: ${pageContext?.attachedFile?.name || `Giáo trình ${courseName}`}\n` +
      `**Học phần:** ${courseName} (${courseCode}) | **Lớp:** \`${classId}\`  \n` +
      `**Phạm vi:** ${chapter} (Khái niệm & Cơ sở lý thuyết) | **Tài liệu nguồn:** \`${docSource}\`\n\n` +
      `---\n\n` +
      `#### 📌 1. Các Khái niệm Cốt lõi (Core Concepts)\n` +
      coreConcepts.map((c) => `- **${c.concept}**: ${c.definition}\n  > ⚡ *Công thức/Cú pháp:* \`${c.formula}\``).join('\n') +
      `\n\n---\n\n` +
      `#### 📋 2. Ý chính tóm tắt theo nội dung bài học\n` +
      `- **Cơ sở lý thuyết & Kiến trúc:** Nắm vững cấu trúc mô hình, quy chuẩn phân loại và nguyên tắc vận hành cốt lõi.\n` +
      `- **Phương pháp phân tích & Kỹ thuật then chốt:** Vận dụng các cú pháp và quy tắc logic đã học để xây dựng mã nguồn/truy vấn chuẩn hóa.\n` +
      `- **Tối ưu hóa hiệu năng:** Tránh các bẫy re-render không cần thiết hoặc truy vấn N+1 làm giảm tốc độ thực thi của hệ thống.\n\n` +
      `---\n\n` +
      `#### 💡 3. Lưu ý then chốt khi ôn thi & Làm bài tập\n` +
      `> [!TIP]\n` +
      `> Phân biệt rõ các khái niệm tương đồng và ghi nhớ các điều kiện biên của từng công thức trước khi làm bài thi.`;

    const card = {
      id: `summary-${Date.now()}`,
      type: 'document_summary',
      title: docTitle,
      subtitle: `${courseName} • ${chapter}`,
      code: classId,
      summaryMarkdown,
      coreConcepts,
      role: isTeacher ? 'teacher' : 'student',
      details: [
        { label: 'Học phần', value: courseName },
        { label: 'Tài liệu nguồn', value: docSource },
        { label: 'Phạm vi', value: chapter },
        { label: 'Mã lớp', value: classId },
        { label: 'Mục đích', value: isTeacher ? 'Tóm tắt bài giảng lớp' : 'Tự học & Ôn tập' },
      ],
      action: {
        label: isTeacher ? '🎯 Tạo đề Quiz cho lớp' : 'Tạo 5 câu Quiz ôn tập',
        path: isTeacher ? '/teacher/assignments' : '/student/documents',
      },
    };

    return {
      matched: true,
      reply: summaryMarkdown,
      intent: 'DOC_SUMMARIZE',
      summaryData: { documentName: docSource, courseName, classId, chapter, summaryMarkdown, coreConcepts },
      cards: [card],
      quickLinks: isTeacher
        ? [
            { label: 'Quản lý Tài liệu lớp', path: '/teacher/documents' },
            { label: 'Tạo bài tập cho lớp', path: '/teacher/assignments' },
          ]
        : [
            { label: 'Mở Tài liệu học tập', path: '/student/documents' },
            { label: 'Mở Bài tập & Quiz', path: '/student/assignments' },
          ],
      suggestions: isTeacher
        ? [
            `⚡ Tạo Quiz nhanh từ tài liệu môn ${courseName}`,
            `Tạo bộ 5 câu hỏi quiz trắc nghiệm môn ${courseName}`,
            `Tóm tắt Chương 2 tài liệu môn ${courseName}`,
            'Danh sách lớp tôi đang phụ trách',
          ]
        : [
            `Tóm tắt nội dung trọng tâm môn ${courseName}`,
            `Giải thích các khái niệm cốt lõi môn ${courseName}`,
            'Xem bài tập & làm quiz trên lớp',
          ],
    };
  }

  // 0a.-0f Interactive Quiz Generation Intent ("tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file tài liệu buổi học hôm nay")
  if (intent === 'DOC_QUIZ_GENERATE') {
    const norm = normalizeText(rawText);
    let courseName = pageContext?.courseName || pageContext?.selectedStudySubject || 'Lập trình Web';
    let courseCode = pageContext?.courseId || 'CNTT101';
    let classId = pageContext?.classId || 'CNTT101-01';

    if (!isTeacher) {
      return {
        matched: true,
        reply:
          `🔒 **Thông báo phân quyền:**\n\n` +
          `Tính năng **Tạo câu hỏi Quiz / Bài tập trắc nghiệm từ tài liệu** qua Chat Box được thiết kế dành riêng cho **Giảng viên** để phục vụ việc soạn đề và giao bài tập cho lớp học phần.\n\n` +
          `👉 *Bạn vui lòng vào mục **[Bài tập & Đánh giá](/student/assignments)** để xem danh sách các bài quiz, bài kiểm tra do Thầy/Cô giao và tiến hành làm bài nhé!*`,
        intent: 'DOC_QUIZ_GENERATE',
        quickLinks: [
          { label: 'Mở Bài tập & Quiz', path: '/student/assignments' },
          { label: 'Xem Tài liệu học tập', path: '/student/documents' },
        ],
        suggestions: [
          `Tóm tắt ý chính tài liệu môn ${courseName}`,
          'Xem bài tập & làm quiz trên lớp',
          'Thời khóa biểu tuần này của tôi',
        ],
      };
    }

    if (norm.includes('sql') || norm.includes('du lieu') || norm.includes('database') || norm.includes('csdl')) {
      courseName = 'Cơ sở dữ liệu';
      courseCode = 'CS102';
      classId = 'CS102-01';
    } else if (norm.includes('web') || norm.includes('react') || norm.includes('javascript') || norm.includes('frontend')) {
      courseName = 'Lập trình Web';
      courseCode = 'CNTT101';
      classId = 'CNTT101-01';
    } else if (courseName === 'Cơ sở dữ liệu') {
      courseCode = 'CS102';
      classId = 'CS102-01';
    }
    const courseId = pageContext?.courseId || courseCode;

    const questions = courseCode === 'CS102'
      ? [
          {
            id: 'q1',
            question: 'Thuộc tính nào trong nguyên lý ACID đảm bảo rằng một giao dịch phải hoàn tất toàn bộ các thao tác, hoặc nếu có lỗi thì hoàn tác sạch sẽ (All-or-Nothing)?',
            options: ['A. Consistency (Tính nhất quán)', 'B. Atomicity (Tính nguyên tử)', 'C. Isolation (Tính cô lập)', 'D. Durability (Tính bền vững)'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): Atomicity (Tính nguyên tử) đảm bảo rằng tất cả các câu lệnh trong giao dịch được thực thi trọn vẹn; nếu một thao tác thất bại, toàn bộ giao dịch sẽ bị Rollback về trạng thái ban đầu.',
            concept: 'Nguyên lý ACID',
          },
          {
            id: 'q2',
            question: 'Một lược đồ quan hệ đạt dạng chuẩn 2NF (Second Normal Form) khi và chỉ khi thỏa mãn điều kiện nào sau đây?',
            options: ['A. Đạt dạng chuẩn 1NF và không chứa thuộc tính không khóa nào phụ thuộc một phần vào khóa chính', 'B. Có ít nhất 3 khóa ngoại trỏ đến các bảng khác', 'C. Không chứa bất kỳ giá trị NULL nào', 'D. Bảng chỉ được phép có tối đa 10 cột'],
            correctIndex: 0,
            explanation: 'Giải thích chi tiết (Rationale): Dạng chuẩn 2NF yêu cầu bảng đạt 1NF (mọi giá trị nguyên tử) và mọi thuộc tính không khóa phải phụ thuộc hàm đầy đủ vào toàn bộ khóa chính.',
            concept: 'Chuẩn hóa Dữ liệu (2NF)',
          },
          {
            id: 'q3',
            question: 'Trong câu lệnh SQL SELECT, mệnh đề HAVING khác với mệnh đề WHERE ở điểm mấu chốt nào?',
            options: ['A. HAVING lọc các nhóm sau khi gom nhóm (GROUP BY) và hàm tổng hợp, còn WHERE lọc từng dòng riêng lẻ', 'B. WHERE chỉ dùng cho số, HAVING dùng cho chuỗi', 'C. HAVING thực thi trước mệnh đề FROM', 'D. Hai mệnh đề hoàn toàn hoán đổi cho nhau được'],
            correctIndex: 0,
            explanation: 'Giải thích chi tiết (Rationale): WHERE lọc từng hàng (rows) trước khi gom nhóm, còn HAVING lọc các nhóm (groups) được tạo ra bởi GROUP BY và áp dụng được trên các hàm tổng hợp như COUNT(), SUM(), AVG().',
            concept: 'SQL GROUP BY & HAVING',
          },
          {
            id: 'q4',
            question: 'Phép kết nối `LEFT JOIN` giữa hai bảng A và B (A LEFT JOIN B ON A.id = B.a_id) sẽ trả về kết quả như thế nào?',
            options: ['A. Chỉ những dòng có id khớp nhau ở cả hai bảng', 'B. Toàn bộ các dòng từ bảng B và chỉ những dòng khớp từ bảng A', 'C. Toàn bộ các dòng từ bảng A, kết hợp với các cột tương ứng của bảng B nếu có khớp (nếu không có thì nhận giá trị NULL)', 'D. Tích Descartes của tất cả các dòng'],
            correctIndex: 2,
            explanation: 'Giải thích chi tiết (Rationale): LEFT JOIN giữ lại 100% các dòng từ bảng bên trái (A). Nếu có bản ghi khớp ở bảng B thì điền dữ liệu, nếu không khớp thì các cột của B sẽ chứa giá trị NULL.',
            concept: 'SQL Joins',
          },
          {
            id: 'q5',
            question: 'Tại sao việc tạo quá nhiều Index (chỉ mục) trên một bảng có thể làm giảm hiệu năng hệ thống?',
            options: ['A. Làm câu lệnh SELECT bị chậm đi gấp đôi', 'B. Làm tăng chi phí và thời gian ghi đĩa cho mỗi thao tác INSERT, UPDATE, DELETE vì phải cập nhật lại cây Index', 'C. Làm mất tính toàn vẹn của khóa chính', 'D. Index làm giảm dung lượng bộ nhớ RAM'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): Dù Index tăng tốc vượt trội cho câu lệnh SELECT/WHERE, nhưng mỗi khi thêm/sửa/xóa dòng dữ liệu, hệ quản trị CSDL phải đồng thời cập nhật lại cấu trúc cây Index (B-Tree/Hash), làm chậm tốc độ ghi (Write performance).',
            concept: 'Database Indexing',
          },
        ]
      : [
          {
            id: 'q1',
            question: 'Trong kiến trúc React, cơ chế Virtual DOM giúp tối ưu hóa hiệu năng render giao diện chủ yếu nhờ vào quá trình nào?',
            options: ['A. Tự động biên dịch mã JavaScript sang Assembly', 'B. So sánh khác biệt (Diffing) giữa cây Virtual DOM cũ và mới để cập nhật tối thiểu vào DOM thật', 'C. Lưu trữ toàn bộ dữ liệu người dùng trên LocalStorage', 'D. Thay thế hoàn toàn giao thức HTTP bằng WebSockets hai chiều'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): React tạo ra một bản sao ảo của cây DOM trong bộ nhớ. Khi state thay đổi, React chạy thuật toán Diffing để so sánh cây Virtual DOM mới với cây cũ và chỉ cập nhật những phần tử thực sự thay đổi lên DOM thực tế.',
            concept: 'Virtual DOM & Diffing',
          },
          {
            id: 'q2',
            question: 'Khi sử dụng React Hook `useEffect`, việc cung cấp một mảng phụ thuộc rỗng `[]` có ý nghĩa gì?',
            options: ['A. Effect sẽ chạy lại sau mỗi lần component re-render', 'B. Component sẽ bị hủy và render lại từ đầu', 'C. Effect chỉ thực thi đúng một lần duy nhất sau lần render đầu tiên (tương đương componentDidMount)', 'D. Vô hiệu hóa toàn bộ việc cập nhật State trong component'],
            correctIndex: 2,
            explanation: 'Giải thích chi tiết (Rationale): Mảng dependency rỗng `[]` báo cho React biết effect này không phụ thuộc vào bất kỳ biến state hay props nào, do đó nó chỉ chạy duy nhất một lần khi component mount vào DOM.',
            concept: 'React Hooks (useEffect)',
          },
          {
            id: 'q3',
            question: 'Trong mô hình bố cục CSS Flexbox, thuộc tính nào được sử dụng để căn chỉnh các phần tử con dọc theo trục phụ (Cross Axis)?',
            options: ['A. justify-content', 'B. align-items', 'C. flex-direction', 'D. flex-wrap'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): `justify-content` dùng để căn chỉnh dọc theo trục chính (Main Axis), còn `align-items` dùng để căn chỉnh các phần tử con dọc theo trục phụ (Cross Axis).',
            concept: 'CSS Flexbox Layout',
          },
          {
            id: 'q4',
            question: 'Trong giao thức HTTP/1.1 và HTTP/2, phương thức nào sau đây có tính chất "Idempotent"?',
            options: ['A. POST', 'B. GET, PUT và DELETE', 'C. Chỉ có PATCH', 'D. CONNECT'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): GET, PUT và DELETE có tính chất Idempotent (gọi 1 lần hay nhiều lần liên tiếp với cùng dữ liệu đều tạo ra cùng trạng thái tài nguyên trên server). Ngược lại, POST không idempotent vì mỗi lần gọi tạo ra thêm tài nguyên mới.',
            concept: 'RESTful API & HTTP Methods',
          },
          {
            id: 'q5',
            question: 'Trong ngôn ngữ JavaScript ES6+, cú pháp Destructuring Assignment cho phép thực hiện điều gì?',
            options: ['A. Xóa hoàn toàn một object ra khỏi bộ nhớ Heap', 'B. Trích xuất trực tiếp các thuộc tính của Object hoặc phần tử của Array vào các biến riêng biệt một cách ngắn gọn', 'C. Chuyển đổi mã đồng bộ sang bất đồng bộ tự động', 'D. Mã hóa chuỗi JSON thành mã nhị phân'],
            correctIndex: 1,
            explanation: 'Giải thích chi tiết (Rationale): Destructuring Assignment (ví dụ: `const { name, age } = user;`) cho phép giải nén các giá trị từ mảng hoặc thuộc tính từ đối tượng vào các biến độc lập.',
            concept: 'JavaScript ES6+',
          },
        ];

    const docSource =
      pageContext?.documentName ||
      pageContext?.attachedFile?.name ||
      `Tài liệu lý thuyết ${courseName}`;

    const card = {
      id: `quiz-${Date.now()}`,
      type: 'interactive_quiz',
      title: pageContext?.attachedFile?.name
        ? `Bộ Quiz: ${pageContext.attachedFile.name}`
        : isTeacher
        ? `Bộ câu hỏi Quiz đề xuất: ${docSource}`
        : `Bộ Quiz ôn tập: ${docSource}`,
      subtitle: `${courseName} • 5 câu hỏi trắc nghiệm kèm giải thích`,
      code: classId,
      classId,
      courseId,
      courseName,
      documentName: docSource,
      totalQuestions: 5,
      questions,
      role: isTeacher ? 'teacher' : 'student',
      details: [
        { label: 'Học phần', value: courseName },
        { label: 'Tài liệu nguồn', value: docSource },
        { label: 'Số lượng', value: '5 câu hỏi' },
        { label: 'Mã lớp', value: classId },
        { label: 'Mục đích', value: isTeacher ? 'Tư liệu kiểm tra / Bài tập lớp' : 'Ôn tập trắc nghiệm' },
      ],
    };

    return {
      matched: true,
      reply: isTeacher
        ? `🎯 **BỘ CÂU HỎI QUIZ NHANH TỪ TÀI LIỆU DÀNH CHO GIẢNG VIÊN**\n\n` +
          `EduMin AI đã phân tích tài liệu **${docSource}** (${courseName} - \`${classId}\`).\n` +
          `Dưới đây là bộ **5 câu hỏi trắc nghiệm** mẫu kèm 4 đáp án (A, B, C, D) và phần giải thích (rationale) chi tiết.\n\n` +
          `👉 *Thầy/Cô có thể xem trước đáp án, sao chép hoặc bấm **[🚀 Xuất bản thành Bài tập cho lớp]** bên dưới để giao bài ngay cho sinh viên.*`
        : `🎯 **BỘ CÂU HỎI QUIZ TRẮC NGHIỆM ÔN TẬP TỰ ĐỘNG TỪ TÀI LIỆU**\n\n` +
          `EduMin AI đã đọc và phân tích tài liệu **${docSource}** (${courseName} - \`${classId}\`).\n` +
          `Dưới đây là bộ **5 câu hỏi trắc nghiệm** kèm 4 đáp án (A, B, C, D) và phần giải thích (rationale) chi tiết.\n\n` +
          `👉 *Bạn có thể bấm trực tiếp vào các lựa chọn đáp án bên dưới khung tương tác để tự kiểm tra đáp án đúng/sai và chấm điểm nhé!*`,
      intent: 'DOC_QUIZ_GENERATE',
      quizData: { documentName: docSource, courseName, classId, totalQuestions: 5, questions },
      cards: [card],
      quickLinks: isTeacher
        ? [
            { label: 'Tạo bài tập cho lớp', path: '/teacher/assignments' },
            { label: 'Quản lý tài liệu lớp', path: '/teacher/documents' },
          ]
        : [
            { label: 'Mở Bài tập & Quiz', path: '/student/assignments' },
            { label: 'Xem Tài liệu môn học', path: '/student/documents' },
          ],
      suggestions: isTeacher
        ? [
            `⚡ Tạo Quiz nhanh từ tài liệu môn ${courseName}`,
            `Tóm tắt tài liệu môn ${courseName}`,
            'Tạo thêm 5 câu hỏi nâng cao',
            'Danh sách lớp tôi đang phụ trách',
          ]
        : [
            `Tóm tắt ý chính tài liệu môn ${courseName}`,
            'Tạo thêm 5 câu hỏi khó hơn',
            'Xem điểm danh & chuyên cần',
          ],
    };
  }

  // 0a.-0g Class / Course Section Query ("danh sách lớp Tiếng Anh 1", "lớp Tiếng Anh 1", "lớp IT101")
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
            path: isTeacher ? `/teacher/attendance?classId=${targetClass.id || targetClass._id}` : '/teacher/attendance',
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
        const studentCode = match.code || `SV-${String(match.id || 1).padStart(3, '0')}`;
        if (isAdmin) {
          const card = {
            type: 'student',
            id: match.id || 1,
            title: match.hoTen,
            code: studentCode,
            subtitle: `Lớp: ${match.className || 'Chưa xếp'} • Khoa: ${match.department || 'Chưa xác định'}`,
            meta: `Khoa: ${match.department || 'Khoa Công Nghệ Thông Tin'} • Trạng thái: ${match.status || 'Đang học'}`,
            details: [
              { label: 'MSSV', value: studentCode },
              { label: 'Họ và tên', value: match.hoTen },
              { label: 'Lớp sinh hoạt', value: match.className || 'Chưa xếp' },
              { label: 'Khoa đào tạo', value: match.department || 'Chưa xác định' },
              { label: 'Hệ đào tạo', value: match.education || 'Chính quy' },
              { label: 'Email', value: match.email || 'quyen@student.edu.vn' },
              { label: 'Số điện thoại', value: match.phone || '0912345678' },
              { label: 'Địa chỉ thường trú', value: match.address || 'TP. Hồ Chí Minh' },
              { label: 'Trạng thái', value: match.status || 'Đang học' },
            ],
            action: {
              label: 'Xem chi tiết',
              path: '/admin/students',
            },
          };
          return {
            matched: true,
            intent: 'SEARCH_STUDENT',
            reply: `Dưới đây là hồ sơ quản trị đầy đủ của sinh viên **${match.hoTen}** (MSSV: ${studentCode}):`,
            cards: [card],
            quickLinks: [
              { label: 'Quản lý Sinh viên', path: '/admin/students' },
              { label: 'Tài khoản sinh viên', path: '/admin/student-accounts' },
              { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
            ],
          };
        }

        if (isTeacher) {
          const card = {
            type: 'student',
            id: match.id || 1,
            title: match.hoTen,
            code: studentCode,
            subtitle: `Lớp: ${match.className || 'Chưa xếp'} • Khoa: ${match.department || 'Chưa xác định'}`,
            meta: `Khoa: ${match.department || 'Chưa xác định'} • Trạng thái: ${match.status || 'Đang học'}`,
            details: [
              { label: 'MSSV', value: studentCode },
              { label: 'Họ và tên', value: match.hoTen },
              { label: 'Lớp sinh hoạt', value: match.className || 'Chưa xếp' },
              { label: 'Khoa đào tạo', value: match.department || 'Chưa xác định' },
              { label: 'Hệ đào tạo', value: match.education || 'Chính quy' },
              { label: 'Email liên hệ', value: match.email || 'quyen@student.edu.vn' },
              { label: 'SĐT học vụ', value: match.phone || '0912345678' },
              { label: 'Trạng thái', value: match.status || 'Đang học' },
            ],
            action: {
              label: 'Xem chi tiết',
              path: '/teacher/classes',
            },
          };
          return {
            matched: true,
            intent: 'SEARCH_STUDENT',
            reply: `Dưới đây là thông tin học vụ của sinh viên **${match.hoTen}** (MSSV: ${studentCode}):`,
            cards: [card],
            quickLinks: [
              { label: 'Danh sách Lớp học phần', path: '/teacher/classes' },
              { label: 'Điểm danh & Chuyên cần', path: '/teacher/attendance' },
            ],
          };
        }

        // isStudent: Strict privacy guardrails
        const card = {
          type: 'student',
          id: match.id || 1,
          title: match.hoTen,
          code: studentCode,
          subtitle: `Lớp: ${match.className || 'Chưa xếp'} • Khoa: ${match.department || 'Chưa xác định'}`,
          meta: `Danh bạ sinh viên • Lớp ${match.className || 'Chưa xếp'}`,
          details: [
            { label: 'MSSV', value: studentCode },
            { label: 'Họ và tên', value: match.hoTen },
            { label: 'Lớp sinh hoạt', value: match.className || 'Chưa xếp' },
            { label: 'Khoa đào tạo', value: match.department || 'Chưa xác định' },
            { label: 'Hệ đào tạo', value: match.education || 'Chính quy' },
            { label: 'Email sinh viên', value: match.email || 'quyen@student.edu.vn' },
            { label: 'Số điện thoại', value: '🔒 Đã ẩn theo chính sách riêng tư' },
            { label: 'Địa chỉ cá nhân', value: '🔒 Đã ẩn theo chính sách riêng tư' },
            { label: 'Trạng thái', value: match.status || 'Đang học' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/student/timetable',
          },
        };
        return {
          matched: true,
          intent: 'SEARCH_STUDENT',
          reply:
            `Dưới đây là thông tin danh bạ học tập của sinh viên **${match.hoTen}** (MSSV: ${studentCode}):\n\n` +
            `*(Lưu ý: Theo chính sách bảo vệ dữ liệu cá nhân của nhà trường, các thông tin bảo mật như số điện thoại riêng, địa chỉ nhà và bảng điểm cá nhân của sinh viên khác không được tiết lộ.)*`,
          cards: [card],
          quickLinks: [
            { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
            { label: 'Bảng điểm của tôi', path: '/student/attendance' },
          ],
        };
      }

      if (match.type === 'teacher') {
        const teacherCode = match.code || `GV-${String(match.id || 1).padStart(3, '0')}`;
        if (isAdmin) {
          const card = {
            type: 'teacher',
            id: match.id || 1,
            title: match.hoTen,
            code: teacherCode,
            subtitle: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • ${match.education || 'Giảng viên'}`,
            meta: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • Trạng thái: ${match.status || 'Đang công tác'}`,
            details: [
              { label: 'Mã GV', value: teacherCode },
              { label: 'Họ và tên', value: match.hoTen },
              { label: 'Khoa phụ trách', value: match.department || 'Khoa Ngôn Ngữ Anh' },
              { label: 'Học vị / Học hàm', value: match.education || 'Thạc sĩ' },
              { label: 'Email', value: match.email || 'dinh.tran@edu.vn' },
              { label: 'Số điện thoại', value: match.phone || '0987654321' },
              { label: 'Địa chỉ', value: match.address || 'TP. Hồ Chí Minh' },
              { label: 'Trạng thái', value: match.status || 'Đang công tác' },
            ],
            action: {
              label: 'Xem chi tiết',
              path: '/admin/teachers',
            },
          };
          return {
            matched: true,
            intent: 'SEARCH_TEACHER',
            reply: `Dưới đây là thông tin quản trị giảng viên **${match.hoTen}** (Mã GV: ${teacherCode}):`,
            cards: [card],
            quickLinks: [
              { label: 'Quản lý Giảng viên', path: '/admin/teachers' },
              { label: 'Tài khoản giảng viên', path: '/admin/teacher-accounts' },
            ],
          };
        }

        if (isTeacher) {
          const card = {
            type: 'teacher',
            id: match.id || 1,
            title: match.hoTen,
            code: teacherCode,
            subtitle: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • ${match.education || 'Giảng viên'}`,
            meta: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • Trạng thái: ${match.status || 'Đang giảng dạy'}`,
            details: [
              { label: 'Mã GV', value: teacherCode },
              { label: 'Họ và tên', value: match.hoTen },
              { label: 'Khoa phụ trách', value: match.department || 'Khoa Ngôn Ngữ Anh' },
              { label: 'Học vị / Học hàm', value: match.education || 'Thạc sĩ' },
              { label: 'Email công vụ', value: match.email || 'dinh.tran@edu.vn' },
              { label: 'SĐT công tác', value: match.phone || '0987654321' },
              { label: 'Trạng thái', value: match.status || 'Đang giảng dạy' },
            ],
            action: {
              label: 'Xem chi tiết',
              path: '/teacher/classes',
            },
          };
          return {
            matched: true,
            intent: 'SEARCH_TEACHER',
            reply: `Dưới đây là thông tin đồng nghiệp giảng viên **${match.hoTen}** (Mã GV: ${teacherCode}):`,
            cards: [card],
            quickLinks: [
              { label: 'Lớp học phần', path: '/teacher/classes' },
              { label: 'Lịch dạy giảng viên', path: '/teacher/schedule' },
            ],
          };
        }

        // isStudent
        const card = {
          type: 'teacher',
          id: match.id || 1,
          title: match.hoTen,
          code: teacherCode,
          subtitle: `Khoa: ${match.department || 'Khoa Ngôn Ngữ Anh'} • ${match.education || 'Giảng viên'}`,
          meta: `Giảng viên • ${match.department || 'Khoa Ngôn Ngữ Anh'}`,
          details: [
            { label: 'Mã GV', value: teacherCode },
            { label: 'Họ và tên', value: match.hoTen },
            { label: 'Khoa phụ trách', value: match.department || 'Khoa Ngôn Ngữ Anh' },
            { label: 'Học vị / Học hàm', value: match.education || 'Thạc sĩ' },
            { label: 'Email liên hệ công vụ', value: match.email || 'dinh.tran@edu.vn' },
            { label: 'Trạng thái', value: match.status || 'Đang giảng dạy' },
          ],
          action: {
            label: 'Xem chi tiết',
            path: '/student/timetable',
          },
        };
        return {
          matched: true,
          intent: 'SEARCH_TEACHER',
          reply: `Dưới đây là thông tin giảng viên **${match.hoTen}** (Mã GV: ${teacherCode}):`,
          cards: [card],
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

    if (isStudent && foundStudent) {
      const isSelf = isCurrentUserStudent(foundStudent, user);
      if (!isSelf) {
        return {
          matched: true,
          reply:
            `🔒 **Bảo mật quyền riêng tư học tập:**\n` +
            `Vì lý do an toàn thông tin và quyền riêng tư cá nhân theo quy chế của nhà trường, sinh viên chỉ có thể tra cứu bảng điểm và tình hình học tập của chính mình. EduMin AI không hiển thị bảng điểm của sinh viên khác (**${studentName}**).\n\n` +
            `Nếu bạn cần trao đổi học tập hoặc thảo luận môn học, bạn có thể liên hệ trực tiếp với bạn qua nhóm lớp nhé!`,
          intent: 'STUDENT_GRADE_PRIVACY_RESTRICTED',
          quickLinks: [
            { label: 'Bảng điểm & Chuyên cần của tôi', path: '/student/attendance' },
            { label: 'Thời khóa biểu của tôi', path: '/student/timetable' },
          ],
        };
      }
    }

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
            path: isAdmin ? '/admin/gradebook' : isTeacher ? '/teacher/classes' : '/student/attendance',
          },
        },
      ],
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

  // 8. Navigation & Data: Quản lý & Cập nhật tài liệu học phần
  if (
    text.includes('tai lieu') ||
    text.includes('slide') ||
    text.includes('bai giang') ||
    text.includes('giao trinh') ||
    text.includes('quet tai lieu') ||
    text.includes('cap nhat tai lieu')
  ) {
    const norm = normalizeText(rawText);
    let courseName = pageContext?.selectedStudySubject || 'Lập trình Web';
    let classId = 'CNTT101-01';
    if (norm.includes('sql') || norm.includes('du lieu') || norm.includes('database') || norm.includes('csdl')) {
      courseName = 'Cơ sở dữ liệu';
      classId = 'CS102-01';
    } else if (norm.includes('mang') || norm.includes('network')) {
      courseName = 'Mạng máy tính';
      classId = 'IT103-01';
    }

    const docCards = [
      {
        type: 'document_card',
        id: `doc-${Date.now()}-1`,
        docId: `doc-${Date.now()}-1`,
        title: `GiaoTrinh_${courseName.replace(/\s+/g, '')}_2026.pdf`,
        name: `Giáo trình lý thuyết ${courseName} (Phiên bản mới 2026)`,
        format: 'pdf',
        sizeText: '4.2 MB',
        courseName,
        classId,
        updatedAt: '15/10/2026',
        uploadedBy: user?.hoTen || 'ThS. Nguyễn Văn A',
        action: { label: 'Xem chi tiết', path: isTeacher ? '/teacher/documents' : '/student/documents' },
      },
      {
        type: 'document_card',
        id: `doc-${Date.now()}-2`,
        docId: `doc-${Date.now()}-2`,
        title: `Slide_BaiGiang_Chuong1_${courseName.replace(/\s+/g, '')}.pptx`,
        name: `Slide Bài giảng Chương 1: Giới thiệu & Khái niệm cốt lõi`,
        format: 'pptx',
        sizeText: '2.1 MB',
        courseName,
        classId,
        updatedAt: '14/10/2026',
        uploadedBy: user?.hoTen || 'ThS. Nguyễn Văn A',
        action: { label: 'Xem chi tiết', path: isTeacher ? '/teacher/documents' : '/student/documents' },
      },
    ];

    return {
      matched: true,
      intent: 'TEACHER_DOCUMENT_QUERY',
      reply: isTeacher
        ? `📂 **DANH SÁCH TÀI LIỆU HỌC PHẦN ĐÃ ĐƯỢC CẬP NHẬT:**\n\n` +
          `EduMin AI đã quét và đồng bộ dữ liệu tài liệu môn **${courseName}** (\`${classId}\`).\n` +
          `Dưới đây là các tệp bài giảng và giáo trình kèm dung lượng, ngày cập nhật. ` +
          `Thầy/Cô có thể **Tải xuống** hoặc **Tạo Quiz nhanh** trực tiếp bằng các nút bấm bên dưới:`
        : `📂 **DANH SÁCH TÀI LIỆU HỌC PHẦN:**\n\n` +
          `EduMin AI đã tìm thấy danh sách tài liệu môn **${courseName}** (\`${classId}\`).\n` +
          `Dưới đây là các tệp bài giảng và giáo trình. Bạn có thể tải xuống tài liệu hoặc yêu cầu AI tóm tắt nội dung chính:`,
      cards: docCards,
      quickLinks: [{ label: 'Mở Quản lý Tài liệu', path: isTeacher ? '/teacher/documents' : '/student/documents' }],
      suggestions: isTeacher
        ? [
            `⚡ Tạo bộ 5 câu hỏi quiz trắc nghiệm môn ${courseName}`,
            `Tóm tắt Chương 1 tài liệu môn ${courseName}`,
            'Danh sách lớp tôi phụ trách',
          ]
        : [
            `Tóm tắt Chương 1 tài liệu môn ${courseName}`,
            `Giải thích khái niệm cốt lõi môn ${courseName}`,
            `Xem các bài tập môn ${courseName}`,
          ],
    };
  }

  // 9. Navigation & Action: Duyệt yêu cầu & Phân quyền (Admin)
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
    text.includes('profile request') ||
    text.includes('phan quyen') ||
    text.includes('xin quyen') ||
    text.includes('cap quyen') ||
    text.includes('kiem tra yeu cau') ||
    text.includes('yeu cau phu')
  ) {
    const matchPerson = rawText.match(/(?:duyệt yêu cầu của|duyệt hồ sơ của|yêu cầu của)\s+([^?.,]+)/i);
    const requesterName =
      matchPerson && matchPerson[1] && !['hồ sơ', 'yêu cầu', 'mới', 'tôi', 'em', 'phân quyền'].includes(matchPerson[1].trim().toLowerCase())
        ? matchPerson[1].trim()
        : 'Nguyễn Văn An';

    const hasBatchRequest =
      text.includes('danh sach') ||
      text.includes('tat ca') ||
      text.includes('bang') ||
      text.includes('cac yeu cau') ||
      text.includes('cac ho so') ||
      text.includes('nhieu yeu cau');

    const req1 = {
      type: 'approval',
      id: 'req-001',
      requestId: 'req-001',
      title: requesterName,
      requesterName,
      requesterRole: 'sinh-vien',
      code: 'Yêu cầu #REQ1',
      permission: 'Cập nhật ảnh đại diện & CCCD mới',
      subtitle: 'Cập nhật ảnh đại diện mới',
      meta: 'Email: an.nguyen@student.edu.vn • Sinh viên',
      reason: 'Thay đổi ảnh thẻ mới chuẩn kích thước hồ sơ',
      createdAt: '15/10/2026',
      status: 'pending',
      details: [
        { label: 'Người yêu cầu', value: requesterName },
        { label: 'Vai trò', value: 'Sinh viên' },
        { label: 'Nội dung xin cấp quyền', value: 'Cập nhật ảnh đại diện & CCCD' },
        { label: 'Trạng thái', value: 'Chờ duyệt' },
      ],
      action: {
        label: 'Xem chi tiết',
        path: '/admin/profile-requests',
      },
    };

    const req2 = {
      type: 'approval',
      id: 'req-002',
      requestId: 'req-002',
      title: 'ThS. Trần Thị Mai',
      requesterName: 'ThS. Trần Thị Mai',
      requesterRole: 'giao-vien',
      code: 'Yêu cầu #REQ2',
      permission: 'Xin cấp quyền quản trị lớp học phần CNTT101-01 & Mở khóa nhập điểm',
      subtitle: 'Cấp quyền phụ trách lớp học phần & nhập điểm',
      meta: 'Email: mai.tran@faculty.edu.vn • Giảng viên',
      reason: 'Tiếp nhận dạy thay giảng viên công tác đột xuất',
      createdAt: '15/10/2026',
      status: 'pending',
      details: [
        { label: 'Người yêu cầu', value: 'ThS. Trần Thị Mai' },
        { label: 'Vai trò', value: 'Giảng viên' },
        { label: 'Nội dung xin cấp quyền', value: 'Phân quyền quản lý lớp & nhập điểm' },
        { label: 'Trạng thái', value: 'Chờ duyệt' },
      ],
      action: {
        label: 'Xem chi tiết',
        path: '/admin/profile-requests',
      },
    };

    const approvalCards = hasBatchRequest ? [req1, req2] : [req1];

    return {
      matched: true,
      intent: 'ADMIN_APPROVAL',
      reply: `📋 **DANH SÁCH YÊU CẦU XÉT DUYỆT & PHÂN QUYỀN HỆ THỐNG:**\n\n` +
        `EduMin AI đã tìm thấy **${approvalCards.length} yêu cầu** đang ở trạng thái chờ duyệt. ` +
        `Admin có thể xem thông tin, vai trò, nội dung xin cấp quyền và bấm trực tiếp nút **[Phê duyệt / Accept]** hoặc **[Từ chối / Reject]** trên thẻ/bảng bên dưới để hệ thống cập nhật tức thì:`,
      cards: approvalCards,
      quickLinks: [{ label: 'Mở Quản lý yêu cầu hồ sơ', path: '/admin/profile-requests' }],
      suggestions: [
        'Duyệt yêu cầu của Nguyễn Văn An',
        'Có hồ sơ nào chờ duyệt không?',
      ],
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
function renderInlineMarkdown(str = '', isUser = false) {
  const parts = String(str).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, pIdx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={pIdx} className={`font-semibold ${isUser ? 'text-white font-bold' : 'text-slate-900'}`}>
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
function renderMessageText(text = '', isUser = false) {
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
      <div key={`table-${keyPrefix}`} className="my-3 overflow-x-auto rounded-lg border border-slate-200 shadow-2xs bg-white text-slate-800">
        <table className="w-full text-[11px] text-left border-collapse">
          <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
            <tr>
              {headers.map((h, hIdx) => (
                <th key={hIdx} className="px-3 py-2 whitespace-nowrap">
                  {renderInlineMarkdown(h, false)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rIdx) => (
              <tr key={rIdx} className="hover:bg-slate-50 transition-colors">
                {row.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 whitespace-nowrap">
                    {renderInlineMarkdown(cell, false)}
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
        <span key={`line-${lIdx}`} className={`block min-h-[1.35rem] py-0.5 leading-relaxed ${isUser ? 'text-white font-medium' : 'text-slate-800'}`}>
          {renderInlineMarkdown(line, isUser)}
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
export const CHAT_MESSAGES_STORAGE_PREFIX = 'edumin_ai_chat_messages_';
export const CHAT_OPEN_STORAGE_PREFIX = 'edumin_ai_chat_is_open_';
export const CHAT_DOCKED_STORAGE_PREFIX = 'edumin_ai_chat_docked_';

export function getChatUserStorageKey(user) {
  const uId = user?.id || user?._id || user?.email || user?.username || 'user';
  return `${CHAT_MESSAGES_STORAGE_PREFIX}${uId}`;
}

export function getChatOpenStorageKey(user) {
  const uId = user?.id || user?._id || user?.email || user?.username || 'user';
  return `${CHAT_OPEN_STORAGE_PREFIX}${uId}`;
}

export function getChatDockedStorageKey(user) {
  const uId = user?.id || user?._id || user?.email || user?.username || 'user';
  return `${CHAT_DOCKED_STORAGE_PREFIX}${uId}`;
}

export function buildDefaultWelcomeMessage(displayName, role) {
  let welcomeText = `Xin chào **${displayName}**!\nTôi là **EduMin AI Assistant**. Bạn có thể yêu cầu tôi hỗ trợ thông tin đào tạo, tra cứu dữ liệu hoặc điều hướng nhanh trong hệ thống.`;
  if (role === 'dao-tao' || role === 'admin') {
    welcomeText = `Xin chào **${displayName}**!\nTôi là **EduMin AI Assistant**. Bạn có thể nhập prompt để đặt tiêu chuẩn duyệt hồ sơ, yêu cầu đối soát duyệt theo tiêu chuẩn, hoặc xem tổng hợp ý kiến & nguyện vọng của sinh viên và giảng viên.`;
  } else if (role === 'giao-vien' || role === 'teacher') {
    welcomeText = `Kính chào **${displayName}**!\nTôi là **EduMin AI Assistant**. Thầy/Cô có thể yêu cầu tính điểm quá trình tự động cho lớp từ bài Quiz và điểm chuyên cần, tra cứu lịch giảng dạy hoặc quản lý sổ điểm.`;
  } else if (role === 'sinh-vien' || role === 'student') {
    welcomeText = `Xin chào **${displayName}**!\nTôi là **EduMin AI Assistant**. Bạn có thể yêu cầu xem báo cáo tình hình học tập sau khi giảng viên đánh giá, kiểm tra thời khóa biểu, hoặc tư vấn quy chế và học phần.`;
  }
  return {
    id: 'welcome',
    sender: 'assistant',
    text: welcomeText,
    timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function getInitialChatMessages(user, displayName, role) {
  try {
    if (typeof window !== 'undefined') {
      const key = getChatUserStorageKey(user);
      const saved = sessionStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch {}

  return [buildDefaultWelcomeMessage(displayName, role)];
}

export function getInitialChatOpen(user) {
  try {
    if (typeof window !== 'undefined') {
      const key = getChatOpenStorageKey(user);
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved) === true;
      }
    }
  } catch {}
  return false;
}

export function getInitialChatDocked(user) {
  try {
    if (typeof window !== 'undefined') {
      const key = getChatDockedStorageKey(user);
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        return JSON.parse(saved) === true;
      }
    }
  } catch {}
  return false;
}

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

export function formatAttachmentSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getAttachmentFileMeta(fileName = '') {
  const ext = String(fileName).split('.').pop().toLowerCase();
  if (ext === 'pdf') {
    return {
      icon: 'fas fa-file-pdf',
      color: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      label: 'PDF',
    };
  }
  if (['doc', 'docx'].includes(ext)) {
    return {
      icon: 'fas fa-file-word',
      color: 'text-blue-600',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      label: 'DOCX',
    };
  }
  if (ext === 'txt') {
    return {
      icon: 'fas fa-file-lines',
      color: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      label: 'TXT',
    };
  }
  return {
    icon: 'fas fa-paperclip',
    color: 'text-indigo-600',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    label: ext ? ext.toUpperCase() : 'Tài liệu',
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

  const storageKey = useMemo(() => getChatUserStorageKey(user), [user]);
  const openStorageKey = useMemo(() => getChatOpenStorageKey(user), [user]);
  const dockStorageKey = useMemo(() => getChatDockedStorageKey(user), [user]);

  const [isOpen, setIsOpen] = useState(() => getInitialChatOpen(user));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [actionLoading, setActionLoading] = useState({});
  const [selectedStudySubject, setSelectedStudySubject] = useState('');
  const [activeStudyContext, setActiveStudyContext] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const allowed = ['.pdf', '.docx', '.txt'];
    if (!allowed.includes(ext)) {
      toast?.error?.('Vui lòng chỉ tải lên tài liệu định dạng .pdf, .docx hoặc .txt');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachedFile(file);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Speech Recognition (Speech-to-Text) and Speech Synthesis (Text-to-Speech)
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const baseInputRef = useRef('');

  // Cleanup speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {}
      }
    };
  }, []);

  const handleToggleListening = () => {
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      toast?.warning?.(
        'Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói (Web Speech API). Vui lòng sử dụng Google Chrome hoặc Microsoft Edge.'
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseInputRef.current = input ? input.trim() + ' ' : '';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res?.isFinal) {
            finalTranscript += res[0]?.transcript || '';
          } else {
            interimTranscript += res[0]?.transcript || '';
          }
        }

        const spoken = (finalTranscript || interimTranscript).trim();
        if (spoken) {
          setInput(baseInputRef.current + spoken);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          toast?.error?.('Vui lòng cấp quyền truy cập micro trong trình duyệt để sử dụng tính năng này.');
        } else if (event.error === 'no-speech') {
          // No speech detected, quietly finish
        } else if (event.error !== 'aborted') {
          toast?.warning?.(`Lỗi nhận diện giọng nói: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      toast?.error?.('Không thể khởi động micro. Vui lòng thử lại.');
      setIsListening(false);
    }
  };

  const handleToggleSpeak = (messageId, text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast?.warning?.('Trình duyệt của bạn chưa hỗ trợ tính năng phát âm thanh (Speech Synthesis).');
      return;
    }

    const synth = window.speechSynthesis;

    // If currently speaking this message, toggle off
    if (speakingMessageId === messageId) {
      try {
        synth.cancel();
      } catch {}
      setSpeakingMessageId(null);
      return;
    }

    // Cancel any previous speech
    try {
      synth.cancel();
    } catch {}

    const cleanText = cleanTextForSpeech(text);
    if (!cleanText) {
      toast?.info?.('Không có nội dung văn bản để đọc.');
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      // Select Vietnamese voice if available
      const voices = synth.getVoices() || [];
      const viVoice = voices.find(
        (v) => v.lang === 'vi-VN' || v.lang?.toLowerCase()?.startsWith('vi')
      );
      if (viVoice) {
        utterance.voice = viVoice;
      }

      utterance.onstart = () => {
        setSpeakingMessageId(messageId);
      };

      utterance.onend = () => {
        setSpeakingMessageId(null);
        utteranceRef.current = null;
      };

      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
        setSpeakingMessageId(null);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      synth.speak(utterance);
      setSpeakingMessageId(messageId);
    } catch (err) {
      console.error('Failed to synthesize speech:', err);
      toast?.error?.('Không thể phát âm thanh. Vui lòng thử lại.');
      setSpeakingMessageId(null);
    }
  };

  // Flexible UI display modes: Floating panel by default overlaying content with z-index
  const [isDocked, setIsDocked] = useState(() => getInitialChatDocked(user));
  const [positionSide, setPositionSide] = useState('right'); // 'right' | 'left'
  const [isTransparent, setIsTransparent] = useState(false); // See-through translucent mode
  const [isChatHovered, setIsChatHovered] = useState(false);
  const [isChatFocused, setIsChatFocused] = useState(false);
  const isChatInteracting = isChatHovered || isChatFocused;

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

  const handleToggleDock = () => {
    setIsDocked((prev) => !prev);
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
      if (e.detail?.prompt) {
        setInput(e.detail.prompt);
      }
    };
    window.addEventListener('edumin_toggle_ai_assistant', handleToggleEvent);
    return () => window.removeEventListener('edumin_toggle_ai_assistant', handleToggleEvent);
  }, []);

  const [messages, setMessages] = useState(() =>
    getInitialChatMessages(user, displayName, role)
  );

  const prevStorageKeyRef = useRef(storageKey);

  // Sync state when active user changes (e.g. login/logout or switch account)
  useEffect(() => {
    if (prevStorageKeyRef.current !== storageKey) {
      prevStorageKeyRef.current = storageKey;
      setMessages(getInitialChatMessages(user, displayName, role));
      setIsOpen(getInitialChatOpen(user));
      setIsDocked(getInitialChatDocked(user));
    }
  }, [storageKey, user, displayName, role]);

  // Persist messages across page navigation and route changes
  useEffect(() => {
    if (prevStorageKeyRef.current === storageKey) {
      try {
        if (typeof window !== 'undefined' && Array.isArray(messages) && messages.length > 0) {
          sessionStorage.setItem(storageKey, JSON.stringify(messages));
        }
      } catch {}
    }
  }, [messages, storageKey]);

  // Persist open state across route transitions
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(openStorageKey, JSON.stringify(isOpen));
      }
    } catch {}
  }, [isOpen, openStorageKey]);

  // Persist docked state across route transitions
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(dockStorageKey, JSON.stringify(isDocked));
      }
    } catch {}
  }, [isDocked, dockStorageKey]);

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
            '⚡ Tạo bộ 5 câu hỏi quiz trắc nghiệm từ tài liệu môn Lập trình Web',
            'Làm sao để cấu hình điểm giữa kỳ và Quiz?',
            'Xem lịch giảng dạy hôm nay',
            'Danh sách lớp tôi đang phụ trách',
            'Có ý kiến sinh viên nào chưa phản hồi không?',
          ]);
        } else if (role === 'sinh-vien' || role === 'student') {
          setSuggestions([
            'Tóm tắt giúp tôi các ý chính của tài liệu học phần',
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

  // Proactive Schedule Change Alert when opening Chatbox
  const greetedScheduleRef = useRef(new Set());

  useEffect(() => {
    const handleScheduleEvent = (e) => {
      const detail = e.detail;
      if (detail?.metadata) {
        try {
          sessionStorage.setItem(
            'edumin_latest_schedule_change',
            JSON.stringify({
              id: `evt_${Date.now()}`,
              classCode: detail.metadata.classCode || detail.targetClassId || 'CNTT101-01',
              targetClassId: detail.targetClassId || detail.metadata.classCode || 'CNTT101-01',
              oldRoom: detail.metadata.oldRoom || 'A1-201',
              newRoom: detail.metadata.newRoom || 'B2-405',
              date: detail.metadata.date || 'ngày mai',
              oldShift: detail.metadata.oldShift || 'Sáng (Tiết 1 - 3)',
              newShift: detail.metadata.newShift || 'Sáng (Tiết 1 - 3)',
              reason: detail.metadata.reason || 'Bảo trì trang thiết bị phòng học',
              senderName: detail.metadata.senderName || (role === 'dao-tao' ? 'Phòng Đào Tạo' : 'Giảng viên'),
              senderRole: role || 'giao-vien',
              greeted: false,
            })
          );
        } catch {}
      }
    };

    window.addEventListener('edumin_schedule_changed', handleScheduleEvent);
    window.addEventListener('edumin_schedule_notification', handleScheduleEvent);

    return () => {
      window.removeEventListener('edumin_schedule_changed', handleScheduleEvent);
      window.removeEventListener('edumin_schedule_notification', handleScheduleEvent);
    };
  }, [role]);

  useEffect(() => {
    if (!isOpen || !user) return;

    let active = true;
    async function checkProactiveScheduleNotifications() {
      try {
        let scheduleNotifs = [];

        // 1. Fetch unread schedule notifications from backend API
        try {
          const res = await notificationsApi.list({ type: 'schedule_change', limit: 5 });
          const items = res?.data || res?.items || [];
          scheduleNotifs = items.filter((n) => !n.isRead && n.type === 'schedule_change');
        } catch {
          scheduleNotifs = [];
        }

        // 2. Check local/session storage if backend returned empty or in mock/offline mode
        if (scheduleNotifs.length === 0) {
          try {
            const rawStored = sessionStorage.getItem('edumin_latest_schedule_change');
            if (rawStored) {
              const parsed = JSON.parse(rawStored);
              if (parsed && !parsed.greeted) {
                scheduleNotifs = [
                  {
                    _id: parsed.id || 'stored_sched',
                    targetClassId: parsed.classCode || parsed.targetClassId || 'CNTT101-01',
                    senderName: parsed.senderName || 'Giảng viên',
                    senderRole: parsed.senderRole || 'dao-tao',
                    metadata: parsed,
                    message: `Lớp đổi sang phòng ${parsed.newRoom || 'mới'} vào ngày ${parsed.date || ''}.`,
                  },
                ];
              }
            }
          } catch {}
        }

        if (!active || scheduleNotifs.length === 0) return;

        const notif = scheduleNotifs[0];
        const notifKey = notif._id || `${notif.targetClassId}_${notif.metadata?.date}`;

        if (greetedScheduleRef.current.has(notifKey)) return;
        greetedScheduleRef.current.add(notifKey);

        // Store active schedule change context for conversational Q&A
        try {
          sessionStorage.setItem(
            'edumin_latest_schedule_change',
            JSON.stringify({
              id: notifKey,
              classCode: notif.targetClassId || notif.metadata?.classCode || 'CNTT101-01',
              targetClassId: notif.targetClassId || notif.metadata?.classCode || 'CNTT101-01',
              oldRoom: notif.metadata?.oldRoom || 'A1-201',
              newRoom: notif.metadata?.newRoom || 'B2-405',
              date: notif.metadata?.date || 'ngày mai',
              oldShift: notif.metadata?.oldShift || 'Sáng (Tiết 1 - 3)',
              newShift: notif.metadata?.newShift || 'Sáng (Tiết 1 - 3)',
              reason: notif.metadata?.reason || 'Bảo trì trang thiết bị phòng học',
              senderName: notif.senderName || 'Giảng viên/Admin',
              senderRole: notif.senderRole || 'dao-tao',
              greeted: true,
            })
          );
        } catch {}

        const classLabel = notif.targetClassId || notif.metadata?.classCode || 'CNTT101-01';
        const senderLabel =
          notif.senderRole === 'dao-tao' || notif.senderRole === 'admin'
            ? 'Admin'
            : notif.senderName || 'Giảng viên';
        const dateLabel = notif.metadata?.date || 'sắp tới';

        const greetingText =
          `Dạ chào bạn, lớp **${classLabel}** vừa có thông báo đổi lịch từ **${senderLabel}** vào ngày **${dateLabel}**.\n\n` +
          `*Chi tiết:* ${notif.message || notif.title}\n\n` +
          `Bạn có muốn tôi xem lại thời khóa biểu mới không?`;

        const proactiveMsg = {
          id: `proactive-schedule-${Date.now()}`,
          sender: 'assistant',
          text: greetingText,
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          quickLinks: [
            {
              label: 'Xem Thời khóa biểu mới',
              path: role === 'giao-vien' || role === 'teacher' ? '/teacher/schedule' : '/student/timetable',
            },
          ],
          suggestions: [
            'Lớp tôi vừa đổi phòng nào thế AI?',
            'Xem thời khóa biểu tuần này ở đâu?',
          ],
        };

        setMessages((prev) => {
          if (
            prev.some(
              (m) => m.text && m.text.includes(`lớp **${classLabel}** vừa có thông báo đổi lịch`)
            )
          ) {
            return prev;
          }
          return [...prev, proactiveMsg];
        });

        setSuggestions((prev) => [
          'Lớp tôi vừa đổi phòng nào thế AI?',
          ...prev.filter((s) => s !== 'Lớp tôi vừa đổi phòng nào thế AI?'),
        ]);
      } catch {}
    }

    checkProactiveScheduleNotifications();

    return () => {
      active = false;
    };
  }, [isOpen, user, role]);

  const handleSendMessageRef = useRef();

  // Listen for AI study triggers from Student or Teacher Document List
  useEffect(() => {
    const handleStudyEvent = (e) => {
      const detail = e?.detail;
      if (!detail) return;

      setIsOpen(true);
      if (detail.courseName) {
        setSelectedStudySubject(detail.courseName);
      }
      setActiveStudyContext({
        documentId: detail.documentId || '',
        documentName: detail.documentName || '',
        courseName: detail.courseName || '',
        courseId: detail.courseId || '',
        classId: detail.classId || '',
      });

      const docName = detail.documentName || 'tài liệu học tập';
      const courseTitle = detail.courseName ? ` môn ${detail.courseName}` : '';
      const isTeacherRole = role === 'teacher' || role === 'giao-vien' || detail.role === 'teacher';

      let prompt = '';
      if (detail.action === 'quiz') {
        if (isTeacherRole) {
          prompt = `Gợi ý và tạo bộ 5 câu hỏi quiz trắc nghiệm kèm đáp án và giải thích từ tài liệu ${docName}${courseTitle} để làm tư liệu kiểm tra/bài tập cho lớp`;
        } else {
          prompt = `Tạo cho tôi 5 câu quiz trắc nghiệm ôn tập dựa trên file ${docName}${courseTitle}`;
        }
      } else {
        if (isTeacherRole) {
          prompt = `Tóm tắt nội dung trọng tâm và các khái niệm cốt lõi của tài liệu ${docName}${courseTitle} để phục vụ giảng dạy`;
        } else {
          prompt = `Tóm tắt giúp tôi các ý chính của tài liệu ${docName}${courseTitle}`;
        }
      }

      setTimeout(() => {
        if (handleSendMessageRef.current) {
          handleSendMessageRef.current(prompt);
        }
      }, 100);
    };

    window.addEventListener('edumin:ai-study', handleStudyEvent);
    return () => {
      window.removeEventListener('edumin:ai-study', handleStudyEvent);
    };
  }, [role]);

  /**
   * Main message handling function.
   * Reads the typed or overridden message, renders user's message on the right,
   * performs smart keyword matching and/or API call, and renders the dynamic answer on the left.
   */
  const handleSendMessage = async (overrideText) => {
    let textToSend = String(overrideText ?? input).trim();
    const currentAttachedFile = attachedFile;

    if (!textToSend && currentAttachedFile) {
      textToSend = `Tóm tắt và phân tích nội dung tài liệu ${currentAttachedFile.name}`;
    }
    if (!textToSend || loading) return;

    // Stop ongoing speech recognition or synthesis
    if (isListening) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsListening(false);
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
      setSpeakingMessageId(null);
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      ...(currentAttachedFile
        ? {
            attachment: {
              name: currentAttachedFile.name,
              size: currentAttachedFile.size,
              sizeText: formatAttachmentSize(currentAttachedFile.size),
              type: currentAttachedFile.type,
            },
          }
        : {}),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLoading(true);

    try {
      const baseContext = getAiPageContext() || {};
      const pageContext = {
        ...baseContext,
        ...(selectedStudySubject ? { selectedStudySubject, courseName: selectedStudySubject } : {}),
        ...(activeStudyContext || {}),
        ...(currentAttachedFile
          ? {
              attachedFile: {
                name: currentAttachedFile.name,
                size: currentAttachedFile.size,
                sizeText: formatAttachmentSize(currentAttachedFile.size),
                type: currentAttachedFile.type,
              },
              documentName: currentAttachedFile.name,
            }
          : {}),
      };

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
        if (currentAttachedFile) {
          apiPayload.attachedFile = {
            name: currentAttachedFile.name,
            size: currentAttachedFile.size,
            type: currentAttachedFile.type,
          };
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
      const baseContext = getAiPageContext() || {};
      const pageContext = {
        ...baseContext,
        ...(selectedStudySubject ? { selectedStudySubject, courseName: selectedStudySubject } : {}),
        ...(activeStudyContext || {}),
      };
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

  handleSendMessageRef.current = handleSendMessage;

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
    handleRemoveFile();
    const resetMsg = [
      {
        id: 'welcome-reset',
        sender: 'assistant',
        text: `Đã làm mới cuộc hội thoại! 👋\nBạn có thể hỏi tôi bất kỳ câu hỏi nào về quy trình, dữ liệu hoặc điều hướng trong hệ thống EduMin.`,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
    setMessages(resetMsg);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(resetMsg));
      }
    } catch {}
  };

  const handleQuickNavigate = (path, navOptions) => {
    if (!path) return;
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(storageKey, JSON.stringify(messages));
        if (window.innerWidth >= 640) {
          sessionStorage.setItem(openStorageKey, JSON.stringify(true));
        }
      }
    } catch {}
    if (navOptions !== undefined) {
      navigate(path, navOptions);
    } else {
      navigate(path);
    }
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
        } ${isOpen ? 'hidden' : ''}`}
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
                <circle cx="8.5" cy="16" r="1.5" fill="currentColor" />
                <circle cx="15.5" cy="16" r="1.5" fill="currentColor" />
                <path d="M12 2v4" />
                <circle cx="12" cy="2" r="1" fill="currentColor" />
                <path d="M2 15h1M21 15h1" />
              </svg>
              {/* Ping animation indicator */}
              <span className="absolute top-1 right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
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
          onMouseEnter={() => setIsChatHovered(true)}
          onMouseLeave={() => setIsChatHovered(false)}
          onFocus={() => setIsChatFocused(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setIsChatFocused(false);
            }
          }}
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
              ? 'fixed top-16 right-0 bottom-0 z-[9990] w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-xl flex flex-col transition-all duration-300 ease-in-out'
              : `bg-white rounded-2xl shadow-xl border border-slate-200/90 flex flex-col overflow-hidden ${
                  positionSide === 'left' ? 'left-4 sm:left-6' : ''
                }`
          } ${
            isTransparent
              ? isChatInteracting
                ? 'opacity-100 shadow-2xl transition-all duration-200 ring-2 ring-indigo-500/20'
                : 'opacity-40 hover:opacity-100 backdrop-blur-md transition-all duration-300'
              : 'opacity-100'
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
                  isTransparent ? 'bg-white/20 text-amber-300' : 'text-white/80 hover:text-white hover:bg-white/10'
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
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
                >
                  <i className={`fas ${positionSide === 'right' ? 'fa-arrow-left' : 'fa-arrow-right'}`} />
                </button>
              )}

              {/* Dock / Undock Side Drawer Toggle */}
              <button
                type="button"
                title={isDocked ? 'Bỏ ghim (Chuyển về cửa sổ nổi)' : 'Ghim bên phải (Co giãn trang để không che dữ liệu)'}
                onClick={handleToggleDock}
                className={`p-1.5 rounded-lg transition text-xs cursor-pointer ${
                  isDocked ? 'bg-white/25 text-white' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <i className={`fas ${isDocked ? 'fa-window-restore' : 'fa-table-columns'}`} />
              </button>

              {/* Refresh Chat */}
              <button
                type="button"
                title="Làm mới hội thoại"
                onClick={handleClearHistory}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              >
                <i className="fas fa-rotate-right" />
              </button>

              {/* Minimize / Close */}
              <button
                type="button"
                title="Thu nhỏ"
                aria-label="Thu nhỏ"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition text-xs cursor-pointer"
              >
                <i className="fas fa-xmark text-sm" />
              </button>
            </div>
          </div>

          {/* Student Study Subject Selector Toolbar */}
          {(role === 'sinh-vien' || role === 'student') && (
            <div className="bg-indigo-50/90 border-b border-indigo-100/90 px-3.5 py-2 flex items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center gap-1.5 text-indigo-950 font-semibold shrink-0">
                <i className="fas fa-graduation-cap text-indigo-600 text-xs" />
                <span className="hidden sm:inline">Học phần đọc tài liệu:</span>
              </div>
              <select
                value={selectedStudySubject}
                onChange={(e) => setSelectedStudySubject(e.target.value)}
                className="flex-1 max-w-[240px] bg-white border border-indigo-200 text-indigo-950 font-semibold text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition cursor-pointer truncate shadow-2xs"
                aria-label="Chọn môn học để AI đọc tài liệu"
              >
                <option value="">-- Tự nhận diện môn từ tin nhắn --</option>
                <option value="Lập trình Web">Lập trình Web (CNTT101)</option>
                <option value="Cơ sở dữ liệu">Cơ sở dữ liệu (CS102)</option>
                <option value="Mạng máy tính">Mạng máy tính (IT103)</option>
              </select>
              {selectedStudySubject && (
                <button
                  type="button"
                  onClick={() => setSelectedStudySubject('')}
                  title="Bỏ chọn môn"
                  className="text-slate-400 hover:text-slate-600 p-1 rounded transition text-xs cursor-pointer"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          )}

          {/* Messages Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pt-4.5 space-y-4 bg-slate-50/70">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {!isUser ? (
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs">
                      <i className="fas fa-robot" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-2xs font-semibold" title="Bạn">
                      <i className="fas fa-user text-[11px]" />
                    </div>
                  )}

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} ${!isUser && msg.cards?.length ? 'w-[96%] sm:w-[94%]' : 'max-w-[85%]'}`}>
                    <div
                      className={`px-4 pt-3 pb-3 text-xs sm:text-[13px] leading-relaxed w-full ${
                        isUser
                          ? 'bg-blue-600 text-white font-medium rounded-2xl rounded-tr-xs shadow-md shadow-blue-500/25 border border-blue-500/40'
                          : 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      {renderMessageText(msg.text, isUser)}

                      {/* Attached File in User Bubble */}
                      {isUser && msg.attachment && (
                        <div
                          data-testid="ai-user-message-attachment"
                          className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-700/60 border border-blue-400/40 text-[11px] text-white max-w-full"
                        >
                          <i className="fas fa-paperclip text-blue-200 text-[10px] shrink-0" />
                          <span className="font-semibold truncate max-w-[180px] sm:max-w-[220px]" title={msg.attachment.name}>
                            {msg.attachment.name}
                          </span>
                          {msg.attachment.sizeText && (
                            <span className="text-[10px] text-blue-200 shrink-0">
                              ({msg.attachment.sizeText})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Interactive Action Cards */}
                      {!isUser && (() => {
                        const effectiveCards = Array.isArray(msg.cards) && msg.cards.length > 0
                          ? msg.cards
                          : msg.card
                          ? [msg.card]
                          : msg.payload
                          ? [typeof msg.payload === 'object' ? { type: msg.type, ...msg.payload } : { type: msg.type }]
                          : [];
                        if (effectiveCards.length === 0) return null;

                        return (
                          <div className="mt-3.5 space-y-2.5">
                            {effectiveCards.map((card, cIdx) => {
                              const cardKey = card.id || cIdx;
                              const effectiveType = (card.type || msg.type || '').toLowerCase();

                              // Type A: Admin Approval Request Card / Table
                              if (
                                effectiveType === 'approval' ||
                                effectiveType === 'approval_card' ||
                                effectiveType === 'approval_table'
                              ) {
                                return (
                                  <ApprovalRequestCard
                                    key={cardKey}
                                    card={card}
                                    actionLoading={actionLoading}
                                    onApprove={(reqId, title) =>
                                      handleApproveRequest(msg.id, card.id, reqId, title)
                                    }
                                    onReject={(reqId, title, reason) =>
                                      handleRejectRequest(msg.id, card.id, reqId, title, reason)
                                    }
                                    onNavigate={(path) => handleQuickNavigate(path)}
                                  />
                                );
                              }

                              // Type B: Teacher Document / File Card
                              if (
                                effectiveType === 'document_card' ||
                                effectiveType === 'teacher_document' ||
                                effectiveType === 'document_file' ||
                                effectiveType === 'file_card'
                              ) {
                                return (
                                  <TeacherDocumentCard
                                    key={cardKey}
                                    card={card}
                                    onSendMessage={(prompt) => handleSendMessage(prompt)}
                                    onNavigate={(path) => handleQuickNavigate(path)}
                                  />
                                );
                              }

                              // Type C: Interactive Quiz Card
                              if (effectiveType === 'interactive_quiz' || effectiveType === 'quiz_card') {
                                return (
                                  <InteractiveQuizCard
                                    key={cardKey}
                                    card={card}
                                    userRole={role || card?.role}
                                    onSendMessage={(text) => handleSendMessage(text)}
                                    onNavigate={(path, options) => handleQuickNavigate(path, options)}
                                  />
                                );
                              }

                              // Type D: Document Summary Card
                              if (effectiveType === 'document_summary' || effectiveType === 'summary_card') {
                                return (
                                  <DocumentSummaryCard
                                    key={cardKey}
                                    card={card}
                                    userRole={role || card?.role}
                                    onSendMessage={(text) => handleSendMessage(text)}
                                    onNavigate={(path, options) => handleQuickNavigate(path, options)}
                                  />
                                );
                              }

                              return (
                                <div
                                  key={cardKey}
                                  className="bg-slate-50/90 rounded-xl p-3.5 pt-3 border border-slate-200/90 shadow-2xs space-y-2 text-slate-800"
                                >
                              {/* Card Header */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <h4 className="font-semibold text-xs text-slate-900 leading-tight">
                                    {card.title}
                                  </h4>
                                  {card.subtitle && (
                                    <p className={`text-[11px] mt-0.5 ${card.subtitle.startsWith('✓') ? 'text-emerald-700 font-medium' : card.subtitle.startsWith('✗') ? 'text-rose-700 font-medium' : 'text-slate-500'}`}>
                                      {card.subtitle}
                                    </p>
                                  )}
                                </div>
                                {card.code && (
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-md bg-slate-200 text-slate-800 whitespace-nowrap">
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 active:scale-95 rounded-lg shadow-2xs transition disabled:opacity-50 cursor-pointer"
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
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 active:scale-95 rounded-lg shadow-2xs transition cursor-pointer"
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 active:scale-95 rounded-lg transition cursor-pointer"
                                  >
                                    <i className="fas fa-crosshairs text-slate-500" />
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    <i className="fas fa-table text-slate-500" />
                                    <span>Bảng điểm lớp</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuickNavigate(
                                        role === 'giao-vien' || role === 'teacher' ? '/teacher/attendance' : '/admin/classes'
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 cursor-pointer shadow-2xs"
                                  >
                                    <i className="fas fa-calendar-check text-slate-500" />
                                    <span>Điểm danh lớp</span>
                                  </button>
                                  {card.action && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickNavigate(card.action.path)}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
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
                                        <i className="fas fa-comment-dots text-slate-400" />
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
                                            className="text-left px-2.5 py-1.5 text-[11px] text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-[0.98] group flex items-start gap-1.5 shadow-2xs cursor-pointer"
                                          >
                                            <i className="fas fa-paper-plane text-[10px] text-slate-400 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
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
                                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer"
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
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition active:scale-95 group shadow-2xs cursor-pointer"
                                  >
                                    <span>{card.action.label || 'Xem chi tiết'}</span>
                                    <i className="fas fa-arrow-right text-[10px] text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                          </div>
                        );
                      })()}

                      {/* Fallback Suggestions */}
                      {!isUser && Array.isArray(msg.suggestions) && msg.suggestions.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                          <p className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                            <i className="fas fa-lightbulb text-slate-400" />
                            Gợi ý tác vụ nhanh:
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

                    <div className="flex items-center justify-between w-full mt-1.5 px-1">
                      <span className="text-[10px] text-slate-400">
                        {msg.timestamp}
                      </span>
                      {!isUser && msg.text && (
                        <button
                          type="button"
                          data-testid={`ai-tts-btn-${msg.id}`}
                          onClick={() => handleToggleSpeak(msg.id, msg.text)}
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition cursor-pointer ${
                            speakingMessageId === msg.id
                              ? 'bg-indigo-100 text-indigo-700 font-semibold ring-1 ring-indigo-300 shadow-2xs'
                              : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100'
                          }`}
                          title={
                            speakingMessageId === msg.id
                              ? 'Dừng đọc văn bản'
                              : 'Đọc câu trả lời bằng giọng nói tiếng Việt'
                          }
                          aria-label={
                            speakingMessageId === msg.id ? 'Dừng đọc' : 'Đọc văn bản'
                          }
                        >
                          <i
                            className={`fas ${
                              speakingMessageId === msg.id
                                ? 'fa-volume-high text-indigo-600 animate-pulse'
                                : 'fa-volume-low text-slate-400'
                            } text-xs`}
                          />
                          <span>
                            {speakingMessageId === msg.id ? 'Dừng đọc' : 'Đọc văn bản'}
                          </span>
                        </button>
                      )}
                    </div>
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
          <div className="p-3 bg-white border-t border-slate-200 flex flex-col gap-2">
            {/* Listening indicator with wave animation */}
            {isListening && (
              <div
                data-testid="ai-listening-indicator"
                className="flex items-center justify-between gap-2 px-3 py-1.5 bg-gradient-to-r from-rose-50 via-rose-100/60 to-indigo-50 border border-rose-200 rounded-xl text-xs text-rose-900 shadow-2xs animate-fade-in"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600" />
                  </span>
                  <span className="font-semibold text-[11px] text-rose-700 truncate">
                    Đang lắng nghe giọng nói tiếng Việt...
                  </span>
                  {/* Sound wave bars */}
                  <div className="flex items-center gap-0.5 ml-1 shrink-0">
                    <span className="w-0.5 h-3 bg-rose-500 rounded-full animate-pulse" />
                    <span className="w-0.5 h-4 bg-rose-600 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-0.5 h-2 bg-rose-500 rounded-full animate-pulse [animation-delay:300ms]" />
                    <span className="w-0.5 h-4 bg-rose-600 rounded-full animate-bounce [animation-delay:450ms]" />
                    <span className="w-0.5 h-3 bg-rose-500 rounded-full animate-pulse [animation-delay:200ms]" />
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="ai-stop-listening-btn"
                  onClick={handleToggleListening}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-white/90 px-2 py-0.5 rounded-md border border-rose-200 cursor-pointer transition shadow-2xs shrink-0"
                  title="Dừng ghi âm giọng nói"
                  aria-label="Dừng ghi âm giọng nói"
                >
                  Dừng
                </button>
              </div>
            )}

            {/* Attached file preview chip */}
            {attachedFile && (
              <div
                data-testid="ai-attached-file-preview"
                className="flex items-center justify-between gap-2 px-3 py-1.5 bg-indigo-50/90 border border-indigo-200 rounded-xl text-xs text-indigo-950 shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className="w-6 h-6 rounded-lg bg-white border border-indigo-200/80 flex items-center justify-center shrink-0">
                    <i
                      className={`${getAttachmentFileMeta(attachedFile.name).icon} ${
                        getAttachmentFileMeta(attachedFile.name).color
                      } text-xs`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800 text-[11px] truncate" title={attachedFile.name}>
                      {attachedFile.name}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {formatAttachmentSize(attachedFile.size)} • Sẵn sàng phân tích
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="ai-remove-file-btn"
                  onClick={handleRemoveFile}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
                  title="Xóa tệp đính kèm"
                  aria-label="Xóa tệp đính kèm"
                >
                  <i className="fas fa-xmark text-xs" />
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={fileInputRef}
                type="file"
                data-testid="ai-file-input"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Tải lên tài liệu"
              />
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setIsChatFocused(true)}
                placeholder={
                  isListening
                    ? 'Đang lắng nghe bạn nói...'
                    : attachedFile
                    ? `Hỏi về file ${attachedFile.name}... (hoặc bấm gửi để AI phân tích)`
                    : 'Nhập câu hỏi hoặc yêu cầu điều hướng...'
                }
                disabled={loading}
                className={`flex-1 bg-slate-50 border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 placeholder-slate-400 outline-none transition ${
                  isListening
                    ? 'border-rose-400 ring-2 ring-rose-100 bg-rose-50/20'
                    : 'border-slate-200 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                }`}
              />
              {/* Voice recognition microphone button */}
              <button
                type="button"
                data-testid="ai-speech-recognition-btn"
                onClick={handleToggleListening}
                disabled={loading}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 border-rose-600 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400/40 animate-pulse'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-indigo-600'
                }`}
                title={
                  isListening
                    ? 'Đang lắng nghe... (Bấm để dừng)'
                    : 'Nhập bằng giọng nói (Micro tiếng Việt)'
                }
                aria-label={
                  isListening
                    ? 'Đang lắng nghe... Bấm để dừng'
                    : 'Nhập bằng giọng nói'
                }
              >
                <i
                  className={`fas ${
                    isListening ? 'fa-microphone-lines' : 'fa-microphone'
                  } text-xs sm:text-sm`}
                />
              </button>
              {/* Attach document button */}
              <button
                type="button"
                data-testid="ai-attach-file-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className={`p-2.5 rounded-xl border transition flex items-center justify-center flex-shrink-0 cursor-pointer ${
                  attachedFile
                    ? 'bg-indigo-50 border-indigo-300 text-indigo-600 hover:bg-indigo-100'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-500 hover:text-indigo-600'
                }`}
                title="Đính kèm tài liệu (.pdf, .docx, .txt)"
                aria-label="Đính kèm tài liệu"
              >
                <i className="fas fa-paperclip text-xs sm:text-sm" />
              </button>
              {/* Submit button */}
              <button
                type="submit"
                disabled={(!input.trim() && !attachedFile) || loading}
                className="p-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:hover:bg-indigo-600 transition flex items-center justify-center flex-shrink-0 shadow-xs cursor-pointer"
                title="Gửi câu hỏi"
                aria-label="Gửi câu hỏi"
              >
                <i className="fas fa-paper-plane text-xs sm:text-sm" />
              </button>
            </form>
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-slate-400">
                🎙️ Nhập giọng nói tiếng Việt & Tải file PDF, DOCX, TXT
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
