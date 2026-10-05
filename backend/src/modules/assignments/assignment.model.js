import mongoose from 'mongoose';
import { fileMetaSchema } from '../shared/avatar.schema.js';

const { Schema } = mongoose;

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, default: '' },
    options: { type: [String], default: [] },
    // The correct option index. NEVER sent to students before they submit.
    correctIndex: { type: Number, default: 0 },
  },
  { _id: false }
);

const assignmentSchema = new Schema(
  {
    courseRef: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    courseId: { type: String, default: '' },
    classRef: { type: Schema.Types.ObjectId, ref: 'CourseClass', default: null },
    classId: { type: String, trim: true, default: '' },
    type: { type: String, enum: ['file', 'quiz'], default: 'file' },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    status: { type: String, enum: ['Công khai', 'Ẩn'], default: 'Công khai' },

    // quiz
    questions: { type: [questionSchema], default: [] },

    // file assignment attachment (Cloudinary, authenticated)
    file: { type: fileMetaSchema, default: () => ({}) },

    createdByRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    createdBy: { type: String, default: '' },
  },
  { timestamps: true }
);

const submissionSchema = new Schema(
  {
    assignmentRef: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentId: { type: Number, default: null },
    studentName: { type: String, default: '' },
    // Score on a 0-10 scale for quizzes.
    score: { type: Number, default: null },
    answers: { type: Schema.Types.Mixed, default: {} },
    file: { type: fileMetaSchema, default: null },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

submissionSchema.index({ assignmentRef: 1, student: 1 }, { unique: true });

export const Assignment = mongoose.model('Assignment', assignmentSchema, 'assignments');
export const Submission = mongoose.model('Submission', submissionSchema, 'submissions');
