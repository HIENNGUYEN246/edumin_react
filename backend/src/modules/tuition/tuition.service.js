import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { parseListQuery, paginate } from '../../lib/pagination.js';
import { Tuition } from './tuition.model.js';
import { Student } from '../students/student.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { CourseClass } from '../classes/courseClass.model.js';

const CURRENT_SEMESTER = 'HK1 (2026-2027)';
const CURRENT_ACADEMIC_YEAR = '2026-2027';

export async function listTuitions(query = {}) {
  const { page, limit, skip, sort, search } = parseListQuery(query, { defaultSort: '-updatedAt' });

  const filter = {};
  if (query.status && query.status !== 'Tất cả') {
    filter.status = query.status;
  }
  if (query.semester && query.semester !== 'Tất cả') {
    filter.semester = query.semester;
  }
  if (query.className && query.className !== 'Tất cả') {
    filter.className = query.className;
  }

  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const numericCode = Number(search.replace(/\D/g, ''));
    const orClauses = [
      { studentName: rx },
      { studentEmail: rx },
      { className: rx },
      { department: rx },
    ];
    if (!isNaN(numericCode) && numericCode > 0) {
      orClauses.push({ studentId: numericCode });
    }
    filter.$or = orClauses;
  }

  return paginate(Tuition, {
    filter,
    page,
    limit,
    skip,
    sort,
    populate: [{ path: 'student', select: 'id hoTen email phone className department avatar' }],
  });
}

export async function getTuitionStats(query = {}) {
  const filter = {};
  if (query.semester && query.semester !== 'Tất cả') {
    filter.semester = query.semester;
  }
  if (query.className && query.className !== 'Tất cả') {
    filter.className = query.className;
  }

  const [agg] = await Tuition.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: '$amount' },
        totalPaid: { $sum: '$amountPaid' },
        totalDue: { $sum: '$amountDue' },
        totalCount: { $sum: 1 },
        paidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Đã đóng'] }, 1, 0] },
        },
        debtCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Đang nợ'] }, 1, 0] },
        },
        unpaidCount: {
          $sum: { $cond: [{ $eq: ['$status', 'Chưa đóng'] }, 1, 0] },
        },
      },
    },
  ]);

  return {
    totalAmount: agg?.totalAmount || 0,
    totalPaid: agg?.totalPaid || 0,
    totalDue: agg?.totalDue || 0,
    totalCount: agg?.totalCount || 0,
    paidCount: agg?.paidCount || 0,
    debtCount: agg?.debtCount || 0,
    unpaidCount: agg?.unpaidCount || 0,
    collectionRate: agg?.totalAmount > 0 ? Math.round((agg.totalPaid / agg.totalAmount) * 100) : 0,
  };
}

export async function getTuition(id) {
  let doc = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    doc = await Tuition.findById(id).populate('student').lean();
  }
  if (!doc) {
    const num = Number(id);
    if (!isNaN(num)) {
      doc = await Tuition.findOne({ studentId: num }).populate('student').lean();
    }
  }
  if (!doc) throw AppError.notFound('Không tìm thấy thông tin học phí');
  return doc;
}

export async function getStudentTuitions(user) {
  const student = await Student.findById(user.student).lean();
  if (!student) {
    return { data: [], summary: { totalDue: 0, totalPaid: 0, status: 'Chưa đóng' } };
  }

  let list = await Tuition.find({ student: student._id }).sort({ createdAt: -1 }).lean();

  // If no tuition record exists yet, auto-initialize for current semester based on enrollments
  if (!list.length) {
    const created = await syncStudentTuitionFromEnrollments(student, CURRENT_SEMESTER);
    if (created) list = [created];
  }

  const totalAmount = list.reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalPaid = list.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
  const totalDue = list.reduce((sum, t) => sum + (t.amountDue || 0), 0);

  let overallStatus = 'Đã đóng';
  if (totalDue > 0 && totalPaid > 0) overallStatus = 'Đang nợ';
  else if (totalDue > 0 && totalPaid === 0) overallStatus = 'Chưa đóng';

  return {
    data: list,
    student: {
      id: student.id,
      hoTen: student.hoTen,
      email: student.email,
      className: student.className,
      department: student.department,
    },
    summary: {
      totalAmount,
      totalPaid,
      totalDue,
      overallStatus,
    },
  };
}

