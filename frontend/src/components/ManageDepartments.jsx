import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PDLayout from '../layouts/PDLayout';
import teacherAPI from '../services/teacherAPI';
import { formatDisplayDate, defaultAvatar } from '../utils/teacherUtils';
import {
  fetchDepartments,
  saveDepartments,
  syncDepartmentReferences,
  parseTeacherHeadInfo,
  formatTeacherCode,
} from '../utils/departmentUtils';
import { fetchCoursesByDepartment } from '../utils/courseUtils';

const EMPTY_DEPT_FORM = { deptId: '', deptName: '', deptHead: '' };

function ManageDepartments() {
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [searchDept, setSearchDept] = useState('');
  const [sortOrder, setSortOrder] = useState('name-asc');
  const [toasts, setToasts] = useState([]);

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [showTeacherDetail, setShowTeacherDetail] = useState(false);
  const [showClassDetail, setShowClassDetail] = useState(false);
  const [detailTeacher, setDetailTeacher] = useState(null);
  const [classDetail, setClassDetail] = useState({ title: '', classes: [] });

  const [editDeptId, setEditDeptId] = useState('');
  const [form, setForm] = useState(EMPTY_DEPT_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const suggestionRef = useRef(null);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchDepartments({ fresh: true });
      setDepartments(list);
    } catch {
      showToast('Không tải được danh sách khoa từ API.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadTeachers = useCallback(async () => {
    try {
      const list = await teacherAPI.getAllTeachers();
      setTeachers(list);
    } catch {
      setTeachers([]);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadTeachers();
  }, [loadDepartments, loadTeachers]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const filteredDepartments = useMemo(() => {
    const search = searchDept.toLowerCase();
    let list = departments.filter(
      (d) => d.name.toLowerCase().includes(search) || d.id.toLowerCase().includes(search)
    );
    list = [...list].sort((a, b) =>
      sortOrder === 'name-asc' ? a.name.localeCompare(b.name, 'vi') : b.name.localeCompare(a.name, 'vi')
    );
    return list;
  }, [departments, searchDept, sortOrder]);

  const clearFormErrors = () => setFormErrors({});

  const normalizeHeadValue = useCallback((headValue) => {
    if (!headValue) return '';
    if (typeof headValue === 'string') return headValue;
    if (typeof headValue === 'object') {
      if (headValue.name || headValue.hoTen) {
        const teacherName = headValue.name || headValue.hoTen || '';
        const teacherId = headValue.id ? formatTeacherCode(headValue.id) : '';
        return teacherId ? `${teacherName} (${teacherId})` : teacherName;
      }
      const teacher = teachers.find((t) => String(t._id) === String(headValue._id) || String(t.id) === String(headValue.id));
      if (teacher) {
        return `${teacher.name || teacher.hoTen} (${formatTeacherCode(teacher.id)})`;
      }
    }
    return '';
  }, [teachers]);

  const openDeptModal = (id = null) => {
    clearFormErrors();
    setShowSuggestions(false);
    if (id) {
      const d = departments.find((x) => x.id === id);
      if (!d) return;
      setEditDeptId(d.id);
      setForm({ deptId: d.id, deptName: d.name, deptHead: normalizeHeadValue(d.head) });
    } else {
      setEditDeptId('');
      setForm(EMPTY_DEPT_FORM);
    }
    setShowDeptModal(true);
  };

  const closeDeptModal = () => {
    setShowDeptModal(false);
    setShowSuggestions(false);
  };

  const handleHeadInput = (value) => {
    setForm((prev) => ({ ...prev, deptHead: value }));
    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const searchStr = value.toLowerCase();
    const filtered = teachers.filter((t) => {
      const formattedId = formatTeacherCode(t.id);
      return (
        (t.name || '').toLowerCase().includes(searchStr) ||
        formattedId.toLowerCase().includes(searchStr)
      );
    });
    setSuggestions(filtered);
    setShowSuggestions(filtered.length > 0);
  };

  const selectTeacher = (name, fullId) => {
    setForm((prev) => ({ ...prev, deptHead: `${name} (${fullId})` }));
    setFormErrors((prev) => ({ ...prev, deptHead: '' }));
    setShowSuggestions(false);
  };

  const viewTeacherDetail = (teacherString) => {
    if (!teacherString) {
      showToast('Khoa này hiện chưa cập nhật trưởng khoa!', 'warning');
      return;
    }
    let targetId = null;
    const match = teacherString.match(/\((GV-\d+)\)/);
    if (match) {
      targetId = parseInt(match[1].replace('GV-', ''), 10);
    }
    const t = targetId
      ? teachers.find((x) => x.id === targetId)
      : teachers.find((x) => x.name === teacherString);
    if (!t) {
      showToast('Không tìm thấy thông tin chi tiết của giảng viên này!', 'error');
      return;
    }
    setDetailTeacher(t);
    setShowTeacherDetail(true);
  };

  const viewClassDetails = async (deptName) => {
    try {
      const filteredClasses = await fetchCoursesByDepartment(deptName);
      setClassDetail({ title: `Danh sách lớp - ${deptName}`, classes: filteredClasses });
      setShowClassDetail(true);
    } catch {
      showToast('Không tải được danh sách lớp từ API.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const idVal = form.deptId.trim();
    const nameVal = form.deptName.trim();
    const headVal = form.deptHead.trim();
    let depts = [...departments];

    const errors = {};
    if (!idVal) errors.deptId = 'Vui lòng nhập mã khoa!';
    if (!nameVal) errors.deptName = 'Vui lòng nhập tên khoa!';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const isDuplicateId = depts.some((d) => d.id.toUpperCase() === idVal.toUpperCase() && d.id !== editDeptId);
    const isDuplicateName = depts.some(
      (d) => d.name.toLowerCase() === nameVal.toLowerCase() && d.id !== editDeptId
    );
    if (isDuplicateId) errors.deptId = 'Mã khoa đã tồn tại!';
    if (isDuplicateName) errors.deptName = 'Tên khoa đã tồn tại!';
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }

    const newData = { id: idVal.toUpperCase(), name: nameVal, head: headVal };
    setSaving(true);
    try {
      if (editDeptId) {
        const idx = depts.findIndex((x) => x.id === editDeptId);
        const oldName = depts[idx].name;
        if (oldName !== newData.name) {
          await syncDepartmentReferences(oldName, newData.name);
        }
        depts[idx] = newData;
        showToast('Cập nhật khoa thành công!', 'success');
      } else {
        depts.push(newData);
        showToast('Thêm khoa mới thành công!', 'success');
      }
      await saveDepartments(depts);
      setDepartments(depts);
      closeDeptModal();
    } catch {
      showToast('Không lưu được dữ liệu khoa lên API.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
    requestAnimationFrame(() => setConfirmVisible(true));
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setTimeout(() => {
      setShowConfirm(false);
      setDeleteId(null);
    }, 200);
  };

  const confirmDelete = async () => {
    let depts = [...departments];
    const d = depts.find((x) => x.id === deleteId);
    if (!d) {
      closeConfirmModal();
      return;
    }
    setSaving(true);
    try {
      await syncDepartmentReferences(d.name, '', true);
      depts = depts.filter((x) => x.id !== deleteId);
      await saveDepartments(depts);
      setDepartments(depts);
      showToast('Đã xóa khoa thành công!', 'success');
    } catch {
      showToast('Không xóa được khoa trên API.', 'error');
    } finally {
      setSaving(false);
      closeConfirmModal();
    }
  };

  const teacherAvatar = detailTeacher?.avatar || defaultAvatar(detailTeacher?.name);

  return (
    <PDLayout>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-toast { animation: slideInRight 0.4s ease-out forwards; }
        .error-border { border-color: #ef4444 !important; border-width: 2px !important; }
        .avatar-preview {
          width: 150px; height: 150px; border-radius: 50%;
          border: 4px solid #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          object-fit: cover; background-color: #f8fafc;
        }
      `}</style>

      <div className="fixed top-5 right-5 z-[1000] flex flex-col gap-3 pointer-events-none">
        {toasts.map((t) => {
          const borderColor =
            t.type === 'error'
              ? 'border-red-500'
              : t.type === 'warning'
                ? 'border-yellow-500'
                : t.type === 'success'
                  ? 'border-green-500'
                  : 'border-blue-500';
          const icon =
            t.type === 'error'
              ? 'fa-exclamation-circle text-red-500'
              : t.type === 'warning'
                ? 'fa-exclamation-triangle text-yellow-500'
                : t.type === 'success'
                  ? 'fa-check-circle text-green-500'
                  : 'fa-info-circle text-blue-500';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto bg-white border-l-4 ${borderColor} p-4 rounded-xl shadow-2xl flex items-center gap-3 min-w-[300px] animate-toast`}
            >
              <i className={`fas ${icon} text-lg`} />
              <div className="flex-1 text-sm font-semibold text-gray-800">{t.message}</div>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              >
                <i className="fas fa-times" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Danh sách khoa</h2>
          <p className="text-sm text-gray-500">Quản lý thông tin khoa</p>
        </div>
        <button
          type="button"
          onClick={() => openDeptModal()}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
        >
          <i className="fas fa-plus" /> Thêm khoa mới
        </button>
      </div>

      <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <i className="fas fa-search absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchDept}
            onChange={(e) => setSearchDept(e.target.value)}
            placeholder="Tìm tên khoa hoặc mã khoa..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none text-sm focus:border-indigo-500"
          />
        </div>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-xl text-sm outline-none border-none cursor-pointer"
        >
          <option value="name-asc">Tên (A-Z)</option>
          <option value="name-desc">Tên (Z-A)</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Mã Khoa</th>
              <th className="px-6 py-4 font-semibold">Tên Khoa</th>
              <th className="px-6 py-4 font-semibold">Trưởng Khoa</th>
              <th className="px-6 py-4 text-center font-semibold">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                  Đang tải danh sách khoa...
                </td>
              </tr>
            ) : filteredDepartments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-400 italic">
                  Không có khoa phù hợp
                </td>
              </tr>
            ) : (
              filteredDepartments.map((d) => {
                const teacherInfo = parseTeacherHeadInfo(normalizeHeadValue(d.head));
                return (
                  <tr key={d.id} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-50 last:border-none">
                    <td className="px-6 py-4 font-bold text-indigo-600">{d.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{d.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-sm">{teacherInfo.name}</span>
                        <span className="text-[13px] text-indigo-500 font-mono font-semibold">{teacherInfo.id}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => viewTeacherDetail(d.head)} className="w-8 h-8 rounded-lg bg-green-50 text-green-600 hover:bg-green-600 hover:text-white transition-all shadow-sm" title="Thông tin trưởng khoa">
                          <i className="fas fa-user-tie text-xs" />
                        </button>
                        <button type="button" onClick={() => viewClassDetails(d.name)} className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all shadow-sm" title="Danh sách lớp">
                          <i className="fas fa-eye text-xs" />
                        </button>
                        <button type="button" onClick={() => openDeptModal(d.id)} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm" title="Sửa">
                          <i className="fas fa-edit text-xs" />
                        </button>
                        <button type="button" onClick={() => openDeleteConfirm(d.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" title="Xóa">
                          <i className="fas fa-trash-alt text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showTeacherDetail && detailTeacher && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            <div className="md:w-1/3 bg-indigo-600 p-8 text-white flex flex-col items-center justify-center text-center">
              <div className="mb-6">
                <img src={teacherAvatar} alt="" className="avatar-preview" />
              </div>
              <h3 className="text-xl font-bold mb-1">{detailTeacher.name}</h3>
              <p className="text-indigo-200 text-sm mb-4">{detailTeacher.education}</p>
              <div className="w-full border-t border-indigo-500/50 pt-6 mt-2 space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-id-card w-5 text-indigo-300" /><span>Mã GV: {formatTeacherCode(detailTeacher.id)}</span></div>
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-envelope w-5 text-indigo-300" /><span className="truncate">{detailTeacher.email}</span></div>
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-building w-5 text-indigo-300" /><span>{detailTeacher.department}</span></div>
              </div>
            </div>
            <div className="md:w-2/3 flex flex-col bg-white">
              <div className="p-8 pb-4 flex justify-between items-center border-b border-gray-100">
                <h2 className="text-2xl font-bold text-gray-800">Thông Tin Trưởng Khoa</h2>
                <button type="button" onClick={() => setShowTeacherDetail(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl" /></button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto custom-scrollbar">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider"><i className="fas fa-user mr-2" />Thông tin cá nhân</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Ngày sinh</label>
                        <p className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-700 font-medium">{formatDisplayDate(detailTeacher.dob) || '---'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Giới tính</label>
                        <p className="w-full px-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-gray-700 font-medium">{detailTeacher.gender || '---'}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Số điện thoại</label>
                        <p className="w-full px-4 py-3 bg-gray-50 border border-indigo-100 rounded-xl text-gray-700 font-medium">{detailTeacher.phone || 'Chưa cập nhật'}</p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 mb-1">Địa chỉ cư trú</label>
                        <p className="w-full px-4 py-3 bg-gray-50 border border-indigo-100 rounded-xl text-gray-700 font-medium">{detailTeacher.address || 'Chưa cập nhật'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
                <button type="button" onClick={() => setShowTeacherDetail(false)} className="px-8 py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition uppercase text-xs tracking-widest">Đóng thông tin</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showClassDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl mx-4">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h3 className="text-xl font-bold text-indigo-900">{classDetail.title}</h3>
              <button type="button" onClick={() => setShowClassDetail(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl" /></button>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100 mb-4">
              <table className="w-full text-left">
                <thead className="bg-indigo-50 text-indigo-700 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-bold text-center w-16">STT</th>
                    <th className="px-4 py-3 font-bold">Mã Lớp</th>
                    <th className="px-4 py-3 font-bold">Tên Lớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {classDetail.classes.length > 0 ? (
                    classDetail.classes.map((c, index) => (
                      <tr key={c.classId || index}>
                        <td className="px-4 py-3 text-center text-xs text-gray-500 font-medium">{index + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs font-bold text-indigo-600">{c.classId}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{c.className}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">Chưa có lớp nào thuộc khoa này</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 p-2">
              <span className="text-sm font-semibold text-gray-600">Tổng số lớp:</span>
              <span className="text-indigo-600 font-bold text-sm">{classDetail.classes.length}</span>
            </div>
          </div>
        </div>
      )}

      {showDeptModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md mx-4">
            <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">{editDeptId ? 'Chỉnh sửa Khoa' : 'Thêm Khoa'}</h3>
            <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" noValidate>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Khoa</label>
                <input type="text" value={form.deptId} onChange={(e) => setForm((p) => ({ ...p, deptId: e.target.value }))} placeholder="VD: CNTT" className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.deptId ? 'error-border' : ''}`} />
                {formErrors.deptId && <p className="text-red-500 text-xs mt-1">{formErrors.deptId}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Khoa</label>
                <input type="text" value={form.deptName} onChange={(e) => setForm((p) => ({ ...p, deptName: e.target.value }))} placeholder="VD: Khoa Công nghệ thông tin" className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.deptName ? 'error-border' : ''}`} />
                {formErrors.deptName && <p className="text-red-500 text-xs mt-1">{formErrors.deptName}</p>}
              </div>
              <div className="relative" ref={suggestionRef}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Trưởng Khoa</label>
                <input type="text" value={form.deptHead} onChange={(e) => handleHeadInput(e.target.value)} placeholder="Tìm mã hoặc tên giảng viên..." className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.deptHead ? 'error-border' : ''}`} />
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute w-full max-h-[200px] overflow-y-auto bg-white border border-gray-200 rounded-xl mt-1 shadow-lg z-[1000]">
                    {suggestions.map((t) => {
                      const teacherFullId = formatTeacherCode(t.id);
                      return (
                        <button key={t.id} type="button" className="w-full text-left px-4 py-2.5 border-b border-gray-100 last:border-none hover:bg-[#f0f7ff] transition" onClick={() => selectTeacher(t.name, teacherFullId)}>
                          <div className="text-sm font-bold text-indigo-600">{teacherFullId}</div>
                          <div className="text-xs text-gray-600">{t.name}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {formErrors.deptHead && <p className="text-red-500 text-xs mt-1">{formErrors.deptHead}</p>}
              </div>
              <div className="flex justify-end gap-3 pt-6">
                <button type="button" onClick={closeDeptModal} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition">Hủy</button>
                <button type="submit" disabled={saving} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition disabled:opacity-60">{saving ? 'Đang lưu...' : 'Lưu dữ liệu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className={`bg-white rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl transform transition-all duration-300 ${confirmVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4"><i className="fas fa-exclamation-triangle text-red-600 text-2xl" /></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
              <p className="text-sm text-gray-500 mb-6">Xóa khoa này sẽ ảnh hưởng đến dữ liệu sinh viên trong hệ thống. Bạn có chắc chắn không?</p>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={closeConfirmModal} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition">Hủy</button>
              <button type="button" onClick={confirmDelete} disabled={saving} className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition disabled:opacity-60">{saving ? 'Đang xử lý...' : 'Xóa ngay'}</button>
            </div>
          </div>
        </div>
      )}
    </PDLayout>
  );
}

export default ManageDepartments;
