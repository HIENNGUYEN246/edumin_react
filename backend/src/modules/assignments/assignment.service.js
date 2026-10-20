import { AppError } from '../../lib/AppError.js';
import { ROLES } from '../../lib/roles.js';
import { Assignment, Submission } from './assignment.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { canAccessCourse, enrolledCourseIds, teacherAccessibleCourseIds } from '../shared/courseAccess.js';
import { CourseClass } from '../classes/courseClass.model.js';

/**
 * Public DTO for students: strips `correctIndex` from every question so the
 * answer key never reaches the client before submission. This closes the
 * legacy vulnerability where the quiz answers were sent to the browser.
 */
function toStudentDto(assignment) {
  const obj = assignment.toObject ? assignment.toObject() : assignment;
  const { file, ...rest } = obj;
  return {
    ...rest,
    questions: (obj.questions || []).map((q) => ({ id: q.id, text: q.text, options: q.options })),
    attachment: file?.publicId ? { name: obj.title, format: file.format } : null,
  };
}

async function requireCourseTeacher(user, courseId, doc = null) {
  if (user.role === ROLES.ADMIN) return;
  if (doc?.createdByRef && user.teacher && String(doc.createdByRef) === String(user.teacher)) {
    return;
  }
  const allowed = await canAccessCourse(user, courseId);
  if (!allowed) throw AppError.forbidden('Bạn không phụ trách học phần này');
}

export async function listAssignments(query, user) {
  const filter = {};
  if (query.courseId) filter.courseId = query.courseId;

  if (user.role === ROLES.STUDENT) {
    filter.status = 'Công khai';
    // Students only see assignments of courses they are enrolled in, so no
    // listed item can lead to a 403 on the taking page.
    const courseIds = await enrolledCourseIds(user);
    if (!courseIds.length) return { data: [] };
    filter.courseId = query.courseId && courseIds.includes(query.courseId)
      ? query.courseId
      : { $in: courseIds };
  } else if (user.role === ROLES.TEACHER) {
    // Teachers only see assignments of courses they teach or in their department / chuyên ngành
    const courseIds = await teacherAccessibleCourseIds(user);
    if (!courseIds.length) return { data: [] };
    filter.courseId = query.courseId && courseIds.includes(query.courseId)
      ? query.courseId
      : { $in: courseIds };
  }

  const assignments = await Assignment.find(filter)
    .populate('createdByRef', 'id hoTen avatar email')
    .sort({ createdAt: -1 });
  // Teachers/admins get the full document; students get the answer-stripped DTO.
  if (user.role === ROLES.STUDENT) {
    const student = await Student.findById(user.student).select('_id').lean();
    const submissions = student && assignments.length
      ? await Submission.find({ assignmentRef: { $in: assignments.map((a) => a._id) }, student: student._id })
        .select('assignmentRef score')
        .lean()
      : [];
    const submissionsByAssignment = new Map(
      submissions.map((submission) => [String(submission.assignmentRef), submission])
    );

    return {
      data: assignments.map((assignment) => {
        const submission = submissionsByAssignment.get(String(assignment._id));
        return {
          ...toStudentDto(assignment),
          mySubmission: submission ? { score: submission.score } : null,
        };
      }),
    };
  }
  return { data: assignments.map((a) => a.toObject()) };
}

/** Single assignment for the taking page. Students get the answer-stripped DTO. */
export async function getAssignment(id, user) {
  const assignment = await Assignment.findById(id).populate('createdByRef', 'id hoTen avatar email');
  if (!assignment) throw AppError.notFound('Không tìm thấy bài tập');

  if (user.role === ROLES.STUDENT) {
    if (assignment.status !== 'Công khai') throw AppError.forbidden('Bài tập không khả dụng');
    const allowed = await canAccessCourse(user, assignment.courseId);
    if (!allowed) throw AppError.forbidden('Bạn chưa đăng ký học phần này');
    return toStudentDto(assignment);
  }
  await requireCourseTeacher(user, assignment.courseId);
  return assignment.toObject();
}

export async function createAssignment(payload, user) {
  let courseId = payload.courseId;
  let classRef = null;
  let classId = payload.classId || '';

  if (payload.classId) {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(String(payload.classId).trim());
    const cls = await CourseClass.findOne({
      $or: [
        { id: payload.classId },
        ...(isObjectId ? [{ _id: payload.classId }] : []),
      ],
    });
    if (cls) {
      classRef = cls._id;
      classId = cls.id;
      if (!courseId) {
        courseId = cls.courseId;
      }
    }
  }

  // Fallback: If teacher creates assignment for course, resolve classRef to teacher's class
  if (!classRef && user.role === ROLES.TEACHER && courseId) {
    const teacherFilter = [{ teacherRef: user.teacher }];
    if (user.teacher && mongoose.Types.ObjectId.isValid(user.teacher)) {
      teacherFilter.push({ teacherRef: new mongoose.Types.ObjectId(user.teacher) });
    }
    const Teacher = mongoose.model('Teacher');
    const teacherDoc = await Teacher.findById(user.teacher).lean();
    if (teacherDoc?.hoTen) teacherFilter.push({ teacher: teacherDoc.hoTen });
    if (teacherDoc?.id) teacherFilter.push({ teacherId: teacherDoc.id });

    const cls = await CourseClass.findOne({
      courseId,
      $or: teacherFilter,
    });
    if (cls) {
      classRef = cls._id;
      if (!classId) {
        classId = cls.id;
      } else {
        const matchCount = await CourseClass.countDocuments({ id: classId });
        if (matchCount === 0) {
          classId = cls.id;
        }
      }
    }
  }

  const course = await Course.findOne({ id: courseId });
  if (!course) throw AppError.badRequest('Học phần không tồn tại');
  await requireCourseTeacher(user, courseId);

  const defaultDueDate = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
  const teacher = user.role === ROLES.TEACHER ? await Teacher.findById(user.teacher).lean() : null;
  const doc = await Assignment.create({
    courseRef: course._id,
    courseId: course.id,
    classRef,
    classId,
    type: payload.type || 'quiz',
    title: payload.title,
    description: payload.description || '',
    dueDate: payload.dueDate || defaultDueDate,
    status: payload.status || 'Công khai',
    questions: (payload.type === 'quiz' || !payload.type) ? payload.questions : [],
    createdByRef: teacher?._id || null,
    createdBy: teacher?.hoTen || user.email,
  });
  return doc.toObject();
}

