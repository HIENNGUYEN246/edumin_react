import mongoose from 'mongoose';

const { Schema } = mongoose;

const enrollmentSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    classRef: { type: Schema.Types.ObjectId, ref: 'CourseClass', required: true },
    // Denormalized class code so enrollments stay meaningful even if a class is removed.
    classId: { type: String, required: true },
    manualGrades: {
      attendance: { type: Number, min: 0, max: 10, default: null },
      midterm: { type: Number, min: 0, max: 10, default: null },
      assignment: { type: Number, min: 0, max: 10, default: null },
      presentation: { type: Number, min: 0, max: 10, default: null },
      practical: { type: Number, min: 0, max: 10, default: null },
      final: { type: Number, min: 0, max: 10, default: null },
    },
  },
  { timestamps: true }
);

// A student can enroll in a given class at most once.
enrollmentSchema.index({ student: 1, classRef: 1 }, { unique: true });

export const Enrollment = mongoose.model('Enrollment', enrollmentSchema, 'enrollments');
export default Enrollment;
