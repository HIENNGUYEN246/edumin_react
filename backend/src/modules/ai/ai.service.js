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

export async function handleAiAssistantQuery({ message, user }) {
  const rawText = String(message || '').trim();
  const text = normalizeText(rawText);

  const role = user?.role || '';
  const isAdmin = role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao';
  const isTeacher = role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien';
  const isStudent = role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien';

  // 1. Navigation: Cấu hình điểm, Trọng số & Quiz
  if (
    text.includes('cau hinh diem') ||
    text.includes('diem giua ky') ||
    text.includes('diem cuoi ky') ||
    text.includes('trong so') ||
    text.includes('gan quiz') ||
    text.includes('nhap diem')
  ) {
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
    text.includes('duyet ho so') ||
    text.includes('cho duyet') ||
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

  // 12. Navigation: Đổi mật khẩu & Hồ sơ cá nhân
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

  // Default fallback response with suggested prompts
  const suggestions = isTeacher
    ? ['Lịch dạy của tôi tuần này', 'Làm sao để cấu hình điểm giữa kỳ?', 'Danh sách lớp tôi phụ trách', 'Xem phản hồi từ sinh viên']
    : isStudent
    ? ['Thời khóa biểu của tôi', 'Đăng ký học phần ở đâu?', 'Xem điểm danh & chuyên cần', 'Xem bài tập & làm quiz']
    : ['Thống kê hệ thống', 'Yêu cầu duyệt hồ sơ chờ xử lý', 'Quản lý tài khoản giảng viên', 'Quản lý lớp học phần'];

  return {
    reply:
      `Xin chào ${user?.hoTen || 'bạn'}! Tôi là EduMin AI Assistant. Tôi có thể giúp bạn dẫn đường đến các tính năng, giải đáp cách thao tác, và tra cứu dữ liệu nhanh chóng trong hệ thống.\n\n` +
      'Bạn có thể gõ câu hỏi tự nhiên hoặc bấm vào một trong các gợi ý bên dưới:',
    intent: 'FALLBACK_HELP',
    suggestions,
    quickLinks: [
      { label: 'Trang Tổng quan', path: isTeacher ? '/teacher' : isStudent ? '/student' : '/admin' },
    ],
  };
}

export default handleAiAssistantQuery;

