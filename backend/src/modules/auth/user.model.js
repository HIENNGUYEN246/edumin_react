import mongoose from 'mongoose';
import { ALL_ROLES, ROLES } from '../../lib/roles.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    // Never selected by default so it cannot leak through generic queries.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, required: true, enum: ALL_ROLES, default: ROLES.ADMIN },
    hoTen: { type: String, default: '' },
    status: { type: String, enum: ['Active', 'Locked'], default: 'Active' },
    lockReason: { type: String, default: '' },
    // Bumped on password change / lock / reset to revoke previously issued JWTs.
    tokenVersion: { type: Number, default: 0 },
    teacher: { type: Schema.Types.ObjectId, ref: 'Teacher', default: null },
    student: { type: Schema.Types.ObjectId, ref: 'Student', default: null },
  },
  { timestamps: true }
);

/** Public projection: strips secrets regardless of how the doc was loaded. */
userSchema.methods.toPublic = function toPublic() {
  const obj = this.toObject({ virtuals: true });
  delete obj.passwordHash;
  delete obj.__v;
  return obj;
};

export const User = mongoose.model('User', userSchema, 'users');
export default User;
