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
    const currentPageMatch =
      PAGE_INFO.find((p) => normPath === p.path) ||
      PAGE_INFO.filter((p) => p.path !== '/' && normPath.startsWith(p.path + '/')).sort(
        (a, b) => b.path.length - a.path.length
      )[0];
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

  // 1.1b Specific Student Grade Lookup ("xem điểm của [tên/mã]", "điểm của [tên]")
  const isStudentSpecificGradeLookup =
    text.includes('xem diem cua') ||
    text.includes('diem cua sinh vien') ||
    text.includes('diem cua') ||
    text.startsWith('diem sv') ||
    text.includes('tra cuu diem cua');

  if (isStudentSpecificGradeLookup && !text.includes('diem danh')) {
    const rawKeyword = rawText.replace(/^(xem điểm của sinh viên|xem điểm của|điểm của sinh viên|điểm của|điểm sv|tra cứu điểm của)\s*/i, '').trim();
    const studentName = rawKeyword || 'Nguyễn Văn An';
    return {
      matched: true,
      intent: 'SEARCH_STUDENT_GRADES',
      reply: `Dưới đây là thông tin bảng điểm của sinh viên **${studentName}**:`,
      cards: [
        {
          type: 'grade',
          id: 'grade-1',
          title: 'Lập trình Web nâng cao',
          code: 'Lớp IT101-01',
          subtitle: `Sinh viên: ${studentName}`,
          details: [
            { label: 'Chuyên cần', value: '9.0' },
            { label: 'Giữa kỳ', value: '8.5' },
            { label: 'Cuối kỳ', value: '8.0' },
            { label: 'Điểm tổng kết (GPA)', value: '8.4' },
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
        cards: finalReply.cards || [],
        suggestions: finalReply.suggestions || [],
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
                                            : 'Xác nhận duyệt nhanh'}
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

                              {/* Card Actions: Search / Generic (Student, Class, Grade) */}
                              {card.type !== 'approval' && card.type !== 'feedback' && card.action && (
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

export function EduMinAiAssistant({ forceRender = false } = {}) {
  const authContext = useAuth();
  const user = authContext?.user || null;
  const role = user?.role || '';
  const isStudent = role === ROLES.STUDENT || role === 'sinh-vien' || role === 'student';

  // Only render EduMin AI Assistant widget for Student role; hide completely for Admin, Teacher, and others
  if (!isStudent && !forceRender) {
    return null;
  }

  return (
    <AiAssistantErrorBoundary>
      <EduMinAiAssistantInner />
    </AiAssistantErrorBoundary>
  );
}

export default EduMinAiAssistant;
