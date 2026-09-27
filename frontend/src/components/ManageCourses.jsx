import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import PDLayout from '../layouts/PDLayout';
import {
  fetchCourses,
  saveCourses,
  syncCoursesWithDepartments,
  formatCurrency,
} from '../utils/courseUtils';
import { fetchDepartments, DEPARTMENTS_UPDATED_EVENT } from '../utils/departmentUtils';

const EMPTY_FORM = {
  courseId: '',
  courseName: '',
  courseCredits: '',
  courseFee: '',
  courseDept: '',
  courseDeptId: '',
  courseClassId: '',
  courseClassName: '',
};

function ManageCourses() {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchCourse, setSearchCourse] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [sortCourse, setSortCourse] = useState('name-asc');
  const [showModal, setShowModal] = useState(false);
  const [editCourseId, setEditCourseId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const importRef = useRef(null);
  const lastOptimisticUpdateRef = useRef(0);

  const loadDepartments = useCallback(async () => {
    const list = await fetchDepartments({ fresh: true });
    setDepartments(list);
  }, []);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    const fetchStartTime = Date.now();
    try {
      const [depts, rawCourses] = await Promise.all([
        fetchDepartments({ fresh: true }),
        fetchCourses({ fresh: true }),
      ]);
      setDepartments(depts);
      const list = syncCoursesWithDepartments(rawCourses, depts);
      
      // Only update courses if no optimistic update happened during fetch
      // (within 2 second buffer to account for async operations)
      if (lastOptimisticUpdateRef.current < fetchStartTime - 2000) {
        setCourses(list);
      }
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không tải được danh sách học phần từ API.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  useEffect(() => {
    const refreshDepts = () => loadDepartments();
    window.addEventListener(DEPARTMENTS_UPDATED_EVENT, refreshDepts);
    return () => window.removeEventListener(DEPARTMENTS_UPDATED_EVENT, refreshDepts);
  }, [loadDepartments]);

  const filteredCourses = useMemo(() => {
    const search = searchCourse.toLowerCase();
    let list = courses.filter(
      (c) =>
        (c.name?.toLowerCase().includes(search) || c.id?.toLowerCase().includes(search)) &&
        (filterDept === '' || c.department === filterDept)
    );
    if (sortCourse === 'name-asc') {
      list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
    } else if (sortCourse === 'credit-desc') {
      list = [...list].sort((a, b) => (b.credits || 0) - (a.credits || 0));
    } else if (sortCourse === 'credit-asc') {
      list = [...list].sort((a, b) => (a.credits || 0) - (b.credits || 0));
    }
    return list;
  }, [courses, searchCourse, filterDept, sortCourse]);

  const clearFormErrors = () => setFormErrors({});

  const setFieldError = (field, message) => {
    setFormErrors((prev) => ({ ...prev, [field]: message }));
  };

  const openCourseModal = (id = null) => {
    clearFormErrors();
    if (id) {
      const c = courses.find((x) => x.id === id);
      if (!c) return;
      setEditCourseId(c.id);
      setForm({
        courseId: c.id,
        courseName: c.name,
        courseCredits: String(c.credits ?? ''),
        courseFee: String(c.fee ?? 0),
        courseDept: c.department || c.dept || '',
        courseDeptId: c.deptId || c.departmentId || '',
        courseClassId: c.classId || '',
        courseClassName: c.className || '',
      });
    } else {
      setEditCourseId('');
      setForm(EMPTY_FORM);
    }
    setShowModal(true);
  };

  const closeCourseModal = () => {
    setShowModal(false);
    clearFormErrors();
  };

  const handleDeptChange = (deptName) => {
    const dept = departments.find((d) => d.name === deptName);
    setForm((prev) => ({
      ...prev,
      courseDept: deptName,
      courseDeptId: dept?.id || '',
    }));
    setFormErrors((prev) => ({ ...prev, courseDept: '' }));
  };

  const getDisplayDeptName = (course) => {
    const departmentName = course.department || course.dept || '';
    const realDept =
      departments.find((d) => d.id === course.deptId) ||
      departments.find((d) => d.name === departmentName);
    return realDept ? realDept.name : departmentName || 'N/A';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFormErrors();

    const idVal = form.courseId.trim();
    const nameVal = form.courseName.trim();
    const creditVal = form.courseCredits;
    const feeVal = form.courseFee;
    const deptVal = form.courseDept;
    const deptIdVal = form.courseDeptId;
    const classIdVal = form.courseClassId.trim();
    const classNameVal = form.courseClassName.trim();

    let isValid = true;
    if (!idVal) {
      setFieldError('courseId', 'Vui lòng nhập mã học phần!');
      isValid = false;
    }
    if (!nameVal) {
      setFieldError('courseName', 'Vui lòng nhập tên học phần!');
      isValid = false;
    }
    if (!creditVal || Number(creditVal) <= 0) {
      setFieldError('courseCredits', 'Số tín chỉ phải lớn hơn 0!');
      isValid = false;
    }
    if (!feeVal || Number(feeVal) < 0) {
      setFieldError('courseFee', 'Học phí không hợp lệ!');
      isValid = false;
    }
    if (!deptVal) {
      setFieldError('courseDept', 'Vui lòng chọn khoa!');
      isValid = false;
    }
    if (!classIdVal) {
      setFieldError('courseClassId', 'Vui lòng nhập mã lớp!');
      isValid = false;
    }
    if (!classNameVal) {
      setFieldError('courseClassName', 'Vui lòng nhập tên lớp học phần!');
      isValid = false;
    }

    const otherCourses = editCourseId ? courses.filter((c) => c.id !== editCourseId) : courses;

    if (isValid) {
      if (otherCourses.some((c) => c.id.toUpperCase() === idVal.toUpperCase())) {
        setFieldError('courseId', 'Mã học phần này đã tồn tại trong hệ thống!');
        isValid = false;
      }
      if (otherCourses.some((c) => c.name.toLowerCase() === nameVal.toLowerCase())) {
        setFieldError('courseName', 'Tên học phần này đã tồn tại!');
        isValid = false;
      }
      if (otherCourses.some((c) => (c.classId || '').toUpperCase() === classIdVal.toUpperCase())) {
        setFieldError('courseClassId', 'Mã lớp này đã tồn tại!');
        isValid = false;
      }
      if (otherCourses.some((c) => (c.className || '').toLowerCase() === classNameVal.toLowerCase())) {
        setFieldError('courseClassName', 'Tên lớp học phần này đã tồn tại!');
        isValid = false;
      }
    }

    if (!isValid) return;

    const newData = {
      id: idVal.toUpperCase(),
      name: nameVal,
      credits: parseInt(creditVal, 10),
      fee: parseInt(feeVal, 10),
      department: deptVal,
      deptId: deptIdVal,
      classId: classIdVal,
      className: classNameVal,
    };

    let next = [...courses];
    if (editCourseId) {
      const idx = next.findIndex((x) => x.id === editCourseId);
      if (idx !== -1) next[idx] = newData;
    } else {
      next.push(newData);
    }

    // Optimistic update: update state immediately
    lastOptimisticUpdateRef.current = Date.now();
    setCourses(next);
    closeCourseModal();
    setSaving(true);

    // Save to API in background
    saveCourses(next)
      .catch((err) => {
        console.error(err);
        setCourses(courses); // Rollback on error
        Swal.fire('Lỗi', 'Không lưu được dữ liệu học phần lên API.', 'error');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const confirmDeleteCourse = (id) => {
    Swal.fire({
      title: 'Xác nhận xóa?',
      text: 'Hành động này không thể hoàn tác!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Xác nhận xóa',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) return;
      
      const next = courses.filter((x) => x.id !== id);
      
      // Optimistic update: update state immediately
      lastOptimisticUpdateRef.current = Date.now();
      setCourses(next);
      setSaving(true);

      // Save to API in background
      saveCourses(next)
        .catch((err) => {
          console.error(err);
          setCourses(courses); // Rollback on error
          Swal.fire('Lỗi', 'Không xóa được học phần trên API.', 'error');
        })
        .finally(() => {
          setSaving(false);
        });
    });
  };

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          Swal.fire('Lỗi', 'File Excel không có dữ liệu!', 'error');
          return;
        }

        let next = [...courses];
        let importCount = 0;
        let skipCount = 0;

        jsonData.forEach((item) => {
          const getVal = (keys) => {
            for (const key of keys) {
              if (item[key] !== undefined) return item[key];
            }
            return '';
          };

          const idVal = getVal(['MaHP', 'Mã Học Phần', 'Mã HP', 'mahp']).toString().trim().toUpperCase();
          const nameVal = getVal(['TenHP', 'Tên Học Phần', 'Tên HP', 'tenhp']).toString().trim();
          const creditVal = parseInt(getVal(['TinChi', 'Số Tín Chỉ', 'Số tín chỉ', 'tinchi']) || 0, 10);
          const feeVal = parseInt(getVal(['HocPhi', 'Học Phí', 'Học phí', 'hocphi']) || 0, 10);
          const deptName = getVal(['Khoa', 'Khoa Quản Lý', 'Khoa quản lý', 'khoa']).toString().trim();
          const classIdVal = getVal(['MaLop', 'Mã Lớp', 'Mã lớp', 'malop']).toString().trim();
          const classNameVal = getVal([
            'TenLopHP',
            'Tên Lớp HP',
            'TenLớp',
            'Tên Lớp',
            'Lớp',
            'tenlop',
          ])
            .toString()
            .trim();

          if (!idVal || !nameVal || next.some((c) => c.id === idVal)) {
            skipCount++;
            return;
          }

          const foundDept = departments.find((d) => d.name.toLowerCase() === deptName.toLowerCase());

          next.push({
            id: idVal,
            name: nameVal,
            credits: creditVal,
            fee: feeVal,
            department: foundDept ? foundDept.name : deptName,
            deptId: foundDept ? foundDept.id : '',
            classId: classIdVal,
            className: classNameVal,
          });
          importCount++;
        });

        // Optimistic update: update state immediately
        lastOptimisticUpdateRef.current = Date.now();
        setCourses(next);
        setSaving(true);

        // Show success message
        Swal.fire({
          icon: 'success',
          title: 'Import thành công',
          text: `Đã thêm ${importCount} học phần mới, bỏ qua ${skipCount} bản ghi lỗi/trùng.`,
          confirmButtonColor: '#4f46e5',
        });

        // Save to API in background
        saveCourses(next)
          .catch((err) => {
            console.error(err);
            setCourses(courses); // Rollback on error
            Swal.fire('Lỗi', 'Không lưu được dữ liệu import lên API.', 'error');
          })
          .finally(() => {
            setSaving(false);
          });
      } catch {
        Swal.fire('Lỗi', 'Có lỗi xảy ra khi xử lý file!', 'error');
      }
      e.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const errorClass = (field) => (formErrors[field] ? 'error-border' : '');

  return (
    <PDLayout>
      <style>{`
        .error-border { border-color: #ef4444 !important; border-width: 2px !important; }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #818cf8; }
      `}</style>

      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Danh sách học phần</h2>
          <p className="text-sm text-gray-500">Danh mục các học phần đào tạo</p>
        </div>
        <div className="flex gap-3">
          <input
            ref={importRef}
            type="file"
            accept=".xlsx, .xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            disabled={saving}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 shadow-lg flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-60"
          >
            <i className="fas fa-file-excel" /> Import Excel
          </button>
          <button
            type="button"
            onClick={() => openCourseModal()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 shadow-lg flex items-center gap-2 transition-all transform hover:scale-105"
          >
            <i className="fas fa-plus" /> Thêm học phần
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <i className="fas fa-search absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchCourse}
            onChange={(e) => setSearchCourse(e.target.value)}
            placeholder="Tìm tên hoặc mã học phần..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl outline-none text-sm focus:border-indigo-500"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="px-4 py-2 bg-gray-50 text-gray-600 rounded-xl text-sm outline-none border border-gray-200"
        >
          <option value="">Tất cả các khoa</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={sortCourse}
          onChange={(e) => setSortCourse(e.target.value)}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 font-semibold rounded-xl text-sm outline-none border-none"
        >
          <option value="name-asc">Tên (A-Z)</option>
          <option value="credit-desc">Tín chỉ (Cao-Thấp)</option>
          <option value="credit-asc">Tín chỉ (Thấp-Cao)</option>
        </select>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Mã Học Phần</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap min-w-[200px]">Tên Học Phần</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap text-center">Số Tín Chỉ</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Học Phí</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap min-w-[180px]">Khoa Quản Lý</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Mã Lớp</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap min-w-[180px]">Tên Lớp HP</th>
                <th className="px-6 py-4 text-center font-semibold whitespace-nowrap sticky right-0 bg-gray-50 shadow-[-5px_0px_10px_rgba(0,0,0,0.02)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm text-gray-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400 italic">
                    Đang tải danh sách học phần...
                  </td>
                </tr>
              ) : filteredCourses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-gray-400 italic">
                    Không có học phần phù hợp
                  </td>
                </tr>
              ) : (
                filteredCourses.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-indigo-50/30 transition-colors border-b border-gray-50 last:border-none"
                  >
                    <td className="px-6 py-4 font-bold text-indigo-600 whitespace-nowrap">{c.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-800 whitespace-nowrap">{c.name}</td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full text-xs font-bold">
                        {c.credits} Tín chỉ
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600 whitespace-nowrap">
                      {formatCurrency(c.fee)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 whitespace-nowrap">{getDisplayDeptName(c)}</td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-500 font-bold whitespace-nowrap">
                      {c.classId || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-semibold">
                        {c.className || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center sticky right-0 bg-white shadow-[-5px_0px_10px_rgba(0,0,0,0.02)] whitespace-nowrap">
                      <div className="flex justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCourseModal(c.id)}
                          className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                        >
                          <i className="fas fa-edit text-xs" />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDeleteCourse(c.id)}
                          disabled={saving}
                          className="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm disabled:opacity-60"
                        >
                          <i className="fas fa-trash-alt text-xs" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-2xl mx-4 overflow-y-auto max-h-[90vh]">
            <h3 className="text-xl font-bold mb-6 text-indigo-900 border-b pb-4">
              {editCourseId ? 'Chỉnh sửa Học Phần' : 'Thêm Học Phần'}
            </h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-x-6 gap-y-4" autoComplete="off" noValidate>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Học Phần</label>
                <input
                  type="text"
                  value={form.courseId}
                  onChange={(e) => setForm((p) => ({ ...p, courseId: e.target.value }))}
                  disabled={!!editCourseId}
                  placeholder="VD: THDC01"
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100 ${errorClass('courseId')}`}
                />
                {formErrors.courseId && <p className="text-red-500 text-xs mt-1">{formErrors.courseId}</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Học Phần</label>
                <input
                  type="text"
                  value={form.courseName}
                  onChange={(e) => setForm((p) => ({ ...p, courseName: e.target.value }))}
                  placeholder="VD: Tin học đại cương"
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseName')}`}
                />
                {formErrors.courseName && <p className="text-red-500 text-xs mt-1">{formErrors.courseName}</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Số Tín Chỉ</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.courseCredits}
                  onChange={(e) => setForm((p) => ({ ...p, courseCredits: e.target.value }))}
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseCredits')}`}
                />
                {formErrors.courseCredits && <p className="text-red-500 text-xs mt-1">{formErrors.courseCredits}</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Học Phí (VNĐ)</label>
                <input
                  type="number"
                  value={form.courseFee}
                  onChange={(e) => setForm((p) => ({ ...p, courseFee: e.target.value }))}
                  placeholder="VD: 1500000"
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseFee')}`}
                />
                {formErrors.courseFee && <p className="text-red-500 text-xs mt-1">{formErrors.courseFee}</p>}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Khoa Quản Lý</label>
                <select
                  value={form.courseDept}
                  onChange={(e) => handleDeptChange(e.target.value)}
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseDept')}`}
                >
                  <option value="">Chọn khoa quản lý</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {formErrors.courseDept && <p className="text-red-500 text-xs mt-1">{formErrors.courseDept}</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Mã Lớp</label>
                <input
                  type="text"
                  value={form.courseClassId}
                  onChange={(e) => setForm((p) => ({ ...p, courseClassId: e.target.value }))}
                  placeholder="VD: L01"
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseClassId')}`}
                />
                {formErrors.courseClassId && <p className="text-red-500 text-xs mt-1">{formErrors.courseClassId}</p>}
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Tên Lớp Học Phần</label>
                <input
                  type="text"
                  value={form.courseClassName}
                  onChange={(e) => setForm((p) => ({ ...p, courseClassName: e.target.value }))}
                  placeholder="VD: Lớp Tin học A"
                  className={`w-full p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${errorClass('courseClassName')}`}
                />
                {formErrors.courseClassName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.courseClassName}</p>
                )}
              </div>
              <div className="col-span-2 flex justify-end gap-3 pt-6 border-t mt-4">
                <button
                  type="button"
                  onClick={closeCourseModal}
                  className="px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md transition disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : 'Lưu dữ liệu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PDLayout>
  );
}

export default ManageCourses;
