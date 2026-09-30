import mongoose from 'mongoose';

const { Schema } = mongoose;

const scheduleSlotSchema = new Schema(
  {
    dayId: { type: String, required: true },
    shiftId: { type: String, required: true },
  },
  { _id: false }
);

const courseClassSchema = new Schema(
  {
    // Human-facing class/registration code (e.g. "IT101-01").
    id: { type: String, required: true, unique: true, trim: true },
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    department: { type: String, default: '' },
    credits: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },

    teacherRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teacherId: { type: Number, default: null },
    teacher: { type: String, default: '' },

    room: { type: String, default: '' },
    schedules: { type: [scheduleSlotSchema], default: [] },

    // Study period (used for schedule-overlap checks).
    studyStart: { type: String, default: '' },
    studyEnd: { type: String, default: '' },
    // Registration window (used to gate enrollment).
    start: { type: String, default: '' },
    end: { type: String, default: '' },

    status: { type: String, enum: ['Đang mở', 'Đã đóng'], default: 'Đang mở' },
  },
  { timestamps: true }
);

export const CourseClass = mongoose.model('CourseClass', courseClassSchema, 'courseclasses');
export default CourseClass;
