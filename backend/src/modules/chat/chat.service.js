import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import { ROLES } from '../../lib/roles.js';
import { ChatMessage } from './chatMessage.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { User } from '../auth/user.model.js';

/**
 * Returns the list of CourseClass _id's that the user is permitted to view/participate in.
 * - Admin: null (all classes)
 * - Teacher: classes where the teacher is assigned
 * - Student: classes where the student is enrolled
 */
export async function getUserAllowedClassIds(user) {
  if (!user) return [];
  const role = user.role;

  // 1. Admin: access to all classes
  if (role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao') {
    return null;
  }

  // 2. Teacher: only assigned classes
  if (role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien') {
    let teacher = user.teacher ? await Teacher.findById(user.teacher).lean() : null;
    if (!teacher && user._id) {
      teacher = await Teacher.findOne({ userId: user._id }).lean();
    }
    if (!teacher) return [];

    const conditions = [{ teacherRef: teacher._id }];
    if (teacher.id != null) {
      conditions.push({ teacherId: teacher.id });
    }
    const classIds = await CourseClass.find({ $or: conditions }).distinct('_id');
    return classIds;
  }

  // 3. Student: only enrolled classes
  if (role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien') {
    let student = user.student ? await Student.findById(user.student).lean() : null;
    if (!student && user._id) {
      student = await Student.findOne({ userId: user._id }).lean();
    }
    if (!student) return [];

    const enrolledClassIds = await Enrollment.find({ student: student._id }).distinct('classRef');
    return enrolledClassIds;
  }

  return [];
}

/**
 * Checks whether a given user can access a specific course class.
 */
export async function canUserAccessClass(user, classRefOrId) {
  const allowedClassIds = await getUserAllowedClassIds(user);
  if (allowedClassIds === null) return true; // Admin

  const targetClass = await CourseClass.findOne({
    $or: [
      mongoose.isValidObjectId(classRefOrId) ? { _id: classRefOrId } : null,
      { id: String(classRefOrId) },
    ].filter(Boolean),
  }).lean();

  if (!targetClass) return false;

  return allowedClassIds.some((id) => id.toString() === targetClass._id.toString());
}

/**
 * Checks whether userA is allowed to direct message userB based on system roles.
 */
export async function canUserDirectChat(userA, userB) {
  if (!userA || !userB) return false;
  if (userA._id.toString() === userB._id.toString()) return false;

  const roleA = userA.role;
  const roleB = userB.role;

  const isAdminA = roleA === ROLES.ADMIN || roleA === 'admin' || roleA === 'dao-tao';
  const isAdminB = roleB === ROLES.ADMIN || roleB === 'admin' || roleB === 'dao-tao';

  // Admin can direct message anyone and other admins
  if (isAdminA || isAdminB) return true;

  // Teacher <-> Teacher
  const isTeacherA = roleA === ROLES.TEACHER || roleA === 'teacher' || roleA === 'giao-vien';
  const isTeacherB = roleB === ROLES.TEACHER || roleB === 'teacher' || roleB === 'giao-vien';
  if (isTeacherA && isTeacherB) return true;

  // Teacher <-> Student (only if student is enrolled in a class taught by the teacher)
  if (isTeacherA && (roleB === ROLES.STUDENT || roleB === 'student' || roleB === 'sinh-vien')) {
    const teacherDoc = await Teacher.findOne({ $or: [{ _id: userA.teacher }, { userId: userA._id }] }).lean();
    const studentDoc = await Student.findOne({ $or: [{ _id: userB.student }, { userId: userB._id }] }).lean();
    if (!teacherDoc || !studentDoc) return false;

    const teacherClassIds = await CourseClass.find({
      $or: [
        { teacherRef: teacherDoc._id },
        { teacherId: teacherDoc.id },
        teacherDoc.hoTen ? { teacher: teacherDoc.hoTen } : null,
      ].filter(Boolean),
    }).distinct('_id');

    const isEnrolled = await Enrollment.exists({
      student: { $in: [studentDoc._id, userB._id] },
      classRef: { $in: teacherClassIds },
    });
    return Boolean(isEnrolled);
  }

  // Student <-> Teacher (only if student is enrolled in a class taught by the teacher)
  if ((roleA === ROLES.STUDENT || roleA === 'student' || roleA === 'sinh-vien') && isTeacherB) {
    const studentDoc = await Student.findOne({ $or: [{ _id: userA.student }, { userId: userA._id }] }).lean();
    const teacherDoc = await Teacher.findOne({ $or: [{ _id: userB.teacher }, { userId: userB._id }] }).lean();
    if (!studentDoc || !teacherDoc) return false;

    const teacherClassIds = await CourseClass.find({
      $or: [
        { teacherRef: teacherDoc._id },
        { teacherId: teacherDoc.id },
        teacherDoc.hoTen ? { teacher: teacherDoc.hoTen } : null,
      ].filter(Boolean),
    }).distinct('_id');

    const isEnrolled = await Enrollment.exists({
      student: { $in: [studentDoc._id, userA._id] },
      classRef: { $in: teacherClassIds },
    });
    return Boolean(isEnrolled);
  }

  return false;
}

