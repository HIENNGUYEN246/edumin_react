import mongoose from 'mongoose';

const { Schema } = mongoose;

const userDesireSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    role: { type: String, enum: ['sinh-vien', 'giao-vien', 'student', 'teacher', 'admin'], required: true },
    userName: { type: String, default: 'Người dùng', trim: true },
    userEmail: { type: String, default: '', trim: true },
    content: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ['Học phần & Mở lớp', 'Học phí & Chính sách', 'Lịch học & Thi', 'Cơ sở vật chất', 'Bảng điểm & Đánh giá', 'Đề xuất chung'],
      default: 'Đề xuất chung',
    },
    status: { type: String, enum: ['pending', 'reviewed', 'resolved'], default: 'pending' },
    source: { type: String, default: 'ai_chat' },
  },
  { timestamps: true }
);

export const UserDesire = mongoose.model('UserDesire', userDesireSchema, 'user_desires');
export default UserDesire;

