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
    className: { type: String, default: '', trim: true },
    department: { type: String, default: '' },
    credits: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },

    teacherRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teacherId: { type: Number, default: null },
    teacher: { type: String, default: '' },

    room: { type: String, default: '' },
    schedules: { type: [scheduleSlotSchema], default: [] },
    // Maximum students. 0 = unlimited.
    capacity: { type: Number, default: 0, min: 0 },

    // Study period (used for schedule-overlap checks).
    studyStart: { type: String, default: '' },
    studyEnd: { type: String, default: '' },
    registrationStart: { type: String, default: '' },
    registrationEnd: { type: String, default: '' },

    // Grade weighting configuration in percentage (sum must equal 100%)
    gradeWeights: {
      attendance: { type: Number, default: 10, min: 0, max: 100 },
      homework: { type: Number, default: 10, min: 0, max: 100 },
      midterm: { type: Number, default: 30, min: 0, max: 100 },
      presentation: { type: Number, default: 0, min: 0, max: 100 },
      final: { type: Number, default: 50, min: 0, max: 100 },
    },

    // Lifecycle: Nháp (draft, hidden) -> Đang mở (open to students) ->
    // Đã đóng (registration closed) / Đã hủy (cancelled).
    status: {
      type: String,
      enum: ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'],
      default: 'Nháp',
    },
  },
  { timestamps: true }
);

export const CLASS_STATUSES = ['Nháp', 'Đang mở', 'Đã đóng', 'Đã hủy'];

export const CourseClass = mongoose.model('CourseClass', courseClassSchema, 'courseclasses');
export default CourseClass;
