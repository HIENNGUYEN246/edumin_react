import mongoose from 'mongoose';
import { ALL_ROLES } from '../../lib/roles.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    senderRole: { type: String, default: '' },
    senderName: { type: String, default: '' },
    recipientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    recipientRole: { type: String, enum: [...ALL_ROLES, 'all'], default: 'all', index: true },
    targetType: {
      type: String,
      enum: ['all', 'department', 'class', 'individual', 'role'],
      default: 'role',
      index: true,
    },
    targetIds: { type: [String], default: [] },
    targetClassId: { type: String, default: '', index: true },
    type: {
      type: String,
      enum: ['approval', 'feedback', 'attendance', 'assignment', 'system', 'schedule_change'],
      default: 'system',
      index: true,
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    readBy: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
      },
    ],
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema, 'notifications');
export default Notification;
