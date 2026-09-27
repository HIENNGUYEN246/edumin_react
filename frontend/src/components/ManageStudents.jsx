import { useCallback, useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import studentAPI from '../services/studentAPI';
import PDLayout from '../layouts/PDLayout';
import {
  parseExcelDate,
  defaultAvatar,
  formatDisplayDate,
  getMaxDobForStudent,
  compressAvatarFile,
  ensureStudentAccountFields,
  formatStudentId,
} from '../utils/studentUtils';
import { DEPARTMENTS_UPDATED_EVENT, fetchDepartments } from '../utils/departmentUtils';

const EMPTY_FORM = {
  name: '',
  dob: '',
  phone: '',
  gender: 'Nam',
  address: '',
  email: '',
  education: '',
  department: '',
};

function ManageStudents() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterEdu, setFilterEdu] = useState('');
  const [filterGender, setFilterGender] = useState('');
  const [filterAddress, setFilterAddress] = useState('');
  const [sortOrder, setSortOrder] = useState('id-asc');
  const [showModal, setShowModal] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarError, setAvatarError] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [saving, setSaving] = useState(false);
  const importRef = useRef(null);
  const maxDob = getMaxDobForStudent();

  const loadStudents = useCallback(async () => {
    setLoading(true);
    try {
      const list = await studentAPI.getAllStudents();
      setStudents(list);
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không tải được danh sách sinh viên từ API.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      setDepartments(await fetchDepartments());
    } catch {
      setDepartments([]);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
    loadStudents();
  }, [loadDepartments, loadStudents]);

  useEffect(() => {
    const refreshDepartments = () => loadDepartments();
    window.addEventListener(DEPARTMENTS_UPDATED_EVENT, refreshDepartments);
    return () => window.removeEventListener(DEPARTMENTS_UPDATED_EVENT, refreshDepartments);
  }, [loadDepartments]);

  const getFilteredStudents = () => {
    const term = searchTerm.toLowerCase();
    const addr = filterAddress.toLowerCase();
    let result = students.filter((t) => {
      const matchSearch =
        (t.name || '').toLowerCase().includes(term) ||
        (t.email || '').toLowerCase().includes(term) ||
        (t.id || '').toString().includes(term);
      return (
        matchSearch &&
        (!filterDept || t.department === filterDept) &&
        (!filterEdu || t.education === filterEdu) &&
        (!filterGender || t.gender === filterGender) &&
        (!addr || (t.address || '').toLowerCase().includes(addr))
      );
    });

    const [criteria, direction] = sortOrder.split('-');
    result.sort((a, b) => {
      const comp = criteria === 'id' ? a.id - b.id : (a.name || '').localeCompare(b.name || '', 'vi');
      return direction === 'asc' ? comp : -comp;
    });
    return result;
  };

  const filteredStudents = getFilteredStudents();

  const setFieldError = (field, message) => {
    setFormErrors((prev) => ({ ...prev, [field]: message || '' }));
  };

  const updatePreview = (nextForm = form, id = editingId) => {
    return {
      name: nextForm.name || 'Tên Sinh Viên',
      edu: nextForm.education || 'chưa chọn hệ',
      email: nextForm.email || 'chưa cập nhật',
      dept: nextForm.department || 'chưa chọn khoa',
      code: id
        ? `Mã SV: ${formatStudentId(id)}`
        : `Mã SV: ${formatStudentId(students.length > 0 ? Math.max(...students.map((s) => s.id)) + 1 : 1)}`,
    };
  };

  const preview = updatePreview();

  const openStudentModal = (id = null) => {
    loadDepartments();
    setFormErrors({});
    setAvatarError(false);
    setAvatarFile(null);

    if (id) {
      const t = students.find((x) => x.id === id);
      if (!t) return;
      setEditingId(id);
      setForm({
        name: t.name,
        dob: t.dob,
        phone: t.phone,
        gender: t.gender,
        address: t.address,
        email: t.email,
        education: t.education,
        department: t.department,
      });
      setAvatarPreview(t.avatar);
    } else {
      setEditingId(null);
      setForm(EMPTY_FORM);
      setAvatarPreview('https://ui-avatars.com/api/?name=SV&background=fff&color=6366f1');
    }
    setShowModal(true);
  };

  const closeStudentModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setAvatarFile(null);
    setFormErrors({});
    setAvatarError(false);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldError(field, '');
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarError(false);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const validateForm = () => {
    const errors = {};
    let valid = true;
    const emailBaseRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^0[35789][0-9]{8}$/;
    const nameRegex = /^[^0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+$/;
    const addressRegex = /^[a-zA-ZÀ-ỹ0-9\s,\-/.]+$/;

    ['name', 'email', 'phone', 'dob', 'department', 'education', 'address'].forEach((f) => {
      const val = form[f]?.trim() || '';
      if (!val) {
        errors[f] = 'Thông tin bắt buộc';
        valid = false;
        return;
      }
      if (f === 'email') {
        if (!emailBaseRegex.test(val)) {
          errors.email = 'Email không hợp lệ';
          valid = false;
        } else if (!val.endsWith('@student.edu.vn')) {
          errors.email = 'Email phải có đuôi @student.edu.vn';
          valid = false;
        }
      } else if (f === 'phone' && !phoneRegex.test(val)) {
        errors.phone = 'SĐT phải có 10 số và đầu là số 0';
        valid = false;
      } else if (f === 'name' && !nameRegex.test(val)) {
        errors.name = 'Tên không chứa số hoặc ký tự đặc biệt';
        valid = false;
      } else if (f === 'address' && !addressRegex.test(val)) {
        errors.address = 'Địa chỉ chứa ký tự lạ không hợp lệ';
        valid = false;
      } else if (f === 'dob') {
        const birthDate = new Date(val);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age -= 1;
        if (age < 18) {
          errors.dob = 'Sinh viên phải từ 18 tuổi trở lên';
          valid = false;
        }
      }
    });

    if (!editingId && !avatarFile) {
      setAvatarError(true);
      valid = false;
    }

    setFormErrors(errors);
    return valid;
  };

  const persistStudent = async (avatarDataUrl) => {
    const phoneVal = form.phone.trim();
    const emailVal = form.email.trim();
    const existing = editingId ? students.find((x) => x.id === editingId) : null;

    const newData = ensureStudentAccountFields({
      id: editingId ? editingId : students.length > 0 ? Math.max(...students.map((t) => t.id)) + 1 : 1,
      name: form.name.trim(),
      dob: form.dob,
      address: form.address.trim(),
      gender: form.gender,
      phone: phoneVal,
      email: emailVal,
      department: form.department,
      education: form.education,
      avatar: avatarDataUrl || existing?.avatar || defaultAvatar(form.name.trim()),
      password: existing?.password || '123',
      status: existing?.status || 'Active',
      className: existing?.className || '',
      lockReason: existing?.lockReason || '',
    });

    // ensure backward-compatible hoTen and avatar
    if (newData.name && !newData.hoTen) newData.hoTen = newData.name;
    if (newData.hoTen && !newData.name) newData.name = newData.hoTen;
    if (!newData.avatar) newData.avatar = defaultAvatar(newData.name || newData.hoTen || 'SV');

    const nextStudents = editingId
      ? students.map((t) => (t.id === editingId ? newData : t))
      : [...students, newData];

    const snapshot = students;
    setStudents(nextStudents);
    closeStudentModal();
    setSaving(true);

    try {
      await studentAPI.saveAllStudents(nextStudents);
      Swal.fire({
        title: 'Thành công',
        text: editingId ? 'Đã cập nhật thông tin' : 'Đã thêm sinh viên mới',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });
    } catch (error) {
      setStudents(snapshot);
      Swal.fire('Lỗi', error.message || 'Không lưu được lên API', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm() || saving) return;

    try {
      const existing = editingId ? students.find((x) => x.id === editingId) : null;
      let avatarUrl = existing?.avatar || defaultAvatar(form.name.trim());

      if (avatarFile) {
        avatarUrl = await compressAvatarFile(avatarFile);
      }

      await persistStudent(avatarUrl);
    } catch (error) {
      Swal.fire('Lỗi', error.message || 'Không xử lý được ảnh', 'error');
    }
  };

  const openDeleteConfirm = (id) => {
    setDeleteId(id);
    setShowConfirm(true);
    setTimeout(() => setConfirmVisible(true), 10);
  };

  const closeConfirmModal = () => {
    setConfirmVisible(false);
    setTimeout(() => {
      setShowConfirm(false);
      setDeleteId(null);
    }, 200);
  };

  const confirmDelete = async () => {
    if (saving) return;

    const snapshot = students;
    const nextStudents = students.filter((t) => t.id !== deleteId);
    setStudents(nextStudents);
    closeConfirmModal();
    setSaving(true);

    try {
      await studentAPI.saveAllStudents(nextStudents);
      Swal.fire({
        title: 'Đã xóa',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
      });
    } catch (error) {
      setStudents(snapshot);
      Swal.fire('Lỗi', error.message || 'Không xóa được', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleImportExcel = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        let currentStudents = [...students];
        let importedCount = 0;
        const errorDetails = [];

        json.forEach((row, index) => {
          const keys = Object.keys(row);
          const find = (names) => {
            const foundKey = keys.find((k) => names.includes(k.trim()));
            return foundKey ? row[foundKey] : '';
          };

          const rawId = find(['MaSV', 'Mã SV', 'ID', 'MSSV']);
          if (rawId === '') return;

          const id = parseInt(rawId.toString().replace(/[^0-9]/g, ''), 10);
          if (Number.isNaN(id)) {
            errorDetails.push(`Dòng ${index + 2}: Mã SV không đúng.`);
            return;
          }
          if (currentStudents.some((t) => t.id === id)) {
            errorDetails.push(`Dòng ${index + 2}: SV-${id} đã tồn tại.`);
            return;
          }

          const hoTen = find(['HoTen', 'Họ tên', 'Họ và Tên', 'Ten']);
          let sdtRaw = find(['SDT', 'Số điện thoại', 'Phone']).toString().trim();
          if (sdtRaw.startsWith("'")) sdtRaw = sdtRaw.substring(1);

          currentStudents.push(
            ensureStudentAccountFields({
              id,
              name: hoTen || 'Sinh viên ẩn danh',
              className: find(['Lop', 'Lớp']) || '',
              dob: parseExcelDate(find(['NgaySinh', 'Ngày sinh'])),
              address: find(['DiaChi', 'Địa chỉ', 'Address']) || '',
              gender: find(['GioiTinh', 'Giới tính', 'Gender']) || 'Nam',
              phone: sdtRaw,
              email: find(['Email']),
              department: find(['Khoa', 'Chuyên ngành', 'Department']),
              education: find(['HeDaoTao', 'Hệ đào tạo', 'Hệ']) || 'Chính quy',
              avatar: defaultAvatar(hoTen || 'SV'),
              password: '123',
              status: 'Active',
            })
          );
          importedCount += 1;
        });

        const snapshot = students;
        setStudents(currentStudents);
        setSaving(true);

        try {
          await studentAPI.saveAllStudents(currentStudents);
        } catch (error) {
          setStudents(snapshot);
          Swal.fire('Lỗi', error.message || 'Không lưu import lên API', 'error');
          setSaving(false);
          return;
        } finally {
          setSaving(false);
        }

        if (errorDetails.length > 0) {
          Swal.fire({
            title: 'Kết quả Import',
            html: `Thành công: <b>${importedCount}</b><br>Lỗi: <b>${errorDetails.length}</b><div class="text-red-500 text-left text-xs max-h-40 overflow-y-auto border p-2 bg-gray-50 mt-2">${errorDetails.join('<br>')}</div>`,
            icon: 'warning',
          });
        } else {
          Swal.fire('Thành công', `Đã nhập thành công ${importedCount} sinh viên vào hệ thống.`, 'success');
        }
      } catch {
        Swal.fire('Lỗi', 'Không thể đọc file. Hãy kiểm tra định dạng.', 'error');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <PDLayout>
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Danh sách sinh viên</h2>
          <p className="text-sm text-gray-500">Quản lý thông tin của sinh viên</p>
        </div>
        <div className="flex gap-3">
          <input ref={importRef} type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2"
          >
            <i className="fas fa-file-excel" /> Import Excel
          </button>
          <button
            type="button"
            onClick={() => openStudentModal()}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2"
          >
            <i className="fas fa-plus" /> Thêm sinh viên
          </button>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <i className="fas fa-search absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tên, Email hoặc ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-sm"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-4 py-2 border border-gray-200 rounded-xl outline-none text-sm cursor-pointer hover:border-indigo-300"
          >
            <option value="">Tất cả chuyên ngành</option>
            {departments.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={filterEdu}
              onChange={(e) => setFilterEdu(e.target.value)}
              className="w-3/5 px-4 py-2 border border-gray-200 rounded-xl outline-none text-sm cursor-pointer"
            >
              <option value="">Hệ đào tạo</option>
              <option value="Chính quy">Chính quy</option>
              <option value="Liên thông">Liên thông</option>
            </select>
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
              className="w-2/5 px-2 py-2 border border-gray-200 rounded-xl outline-none text-sm cursor-pointer"
            >
              <option value="">Phái</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
            </select>
          </div>
          <div className="relative">
            <i className="fas fa-map-marker-alt absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Tỉnh thành..."
              value={filterAddress}
              onChange={(e) => setFilterAddress(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 outline-none text-sm"
            />
          </div>
          <div className="relative">
            <i className="fas fa-sort-alpha-down absolute left-3 top-3 text-indigo-500" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold rounded-xl outline-none text-sm cursor-pointer"
            >
              <option value="id-asc">Cũ nhất (ID)</option>
              <option value="id-desc">Mới nhất (ID)</option>
              <option value="name-asc">Tên (A -&gt; Z)</option>
              <option value="name-desc">Tên (Z -&gt; A)</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1400px]">
            <thead>
              <tr className="bg-gray-50/50 text-gray-400 text-[11px] uppercase tracking-wider border-b border-gray-100">
                <th className="px-4 py-4 font-semibold text-center w-24">Mã SV</th>
                <th className="px-4 py-4 font-semibold text-center w-40">Ảnh</th>
                <th className="px-4 py-4 font-semibold min-w-[180px]">Họ và Tên</th>
                <th className="px-4 py-4 font-semibold w-32">Ngày sinh</th>
                <th className="px-4 py-4 font-semibold text-center w-20">Phái</th>
                <th className="px-4 py-4 font-semibold min-w-[200px]">Địa chỉ</th>
                <th className="px-4 py-4 font-semibold w-32">Điện thoại</th>
                <th className="px-4 py-4 font-semibold min-w-[250px]">Email</th>
                <th className="px-4 py-4 font-semibold min-w-[200px]">Chuyên ngành</th>
                <th className="px-4 py-4 font-semibold w-32">Hệ đào tạo</th>
                <th className="px-4 py-4 font-semibold text-center w-28 sticky-col">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400">Đang tải dữ liệu...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-400 font-bold">Không tìm thấy sinh viên nào phù hợp</td>
                </tr>
              ) : (
                filteredStudents.map((t) => (
                  <tr key={t.id} className="hover:bg-indigo-50/30 transition-colors text-sm text-gray-700">
                    <td className="px-4 py-4 text-center font-bold text-indigo-600 whitespace-nowrap">
                      {formatStudentId(t.id)}
                    </td>
                    <td className="px-4 py-4 w-40">
                      <div className="flex justify-center items-center w-full">
                        <img
                          src={t.avatar || defaultAvatar(t.name)}
                          alt={t.name}
                          className="w-12 h-12 min-w-[3rem] min-h-[3rem] rounded-full border border-gray-100 shadow-sm object-cover block"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4 font-bold text-gray-900 whitespace-nowrap">{t.name}</td>
                    <td className="px-4 py-4 whitespace-nowrap">{formatDisplayDate(t.dob)}</td>
                    <td className="px-4 py-4 text-center">{t.gender}</td>
                    <td className="px-4 py-4 truncate max-w-[200px]" title={t.address}>{t.address}</td>
                    <td className="px-4 py-4 font-medium whitespace-nowrap">{t.phone}</td>
                    <td className="px-4 py-4 text-indigo-500 font-medium truncate max-w-[250px]" title={t.email}>{t.email}</td>
                    <td className="px-4 py-4 font-medium text-gray-800">{t.department}</td>
                    <td className="px-4 py-4">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-100 whitespace-nowrap">
                        {t.education}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center sticky-col">
                      <div className="flex justify-center gap-2">
                        <button type="button" onClick={() => openStudentModal(t.id)} className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white transition-all">
                          <i className="fas fa-edit text-[10px]" />
                        </button>
                        <button type="button" onClick={() => openDeleteConfirm(t.id)} className="w-7 h-7 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all">
                          <i className="fas fa-trash-alt text-[10px]" />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
            <div className="md:w-1/3 bg-indigo-600 p-8 text-white flex flex-col items-center justify-center text-center">
              <div className="relative w-[150px] h-[150px] mb-6 mx-auto">
                <img
                  src={avatarPreview}
                  alt="Preview"
                  className={`w-full h-full rounded-full border-4 border-white shadow-lg object-cover bg-slate-50 ${avatarError ? 'avatar-error' : ''}`}
                />
                <label htmlFor="avatarFile" className="absolute bottom-1 right-1 bg-indigo-600 text-white w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-[3px] border-white hover:bg-indigo-700 hover:scale-110 transition">
                  <i className="fas fa-camera text-sm" />
                </label>
                <input id="avatarFile" type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <h3 className="text-xl font-bold mb-1">{preview.name}</h3>
              <p className="text-indigo-200 text-sm mb-4">{preview.edu}</p>
              <div className="w-full border-t border-indigo-500/50 pt-6 mt-2 space-y-3 text-left">
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-id-card w-5 text-indigo-300" /> <span>{preview.code}</span></div>
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-envelope w-5 text-indigo-300" /> <span className="truncate">{preview.email}</span></div>
                <div className="flex items-center gap-3 text-sm"><i className="fas fa-building w-5 text-indigo-300" /> <span>{preview.dept}</span></div>
              </div>
            </div>

            <div className="md:w-2/3 flex flex-col bg-white overflow-hidden">
              <div className="px-8 pt-8 pb-2 flex justify-between items-center">
                <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">{editingId ? 'Cập Nhật Sinh Viên' : 'Thêm Sinh Viên Mới'}</h2>
                <button type="button" onClick={closeStudentModal} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl" /></button>
              </div>
              <form onSubmit={handleSubmit} className="px-8 pt-4 pb-8 flex-1 overflow-y-auto custom-scrollbar space-y-6" noValidate>
                <div className="space-y-4">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider"><i className="fas fa-user mr-2" />Thông tin cá nhân</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Họ và tên</label>
                      <input value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.name ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`} />
                      {formErrors.name && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.name}</span>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Ngày sinh</label>
                      <input type="date" max={maxDob} value={form.dob} onChange={(e) => handleFormChange('dob', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.dob ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`} />
                      {formErrors.dob && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.dob}</span>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Số điện thoại</label>
                      <input value={form.phone} onChange={(e) => handleFormChange('phone', e.target.value)} placeholder="09xxxxxxxx" className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.phone ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`} />
                      {formErrors.phone && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.phone}</span>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Giới tính</label>
                      <select value={form.gender} onChange={(e) => handleFormChange('gender', e.target.value)} className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Địa chỉ cư trú</label>
                    <input value={form.address} onChange={(e) => handleFormChange('address', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.address ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`} />
                    {formErrors.address && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.address}</span>}
                  </div>
                </div>
                <div className="space-y-4 pt-4">
                  <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider"><i className="fas fa-briefcase mr-2" />Thông tin công tác</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Email nội bộ</label>
                      <input type="email" value={form.email} onChange={(e) => handleFormChange('email', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.email ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`} />
                      {formErrors.email && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.email}</span>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Hệ đào tạo</label>
                      <select value={form.education} onChange={(e) => handleFormChange('education', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.education ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`}>
                        <option value="">Chọn hệ</option>
                        <option value="Chính quy">Chính quy</option>
                        <option value="Liên thông">Liên thông</option>
                      </select>
                      {formErrors.education && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.education}</span>}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-500 mb-1">Chuyên ngành</label>
                      <select value={form.department} onChange={(e) => handleFormChange('department', e.target.value)} className={`w-full px-4 py-2.5 bg-gray-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 ${formErrors.department ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-200'}`}>
                        <option value="">Chọn chuyên ngành</option>
                        {departments.map((d) => (
                          <option key={d.name} value={d.name}>{d.name}</option>
                        ))}
                      </select>
                      {formErrors.department && <span className="text-red-500 text-[10px] mt-1 block">{formErrors.department}</span>}
                    </div>
                  </div>
                </div>
                {avatarError && (
                  <div className="text-red-500 text-xs text-center font-bold bg-red-50 p-2 rounded-lg">Bắt buộc phải tải ảnh lên</div>
                )}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-4 -mx-8 -mb-8 mt-4">
                  <button type="button" onClick={closeStudentModal} className="flex-1 px-6 py-3 border border-gray-200 text-gray-600 rounded-xl font-bold hover:bg-white transition uppercase text-xs tracking-widest">Hủy bỏ</button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition uppercase text-xs tracking-widest disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu dữ liệu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl transform transition-all duration-300 ${confirmVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-6">
                <i className="fas fa-trash-alt text-red-600 text-3xl" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Xác nhận xóa?</h3>
              <p className="text-sm text-gray-500 mb-8 leading-relaxed">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={closeConfirmModal} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition">Hủy</button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={saving}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-700 transition disabled:opacity-60"
              >
                {saving ? 'Đang xử lý...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PDLayout>
  );
}

export default ManageStudents;
