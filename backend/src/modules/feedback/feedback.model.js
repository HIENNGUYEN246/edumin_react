import mongoose from 'mongoose';

const { Schema } = mongoose;

const feedbackSchema = new Schema(
  {
    id: {
      type: String,
      default: () => `FB_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    },
    studentId: { type: Number, required: true },
    studentRef: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    studentName: { type: String, default: '' },
    studentEmail: { type: String, default: '' },
    studentAvatar: { type: String, default: '' },
    teacherId: { type: Schema.Types.Mixed, default: null },
    teacherRef: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    teacherName: { type: String, default: '' },
    teacherGender: { type: String, default: '' },
    teacherAvatar: { type: String, default: '' },
    courseId: { type: String, default: '' },
    courseName: { type: String, default: '' },
    regId: { type: String, default: '' },
    rating: { type: Number, default: 5, min: 1, max: 5 },
    courseQuality: { type: String, default: 'Tốt' },
    feedbackText: { type: String, required: true },
    isAnonymous: { type: Boolean, default: false },
    response: { type: String, default: '' },
    respondedAt: { type: String, default: '' },
    respondedByRef: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    respondedByName: { type: String, default: '' },
    respondedByRole: { type: String, default: '' },
    respondedByAvatar: { type: String, default: '' },
    timestamp: { type: Number, default: Date.now },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model('Feedback', feedbackSchema, 'feedbacks');
export default Feedback;