/**
 * Returns available chat channels for the user:
 * - classGroups: List of course classes the user is in
 * - directConversations: List of 1-on-1 conversations the user has
 */
export async function getChannelsForUser(user) {
  // 1. Fetch Class Groups
  const allowedClassIds = await getUserAllowedClassIds(user);
  const classFilter = allowedClassIds === null ? {} : { _id: { $in: allowedClassIds } };
  const classes = await CourseClass.find(classFilter).sort({ id: 1 }).lean();

  const classGroups = await Promise.all(
    classes.map(async (c) => {
      const [lastMsg, unreadCount, studentCount] = await Promise.all([
        ChatMessage.findOne({ type: 'class_group', classRef: c._id }).sort({ createdAt: -1 }).lean(),
        ChatMessage.countDocuments({
          type: 'class_group',
          classRef: c._id,
          sender: { $ne: user._id },
          readBy: { $ne: user._id },
        }),
        Enrollment.countDocuments({
          $or: [
            { classRef: c._id },
            { classId: c.id },
          ],
        }),
      ]);

      return {
        _id: c._id,
        classId: c.id,
        courseName: c.courseName || c.className || c.id,
        className: c.className || c.courseName,
        teacher: c.teacher || 'Chưa phân công',
        room: c.room || '',
        studentCount: studentCount || 0,
        hasStudents: (studentCount || 0) > 0,
        memberCount: (studentCount || 0) + (c.teacher ? 1 : 0),
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              senderName: lastMsg.senderName,
              senderRole: lastMsg.senderRole,
              createdAt: lastMsg.createdAt,
            }
          : null,
        unreadCount,
      };
    })
  );

  // 2. Fetch Direct 1-on-1 conversations
  const directMsgs = await ChatMessage.find({
    type: 'direct',
    $or: [{ sender: user._id }, { recipient: user._id }],
  })
    .sort({ createdAt: -1 })
    .lean();

  const partnerMap = new Map();
  for (const msg of directMsgs) {
    const isSender = msg.sender.toString() === user._id.toString();
    const partnerId = isSender ? msg.recipient.toString() : msg.sender.toString();

    if (!partnerMap.has(partnerId)) {
      partnerMap.set(partnerId, {
        partnerId,
        lastMessage: msg,
        unreadCount: 0,
      });
    }

    if (
      !isSender &&
      (!msg.readBy || !msg.readBy.some((id) => id.toString() === user._id.toString()))
    ) {
      const item = partnerMap.get(partnerId);
      item.unreadCount += 1;
    }
  }

  const partnerIds = Array.from(partnerMap.keys());
  const partnerUsers = await User.find({ _id: { $in: partnerIds } }).lean();
  const userDict = new Map(partnerUsers.map((u) => [u._id.toString(), u]));

  const directConversations = partnerIds
    .map((id) => {
      const partner = userDict.get(id);
      if (!partner) return null;
      const info = partnerMap.get(id);
      const avatarUrl = partner.avatar?.url || (typeof partner.avatar === 'string' ? partner.avatar : '');

      return {
        partnerId: partner._id,
        name: partner.hoTen || partner.email || 'Người dùng',
        role: partner.role,
        email: partner.email,
        avatar: avatarUrl,
        lastMessage: {
          content: info.lastMessage.content,
          senderName: info.lastMessage.senderName,
          senderRole: info.lastMessage.senderRole,
          createdAt: info.lastMessage.createdAt,
          isOwn: info.lastMessage.sender.toString() === user._id.toString(),
        },
        unreadCount: info.unreadCount,
      };
    })
    .filter(Boolean);

  const totalUnread =
    classGroups.reduce((acc, c) => acc + (c.unreadCount || 0), 0) +
    directConversations.reduce((acc, d) => acc + (d.unreadCount || 0), 0);

  const contacts = await getContactsForUser(user);

  return {
    classGroups,
    directConversations,
    contacts,
    totalUnread,
  };
}

