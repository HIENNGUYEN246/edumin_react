import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import studentAPI from '../services/studentAPI';
import assignmentAPI from '../services/assignmentAPI';
import courseAPI from '../services/courseAPI';
import { fetchOpenRegistrations, fetchStudentRegistrations } from '../utils/registrationUtils';
import { useStudentLockMonitor } from '../hooks/useStudentLockMonitor';

const StudentAssignmentList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentUser, setCurrentUser] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [enrollments, setEnrollments] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(() => searchParams.get('courseId') || '');
  const [courseSearch, setCourseSearch] = useState('');
  const [courseSort, setCourseSort] = useState('default');
  const [courseFilter, setCourseFilter] = useState('all');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [submittedScore, setSubmittedScore] = useState(null);
  const quizId = searchParams.get('quizId');
  const { showLockModal, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  useEffect(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setCurrentUser(parsed);
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.email) return;
      try {
        const [students, regs, allAssignments, openRegs, courses] = await Promise.all([
          studentAPI.getAllStudents({ fresh: true }),
          fetchStudentRegistrations({ fresh: true }),
          assignmentAPI.getAllAssignments({ fresh: true }),
          fetchOpenRegistrations({ fresh: true }),
          courseAPI.getAllCourses({ fresh: true }),
        ]);

        const matched = students.find((s) => s.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase());
        const merged = matched ? { ...currentUser, ...matched, role: 'sinh-vien' } : currentUser;
        setStudentInfo(merged);
        setCurrentUser(merged);
        sessionStorage.setItem('currentUser', JSON.stringify(merged));

        const myRegs = regs.filter((reg) => String(reg.studentId) === String(merged.id));
        const enrichedRegs = myRegs.map((reg) => {
          const match = openRegs.find((o) => o.id === reg.regId || o.courseId === reg.courseId);
          const course = courses.find((item) => item.id === reg.courseId);
          return {
            ...match,
            ...reg,
            courseName: match?.courseName || reg?.courseName || '',
            classId: match?.classId || course?.classId || reg?.classId || '',
            className: match?.className || course?.className || reg?.className || '',
          };
        });

        setEnrollments(enrichedRegs);
        setAssignments(allAssignments || []);
      } catch (error) {
        console.error('Không tải được dữ liệu bài tập sinh viên:', error);
      }
    };
    loadData();
  }, [currentUser?.email]);

  useEffect(() => {
    setSelectedCourseId(searchParams.get('courseId') || '');
  }, [searchParams]);

  useEffect(() => {
    if (!quizId) {
      setSelectedQuiz(null);
      setQuizAnswers({});
      setSubmittedScore(null);
      return;
    }

    const quiz = assignments.find((item) => String(item.id) === String(quizId));
    if (!quiz) return;

    const studentId = currentUser?.id ?? studentInfo?.id;
    const submission = (Array.isArray(quiz.submissions) ? quiz.submissions : [])
      .find((item) => String(item.studentId) === String(studentId));
    setSelectedQuiz(quiz);
    setQuizAnswers(submission?.answers || {});
    setSubmittedScore(submission ? Number(submission.score || 0) : null);
  }, [assignments, currentUser?.id, quizId, studentInfo?.id]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== toast.id)), 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const addToast = (message, type = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const myCourses = useMemo(() => {
    const list = [];
    const seen = new Set();
    enrollments.forEach((reg) => {
      if (!seen.has(reg.courseId)) {
        seen.add(reg.courseId);
        list.push(reg);
      }
    });
    return list;
  }, [enrollments]);

  const selectedCourse = useMemo(
    () => myCourses.find((course) => course.courseId === selectedCourseId),
    [myCourses, selectedCourseId]
  );

  const displayedDocs = useMemo(() => {
    if (!selectedCourseId) return [];
    return assignments.filter((doc) => doc.courseId === selectedCourseId && doc.status === 'Công khai');
  }, [assignments, selectedCourseId]);

  const filteredCourses = useMemo(() => {
    const query = courseSearch.trim().toLowerCase();
    const result = myCourses.filter((course) => {
      const matchesSearch = !query || `${course.courseId} ${course.courseName || ''} ${course.classId || ''} ${course.className || ''}`.toLowerCase().includes(query);
      const count = assignments.filter((item) => item.courseId === course.courseId && item.status === 'Công khai').length;
      const matchesFilter = courseFilter === 'all'
        || (courseFilter === 'withAssignments' && count > 0)
        || (courseFilter === 'withoutAssignments' && count === 0);
      return matchesSearch && matchesFilter;
    });
    return [...result].sort((first, second) => {
      if (courseSort === 'name') return String(first.courseName || '').localeCompare(String(second.courseName || ''), 'vi');
      if (courseSort === 'code') return String(first.courseId || '').localeCompare(String(second.courseId || ''), 'vi');
      if (courseSort === 'assignments') {
        const firstCount = assignments.filter((item) => item.courseId === first.courseId && item.status === 'Công khai').length;
        const secondCount = assignments.filter((item) => item.courseId === second.courseId && item.status === 'Công khai').length;
        return secondCount - firstCount;
      }
      return 0;
    });
  }, [assignments, courseFilter, courseSearch, courseSort, myCourses]);

  const formatDate = (date = new Date()) => {
    const d = new Date(date);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  const getFileIcon = (filename) => {
    const ext = filename?.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'pdf') return 'fa-file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'fa-file-word';
    if (['ppt', 'pptx'].includes(ext)) return 'fa-file-powerpoint';
    if (['jpg', 'png', 'jpeg'].includes(ext)) return 'fa-file-image';
    return 'fa-file-alt';
  };

  const getStudentScoreForAssignment = (doc) => {
    if (!doc || !Array.isArray(doc.submissions)) return null;
    const match = doc.submissions.find((s) => String(s.studentId) === String(currentUser?.id ?? studentInfo?.id));
    return match ? Number(match.score || 0) : null;
  };

  const getStudentSubmission = (doc) => {
    if (!doc || !Array.isArray(doc.submissions)) return null;
    return doc.submissions.find((submission) => String(submission.studentId) === String(currentUser?.id ?? studentInfo?.id));
  };

  const isOverdue = (doc) => {
    if (!doc?.dueDate) return false;
    return new Date(`${doc.dueDate}T23:59:59`) < new Date();
  };

  const getDisplayScore = (doc) => {
    const score = getStudentScoreForAssignment(doc);
    return score !== null ? score : isOverdue(doc) && doc.type === 'quiz' ? 0 : null;
  };

  const quizQuestionCount = Array.isArray(selectedQuiz?.questions) ? selectedQuiz.questions.length : 0;
  const answeredQuestionCount = selectedQuiz
    ? (Array.isArray(selectedQuiz.questions) ? selectedQuiz.questions : []).filter((question) => quizAnswers[question.id] !== undefined).length
    : 0;

  const handleDownload = (id) => {
    const doc = assignments.find((item) => item.id === id);
    if (!doc || !doc.content) {
      addToast('Không tìm thấy nội dung file', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Bắt đầu tải xuống...', 'success');
  };

  const toggleUserDropdown = (event) => {
    event.stopPropagation();
    setShowUserDropdown((prev) => !prev);
  };

  useEffect(() => {
    const closeDropdown = () => setShowUserDropdown(false);
    window.addEventListener('click', closeDropdown);
    return () => window.removeEventListener('click', closeDropdown);
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('currentUser');
    navigate('/');
  };

  const openChangePasswordModal = () => {
    setPasswordErrors({});
    setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    setShowPasswordModal(true);
    setShowUserDropdown(false);
  };

  const closeChangePasswordModal = () => {
    setPasswordErrors({});
    setShowPasswordModal(false);
  };

  const handlePasswordFieldChange = (event) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) {
      setPasswordErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const submitChangePassword = async () => {
    const { oldPassword, newPassword, confirmPassword } = passwordForm;
    const errors = {};
    if (!oldPassword) errors.oldPassword = 'Vui lòng nhập mật khẩu cũ';
    if (!newPassword) errors.newPassword = 'Vui lòng nhập mật khẩu mới';
    if (!confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    if (newPassword && newPassword.length < 6) errors.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự';
    if (newPassword && oldPassword && newPassword === oldPassword) errors.newPassword = 'Mật khẩu mới không được trùng mật khẩu cũ';
    if (newPassword && confirmPassword && newPassword !== confirmPassword) errors.confirmPassword = 'Xác nhận mật khẩu không khớp';
    if (Object.keys(errors).length) {
      setPasswordErrors(errors);
      return;
    }

    const savedPassword = studentInfo?.password || currentUser?.password || currentUser?.pass || '';
    if (oldPassword !== savedPassword) {
      setPasswordErrors({ oldPassword: 'Mật khẩu cũ không chính xác' });
      return;
    }

    setSavingPassword(true);
    try {
      const updated = await studentAPI.updateStudentPassword(currentUser.email, newPassword);
      const merged = { ...currentUser, ...updated, password: newPassword };
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
      setCurrentUser(merged);
      setStudentInfo(merged);
      addToast('Cập nhật mật khẩu thành công!', 'success');
      setShowPasswordModal(false);
    } catch (error) {
      console.error(error);
      setPasswordErrors({ oldPassword: error.message || 'Không lưu được mật khẩu lên API' });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleQuizSubmit = async () => {
    if (!selectedQuiz) return;
    const questions = Array.isArray(selectedQuiz.questions) ? selectedQuiz.questions : [];
    if (!questions.length) {
      addToast('Bài quiz này chưa có câu hỏi.', 'error');
      return;
    }

    const unanswered = questions.filter((question) => quizAnswers[question.id] === undefined);
    if (unanswered.length > 0) {
      addToast(`Vui lòng trả lời đủ ${unanswered.length} câu hỏi trước khi nộp bài.`, 'error');
      return;
    }

    const normalizeAnswer = (answer) => String(answer ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    let correctCount = 0;
    questions.forEach((question) => {
      const selectedIndex = quizAnswers[question.id];
      const selectedAnswer = question.options?.[Number(selectedIndex)];
      const isCorrectByText = question.correctAnswer
        ? normalizeAnswer(selectedAnswer) === normalizeAnswer(question.correctAnswer)
        : false;
      const isCorrectByIndex = Number(selectedIndex) === Number(question.correctIndex);
      if (isCorrectByText || (!question.correctAnswer && isCorrectByIndex)) {
        correctCount += 1;
      }
    });

    const score = Number(((correctCount / questions.length) * 10).toFixed(1));
    const newSubmission = {
      studentId: currentUser?.id ?? studentInfo?.id ?? 'unknown',
      studentName: displayName,
      score,
      submittedAt: new Date().toLocaleString('vi-VN'),
      answers: quizAnswers,
    };

    const nextAssignments = assignments.map((item) => {
      if (item.id !== selectedQuiz.id) return item;
      const currentSubmissions = Array.isArray(item.submissions) ? item.submissions : [];
      const nextSubmissions = currentSubmissions.filter((submission) => String(submission.studentId) !== String(newSubmission.studentId));
      return {
        ...item,
        submissions: [...nextSubmissions, newSubmission],
      };
    });

    try {
      await assignmentAPI.saveAllAssignments(nextAssignments);
      setAssignments(nextAssignments);
      setSubmittedScore(score);
      addToast('Nộp bài quiz thành công!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Không thể lưu bài làm của bạn.', 'error');
    }
  };

  if (!currentUser) {
    return null;
  }

  const displayName = studentInfo?.hoTen || studentInfo?.name || currentUser.hoTen || 'Sinh viên';
  const displayAvatar = studentInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-[#f3f4f9] font-poppins">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}>
            <i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
            <span className="font-bold text-sm">{toast.message}</span>
          </div>
        ))}
      </div>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64">
          <div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-graduation-cap text-white text-xl" /></div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span>
          </div>
          <div className="relative" data-user-dropdown>
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">SV. {displayName}</p>
                <p className="text-[10px] text-gray-500 font-medium">MSV: {studentInfo?.id ? `SV-${String(studentInfo.id).padStart(3, '0')}` : 'N/A'}</p>
              </div>
              <img src={displayAvatar} alt="Avatar" className="w-10 h-10 rounded-full shadow-sm object-cover" />
            </div>
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-[100]">
                <button onClick={openChangePasswordModal} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition">
                  <i className="fas fa-key mr-2" /> Đổi mật khẩu
                </button>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition">
                  <i className="fas fa-sign-out-alt mr-2" /> Đăng xuất
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100 sticky top-[73px] h-[calc(100vh-73px)]">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Học tập</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/sv-dashboard"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button type="button" className="w-full flex items-center justify-between p-3 text-indigo-600 bg-indigo-50 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book-open w-5 text-center" />
                    <span>Học phần</span>
                  </div>
                  <i className="fas fa-chevron-down text-[10px]" />
                </button>
                <div className="submenu-container open">
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/sv/documents"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        Danh sách tài liệu
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/sv/assignments"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                  </ul>
                </div>
              </li>
            </ul>
            <ul className="space-y-1 mt-1">
              <li>
                <NavLink
                  to="/sv/timetable"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-history w-5 text-center" />
                  <span>Thời khoá biểu</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/sv/course-registration"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-layer-group w-5 text-center" />
                  <span>Đăng ký học phần</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              {selectedCourseId ? (
                <>
                  {selectedQuiz ? (
                    <>
                      <button type="button" onClick={() => navigate(`/sv/assignments?courseId=${encodeURIComponent(selectedCourseId)}`, { replace: true })} className="group inline-flex items-center gap-2.5 text-sm font-bold text-gray-600 hover:text-indigo-600 transition mb-4"><span className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:bg-indigo-50 transition"><i className="fas fa-arrow-left text-xs" /></span><span>Quay lại bài tập học phần</span></button>
                      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-500">{submittedScore === null ? 'Đang làm bài quiz' : 'Kết quả bài quiz'}</p>
                      <h2 className="text-2xl font-bold text-gray-800 mt-1">{selectedQuiz.name}</h2>
                      <div className="flex flex-wrap gap-2 mt-3"><span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-lg">Mã học phần: {selectedCourseId}</span><span className="text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2.5 py-1 rounded-lg">Mã lớp học phần: {selectedCourse?.classId || 'Chưa cập nhật'}</span><span className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">{selectedCourse?.className || 'Tên lớp chưa cập nhật'}</span></div>
                    </>
                  ) : (
                    <>
                      <button type="button" onClick={() => navigate('/sv/assignments', { replace: true })} className="group inline-flex items-center gap-2.5 text-sm font-bold text-gray-600 hover:text-indigo-600 transition mb-4"><span className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:bg-indigo-50 transition"><i className="fas fa-arrow-left text-xs" /></span><span>Quay lại học phần</span></button>
                    </>
                  )}
                </>
              ) : (
                <><h2 className="text-2xl font-bold text-gray-800">Danh sách bài tập</h2><p className="text-sm text-gray-500">Chọn một học phần để xem, làm quiz và tải tài liệu.</p></>
              )}
            </div>
          </div>

          {selectedQuiz ? (
            <section className="max-w-5xl mx-auto">
              <div className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600">{submittedScore === null ? 'Bài quiz' : 'Kết quả bài làm'}</p><h3 className="text-xl font-bold text-gray-900 mt-1">{selectedQuiz.name}</h3><p className="text-sm text-gray-500 mt-1">{selectedCourseId} · {myCourses.find((course) => course.courseId === selectedCourseId)?.courseName}</p></div>
                <div className="flex items-center gap-2 text-xs font-bold text-violet-700 bg-white border border-violet-100 rounded-xl px-3 py-2"><i className="fas fa-list-ol" /> {quizQuestionCount} câu hỏi</div>
              </div>

              {submittedScore === null ? (
                <div className="bg-white border border-violet-100 rounded-2xl p-4 mb-5 shadow-sm"><div className="flex items-center justify-between text-xs font-bold mb-2"><span className="text-gray-500">Tiến độ làm bài</span><span className="text-violet-600">{answeredQuestionCount}/{quizQuestionCount} câu</span></div><div className="h-2 bg-violet-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full transition-all" style={{ width: `${quizQuestionCount ? (answeredQuestionCount / quizQuestionCount) * 100 : 0}%` }} /></div></div>
              ) : (
                <div className="mb-5 bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 grid grid-cols-1 sm:grid-cols-3 items-center gap-3"><div className="hidden sm:block" /><div className="text-center"><p className="text-[10px] uppercase tracking-[0.2em] text-violet-500 font-bold">Kết quả</p><p className="text-2xl font-extrabold text-violet-700 leading-tight">{submittedScore}/10</p></div><div className="sm:text-right text-center"><span className="inline-flex items-center gap-2 text-sm text-violet-700 font-semibold"><i className="fas fa-check-circle" /> Bài làm gần nhất của bạn</span></div></div>
              )}

              <div className="space-y-5">
                {selectedQuiz.questions?.map((question, index) => (
                  <article key={question.id} className="relative overflow-hidden border border-gray-200 rounded-3xl p-5 md:p-6 bg-white shadow-sm"><div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-violet-500 to-indigo-500" /><div className="flex items-start gap-4 mb-5"><div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center text-lg font-extrabold shadow-md shadow-violet-200">{index + 1}</div><div className="flex-1 pt-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500 mb-1">Câu hỏi {index + 1}</p><p className="text-lg font-extrabold text-gray-900 leading-7">{question.text}</p></div>{quizAnswers[question.id] !== undefined && submittedScore === null && <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full"><i className="fas fa-check" /> Đã chọn</span>}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{question.options?.map((option, optionIndex) => { const selectedIndex = quizAnswers[question.id]; const correctIndex = Number(question.correctIndex); const isSelected = Number(selectedIndex) === optionIndex; const isCorrect = question.correctAnswer ? String(option).trim().replace(/\s+/g, ' ').toLocaleLowerCase() === String(question.correctAnswer).trim().replace(/\s+/g, ' ').toLocaleLowerCase() : correctIndex === optionIndex; const optionStyles = [['border-sky-200 bg-sky-50 text-sky-900', 'border-sky-400 bg-sky-100 ring-2 ring-sky-200'], ['border-amber-200 bg-amber-50 text-amber-900', 'border-amber-400 bg-amber-100 ring-2 ring-amber-200'], ['border-rose-200 bg-rose-50 text-rose-900', 'border-rose-400 bg-rose-100 ring-2 ring-rose-200'], ['border-emerald-200 bg-emerald-50 text-emerald-900', 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-200']]; const [baseOptionClass, selectedOptionClass] = optionStyles[optionIndex % optionStyles.length]; const resultClass = submittedScore === null ? `${baseOptionClass} cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${isSelected ? selectedOptionClass : ''}` : isCorrect ? 'border-green-400 bg-green-50 text-green-900 ring-2 ring-green-200' : isSelected ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200' : 'border-gray-200 bg-white text-gray-700'; return <label key={`${question.id}-${optionIndex}`} className={`group flex items-center gap-3 p-4 min-h-[64px] rounded-2xl border-2 transition-all ${resultClass}`}><input type="radio" name={question.id} checked={Number(quizAnswers[question.id]) === optionIndex} onChange={() => setQuizAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))} disabled={submittedScore !== null} className="w-5 h-5 text-violet-600 focus:ring-violet-500" /><span className="w-7 h-7 rounded-lg bg-white/80 border border-current/10 flex items-center justify-center text-xs font-extrabold opacity-70">{String.fromCharCode(65 + optionIndex)}</span><span className="font-semibold leading-6">{option}</span>{submittedScore !== null && isCorrect && <span className="ml-auto text-xs font-bold text-green-600">Đáp án đúng</span>}{submittedScore !== null && isSelected && !isCorrect && <span className="ml-auto text-xs font-bold text-red-600">Bạn đã chọn</span>}</label>; })}</div>
                  </article>
                ))}
              </div>
              <div className="sticky bottom-0 mt-6 py-4 bg-[#f3f4f9]/95 backdrop-blur border-t border-gray-200 flex justify-between items-center gap-3"><span className="hidden sm:block text-sm text-gray-500">{submittedScore === null ? `${answeredQuestionCount} / ${quizQuestionCount} câu đã trả lời` : 'Đã hoàn thành bài quiz'}</span><div className="ml-auto flex gap-3"><button type="button" onClick={() => navigate(`/sv/assignments?courseId=${encodeURIComponent(selectedCourseId)}`, { replace: true })} className="px-5 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold">Quay lại bài tập</button>{submittedScore === null && <button type="button" onClick={handleQuizSubmit} className="inline-flex items-center gap-2 px-5 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition font-bold shadow-lg shadow-violet-100"><i className="fas fa-paper-plane" /> Nộp bài</button>}</div></div>
            </section>
          ) : <>
          {!selectedCourseId && (
            <section className="mb-7">
              <div className="flex flex-col lg:flex-row gap-2 mb-3">
                <div className="relative w-full lg:w-[min(100%,420px)]"><i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" /><input value={courseSearch} onChange={(event) => setCourseSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên học phần" className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5"><i className="fas fa-sort-amount-down text-xs text-indigo-500" /><select value={courseSort} onChange={(event) => setCourseSort(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"><option value="default">Mặc định</option><option value="name">Tên học phần</option><option value="code">Mã học phần</option><option value="assignments">Số bài tập</option></select></label>
                <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5"><i className="fas fa-filter text-xs text-indigo-500" /><select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"><option value="all">Tất cả học phần</option><option value="withAssignments">Có bài tập</option><option value="withoutAssignments">Chưa có bài tập</option></select></label>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><span className="text-sm font-bold text-gray-700">Học phần đã đăng ký</span><span className="text-xs font-semibold text-gray-400">{myCourses.length} học phần</span></div><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-4 w-16">STT</th><th className="px-5 py-4">Mã học phần</th><th className="px-5 py-4">Tên học phần</th><th className="px-5 py-4">Mã lớp học phần</th><th className="px-5 py-4">Tên lớp học phần</th><th className="px-5 py-4 text-center">Bài tập</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead><tbody className="divide-y divide-gray-50 text-sm">{filteredCourses.map((course, index) => { const count = assignments.filter((item) => item.courseId === course.courseId && item.status === 'Công khai').length; return <tr key={course.courseId} onClick={() => navigate(`/sv/assignments?courseId=${encodeURIComponent(course.courseId)}`)} className="cursor-pointer hover:bg-indigo-50/40 transition-colors"><td className="px-5 py-4 text-gray-400">{index + 1}</td><td className="px-5 py-4"><span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{course.courseId}</span></td><td className="px-5 py-4 font-bold text-gray-800">{course.courseName || 'Tên học phần chưa rõ'}</td><td className="px-5 py-4 font-mono text-xs font-bold text-gray-500">{course.classId || 'Chưa cập nhật'}</td><td className="px-5 py-4"><span className="inline-flex max-w-[260px] truncate bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg text-xs font-semibold" title={course.className || ''}>{course.className || 'Chưa cập nhật'}</span></td><td className="px-5 py-4 text-center font-bold text-gray-700">{count}<span className="text-xs text-gray-400 ml-1">bài</span></td><td className="px-5 py-4 text-right"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"><i className="fas fa-arrow-right" /> Xem bài tập</span></td></tr>; })}{!filteredCourses.length && <tr><td colSpan="7" className="px-5 py-12 text-center text-gray-400">Không tìm thấy học phần phù hợp.</td></tr>}</tbody></table></div></div>
            </section>
          )}

          {selectedCourseId && !selectedQuiz && <>
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Tổng bài</p>
              <h3 className="text-3xl font-bold mt-3">{displayedDocs.length}</h3>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Quiz</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-3">{displayedDocs.filter((item) => item.type === 'quiz').length}</h3>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Điểm gần nhất</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-3">
                {displayedDocs.filter((item) => item.type === 'quiz').map((doc) => getStudentScoreForAssignment(doc)).filter((score) => score !== null).at(-1) ?? '—'}
              </h3>
            </div>
          </div>

          <section className="relative overflow-hidden mb-4 bg-gradient-to-r from-indigo-50 via-white to-white border border-indigo-100 rounded-2xl px-5 py-4 md:px-6 md:py-5">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-600 to-violet-500" />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Danh sách bài tập</p>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{selectedCourse?.courseName || 'Học phần'}</h2>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <div className="bg-white border border-indigo-100 rounded-xl px-3 py-2 min-w-[130px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Mã học phần</p><p className="text-xs font-extrabold text-indigo-700 mt-0.5">{selectedCourseId}</p></div>
                <div className="bg-white border border-violet-100 rounded-xl px-3 py-2 min-w-[150px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Mã lớp học phần</p><p className="text-xs font-extrabold text-violet-700 mt-0.5">{selectedCourse?.classId || 'Chưa cập nhật'}</p></div>
                <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 min-w-[170px] max-w-[280px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Tên lớp học phần</p><p className="text-xs font-bold text-gray-700 mt-0.5 truncate" title={selectedCourse?.className || ''}>{selectedCourse?.className || 'Chưa cập nhật'}</p></div>
              </div>
            </div>
          </section>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tên bài tập</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Loại</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Ngày tạo</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Hạn nộp</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Điểm</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {!selectedCourseId ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic">
                        Vui lòng chọn học phần để xem bài tập
                      </td>
                    </tr>
                  ) : displayedDocs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center text-gray-400 italic">
                        Chưa có bài tập nào được giao cho học phần này.
                      </td>
                    </tr>
                  ) : (
                    displayedDocs.map((doc) => {
                      const studentScore = getStudentScoreForAssignment(doc);
                      const displayScore = getDisplayScore(doc);
                      const overdue = isOverdue(doc);
                      return (
                        <tr key={doc.id} className="hover:bg-gray-50 transition relative">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.type === 'quiz' ? 'bg-violet-50 text-violet-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <i className={`fas ${doc.type === 'quiz' ? 'fa-question-circle' : getFileIcon(doc.name)} text-lg`} />
                              </div>
                              <div>
                                <span className="font-bold text-gray-800 block">{doc.name}</span>
                                {doc.type === 'quiz' && (
                                  <span className="text-[10px] text-violet-600 uppercase font-bold tracking-wider italic">{doc.questions?.length || 0} câu hỏi</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`${doc.type === 'quiz' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>
                              {doc.type === 'quiz' ? 'Làm trực tiếp' : 'File đính kèm'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-500">{doc.created || formatDate(doc.createdAt || doc.updatedAt || new Date())}</td>
                          <td className={`px-6 py-4 text-center font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>{doc.type === 'quiz' ? (doc.dueDate ? formatDate(doc.dueDate) : 'Không giới hạn') : '—'}</td>
                          <td className={`px-6 py-4 text-center font-bold ${overdue && studentScore === null ? 'text-red-600' : 'text-gray-600'}`}>{displayScore !== null ? `${displayScore}/10` : '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`${overdue ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>{overdue ? 'Đã hết hạn' : doc.status}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {doc.type === 'quiz' ? (
                              <button
                                onClick={() => {
                                  if (overdue && studentScore === null) return;
                                  setSubmittedScore(studentScore !== null ? studentScore : null);
                                  navigate(`/sv/assignments?courseId=${encodeURIComponent(selectedCourseId)}&quizId=${encodeURIComponent(doc.id)}`);
                                }}
                                disabled={overdue && studentScore === null}
                                className={`px-3 py-1.5 text-white text-[10px] rounded-lg shadow-md font-bold ${overdue && studentScore === null ? 'bg-gray-400 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700'}`}
                              >
                                {studentScore !== null ? 'Xem kết quả' : overdue ? 'Đã hết hạn' : 'Làm bài trực tiếp'}
                              </button>
                            ) : (
                              <button onClick={() => handleDownload(doc.id)} className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] rounded-lg shadow-md font-bold hover:bg-indigo-700">
                                Tải bài tập
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>}
          </>}
        </main>
      </div>

      {false && selectedQuiz && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="px-7 pt-6 pb-5 border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-10">
              <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-500">Bài quiz</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{selectedQuiz.name}</h3>
                <p className="text-sm text-gray-500 mt-1">Chọn một đáp án cho mỗi câu hỏi</p>
              </div>
              <button onClick={() => { setSelectedQuiz(null); setQuizAnswers({}); setSubmittedScore(null); }} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl" />
              </button>
            </div>

            {submittedScore === null && (
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs font-bold mb-2"><span className="text-gray-500">Tiến độ làm bài</span><span className="text-violet-600">{answeredQuestionCount}/{quizQuestionCount} câu</span></div>
                <div className="h-2 bg-violet-100 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-violet-500 to-indigo-600 rounded-full transition-all" style={{ width: `${quizQuestionCount ? (answeredQuestionCount / quizQuestionCount) * 100 : 0}%` }} /></div>
              </div>
            )}
            </div>

            {submittedScore !== null && (
              <div className="mb-6 bg-violet-50 border border-violet-200 rounded-2xl px-5 py-4 grid grid-cols-1 sm:grid-cols-3 items-center gap-3">
                <div className="hidden sm:block" />
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-violet-500 font-bold">Kết quả</p>
                  <p className="text-2xl font-extrabold text-violet-700 leading-tight">{submittedScore}/10</p>
                </div>
                <div className="sm:text-right text-center">
                  <span className="inline-flex items-center gap-2 text-sm text-violet-700 font-semibold"><i className="fas fa-check-circle" /> Bài làm gần nhất của bạn</span>
                </div>
              </div>
            )}

            <div className="px-7 py-6 space-y-6 bg-slate-50/50">
              {selectedQuiz.questions?.map((question, index) => (
                <div key={question.id} className="relative overflow-hidden border border-gray-200 rounded-3xl p-5 md:p-6 bg-white shadow-sm">
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-violet-500 to-indigo-500" />
                  <div className="flex items-start gap-4 mb-5">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center text-lg font-extrabold shadow-md shadow-violet-200">{index + 1}</div>
                    <div className="flex-1 pt-1"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500 mb-1">Câu hỏi {index + 1}</p><p className="text-lg font-extrabold text-gray-900 leading-7">{question.text}</p></div>
                    {quizAnswers[question.id] !== undefined && submittedScore === null && <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-full"><i className="fas fa-check" /> Đã chọn</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {question.options?.map((option, optionIndex) => {
                      const selectedIndex = quizAnswers[question.id];
                      const correctIndex = Number(question.correctIndex);
                      const isSelected = Number(selectedIndex) === optionIndex;
                      const isCorrect = question.correctAnswer
                        ? String(option).trim().replace(/\s+/g, ' ').toLocaleLowerCase() === String(question.correctAnswer).trim().replace(/\s+/g, ' ').toLocaleLowerCase()
                        : correctIndex === optionIndex;
                      const optionStyles = [
                        ['border-sky-200 bg-sky-50 text-sky-900', 'border-sky-400 bg-sky-100 ring-2 ring-sky-200'],
                        ['border-amber-200 bg-amber-50 text-amber-900', 'border-amber-400 bg-amber-100 ring-2 ring-amber-200'],
                        ['border-rose-200 bg-rose-50 text-rose-900', 'border-rose-400 bg-rose-100 ring-2 ring-rose-200'],
                        ['border-emerald-200 bg-emerald-50 text-emerald-900', 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-200'],
                      ];
                      const [baseOptionClass, selectedOptionClass] = optionStyles[optionIndex % optionStyles.length];
                      const resultClass = submittedScore === null
                        ? `${baseOptionClass} cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${isSelected ? selectedOptionClass : ''}`
                        : isCorrect
                          ? 'border-green-400 bg-green-50 text-green-900 ring-2 ring-green-200'
                          : isSelected
                            ? 'border-red-400 bg-red-50 text-red-900 ring-2 ring-red-200'
                            : 'border-gray-200 bg-white text-gray-700';

                      return (
                      <label key={`${question.id}-${optionIndex}`} className={`group flex items-center gap-3 p-4 min-h-[64px] rounded-2xl border-2 transition-all ${resultClass}`}>
                        <input
                          type="radio"
                          name={question.id}
                          checked={Number(quizAnswers[question.id]) === optionIndex}
                          onChange={() => setQuizAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))}
                          disabled={submittedScore !== null}
                          className="w-5 h-5 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="w-7 h-7 rounded-lg bg-white/80 border border-current/10 flex items-center justify-center text-xs font-extrabold opacity-70">{String.fromCharCode(65 + optionIndex)}</span>
                        <span className="font-semibold leading-6">{option}</span>
                        {submittedScore !== null && isCorrect && <span className="ml-auto text-xs font-bold text-green-600">Đáp án đúng</span>}
                        {submittedScore !== null && isSelected && !isCorrect && <span className="ml-auto text-xs font-bold text-red-600">Bạn đã chọn</span>}
                      </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="px-7 pb-7 flex justify-end gap-3">
              <button onClick={() => { setSelectedQuiz(null); setQuizAnswers({}); setSubmittedScore(null); }} className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition font-medium">
                Hủy
              </button>
              {submittedScore === null && (
                <button onClick={handleQuizSubmit} className="px-5 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition font-bold shadow-lg shadow-violet-100">
                  Nộp bài
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button onClick={closeChangePasswordModal} className="text-white hover:text-gray-200">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <input
                  name="oldPassword"
                  type="password"
                  value={passwordForm.oldPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.oldPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Nhập mật khẩu cũ"
                />
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input
                  name="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Tối thiểu 6 ký tự"
                />
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordFieldChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-200'}`}
                  placeholder="Nhập lại mật khẩu mới"
                />
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                  Hủy
                </button>
                <button onClick={submitChangePassword} disabled={savingPassword} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                  {savingPassword ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 p-8 text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-user-lock text-red-500 text-3xl animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <p className="text-red-600 font-semibold text-sm mb-4">Tài khoản của bạn đã bị tạm khóa.</p>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">Vui lòng liên hệ Phòng đào tạo để được hỗ trợ mở khóa tài khoản.</p>
            <button onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
              QUAY LẠI ĐĂNG NHẬP
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentAssignmentList;
