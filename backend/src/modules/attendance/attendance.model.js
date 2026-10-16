import mongoose from 'mongoose';

const { Schema } = mongoose;

const attendanceSchema = new Schema(
  {
    id: {
      type: String,
      default: () => `ATT_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    },
    regId: { type: String, required: true },
    classRef: { type: Schema.Types.ObjectId, ref: 'CourseClass', default: null },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    studentId: { type: Number, required: true },
    studentRef: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, default: '' },
    studentEmail: { type: String, default: '' },
    studentAvatar: { type: String, default: '' },
    avatar: { type: String, default: '' },
    date: { type: String, required: true }, // YYYY-MM-DD
    shiftId: { type: String, default: '1' },
    shiftLabel: { type: String, default: '' },
    status: {
      type: String,
      enum: ['Có mặt', 'Đi muộn', 'Vắng mặt', 'Vắng có phép'],
      default: 'Có mặt',
    },
    checkInTime: { type: String, default: '' },
    checkedBy: { type: String, enum: ['student', 'teacher', 'admin'], default: 'student' },
    note: { type: String, default: '' },
    score: { type: Number, default: null },
    evaluation: { type: String, default: '' },
    teacherId: { type: Schema.Types.Mixed, default: null },
    teacherName: { type: String, default: '' },
    evaluatedAt: { type: String, default: '' },
    timestamp: { type: Number, default: Date.now },
  },
  { timestamps: true }
);

export const Attendance = mongoose.model('Attendance', attendanceSchema, 'attendances');
export default Attendance;

