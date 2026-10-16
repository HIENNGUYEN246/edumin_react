import mongoose from 'mongoose';

const { Schema } = mongoose;

const gradeAuditLogSchema = new Schema(
  {
    classRef: { type: Schema.Types.ObjectId, ref: 'CourseClass', required: true },
    classId: { type: String, required: true },
    courseName: { type: String, default: '' },
    studentRef: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentId: { type: Number, required: true },
    studentName: { type: String, required: true },
    component: { type: String, required: true }, // 'attendance', 'midterm', 'final', 'presentation', 'assignment'
    componentLabel: { type: String, default: '' },
    oldScore: { type: Number, default: null },
    newScore: { type: Number, default: null },
    reason: { type: String, required: true, trim: true },
    performedByRef: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    performedByName: { type: String, required: true },
    performedByRole: { type: String, required: true },
  },
  { timestamps: true }
);

export const GradeAuditLog = mongoose.model('GradeAuditLog', gradeAuditLogSchema, 'grade_audit_logs');
export default GradeAuditLog;

