import { describe, it, expect, beforeEach } from 'vitest';
import {
  sendEmail,
  sendAccountCreatedEmail,
  sendClassAssignedEmail,
  getSentEmails,
  clearSentEmails,
} from '../src/lib/mailer.js';
import { createTeacher } from '../src/modules/teachers/teacher.service.js';
import { createStudent } from '../src/modules/students/student.service.js';
import { createClass } from '../src/modules/classes/courseClass.service.js';
import { Course } from '../src/modules/courses/course.model.js';
import { Department } from '../src/modules/departments/department.model.js';
import { enroll } from '../src/modules/enrollments/enrollment.service.js';
import { todayDateString } from '../src/lib/dateOnly.js';

describe('Automatic Email Dispatcher (mailer.js)', () => {
  beforeEach(() => {
    clearSentEmails();
  });

  it('records low-level email dispatch into sent emails log', async () => {
    const res = await sendEmail({
      to: 'test@student.edu.vn',
      subject: 'Test Subject',
      text: 'Test message body',
    });

    expect(res.success).toBe(true);
    expect(res.messageId).toBeDefined();

    const sent = getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('test@student.edu.vn');
    expect(sent[0].subject).toBe('Test Subject');
    expect(sent[0].text).toBe('Test message body');
  });

  it('sends account creation email with login credentials and role', async () => {
    await sendAccountCreatedEmail({
      email: 'gv.nguyen@university.edu.vn',
      hoTen: 'Nguyễn Văn An',
      role: 'giao-vien',
      password: '123',
      id: 101,
    });

    const sent = getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('gv.nguyen@university.edu.vn');
    expect(sent[0].subject).toContain('[EduMin] Thông tin tài khoản mới');
    expect(sent[0].subject).toContain('Nguyễn Văn An');
    expect(sent[0].text).toContain('Giảng viên');
    expect(sent[0].text).toContain('gv.nguyen@university.edu.vn');
    expect(sent[0].text).toContain('123');
    expect(sent[0].text).toContain('101');
    expect(sent[0].html).toContain('Giảng viên');
  });

  it('sends class assigned email with course code and class section name', async () => {
    await sendClassAssignedEmail({
      email: 'gv.tran@university.edu.vn',
      hoTen: 'Trần Thị Bình',
      role: 'giao-vien',
      classId: 'IT101-01',
      className: '20DTH01 - Lập trình Web',
      courseId: 'IT101',
      courseName: 'Lập trình Web nâng cao',
      schedules: [{ dayId: '1', shiftId: '1' }],
      room: 'B203',
    });

    const sent = getSentEmails();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('gv.tran@university.edu.vn');
    expect(sent[0].subject).toContain('Phân công giảng dạy');
    expect(sent[0].subject).toContain('20DTH01 - Lập trình Web');
    expect(sent[0].text).toContain('IT101');
    expect(sent[0].text).toContain('Lập trình Web nâng cao');
    expect(sent[0].text).toContain('B203');
    expect(sent[0].html).toContain('IT101-01');
  });

  it('triggers account creation email when creating teacher and student profiles', async () => {
    const dept = await Department.create({ id: 1, name: 'Công nghệ thông tin' });

    await createTeacher({
      hoTen: 'Võ Minh Thầy',
      email: 'gv.vo@university.edu.vn',
      phone: '0901234567',
      dob: '1985-05-20',
      gender: 'Nam',
      education: 'Thạc sĩ',
      departmentId: dept.id,
      address: 'TP HCM',
      password: 'MyPassword!123',
    });

    await createStudent({
      hoTen: 'Lê Sinh Viên',
      email: 'sv.le@student.edu.vn',
      phone: '0912345678',
      dob: '2004-03-15',
      gender: 'Nữ',
      className: '22DTH01',
      education: 'Chính quy',
      departmentId: dept.id,
      address: 'Hà Nội',
    });

    const sent = getSentEmails();
    expect(sent.length).toBeGreaterThanOrEqual(2);

    const teacherMail = sent.find((m) => m.to === 'gv.vo@university.edu.vn');
    expect(teacherMail).toBeDefined();
    expect(teacherMail.text).toContain('Võ Minh Thầy');
    expect(teacherMail.text).toContain('MyPassword!123');

    const studentMail = sent.find((m) => m.to === 'sv.le@student.edu.vn');
    expect(studentMail).toBeDefined();
    expect(studentMail.text).toContain('Lê Sinh Viên');
    expect(studentMail.text).toContain('123'); // Default password
  });

  it('triggers class assigned email when teacher is assigned and student is enrolled', async () => {
    const dept = await Department.create({ id: 2, name: 'Khoa Ngoại Ngữ' });
    const teacher = await createTeacher({
      hoTen: 'Teacher English',
      email: 'eng.teacher@university.edu.vn',
      phone: '0988888888',
      dob: '1988-08-08',
      gender: 'Nữ',
      departmentId: dept.id,
      address: 'Đà Nẵng',
      education: 'Thạc sĩ',
    });

    const course = await Course.create({
      id: 'ENG101',
      name: 'Tiếng Anh Giao Tiếp 1',
      credits: 3,
      fee: 1500000,
      department: dept.name,
      departmentRef: dept._id,
    });

    // Clear emails before class creation
    clearSentEmails();

    const addDays = (d, days) => {
      const dt = new Date(`${d}T00:00:00.000Z`);
      dt.setUTCDate(dt.getUTCDate() + days);
      return dt.toISOString().slice(0, 10);
    };

    const regStart = todayDateString();
    const regEnd = addDays(regStart, 7);
    const studyStart = addDays(regEnd, 3);
    const studyEnd = addDays(studyStart, 110);

    const createdClass = await createClass({
      courseId: course.id,
      className: 'ENG101-01',
      teacherId: teacher.id,
      room: 'A101',
      capacity: 40,
      schedules: [{ dayId: '2', shiftId: 'S1' }],
      studyStart,
      studyEnd,
      registrationStart: regStart,
      registrationEnd: regEnd,
      status: 'Đang mở',
    });

    const afterClassCreated = getSentEmails();
    const teacherClassEmail = afterClassCreated.find((m) => m.to === 'eng.teacher@university.edu.vn');
    expect(teacherClassEmail).toBeDefined();
    expect(teacherClassEmail.subject).toContain('ENG101-01');
    expect(teacherClassEmail.text).toContain('ENG101');

    // Create student and test enrollment email trigger
    const studentUser = await createStudent({
      hoTen: 'Phạm Học Viên',
      email: 'sv.pham@student.edu.vn',
      phone: '0977777777',
      dob: '2004-01-01',
      gender: 'Nam',
      className: '22AV01',
      departmentId: dept.id,
      address: 'Đà Nẵng',
    });

    clearSentEmails();

    // Student user mock
    const userMock = {
      _id: studentUser.userId?._id || studentUser.userId,
      student: studentUser._id,
      role: 'sinh-vien',
    };

    await enroll(userMock, createdClass._id);

    const afterEnroll = getSentEmails();
    const studentEnrollMail = afterEnroll.find((m) => m.to === 'sv.pham@student.edu.vn');
    expect(studentEnrollMail).toBeDefined();
    expect(studentEnrollMail.subject).toContain('ENG101-01');
    expect(studentEnrollMail.text).toContain('Phạm Học Viên');
    expect(studentEnrollMail.text).toContain('Tiếng Anh Giao Tiếp 1');
  });
});
