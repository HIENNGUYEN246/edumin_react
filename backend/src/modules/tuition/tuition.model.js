import mongoose from 'mongoose';

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    transactionCode: { type: String, trim: true, default: '' },
    amount: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, trim: true, default: 'Chuyển khoản' },
    paidAt: { type: Date, default: Date.now },
    recordedBy: { type: String, trim: true, default: 'Kế toán' },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

const tuitionSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    studentId: { type: Number, required: true },
    studentName: { type: String, trim: true, default: '' },
    studentEmail: { type: String, trim: true, lowercase: true, default: '' },
    className: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    semester: { type: String, trim: true, default: 'HK1 (2026-2027)' },
    academicYear: { type: String, trim: true, default: '2026-2027' },
    totalCredits: { type: Number, default: 0 },
    amount: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    amountDue: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Đã đóng', 'Chưa đóng', 'Đang nợ'],
      default: 'Chưa đóng',
    },
    dueDate: { type: String, trim: true, default: '2026-11-30' },
    paidAt: { type: Date, default: null },
    paymentMethod: { type: String, trim: true, default: '' },
    transactions: { type: [transactionSchema], default: () => [] },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

tuitionSchema.index({ student: 1, semester: 1 }, { unique: true });
tuitionSchema.index({ studentId: 1 });
tuitionSchema.index({ className: 1 });
tuitionSchema.index({ status: 1 });
tuitionSchema.index({ semester: 1 });

export const Tuition = mongoose.model('Tuition', tuitionSchema, 'tuitions');
export default Tuition;
