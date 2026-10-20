import React, { useEffect, useState, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import apiClient from './services/api';
import teacherAPI from './services/teacherAPI';
import assignmentAPI from './services/assignmentAPI';
import documentAPI from './services/documentAPI';
import courseAPI from './services/courseAPI';
import studentAPI from './services/studentAPI';
import feedbackAPI from './services/feedbackAPI';
import {
  fetchOpenRegistrations,
  fetchStudentRegistrations,
  OPEN_REGISTRATIONS_UPDATED_EVENT,
  STUDENT_REGISTRATIONS_UPDATED_EVENT,
} from './utils/registrationUtils';
import { isClassOfTeacher } from './utils/teacherUtils';
import { useTeacherLockMonitor } from './hooks/useTeacherLockMonitor';
import NotificationBell from './components/NotificationBell';

const getAttendanceBadgeConfig = (status) => {
  switch (status) {
    case 'Có mặt':
      return { class: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'fa-check-circle' };
    case 'Đi muộn':
      return { class: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'fa-clock' };
    case 'Vắng có phép':
      return { class: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'fa-calendar-check' };
    case 'Vắng mặt':
      return { class: 'bg-rose-50 text-rose-700 border-rose-200', icon: 'fa-times-circle' };
    default:
      return { class: 'bg-gray-50 text-gray-500 border-gray-200', icon: 'fa-circle' };
  }
};

const getEvalTagBadgeClass = (tag) => {
  if (!tag) return 'bg-gray-50 text-gray-600 border-gray-200';
  const t = tag.toLowerCase();
  if (t.includes('tốt') || t.includes('tích cực') || t.includes('đầy đủ') || t.includes('hăng hái')) {
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  }
  if (t.includes('muộn') || t.includes('tập trung') || t.includes('nhắc nhở')) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (t.includes('chưa') || t.includes('vắng') || t.includes('kém') || t.includes('yếu')) {
    return 'bg-rose-50 text-rose-700 border-rose-200';
  }
  return 'bg-indigo-50 text-indigo-700 border-indigo-200';
};

const GVDashboard = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ oldPassword: false, newPassword: false, confirmPassword: false });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [dashboardStats, setDashboardStats] = useState({
    assignmentsCount: 0,
    documentsCount: 0,
    submissionRate: 0,
    avgScore: '0.0',
  });
  const [recentAssignments, setRecentAssignments] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [evaluatingStudent, setEvaluatingStudent] = useState(null);
  const [evalForm, setEvalForm] = useState({
    score: 10,
    evaluation: 'Tiếp thu tốt',
    note: '',
    status: 'Có mặt',
    date: new Date().toISOString().split('T')[0],
  });
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [classProgress, setClassProgress] = useState({
    totalClasses: 0,
    totalStudents: 0,
    progressRate: 0,
  });

  // Feedback states
  const [teacherFeedbacks, setTeacherFeedbacks] = useState([]);
  const [feedbackFilterCourse, setFeedbackFilterCourse] = useState('all');
  const [replyModal, setReplyModal] = useState({ isOpen: false, item: null, responseText: '' });
  const [savingReply, setSavingReply] = useState(false);

  const { showLockModal, lockReason, handleLogoutToLogin } = useTeacherLockMonitor(currentUser);

  useEffect(() => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user) {
      setCurrentUser(user);
    }
  }, []);

  useEffect(() => {
    if (!currentUser?.email) return;
    updateTeacherProfile();
    loadDashboardData();

    const onOpenUpdate = () => loadDashboardData();
    const onStudentUpdate = () => loadDashboardData();
    const onAttendanceUpdate = () => loadDashboardData();
    const onFeedbackUpdate = () => loadDashboardData();
    window.addEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onOpenUpdate);
    window.addEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, onStudentUpdate);
    window.addEventListener('edumin_attendance_updated', onAttendanceUpdate);
    window.addEventListener('edumin_feedback_updated', onFeedbackUpdate);
    return () => {
      window.removeEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onOpenUpdate);
      window.removeEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, onStudentUpdate);
      window.removeEventListener('edumin_attendance_updated', onAttendanceUpdate);
      window.removeEventListener('edumin_feedback_updated', onFeedbackUpdate);
    };
  }, [currentUser?.email]);

  const loadDashboardData = async () => {
    const emailKey = currentUser?.email?.trim().toLowerCase();
    if (!emailKey) return;
    try {
      const [teachers, openRegs, allAssignments, allDocs, courses, allStudents, studentRegs, allAttendances, allFeedbacks] = await Promise.all([
        teacherAPI.getAllTeachers({ fresh: true }),
        fetchOpenRegistrations({ fresh: true }),
        assignmentAPI.getAllAssignments({ fresh: true }),
        documentAPI.getAllDocuments({ fresh: true }),
        courseAPI.getAllCourses({ fresh: true }),
        studentAPI.getAllStudents({ fresh: true }),
        fetchStudentRegistrations({ fresh: true }),
        apiClient.getAttendances().catch(() => []),
        feedbackAPI.getFeedbacks().catch(() => []),
      ]);

      const matchedTeacher = teachers.find((t) => t.email?.trim().toLowerCase() === emailKey);
      const teacher = matchedTeacher || currentUser;
      const teacherIdVal = teacher?.id != null ? String(teacher.id) : null;

      // Tất cả lớp thuộc quyền phụ trách của giảng viên
      const myClasses = (openRegs || []).filter((reg) => {
        if (teacher && isClassOfTeacher(reg, teacher)) return true;
        if (teacherIdVal != null && String(reg.teacherId) === teacherIdVal) return true;
        return false;
      });

      const myClassRegIds = new Set(myClasses.map((c) => String(c.id)));
      const myCourseIds = new Set(myClasses.map((c) => String(c.courseId).trim().toLowerCase()));
      const tName = (teacher.hoTen || teacher.name || '').trim().toLowerCase();

      // Bài tập của giảng viên
      const myAssignments = (allAssignments || []).filter((a) => {
        const cId = String(a.courseId || '').trim().toLowerCase();
        const mod = (a.modifiedBy || '').trim().toLowerCase();
        return (cId && myCourseIds.has(cId)) || (mod && tName && (mod === tName || mod.includes(tName) || tName.includes(mod)));
      });

      // Tài liệu của giảng viên
      const myDocuments = (allDocs || []).filter((d) => {
        const cId = String(d.courseId || '').trim().toLowerCase();
        const mod = (d.modifiedBy || '').trim().toLowerCase();
        return (cId && myCourseIds.has(cId)) || (mod && tName && (mod === tName || mod.includes(tName) || tName.includes(mod)));
      });

      // Tìm sinh viên thực tế đã đăng ký vào các lớp học phần của giảng viên này
      const myEnrolledRegistrations = (studentRegs || []).filter((item) => {
        const matchesReg = myClassRegIds.has(String(item.regId));
        const matchesCourse = item.courseId && myCourseIds.has(String(item.courseId).trim().toLowerCase());
        return matchesReg || matchesCourse;
      });

      const enrolledMap = new Map();
      myEnrolledRegistrations.forEach((item) => {
        const sObj = (allStudents || []).find((s) =>
          String(s.id) === String(item.studentId) ||
          (s.email && item.email && s.email.toLowerCase() === item.email.toLowerCase()) ||
          (s.email && item.studentEmail && s.email.toLowerCase() === item.studentEmail.toLowerCase()) ||
          (item.studentRef && typeof item.studentRef === 'object' && s.email === item.studentRef.email)
        );

        const studentId = sObj?.id || item.studentId;
        const regId = item.regId;
        const key = `${studentId}-${regId || item.courseId}`;

        const studentName = sObj?.name || sObj?.hoTen || item.studentName || item.studentRef?.name || item.studentRef?.hoTen || 'Sinh viên';
        const studentEmail = sObj?.email || item.studentEmail || item.email || '';
        const avatar = sObj?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(studentName)}&background=6366f1&color=fff`;

        const matchedClass = myClasses.find((c) => String(c.id) === String(regId) || String(c.courseId).toLowerCase() === String(item.courseId).toLowerCase());
        const courseName = matchedClass?.courseName || item.courseName || 'Lớp học phần';
        const courseId = matchedClass?.courseId || item.courseId || '';

        // Điểm danh & Đánh giá của sinh viên này trong học phần
        const studentAtts = (allAttendances || []).filter((a) => {
          const matchId = String(a.studentId) === String(studentId);
          const matchEmail = Boolean(studentEmail && a.studentEmail && a.studentEmail.toLowerCase() === studentEmail.toLowerCase());
          const matchCourse = (regId && String(a.regId) === String(regId)) || 
                              (courseId && a.courseId && String(a.courseId).toLowerCase() === String(courseId).toLowerCase());
          return (matchId || matchEmail) && (matchCourse || (!a.regId && !a.courseId));
        });

        const parseAttendanceTime = (att) => {
          if (att.timestamp && !isNaN(Number(att.timestamp))) return Number(att.timestamp);
          if (att.updatedAt && !isNaN(new Date(att.updatedAt).getTime())) return new Date(att.updatedAt).getTime();
          if (att.createdAt && !isNaN(new Date(att.createdAt).getTime())) return new Date(att.createdAt).getTime();
          if (typeof att.evaluatedAt === 'string') {
            const parts = att.evaluatedAt.split(' ');
            if (parts.length === 2) {
              const [timeStr, dateStr] = parts;
              const [d, m, y] = dateStr.split('/');
              const [hh, mm] = timeStr.split(':');
              const t = new Date(Number(y), Number(m) - 1, Number(d), Number(hh) || 0, Number(mm) || 0).getTime();
              if (!isNaN(t)) return t;
            }
          }
          if (typeof att.checkedAt === 'string') {
            const parts = att.checkedAt.split(' ');
            if (parts.length === 2) {
              const [timeStr, dateStr] = parts;
              const [d, m, y] = dateStr.split('/');
              const [hh, mm] = timeStr.split(':');
              const t = new Date(Number(y), Number(m) - 1, Number(d), Number(hh) || 0, Number(mm) || 0).getTime();
              if (!isNaN(t)) return t;
            }
          }
          if (att.date && !isNaN(new Date(att.date).getTime())) return new Date(att.date).getTime();
          return 0;
        };

        const sortedAtts = [...studentAtts].sort((a, b) => parseAttendanceTime(b) - parseAttendanceTime(a));
        const latestAtt = sortedAtts[0] || null;
        const latestEval = sortedAtts.find((a) =>
          (a.score !== null && a.score !== undefined && a.score !== '' && Number.isFinite(Number(a.score))) ||
          (a.evaluation && String(a.evaluation).trim().length > 0) ||
          (a.note && String(a.note).trim().length > 0)
        ) || latestAtt;

        const evalScore = (latestEval?.score !== null && latestEval?.score !== undefined && latestEval?.score !== '' && Number.isFinite(Number(latestEval.score)))
          ? Number(latestEval.score)
          : null;
        const evalTag = latestEval?.evaluation ? String(latestEval.evaluation).trim() : '';
        const evalNote = latestEval?.note ? String(latestEval.note).trim() : '';
        const attendanceStatus = latestEval?.status || latestAtt?.status || 'Chưa điểm danh';
        const evaluatedAt = latestEval?.evaluatedAt || latestAtt?.checkedAt || '';

        // Bài nộp của sinh viên này
        const studentSubs = (myAssignments || []).flatMap((a) =>
          (a.submissions || []).filter((s) => {
            const matchId = String(s.studentId) === String(studentId);
            const matchEmail = studentEmail && s.studentEmail && s.studentEmail.toLowerCase() === studentEmail.toLowerCase();
            return matchId || matchEmail;
          })
        );

        const scoredSubs = studentSubs.filter((s) => s.score != null && Number.isFinite(Number(s.score)));

        let computedScore = null;
        let subAvg = null;
        if (scoredSubs.length > 0) {
          subAvg = scoredSubs.reduce((acc, s) => acc + Number(s.score), 0) / scoredSubs.length;
        }

        if (evalScore !== null && subAvg !== null) {
          computedScore = ((evalScore + subAvg) / 2).toFixed(1);
        } else if (evalScore !== null) {
          computedScore = evalScore.toFixed(1);
        } else if (subAvg !== null) {
          computedScore = subAvg.toFixed(1);
        }

        enrolledMap.set(key, {
          key,
          regId,
          courseId,
          courseName,
          studentId,
          studentCode: `SV-${String(studentId).padStart(3, '0')}`,
          name: studentName,
          email: studentEmail,
          avatar,
          department: sObj?.department || item.department || '',
          avgScore: computedScore != null ? computedScore : null,
          hasScore: computedScore != null,
          latestScore: evalScore,
          latestEvaluation: evalTag,
          latestNote: evalNote,
          attendanceStatus,
          evaluatedAt,
          scoredSubsCount: scoredSubs.length,
          subAvg: subAvg !== null ? Number(subAvg.toFixed(1)) : null,
        });
      });

      const enrolledList = Array.from(enrolledMap.values());
      setEnrolledStudents(enrolledList);

      // Tính tỷ lệ nộp bài & điểm trung bình
      let totalSubmissions = 0;
      let totalScore = 0;
      let scoreCount = 0;
      myAssignments.forEach((a) => {
        if (Array.isArray(a.submissions)) {
          totalSubmissions += a.submissions.length;
          a.submissions.forEach((s) => {
            if (s.score != null && Number.isFinite(Number(s.score))) {
              totalScore += Number(s.score);
              scoreCount += 1;
            }
          });
        }
      });

      // Điểm trung bình kết hợp đánh giá thực tế của sinh viên
      const studentsWithScore = enrolledList.filter((s) => s.hasScore);
      let calculatedAvgScore = '8.0';
      if (studentsWithScore.length > 0) {
        const sum = studentsWithScore.reduce((acc, s) => acc + Number(s.avgScore), 0);
        calculatedAvgScore = (sum / studentsWithScore.length).toFixed(1);
      } else if (scoreCount > 0) {
        calculatedAvgScore = (totalScore / scoreCount).toFixed(1);
      } else if (enrolledList.length === 0) {
        calculatedAvgScore = '0.0';
      }

      const totalExpectedSubs = myAssignments.length > 0 && enrolledList.length > 0
        ? myAssignments.length * enrolledList.length
        : myAssignments.length * 10;
      const submissionRate = myAssignments.length > 0
        ? (totalSubmissions > 0 ? Math.min(100, Math.round((totalSubmissions / totalExpectedSubs) * 100)) : 85)
        : (enrolledList.length > 0 ? 80 : 0);

      setDashboardStats({
        assignmentsCount: myAssignments.length,
        documentsCount: myDocuments.length,
        submissionRate,
        avgScore: calculatedAvgScore,
      });

      setClassProgress({
        totalClasses: myClasses.length,
        totalStudents: enrolledList.length,
        progressRate: submissionRate || (enrolledList.length > 0 ? 80 : 0),
      });

      // Danh sách bài tập mới nhất
      const formattedRecent = [...myAssignments]
        .reverse()
        .slice(0, 5)
        .map((item) => {
          const matchedCourse = myClasses.find((c) => String(c.courseId).toLowerCase() === String(item.courseId).toLowerCase())
            || courses.find((c) => String(c.id).toLowerCase() === String(item.courseId).toLowerCase());
          return {
            ...item,
            displayClassName: matchedCourse?.className || matchedCourse?.classId || item.courseId || 'Lớp học phần',
          };
        });

      setRecentAssignments(formattedRecent);

      // Lọc các feedback sinh viên gửi cho giảng viên này
      const myFeedbacks = (allFeedbacks || []).filter((fb) => {
        if (!fb) return false;
        if (teacherIdVal != null && fb.teacherId != null && String(fb.teacherId) === teacherIdVal) return true;
        if (fb.regId && myClassRegIds.has(String(fb.regId))) return true;
        if (fb.courseId && myCourseIds.has(String(fb.courseId).trim().toLowerCase())) return true;
        if (fb.teacherName && tName && (fb.teacherName.toLowerCase().includes(tName) || tName.includes(fb.teacherName.toLowerCase()))) return true;
        return false;
      });
      setTeacherFeedbacks(myFeedbacks);
    } catch (err) {
      console.error('Không tải được số liệu dashboard giáo viên:', err);
    }
  };

  const handleOpenReply = (fb) => {
    setReplyModal({
      isOpen: true,
      item: fb,
      responseText: fb.response || '',
    });
  };

  const handleCloseReply = () => {
    setReplyModal({
      isOpen: false,
      item: null,
      responseText: '',
    });
  };

  const handleSaveReply = async () => {
    if (!replyModal.item || !replyModal.responseText.trim()) return;
    setSavingReply(true);
    try {
      await feedbackAPI.respondFeedback(
        replyModal.item.id || replyModal.item._id,
        replyModal.responseText.trim()
      );
      showToast('Đã gửi phản hồi thành công đến sinh viên!', 'success');
      handleCloseReply();
      loadDashboardData();
    } catch (err) {
      console.error('Lỗi khi phản hồi sinh viên:', err);
      showToast('Không thể lưu phản hồi. Vui lòng thử lại.', 'error');
    } finally {
      setSavingReply(false);
    }
  };

  const openEvaluationModal = (student) => {
    setEvaluatingStudent(student);
    setEvalForm({
      score: student.latestScore != null ? Number(student.latestScore) : (student.avgScore != null ? Number(student.avgScore) : 10),
      evaluation: student.latestEvaluation || 'Tiếp thu tốt',
      note: student.latestNote || '',
      status: student.attendanceStatus && student.attendanceStatus !== 'Chưa điểm danh' ? student.attendanceStatus : 'Có mặt',
      date: new Date().toISOString().split('T')[0],
    });
  };

  const submitEvaluation = async () => {
    if (!evaluatingStudent) return;
    setSavingEvaluation(true);
    try {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const dateFormatted = `${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
      const newScore = Number(evalForm.score);

      const payload = {
        regId: String(evaluatingStudent.regId || evaluatingStudent.courseId || ''),
        courseId: evaluatingStudent.courseId || '',
        courseName: evaluatingStudent.courseName || '',
        studentId: Number(evaluatingStudent.studentId),
        studentName: evaluatingStudent.name,
        studentEmail: evaluatingStudent.email || '',
        studentAvatar: evaluatingStudent.avatar || '',
        avatar: evaluatingStudent.avatar || '',
        date: evalForm.date || now.toISOString().split('T')[0],
        shiftId: '1',
        shiftLabel: 'Ca 1 (Sáng)',
        status: evalForm.status || 'Có mặt',
        score: newScore,
        evaluation: evalForm.evaluation || '',
        note: evalForm.note || '',
        teacherId: teacherInfo?.id ?? currentUser?.id ?? null,
        teacherName: teacherInfo?.name || teacherInfo?.hoTen || currentUser?.hoTen || currentUser?.name || 'Giảng viên',
        evaluatedAt: dateFormatted,
        timestamp: Date.now(),
      };

      await apiClient.recordAndEvaluateAttendance(payload);

      setEnrolledStudents((prev) =>
        prev.map((s) => {
          if (s.key === evaluatingStudent.key) {
            let updatedAvg = newScore.toFixed(1);
            if (s.scoredSubsCount && s.subAvg != null) {
              updatedAvg = ((newScore + s.subAvg) / 2).toFixed(1);
            }
            return {
              ...s,
              avgScore: updatedAvg,
              hasScore: true,
              latestEvaluation: evalForm.evaluation,
              latestNote: evalForm.note,
              latestScore: newScore,
              attendanceStatus: evalForm.status || 'Có mặt',
              evaluatedAt: dateFormatted,
            };
          }
          return s;
        })
      );

      showToast(`Đã lưu đánh giá cho sinh viên ${evaluatingStudent.name}!`, 'success');
      setEvaluatingStudent(null);
    } catch (err) {
      console.error('Lỗi lưu đánh giá:', err);
      showToast(err.message || 'Không thể lưu đánh giá', 'error');
    } finally {
      setSavingEvaluation(false);
    }
  };

  const filteredEnrolledStudents = useMemo(() => {
    if (!studentSearch.trim()) return enrolledStudents;
    const q = studentSearch.trim().toLowerCase();
    return enrolledStudents.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      s.studentCode.toLowerCase().includes(q) ||
      s.courseName.toLowerCase().includes(q) ||
      (s.department && s.department.toLowerCase().includes(q))
    );
  }, [enrolledStudents, studentSearch]);

  useEffect(() => {
    const handleClickOutside = () => {
      setShowUserDropdown(false);
    };

    if (showUserDropdown) {
      window.addEventListener('click', handleClickOutside);
    }
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [showUserDropdown]);

  useEffect(() => {
    if (!currentUser) return;

    const heartbeatTimer = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(heartbeatTimer);
  }, [currentUser]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const updateTeacherProfile = async () => {
    const emailKey = currentUser.email?.trim().toLowerCase();
    if (!emailKey) return;

    const mergeFromAccount = (account) => {
      const merged = { ...currentUser, ...account };
      setTeacherInfo(merged);
      setCurrentUser(merged);
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
    };

    try {
      const teachers = await teacherAPI.getAllTeachers({ fresh: true });
      const teacher = teachers.find((t) => t.email?.trim().toLowerCase() === emailKey);
      if (teacher) {
        mergeFromAccount(teacher);
        return;
      }
    } catch (error) {
      console.error('Không tải hồ sơ giáo viên từ API:', error);
    }

    setTeacherInfo(currentUser);
  };

  const showToast = (message, type = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const toggleUserDropdown = (e) => {
    e.stopPropagation();
    setShowUserDropdown((prev) => !prev);
  };

  const openChangePasswordModal = () => {
    setShowPasswordModal(true);
    setShowUserDropdown(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
    setPasswordVisibility({ oldPassword: false, newPassword: false, confirmPassword: false });
  };

  const closeChangePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordErrors({});
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const togglePasswordVisibility = (field) => {
    setPasswordVisibility((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const setFieldError = (field, message) => {
    setPasswordErrors((prev) => ({ ...prev, [field]: message }));
  };

  const submitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    setPasswordErrors({});

    if (!oldPassword) {
      setFieldError('oldPassword', 'Vui lòng nhập mật khẩu cũ');
      return;
    }
    if (!newPassword) {
      setFieldError('newPassword', 'Vui lòng nhập mật khẩu mới');
      return;
    }
    if (!confirmPassword) {
      setFieldError('confirmPassword', 'Vui lòng xác nhận mật khẩu mới');
      return;
    }
    if (newPassword.length < 6) {
      setFieldError('newPassword', 'Mật khẩu mới phải từ 6 ký tự');
      return;
    }
    if (newPassword === oldPassword) {
      setFieldError('newPassword', 'Mật khẩu mới không được trùng mật khẩu cũ');
      return;
    }
    if (newPassword !== confirmPassword) {
      setFieldError('confirmPassword', 'Xác nhận mật khẩu không khớp');
      return;
    }

    const realPassword =
      teacherInfo?.password ||
      teacherInfo?.pass ||
      currentUser?.password ||
      currentUser?.pass ||
      '';
    if (oldPassword !== realPassword) {
      setFieldError('oldPassword', 'Mật khẩu cũ không chính xác');
      return;
    }

    setSavingPassword(true);
    try {
      const updatedTeacher = await teacherAPI.updateTeacherPassword(currentUser.email, newPassword);

      const updatedUser = { ...currentUser, ...updatedTeacher, password: newPassword };
      setCurrentUser(updatedUser);
      setTeacherInfo(updatedUser);
      sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));

      showToast('Đã cập nhật mật khẩu mới thành công!', 'success');
      setTimeout(() => closeChangePasswordModal(), 500);
    } catch (error) {
      console.error('Không lưu được mật khẩu lên API:', error);
      showToast(error.message || 'Không lưu được mật khẩu lên API. Vui lòng thử lại.', 'error');
    } finally {
      setSavingPassword(false);
    }
  };

  const padID = (id) => `GV-${String(id).padStart(3, '0')}`;

  const sendHeartbeat = () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (!user || !user.email) return;
    const heartbeats = JSON.parse(localStorage.getItem('user_heartbeats')) || {};
    heartbeats[user.email] = Date.now();
    localStorage.setItem('user_heartbeats', JSON.stringify(heartbeats));
  };

  const handleLogout = () => {
    const user = JSON.parse(sessionStorage.getItem('currentUser'));
    if (user && user.email) {
      const heartbeats = JSON.parse(localStorage.getItem('user_heartbeats')) || {};
      delete heartbeats[user.email];
      localStorage.setItem('user_heartbeats', JSON.stringify(heartbeats));
    }
    sessionStorage.removeItem('currentUser');
    apiClient.clearAuthCache();
    navigate('/');
  };

  if (!currentUser) return null;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}
          >
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl"></i>
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <NotificationBell currentUser={currentUser} customRole="giao-vien" />
          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">GV. {teacherInfo?.name || currentUser.hoTen || 'Giáo viên'}</p>
                <p className="text-xs text-gray-500">Đã đăng nhập</p>
              </div>
              <img
                src={teacherInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacherInfo?.name || currentUser.hoTen || 'GV')}&background=6366f1&color=fff`}
                alt="Avatar"
                className="w-10 h-10 rounded-full shadow-sm object-cover"
              />
            </div>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]" onClick={(e) => e.stopPropagation()}>
                <button onClick={openChangePasswordModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <i className="fas fa-key mr-2"></i> Đổi mật khẩu
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <i className="fas fa-sign-out-alt mr-2"></i> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/gv-dashboard"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-th-large w-5 text-center"></i> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button onClick={() => setSubmenuOpen((prev) => !prev)} className="w-full flex items-center justify-between p-3 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book w-5 text-center"></i>
                    <span>Bài tập & Tài liệu</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${submenuOpen ? 'rotate-180' : ''}`}></i>
                </button>
                <div className={`submenu-container overflow-hidden transition-all duration-300 ${submenuOpen ? 'max-h-32' : 'max-h-0'}`}>
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/gv/assignments"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/gv/documents"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold bg-indigo-50' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                        Danh sách tài liệu
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
              <li>
                <NavLink
                  to="/gv/classes"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-chart-pie w-5 text-center"></i>
                  <span>Danh sách lớp dạy</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/gv/schedule"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-history w-5 text-center"></i><span>Thời khoá biểu</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/gv/attendance"
                  className={({ isActive }) =>
                    `flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                    }`
                  }
                >
                  <i className="fas fa-user-check w-5 text-center"></i><span>Điểm danh & Đánh giá</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                  <i className="fas fa-file-signature"></i>
                </div>
                <span className="text-blue-500 text-[10px] font-bold bg-blue-50 px-2 py-1 rounded-lg">Cập nhật</span>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Bài tập đã giao</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardStats.assignmentsCount}</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: dashboardStats.assignmentsCount > 0 ? '100%' : '15%' }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-orange-50 p-3 rounded-xl text-orange-500">
                  <i className="fas fa-folder-open"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Tài liệu học tập</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardStats.documentsCount}</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-orange-400 h-1.5 rounded-full" style={{ width: dashboardStats.documentsCount > 0 ? '100%' : '15%' }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                  <i className="fas fa-user-edit"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">SV đã nộp bài</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardStats.submissionRate}%</h3>
              <div className="w-full bg-gray-100 h-1.5 rounded-full mt-4">
                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${dashboardStats.submissionRate}%` }}></div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-50 relative overflow-hidden group hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-red-50 p-3 rounded-xl text-red-500">
                  <i className="fas fa-star"></i>
                </div>
              </div>
              <p className="text-gray-400 text-xs font-bold uppercase">Điểm trung bình</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-1">{dashboardStats.avgScore}</h3>
              <p className="text-[9px] text-red-400 mt-4 font-bold">THEO ĐÁNH GIÁ</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h4 className="text-lg font-bold text-gray-700">Bài tập mới nhất</h4>
                  <p className="text-xs text-gray-400">Quản lý và chỉnh sửa thông tin</p>
                </div>
                <button
                  onClick={() => navigate('/gv/assignments')}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition"
                >
                  <i className="fas fa-plus mr-2"></i> ĐĂNG BÀI
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-[11px] uppercase">
                    <tr>
                      <th className="p-4 font-semibold">Tên bài tập</th>
                      <th className="p-4 font-semibold text-center">Lớp</th>
                      <th className="p-4 font-semibold text-center">Hạn nộp</th>
                      <th className="p-4 font-semibold text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-gray-100">
                    {recentAssignments.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-gray-400 italic">
                          Chưa có bài tập nào được giao.
                          <div className="mt-2">
                            <button
                              onClick={() => navigate('/gv/assignments')}
                              className="text-xs text-indigo-600 font-bold hover:underline"
                            >
                              + Giao bài tập mới ngay
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      recentAssignments.map((assignment) => (
                        <tr
                          key={assignment.id}
                          className="hover:bg-gray-50 transition cursor-pointer"
                          onClick={() => navigate(`/gv/assignments?courseId=${encodeURIComponent(assignment.courseId)}`)}
                        >
                          <td className="p-4">
                            <p className="font-bold text-gray-800">{assignment.name || assignment.title || 'Bài tập'}</p>
                            <p className="text-[10px] text-gray-400">
                              <i className={`fas ${assignment.type === 'quiz' ? 'fa-question-circle text-violet-500' : 'fa-file-alt text-indigo-500'} mr-1`}></i>
                              {assignment.type === 'quiz' ? `${assignment.questions?.length || 0} câu hỏi` : (assignment.size || 'Tập tin')}
                            </p>
                          </td>
                          <td className="p-4 text-center text-gray-500 font-medium">
                            <span className="bg-gray-100 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold">
                              {assignment.displayClassName}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className="bg-red-50 text-red-500 px-3 py-1 rounded-full text-[10px] font-bold">
                              {assignment.dueDate || assignment.created || 'Không giới hạn'}
                            </span>
                          </td>
                          <td className="p-4 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => navigate(`/gv/assignments?courseId=${encodeURIComponent(assignment.courseId)}`)}
                              className="text-indigo-600 p-2 hover:bg-indigo-50 rounded-lg transition"
                              title="Xem bài tập"
                            >
                              <i className="fas fa-arrow-right"></i>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h4 className="text-lg font-bold text-gray-700 mb-6">Tiến độ lớp học</h4>
              <div className="flex flex-col items-center py-4">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="text-gray-100" strokeWidth="3" stroke="currentColor"></circle>
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      className="text-indigo-600 transition-all duration-700"
                      strokeWidth="3"
                      strokeDasharray={`${classProgress.progressRate}, 100`}
                      strokeLinecap="round"
                      stroke="currentColor"
                    ></circle>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-indigo-900">{classProgress.progressRate}%</span>
                    <span className="text-[10px] text-gray-400 font-bold uppercase">Xong</span>
                  </div>
                </div>
                <div className="w-full mt-8 space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-medium text-gray-500 uppercase">Quy mô lớp</span>
                    <span className="font-bold text-gray-800 text-xs">{classProgress.totalClasses} LỚP PHỤ TRÁCH</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-xs font-medium text-gray-500 uppercase">Sĩ số sinh viên</span>
                    <span className="font-bold text-gray-800 text-xs">{classProgress.totalStudents} SINH VIÊN</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <i className="fas fa-clipboard-check text-indigo-600"></i>
                  Đánh giá & Tổng kết sinh viên
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Đánh giá năng lực, thái độ học tập và chuyên cần của sinh viên các lớp bạn phụ trách
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {enrolledStudents.length > 3 && (
                  <div className="relative">
                    <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
                    <input
                      type="text"
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      placeholder="Tìm sinh viên, học phần..."
                      className="text-xs bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 w-44"
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/gv/attendance')}
                  className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <i className="fas fa-calendar-check text-xs"></i>
                  <span>Điểm danh & Đánh giá cả lớp</span>
                </button>
              </div>
            </div>

            {filteredEnrolledStudents.length === 0 ? (
              <div className="p-8 text-center bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-user-graduate text-2xl"></i>
                </div>
                <p className="font-bold text-gray-700 text-sm">
                  {enrolledStudents.length === 0
                    ? 'Chưa có sinh viên nào đăng ký lớp học phần của bạn'
                    : 'Không tìm thấy sinh viên phù hợp với từ khóa'}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {enrolledStudents.length === 0
                    ? 'Khi sinh viên đăng ký học phần bạn phụ trách, danh sách đánh giá sẽ tự động hiển thị tại đây.'
                    : 'Hãy thử tìm kiếm với mã SV hoặc tên khác.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredEnrolledStudents.map((student) => {
                  const attConfig = getAttendanceBadgeConfig(student.attendanceStatus);
                  const evalTagClass = getEvalTagBadgeClass(student.latestEvaluation);

                  return (
                    <div
                      key={student.key}
                      className="p-4 border border-gray-100 rounded-2xl flex flex-col justify-between hover:border-indigo-300 hover:shadow-md transition bg-white gap-3 group"
                    >
                      {/* Top Row: Avatar + Info + Action */}
                      <div className="flex items-start gap-3">
                        <img
                          src={student.avatar}
                          className="w-12 h-12 rounded-xl object-cover border border-gray-100 shrink-0 mt-0.5"
                          alt={student.name}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=6366f1&color=fff`;
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate" title={student.name}>
                            {student.name}
                          </p>
                          <p className="text-[11px] text-gray-400 font-medium truncate" title={`${student.studentCode} • ${student.courseName}`}>
                            {student.studentCode} • {student.courseName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEvaluationModal(student)}
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-sm"
                          title="Đánh giá sinh viên này"
                        >
                          <i className="fas fa-pen text-[10px]"></i>
                          <span>Đánh giá</span>
                        </button>
                      </div>

                      {/* Middle: Badges Row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* Attendance Status Badge */}
                        <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${attConfig.class}`}>
                          <i className={`fas ${attConfig.icon} text-[9px]`}></i>
                          {student.attendanceStatus || 'Chưa điểm danh'}
                        </span>

                        {/* Evaluation Score Badge */}
                        {student.latestScore != null ? (
                          <span className="text-[10.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1" title="Điểm đánh giá chuyên cần & thái độ của giảng viên">
                            <i className="fas fa-star text-[9px] text-amber-500"></i> ĐG: {student.latestScore}/10
                          </span>
                        ) : student.hasScore ? (
                          <span className="text-[10.5px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1" title="Điểm trung bình bài nộp">
                            <i className="fas fa-chart-line text-[9px]"></i> TB: {student.avgScore}
                          </span>
                        ) : (
                          <span className="text-[10.5px] font-medium text-gray-400 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                            <i className="far fa-circle text-[8px]"></i> Chưa chấm
                          </span>
                        )}

                        {/* Quick Tag Badge */}
                        {student.latestEvaluation && (
                          <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 max-w-[140px] truncate ${evalTagClass}`} title={student.latestEvaluation}>
                            <i className="fas fa-tag text-[8px]"></i> {student.latestEvaluation}
                          </span>
                        )}
                      </div>

                      {/* Bottom Note Callout Box: Teacher's Comment */}
                      {student.latestNote ? (
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-gray-700 flex items-start gap-2 shadow-xs">
                          <i className="fas fa-comment-dots text-indigo-500 text-[11px] mt-0.5 shrink-0"></i>
                          <div className="flex-1 min-w-0">
                            <p className="italic text-[11px] leading-relaxed line-clamp-2" title={student.latestNote}>
                              "{student.latestNote}"
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {/* Footer Timestamp */}
                      {student.evaluatedAt && (
                        <div className="text-[10px] text-gray-400 flex items-center justify-between pt-1 border-t border-gray-50">
                          <span className="inline-flex items-center gap-1">
                            <i className="far fa-clock text-[9px]"></i> Cập nhật: {student.evaluatedAt}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Phản hồi & Đánh giá từ Sinh viên */}
          <div className="mt-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h4 className="text-lg font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                  <i className="fas fa-comment-dots text-indigo-600"></i>
                  Phản hồi & Đánh giá từ Sinh viên
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Xem những góp ý, cảm nghĩ và mức độ hài lòng của sinh viên đối với tiết dạy và học phần của bạn
                </p>
              </div>

              {/* Summary Stats Badge */}
              <div className="flex items-center gap-3">
                <div className="bg-amber-50 border border-amber-200 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
                  <i className="fas fa-star text-amber-500 text-sm"></i>
                  <div>
                    <span className="text-xs font-black text-amber-700">
                      {teacherFeedbacks.length > 0
                        ? (teacherFeedbacks.reduce((acc, f) => acc + (Number(f.rating) || 5), 0) / teacherFeedbacks.length).toFixed(1)
                        : '5.0'}
                    </span>
                    <span className="text-[10px] text-amber-600 font-medium"> / 5.0 sao</span>
                  </div>
                </div>

                <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700">
                  {teacherFeedbacks.length} lượt nhận xét
                </div>
              </div>
            </div>

            {/* List of Student Feedbacks */}
            {teacherFeedbacks.length === 0 ? (
              <div className="py-12 text-center text-gray-400 bg-gray-50/50 rounded-2xl border border-dashed border-gray-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 text-indigo-400 shadow-xs">
                  <i className="far fa-comment-alt text-xl"></i>
                </div>
                <p className="text-sm font-semibold text-gray-600">Chưa có phản hồi nào từ sinh viên</p>
                <p className="text-xs text-gray-400 mt-0.5">Khi sinh viên gửi góp ý về học phần, nội dung sẽ hiển thị tại đây.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teacherFeedbacks.map((fb) => {
                  const sAvatar = fb.isAnonymous ? '' : (fb.studentAvatar || fb.studentRef?.avatar || '');
                  const sName = fb.isAnonymous ? 'Sinh viên ẩn danh' : (fb.displayName || fb.studentName || 'Sinh viên');

                  return (
                    <div
                      key={fb.id || fb._id}
                      className="p-5 bg-white rounded-2xl border border-gray-100 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between gap-3 group"
                    >
                      <div>
                        {/* Header: Student avatar, name, stars, quality */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {fb.isAnonymous ? (
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center text-base shrink-0 border border-purple-200">
                                <i className="fas fa-user-secret"></i>
                              </div>
                            ) : (
                              <img
                                src={
                                  sAvatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=10b981&color=fff`
                                }
                                alt={sName}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(sName)}&background=10b981&color=fff`;
                                }}
                                className="w-10 h-10 rounded-xl object-cover border border-gray-200 shrink-0"
                              />
                            )}

                            <div className="min-w-0">
                              <h5 className="font-bold text-xs text-gray-800 truncate">{sName}</h5>
                              <p className="text-[10px] text-gray-400 truncate">
                                {fb.courseName || 'Học phần'}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end shrink-0">
                            {/* Stars */}
                            <div className="flex items-center text-amber-400 text-xs">
                              {[1, 2, 3, 4, 5].map((st) => (
                                <i
                                  key={st}
                                  className={`fas fa-star text-[10px] ${st <= (fb.rating || 5) ? 'text-amber-400' : 'text-gray-200'}`}
                                ></i>
                              ))}
                            </div>
                            <span className={`mt-1 text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                              fb.courseQuality === 'Tốt'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : fb.courseQuality === 'Ổn'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {fb.courseQuality || 'Tốt'}
                            </span>
                          </div>
                        </div>

                        {/* Student Feedback Text */}
                        <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-700 italic border border-gray-100">
                          "{fb.feedbackText}"
                        </div>

                        {/* Teacher's Response (if already replied) */}
                        {fb.response && (
                          <div className="mt-2.5 p-3 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs space-y-1">
                            <div className="flex items-center justify-between text-indigo-700 font-bold text-[10px]">
                              <span className="flex items-center gap-1">
                                <i className="fas fa-reply"></i> Bạn đã phản hồi:
                              </span>
                              {fb.respondedAt && (
                                <span className="text-indigo-400 font-normal">{fb.respondedAt}</span>
                              )}
                            </div>
                            <p className="text-gray-700 font-medium text-[11px] leading-relaxed">
                              {fb.response}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Footer: Date + Reply Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-50 text-[10px]">
                        <span className="text-gray-400">
                          <i className="far fa-clock mr-1"></i>
                          {fb.createdAtFormatted || (fb.timestamp ? new Date(fb.timestamp).toLocaleDateString('vi-VN') : 'Mới đây')}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenReply(fb)}
                          className="px-3 py-1 rounded-xl text-[11px] font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition flex items-center gap-1 shadow-xs"
                        >
                          <i className="fas fa-reply text-[9px]"></i>
                          <span>{fb.response ? 'Sửa phản hồi' : 'Trả lời sinh viên'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {evaluatingStudent && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[300] flex items-center justify-center px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-28 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-auto overflow-hidden border border-slate-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white flex justify-between items-center gap-3">
              <div className="flex items-center gap-3.5 min-w-0">
                <img
                  src={evaluatingStudent.avatar}
                  alt={evaluatingStudent.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(evaluatingStudent.name)}&background=6366f1&color=fff`;
                  }}
                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white/30 shadow-md shrink-0"
                />
                <div className="min-w-0">
                  <h3 className="font-bold text-lg flex items-center gap-2 truncate">
                    <i className="fas fa-star text-amber-300 text-base"></i> Đánh giá sinh viên
                  </h3>
                  <p className="text-xs text-indigo-100 mt-0.5 truncate">
                    {evaluatingStudent.name} ({evaluatingStudent.studentCode}) • {evaluatingStudent.courseName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEvaluatingStudent(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition shrink-0"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Attendance Status Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                  Trạng thái điểm danh:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { val: 'Có mặt', icon: 'fa-check', active: 'bg-emerald-600 text-white shadow-sm', inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200' },
                    { val: 'Đi muộn', icon: 'fa-clock', active: 'bg-amber-600 text-white shadow-sm', inactive: 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200' },
                    { val: 'Vắng có phép', icon: 'fa-calendar-check', active: 'bg-blue-600 text-white shadow-sm', inactive: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' },
                    { val: 'Vắng mặt', icon: 'fa-times', active: 'bg-rose-600 text-white shadow-sm', inactive: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200' },
                  ].map((st) => (
                    <button
                      key={st.val}
                      type="button"
                      onClick={() => setEvalForm({ ...evalForm, status: st.val })}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        evalForm.status === st.val ? st.active : st.inactive
                      }`}
                    >
                      <i className={`fas ${st.icon} text-[10px]`}></i>
                      <span>{st.val}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Score Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-2">
                  Điểm chuyên cần & Thái độ học tập (0 - 10):
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={evalForm.score}
                    onChange={(e) => setEvalForm({ ...evalForm, score: Number(e.target.value) })}
                    className="flex-1 accent-indigo-600 cursor-pointer"
                  />
                  <span className="w-12 text-center text-xl font-black text-indigo-600 bg-indigo-50 py-1 rounded-xl border border-indigo-100">
                    {evalForm.score}
                  </span>
                </div>
                {/* Quick score pills */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[10, 9, 8, 7, 6, 5, 0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEvalForm({ ...evalForm, score: s })}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                        Number(evalForm.score) === s
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {s} điểm
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Tag Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-600 uppercase">
                    Nhận xét nhanh:
                  </label>
                  {evalForm.evaluation && (
                    <button
                      type="button"
                      onClick={() => setEvalForm({ ...evalForm, evaluation: '' })}
                      className="text-[11px] text-gray-400 hover:text-rose-500 font-medium transition"
                    >
                      <i className="fas fa-times text-[10px] mr-1"></i>Xóa nhận xét
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Tiếp thu tốt',
                    'Hăng hái phát biểu',
                    'Làm bài đầy đủ',
                    'Thái độ tích cực',
                    'Đi muộn',
                    'Cần tập trung hơn',
                    'Chưa làm bài tập',
                  ].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setEvalForm({ ...evalForm, evaluation: tag })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        evalForm.evaluation === tag
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Hoặc nhập nhận xét ngắn tùy chỉnh..."
                    value={evalForm.evaluation}
                    onChange={(e) => setEvalForm({ ...evalForm, evaluation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Detailed Note */}
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">
                  Ghi chú / Đánh giá chi tiết của giảng viên:
                </label>
                <textarea
                  rows="3"
                  value={evalForm.note}
                  onChange={(e) => setEvalForm({ ...evalForm, note: e.target.value })}
                  placeholder="Nhập lời phê, nhận xét năng lực hoặc góp ý cho sinh viên..."
                  className="w-full p-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                ></textarea>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const reg = evaluatingStudent.regId;
                    setEvaluatingStudent(null);
                    navigate(`/gv/attendance?regId=${encodeURIComponent(reg)}`);
                  }}
                  className="text-xs text-indigo-600 hover:underline font-bold"
                >
                  <i className="fas fa-external-link-alt mr-1"></i> Điểm danh cả lớp
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEvaluatingStudent(null)}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-100 transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={submitEvaluation}
                    disabled={savingEvaluation}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingEvaluation ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i> Đang lưu...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-check"></i> Lưu đánh giá
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Teacher Reply Modal */}
      {replyModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[300] flex items-center justify-center px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-28 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full my-auto overflow-hidden border border-slate-100">
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-lg">
                  <i className="fas fa-reply"></i>
                </div>
                <div>
                  <h3 className="font-bold text-base">Trả lời ý kiến sinh viên</h3>
                  <p className="text-xs text-indigo-100">
                    Phản hồi giải đáp thắc mắc hoặc cảm ơn đóng góp của sinh viên
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseReply}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs">
                <p className="text-gray-400 font-bold uppercase text-[10px] mb-1">
                  Ý kiến của sinh viên ({replyModal.item?.isAnonymous ? 'Ẩn danh' : (replyModal.item?.studentName || replyModal.item?.displayName || 'Sinh viên')}):
                </p>
                <p className="text-gray-700 italic">"{replyModal.item?.feedbackText}"</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase mb-2">
                  Nội dung phản hồi của Thầy/Cô:
                </label>
                <textarea
                  rows="4"
                  value={replyModal.responseText}
                  onChange={(e) => setReplyModal((prev) => ({ ...prev, responseText: e.target.value }))}
                  placeholder="Nhập nội dung phản hồi gửi đến sinh viên..."
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-700 outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
                ></textarea>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseReply}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={savingReply || !replyModal.responseText.trim()}
                  onClick={handleSaveReply}
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md shadow-indigo-100 transition flex items-center gap-2"
                >
                  {savingReply && <i className="fas fa-spinner fa-spin"></i>}
                  <span>Gửi phản hồi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm z-[200] flex items-center justify-center px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-28 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100/80 w-full max-w-md my-auto overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button onClick={closeChangePasswordModal} className="text-white hover:text-gray-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.oldPassword ? 'text' : 'password'}
                    name="oldPassword"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.oldPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập mật khẩu cũ"
                  />
                  <i
                    className={`fas ${passwordVisibility.oldPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('oldPassword')}
                  ></i>
                </div>
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.newPassword ? 'text' : 'password'}
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.newPassword ? 'border-red-500' : ''}`}
                    placeholder="Tối thiểu 6 ký tự"
                  />
                  <i
                    className={`fas ${passwordVisibility.newPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('newPassword')}
                  ></i>
                </div>
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <div className="relative">
                  <input
                    type={passwordVisibility.confirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition pr-10 ${passwordErrors.confirmPassword ? 'border-red-500' : ''}`}
                    placeholder="Nhập lại mật khẩu mới"
                  />
                  <i
                    className={`fas ${passwordVisibility.confirmPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer text-gray-400 hover:text-indigo-600`}
                    onClick={() => togglePasswordVisibility('confirmPassword')}
                  ></i>
                </div>
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button
                  onClick={submitChangePassword}
                  disabled={savingPassword}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingPassword ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4 sm:px-6 md:px-8 py-16 sm:py-24 md:py-28 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-md" />
          <div className="relative bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full my-auto text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-red-500 text-3xl animate-pulse"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-gray-500 text-sm mb-4">
              Tài khoản của bạn đã bị phòng đào tạo tạm khóa. Vui lòng liên hệ quản trị để được hỗ trợ.
            </p>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
              <p className="text-red-600 text-xs font-bold uppercase mb-1">Lý do từ phòng đào tạo:</p>
              <p className="text-red-600 font-semibold text-sm">{lockReason}</p>
            </div>
            <div className="space-y-3">
              <button
                type="button"
                onClick={handleLogoutToLogin}
                className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
              >
                QUAY VỀ TRANG ĐĂNG NHẬP
              </button>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Vui lòng liên hệ hỗ trợ để mở khóa</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GVDashboard;
