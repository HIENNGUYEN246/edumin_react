import mongoose from 'mongoose';
import { ALL_ROLES, ROLES } from '../../lib/roles.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // Never selected by default so it cannot leak through generic queries.
    passwordHash: { type: String, select: false },
    password: { type: String, select: false },
    role: { type: String, required: true, enum: ALL_ROLES, default: ROLES.ADMIN },
    hoTen: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Locked'], default: 'Active' },
    lockReason: { type: String, default: '' },
    // Bumped on password change / lock / reset to revoke previously issued JWTs.
    tokenVersion: { type: Number, default: 0 },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    student: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
    teacherId: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    studentId: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
  },
  { timestamps: true }
);

userSchema.pre('save', function (next) {
  if (!this.teacher && this.teacherId) this.teacher = this.teacherId;
  if (!this.teacherId && this.teacher) this.teacherId = this.teacher;
  if (!this.student && this.studentId) this.student = this.studentId;
  if (!this.studentId && this.student) this.studentId = this.student;
  next();
});

/** Public projection: strips secrets regardless of how the doc was loaded. */
userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.password;
  delete obj.__v;
  if (!obj.teacher && obj.teacherId) obj.teacher = obj.teacherId;
  if (!obj.teacherId && obj.teacher) obj.teacherId = obj.teacher;
  if (!obj.student && obj.studentId) obj.student = obj.studentId;
  if (!obj.studentId && obj.student) obj.studentId = obj.student;
  return obj;
};

export const User = mongoose.model('User', userSchema, 'users');
export default User;
