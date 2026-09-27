// ====== HƯỚNG DẪN SỬ DỤNG API SERVICE ======

/**
 * 1. CẤU TRÚC API SERVICE
 * 
 * src/services/
 *   ├── api.js              (API client - kết nối với server)
 *   ├── teacherAPI.js       (Teacher service - quản lý localStorage)
 *   ├── studentAPI.js       (Student service - sẽ tạo)
 *   └── departmentAPI.js    (Department service - sẽ tạo)
 */

// ====== 2. CÁC DÙNG API.JS (KẾT NỐI SERVER) ======

import apiClient from './services/api';

// Lấy tất cả dữ liệu auth
async function loadAuthData() {
  try {
    const data = await apiClient.getAuthData();
    // data = { users: [], teachersData: [], studentsData: [] }
  } catch (error) {
    console.error('Error:', error);
  }
}

// Lấy riêng danh sách giáo viên từ server
async function loadTeachersFromServer() {
  try {
    const teachers = await apiClient.getTeachers();
    // Sử dụng teachers...
  } catch (error) {
    console.error('Error:', error);
  }
}

// Lấy danh sách sinh viên từ server
async function loadStudentsFromServer() {
  try {
    const students = await apiClient.getStudents();
    // Sử dụng students...
  } catch (error) {
    console.error('Error:', error);
  }
}

// ====== 3. CÁC DÙNG TEACHERAPI.JS (QUẢN LÝ LOCALSTORAGE) ======

import teacherAPI from './services/teacherAPI';

// Lấy tất cả giáo viên từ localStorage
const allTeachers = teacherAPI.getAllTeachers();

// Thêm giáo viên mới
teacherAPI.addTeacher({
  gvMa: 'GV-001',
  hoTen: 'Nguyễn Văn A',
  email: 'nguyenvana@example.com',
  // ... các trường khác
});

// Cập nhật giáo viên
teacherAPI.updateTeacher(teacherId, {
  hoTen: 'Nguyễn Văn B',
  email: 'nguyenvanb@example.com'
});

// Xóa giáo viên
teacherAPI.deleteTeacher(teacherId);

// Khóa tài khoản
teacherAPI.lockTeacher(teacherId, 'Vi phạm quy định');

// Mở khóa tài khoản
teacherAPI.unlockTeacher(teacherId);

// Import từ Excel
teacherAPI.importTeachers(arrayOfTeachers);

// Export dữ liệu
const exportData = teacherAPI.exportTeachers();

// ====== 4. MẪU COMPONENT SỬ DỤNG API ======

import React, { useState, useEffect } from 'react';
import apiClient from '../services/api';
import teacherAPI from '../services/teacherAPI';

function MyComponent() {
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Thử lấy từ server trước
        const serverTeachers = await apiClient.getTeachers();
        if (serverTeachers?.length > 0) {
          setTeachers(serverTeachers);
        } else {
          // Fallback: lấy từ localStorage
          const localTeachers = teacherAPI.getAllTeachers();
          setTeachers(localTeachers);
        }
      } catch (error) {
        console.warn('Error from server, using localStorage:', error);
        const localTeachers = teacherAPI.getAllTeachers();
        setTeachers(localTeachers);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleAddTeacher = (formData) => {
    const newTeacher = teacherAPI.addTeacher(formData);
    setTeachers([...teachers, newTeacher]);
  };

  if (loading) return <div>Đang tải...</div>;

  return (
    <div>
      {teachers.map(t => (
        <div key={t.id}>{t.hoTen}</div>
      ))}
    </div>
  );
}

export default MyComponent;

// ====== 5. QUY TẮC THIẾT KẾ ======

/**
 * API Server (api.js):
 * - Dùng cho dữ liệu chính từ server
 * - Read-only (chỉ lấy dữ liệu)
 * - Hỗ trợ fallback khi không có dữ liệu
 * 
 * LocalStorage Service (teacherAPI.js, studentAPI.js, ...):
 * - Dùng cho dữ liệu cục bộ
 * - Hỗ trợ CRUD (Create, Read, Update, Delete)
 * - Có thể sync với server nếu cần
 * 
 * Component:
 * - Load từ server trước
 * - Fallback sang localStorage
 * - Cập nhật chỉ lưu vào localStorage (cho đến khi có API POST)
 */

// ====== 6. DANH SÁCH API SERVICES CẦN TẠO ======

/**
 * ✅ api.js - HOÀN TẤT
 *    - getAuthData()
 *    - getTeachers()
 *    - getStudents()
 *    - getUsers()
 * 
 * ✅ teacherAPI.js - HOÀN TẤT
 *    - getAllTeachers()
 *    - getTeacherById()
 *    - addTeacher()
 *    - updateTeacher()
 *    - deleteTeacher()
 *    - importTeachers()
 *    - exportTeachers()
 *    - lockTeacher()
 *    - unlockTeacher()
 * 
 * ⏳ studentAPI.js - CẦN TẠO
 *    - (Tương tự teacherAPI)
 * 
 * ⏳ departmentAPI.js - CẦN TẠO
 *    - (Quản lý khoa)
 * 
 * ⏳ courseAPI.js - CẦN TẠO
 *    - (Quản lý học phần)
 * 
 * ⏳ accountAPI.js - CẦN TẠO
 *    - (Quản lý tài khoản)
 */
