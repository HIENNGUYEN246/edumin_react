import mongoose from 'mongoose';
import { ALL_ROLES } from '../../lib/roles.js';

const { Schema } = mongoose;

const notificationSchema = new Schema(
  {
    recipientUser: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    recipientRole: { type: String, enum: ALL_ROLES, required: true, index: true },
    type: {
      type: String,
      enum: ['approval', 'feedback', 'attendance', 'assignment', 'system'],
      default: 'system',
    },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    link: { type: String, default: '' },
    isRead: { type: Boolean, default: false },
    metadata: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true }
);

export const Notification = mongoose.model('Notification', notificationSchema, 'notifications');
export default Notification;

