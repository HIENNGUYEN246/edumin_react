import mongoose from 'mongoose';

const { Schema } = mongoose;

const courseSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    credits: { type: Number, default: 0, min: 0 },
    fee: { type: Number, default: 0, min: 0 },
    department: { type: String, default: '' },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    courseType: { type: String, enum: ['LT', 'TH', 'LT_TH'], default: 'LT_TH' },
    theoryPeriods: { type: Number, default: 0, min: 0 },
    practicePeriods: { type: Number, default: 0, min: 0 },
    prerequisites: { type: String, default: '' },
    description: { type: String, default: '' },
    gradeWeights: {
      attendance: { type: Number, default: 10, min: 0, max: 100 },
      homework: { type: Number, default: 10, min: 0, max: 100 },
      midterm: { type: Number, default: 30, min: 0, max: 100 },
      presentation: { type: Number, default: 0, min: 0, max: 100 },
      final: { type: Number, default: 50, min: 0, max: 100 },
    },
  },
  { timestamps: true }
);

export const Course = mongoose.model('Course', courseSchema, 'courses');
export default Course;
