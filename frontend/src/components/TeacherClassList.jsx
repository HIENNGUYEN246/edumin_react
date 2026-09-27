import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import GVLayout from '../layouts/GVLayout';
import teacherAPI from '../services/teacherAPI';
import studentAPI from '../services/studentAPI';
import {
  fetchOpenRegistrations,
  fetchStudentRegistrations,
  OPEN_REGISTRATIONS_UPDATED_EVENT,
  STUDENT_REGISTRATIONS_UPDATED_EVENT,
} from '../utils/registrationUtils';

export default function TeacherClassList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [openRegs, setOpenRegs] = useState([]);
  const [studentRegs, setStudentRegs] = useState([]);
  const [students, setStudents] = useState([]);
  const [myTeacherId, setMyTeacherId] = useState(null);
  const [selectedRegId, setSelectedRegId] = useState(() => searchParams.get('regId') || '');
  const [classSearch, setClassSearch] = useState('');
  const [classSort, setClassSort] = useState('default');
  const [classFilter, setClassFilter] = useState('all');
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const user = JSON.parse(sessionStorage.getItem('currentUser')) || {};
        const teachers = await teacherAPI.getAllTeachers({ fresh: true });
        const teacher = teachers.find((t) => t.email?.toLowerCase() === user.email?.toLowerCase());
        setMyTeacherId(teacher?.id ?? null);
        const [regs, enrollments, studs] = await Promise.all([
          fetchOpenRegistrations({ fresh: true }),
          fetchStudentRegistrations({ fresh: true }),
          studentAPI.getAllStudents({ fresh: true }),
        ]);
        setOpenRegs(regs);
        setStudentRegs(enrollments);
        setStudents(studs);
      } catch (error) {
        console.error(error);
        showToast('Không tải được dữ liệu từ API');
      }
    };
    load();
    const onOpenUpdate = () => fetchOpenRegistrations({ fresh: true }).then(setOpenRegs).catch(() => {});
    const onStudentUpdate = () => fetchStudentRegistrations({ fresh: true }).then(setStudentRegs).catch(() => {});
    window.addEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onOpenUpdate);
    window.addEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, onStudentUpdate);
    return () => {
      window.removeEventListener(OPEN_REGISTRATIONS_UPDATED_EVENT, onOpenUpdate);
      window.removeEventListener(STUDENT_REGISTRATIONS_UPDATED_EVENT, onStudentUpdate);
    };
  }, []);

  const myClasses = useMemo(() => (
    myTeacherId == null ? [] : openRegs.filter((item) => String(item.teacherId) === String(myTeacherId))
  ), [openRegs, myTeacherId]);

  const enrolledList = useMemo(() => {
    if (!selectedRegId) return [];
    return studentRegs
      .filter((item) => String(item.regId) === String(selectedRegId))
      .map((item) => ({ enrollment: item, student: students.find((student) => String(student.id) === String(item.studentId)) }))
      .filter((item) => item.student);
  }, [selectedRegId, studentRegs, students]);

  const filteredClasses = useMemo(() => {
    const query = classSearch.trim().toLowerCase();
    const result = myClasses.filter((item) => {
      const matchesSearch = !query || `${item.courseId} ${item.courseName || ''}`.toLowerCase().includes(query);
      const studentCount = studentRegs.filter((enrollment) => String(enrollment.regId) === String(item.id)).length;
      const matchesFilter = classFilter === 'all'
        || (classFilter === 'withStudents' && studentCount > 0)
        || (classFilter === 'withoutStudents' && studentCount === 0);
      return matchesSearch && matchesFilter;
    });

    return [...result].sort((first, second) => {
      if (classSort === 'name') return String(first.courseName || '').localeCompare(String(second.courseName || ''), 'vi');
      if (classSort === 'code') return String(first.courseId || '').localeCompare(String(second.courseId || ''), 'vi');
      if (classSort === 'students') {
        const firstCount = studentRegs.filter((item) => String(item.regId) === String(first.id)).length;
        const secondCount = studentRegs.filter((item) => String(item.regId) === String(second.id)).length;
        return secondCount - firstCount;
      }
      return 0;
    });
  }, [classFilter, classSearch, classSort, myClasses, studentRegs]);

  useEffect(() => {
    setSelectedRegId(searchParams.get('regId') || '');
  }, [searchParams]);

  const getStudentCount = (registrationId) => studentRegs.filter((item) => String(item.regId) === String(registrationId)).length;

  function showToast(message, type = 'error') {
    setToasts((previous) => [...previous, { id: Date.now().toString(), message, type }]);
  }

  useEffect(() => {
    if (!toasts.length) return undefined;
    const timers = toasts.map((toast) => setTimeout(() => setToasts((previous) => previous.filter((item) => item.id !== toast.id)), 3000));
    return () => timers.forEach(clearTimeout);
  }, [toasts]);

  return (
    <GVLayout>
      <div className="p-4 md:p-6">
        {!selectedRegId ? (
          <div className="mb-6">
            <div className="mb-5">
              <div><h2 className="text-2xl font-bold text-gray-800">Quản lý lớp học</h2><p className="text-sm text-gray-500 mt-1">Chọn một lớp để xem danh sách sinh viên đăng ký.</p></div>
              <div className="flex flex-col sm:flex-row gap-2 w-full mt-4">
                <div className="relative w-full sm:w-[360px]"><i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400" /><input value={classSearch} onChange={(event) => setClassSearch(event.target.value)} placeholder="Tìm theo mã hoặc tên học phần" className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5"><i className="fas fa-sort-amount-down text-xs text-indigo-500" /><select value={classSort} onChange={(event) => setClassSort(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"><option value="default">Mặc định</option><option value="name">Tên học phần</option><option value="code">Mã học phần</option><option value="students">Số sinh viên</option></select></label>
                <label className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5"><i className="fas fa-filter text-xs text-indigo-500" /><select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="bg-transparent text-sm font-semibold text-gray-700 outline-none cursor-pointer"><option value="all">Tất cả lớp</option><option value="withStudents">Có sinh viên</option><option value="withoutStudents">Chưa có sinh viên</option></select></label>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">Danh sách lớp phụ trách</span>
              <span className="text-xs font-semibold text-gray-400">{myClasses.length} lớp</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-400"><tr><th className="px-5 py-4 w-16">STT</th><th className="px-5 py-4">Mã học phần</th><th className="px-5 py-4">Tên học phần</th><th className="px-5 py-4 text-center">Sinh viên</th><th className="px-5 py-4 text-right">Trạng thái</th></tr></thead>
                <tbody className="divide-y divide-gray-50 text-sm">
                  {filteredClasses.map((item, index) => {
                    return <tr key={item.id} onClick={() => navigate(`/gv/classes?regId=${encodeURIComponent(item.id)}`)} className="cursor-pointer transition-colors hover:bg-indigo-50/40"><td className="px-5 py-4 text-gray-400">{index + 1}</td><td className="px-5 py-4"><span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">{item.courseId}</span></td><td className="px-5 py-4 font-bold text-gray-800">{item.courseName || 'Tên học phần chưa rõ'}</td><td className="px-5 py-4 text-center font-bold text-gray-700">{getStudentCount(item.id)}<span className="text-xs text-gray-400 ml-1">SV</span></td><td className="px-5 py-4 text-right"><span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-500 text-xs font-bold"><i className="fas fa-arrow-right text-[10px]" /> Xem sinh viên</span></td></tr>;
                  })}
                  {!filteredClasses.length && <tr><td colSpan="5" className="px-5 py-12 text-center text-gray-400">Không tìm thấy lớp học phần phù hợp.</td></tr>}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <button type="button" onClick={() => navigate('/gv/classes', { replace: true })} className="group inline-flex items-center gap-2.5 text-sm font-bold text-gray-600 hover:text-indigo-600 transition mb-5"><span className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center shadow-sm group-hover:border-indigo-200 group-hover:bg-indigo-50 transition"><i className="fas fa-arrow-left text-xs" /></span><span>Quay lại danh sách lớp</span></button>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"><div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between"><div><p className="text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-bold">Danh sách sinh viên</p><h2 className="text-xl font-bold text-gray-800 mt-1">{myClasses.find((item) => String(item.id) === String(selectedRegId))?.courseName || 'Lớp học phần'}</h2></div><div className="bg-indigo-50 text-indigo-700 px-3 py-2 rounded-lg text-sm font-bold">{enrolledList.length} sinh viên</div></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left custom-table"><thead><tr><th className="p-4 text-center w-16">STT</th><th className="p-4">Mã sinh viên</th><th className="p-4">Họ và tên</th><th className="p-4">Giới tính</th><th className="p-4">Email</th><th className="p-4">Khoa</th><th className="p-4">Ngày sinh</th><th className="p-4 text-right">Trạng thái</th></tr></thead><tbody className="divide-y divide-gray-50 text-sm text-gray-600">{enrolledList.map((item, index) => { const student = item.student; return <tr key={student.id} className="hover:bg-gray-50 transition border-b border-gray-50"><td className="p-4 text-center font-medium text-gray-400">{index + 1}</td><td className="p-4 font-bold text-indigo-600">{`SV-${String(student.id).padStart(3, '0')}`}</td><td className="p-4"><div className="flex items-center gap-3"><img src={student.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}`} alt="avatar" className="w-8 h-8 rounded-full object-cover" /><span className="font-bold text-gray-700">{student.name}</span></div></td><td className="p-4">{student.gender || 'Nam'}</td><td className="p-4">{student.email || 'N/A'}</td><td className="p-4">{student.department || 'N/A'}</td><td className="p-4 text-gray-500">{student.dob || ''}</td><td className="p-4 text-right"><span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-green-100 text-green-600">Đang học</span></td></tr>; })}{enrolledList.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-gray-400">Không có sinh viên đăng ký cho học phần này.</td></tr>}</tbody></table></div></div>
          </div>
        )}

        <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3">{toasts.map((toast) => <div key={toast.id} className={`${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3`}><i className={`fas ${toast.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-xl`} /><span className="font-bold text-sm">{toast.message}</span></div>)}</div>
      </div>
    </GVLayout>
  );
}
