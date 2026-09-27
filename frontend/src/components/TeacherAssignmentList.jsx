import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate, useSearchParams } from 'react-router-dom';
import teacherAPI from '../services/teacherAPI';
import studentAPI from '../services/studentAPI';
import assignmentAPI from '../services/assignmentAPI';
import courseAPI from '../services/courseAPI';
import { fetchOpenRegistrations } from '../utils/registrationUtils';
import { useTeacherLockMonitor } from '../hooks/useTeacherLockMonitor';
import { formatStudentId } from '../utils/studentUtils';

const defaultQuizForm = () => ({
  title: '',
  dueDate: '',
  questions: [{ id: `q${Date.now()}`, text: '', options: ['', '', '', ''], correctIndex: 0 }],
});

const TeacherAssignmentList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [students, setStudents] = useState([]);
  const [openClasses, setOpenClasses] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(() => searchParams.get('courseId') || '');
  const [classSearch, setClassSearch] = useState('');
  const [classSort, setClassSort] = useState('default');
  const [classFilter, setClassFilter] = useState('all');
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  // Thêm state lưu vị trí hiển thị menu dạng fixed
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [quizForm, setQuizForm] = useState(defaultQuizForm());
  const [quizErrors, setQuizErrors] = useState({});
  const isCreatingQuiz = searchParams.get('mode') === 'create-quiz';
  const [selectedResultAssignment, setSelectedResultAssignment] = useState(null);
  const { showLockModal, lockReason, handleLogoutToLogin } = useTeacherLockMonitor(currentUser);

  useEffect(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try {
        setCurrentUser(JSON.parse(saved));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.email) return;
      try {
        const [teachers, allStudents, openRegs, allAssignments, courses] = await Promise.all([
          teacherAPI.getAllTeachers({ fresh: true }),
          studentAPI.getAllStudents({ fresh: true }),
          fetchOpenRegistrations({ fresh: true }),
          assignmentAPI.getAllAssignments({ fresh: true }),
          courseAPI.getAllCourses({ fresh: true }),
        ]);

        const matchedTeacher = teachers.find((t) => t.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase());
        const teacher = matchedTeacher || currentUser;
        setTeacherInfo(teacher);
        setCurrentUser((prev) => {
          const merged = { ...prev, ...teacher };
          sessionStorage.setItem('currentUser', JSON.stringify(merged));
          return merged;
        });

        const teacherId = String(teacher.id ?? teacher.teacherId ?? '');
        const classes = openRegs
          .filter((reg) => String(reg.teacherId) === teacherId)
          .reduce((acc, reg) => {
            if (!acc.some((item) => item.courseId === reg.courseId)) {
              const course = courses.find((item) => item.id === reg.courseId);
              acc.push({
                ...reg,
                classId: reg.classId || course?.classId || '',
                className: reg.className || course?.className || '',
              });
            }
            return acc;
          }, []);
        setOpenClasses(classes);
        setStudents(allStudents || []);
        setAssignments(allAssignments || []);
      } catch (error) {
        console.error('Không tải được dữ liệu bài tập giáo viên:', error);
      }
    };
    loadData();
  }, [currentUser?.email]);

  useEffect(() => {
    const courseId = searchParams.get('courseId');
    setSelectedCourseId(courseId || '');
  }, [searchParams]);

  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) =>
      setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, 3000)
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  useEffect(() => {
    const handleClick = (event) => {
      if (!event.target.closest('[data-action-button]')) {
        setActiveActionMenu(null);
      }
      if (!event.target.closest('[data-user-dropdown]')) {
        setShowUserDropdown(false);
      }
    };

    // Thêm sự kiện scroll để ẩn menu tránh tình trạng lệch vị trí khi cuộn trang
    const handleScroll = () => {
      setActiveActionMenu(null);
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, []);

  const addToast = (message, type = 'success') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const displayedDocs = useMemo(() => {
    if (!selectedCourseId) return [];
    return assignments.filter((doc) => doc.courseId === selectedCourseId);
  }, [assignments, selectedCourseId]);

  const selectedClass = useMemo(
    () => openClasses.find((course) => course.courseId === selectedCourseId),
    [openClasses, selectedCourseId]
  );

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    const result = openClasses.filter((course) => {
      const matchesSearch = !query || `${course.courseId} ${course.courseName || ''} ${course.classId || ''} ${course.className || ''}`.toLowerCase().includes(query);
      const assignmentCount = assignments.filter((item) => item.courseId === course.courseId).length;
      const matchesFilter = classFilter === 'all'
        || (classFilter === 'withAssignments' && assignmentCount > 0)
        || (classFilter === 'withoutAssignments' && assignmentCount === 0);
      return matchesSearch && matchesFilter;
    });

    return [...result].sort((first, second) => {
      if (classSort === 'name') return String(first.courseName || '').localeCompare(String(second.courseName || ''), 'vi');
      if (classSort === 'code') return String(first.courseId || '').localeCompare(String(second.courseId || ''), 'vi');
      if (classSort === 'assignments') {
        const firstCount = assignments.filter((item) => item.courseId === first.courseId).length;
        const secondCount = assignments.filter((item) => item.courseId === second.courseId).length;
        return secondCount - firstCount;
      }
      return 0;
    });
  }, [assignments, classFilter, classSearch, classSort, openClasses]);

  const getStudentForSubmission = (submission) => students.find((student) => String(student.id) === String(submission.studentId));

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

  const openFileDialog = () => {
    if (!selectedCourseId) {
      addToast('Vui lòng chọn học phần trước khi tải lên!', 'error');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleCreateQuiz = async () => {
    const validTitle = quizForm.title.trim();
    const validQuestions = quizForm.questions.filter((item) => item.text.trim() && item.options.every((option) => option.trim()));
    if (!validTitle || validQuestions.length === 0) {
      setQuizErrors({ general: 'Nhập tên bài tập và ít nhất một câu hỏi có đủ bốn phương án.' });
      return;
    }

    const normalizedQuestions = validQuestions.map((item) => ({
      id: item.id,
      text: item.text.trim(),
      options: item.options.map((option) => option.trim()),
      correctIndex: Number(item.correctIndex) || 0,
      correctAnswer: item.options[Number(item.correctIndex) || 0]?.trim() || '',
    }));
    const newQuiz = {
      id: `QUIZ${Date.now()}`,
      courseId: selectedCourseId,
      type: 'quiz',
      name: validTitle,
      title: validTitle,
      dueDate: quizForm.dueDate,
      created: formatDate(),
      modifiedBy: teacherInfo?.name || currentUser?.hoTen || 'Giảng viên',
      status: 'Công khai',
      questions: normalizedQuestions,
      submissions: [],
    };

    setSavingQuiz(true);
    try {
      const next = [...assignments, newQuiz];
      await assignmentAPI.saveAllAssignments(next);
      setAssignments(next);
      setQuizForm(defaultQuizForm());
      setQuizErrors({});
      addToast('Đã giao bài tập trắc nghiệm thành công!', 'success');
      navigate(`/gv/assignments?courseId=${encodeURIComponent(selectedCourseId)}`, { replace: true });
    } catch (error) {
      console.error(error);
      setQuizErrors({ general: 'Không lưu được bài tập. Vui lòng thử lại.' });
    } finally {
      setSavingQuiz(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedCourseId) {
      addToast('Vui lòng chọn học phần trước khi tải lên!', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const name = file.name;
        const size = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        const newDoc = {
          id: `LSN${Date.now()}`,
          courseId: selectedCourseId,
          name,
          created: formatDate(),
          modifiedBy: teacherInfo?.name || currentUser?.hoTen || 'Giảng viên',
          size,
          status: 'Công khai',
          content,
        };
        const next = [...assignments, newDoc];
        await assignmentAPI.saveAllAssignments(next);
        setAssignments(next);
        addToast('Tải bài tập lên thành công!', 'success');
      } catch (error) {
        console.error(error);
        addToast('Không thể tải lên bài tập.', 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = (id) => {
    const doc = assignments.find((item) => item.id === id);
    if (!doc || !doc.content) {
      addToast('Không tìm thấy nội dung file.', 'error');
      return;
    }
    const link = document.createElement('a');
    link.href = doc.content;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast('Đang tải xuống bài tập...', 'success');
  };

  const handleRename = (id) => {
    const doc = assignments.find((item) => item.id === id);
    if (!doc) return;
    setRenameName(doc.name);
    setDeleteId(null);
    setActiveActionMenu(null);
    setShowRenameModal(true);
    setRenameError('');
    setDeleteId(id);
  };

  const confirmRename = async () => {
    const trimmed = renameName.trim();
    if (!trimmed) {
      setRenameError('Tên không được để trống');
      return;
    }
    const next = assignments.map((item) =>
      item.id === deleteId ? { ...item, name: trimmed } : item
    );
    try {
      await assignmentAPI.saveAllAssignments(next);
      setAssignments(next);
      setShowRenameModal(false);
      addToast('Đã cập nhật tên bài tập!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Không lưu được tên mới.', 'error');
    }
  };

  const handleDelete = (id) => {
    setActiveActionMenu(null);
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const next = assignments.filter((item) => item.id !== deleteId);
    try {
      await assignmentAPI.saveAllAssignments(next);
      setAssignments(next);
      setShowDeleteModal(false);
      addToast('Đã xóa bài tập!', 'success');
    } catch (error) {
      console.error(error);
      addToast('Không thể xóa bài tập.', 'error');
    }
  };

  const toggleUserDropdown = (event) => {
    event.stopPropagation();
    setShowUserDropdown((prev) => !prev);
  };

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

    const savedPassword = teacherInfo?.password || currentUser?.password || currentUser?.pass || '';
    if (oldPassword !== savedPassword) {
      setPasswordErrors({ oldPassword: 'Mật khẩu cũ không chính xác' });
      return;
    }

    setSavingPassword(true);
    try {
      const updated = await teacherAPI.updateTeacherPassword(currentUser.email, newPassword);
      const merged = { ...currentUser, ...updated, password: newPassword };
      sessionStorage.setItem('currentUser', JSON.stringify(merged));
      setCurrentUser(merged);
      setTeacherInfo(merged);
      setShowPasswordModal(false);
      addToast('Cập nhật mật khẩu thành công!', 'success');
    } catch (error) {
      console.error(error);
      setPasswordErrors({ oldPassword: error.message || 'Không lưu được mật khẩu lên API' });
    } finally {
      setSavingPassword(false);
    }
  };

  if (!currentUser) {
    return null;
  }

  const displayName = teacherInfo?.name || currentUser.hoTen || currentUser.name || 'Giáo viên';
  const displayAvatar = teacherInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-poppins">
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
          <div className="bg-indigo-600 p-2 rounded-lg">
            <i className="fas fa-graduation-cap text-white text-xl" />
          </div>
          <span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative">
            <i className="far fa-bell text-gray-600 text-xl" />
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">5</span>
          </div>
          <div className="relative" data-user-dropdown>
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer" onClick={toggleUserDropdown}>
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-gray-800">GV. {displayName}</p>
                <p className="text-xs text-gray-500">Đã đăng nhập</p>
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
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <NavLink
                  to="/gv-dashboard"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-th-large w-5 text-center" /> <span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button type="button" className="w-full flex items-center justify-between p-3 text-indigo-600 bg-indigo-50 rounded-lg transition-all">
                  <div className="flex items-center gap-3">
                    <i className="fas fa-book w-5 text-center" />
                    <span>Bài tập & Tài liệu</span>
                  </div>
                  <i className="fas fa-chevron-down text-[10px]" />
                </button>
                <div className="submenu-container open">
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li>
                      <NavLink
                        to="/gv/assignments"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
                      >
                        Danh sách bài tập
                      </NavLink>
                    </li>
                    <li>
                      <NavLink
                        to="/gv/documents"
                        className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
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
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-chart-pie w-5 text-center" />
                  <span>Danh sách lớp dạy</span>
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/gv/schedule"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-history w-5 text-center" />
                  <span>Thời khoá biểu</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
            <div>
              {selectedCourseId ? (
                <>
                  <button type="button" onClick={() => navigate(isCreatingQuiz ? `/gv/assignments?courseId=${encodeURIComponent(selectedCourseId)}` : '/gv/assignments', { replace: true })} className="group inline-flex items-center gap-2.5 text-sm font-bold text-gray-600 hover:text-indigo-600 transition">
                    <span className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:bg-indigo-50 transition">
                      <i className="fas fa-arrow-left text-xs" />
                    </span>
                    <span>{isCreatingQuiz ? 'Quay lại bài tập lớp' : 'Quay lại danh sách lớp học phần'}</span>
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-gray-800">Quản lý Bài tập</h2>
                  <p className="text-sm text-gray-500">Chọn một lớp để xem, giao và quản lý bài tập.</p>
                </>
              )}
            </div>
            {selectedCourseId && !isCreatingQuiz && (
              <div className="flex items-center gap-3 w-full md:w-auto">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <button
                  onClick={() => {
                    setQuizForm(defaultQuizForm());
                    setQuizErrors({});
                    navigate(`/gv/assignments?courseId=${encodeURIComponent(selectedCourseId)}&mode=create-quiz`);
                  }}
                  className="bg-violet-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-violet-700 transition shadow-lg shadow-violet-100 flex items-center gap-2 whitespace-nowrap"
                >
                  <i className="fas fa-question-circle" /> TẠO QUIZ
                </button>
                <button onClick={openFileDialog} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2 whitespace-nowrap">
                  <i className="fas fa-upload" /> TẢI LÊN
                </button>
              </div>
            )}
          </div>

          {isCreatingQuiz ? (
            <section className="max-w-5xl">
              <div className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-600">Tạo bài tập trắc nghiệm</p><h3 className="text-xl font-bold text-gray-900 mt-1">Soạn quiz cho lớp</h3><p className="text-sm text-gray-600 mt-1">{selectedClass?.courseName || selectedCourseId}</p><div className="flex flex-wrap gap-2 mt-3"><span className="text-[11px] font-bold text-indigo-700 bg-white border border-indigo-100 px-2.5 py-1 rounded-lg">HP: {selectedClass?.courseId || selectedCourseId}</span><span className="text-[11px] font-bold text-violet-700 bg-white border border-violet-100 px-2.5 py-1 rounded-lg">Lớp: {selectedClass?.classId || 'Chưa cập nhật'}</span><span className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 px-2.5 py-1 rounded-lg">{selectedClass?.className || 'Tên lớp chưa cập nhật'}</span></div></div>
                <div className="flex items-center gap-2 text-xs font-semibold text-violet-700 bg-white border border-violet-100 rounded-xl px-3 py-2"><i className="fas fa-list-ol" /> {quizForm.questions.length} câu hỏi</div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 md:p-7 mb-5">
                <div className="grid md:grid-cols-[1fr_240px] gap-5">
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">Tên bài tập <span className="text-red-500">*</span></label><input value={quizForm.title} onChange={(event) => setQuizForm((prev) => ({ ...prev, title: event.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" placeholder="Ví dụ: Kiểm tra chương 1" /></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">Hạn nộp</label><input type="date" value={quizForm.dueDate} onChange={(event) => setQuizForm((prev) => ({ ...prev, dueDate: event.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none" /></div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mb-4"><div><h4 className="text-lg font-bold text-gray-900">Câu hỏi</h4><p className="text-sm text-gray-500 mt-1">Chọn đáp án đúng bằng nút tròn bên cạnh phương án.</p></div><button type="button" onClick={() => setQuizForm((prev) => ({ ...prev, questions: [...prev.questions, { id: `q${Date.now()}-${prev.questions.length + 1}`, text: '', options: ['', '', '', ''], correctIndex: 0 }] }))} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 shadow-sm"><i className="fas fa-plus" /> Thêm câu</button></div>

              <div className="space-y-4">
                {quizForm.questions.map((question, index) => (
                  <article key={question.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/70"><div className="flex items-center gap-3"><span className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-extrabold">{index + 1}</span><span className="font-bold text-gray-800">Câu hỏi {index + 1}</span></div>{quizForm.questions.length > 1 && <button type="button" onClick={() => setQuizForm((prev) => ({ ...prev, questions: prev.questions.filter((item) => item.id !== question.id) }))} className="w-9 h-9 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50" aria-label={`Xóa câu ${index + 1}`}><i className="fas fa-trash-alt" /></button>}</div>
                    <div className="p-5"><label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Nội dung câu hỏi</label><textarea rows="2" value={question.text} onChange={(event) => setQuizForm((prev) => ({ ...prev, questions: prev.questions.map((item) => item.id === question.id ? { ...item, text: event.target.value } : item) }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-violet-500 outline-none resize-y" placeholder="Nhập nội dung câu hỏi" />
                      <div className="grid sm:grid-cols-2 gap-3 mt-4">{question.options.map((option, optionIndex) => <label key={`${question.id}-option-${optionIndex}`} className={`flex items-center gap-3 border rounded-xl p-3 transition ${question.correctIndex === optionIndex ? 'border-emerald-300 bg-emerald-50/70' : 'border-gray-200 bg-white hover:border-violet-200'}`}><input type="radio" name={`correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => setQuizForm((prev) => ({ ...prev, questions: prev.questions.map((item) => item.id === question.id ? { ...item, correctIndex: optionIndex } : item) }))} className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" aria-label={`Đặt phương án ${optionIndex + 1} làm đáp án đúng`} /><span className="w-7 h-7 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-extrabold">{String.fromCharCode(65 + optionIndex)}</span><input value={option} onChange={(event) => setQuizForm((prev) => ({ ...prev, questions: prev.questions.map((item) => item.id === question.id ? { ...item, options: item.options.map((current, currentIndex) => currentIndex === optionIndex ? event.target.value : current) } : item) }))} className="min-w-0 flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder:text-gray-400" placeholder={`Phương án ${optionIndex + 1}`} /></label>)}</div>
                    </div>
                  </article>
                ))}
              </div>
              {quizErrors.general && <p className="mt-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm font-medium text-red-600"><i className="fas fa-exclamation-circle mr-2" />{quizErrors.general}</p>}
              <div className="sticky bottom-0 mt-6 -mx-4 md:-mx-8 px-4 md:px-8 py-4 bg-white/95 backdrop-blur border-t border-gray-200 flex justify-end gap-3"><button type="button" onClick={() => navigate(`/gv/assignments?courseId=${encodeURIComponent(selectedCourseId)}`, { replace: true })} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200">Hủy</button><button type="button" onClick={handleCreateQuiz} disabled={savingQuiz} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 shadow-md disabled:opacity-60"><i className={`fas ${savingQuiz ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />{savingQuiz ? 'Đang giao...' : 'Giao bài tập'}</button></div>
            </section>
          ) : <>
          {!selectedCourseId && (
            <section className="mb-7">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 mb-3">
                <div className="relative w-full lg:w-[min(100%,420px)]">
                  <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" />
                  <input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên học phần" className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="relative flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600">
                    <i className="fas fa-sort-amount-down text-xs text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-400">Sắp xếp</span>
                    <select value={classSort} onChange={(event) => setClassSort(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer">
                      <option value="default">Mặc định</option>
                      <option value="name">Tên học phần</option>
                      <option value="code">Mã học phần</option>
                      <option value="assignments">Số bài tập</option>
                    </select>
                  </label>
                  <label className="relative flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-600">
                    <i className="fas fa-filter text-xs text-indigo-500" />
                    <span className="text-xs font-semibold text-gray-400">Lọc</span>
                    <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer">
                      <option value="all">Tất cả lớp</option>
                      <option value="withAssignments">Có bài tập</option>
                      <option value="withoutAssignments">Chưa có bài tập</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left">
                    <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-4 w-16">STT</th><th className="px-5 py-4">Mã học phần</th><th className="px-5 py-4">Tên học phần</th><th className="px-5 py-4">Mã lớp học phần</th><th className="px-5 py-4">Tên lớp học phần</th><th className="px-5 py-4 text-center">Bài tập</th><th className="px-5 py-4 text-right">Thao tác</th></tr></thead>
                    <tbody className="divide-y divide-gray-50 text-sm">
                      {filteredClasses.map((course, index) => {
                        const count = assignments.filter((item) => item.courseId === course.courseId).length;
                        return <tr key={course.courseId} onClick={() => navigate(`/gv/assignments?courseId=${encodeURIComponent(course.courseId)}`)} className="cursor-pointer hover:bg-indigo-50/40 transition-colors"><td className="px-5 py-4 text-gray-400">{index + 1}</td><td className="px-5 py-4"><span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{course.courseId}</span></td><td className="px-5 py-4 font-bold text-gray-800">{course.courseName || 'Tên học phần chưa rõ'}</td><td className="px-5 py-4 font-mono text-xs font-bold text-gray-500">{course.classId || 'Chưa cập nhật'}</td><td className="px-5 py-4"><span className="inline-flex max-w-[240px] truncate bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg text-xs font-semibold">{course.className || 'Chưa cập nhật'}</span></td><td className="px-5 py-4 text-center"><span className="font-bold text-gray-700">{count}</span><span className="text-xs text-gray-400 ml-1">bài</span></td><td className="px-5 py-4 text-right"><span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold"><i className="fas fa-arrow-right" /> Xem bài tập</span></td></tr>;
                      })}
                      {!filteredClasses.length && <tr><td colSpan="7" className="px-5 py-12 text-center text-gray-400">Không tìm thấy lớp học phần phù hợp.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          {selectedCourseId && <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl p-5 text-white shadow-lg shadow-indigo-200">
              <p className="text-xs uppercase tracking-[0.2em] text-indigo-100">Tổng bài tập</p>
              <h3 className="text-3xl font-bold mt-3">{displayedDocs.length}</h3>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Đã công khai</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-3">{displayedDocs.filter((item) => item.status === 'Công khai').length}</h3>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Quiz</p>
              <h3 className="text-3xl font-bold text-gray-800 mt-3">{displayedDocs.filter((item) => item.type === 'quiz').length}</h3>
            </div>
          </div>

          <section className="relative overflow-hidden mb-4 bg-gradient-to-r from-indigo-50 via-white to-white border border-indigo-100 rounded-2xl px-5 py-4 md:px-6 md:py-5">
            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-600 to-violet-500" />
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-500">Danh sách bài tập</p>
                <h3 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{selectedClass?.courseName || 'Chưa chọn học phần'}</h3>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <div className="bg-white border border-indigo-100 rounded-xl px-3 py-2 min-w-[130px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Mã học phần</p><p className="text-xs font-extrabold text-indigo-700 mt-0.5">{selectedClass?.courseId || selectedCourseId}</p></div>
                <div className="bg-white border border-violet-100 rounded-xl px-3 py-2 min-w-[130px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Mã lớp học phần</p><p className="text-xs font-extrabold text-violet-700 mt-0.5">{selectedClass?.classId || 'Chưa cập nhật'}</p></div>
                <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 min-w-[170px] max-w-[280px]"><p className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Tên lớp học phần</p><p className="text-xs font-bold text-gray-700 mt-0.5 truncate" title={selectedClass?.className || ''}>{selectedClass?.className || 'Chưa cập nhật'}</p></div>
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
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {!selectedCourseId ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
                        Vui lòng chọn học phần để xem danh sách bài tập
                      </td>
                    </tr>
                  ) : displayedDocs.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">
                        Chưa có bài tập nào cho học phần này.
                      </td>
                    </tr>
                  ) : (
                    displayedDocs.map((doc) => (
                        <tr key={doc.id} className="hover:bg-gray-50 transition relative">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${doc.type === 'quiz' ? 'bg-violet-50 text-violet-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                <i className={`fas ${doc.type === 'quiz' ? 'fa-question-circle' : getFileIcon(doc.name)} text-lg`} />
                              </div>
                              <div>
                                <p className="font-bold text-gray-800">{doc.name}</p>
                                {doc.type === 'quiz' && (
                                  <p className="text-[10px] text-violet-600 uppercase font-bold tracking-wider italic">{doc.questions?.length || 0} câu hỏi</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`${doc.type === 'quiz' ? 'bg-violet-100 text-violet-700' : 'bg-indigo-100 text-indigo-700'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>
                              {doc.type === 'quiz' ? 'Quiz trực tiếp' : 'File đính kèm'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.created || formatDate(doc.createdAt || doc.updatedAt || new Date())}</td>
                          <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.type === 'quiz' ? (doc.dueDate ? formatDate(doc.dueDate) : 'Không giới hạn') : '—'}</td>
                          <td className="px-6 py-4 text-center">
                            <span className={`${doc.status === 'Công khai' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>
                              {doc.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              data-action-button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (activeActionMenu === doc.id) {
                                  setActiveActionMenu(null);
                                } else {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setMenuPosition({
                                    top: rect.bottom + window.scrollY,
                                    right: window.innerWidth - rect.right - window.scrollX,
                                  });
                                  setActiveActionMenu(doc.id);
                                }
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-400"
                            >
                              <i className="fas fa-ellipsis-v" />
                            </button>
                            {activeActionMenu === doc.id && (
                              <div
                                className="text-left py-2 fixed bg-white border border-gray-200 rounded-2xl shadow-xl min-w-[220px] z-[9999]"
                                style={{
                                  top: `${menuPosition.top - window.scrollY}px`,
                                  right: `${menuPosition.right + window.scrollX}px`,
                                }}
                              >
                                {doc.type === 'quiz' ? (
                                  <button onClick={() => { setSelectedResultAssignment(doc); setActiveActionMenu(null); }} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-600 flex items-center gap-2">
                                    <i className="fas fa-chart-bar w-4" /> Xem kết quả
                                  </button>
                                ) : (
                                  <button onClick={() => handleDownload(doc.id)} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                    <i className="fas fa-download w-4" /> Tải xuống
                                  </button>
                                )}
                                <button onClick={() => handleRename(doc.id)} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2">
                                  <i className="fas fa-edit w-4" /> Đổi tên
                                </button>
                                <div className="border-t border-gray-100 my-1" />
                                <button onClick={() => handleDelete(doc.id)} className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <i className="fas fa-trash-alt w-4" /> Xóa bài tập
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </>}
          </>}
        </main>
      </div>

      {selectedResultAssignment && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[88vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-500">Kết quả bài làm</p>
                <h3 className="text-2xl font-bold text-gray-800">{selectedResultAssignment.name || selectedResultAssignment.title}</h3>
              </div>
              <button onClick={() => setSelectedResultAssignment(null)} className="text-gray-400 hover:text-gray-600">
                <i className="fas fa-times text-xl" />
              </button>
            </div>
            {(selectedResultAssignment.submissions?.length || 0) === 0 ? (
              <div className="text-center py-10 text-gray-400">Chưa có sinh viên nào nộp bài.</div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">STT</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Mã SV</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Tên sinh viên</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Khoa</th>
                      <th className="px-4 py-3 text-left text-xs text-gray-500">Hệ đào tạo</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500">Thời gian nộp</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">Điểm</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...(selectedResultAssignment.submissions || [])]
                      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0) || String(a.studentName || '').localeCompare(String(b.studentName || ''), 'vi'))
                      .map((submission, index) => {
                        const student = getStudentForSubmission(submission);
                        return (
                          <tr key={`${submission.studentId}-${index}`} className="hover:bg-violet-50/40">
                            <td className="px-4 py-3 text-gray-500">{index + 1}</td>
                            <td className="px-4 py-3 font-semibold text-gray-700">{formatStudentId(student?.id ?? submission.studentId)}</td>
                            <td className="px-4 py-3 font-bold text-gray-800">{student?.name || submission.studentName || 'Sinh viên'}</td>
                            <td className="px-4 py-3 text-gray-600">{student?.department || 'Chưa cập nhật'}</td>
                            <td className="px-4 py-3 text-gray-600">{student?.education || 'Chưa cập nhật'}</td>
                            <td className="px-4 py-3 text-center text-xs text-gray-500">{submission.submittedAt || 'Không rõ'}</td>
                            <td className="px-4 py-3 text-right text-lg font-bold text-violet-600">{Number(submission.score || 0).toFixed(1)}<span className="text-xs text-gray-400"> / 10</span></td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold flex items-center gap-2"><i className="fas fa-edit" /> Đổi tên bài tập</h3>
              <button onClick={() => setShowRenameModal(false)} className="text-white hover:text-gray-200">
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên bài tập mới</label>
                <input
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm"
                  placeholder="Nhập tên mới"
                />
                {renameError && <p className="text-red-500 text-xs mt-2">{renameError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRenameModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">
                  Hủy
                </button>
                <button type="button" onClick={confirmRename} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md shadow-indigo-100">
                  Cập nhật
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm mx-4 overflow-hidden p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-trash-alt text-red-500 text-3xl" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Xác nhận xóa?</h3>
            <p className="text-sm text-gray-500 mb-8">Hành động này không thể hoàn tác. Bạn có chắc muốn xóa bài tập này?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition font-bold">
                HỦY
              </button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition font-bold shadow-lg shadow-red-100">
                XÓA NGAY
              </button>
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
              <i className="fas fa-user-lock text-red-500 text-3xl animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
              <p className="text-red-600 text-xs font-bold uppercase mb-1">Lý do từ phòng đào tạo:</p>
              <p className="text-red-600 font-semibold text-sm">{lockReason || 'Không có lý do cụ thể.'}</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">
                QUAY LẠI ĐĂNG NHẬP
              </button>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Vui lòng liên hệ hỗ trợ để mở khóa</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherAssignmentList;