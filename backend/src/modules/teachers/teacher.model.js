import mongoose from 'mongoose';
import { fileMetaSchema } from '../shared/avatar.schema.js';

const { Schema } = mongoose;

const teacherSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    // Numeric code shown as GV-00x on the client.
    id: { type: Number, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    hoTen: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, enum: ['Nam', 'Nữ', 'Khác'], default: 'Nam' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    education: { type: String, default: '' },
    department: { type: String, default: '' },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    avatar: { type: fileMetaSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Teacher = mongoose.model('Teacher', teacherSchema, 'teachers');
export default Teacher;
