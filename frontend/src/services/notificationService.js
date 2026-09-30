// Notification Service - Quản lý thông báo người dùng theo role
export const getInitialNotifications = (role, user) => {
  if (role === 'sinh-vien') {
    return [
      {
        id: 'notif_sv_1',
        type: 'feedback',
        title: 'Phản hồi từ Giảng viên',
        message: 'Thầy Nguyễn Văn đã trả lời góp ý của bạn về môn Lập trình Web: "Cảm ơn em đã tích cực phát biểu!"',
        time: '10 phút trước',
        link: '/student',
        isRead: false,
        timestamp: Date.now() - 10 * 60 * 1000,
      },
      {
        id: 'notif_sv_2',
        type: 'attendance',
        title: 'Ghi nhận điểm danh',
        message: 'Bạn đã được ghi nhận có mặt trong tiết học hôm nay. Điểm chuyên cần: 10/10.',
        time: '1 giờ trước',
        link: '/student/attendance',
        isRead: false,
        timestamp: Date.now() - 60 * 60 * 1000,
      },
      {
        id: 'notif_sv_3',
        type: 'assignment',
        title: 'Nhắc nhở hạn nộp bài tập',
        message: 'Bài tập: Giải thuật tìm kiếm sắp đến hạn nộp (còn 2 ngày).',
        time: '3 giờ trước',
        link: '/student/assignments',
        isRead: false,
        timestamp: Date.now() - 3 * 3600 * 1000,
      },
      {
        id: 'notif_sv_4',
        type: 'feedback',
        title: 'Phản hồi từ Thầy Trần Đình',
        message: 'Thầy Trần Đình đã giải đáp về chất lượng âm thanh phòng Lab 203.',
        time: 'Hôm qua',
        link: '/student',
        isRead: true,
        timestamp: Date.now() - 24 * 3600 * 1000,
      },
      {
        id: 'notif_sv_5',
        type: 'system',
        title: 'Thông báo học vụ',
        message: 'Thời gian đăng ký môn học bổ sung học kỳ mới đang mở.',
        time: '2 ngày trước',
        link: '/student/course-registration',
        isRead: true,
        timestamp: Date.now() - 48 * 3600 * 1000,
      },
    ];
  }

  if (role === 'giao-vien') {
    return [
      {
        id: 'notif_gv_1',
        type: 'feedback',
        title: 'Ý kiến phản hồi mới',
        message: 'Sinh viên Trần Văn A vừa gửi đánh giá 5 sao cho môn Lập trình Web Cơ bản.',
        time: '15 phút trước',
        link: '/teacher',
        isRead: false,
        timestamp: Date.now() - 15 * 60 * 1000,
      },
      {
        id: 'notif_gv_2',
        type: 'assignment',
        title: 'Sinh viên nộp bài tập',
        message: 'Có sinh viên vừa hoàn thành nộp bài tập Lập trình Web tuần này.',
        time: '1 giờ trước',
        link: '/teacher/assignments',
        isRead: false,
        timestamp: Date.now() - 60 * 60 * 1000,
      },
      {
        id: 'notif_gv_3',
        type: 'attendance',
        title: 'Báo cáo điểm danh lớp',
        message: 'Lớp Lập trình Web (CNTT101) đã hoàn tất điểm danh hôm nay: 100% có mặt.',
        time: '2 giờ trước',
        link: '/teacher/attendance',
        isRead: false,
        timestamp: Date.now() - 2 * 3600 * 1000,
      },
      {
        id: 'notif_gv_4',
        type: 'feedback',
        title: 'Đóng góp ý kiến học phần',
        message: 'Một sinh viên ẩn danh đã gửi góp ý về tài liệu học phần Cơ sở dữ liệu.',
        time: 'Hôm qua',
        link: '/teacher',
        isRead: true,
        timestamp: Date.now() - 24 * 3600 * 1000,
      },
      {
        id: 'notif_gv_5',
        type: 'system',
        title: 'Lịch giảng dạy tuần mới',
        message: 'Phòng Đào Tạo đã cập nhật phòng học mới cho tiết thực hành.',
        time: '2 ngày trước',
        link: '/teacher/schedule',
        isRead: true,
        timestamp: Date.now() - 48 * 3600 * 1000,
      },
    ];
  }

  // Admin / Đào tạo
  return [
    {
      id: 'notif_pdt_1',
      type: 'feedback',
      title: 'Ý kiến sinh viên mới',
      message: 'Có phản hồi mới từ sinh viên Khoa CNTT về chất lượng giảng dạy.',
      time: '5 phút trước',
      link: '/admin/feedbacks',
      isRead: false,
      timestamp: Date.now() - 5 * 60 * 1000,
    },
    {
      id: 'notif_pdt_2',
      type: 'attendance',
      title: 'Báo cáo chuyên cần hôm nay',
      message: 'Tỷ lệ chuyên cần toàn trường hôm nay đạt 96% với 42 lượt điểm danh.',
      time: '1 giờ trước',
      link: '/admin/attendance',
      isRead: false,
      timestamp: Date.now() - 60 * 60 * 1000,
    },
    {
      id: 'notif_pdt_3',
      type: 'system',
      title: 'Đăng ký học phần mới',
      message: 'Có thêm sinh viên đăng ký lớp Lập trình Web Cơ bản.',
      time: '2 giờ trước',
      link: '/admin/courses',
      isRead: false,
      timestamp: Date.now() - 2 * 3600 * 1000,
    },
    {
      id: 'notif_pdt_4',
      type: 'feedback',
      title: 'Giảng viên đã phản hồi',
      message: 'GV. Trần Đình đã giải đáp phản hồi của sinh viên phòng Lab 203.',
      time: 'Hôm qua',
      link: '/admin/feedbacks',
      isRead: true,
      timestamp: Date.now() - 24 * 3600 * 1000,
    },
    {
      id: 'notif_pdt_5',
      type: 'system',
      title: 'Hệ thống trực tuyến',
      message: 'Cơ sở dữ liệu MongoDB đã được đồng bộ thành công.',
      time: '3 ngày trước',
      link: '/admin',
      isRead: true,
      timestamp: Date.now() - 72 * 3600 * 1000,
    },
  ];
};

export const getStoredNotifications = (role, user) => {
  try {
    const key = `edumin_notifs_${user?.email || role || 'common'}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const defaults = getInitialNotifications(role, user);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  } catch {
    return getInitialNotifications(role, user);
  }
};

export const saveStoredNotifications = (role, user, list) => {
  try {
    const key = `edumin_notifs_${user?.email || role || 'common'}`;
    localStorage.setItem(key, JSON.stringify(list));
  } catch {}
};

