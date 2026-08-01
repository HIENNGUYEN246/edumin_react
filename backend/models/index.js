import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, default: '123' },
    role: { type: String, default: 'dao-tao', enum: ['dao-tao', 'giao-vien', 'sinh-vien'] },
    hoTen: { type: String, default: '' },
    status: { type: String, default: 'Active' },
    lockReason: { type: String, default: '' },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
  },
  { timestamps: true }
);

const teacherSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: Number, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    hoTen: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, default: 'Nam' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    education: { type: String, default: '' },
    department: { type: String, default: '' },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    avatar: { type: String, default: '' },
  },
  { timestamps: true }
);

const studentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    id: { type: Number, required: true, unique: true },
    email: { type: String, trim: true, lowercase: true, required: true },
    hoTen: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, default: 'Nam' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    education: { type: String, default: '' },
    department: { type: String, default: '' },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    avatar: { type: String, default: '' },
  },
  { timestamps: true }
);

const emptyAsNull = (value) => (value === '' ? null : value);

const departmentSchema = new Schema(
  {
    id: { type: String, trim: true, required: true, unique: true },
    name: { type: String, trim: true, required: true },
    head: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      set: emptyAsNull,
    },
  },
  { timestamps: true }
);



const courseSchema = new Schema(
  {
    id: { type: String, trim: true, required: true, unique: true },
    name: { type: String, trim: true, default: '' },
    credits: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    deptId: { type: String, trim: true, default: '' },
    deptRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null, set: emptyAsNull },
    department: { type: String, trim: true, default: '' },
    classId: { type: String, trim: true, default: '' },
    className: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const openRegistrationSchema = new Schema(
  {
    id: { type: String, trim: true, default: '' },
    courseId: { type: String, default: '' },
    courseRef: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
      set: emptyAsNull,
    },
    courseName: { type: String, default: '' },
    department: { type: String, default: '' },
    credits: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    studyStart: { type: String, default: '' },
    studyEnd: { type: String, default: '' },
    start: { type: String, default: '' },
    end: { type: String, default: '' },
    schedules: { type: Array, default: [] },
    teacherId: { type: Number, default: null },
    teacherRef: {
      type: Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
      set: emptyAsNull,
    },
    teacher: { type: String, default: '' },
    status: { type: String, default: 'Đang mở' },
    room: { type: String, default: '' },
  },
  { timestamps: true }
);

const studentRegistrationSchema = new Schema(
  {
    regId: { type: String, required: true },
    studentRef: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      set: emptyAsNull,
    },
    courseRef: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      set: emptyAsNull,
    },
  },
  { timestamps: true }
);

const assignmentSchema = new Schema(
  {
    id: { type: String, trim: true, default: '' },
    courseId: { type: String, default: '' },
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    name: { type: String, default: '' },
    content: { type: String, default: '' },
    created: { type: String, default: '' },
    size: { type: String, default: '' },
    status: { type: String, default: 'Công khai' },
    modifiedBy: { type: String, default: '' },
    modifiedByRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
  },
  { timestamps: true }
);

const documentSchema = new Schema(
  {
    id: { type: String, trim: true, default: '' },
    courseId: { type: String, default: '' },
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', default: null },
    name: { type: String, default: '' },
    content: { type: String, default: '' },
    created: { type: String, default: '' },
    size: { type: String, default: '' },
    status: { type: String, default: 'Công khai' },
    modifiedBy: { type: String, default: '' },
    modifiedByRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
  },
  { timestamps: true }
);

const User = mongoose.model('User', userSchema, 'users');
const Teacher = mongoose.model('Teacher', teacherSchema, 'teachers');
const Student = mongoose.model('Student', studentSchema, 'students');
const Department = mongoose.model('Department', departmentSchema, 'departments');
const Course = mongoose.model('Course', courseSchema, 'courses');
const OpenRegistration = mongoose.model('OpenRegistration', openRegistrationSchema, 'openregistrations');
const StudentRegistration = mongoose.model('StudentRegistration', studentRegistrationSchema, 'studentregistrations');
const Assignment = mongoose.model('Assignment', assignmentSchema, 'assignments');
const Document = mongoose.model('Document', documentSchema, 'documents');

export { User, Teacher, Student, Department, Course, OpenRegistration, StudentRegistration, Assignment, Document };
