import mongoose from 'mongoose';

const { Schema } = mongoose;

const chatMessageSchema = new Schema(
  {
    // 'direct' (1-on-1 between 2 users) or 'class_group' (to all students & teacher of a course class)
    type: {
      type: String,
      enum: ['direct', 'class_group'],
      required: true,
      default: 'direct',
    },

    // If type === 'class_group':
    classRef: {
      type: Schema.Types.ObjectId,
      ref: 'CourseClass',
      default: null,
      index: true,
    },
    classId: {
      type: String,
      default: '',
      index: true,
    },
    className: {
      type: String,
      default: '',
    },

    // If type === 'direct':
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Sender information:
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      required: true,
      trim: true,
    },
    senderAvatar: {
      type: String,
      default: '',
    },

    content: {
      type: String,
      default: '',
      trim: true,
    },

    attachments: [
      {
        url: { type: String, default: '' },
        name: { type: String, default: '' },
        type: { type: String, default: 'document' },
        size: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
      },
    ],

    mentions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
        name: { type: String, default: '' },
        role: { type: String, default: '' },
      },
    ],

    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

chatMessageSchema.index({ classRef: 1, createdAt: 1 });
chatMessageSchema.index({ sender: 1, recipient: 1, createdAt: 1 });
chatMessageSchema.index({ recipient: 1, createdAt: 1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema, 'chat_messages');
export default ChatMessage;

