import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import studentAPI from '../services/studentAPI';
import documentAPI from '../services/documentAPI';
import { fetchOpenRegistrations, fetchStudentRegistrations } from '../utils/registrationUtils';
import { useStudentLockMonitor } from '../hooks/useStudentLockMonitor';

const StudentDocumentList = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [studentInfo, setStudentInfo] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [toasts, setToasts] = useState([]);
  const [activeActionMenu, setActiveActionMenu] = useState(null);
  const { showLockModal, lockReason, handleLogoutToLogin } = useStudentLockMonitor(currentUser);

  useEffect(() => {
    const saved = sessionStorage.getItem('currentUser');
    if (saved) {
      try { setCurrentUser(JSON.parse(saved)); } catch { setCurrentUser(null); }
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!currentUser?.email) return;
      try {
        const [students, regs, allDocs, openRegs] = await Promise.all([
          studentAPI.getAllStudents({ fresh: true }),
          fetchStudentRegistrations({ fresh: true }),
          documentAPI.getAllDocuments({ fresh: true }),
          fetchOpenRegistrations({ fresh: true }),
        ]);
        const matched = students.find(s => s.email?.trim().toLowerCase() === currentUser.email?.trim().toLowerCase());
        const student = matched || currentUser;
        setStudentInfo(student);
        setCurrentUser((prev)=>{ const merged = { ...prev, ...student }; sessionStorage.setItem('currentUser', JSON.stringify(merged)); return merged; });

        const myRegs = regs.filter(r => String(r.studentId) === String(student.id || student.studentId));
        const enrichedRegs = myRegs.map((reg) => {
          const match = openRegs.find((o) => o.id === reg.regId || o.courseId === reg.courseId);
          return {
            ...match,
            ...reg,
            courseName: match?.courseName || reg?.courseName || '',
          };
        });
        setRegistrations(enrichedRegs);
        setDocuments(allDocs || []);
      } catch (error) { console.error('Lỗi tải dữ liệu tài liệu sinh viên', error); }
    };
    load();
  }, [currentUser]);

  useEffect(() => { if (!toasts.length) return; const timers = toasts.map(t=> setTimeout(()=> setToasts(prev=> prev.filter(x=> x.id !== t.id)), 3000)); return ()=> timers.forEach(clearTimeout); }, [toasts]);
  const addToast = (message, type='success') => setToasts(prev => [...prev, { id: Date.now().toString(), message, type }]);

  const publicDocs = useMemo(()=> documents.filter(d => d.status === 'Công khai'), [documents]);
  const displayedDocs = useMemo(()=> selectedCourseId ? publicDocs.filter(d => d.courseId === selectedCourseId) : [], [publicDocs, selectedCourseId]);

  const formatDate = (date = new Date()) => { const d = new Date(date); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`; };
  const getFileIcon = (filename) => { const ext = filename?.split('.').pop()?.toLowerCase() ?? ''; if (ext === 'pdf') return 'fa-file-pdf'; if (['doc','docx'].includes(ext)) return 'fa-file-word'; if (['ppt','pptx'].includes(ext)) return 'fa-file-powerpoint'; if (['jpg','png','jpeg'].includes(ext)) return 'fa-file-image'; return 'fa-file-alt'; };

  const handleDownload = (id) => { const doc = documents.find(d => d.id === id); if (!doc || !doc.content) return addToast('Không tìm thấy nội dung file', 'error'); const link = document.createElement('a'); link.href = doc.content; link.download = doc.name; document.body.appendChild(link); link.click(); document.body.removeChild(link); addToast('Tải xuống tài liệu...', 'success'); };

  if (!currentUser) return null;

  const name = studentInfo?.hoTen || studentInfo?.name || currentUser.hoTen || 'Sinh viên';
  const avatar = studentInfo?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=10b981&color=fff`;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 font-poppins">
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">{toasts.map(t => (<div key={t.id} className={`${t.type==='success'?'bg-green-500':'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3`}><i className={`fas ${t.type==='success'?'fa-check-circle':'fa-exclamation-circle'} text-xl`} /><span className="font-bold text-sm">{t.message}</span></div>))}</div>

      <header className="w-full bg-white shadow-sm z-50 flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0">
        <div className="flex items-center gap-3 w-64"><div className="bg-indigo-600 p-2 rounded-lg"><i className="fas fa-user-graduate text-white text-xl" /></div><span className="text-2xl font-bold text-indigo-900 uppercase">EDUMIN</span></div>
        <div className="flex items-center gap-6">
          <div className="relative"><i className="far fa-bell text-gray-600 text-xl" /><span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full h-4 w-4 flex items-center justify-center">3</span></div>
          <div className="relative">
            <div className="flex items-center gap-3 border-l pl-6 border-gray-300 cursor-pointer">
              <div className="text-right hidden sm:block"><p className="text-sm font-bold text-gray-800">SV. {name}</p><p className="text-xs text-gray-500">Đã đăng nhập</p></div>
              <img src={avatar} alt="Avatar" className="w-10 h-10 rounded-full shadow-sm object-cover" />
            </div>
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
                  to="/sv-dashboard"
                  className={({ isActive }) => `flex items-center gap-3 p-3 rounded-lg transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}
                >
                  <i className="fas fa-th-large w-5 text-center" />
                  <span>Dashboard</span>
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
            <div><h2 className="text-2xl font-bold text-gray-800">Tài liệu học phần</h2><p className="text-sm text-gray-500">Xem và tải xuống tài liệu công khai cho các học phần bạn đã đăng ký.</p></div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select value={selectedCourseId} onChange={(e)=>setSelectedCourseId(e.target.value)} className="flex-1 md:w-72 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-gray-700 shadow-sm transition-all">
                <option value="">-- Chọn học phần --</option>
                {registrations.map((r) => (
                  <option key={r.courseId} value={r.courseId}>
                    {r.courseId} - {r.courseName || 'Tên học phần chưa rõ'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="overflow-visible"><table className="w-full text-left"><thead className="bg-gray-50 border-b border-gray-100"><tr>
            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Tên tài liệu</th>
            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Ngày tạo</th>
            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Người cập nhật</th>
            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-center">Kích thước</th>
            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-wider text-right">Thao tác</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {!selectedCourseId ? (<tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">Vui lòng chọn học phần để xem tài liệu.</td></tr>) : displayedDocs.length===0 ? (<tr><td colSpan="5" className="px-6 py-12 text-center text-gray-400 italic">Không có tài liệu công khai cho học phần này.</td></tr>) : displayedDocs.map(doc => (
              <tr key={doc.id} className="hover:bg-gray-50 transition relative">
                <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><i className={`fas ${getFileIcon(doc.name)} text-lg`} /></div><div><p className="font-bold text-gray-800">{doc.name}</p><p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider italic">Mã HP: {doc.courseId}</p></div></div></td>
                <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.created || formatDate(doc.createdAt || doc.updatedAt || new Date())}</td>
                <td className="px-6 py-4 text-center text-gray-500 font-medium">{doc.modifiedBy || 'Không rõ'}</td>
                <td className="px-6 py-4 text-center text-gray-600 font-bold">{doc.size || '—'}</td>
                <td className="px-6 py-4 text-right relative">
                  <div className="flex items-center justify-end gap-3"><button onClick={()=>handleDownload(doc.id)} className="px-3 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition"><i className="fas fa-download mr-2" />Tải xuống</button></div>
                </td>
              </tr>
            ))}
          </tbody></table></div></div>
        </main>
      </div>

      {showLockModal && (<div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4"><div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full mx-4 p-8 text-center border-4 border-red-100"><div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6"><i className="fas fa-user-lock text-red-500 text-3xl animate-pulse" /></div><h2 className="text-2xl font-bold text-gray-800 mb-2">Tài khoản bị khóa!</h2><div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-8"><p className="text-red-600 text-xs font-bold uppercase mb-1">Lý do từ phòng đào tạo:</p><p className="text-red-600 font-semibold text-sm">{lockReason||'Không có lý do cụ thể.'}</p></div><div className="space-y-3"><button onClick={handleLogoutToLogin} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95">QUAY LẠI ĐĂNG NHẬP</button><p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">Vui lòng liên hệ hỗ trợ để mở khóa</p></div></div></div>)}
    </div>
  );
};

export default StudentDocumentList;
