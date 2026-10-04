import mongoose from 'mongoose';

const { Schema } = mongoose;

const departmentSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    // Head of department; cleared to null when the referenced teacher is removed.
    head: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
  },
  { timestamps: true }
);

export const Department = mongoose.model('Department', departmentSchema, 'departments');
export default Department;
