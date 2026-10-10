import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/providers/AuthProvider.jsx';
import { aiApi } from '../../api/aiApi.js';

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
    path: '/admin/departments',
    name: 'Quản lý khoa đào tạo',
    keywords: ['quan ly khoa', 'khoa dao tao', 'danh sach khoa', 'cac khoa', 'bo mon'],
    description: 'Bạn có thể xem danh sách các khoa, thêm khoa mới hoặc chỉnh sửa thông tin khoa trực tiếp trên màn hình.',
  },
  {
    path: '/admin/students',
    name: 'Quản lý sinh viên',
    keywords: ['quan ly sinh vien', 'danh sach sinh vien', 'ho so sinh vien', 'sinh vien toan truong', 'them sinh vien'],
    description: 'Bạn có thể tìm kiếm, lọc theo khoa/lớp hoặc thêm mới hồ sơ sinh viên trực tiếp trên màn hình.',
  },
  {
    path: '/admin/teachers',
    name: 'Quản lý giáo viên',
    keywords: ['quan ly giang vien', 'quan ly giao vien', 'danh sach giang vien', 'giao vien toan truong', 'them giang vien'],
    description: 'Bạn có thể tra cứu, phân công khoa hoặc thêm hồ sơ giảng viên trực tiếp trên bảng.',
  },
  {
    path: '/admin/classes',
    name: 'Quản lý lớp học phần',
    keywords: ['quan ly lop', 'lop hoc phan', 'mo lop', 'danh sach lop', 'tao lop'],
    description: 'Bạn có thể tạo lớp học phần mới, xếp giảng viên, phòng học và thời khóa biểu trực tiếp trên màn hình.',
  },
  {
    path: '/admin/gradebook',
    name: 'Quản lý bảng điểm toàn trường',
    keywords: ['quan ly bang diem', 'bang diem toan truong', 'chot so diem', 'chot so', 'khoa bang diem', 'phuc khao', 'sua diem', 'audit log'],
    description: 'Bạn có thể theo dõi bảng điểm tất cả các lớp, can thiệp sửa điểm phúc khảo kèm Audit Log, hoặc chốt sổ khóa bảng điểm toàn trường ngay tại đây.',
  },
  {
    path: '/admin/courses',
    name: 'Quản lý môn học',
    keywords: ['quan ly mon hoc', 'danh muc mon hoc', 'danh sach mon hoc', 'mon hoc', 'tin chi'],
    description: 'Bạn có thể xem và quản lý danh mục môn học, số tín chỉ và mã môn trực tiếp trên màn hình.',
  },
  {
    path: '/admin/profile-requests',
    name: 'Duyệt yêu cầu hồ sơ',
    keywords: ['duyet yeu cau', 'yeu cau duyet', 'duyet ho so', 'cho duyet', 'cap nhat ho so'],
    description: 'Bạn có thể xem xét, duyệt hàng loạt hoặc từ chối các yêu cầu cập nhật hồ sơ trực tiếp tại bảng yêu cầu.',
  },
  {
    path: '/admin/feedbacks',
    name: 'Quản lý đánh giá sinh viên',
    keywords: ['quan ly danh gia', 'danh gia sinh vien', 'y kien sinh vien', 'phan hoi sinh vien'],
    description: 'Bạn có thể theo dõi toàn bộ các ý kiến đóng góp và đánh giá của sinh viên toàn trường tại đây.',
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

const OUT_OF_SCOPE_KEYWORDS = [
  'ky tuc xa', 'ktx', 'noi tru', 'phong o',
  'thu vien', 'muon sach', 'tra sach', 'sach giao trinh',
  'can tin', 'cang tin', 'nha an', 'an trua', 'do an', 'dat com',
  'xe buyt', 'xe bus', 'tuyen xe', 'dua don', 'gui xe', 'bai do xe', 've xe', 'giu xe',
  'hoc bong', 'tro cap', 'tro cap xa hoi', 'mien giam hoc phi',
  'tuyen sinh', 'xet tuyen', 'thi tuyen sinh', 'nop ho so tuyen sinh',
  'cau lac bo', 'clb', 'doan hoi', 'hoi sinh vien', 'ngoai khoa', 'tinh nguyen', 'mua he xanh',
  'y te', 'kham suc khoe', 'bao hiem y te', 'bhyt', 'benh xa', 'thuoc men',
  'chuyen nganh', 'chuyen khoa', 'bao luu', 'thoi hoc', 'rut ho so',
  'tot nghiep', 'xet tot nghiep', 'le tot nghiep', 'nhan bang', 'chung chi tot nghiep', 'bang dai hoc',
  'momo', 'zalopay', 'vnpay', 'quet the', 'vi dien tu', 'cong thanh toan',
  'cuu sinh vien', 'alumni',
  'do an tot nghiep', 'khoa luan', 'thuc tap', 'doanh nghiep',
  'nhan tin rieng', 'chat rieng', 'goi dien',
  'hop truc tuyen', 'zoom', 'google meet', 'microsoft teams',
  'wifi', 'mang truong', 'mat khau wifi',
];

/**
 * Smart Mock AI Response Engine & Keyword Matcher.
 * Matches keywords like "sinh viên", "điểm", "thời khóa biểu", "cấu hình điểm", "duyệt yêu cầu"...
 * and generates realistic answers with direct quick action navigation links.
 */
export function getSmartAiResponse(rawText = '', role = '', _user = null, currentPath = '') {
  const text = normalizeText(rawText);
  const isAdmin = role === 'dao-tao' || role === 'admin';
  const isTeacher = role === 'giao-vien' || role === 'teacher';
  const isStudent = role === 'sinh-vien' || role === 'student';

  // 0. Location / Current Page Awareness
  if (currentPath) {
    const normPath = currentPath.toLowerCase().trim();
    const currentPageMatch = PAGE_INFO.find((p) => normPath === p.path || normPath.startsWith(p.path + '/'));
    if (currentPageMatch) {
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
    text.includes('cai dat diem');

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

  // 1.1 Navigation: Quản lý bảng điểm toàn trường & Chốt sổ / Khóa điểm (Admin Gradebook)
  const isAdminGradebook =
    text.includes('bang diem toan truong') ||
    text.includes('quan ly bang diem') ||
    text.includes('chot so') ||
    text.includes('khoa bang diem') ||
    text.includes('phuc khao') ||
    text.includes('audit log') ||
    (isAdmin && (text.includes('bang diem') || text.includes('so diem')));

  if (isAdminGradebook) {
    return {
      matched: true,
      intent: 'NAV_ADMIN_GRADEBOOK',
      reply:
        'Dạ, với vai trò Quản trị viên (Phòng Đào Tạo), bạn có thể quản lý bảng điểm toàn trường tại trang **"Quản lý bảng điểm"**:\n' +
        '• Xem điểm số của tất cả các lớp học phần theo Khoa và Giảng viên.\n' +
        '• Chỉnh sửa, ghi đè điểm số phục vụ phúc khảo (hệ thống tự động lưu vết **Audit Log**).\n' +
        '• Thực hiện **Khóa / Chốt sổ bảng điểm** theo từng lớp hoặc toàn trường khi kết thúc học kỳ.',
      quickLinks: [
        { label: 'Quản lý bảng điểm toàn trường', path: '/admin/gradebook' },
        { label: 'Quản lý lớp học phần', path: '/admin/classes' },
      ],
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
    return {
      matched: true,
      intent: 'NAV_GRADES',
      reply: isTeacher
        ? 'Dạ, để nhập hoặc theo dõi bảng điểm sinh viên, bạn vào mục "Lớp học phần", chọn lớp tương ứng và bấm nút "Bảng điểm". Hệ thống có tính năng tự động tính điểm GPA và tự động đồng bộ kết quả từ bài Quiz trực tuyến.'
        : isStudent
        ? 'Dạ, bạn có thể theo dõi kết quả học tập và chuyên cần của mình tại trang "Điểm danh & Chuyên cần".'
        : 'Dạ, bạn có thể theo dõi danh sách lớp học phần và quản lý điểm số toàn trường tại trang "Quản lý bảng điểm".',
      quickLinks: isTeacher
        ? [{ label: 'Vào Bảng điểm Lớp học phần', path: '/teacher/classes' }]
        : isStudent
        ? [{ label: 'Xem Chuyên cần & Điểm số', path: '/student/attendance' }]
        : [
            { label: 'Quản lý bảng điểm', path: '/admin/gradebook' },
            { label: 'Quản lý Lớp học phần', path: '/admin/classes' },
          ],
    };
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

  // 9. Navigation: Duyệt yêu cầu & Hồ sơ
  if (
    text.includes('duyet yeu cau') ||
    text.includes('yeu cau duyet') ||
    text.includes('duyet ho so') ||
    text.includes('cho duyet') ||
    text.includes('cap nhat ho so') ||
    text.includes('doi avatar') ||
    text.includes('anh dai dien') ||
    text.includes('profile request')
  ) {
    return {
      matched: true,
      intent: 'NAV_PROFILE_REQUESTS',
      reply: isAdmin
        ? 'Dạ, bạn có thể xem xét và phê duyệt các yêu cầu thay đổi thông tin cá nhân hoặc cập nhật ảnh đại diện tại trang "Duyệt yêu cầu" ở menu bên trái.'
        : 'Dạ, để cập nhật thông tin cá nhân hoặc đổi ảnh đại diện, bạn bấm vào Avatar ở góc phải trên cùng hoặc trang Tổng quan để gửi yêu cầu. Ban Đào tạo sẽ xem xét và phê duyệt.',
      quickLinks: isAdmin
        ? [{ label: 'Duyệt yêu cầu hồ sơ', path: '/admin/profile-requests' }]
        : [{ label: 'Trang cá nhân', path: isTeacher ? '/teacher' : '/student' }],
    };
  }

  // 10. Navigation: Ý kiến & Đánh giá
  if (
    text.includes('y kien') ||
    text.includes('danh gia') ||
    text.includes('gop y') ||
    text.includes('phan hoi') ||
    text.includes('feedback')
  ) {
    return {
      matched: true,
      intent: 'NAV_FEEDBACK',
      reply: isTeacher
        ? 'Dạ, bạn có thể xem và phản hồi trực tiếp các ý kiến đóng góp từ sinh viên trên Dashboard Giảng viên.'
        : isAdmin
        ? 'Dạ, bạn có thể theo dõi và quản lý ý kiến đóng góp của sinh viên toàn trường tại mục "Quản lý đánh giá".'
        : 'Dạ, bạn có thể gửi góp ý và đánh giá cho giảng viên tại trang Tổng quan.',
      quickLinks: isTeacher
        ? [{ label: 'Mở Dashboard & Ý kiến', path: '/teacher' }]
        : isAdmin
        ? [{ label: 'Quản lý Đánh giá sinh viên', path: '/admin/feedbacks' }]
        : [{ label: 'Gửi Ý kiến & Đánh giá', path: '/student' }],
    };
  }

  // 11. Navigation: Lớp học phần
  if (
    text.includes('lop hoc phan') ||
    text.includes('quan ly lop') ||
    text.includes('mo lop') ||
    text.includes('danh sach lop')
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

  // 12. Navigation: Giảng viên toàn trường
  if (
    text.includes('danh sach giang vien') ||
    text.includes('quan ly giang vien') ||
    text.includes('quan ly giao vien') ||
    text.includes('giang vien') ||
    text.includes('giao vien') ||
    text === 'gv' ||
    text.startsWith('gv ')
  ) {
    return {
      matched: true,
      intent: 'NAV_TEACHERS',
      reply: 'Dạ, để xem danh sách giảng viên toàn trường, bạn có thể truy cập nhanh vào mục Quản lý giáo viên ở menu bên trái.',
      quickLinks: [{ label: 'Quản lý giáo viên', path: '/admin/teachers' }],
    };
  }

  // 13. Navigation: Danh sách sinh viên & Quản lý sinh viên (Checked after specific features)
  if (
    text.includes('danh sach sinh vien') ||
    text.includes('quan ly sinh vien') ||
    text.includes('tai khoan sinh vien') ||
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

  // 16. Fallback for out-of-scope / non-existent / unrecognized features
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
 * Formats markdown-like bold (**text**) and newlines for clean rendering.
 */
function renderMessageText(text = '') {
  const lines = String(text).split('\n');
  return lines.map((line, lIdx) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    return (
      <span key={lIdx} className="block min-h-[1.25rem]">
        {parts.map((part, pIdx) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return (
              <strong key={pIdx} className="font-semibold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={pIdx}>{part}</span>;
        })}
      </span>
    );
  });
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

function EduMinAiAssistantInner() {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const profile = authContext?.profile || null;
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location?.pathname || '';

  const displayName = profile?.hoTen || user?.hoTen || 'bạn';
  const role = user?.role || '';

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
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
      // 1. Calculate smart mock/keyword response with context awareness
      const smartResponse = getSmartAiResponse(textToSend, role, user, currentPath);

      // 2. Call backend AI API (if available or mocked in tests)
      let apiResult = null;
      try {
        apiResult = await aiApi.query(textToSend, { currentPath });
      } catch {
        apiResult = null;
      }

      // 3. Selection logic:
      // If apiResult returned a specific non-fallback intent, use apiResult.
      // Else use smartResponse (which handles keyword matching or dynamic guidance).
      let finalReply;
      if (apiResult && apiResult.intent && apiResult.intent !== 'FALLBACK_HELP') {
        finalReply = apiResult;
      } else {
        finalReply = smartResponse;
      }

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        text: finalReply.reply,
        intent: finalReply.intent,
        quickLinks: finalReply.quickLinks || [],
        data: finalReply.data,
        timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallback = getSmartAiResponse(textToSend, role, user, currentPath);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-err-${Date.now()}`,
          sender: 'assistant',
          text: fallback.reply,
          quickLinks: fallback.quickLinks || [],
          timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
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
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-[9999] flex items-center select-none pointer-events-auto">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="hidden sm:inline-flex items-center mr-3 px-3.5 py-2 bg-slate-900/90 hover:bg-slate-900 text-white text-xs font-semibold rounded-full shadow-2xl backdrop-blur-md transition-all border border-slate-700/60 cursor-pointer"
          >
            <span>Hỏi EduMin AI</span>
            <span className="ml-1.5 text-amber-300">✨</span>
          </button>
        )}

        <button
          type="button"
          aria-label={isOpen ? 'Đóng trợ lý ảo EduMin' : 'Mở trợ lý ảo EduMin'}
          onClick={() => setIsOpen((prev) => !prev)}
          className={`relative w-14 h-14 rounded-full shadow-2xl transition-all duration-300 transform active:scale-95 flex items-center justify-center cursor-pointer ${
            isOpen
              ? 'bg-slate-800 text-white hover:bg-slate-900 rotate-90 shadow-slate-800/40 ring-4 ring-slate-800/20'
              : 'bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white hover:shadow-indigo-500/50 hover:scale-105 ring-4 ring-indigo-500/20'
          }`}
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <>
              {/* Standalone SVG robot icon for 100% reliable rendering without CDN dependencies */}
              <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="3" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8.01" y2="16" strokeWidth={3} />
                <line x1="16" y1="16" x2="16.01" y2="16" strokeWidth={3} />
              </svg>
              {/* Online / Active pulse ping */}
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
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
          className="fixed bottom-24 right-4 sm:right-6 z-[9999] w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 px-4 py-3.5 text-white flex items-center justify-between shadow-xs select-none">
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
              <button
                type="button"
                title="Làm mới hội thoại"
                onClick={handleClearHistory}
                className="p-2 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs"
              >
                <i className="fas fa-rotate-right" />
              </button>
              <button
                type="button"
                title="Thu nhỏ"
                onClick={() => setIsOpen(false)}
                className="p-2 text-indigo-100 hover:text-white hover:bg-white/10 rounded-lg transition text-xs"
              >
                <i className="fas fa-minus" />
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

                  <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    <div
                      className={`px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl rounded-tr-xs'
                          : 'bg-white text-slate-800 rounded-2xl rounded-tl-xs border border-slate-200/80'
                      }`}
                    >
                      {renderMessageText(msg.text)}

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
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition active:scale-95 group"
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

export function EduMinAiAssistant() {
  return (
    <AiAssistantErrorBoundary>
      <EduMinAiAssistantInner />
    </AiAssistantErrorBoundary>
  );
}

export default EduMinAiAssistant;
