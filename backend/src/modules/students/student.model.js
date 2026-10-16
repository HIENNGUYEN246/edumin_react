import mongoose from 'mongoose';
import { fileMetaSchema } from '../shared/avatar.schema.js';

const { Schema } = mongoose;

const studentSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    id: { type: Number, required: true, unique: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    hoTen: { type: String, default: '' },
    dob: { type: String, default: '' },
    gender: { type: String, enum: ['Nam', 'Nữ', 'Khác'], default: 'Nam' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    education: { type: String, default: 'Chính quy' },
    className: { type: String, trim: true, default: '' },
    department: { type: String, default: '' },
    departmentRef: { type: Schema.Types.ObjectId, ref: 'Department', default: null },
    avatar: { type: fileMetaSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const Student = mongoose.model('Student', studentSchema, 'students');
export default Student;
