import mongoose from 'mongoose';
import { fileMetaSchema } from '../shared/avatar.schema.js';

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseId: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    // Cloudinary metadata (type: authenticated). No base64 stored in Mongo.
    file: { type: fileMetaSchema, default: () => ({}) },
    link: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Công khai', 'Ẩn'], default: 'Công khai' },
    uploadedByRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    uploadedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

export const Document = mongoose.model('Document', documentSchema, 'documents');
export default Document;
