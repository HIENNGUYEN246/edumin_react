import { Routes, Route, Navigate } from 'react-router-dom';
import LoginForm from './LoginForm';
import PDTDashboard from './PDTDashboard';
import SVPage from './SVPage';
import GVDashboard from './GVDashboard';
import ManageTeachers from './components/ManageTeachers';
import ManageTeacherAccounts from './components/ManageTeacherAccounts';
import ManageStudents from './components/ManageStudents';
import ManageStudentAccounts from './components/ManageStudentAccounts';
import ManageDepartments from './components/ManageDepartments';
import ManageCourses from './components/ManageCourses';
import ManageCourseRegistrations from './components/ManageCourseRegistrations';
import TeacherSchedule from './components/TeacherSchedule';
import TeacherClassList from './components/TeacherClassList';
import StudentCourseRegistration from './components/StudentCourseRegistration';
import StudentSchedule from './components/StudentSchedule';
import TeacherAssignmentList from './components/TeacherAssignmentList';
import StudentAssignmentList from './components/StudentAssignmentList';
import TeacherDocumentList from './components/TeacherDocumentList';
import StudentDocumentList from './components/StudentDocumentList';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginForm />} />
      <Route path="/pdt-dashboard" element={<ProtectedRoute requiredRole="dao-tao"><PDTDashboard /></ProtectedRoute>} />
      <Route path="/pdt/manage-teachers" element={<ProtectedRoute requiredRole="dao-tao"><ManageTeachers /></ProtectedRoute>} />
      <Route path="/pdt/teacher-accounts" element={<ProtectedRoute requiredRole="dao-tao"><ManageTeacherAccounts /></ProtectedRoute>} />
      <Route path="/pdt/manage-students" element={<ProtectedRoute requiredRole="dao-tao"><ManageStudents /></ProtectedRoute>} />
      <Route path="/pdt/student-accounts" element={<ProtectedRoute requiredRole="dao-tao"><ManageStudentAccounts /></ProtectedRoute>} />
      <Route path="/pdt/manage-departments" element={<ProtectedRoute requiredRole="dao-tao"><ManageDepartments /></ProtectedRoute>} />
      <Route path="/pdt/manage-courses" element={<ProtectedRoute requiredRole="dao-tao"><ManageCourses /></ProtectedRoute>} />
      <Route path="/pdt/course-registrations" element={<ProtectedRoute requiredRole="dao-tao"><ManageCourseRegistrations /></ProtectedRoute>} />
      <Route path="/gv-dashboard" element={<ProtectedRoute requiredRole="giao-vien"><GVDashboard /></ProtectedRoute>} />
      <Route path="/gv/schedule" element={<ProtectedRoute requiredRole="giao-vien"><TeacherSchedule /></ProtectedRoute>} />
      <Route path="/gv/classes" element={<ProtectedRoute requiredRole="giao-vien"><TeacherClassList /></ProtectedRoute>} />
      <Route path="/gv/assignments" element={<ProtectedRoute requiredRole="giao-vien"><TeacherAssignmentList /></ProtectedRoute>} />
      <Route path="/gv/documents" element={<ProtectedRoute requiredRole="giao-vien"><TeacherDocumentList /></ProtectedRoute>} />
      <Route path="/sv-dashboard" element={<ProtectedRoute requiredRole="sinh-vien"><SVPage /></ProtectedRoute>} />
      <Route path="/sv/assignments" element={<ProtectedRoute requiredRole="sinh-vien"><StudentAssignmentList /></ProtectedRoute>} />
      <Route path="/sv/documents" element={<ProtectedRoute requiredRole="sinh-vien"><StudentDocumentList /></ProtectedRoute>} />
      <Route path="/sv/course-registration" element={<ProtectedRoute requiredRole="sinh-vien"><StudentCourseRegistration /></ProtectedRoute>} />
      <Route path="/sv/timetable" element={<ProtectedRoute requiredRole="sinh-vien"><StudentSchedule /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