export async function updateAssignment(id, payload, user) {
  const doc = await Assignment.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy bài tập');
  await requireCourseTeacher(user, doc.courseId, doc);

  if (payload.classId !== undefined) {
    if (payload.classId) {
      const cls = await CourseClass.findOne({ id: payload.classId });
      doc.classRef = cls?._id || null;
      doc.classId = cls?.id || payload.classId;
    } else {
      doc.classRef = null;
      doc.classId = '';
    }
  }
  if (payload.title !== undefined) doc.title = payload.title;
  if (payload.description !== undefined) doc.description = payload.description;
  if (payload.dueDate !== undefined) doc.dueDate = payload.dueDate;
  if (payload.status !== undefined) doc.status = payload.status;
  if (payload.questions !== undefined && doc.type === 'quiz') doc.questions = payload.questions;
  await doc.save();
  return doc.toObject();
}

export async function deleteAssignment(id, user) {
  const doc = await Assignment.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy bài tập');
  await requireCourseTeacher(user, doc.courseId, doc);
  await Submission.deleteMany({ assignmentRef: doc._id });
  await Assignment.deleteOne({ _id: doc._id });
  return { success: true };
}

export async function listSubmissions(id, user) {
  const doc = await Assignment.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy bài tập');
  await requireCourseTeacher(user, doc.courseId, doc);
  const submissions = await Submission.find({ assignmentRef: doc._id })
    .populate({ path: 'student', select: 'id hoTen email avatar className' })
    .sort({ score: -1 })
    .lean();
  return { data: submissions };
}

function isPastDue(assignment, now = new Date()) {
  if (!assignment.dueDate) return false;
  const deadline = new Date(`${assignment.dueDate}T23:59:59`);
  return !Number.isNaN(deadline.valueOf()) && now > deadline;
}

/** Grade a quiz on a 0-10 scale and upsert the student's submission. */
export async function submitQuiz(id, answers, user) {
  const assignment = await Assignment.findById(id);
  if (!assignment) throw AppError.notFound('Không tìm thấy bài tập');
  if (assignment.type !== 'quiz' || assignment.status !== 'Công khai') {
    throw AppError.forbidden('Bài quiz không khả dụng');
  }

  const student = await Student.findById(user.student);
  if (!student) throw AppError.notFound('Không tìm thấy hồ sơ sinh viên');

  const allowed = await canAccessCourse(user, assignment.courseId);
  if (!allowed) throw AppError.forbidden('Bạn chưa đăng ký học phần này');

  if (isPastDue(assignment)) throw AppError.conflict('Bài quiz đã hết hạn nộp');

  const questions = assignment.questions || [];
  if (!questions.length) throw AppError.badRequest('Bài quiz chưa có câu hỏi');

  const unanswered = questions.some((q) => answers[q.id] === undefined);
  if (unanswered) throw AppError.badRequest('Vui lòng trả lời đầy đủ câu hỏi');

  const correct = questions.reduce(
    (count, q) => count + (Number(answers[q.id]) === Number(q.correctIndex) ? 1 : 0),
    0
  );
  const score = Number(((correct / questions.length) * 10).toFixed(1));

  await Submission.findOneAndUpdate(
    { assignmentRef: assignment._id, student: student._id },
    {
      assignmentRef: assignment._id,
      student: student._id,
      studentId: student.id,
      studentName: student.hoTen || student.email,
      score,
      answers,
      submittedAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Return the score plus the answer key so the student can review after submitting.
  return {
    score,
    correctCount: correct,
    total: questions.length,
    answerKey: questions.map((q) => ({
      id: q.id,
      correctIndex: q.correctIndex,
      explanation: q.explanation || '',
    })),
  };
}

/** The student's own submission (with the answer key for review). */
export async function getMySubmission(id, user) {
  const assignment = await Assignment.findById(id).lean();
  if (!assignment) throw AppError.notFound('Không tìm thấy bài tập');
  const student = await Student.findById(user.student).lean();
  const submission = await Submission.findOne({ assignmentRef: id, student: student?._id }).lean();
  if (!submission) return { submission: null };
  return {
    submission,
    answerKey:
      assignment.type === 'quiz'
        ? (assignment.questions || []).map((q) => ({
            id: q.id,
            correctIndex: q.correctIndex,
            explanation: q.explanation || '',
          }))
        : null,
  };
}
