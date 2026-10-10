import { CourseClass } from '../classes/courseClass.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { Department } from '../departments/department.model.js';
import { ProfileRequest } from '../profileRequests/profileRequest.model.js';
import { Feedback } from '../feedback/feedback.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { ROLES } from '../../lib/roles.js';

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

const PAGE_INFO = [
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

export async function handleAiAssistantQuery({ message, user, currentPath = '' }) {
  const rawText = String(message || '').trim();
  const text = normalizeText(rawText);

  const role = user?.role || '';
  const isAdmin = role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao';
  const isTeacher = role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien';
  const isStudent = role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien';

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
          reply: `Dạ, hiện tại bạn đang ở ngay trang **${currentPageMatch.name}** rồi đây ạ! ${currentPageMatch.description}`,
          intent: 'CURRENT_PAGE_ALREADY',
          quickLinks: [{ label: `Đang ở trang ${currentPageMatch.name}`, path: currentPageMatch.path }],
        };
      }
    }
  }

  // 0b. Admin Gradebook Module (Phòng Đào Tạo)
  if (
    text.includes('quan ly bang diem') ||
    text.includes('bang diem toan truong') ||
    text.includes('chot so') ||
    text.includes('khoa bang diem') ||
    text.includes('phuc khao') ||
    text.includes('audit log') ||
    text.includes('lich su sua diem') ||
    text.includes('can thiep diem') ||
    text.includes('chot so diem')
  ) {
    if (isAdmin) {
      return {
        reply:
          'Dạ, Quản trị viên (Phòng Đào tạo) có thể xem toàn cục bảng điểm tất cả các lớp, can thiệp sửa điểm phúc khảo kèm Audit Log, và chốt sổ khóa bảng điểm toàn trường tại trang "Quản lý bảng điểm".',
        intent: 'NAV_ADMIN_GRADEBOOK',
        quickLinks: [{ label: 'Quản lý Bảng điểm toàn trường', path: '/admin/gradebook' }],
      };
    }
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
    text.includes('cai dat diem');

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
        'Dạ, bạn có thể theo dõi danh sách lớp học phần, sĩ số và quản lý điểm số các môn tại mục "Quản lý lớp học phần".',
      intent: 'NAV_GRADES',
      quickLinks: [{ label: 'Quản lý Lớp học phần', path: '/admin/classes' }],
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
    text.includes('y kien') ||
    text.includes('danh gia') ||
    text.includes('gop y') ||
    text.includes('phan hoi') ||
    text.includes('feedback')
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
      const totalFeedbacks = await Feedback.countDocuments();
      return {
        reply: `Hệ thống hiện ghi nhận tổng cộng ${totalFeedbacks} đánh giá và ý kiến từ sinh viên toàn trường. Bạn có thể kiểm tra chi tiết tại trang Quản lý phản hồi.`,
        intent: 'NAV_ADMIN_FEEDBACKS',
        quickLinks: [{ label: 'Quản lý Đánh giá sinh viên', path: '/admin/feedbacks' }],
      };
    }

    return {
      reply: 'Sinh viên có thể gửi đánh giá chất lượng giảng dạy và đóng góp ý kiến cho giảng viên phụ trách tại trang Tổng quan.',
      intent: 'NAV_STUDENT_FEEDBACK',
      quickLinks: [{ label: 'Gửi Ý kiến & Đánh giá', path: '/student' }],
    };
  }

  // 7. Navigation: Bài tập & Tài liệu
  if (text.includes('tai lieu') || text.includes('slide') || text.includes('bai giang')) {
    const targetPath = isTeacher ? '/teacher/documents' : '/student/documents';
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

  // 8. Data & Action: Yêu cầu duyệt hồ sơ (Admin)
  if (
    text.includes('yeu cau duyet') ||
    text.includes('duyet yeu cau') ||
    text.includes('duyet ho so') ||
    text.includes('cho duyet') ||
    text.includes('cap nhat ho so') ||
    text.includes('profile request')
  ) {
    if (isAdmin) {
      const pendingCount = await ProfileRequest.countDocuments({ status: 'pending' });
      return {
        reply:
          `Hệ thống hiện có ${pendingCount} yêu cầu cập nhật hồ sơ/ảnh đại diện đang ở trạng thái Chờ duyệt (Pending).\n` +
          'Bạn có thể xem xét, duyệt nhanh hàng loạt hoặc từ chối tại trang Duyệt yêu cầu.',
        intent: 'QUERY_PENDING_REQUESTS',
        data: { pendingCount },
        quickLinks: [{ label: 'Duyệt yêu cầu cập nhật hồ sơ', path: '/admin/profile-requests' }],
      };
    }
  }

  // 9. Data & Action: Thống kê hệ thống (Admin)
  if (
    text.includes('thong ke') ||
    text.includes('tong quan') ||
    text.includes('bao cao') ||
    text.includes('so luong')
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
        quickLinks: [{ label: 'Xem Báo cáo Tổng quan', path: '/admin' }],
      };
    }
  }

  // 10. Quick Search: Tìm kiếm sinh viên
  if (text.startsWith('tim sinh vien') || text.startsWith('tim kiem sinh vien') || text.startsWith('sv ')) {
    const keyword = rawText.replace(/^(tìm sinh viên|tìm kiếm sinh viên|sv)\s*/i, '').trim();
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
        return {
          reply: `Tìm thấy ${found.length} sinh viên phù hợp:\n\n${studentLines}`,
          intent: 'SEARCH_STUDENT',
          data: found,
          quickLinks: isAdmin ? [{ label: 'Quản lý Sinh viên', path: '/admin/students' }] : [],
        };
      }
      return {
        reply: `Không tìm thấy sinh viên nào khớp với từ khóa "${keyword}".`,
        intent: 'SEARCH_STUDENT_EMPTY',
      };
    }
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
    text.includes('lop hoc phan') ||
    text.includes('quan ly lop') ||
    text.includes('mo lop') ||
    text.includes('danh sach lop')
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
    text.includes('danh sach khoa') ||
    text.includes('cac khoa') ||
    text.includes('bo mon') ||
    text.includes('nganh hoc')
  ) {
    return {
      reply: 'Dạ, bạn có thể xem và quản lý danh sách các khoa đào tạo tại mục "Quản lý khoa" ở menu bên trái.',
      intent: 'NAV_DEPARTMENTS',
      quickLinks: [{ label: 'Quản lý Khoa', path: '/admin/departments' }],
    };
  }

  // 14. Navigation: Quản lý Môn học
  if (
    text.includes('quan ly mon hoc') ||
    text.includes('danh muc mon hoc') ||
    text.includes('danh sach mon hoc') ||
    text.includes('mon hoc')
  ) {
    return {
      reply: 'Dạ, bạn có thể xem và quản lý danh mục môn học, số tín chỉ và mã môn tại mục "Quản lý môn học" ở menu bên trái.',
      intent: 'NAV_COURSES',
      quickLinks: [{ label: 'Quản lý Môn học', path: '/admin/courses' }],
    };
  }

  // 15. Navigation: Quản lý Giảng viên
  if (
    text.includes('danh sach giang vien') ||
    text.includes('quan ly giang vien') ||
    text.includes('quan ly giao vien') ||
    text.includes('giang vien') ||
    text.includes('giao vien')
  ) {
    return {
      reply: 'Dạ, để xem danh sách giảng viên toàn trường, bạn có thể truy cập nhanh vào mục Quản lý giáo viên ở menu bên trái.',
      intent: 'NAV_TEACHERS',
      quickLinks: isAdmin
        ? [
            { label: 'Quản lý Giảng viên', path: '/admin/teachers' },
            { label: 'Tài khoản Giảng viên', path: '/admin/teacher-accounts' },
          ]
        : [{ label: 'Quản lý Giảng viên', path: '/admin/teachers' }],
    };
  }

  // 16. Navigation: Danh sách sinh viên & Quản lý sinh viên (Checked after specific features)
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

export default handleAiAssistantQuery;

