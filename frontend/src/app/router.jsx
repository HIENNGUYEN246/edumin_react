import { lazy } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { RequireRole } from './RequireRole.jsx';
import { ROLES } from './navConfig.js';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { LoginPage } from '../features/auth/LoginPage.jsx';

function DiemDanhRedirect() {
  const { classId, id } = useParams();
  const targetId = classId || id;
  return <Navigate to={targetId ? `/teacher/attendance?classId=${encodeURIComponent(targetId)}` : '/teacher/attendance'} replace />;
}

// Feature pages are code-split so each route loads on demand.
const AdminDashboard = lazy(() => import('../features/admin/AdminDashboard.jsx'));
const ManageDepartments = lazy(() => import('../features/admin/departments/ManageDepartments.jsx'));
const ManageTeachers = lazy(() => import('../features/admin/teachers/ManageTeachers.jsx'));
const ManageStudents = lazy(() => import('../features/admin/students/ManageStudents.jsx'));
const ManageTeacherAccounts = lazy(() => import('../features/admin/accounts/ManageTeacherAccounts.jsx'));
const ManageStudentAccounts = lazy(() => import('../features/admin/accounts/ManageStudentAccounts.jsx'));
const ManageCourses = lazy(() => import('../features/admin/courses/ManageCourses.jsx'));
const CourseDetail = lazy(() => import('../features/admin/courses/CourseDetail.jsx'));
const ManageClasses = lazy(() => import('../features/admin/classes/ManageClasses.jsx'));
const ClassStudentsPage = lazy(() => import('../features/admin/classes/ClassStudentsPage.jsx'));
const ManageGradebook = lazy(() => import('../features/admin/grades/ManageGradebook.jsx'));
const ManageFeedbacks = lazy(() => import('../features/admin/feedback/ManageFeedbacks.jsx'));
const ManageProfileRequests = lazy(() => import('../features/admin/requests/ManageProfileRequests.jsx'));
const TeacherDashboard = lazy(() => import('../features/teacher/TeacherDashboard.jsx'));
const TeacherSchedule = lazy(() => import('../features/teacher/TeacherSchedule.jsx'));
const TeacherClassList = lazy(() => import('../features/teacher/TeacherClassList.jsx'));
const TeacherClassGradebook = lazy(() => import('../features/teacher/TeacherClassGradebook.jsx'));
const TeacherClassStudents = lazy(() => import('../features/teacher/TeacherClassStudents.jsx'));
const TeacherAttendance = lazy(() => import('../features/teacher/attendance/TeacherAttendance.jsx'));
const TeacherDocumentList = lazy(() => import('../features/teacher/TeacherDocumentList.jsx'));
const TeacherAssignmentList = lazy(() => import('../features/teacher/assignments/TeacherAssignmentList.jsx'));
const StudentDashboard = lazy(() => import('../features/student/StudentDashboard.jsx'));
const StudentCourseRegistration = lazy(() => import('../features/student/StudentCourseRegistration.jsx'));
const StudentTimetable = lazy(() => import('../features/student/StudentTimetable.jsx'));
const StudentAttendance = lazy(() => import('../features/student/attendance/StudentAttendance.jsx'));
const StudentDocumentList = lazy(() => import('../features/student/StudentDocumentList.jsx'));
const StudentAssignmentList = lazy(() => import('../features/student/assignments/StudentAssignmentList.jsx'));
const StudentQuizPage = lazy(() => import('../features/student/assignments/StudentQuizPage.jsx'));

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <RequireRole role={ROLES.ADMIN}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/teachers" element={<ManageTeachers />} />
        <Route path="/admin/teacher-accounts" element={<ManageTeacherAccounts />} />
        <Route path="/admin/students" element={<ManageStudents />} />
        <Route path="/admin/student-accounts" element={<ManageStudentAccounts />} />
        <Route path="/admin/departments" element={<ManageDepartments />} />
        <Route path="/admin/courses" element={<ManageCourses />} />
        <Route path="/admin/courses/:id" element={<Navigate to="/admin/courses" replace />} />
        <Route path="/admin/classes" element={<ManageClasses />} />
        <Route path="/admin/classes/course/:id" element={<CourseDetail />} />
        <Route path="/admin/classes/course/:courseId/class/:classId/students" element={<ClassStudentsPage />} />
        <Route path="/admin/gradebook" element={<ManageGradebook />} />
        <Route path="/admin/feedbacks" element={<ManageFeedbacks />} />
        <Route path="/admin/profile-requests" element={<ManageProfileRequests />} />
      </Route>

      <Route
        element={
          <RequireRole role={ROLES.TEACHER}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route path="/teacher" element={<TeacherDashboard />} />
        <Route path="/teacher/schedule" element={<TeacherSchedule />} />
        <Route path="/teacher/classes" element={<TeacherClassList />} />
        <Route path="/teacher/classes/:id/students" element={<TeacherClassStudents />} />
        <Route path="/teacher/classes/:id/grades" element={<TeacherClassGradebook />} />
        <Route path="/teacher/classes/:id/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/attendance/:classId" element={<TeacherAttendance />} />
        <Route path="/teacher/documents" element={<TeacherDocumentList />} />
        <Route path="/teacher/assignments" element={<TeacherAssignmentList />} />
      </Route>

      <Route
        element={
          <RequireRole role={ROLES.STUDENT}>
            <AppLayout />
          </RequireRole>
        }
      >
        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/course-registration" element={<StudentCourseRegistration />} />
        <Route path="/student/timetable" element={<StudentTimetable />} />
        <Route path="/student/attendance" element={<StudentAttendance />} />
        <Route path="/student/documents" element={<StudentDocumentList />} />
        <Route path="/student/assignments" element={<StudentAssignmentList />} />
        <Route path="/student/assignments/:id" element={<StudentQuizPage />} />
      </Route>

      {/* Legacy and deprecated route redirects */}
      <Route path="/sv/documents" element={<Navigate to="/student/documents" replace />} />
      <Route path="/sv/assignments" element={<Navigate to="/student/assignments" replace />} />
      <Route path="/sv/course-registration" element={<Navigate to="/student/course-registration" replace />} />
      <Route path="/sv/timetable" element={<Navigate to="/student/timetable" replace />} />
      <Route path="/sv-dashboard" element={<Navigate to="/student" replace />} />
      <Route path="/gv/documents" element={<Navigate to="/teacher/documents" replace />} />
      <Route path="/gv/assignments" element={<Navigate to="/teacher/assignments" replace />} />
      <Route path="/gv/classes" element={<Navigate to="/teacher/classes" replace />} />
      <Route path="/gv/schedule" element={<Navigate to="/teacher/schedule" replace />} />
      <Route path="/gv-dashboard" element={<Navigate to="/teacher" replace />} />
      <Route path="/pdt-dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/pdt/manage-teachers" element={<Navigate to="/admin/teachers" replace />} />
      <Route path="/pdt/teacher-accounts" element={<Navigate to="/admin/teacher-accounts" replace />} />
      <Route path="/pdt/manage-students" element={<Navigate to="/admin/students" replace />} />
      <Route path="/pdt/student-accounts" element={<Navigate to="/admin/student-accounts" replace />} />
      <Route path="/pdt/manage-departments" element={<Navigate to="/admin/departments" replace />} />
      <Route path="/pdt/manage-courses" element={<Navigate to="/admin/courses" replace />} />
      <Route path="/pdt/course-registrations" element={<Navigate to="/admin/courses" replace />} />
      <Route path="/admin/attendance" element={<Navigate to="/teacher/attendance" replace />} />
      <Route path="/admin/tuition" element={<Navigate to="/admin" replace />} />
      <Route path="/accountant/*" element={<Navigate to="/admin" replace />} />
      <Route path="/accountant" element={<Navigate to="/admin" replace />} />
      <Route path="/student/tuition" element={<Navigate to="/student" replace />} />
      <Route path="/pdt/manage-attendance" element={<Navigate to="/teacher/attendance" replace />} />
      <Route path="/pdt/manage-feedbacks" element={<Navigate to="/admin/feedbacks" replace />} />
      <Route path="/gv/attendance" element={<Navigate to="/teacher/attendance" replace />} />
      <Route path="/diem-danh/:classId" element={<DiemDanhRedirect />} />
      <Route path="/diem-danh" element={<Navigate to="/teacher/attendance" replace />} />
      <Route path="/sv/attendance" element={<Navigate to="/student/attendance" replace />} />
      <Route path="/sv/feedback" element={<Navigate to="/student" replace />} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default AppRouter;