/**
 * Returns available contacts for starting a direct 1-1 chat.
 */
export async function getContactsForUser(user, search = '') {
  const role = user.role;
  const isAdmin = role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao';
  const isTeacher = role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien';
  const isStudent = role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien';

  let eligibleUserIds = [];

  if (isAdmin) {
    // Admin can contact all teachers, all students, other admins
    const users = await User.find({ _id: { $ne: user._id }, status: { $ne: 'Locked' } })
      .select('hoTen role email avatar')
      .lean();
    eligibleUserIds = users.map((u) => u._id);
  } else if (isTeacher) {
    // Teacher can contact: Admins + Students in teacher's classes + Other Teachers
    const teacherDoc = await Teacher.findOne({ $or: [{ _id: user.teacher }, { userId: user._id }] }).lean();
    const adminUserIds = await User.find({
      role: { $in: [ROLES.ADMIN, 'admin', 'dao-tao'] },
      status: { $ne: 'Locked' },
    }).distinct('_id');

    const otherTeacherUserIds = await User.find({
      role: { $in: [ROLES.TEACHER, 'teacher', 'giao-vien'] },
      _id: { $ne: user._id },
      status: { $ne: 'Locked' },
    }).distinct('_id');

    let studentUserIds = [];
    if (teacherDoc) {
      const teacherClassIds = await CourseClass.find({
        $or: [
          { teacherRef: teacherDoc._id },
          { teacherId: teacherDoc.id },
          teacherDoc.hoTen ? { teacher: teacherDoc.hoTen } : null,
        ].filter(Boolean),
      }).distinct('_id');

      const enrolledStudentIds = await Enrollment.find({ classRef: { $in: teacherClassIds } }).distinct('student');
      const students = await Student.find({ _id: { $in: enrolledStudentIds } }).distinct('userId');
      const userStudents = await User.find({ student: { $in: enrolledStudentIds }, status: { $ne: 'Locked' } }).distinct('_id');
      studentUserIds = [...students, ...userStudents];
    }

    eligibleUserIds = Array.from(new Set([...adminUserIds, ...otherTeacherUserIds, ...studentUserIds].map(String)));
  } else if (isStudent) {
    // Student can contact: Teachers of their enrolled classes + Admins
    const studentDoc = await Student.findOne({ $or: [{ _id: user.student }, { userId: user._id }] }).lean();
    const adminUserIds = await User.find({
      role: { $in: [ROLES.ADMIN, 'admin', 'dao-tao'] },
      status: { $ne: 'Locked' },
    }).distinct('_id');

    let teacherUserIds = [];
    if (studentDoc) {
      const enrolledClassIds = await Enrollment.find({ student: studentDoc._id }).distinct('classRef');
      const classes = await CourseClass.find({ _id: { $in: enrolledClassIds } }).lean();

      const teacherRefs = classes.map((c) => c.teacherRef).filter(Boolean);
      const teacherIds = classes.map((c) => c.teacherId).filter((id) => id != null);
      const teacherNames = classes.map((c) => c.teacher).filter(Boolean);

      const teachers = await Teacher.find({
        $or: [
          { _id: { $in: teacherRefs } },
          { id: { $in: teacherIds } },
          { hoTen: { $in: teacherNames } },
        ],
      }).distinct('userId');
      const userTeachers = await User.find({ teacher: { $in: teacherRefs }, status: { $ne: 'Locked' } }).distinct('_id');
      teacherUserIds = [...teachers, ...userTeachers];
    }

    eligibleUserIds = Array.from(new Set([...adminUserIds, ...teacherUserIds].map(String)));
  }

  const query = {
    _id: { $in: eligibleUserIds, $ne: user._id },
    status: { $ne: 'Locked' },
  };

  if (search && search.trim()) {
    const s = search.trim();
    query.$or = [
      { hoTen: { $regex: s, $options: 'i' } },
      { email: { $regex: s, $options: 'i' } },
    ];
  }

  const contacts = await User.find(query).select('hoTen role email avatar').sort({ hoTen: 1 }).lean();

  return contacts.map((c) => ({
    _id: c._id,
    name: c.hoTen || c.email || 'Người dùng',
    role: c.role,
    email: c.email,
    avatar: c.avatar?.url || (typeof c.avatar === 'string' ? c.avatar : ''),
  }));
}