export async function recordPayment(id, payload, accountantUser) {
  const doc = await Tuition.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy bản ghi học phí');

  const amount = Number(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    throw AppError.badRequest('Số tiền thanh toán phải lớn hơn 0');
  }

  const transactionCode = payload.transactionCode || `GD-${Date.now().toString(36).toUpperCase()}`;
  const method = payload.paymentMethod || 'Chuyển khoản';
  const recordedBy = accountantUser?.hoTen || 'Phòng Kế toán';
  const note = payload.note || 'Thanh toán học phí';

  doc.transactions.push({
    transactionCode,
    amount,
    paymentMethod: method,
    paidAt: new Date(),
    recordedBy,
    note,
  });

  doc.amountPaid = (doc.amountPaid || 0) + amount;
  doc.amountDue = Math.max(0, (doc.amount || 0) - (doc.discount || 0) - doc.amountPaid);

  if (doc.amountDue === 0) {
    doc.status = 'Đã đóng';
  } else if (doc.amountPaid > 0) {
    doc.status = 'Đang nợ';
  } else {
    doc.status = 'Chưa đóng';
  }

  doc.paidAt = new Date();
  doc.paymentMethod = method;

  await doc.save();
  return doc.toObject();
}

export async function bulkUpdateStatus({ ids = [], status, note = '', paymentMethod = 'Chuyển khoản' }, accountantUser) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw AppError.badRequest('Vui lòng chọn ít nhất một sinh viên');
  }
  if (!['Đã đóng', 'Chưa đóng', 'Đang nợ'].includes(status)) {
    throw AppError.badRequest('Trạng thái không hợp lệ');
  }

  const recorder = accountantUser?.hoTen || 'Phòng Kế toán';
  const tuitions = await Tuition.find({ _id: { $in: ids } });

  let updatedCount = 0;
  for (const t of tuitions) {
    if (status === 'Đã đóng') {
      const remaining = t.amountDue > 0 ? t.amountDue : Math.max(0, t.amount - t.discount - t.amountPaid);
      t.amountPaid = Math.max(t.amountPaid, t.amount - t.discount);
      t.amountDue = 0;
      t.status = 'Đã đóng';
      t.paidAt = new Date();
      t.paymentMethod = paymentMethod;

      if (remaining > 0) {
        t.transactions.push({
          transactionCode: `BULK-${Date.now().toString(36).toUpperCase()}-${updatedCount + 1}`,
          amount: remaining,
          paymentMethod,
          paidAt: new Date(),
          recordedBy: recorder,
          note: note || 'Duyệt học phí hàng loạt từ kế toán',
        });
      }
    } else if (status === 'Chưa đóng') {
      t.amountPaid = 0;
      t.amountDue = Math.max(0, t.amount - t.discount);
      t.status = 'Chưa đóng';
      t.paidAt = null;
    } else if (status === 'Đang nợ') {
      t.status = 'Đang nợ';
    }

    await t.save();
    updatedCount++;
  }

  return { success: true, updatedCount };
}

