import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import PDLayout from '../layouts/PDLayout';
import { fetchCourses } from '../utils/courseUtils';
import { fetchDepartments, isTeacherInDept } from '../utils/departmentUtils';
import teacherAPI from '../services/teacherAPI';
import studentAPI from '../services/studentAPI';
import { CourseRegModals } from './courseReg/CourseRegModals';
import {
  DAYS,
  SHIFTS,
  checkConflict,
  checkCourseExists,
  checkInternalConflict,
  fetchOpenRegistrations,
  fetchStudentRegistrations,
  getRegistrationStatusLabel,
  isRegistrationExpired,
  saveOpenRegistrations,
} from '../utils/registrationUtils';

const EMPTY_SCHEDULE_CONFIG = () => ({
  teacherId: '',
  room: '',
  days: {},
});

function formatStudyDate(dateStr) {
  if (!dateStr) return '---';
  return dateStr.split('-').reverse().join('/');
}

function formatDetailDate(dateStr) {
  if (!dateStr) return '---';
  const parts = dateStr.split('T')[0].split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
}

function ManageCourseRegistrations() {
  const [registrations, setRegistrations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortOption, setSortOption] = useState('default');

  const [showRegModal, setShowRegModal] = useState(false);
  const [showCourseListModal, setShowCourseListModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showStudentListModal, setShowStudentListModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAnimating, setConfirmAnimating] = useState(false);

  const [detailReg, setDetailReg] = useState(null);
  const [studentListCourse, setStudentListCourse] = useState(null);
  const [idToDelete, setIdToDelete] = useState(null);

  const [regDept, setRegDept] = useState('');
  const [studyStartDate, setStudyStartDate] = useState('');
  const [studyEndDate, setStudyEndDate] = useState('');
  const [regStartDate, setRegStartDate] = useState('');
  const [regEndDate, setRegEndDate] = useState('');
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [courseChecklist, setCourseChecklist] = useState([]);
  const [scheduleConfigs, setScheduleConfigs] = useState({});

  const importRef = useRef(null);
  const lastOptimisticUpdateRef = useRef(0);
  const pad = (n) => String(n).padStart(2, '0');
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);
  const nowLocal = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const fetchStartTime = Date.now();
    try {
      const [regs, courseList, depts, teacherList, studentList, enrollmentList] = await Promise.all([
        fetchOpenRegistrations({ fresh: true }),
        fetchCourses({ fresh: true }),
        fetchDepartments({ fresh: true }),
        teacherAPI.getAllTeachers({ fresh: true }),
        studentAPI.getAllStudents({ fresh: true }),
        fetchStudentRegistrations({ fresh: true }),
      ]);
      
      // Only update registrations if no optimistic update happened during fetch
      // (within 2 second buffer to account for async operations)
      if (lastOptimisticUpdateRef.current < fetchStartTime - 2000) {
        setRegistrations(regs);
      }
      
      setCourses(courseList);
      setDepartments(depts);
      setTeachers(teacherList);
      setStudents(studentList);
      setEnrollments(enrollmentList);
    } catch (error) {
      console.error(error);
      Swal.fire('Lỗi', 'Không tải được dữ liệu từ API.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const sortedRegistrations = useMemo(() => {
    const list = [...registrations];
    if (sortOption === 'name-asc') list.sort((a, b) => a.courseName.localeCompare(b.courseName));
    else if (sortOption === 'name-desc') list.sort((a, b) => b.courseName.localeCompare(a.courseName));
    else if (sortOption === 'code-asc') list.sort((a, b) => a.courseId.localeCompare(b.courseId));
    else if (sortOption === 'credits-desc') list.sort((a, b) => (b.credits || 0) - (a.credits || 0));
    return list;
  }, [registrations, sortOption]);

  const filteredRows = useMemo(() => {
    const search = searchInput.toLowerCase();
    return sortedRegistrations.filter((reg) => {
      const text = `${reg.courseName} ${reg.courseId} ${reg.department}`.toLowerCase();
      const deptMatch = !filterDept || reg.department?.toLowerCase() === filterDept.toLowerCase();
      const status = getRegistrationStatusLabel(reg);
      const statusMatch = !filterStatus || status === filterStatus;
      return text.includes(search) && deptMatch && statusMatch;
    });
  }, [sortedRegistrations, searchInput, filterDept, filterStatus]);

  const selectedDeptObj = useMemo(
    () => departments.find((d) => d.name === regDept || d.id === regDept),
    [departments, regDept]
  );

  const deptTeachers = useMemo(() => {
    if (!regDept) return [];
    const matched = teachers.filter((t) => isTeacherInDept(t, regDept, selectedDeptObj?.id));
    return matched.length > 0 ? matched : teachers;
  }, [teachers, regDept, selectedDeptObj]);

  const openRegModal = () => {
    setShowRegModal(true);
    setRegDept('');
    setStudyStartDate('');
    setStudyEndDate('');
    setRegStartDate('');
    setRegEndDate('');
    setSelectedCourses([]);
    setScheduleConfigs({});
  };

  const closeRegModal = () => {
    setShowRegModal(false);
    setSelectedCourses([]);
    setScheduleConfigs({});
  };

  const syncDataByDept = (dept) => {
    setRegDept(dept);
    setSelectedCourses([]);
    setScheduleConfigs({});
  };

  const openCourseListModal = () => {
    if (!regDept) {
      Swal.fire('Lưu ý', 'Vui lòng chọn Khoa trước!', 'warning');
      return;
    }
    const clean = (str) =>
      (str || '')
        .toLowerCase()
        .replace(/^(khoa|viện|bộ môn)\s+/i, '')
        .replace(/\s+/g, ' ')
        .trim();
    const cleanReg = clean(regDept);
    let deptCourses = courses.filter((c) => {
      if (!c) return false;
      if (c.department === regDept) return true;
      if (selectedDeptObj?.id && (c.deptId === selectedDeptObj.id || c.department === selectedDeptObj.id)) return true;
      if (clean(c.department) === cleanReg) return true;
      return false;
    });
    if (deptCourses.length === 0) {
      deptCourses = courses;
    }
    setCourseChecklist(
      deptCourses.map((c) => ({
        id: c.id,
        name: c.name,
        checked: selectedCourses.some((sc) => sc.id === c.id),
      }))
    );
    setShowCourseListModal(true);
  };

  const confirmCourseSelection = () => {
    const picked = courseChecklist.filter((c) => c.checked).map((c) => ({ id: c.id, name: c.name }));
    setSelectedCourses(picked);
    const nextConfigs = { ...scheduleConfigs };
    picked.forEach((c) => {
      if (!nextConfigs[c.id]) nextConfigs[c.id] = EMPTY_SCHEDULE_CONFIG();
    });
    Object.keys(nextConfigs).forEach((id) => {
      if (!picked.find((p) => p.id === id)) delete nextConfigs[id];
    });
    setScheduleConfigs(nextConfigs);
    setShowCourseListModal(false);
  };

  const updateScheduleConfig = (courseId, patch) => {
    setScheduleConfigs((prev) => ({
      ...prev,
      [courseId]: { ...EMPTY_SCHEDULE_CONFIG(), ...prev[courseId], ...patch },
    }));
  };

  const toggleDay = (courseId, dayId, checked) => {
    setScheduleConfigs((prev) => {
      const conf = { ...EMPTY_SCHEDULE_CONFIG(), ...prev[courseId] };
      const days = { ...conf.days };
      if (checked) days[dayId] = { shiftId: 'S1' };
      else delete days[dayId];
      return { ...prev, [courseId]: { ...conf, days } };
    });
  };

  const setDayShift = (courseId, dayId, shiftId) => {
    setScheduleConfigs((prev) => {
      const conf = { ...EMPTY_SCHEDULE_CONFIG(), ...prev[courseId] };
      return {
        ...prev,
        [courseId]: { ...conf, days: { ...conf.days, [dayId]: { shiftId } } },
      };
    });
  };

  const buildSchedulesFromConfig = (courseId) => {
    const conf = scheduleConfigs[courseId] || EMPTY_SCHEDULE_CONFIG();
    return Object.entries(conf.days || {}).map(([dayId, { shiftId }]) => ({
      dayId,
      dayLabel: DAYS.find((d) => d.id === dayId)?.label,
      shiftId,
      shiftLabel: SHIFTS.find((s) => s.id === shiftId)?.label,
    }));
  };

  const validateAndSubmit = async () => {
    if (!regDept || !studyStartDate || !studyEndDate || !regStartDate || !regEndDate || selectedCourses.length === 0) {
      Swal.fire('Thiếu thông tin', 'Vui lòng nhập đầy đủ thông tin chung và cấu hình học phần!', 'error');
      return;
    }
    if (new Date(studyEndDate) < new Date(studyStartDate)) {
      Swal.fire('Lỗi thời gian', 'Ngày kết thúc học không được nhỏ hơn ngày bắt đầu học!', 'error');
      return;
    }
    if (new Date(regEndDate) < new Date(regStartDate)) {
      Swal.fire('Lỗi thời gian', 'Thời gian kết thúc đăng ký không được nhỏ hơn thời gian bắt đầu!', 'error');
      return;
    }

    let regStart = regStartDate;
    let regEnd = regEndDate;
    if (regStart.length === 10) regStart += 'T00:00';
    if (regEnd.length === 10) regEnd += 'T23:59';

    const timestamp = Date.now();
    const newBatch = [];

    for (const course of selectedCourses) {
      const conf = scheduleConfigs[course.id] || EMPTY_SCHEDULE_CONFIG();
      const teacherId = parseInt(conf.teacherId, 10);
      const teacher = teachers.find((t) => Number(t.id) === Number(teacherId) || String(t.id) === String(conf.teacherId));
      const teacherName = teacher?.hoTen || teacher?.name || '';
      const room = (conf.room || '').trim().toUpperCase();
      const dayKeys = Object.keys(conf.days || {});

      if (!teacherId || !room || dayKeys.length === 0) {
        Swal.fire('Thiếu thông tin', `Vui lòng cấu hình đầy đủ lịch cho học phần ${course.name}!`, 'error');
        return;
      }

      const schedules = buildSchedulesFromConfig(course.id);

      const isExactDuplicate = registrations.some(
        (r) =>
          String(r.courseId).toUpperCase() === String(course.id).toUpperCase() &&
          Number(r.teacherId) === Number(teacherId) &&
          String(r.room).toUpperCase() === room &&
          JSON.stringify(r.schedules || []) === JSON.stringify(schedules)
      );
      if (isExactDuplicate) {
        Swal.fire('Cảnh báo', `Lớp học phần ${course.name} (${course.id}) với cùng giảng viên, phòng và lịch học đã tồn tại!`, 'warning');
        return;
      }

      const conflictMsg =
        checkConflict(registrations, teacherId, room, schedules) ||
        checkInternalConflict(teacherId, room, schedules, newBatch);

      if (conflictMsg) {
        Swal.fire('Trùng lịch', conflictMsg, 'warning');
        return;
      }

      const originalCourse = courses.find((c) => c.id === course.id);
      newBatch.push({
        id: timestamp + newBatch.length,
        department: regDept,
        courseId: course.id,
        courseName: course.name,
        credits: originalCourse ? originalCourse.credits : 0,
        fee: originalCourse ? originalCourse.fee : 0,
        studyStart: studyStartDate,
        studyEnd: studyEndDate,
        start: regStart,
        end: regEnd,
        teacher: teacherName,
        teacherId,
        room,
        schedules,
        status: 'Đang mở',
      });
    }

    const updated = [...registrations, ...newBatch];
    
    // Optimistic update: update state immediately
    lastOptimisticUpdateRef.current = Date.now();
    setRegistrations(updated);
    Swal.fire('Thành công', 'Đã mở đợt đăng ký thành công!', 'success');
    closeRegModal();
    setSaving(true);
    
    // Save to API in background
    saveOpenRegistrations(updated)
      .catch((error) => {
        console.error(error);
        setRegistrations(registrations); // Rollback on error
        Swal.fire('Lỗi', 'Không lưu được lên API.', 'error');
      })
      .finally(() => {
        setSaving(false);
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
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!jsonData.length) throw new Error('File trống');

        let nextRegs = [...registrations];
        const timestamp = Date.now();
        let count = 0;
        let skippedCount = 0;

        const formatExcelDateTime = (val) => {
          if (!val) return '';
          let date;
          if (typeof val === 'number') {
            date = new Date(Math.round((val - 25569) * 86400 * 1000));
          } else {
            const parts = val.toString().replace('T', ' ').split(' ');
            let datePart = parts[0];
            const timePart = parts[1] || '00:00';
            if (datePart.includes('/')) {
              const dParts = datePart.split('/');
              if (dParts[0].length === 2) datePart = `${dParts[2]}-${dParts[1]}-${dParts[0]}`;
            }
            return `${datePart}T${timePart}`;
          }
          const y = date.getUTCFullYear();
          const m = String(date.getUTCMonth() + 1).padStart(2, '0');
          const d = String(date.getUTCDate()).padStart(2, '0');
          const hh = String(date.getUTCHours()).padStart(2, '0');
          const mm = String(date.getUTCMinutes()).padStart(2, '0');
          return `${y}-${m}-${d}T${hh}:${mm}`;
        };

        const formatExcelDate = (val) => {
          const dt = formatExcelDateTime(val);
          return dt ? dt.split('T')[0] : '';
        };

        for (const [index, row] of jsonData.entries()) {
          const courseId = row.MaHP ? row.MaHP.toString().trim().toUpperCase() : '';
          if (!courseId) continue;

          let teacherId = row.MaGV ? row.MaGV.toString().trim() : '0';
          if (teacherId.includes('-')) teacherId = parseInt(teacherId.split('-').pop(), 10);
          else teacherId = parseInt(teacherId, 10);

          const room = row.Phong ? row.Phong.toString().toUpperCase() : 'TBA';

          const isExactDuplicate = nextRegs.some(
            (r) =>
              String(r.courseId).toUpperCase() === courseId &&
              Number(r.teacherId) === Number(teacherId) &&
              String(r.room).toUpperCase() === room
          );
          if (isExactDuplicate) {
            skippedCount += 1;
            continue;
          }

          const originalCourse = courses.find((c) => c.id === courseId);
          const daysArr = row.Thu ? row.Thu.toString().split(',') : [];
          const shiftsArr = row.Ca ? row.Ca.toString().split(',') : [];
          const schedules = [];

          daysArr.forEach((day, idx) => {
            const dId = day.trim();
            const sId = shiftsArr[idx] ? shiftsArr[idx].trim() : shiftsArr[0]?.trim() || 'S1';
            const dayObj = DAYS.find((d) => d.id === dId);
            const shiftObj = SHIFTS.find((s) => s.id === sId);
            if (dayObj && shiftObj) {
              schedules.push({
                dayId: dId,
                dayLabel: dayObj.label,
                shiftId: sId,
                shiftLabel: shiftObj.label,
              });
            }
          });

          const parseNumeric = (value, fallback = 0) => {
            const normalized = String(value || '').replace(/[^0-9-]/g, '').trim();
            const parsed = parseInt(normalized, 10);
            return Number.isFinite(parsed) ? parsed : fallback;
          };

          const creditsValue = parseNumeric(row.TinChi, originalCourse?.credits ?? 0);
          const feeValue = parseNumeric(row.HocPhi, originalCourse?.fee ?? 0);

          if (checkConflict(nextRegs, teacherId, room, schedules)) continue;

          nextRegs.push({
            id: timestamp + index,
            department: row.Khoa || originalCourse?.department || 'N/A',
            courseId,
            courseName: row.TenHP || originalCourse?.name || 'N/A',
            credits: creditsValue,
            fee: feeValue,
            studyStart: formatExcelDate(row.NgayBatDauHoc),
            studyEnd: formatExcelDate(row.NgayKetThucHoc),
            start: formatExcelDateTime(row.BatDauDK),
            end: formatExcelDateTime(row.KetThucDK),
            teacher: row.GiangVien || 'Chưa phân công',
            teacherId,
            room,
            schedules,
            status: 'Đang mở',
          });
          count += 1;
        }

        // Optimistic update: update state immediately
        lastOptimisticUpdateRef.current = Date.now();
        setRegistrations(nextRegs);
        let msg = `Đã import thành công ${count} lớp học phần!`;
        if (skippedCount > 0) msg += ` (Bỏ qua ${skippedCount} học phần trùng lặp)`;
        Swal.fire('Hoàn tất', msg, 'success');
        setSaving(true);
        
        // Save to API in background
        saveOpenRegistrations(nextRegs, { forceWipe: nextRegs.length === 0 })
          .catch((err) => {
            console.error(err);
            setRegistrations(registrations); // Rollback on error
            Swal.fire('Lỗi', 'Không lưu được dữ liệu import lên API.', 'error');
          })
          .finally(() => {
            setSaving(false);
          });
      } catch {
        Swal.fire('Lỗi', 'Dữ liệu file Excel không hợp lệ!', 'error');
      } finally {
        setSaving(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDownloadTemplate = () => {
    try {
      const sampleCourse = courses[0];
      const sampleCourse2 = courses[1] || sampleCourse;
      const sampleTeacher = teachers[0];
      const sampleTeacher2 = teachers[1] || sampleTeacher;

      const templateRows = [
        {
          MaHP: sampleCourse?.id || 'IT101',
          TenHP: sampleCourse?.name || 'Lập trình căn bản',
          Khoa: sampleCourse?.department || departments[0]?.name || 'Công nghệ thông tin',
          TinChi: sampleCourse?.credits || 3,
          HocPhi: sampleCourse?.fee || 1500000,
          GiangVien: sampleTeacher?.name || sampleTeacher?.hoTen || 'ThS. Nguyễn Văn A',
          MaGV: sampleTeacher?.id != null ? sampleTeacher.id : 101,
          Phong: 'A101',
          Thu: '2,4',
          Ca: 'S1,S1',
          NgayBatDauHoc: '2026-09-01',
          NgayKetThucHoc: '2026-12-15',
          BatDauDK: '2026-08-15 08:00',
          KetThucDK: '2026-08-30 23:59',
        },
        {
          MaHP: sampleCourse2?.id || 'IT102',
          TenHP: sampleCourse2?.name || 'Cơ sở dữ liệu',
          Khoa: sampleCourse2?.department || departments[0]?.name || 'Công nghệ thông tin',
          TinChi: sampleCourse2?.credits || 4,
          HocPhi: sampleCourse2?.fee || 2000000,
          GiangVien: sampleTeacher2?.name || sampleTeacher2?.hoTen || 'TS. Trần Thị B',
          MaGV: sampleTeacher2?.id != null ? sampleTeacher2.id : 102,
          Phong: 'B202',
          Thu: '3,5',
          Ca: 'S2,S2',
          NgayBatDauHoc: '2026-09-01',
          NgayKetThucHoc: '2026-12-15',
          BatDauDK: '2026-08-15 08:00',
          KetThucDK: '2026-08-30 23:59',
        },
      ];

      const courseRefRows = (courses || []).map((c, idx) => ({
        STT: idx + 1,
        'Mã HP (Cột MaHP)': c.id,
        'Tên HP': c.name,
        'Khoa': c.department,
        'Tín chỉ': c.credits,
        'Học phí': c.fee,
      }));

      const teacherRefRows = (teachers || []).map((t, idx) => ({
        STT: idx + 1,
        'Mã GV (Cột MaGV)': t.id,
        'Họ tên Giảng viên': t.name || t.hoTen,
        'Khoa': t.department,
      }));

      const guideRows = [
        { 'Cột dữ liệu': 'MaHP', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Phải chọn đúng Mã HP trong Sheet "DanhMucHocPhan_CSDL"' },
        { 'Cột dữ liệu': 'MaGV', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Phải chọn đúng Mã GV trong Sheet "DanhMucGiangVien_CSDL"' },
        { 'Cột dữ liệu': 'Thu', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Thứ học: 2, 3, 4, 5, 6, 7 (ví dụ: 2,4)' },
        { 'Cột dữ liệu': 'Ca', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Mã ca học: S1 (7h-9h30), S2 (9h45-12h15), S3 (13h-15h30)...' },
        { 'Cột dữ liệu': 'Phong', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Mã phòng học (A101, B202, LAB-01)' },
        { 'Cột dữ liệu': 'NgayBatDauHoc / NgayKetThucHoc', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Định dạng YYYY-MM-DD' },
        { 'Cột dữ liệu': 'BatDauDK / KetThucDK', 'Bắt buộc': 'Bắt buộc', 'Quy tắc': 'Định dạng YYYY-MM-DD HH:mm' },
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(templateRows), 'BieuMau_LopHocPhan');
      if (courseRefRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(courseRefRows), 'DanhMucHocPhan_CSDL');
      if (teacherRefRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teacherRefRows), 'DanhMucGiangVien_CSDL');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(guideRows), 'HuongDan_NhapLieu');

      XLSX.writeFile(wb, 'bieu-mau-mo-lop-hoc-phan.xlsx');
      Swal.fire('Thành công', 'Đã tải xuống biểu mẫu Excel kèm dữ liệu học phần và giảng viên từ CSDL!', 'success');
    } catch {
      Swal.fire('Lỗi', 'Không tạo được file biểu mẫu Excel.', 'error');
    }
  };

  const viewDetail = (id) => {
    const reg = registrations.find((r) => String(r.id) === String(id));
    if (reg) {
      setDetailReg(reg);
      setShowDetailModal(true);
    }
  };

  const viewStudentList = (courseOrReg) => {
    const reg = typeof courseOrReg === 'object' && courseOrReg !== null
      ? courseOrReg
      : registrations.find((r) => String(r.id) === String(courseOrReg) || String(r.courseId) === String(courseOrReg));
    setStudentListCourse({
      courseId: reg?.courseId || courseOrReg,
      courseName: reg?.courseName,
      regId: reg?.id,
    });
    setShowStudentListModal(true);
  };

  const signedUpForCourse = useMemo(() => {
    if (!studentListCourse) return [];
    return enrollments.filter((sr) => {
      if (studentListCourse.regId && String(sr.regId) === String(studentListCourse.regId)) {
        return true;
      }
      if (!sr.regId && studentListCourse.courseId) {
        if (sr.courseId && String(sr.courseId).toUpperCase() === String(studentListCourse.courseId).toUpperCase()) return true;
        if (sr.courseRef && typeof sr.courseRef === 'object' && sr.courseRef.id && String(sr.courseRef.id).toUpperCase() === String(studentListCourse.courseId).toUpperCase()) return true;
      }
      return false;
    });
  }, [enrollments, studentListCourse]);

  const confirmDeleteReg = (id) => {
    setIdToDelete(id);
    setShowConfirmModal(true);
    setTimeout(() => setConfirmAnimating(true), 10);
  };

  const closeConfirmModal = () => {
    setConfirmAnimating(false);
    setTimeout(() => {
      setShowConfirmModal(false);
      setIdToDelete(null);
    }, 200);
  };

  const executeDelete = () => {
    if (idToDelete == null) return;
    
    const updated = registrations.filter((r) => String(r.id) !== String(idToDelete));
    
    // Optimistic update: update state immediately
    lastOptimisticUpdateRef.current = Date.now();
    setRegistrations(updated);
    closeConfirmModal();
    setSaving(true);
    
    // Save to API in background
    saveOpenRegistrations(updated, { forceWipe: updated.length === 0 })
      .catch((err) => {
        console.error(err);
        setRegistrations(registrations); // Rollback on error
        Swal.fire('Lỗi', 'Không xóa được trên API.', 'error');
      })
      .finally(() => {
        setSaving(false);
      });
  };

  const selectedCoursesLabel =
    selectedCourses.length > 0 ? selectedCourses.map((c) => c.name).join(', ') : 'Chưa chọn học phần nào...';

  return (
    <PDLayout>
      <style>{`
        .day-checkbox:checked + .day-label-span { background-color: #4f46e5; color: white; border-color: #4f46e5; }
        .status-active { background-color: #dcfce7; color: #166534; }
        .status-expired { background-color: #fee2e2; color: #991b1b; }
        .custom-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 10px; }
        .student-table th { background-color: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 15px; border-bottom: 2px solid #e2e8f0; }
        .student-table td { padding: 12px 15px; border-bottom: 1px solid #f1f5f9; }
      `}</style>

      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
          <h2 className="text-2xl font-bold text-gray-800">Quản lý Đợt Đăng Ký Học Phần</h2>
          <p className="text-sm text-gray-500">Thiết lập thời gian và lịch học chi tiết cho sinh viên</p>
        </div>
        <PageActions
          importRef={importRef}
          handleImportExcel={handleImportExcel}
          handleDownloadTemplate={handleDownloadTemplate}
          openRegModal={openRegModal}
        />
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative col-span-1 md:col-span-1">
          <i className="fas fa-search absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Tìm tên, mã học phần..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={filterDept}
          onChange={(e) => setFilterDept(e.target.value)}
          className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả Khoa</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Tất cả Trạng thái</option>
          <option value="Đang mở">Đang mở</option>
          <option value="Hết hạn/Chưa mở">Hết hạn/Chưa mở</option>
        </select>
        <div className="flex items-center gap-2 col-span-1 md:col-span-2">
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50 font-medium text-gray-700"
          >
            <option value="default">Mặc định (Mới nhất)</option>
            <option value="name-asc">Tên học phần (A-Z)</option>
            <option value="name-desc">Tên học phần (Z-A)</option>
            <option value="code-asc">Mã học phần (Tăng dần)</option>
            <option value="credits-desc">Số tín chỉ (Cao - Thấp)</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-gray-50 text-gray-400 text-[11px] uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Khoa</th>
                <th className="px-6 py-4 whitespace-nowrap">Mã HP</th>
                <th className="px-6 py-4 whitespace-nowrap min-w-[250px]">Tên Học phần</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Số TC</th>
                <th className="px-6 py-4 whitespace-nowrap">Học phí</th>
                <th className="px-6 py-4 whitespace-nowrap">Thời gian ĐK</th>
                <th className="px-6 py-4 text-center whitespace-nowrap">Trạng thái</th>
                <th className="px-6 py-4 text-center whitespace-nowrap sticky right-0 bg-gray-50 shadow-[-5px_0px_10px_rgba(0,0,0,0.02)]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                    Không có đợt đăng ký nào.
                  </td>
                </tr>
              ) : (
                filteredRows.map((reg) => {
                  const expired = isRegistrationExpired(reg);
                  return (
                    <tr key={reg.id} className="hover:bg-gray-50 transition">
                      <td className="px-6 py-4 font-semibold text-gray-600">{reg.department}</td>
                      <td className="px-6 py-4 font-mono font-bold text-indigo-600">{reg.courseId}</td>
                      <td className="px-6 py-4 font-bold text-gray-800">{reg.courseName}</td>
                      <td className="px-6 py-4 text-center">{reg.credits}</td>
                      <td className="px-6 py-4 font-bold text-emerald-600">
                        {new Intl.NumberFormat('vi-VN').format(reg.fee)}đ
                      </td>
                      <td className="px-6 py-4 text-[11px]">
                        <RegTimeCell reg={reg} formatStudyDate={formatStudyDate} />
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${expired ? 'status-expired' : 'status-active'}`}>
                          {expired ? 'Hết hạn/Chưa mở' : 'Đang mở'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center sticky right-0 bg-white shadow-[-5px_0px_10px_rgba(0,0,0,0.02)]">
                        <div className="flex items-center justify-center gap-2">
                          <button type="button" onClick={() => viewDetail(reg.id)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Xem lịch học">
                            <i className="fas fa-eye" />
                          </button>
                          <button type="button" onClick={() => viewStudentList(reg)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="Xem sinh viên đăng ký">
                            <i className="fas fa-users" />
                          </button>
                          <button type="button" onClick={() => confirmDeleteReg(reg.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg">
                            <i className="fas fa-trash" />
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
      </div>

      <CourseRegModals
        saving={saving}
        showRegModal={showRegModal}
        closeRegModal={closeRegModal}
        regDept={regDept}
        syncDataByDept={syncDataByDept}
        departments={departments}
        selectedCoursesLabel={selectedCoursesLabel}
        openCourseListModal={openCourseListModal}
        studyStartDate={studyStartDate}
        setStudyStartDate={setStudyStartDate}
        studyEndDate={studyEndDate}
        setStudyEndDate={setStudyEndDate}
        regStartDate={regStartDate}
        setRegStartDate={setRegStartDate}
        regEndDate={regEndDate}
        setRegEndDate={setRegEndDate}
        today={today}
        nowLocal={nowLocal}
        selectedCourses={selectedCourses}
        scheduleConfigs={scheduleConfigs}
        deptTeachers={deptTeachers}
        updateScheduleConfig={updateScheduleConfig}
        toggleDay={toggleDay}
        setDayShift={setDayShift}
        validateAndSubmit={validateAndSubmit}
        showCourseListModal={showCourseListModal}
        setShowCourseListModal={setShowCourseListModal}
        courseChecklist={courseChecklist}
        setCourseChecklist={setCourseChecklist}
        confirmCourseSelection={confirmCourseSelection}
        showDetailModal={showDetailModal}
        setShowDetailModal={setShowDetailModal}
        detailReg={detailReg}
        formatDetailDate={formatDetailDate}
        showStudentListModal={showStudentListModal}
        setShowStudentListModal={setShowStudentListModal}
        studentListCourse={studentListCourse}
        signedUpForCourse={signedUpForCourse}
        students={students}
        showConfirmModal={showConfirmModal}
        confirmAnimating={confirmAnimating}
        closeConfirmModal={closeConfirmModal}
        executeDelete={executeDelete}
      />
    </PDLayout>
  );
}

function PageActions({ importRef, handleImportExcel, handleDownloadTemplate, openRegModal }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <input type="file" ref={importRef} accept=".xlsx, .xls" className="hidden" onChange={handleImportExcel} />
      <button
        type="button"
        onClick={handleDownloadTemplate}
        className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 shadow-xs flex items-center gap-2 text-xs font-semibold transition active:scale-95 cursor-pointer"
        title="Tải biểu mẫu Excel mở lớp kèm danh mục môn học và giảng viên từ CSDL"
      >
        <i className="fas fa-file-excel text-emerald-600 text-sm" />
        <span>Biểu mẫu</span>
      </button>
      <button
        type="button"
        onClick={() => importRef.current?.click()}
        className="bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 shadow-xs flex items-center gap-2 text-xs font-semibold transition active:scale-95 cursor-pointer"
      >
        <i className="fas fa-file-import text-sm" />
        <span>Import Excel</span>
      </button>
      <button
        type="button"
        onClick={openRegModal}
        className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 shadow-xs flex items-center gap-2 text-xs font-semibold transition active:scale-95 cursor-pointer"
      >
        <i className="fas fa-calendar-plus text-sm" />
        <span>Mở lớp học phần mới</span>
      </button>
    </div>
  );
}

function RegTimeCell({ reg, formatStudyDate }) {
  return (
    <>
      <div className="text-blue-600 font-bold">
        Lịch học: {formatStudyDate(reg.studyStart)} - {formatStudyDate(reg.studyEnd)}
      </div>
      <div className="text-gray-400 mt-1 italic">
        Đăng ký: {reg.start?.replace('T', ' ')} → {reg.end?.replace('T', ' ')}
      </div>
    </>
  );
}

export default ManageCourseRegistrations;