/**
 * Returns messages for a channel (class group or direct conversation).
 */
export async function getMessages(user, { type = 'direct', classId = null, recipientId = null, limit = 100 }) {
  if (type === 'class_group') {
    if (!classId) throw AppError.badRequest('Thiếu thông tin lớp học phần');

    const targetClass = await CourseClass.findOne({
      $or: [
        mongoose.isValidObjectId(classId) ? { _id: classId } : null,
        { id: String(classId) },
      ].filter(Boolean),
    }).lean();

    if (!targetClass) throw AppError.notFound('Không tìm thấy lớp học phần');

    const allowed = await canUserAccessClass(user, targetClass._id);
    if (!allowed) {
      throw AppError.forbidden('Bạn không có quyền truy cập vào nhóm lớp học phần này');
    }

    // Mark messages as read by this user
    await ChatMessage.updateMany(
      { type: 'class_group', classRef: targetClass._id, readBy: { $ne: user._id } },
      { $addToSet: { readBy: user._id } }
    );

    const messages = await ChatMessage.find({ type: 'class_group', classRef: targetClass._id })
      .sort({ createdAt: 1 })
      .limit(Number(limit) || 100)
      .lean();

    const studentCount = await Enrollment.countDocuments({
      $or: [
        { classRef: targetClass._id },
        { classId: targetClass.id },
      ],
    });

    return {
      type: 'class_group',
      classInfo: {
        _id: targetClass._id,
        classId: targetClass.id,
        courseName: targetClass.courseName || targetClass.className || targetClass.id,
        className: targetClass.className || targetClass.courseName,
        teacher: targetClass.teacher || 'Chưa phân công',
        studentCount: studentCount || 0,
        hasStudents: (studentCount || 0) > 0,
        room: targetClass.room || '',
        memberCount: studentCount + (targetClass.teacher ? 1 : 0),
      },
      messages: messages.map((m) => ({
        _id: m._id,
        content: m.content,
        senderId: m.sender,
        senderName: m.senderName,
        senderRole: m.senderRole,
        senderAvatar: m.senderAvatar,
        isOwn: m.sender.toString() === user._id.toString(),
        createdAt: m.createdAt,
      })),
    };
  }

  // type === 'direct'
  if (!recipientId) throw AppError.badRequest('Thiếu thông tin người nhận');

  const partner = await User.findById(recipientId).lean();
  if (!partner) throw AppError.notFound('Không tìm thấy người dùng nhận tin nhắn');

  // Mark incoming messages as read
  await ChatMessage.updateMany(
    { type: 'direct', sender: partner._id, recipient: user._id, readBy: { $ne: user._id } },
    { $addToSet: { readBy: user._id } }
  );

  const messages = await ChatMessage.find({
    type: 'direct',
    $or: [
      { sender: user._id, recipient: partner._id },
      { sender: partner._id, recipient: user._id },
    ],
  })
    .sort({ createdAt: 1 })
    .limit(Number(limit) || 100)
    .lean();

  return {
    type: 'direct',
    partner: {
      _id: partner._id,
      name: partner.hoTen || partner.email || 'Người dùng',
      role: partner.role,
      email: partner.email,
      avatar: partner.avatar?.url || (typeof partner.avatar === 'string' ? partner.avatar : ''),
    },
    messages: messages.map((m) => ({
      _id: m._id,
      content: m.content,
      senderId: m.sender,
      senderName: m.senderName,
      senderRole: m.senderRole,
      senderAvatar: m.senderAvatar,
      isOwn: m.sender.toString() === user._id.toString(),
      createdAt: m.createdAt,
    })),
  };
}