export async function importTuitionRows(rows = [], accountantUser) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw AppError.badRequest('Danh sách nhập rỗng');
  }

  let created = 0;
  let updated = 0;
  const failed = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rawId = row.MaSV || row['Mã SV'] || row['Mã sinh viên'] || row.studentId || row.id;
    if (!rawId) {
      failed.push({ row: i + 1, error: 'Thiếu mã sinh viên' });
      continue;
    }

    const numId = Number(String(rawId).replace(/\D/g, ''));
    const student = await Student.findOne({ id: numId });
    if (!student) {
      failed.push({ row: i + 1, error: `Không tìm thấy sinh viên có mã ${rawId}` });
      continue;
    }

    const semester = row.HocKy || row['Học kỳ'] || row.semester || CURRENT_SEMESTER;
    const amount = Number(row.SoTien || row['Số tiền'] || row.amount || row.HocPhi || row['Học phí'] || 0);
    const rawStatus = String(row.TrangThai || row['Trạng thái'] || row.status || '').trim();
    const transactionCode = String(row.MaGiaoDich || row['Mã giao dịch'] || row.transactionCode || '').trim();
    const note = String(row.GhiChu || row['Ghi chú'] || row.note || 'Nhập từ file sao kê').trim();

    let status = 'Chưa đóng';
    if (/đã/i.test(rawStatus) || /hoàn/i.test(rawStatus) || /paid/i.test(rawStatus)) {
      status = 'Đã đóng';
    } else if (/nợ/i.test(rawStatus) || /debt/i.test(rawStatus)) {
      status = 'Đang nợ';
    }

    let tuition = await Tuition.findOne({ student: student._id, semester });
    if (!tuition) {
      const finalAmount = amount > 0 ? amount : 5000000;
      tuition = new Tuition({
        student: student._id,
        studentId: student.id,
        studentName: student.hoTen,
        studentEmail: student.email,
        className: student.className || '',
        department: student.department || '',
        semester,
        academicYear: CURRENT_ACADEMIC_YEAR,
        amount: finalAmount,
        discount: 0,
        amountPaid: status === 'Đã đóng' ? finalAmount : amount > 0 && status === 'Đang nợ' ? amount : 0,
        amountDue: status === 'Đã đóng' ? 0 : finalAmount - (status === 'Đang nợ' ? amount : 0),
        status,
        paymentMethod: 'Chuyển khoản',
        paidAt: status === 'Đã đóng' ? new Date() : null,
      });

      if (status === 'Đã đóng' || amount > 0) {
        tuition.transactions.push({
          transactionCode: transactionCode || `IMP-${Date.now().toString(36).toUpperCase()}`,
          amount: status === 'Đã đóng' ? finalAmount : amount,
          paymentMethod: 'Chuyển khoản',
          paidAt: new Date(),
          recordedBy: accountantUser?.hoTen || 'Phòng Kế toán',
          note,
        });
      }

      await tuition.save();
      created++;
    } else {
      if (amount > 0) {
        tuition.amountPaid = (tuition.amountPaid || 0) + amount;
        tuition.transactions.push({
          transactionCode: transactionCode || `IMP-${Date.now().toString(36).toUpperCase()}`,
          amount,
          paymentMethod: 'Chuyển khoản',
          paidAt: new Date(),
          recordedBy: accountantUser?.hoTen || 'Phòng Kế toán',
          note,
        });
      }
      if (status === 'Đã đóng') {
        tuition.amountPaid = Math.max(tuition.amountPaid, tuition.amount - tuition.discount);
        tuition.amountDue = 0;
        tuition.status = 'Đã đóng';
        tuition.paidAt = new Date();
      } else {
        tuition.amountDue = Math.max(0, tuition.amount - tuition.discount - tuition.amountPaid);
        tuition.status = tuition.amountDue === 0 ? 'Đã đóng' : tuition.amountPaid > 0 ? 'Đang nợ' : 'Chưa đóng';
      }
      await tuition.save();
      updated++;
    }
  }

  return { created, updated, failed };
}

export async function syncStudentTuitionFromEnrollments(student, semester = CURRENT_SEMESTER) {
  const enrollments = await Enrollment.find({ student: student._id }).populate({
    path: 'classRef',
    select: 'fee credits courseId courseName',
  });

  let totalCredits = 0;
  let totalFee = 0;

  enrollments.forEach((e) => {
    if (e.classRef) {
      totalCredits += e.classRef.credits || 0;
      totalFee += e.classRef.fee || 0;
    }
  });

  // If student has registered courses, use totalFee; otherwise standard semester fee 4.500.000đ
  const amount = totalFee > 0 ? totalFee : 4500000;

  const existing = await Tuition.findOne({ student: student._id, semester });
  if (existing) {
    if (totalFee > 0 && existing.status === 'Chưa đóng') {
      existing.amount = amount;
      existing.totalCredits = totalCredits;
      existing.amountDue = Math.max(0, amount - existing.discount - existing.amountPaid);
      await existing.save();
    }
    return existing.toObject();
  }

  const created = await Tuition.create({
    student: student._id,
    studentId: student.id,
    studentName: student.hoTen,
    studentEmail: student.email,
    className: student.className || '',
    department: student.department || '',
    semester,
    academicYear: CURRENT_ACADEMIC_YEAR,
    totalCredits,
    amount,
    discount: 0,
    amountPaid: 0,
    amountDue: amount,
    status: 'Chưa đóng',
    dueDate: '2026-11-30',
  });

  return created.toObject();
}

export async function autoGenerateTuitionsForActiveStudents(semester = CURRENT_SEMESTER) {
  const students = await Student.find({}).lean();
  let generated = 0;

  for (const s of students) {
    const found = await Tuition.findOne({ student: s._id, semester });
    if (!found) {
      await syncStudentTuitionFromEnrollments(s, semester);
      generated++;
    }
  }

  return { generated, totalStudents: students.length };
}

export async function getDistinctClasses() {
  const classes = await Tuition.distinct('className');
  return { data: classes.filter(Boolean).sort() };
}

export async function getDistinctSemesters() {
  const semesters = await Tuition.distinct('semester');
  if (!semesters.includes(CURRENT_SEMESTER)) {
    semesters.unshift(CURRENT_SEMESTER);
  }
  return { data: semesters.filter(Boolean) };
}
