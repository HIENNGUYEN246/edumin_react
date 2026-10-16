import mongoose from 'mongoose';

const { Schema } = mongoose;

const profileRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetModel: { type: String, enum: ['Teacher', 'Student'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    requesterRole: { type: String, enum: ['giao-vien', 'sinh-vien'], required: true, index: true },
    requesterName: { type: String, default: '', trim: true },
    requesterEmail: { type: String, default: '', trim: true },
    requesterCode: { type: Schema.Types.Mixed, default: '' },
    type: { type: String, enum: ['avatar', 'profile', 'both'], default: 'avatar' },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    currentData: { type: Schema.Types.Mixed, default: () => ({}) },
    requestedData: { type: Schema.Types.Mixed, default: () => ({}) },
    adminNote: { type: String, default: '', trim: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const ProfileRequest = mongoose.model('ProfileRequest', profileRequestSchema, 'profile_requests');
export default ProfileRequest;