/**
 * Sends a message to a class group or direct recipient.
 */
export async function sendMessage(user, { type = 'direct', classId = null, recipientId = null, content = '' }) {
  if (!content || !content.trim()) {
    throw AppError.badRequest('Nội dung tin nhắn không được để trống');
  }

  const senderName = user.hoTen || user.email || 'Người dùng';
  const senderAvatar = user.avatar?.url || (typeof user.avatar === 'string' ? user.avatar : '');

  if (type === 'class_group') {
    if (!classId) throw AppError.badRequest('Thiếu thông tin lớp học phần');

    const targetClass = await CourseClass.findOne({
      $or: [
        mongoose.isValidObjectId(classId) ? { _id: classId } : null,
        { id: String(classId) },
      ].filter(Boolean),
    });

    if (!targetClass) throw AppError.notFound('Không tìm thấy lớp học phần');

    const allowed = await canUserAccessClass(user, targetClass._id);
    if (!allowed) {
      throw AppError.forbidden('Bạn không có quyền gửi tin nhắn vào nhóm lớp học phần này');
    }

    const msg = new ChatMessage({
      type: 'class_group',
      classRef: targetClass._id,
      classId: targetClass.id,
      className: targetClass.courseName || targetClass.className || targetClass.id,
      sender: user._id,
      senderName,
      senderRole: user.role,
      senderAvatar,
      content: content.trim(),
      readBy: [user._id],
    });

    await msg.save();

    return {
      _id: msg._id,
      type: msg.type,
      classId: msg.classId,
      content: msg.content,
      senderId: msg.sender,
      senderName: msg.senderName,
      senderRole: msg.senderRole,
      senderAvatar: msg.senderAvatar,
      isOwn: true,
      createdAt: msg.createdAt,
    };
  }

  // Direct 1-on-1
  if (!recipientId) throw AppError.badRequest('Thiếu thông tin người nhận');

  const partner = await User.findById(recipientId);
  if (!partner) throw AppError.notFound('Không tìm thấy người dùng nhận tin nhắn');

  const allowed = await canUserDirectChat(user, partner);
  if (!allowed) {
    throw AppError.forbidden('Bạn không có quyền nhắn tin trực tiếp với người dùng này');
  }

  const msg = new ChatMessage({
    type: 'direct',
    recipient: partner._id,
    sender: user._id,
    senderName,
    senderRole: user.role,
    senderAvatar,
    content: content.trim(),
    readBy: [user._id],
  });

  await msg.save();

  return {
    _id: msg._id,
    type: msg.type,
    recipientId: msg.recipient,
    content: msg.content,
    senderId: msg.sender,
    senderName: msg.senderName,
    senderRole: msg.senderRole,
    senderAvatar: msg.senderAvatar,
    isOwn: true,
    createdAt: msg.createdAt,
  };
}

