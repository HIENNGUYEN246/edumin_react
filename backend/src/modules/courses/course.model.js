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
  },
  { timestamps: true }
);

export const Course = mongoose.model('Course', courseSchema, 'courses');
export default Course;
