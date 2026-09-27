import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import teacherAPI from '../services/teacherAPI';
import documentAPI from '../services/documentAPI';
import { fetchOpenRegistrations } from '../utils/registrationUtils';
import { useTeacherLockMonitor } from '../hooks/useTeacherLockMonitor';

const TeacherDocumentList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [openClasses, setOpenClasses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  
  // State điều khiển menu và dropdown đồng bộ cấu trúc fixed
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState({ top: 0, right: 0 });
  
  // State Modals nghiệp vụ
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [toasts, setToasts] = useState([]);
  
  // State Đổi mật khẩu
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  
  const { showLockModal, lockReason, handleLogoutToLogin } = useTeacherLockMonitor(currentUser);

  // Khởi tạo user ban đầu
  useEffect(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); } catch { setCurrentUser(null); }
    }
  }, []);

  // Tải dữ liệu giảng viên, lớp học và tài liệu
  useEffect(() => {
    const loadData = async () => {
      if (!currentUser?.email) return;
      try {
        const [teachers, openRegs, allDocs] = await Promise.all([
          teacherAPI.getAllTeachers({ fresh: true }),
          fetchOpenRegistrations({ fresh: true }),
          documentAPI.getAllDocuments({ fresh: true }),
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
          .reduce((acc, reg) => { if (!acc.some((item) => item.courseId === reg.courseId)) acc.push(reg); return acc; }, []);
        setOpenClasses(classes);
        setDocuments(allDocs || []);
      } catch (error) {
        console.error('Không tải được dữ liệu tài liệu giáo viên:', error);
      }
    };
    loadData();
  }, [currentUser?.email]);

  // Xử lý đóng menu khi nhấn ra ngoài hoặc cuộn trang (Đồng bộ chuẩn fixed)
  useEffect(() => {
    const handleClick = (event) => {
      if (!event.target.closest('[data-action-button]')) {
        setActiveActionMenu(null);
      }
      if (!event.target.closest('[data-user-dropdown]')) {
        setShowUserDropdown(false);
      }
    };
    
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

  // Điều khiển hiển thị Toast thông báo
  useEffect(() => {
    if (!toasts.length) return;
    const timers = toasts.map((toast) => setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== toast.id)), 3000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  const addToast = (message, type = 'success') => setToasts((prev) => [...prev, { id: Date.now().toString(), message, type }]);

  // Lọc tài liệu theo học phần được chọn
  const displayedDocs = useMemo(() => {
    if (!selectedCourseId) return [];
    return documents.filter((d) => d.courseId === selectedCourseId);
  }, [documents, selectedCourseId]);

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
    if (!selectedCourseId) { addToast('Vui lòng chọn học phần trước khi tải lên!', 'error'); return; }
    fileInputRef.current?.click();
  };

  // Tải lên tài liệu mới (ĐÃ SỬA LẠI: Đồng bộ lấy dữ liệu mới nhất từ API để tránh lỗi đẩy đè)
  const handleFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!selectedCourseId) { addToast('Vui lòng chọn học phần trước khi tải lên!', 'error'); return; }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const name = file.name;
        const size = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
        
        const newDoc = { 
          id: `DOC${Date.now()}`, 
          courseId: selectedCourseId, 
          name, 
          created: formatDate(), 
          modifiedBy: teacherInfo?.name || currentUser?.hoTen || 'Giảng viên', 
          size, 
          status: 'Công khai', 
          content 
        };
        
        // Lấy danh sách tươi mới nhất từ API trước khi đẩy lên tương tự như Assignment
        const currentDocs = await documentAPI.getAllDocuments({ fresh: true }) || [];
        const next = [...currentDocs, newDoc];
        
        await documentAPI.saveAllDocuments(next);
        setDocuments(next);
        addToast('Tải tài liệu lên thành công!', 'success');
      } catch (error) { 
        console.error("Lỗi đẩy tài liệu lên API:", error); 
        addToast('Không thể tải lên tài liệu.', 'error'); 
      } finally { 
        if (fileInputRef.current) fileInputRef.current.value = ''; 
      }
    };
    reader.readAsDataURL(file);
  };

  // Tải file xuống máy
  const handleDownload = (id) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc || !doc.content) { addToast('Không tìm thấy nội dung file.', 'error'); return; }
    const link = document.createElement('a'); link.href = doc.content; link.download = doc.name; document.body.appendChild(link); link.click(); document.body.removeChild(link);
    addToast('Đang tải xuống tài liệu...', 'success');
  };

  // Đổi tên tài liệu
  const handleRename = (id) => { 
    const doc = documents.find((d) => d.id === id); 
    if (!doc) return; 
    setRenameName(doc.name); 
    setDeleteId(null); 
    setActiveActionMenu(null); 
    setShowRenameModal(true); 
    setRenameError('');
    setDeleteId(id); 
  };

  // ĐÃ SỬA LẠI: Đồng bộ lấy dữ liệu tươi từ API trước khi chỉnh sửa
  const confirmRename = async () => { 
    const trimmed = renameName.trim(); 
    if (!trimmed) {
      setRenameError('Tên không được để trống');
      return;
    }
    try { 
      const currentDocs = await documentAPI.getAllDocuments({ fresh: true }) || [];
      const next = currentDocs.map((d) => d.id === deleteId ? { ...d, name: trimmed } : d); 
      
      await documentAPI.saveAllDocuments(next); 
      setDocuments(next); 
      setShowRenameModal(false); 
      addToast('Đã cập nhật tên tài liệu!', 'success'); 
    } catch (e) { 
      console.error(e); 
      addToast('Không lưu được tên mới.', 'error'); 
    } 
  };

  // Xóa tài liệu
  const handleDelete = (id) => { setActiveActionMenu(null); setDeleteId(id); setShowDeleteModal(true); };
  
  // ĐÃ SỬA LẠI: Đồng bộ lấy dữ liệu tươi từ API trước khi xóa
  const confirmDelete = async () => { 
    try { 
      const currentDocs = await documentAPI.getAllDocuments({ fresh: true }) || [];
      const next = currentDocs.filter((d) => d.id !== deleteId); 
      
      await documentAPI.saveAllDocuments(next); 
      setDocuments(next); 
      setShowDeleteModal(false); 
      addToast('Đã xóa tài liệu!', 'success'); 
    } catch (e) { 
      console.error(e); 
      addToast('Không thể xóa tài liệu.', 'error'); 
    } 
  };

  // Điều khiển dropdown góc phải trên header
  const toggleUserDropdown = (e) => { e.stopPropagation(); setShowUserDropdown(!showUserDropdown); };
  const handleLogout = () => { sessionStorage.removeItem('currentUser'); navigate('/'); };

  // Xử lý cập nhật đổi mật khẩu
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

  const handlePasswordFieldChange = (e) => {
    const { name, value } = e.target;
    setPasswordForm(prev => ({ ...prev, [name]: value }));
    if (passwordErrors[name]) setPasswordErrors(prev => ({ ...prev, [name]: '' }));
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
    
    if (Object.keys(errors).length > 0) {
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

  if (!currentUser) return null;

  const displayName = teacherInfo?.name || currentUser.hoTen || currentUser.name || 'Giáo viên';
  const displayAvatar = teacherInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=6366f1&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-poppins">
      {/* Toast notifications */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">
        {toasts.map(t => (
          <div key={t.id} className={`${t.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300`}>
            <i className={`fas ${t.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} />
            <span className="font-bold text-sm">{t.message}</span>
          </div>
        ))}
      </div>

      {/* Header */}
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
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg hidden md:block overflow-y-auto border-r border-gray-100">
          <nav className="mt-8 px-4">
            <p className="text-xs font-semibold text-gray-400 uppercase px-2 mb-2">Main Menu</p>
            <ul className="space-y-1">
              <li>
                <NavLink to="/gv-dashboard" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-th-large w-5 text-center" /><span>Dashboard</span>
                </NavLink>
              </li>
              <li>
                <button type="button" className="w-full flex items-center justify-between p-3 text-indigo-600 bg-indigo-50 rounded-lg transition-all">
                  <div className="flex items-center gap-3"><i className="fas fa-book w-5 text-center" /><span>Bài tập & Tài liệu</span></div>
                  <i className="fas fa-chevron-down text-[10px]" />
                </button>
                <div className="submenu-container open">
                  <ul className="pl-2 mt-1 space-y-1 border-l-2 border-indigo-100 ml-6">
                    <li><NavLink to="/gv/assignments" className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}>Danh sách bài tập</NavLink></li>
                    <li><NavLink to="/gv/documents" className={({ isActive }) => `block p-2 text-sm rounded-lg transition ${isActive ? 'text-indigo-600 font-bold' : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'}`}>Danh sách tài liệu</NavLink></li>
                  </ul>
                </div>
              </li>
              <li>
                <NavLink to="/gv/classes" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-chart-pie w-5 text-center" /><span>Danh sách lớp dạy</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/gv/schedule" className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
                  <i className="fas fa-history w-5 text-center" /><span>Thời khoá biểu</span>
                </NavLink>
              </li>
            </ul>
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div><h2 className="text-2xl font-bold text-gray-800">Quản lý Tài liệu</h2><p className="text-sm text-gray-500">Xem danh sách tài liệu của các học phần bạn phụ trách.</p></div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} className="flex-1 md:w-72 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700 shadow-sm transition-all">
                <option value="">-- Chọn học phần --</option>
                {openClasses.map(c => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.courseId} - {c.courseName || 'Tên học phần chưa rõ'}
                  </option>
                ))}
              </select>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
              <button onClick={openFileDialog} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 flex items-center gap-2 whitespace-nowrap"><i className="fas fa-upload" /> TẢI LÊN</button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-visible">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tên tài liệu</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Ngày tạo</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Người cập nhật</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Kích thước</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Trạng thái</th>
                    <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {!selectedCourseId ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">Vui lòng chọn học phần để xem danh sách tài liệu</td></tr>
                  ) : displayedDocs.length === 0 ? (
                    <tr><td colSpan="6" className="px-6 py-12 text-center text-gray-400 italic">Chưa có tài liệu nào cho học phần này.</td></tr>
                  ) : displayedDocs.map(doc => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition relative">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><i className={`fas ${getFileIcon(doc.name)} text-lg`} /></div>
                          <div>
                            <p className="font-bold text-gray-800">{doc.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider italic">Mã HP: {doc.courseId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.created || formatDate(doc.createdAt || doc.updatedAt || new Date())}</td>
                      <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.modifiedBy || 'Không rõ'}</td>
                      <td className="px-6 py-4 text-center text-gray-600 font-bold">{doc.size || '—'}</td>
                      <td className="px-6 py-4 text-center"><span className={`${doc.status === 'Công khai' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'} px-3 py-1 rounded-full text-[10px] font-bold uppercase`}>{doc.status}</span></td>
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
                                right: window.innerWidth - rect.right - window.scrollX
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
                            className="text-left py-2 fixed bg-white border border-gray-200 rounded-2xl shadow-xl min-w-[180px] z-[9999]"
                            style={{ 
                              top: `${menuPosition.top - window.scrollY}px`, 
                              right: `${menuPosition.right + window.scrollX}px` 
                            }}
                          >
                            <button onClick={() => handleDownload(doc.id)} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"><i className="fas fa-download w-4" /> Tải xuống</button>
                            <button onClick={() => handleRename(doc.id)} className="w-full px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2"><i className="fas fa-edit w-4" /> Đổi tên</button>
                            <div className="border-t border-gray-100 my-1" />
                            <button onClick={() => handleDelete(doc.id)} className="w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"><i className="fas fa-trash-alt w-4" /> Xóa tài liệu</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Modal Đổi tên */}
      {showRenameModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center"><h3 className="font-bold flex items-center gap-2"><i className="fas fa-edit" /> Đổi tên tài liệu</h3><button onClick={() => setShowRenameModal(false)} className="text-white hover:text-gray-200"><i className="fas fa-times" /></button></div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên tài liệu mới</label>
                <input value={renameName} onChange={(e) => setRenameName(e.target.value)} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition shadow-sm" placeholder="Nhập tên mới" />
                {renameError && <p className="text-red-500 text-xs mt-2">{renameError}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowRenameModal(false)} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button type="button" onClick={confirmRename} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium shadow-md shadow-indigo-100">Cập nhật</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xóa */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm mx-4 overflow-hidden p-8 text-center">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><i className="fas fa-trash-alt text-red-500 text-3xl" /></div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Xác nhận xóa?</h3>
            <p className="text-sm text-gray-500 mb-8">Hành động này không thể hoàn tác. Bạn có chắc muốn xóa tài liệu này?</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-2xl hover:bg-gray-200 transition font-bold">HỦY</button>
              <button onClick={confirmDelete} className="flex-1 px-4 py-3 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition font-bold shadow-lg shadow-red-100">XÓA NGAY</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Đổi Mật Khẩu */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-[400] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold">Đổi mật khẩu</h3>
              <button onClick={closeChangePasswordModal} className="text-white hover:text-gray-200"><i className="fas fa-times" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu cũ</label>
                <input name="oldPassword" type="password" value={passwordForm.oldPassword} onChange={handlePasswordFieldChange} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.oldPassword ? 'border-red-500' : 'border-gray-200'}`} placeholder="Nhập mật khẩu cũ" />
                {passwordErrors.oldPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.oldPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu mới</label>
                <input name="newPassword" type="password" value={passwordForm.newPassword} onChange={handlePasswordFieldChange} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.newPassword ? 'border-red-500' : 'border-gray-200'}`} placeholder="Tối thiểu 6 ký tự" />
                {passwordErrors.newPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.newPassword}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Xác nhận mật khẩu</label>
                <input name="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={handlePasswordFieldChange} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition ${passwordErrors.confirmPassword ? 'border-red-500' : 'border-gray-200'}`} placeholder="Nhập lại mật khẩu mới" />
                {passwordErrors.confirmPassword && <p className="text-red-500 text-xs mt-1">{passwordErrors.confirmPassword}</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={closeChangePasswordModal} className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium">Hủy</button>
                <button onClick={submitChangePassword} disabled={savingPassword} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium">
                  {savingPassword ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Khóa Tài Khoản */}
      {showLockModal && (
        <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 p-8 text-center border-4 border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><i className="fas fa-user-lock text-red-500 text-3xl animate-pulse" /></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8">
              <p className="text-red-600 text-xs font-bold uppercase mb-1">Lý do từ phòng đào tạo:</p>
              <p className="text-red-600 font-semibold text-sm">{lockReason || 'Không có lý do cụ thể.'}</p>
            </div>
            <div className="space-y-3">
              <button onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">QUAY LẠI ĐĂNG NHẬP</button>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Vui lòng liên hệ hỗ trợ để mở khóa</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherDocumentList;