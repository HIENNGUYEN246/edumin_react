import mongoose from 'mongoose';
import { fileMetaSchema } from '../shared/avatar.schema.js';

const { Schema } = mongoose;

const documentSchema = new Schema(
  {
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseId: { type: String, default: '' },
    classRef: { type: Schema.Types.ObjectId, ref: 'CourseClass', default: null },
    classId: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    // Cloudinary metadata (type: authenticated). No base64 stored in Mongo.
    file: { type: fileMetaSchema, default: () => ({}) },
    link: { type: String, trim: true, default: '' },
    status: { type: String, enum: ['Công khai', 'Ẩn'], default: 'Công khai' },
    uploadedByRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    uploadedBy: { type: String, default: '' },
    extractedText: { type: String, default: '' },
    summary: { type: String, default: '' },
    keyConcepts: [
      {
        concept: { type: String, default: '' },
        definition: { type: String, default: '' },
        formula: { type: String, default: '' },
      },
    ],
    chapters: [
      {
        chapterNumber: { type: Number, default: 1 },
        title: { type: String, default: '' },
        content: { type: String, default: '' },
      },
    ],
    sampleQuizzes: [
      {
        question: { type: String, default: '' },
        options: [{ type: String }],
        correctIndex: { type: Number, default: 0 },
        explanation: { type: String, default: '' },
        concept: { type: String, default: '' },
      },
    ],
  },
  { timestamps: true }
);

export const Document = mongoose.model('Document', documentSchema, 'documents');
export default Document;
