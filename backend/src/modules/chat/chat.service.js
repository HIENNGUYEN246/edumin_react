import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { uploadBuffer } from '../../lib/files.service.js';
import { config } from '../../config/env.js';
import { AppError } from '../../lib/AppError.js';
import { ROLES } from '../../lib/roles.js';
import { ChatMessage } from './chatMessage.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { Student } from '../students/student.model.js';
import { User } from '../auth/user.model.js';

function formatLastMessageText(msg) {
  if (!msg) return '';
  if (msg.content && msg.content.trim()) return msg.content.trim();
  if (msg.attachments && msg.attachments.length > 0) {
    const first = msg.attachments[0];
    if (first.type === 'image') return '📷 [Hình ảnh]';
    if (first.type === 'audio') return '🎤 [Tin nhắn thoại]';
    return `📎 ${first.name || 'Tệp đính kèm'}`;
  }
  return '';
}

/**
 * Builds an accent-insensitive regex pattern for Vietnamese search.
 * Converts "hien" -> "h[iIìÌíÍỉỈĩĨịỊ][eEèÈéÉẻẺẽẼẹẸêÊềỀếẾểỂễỄệỆ]n"
 * so searching without accents or with different accents matches accurately.
 */
export function buildVietnameseRegexPattern(str = '') {
  if (!str || !str.trim()) return '';
  const norm = str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

  const map = {
    a: '[aAàÀáÁảẢãÃạẠăĂằẰắẮẳẲẵẴặẶâÂầẦấẤẩẨẫẪậẬ]',
    d: '[dDđĐ]',
    e: '[eEèÈéÉẻẺẽẼẹẸêÊềỀếẾểỂễỄệỆ]',
    i: '[iIìÌíÍỉỈĩĨịỊ]',
    o: '[oOòÒóÓỏỎõÕọỌôÔồỒốỐổỔỗỖộỘơƠờỜớỚởỞỡỠợỢ]',
    u: '[uUùÙúÚủỦũŨụỤưƯừỪứỨửỬữỮựỰ]',
    y: '[yYỳỲýÝỷỶỹỸỵỴ]',
  };

  let pattern = '';
  for (const ch of norm) {
    const lower = ch.toLowerCase();
    if (map[lower]) {
      pattern += map[lower];
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      pattern += ch;
    } else if (/\s/.test(ch)) {
      pattern += '\\s+';
    } else {
      pattern += '\\' + ch;
    }
  }
  return pattern;
}

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

  // Teacher <-> Teacher: Cho phép trao đổi nội bộ
  const isTeacherA = roleA === ROLES.TEACHER || roleA === 'teacher' || roleA === 'giao-vien';
  const isTeacherB = roleB === ROLES.TEACHER || roleB === 'teacher' || roleB === 'giao-vien';
  if (isTeacherA && isTeacherB) return true;

  // Teacher <-> Student & Student <-> Teacher:
  // Cho phép nhắn tin trao đổi học tập (cả thành viên trong lớp và khi chủ động tìm kiếm liên hệ)
  const isStudentA = roleA === ROLES.STUDENT || roleA === 'student' || roleA === 'sinh-vien';
  const isStudentB = roleB === ROLES.STUDENT || roleB === 'student' || roleB === 'sinh-vien';
  if ((isTeacherA && isStudentB) || (isStudentA && isTeacherB)) {
    return true;
  }

  // Student <-> Student: Cho phép trao đổi
  if (isStudentA && isStudentB) {
    return true;
  }

  return true;
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

  const isAdmin = user.role === ROLES.ADMIN || user.role === 'admin' || user.role === 'dao-tao';

  const classGroups = await Promise.all(
    classes.map(async (c) => {
      const classUnreadFilter = {
        type: 'class_group',
        classRef: c._id,
        sender: { $ne: user._id },
        readBy: { $ne: user._id },
      };

      if (isAdmin) {
        // Admin chỉ nhận thông báo và tính tin chưa đọc trong nhóm lớp khi được nhắc tới bằng @
        classUnreadFilter.$or = [
          { 'mentions.userId': user._id },
          { 'mentions.role': { $in: ['admin', 'dao-tao'] } },
          { 'mentions.name': { $in: ['admin', 'dao-tao', '@admin', '@all'] } },
          { content: { $regex: /@(admin|đào tạo|dao tao|all)/i } },
        ];
      }

      const [lastMsg, unreadCount, studentCount] = await Promise.all([
        ChatMessage.findOne({ type: 'class_group', classRef: c._id }).sort({ createdAt: -1 }).lean(),
        ChatMessage.countDocuments(classUnreadFilter),
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
              content: formatLastMessageText(lastMsg),
              senderName: lastMsg.senderName,
              senderRole: lastMsg.senderRole,
              createdAt: lastMsg.createdAt,
              attachments: lastMsg.attachments || [],
            }
          : null,
        unreadCount,
      };
    })
  );

  // Sort classGroups: newest active messages first, then fallback to classId
  classGroups.sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (timeA !== timeB) return timeB - timeA;
    return (a.classId || '').localeCompare(b.classId || '');
  });

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

  const directTeacherObjIds = partnerUsers.filter((c) => c.teacher).map((c) => c.teacher);
  const directStudentObjIds = partnerUsers.filter((c) => c.student).map((c) => c.student);
  const [directTeachersDocs, directStudentsDocs] = await Promise.all([
    Teacher.find({
      $or: [
        { _id: { $in: directTeacherObjIds } },
        { userId: { $in: partnerIds } },
      ],
    })
      .select('_id id userId')
      .lean(),
    Student.find({
      $or: [
        { _id: { $in: directStudentObjIds } },
        { userId: { $in: partnerIds } },
      ],
    })
      .select('_id id userId')
      .lean(),
  ]);

  const teacherCodeMap = new Map();
  directTeachersDocs.forEach((t) => {
    const code = `GV-${String(t.id).padStart(3, '0')}`;
    teacherCodeMap.set(String(t._id), code);
    if (t.userId) teacherCodeMap.set(String(t.userId), code);
  });

  const studentCodeMap = new Map();
  directStudentsDocs.forEach((s) => {
    const code = `SV-${String(s.id).padStart(3, '0')}`;
    studentCodeMap.set(String(s._id), code);
    if (s.userId) studentCodeMap.set(String(s.userId), code);
  });

  const contacts = await getContactsForUser(user);
  const inClassUserSet = new Set(contacts.map((c) => String(c._id)));

  const directConversations = partnerIds
    .map((id) => {
      const partner = userDict.get(id);
      if (!partner) return null;
      const info = partnerMap.get(id);
      const avatarUrl = partner.avatar?.url || (typeof partner.avatar === 'string' ? partner.avatar : '');
      const partnerCode =
        (partner.teacher && teacherCodeMap.get(String(partner.teacher))) ||
        teacherCodeMap.get(String(partner._id)) ||
        (partner.student && studentCodeMap.get(String(partner.student))) ||
        studentCodeMap.get(String(partner._id)) ||
        '';

      return {
        partnerId: partner._id,
        name: partner.hoTen || partner.email || 'Người dùng',
        role: partner.role,
        email: partner.email,
        code: partnerCode,
        inMyClass: inClassUserSet.has(String(partner._id)),
        avatar: avatarUrl,
        lastMessage: {
          content: formatLastMessageText(info.lastMessage),
          senderName: info.lastMessage.senderName,
          senderRole: info.lastMessage.senderRole,
          createdAt: info.lastMessage.createdAt,
          isOwn: info.lastMessage.sender.toString() === user._id.toString(),
          attachments: info.lastMessage.attachments || [],
        },
        unreadCount: info.unreadCount,
      };
    })
    .filter(Boolean);

  // Sort directConversations: newest active messages always at the very top!
  directConversations.sort((a, b) => {
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const totalUnread =
    classGroups.reduce((acc, c) => acc + (c.unreadCount || 0), 0) +
    directConversations.reduce((acc, d) => acc + (d.unreadCount || 0), 0);

  return {
    classGroups,
    directConversations,
    contacts,
    totalUnread,
  };
}

/**
 * Returns available contacts for starting a direct 1-1 chat.
 * - Khi KHÔNG tìm kiếm (!search): Chỉ chủ động hiển thị thành viên trong các lớp học phần của mình.
 * - Khi CÓ tìm kiếm (search): Cho phép chủ động tìm kiếm giảng viên/sinh viên toàn trường theo tên hoặc mã số (GV/SV).
 */
export async function getContactsForUser(user, search = '') {
  const role = user.role;
  const isAdmin = role === ROLES.ADMIN || role === 'admin' || role === 'dao-tao';
  const isTeacher = role === ROLES.TEACHER || role === 'teacher' || role === 'giao-vien';
  const isStudent = role === ROLES.STUDENT || role === 'student' || role === 'sinh-vien';

  const isSearching = Boolean(search && search.trim());
  const s = search ? search.trim() : '';

  // 1. Tập hợp các ID người dùng thuộc lớp học phần trực tiếp của user
  const inClassUserIds = new Set();

  const adminUsers = await User.find({
    role: { $in: [ROLES.ADMIN, 'admin', 'dao-tao'] },
    status: { $ne: 'Locked' },
    _id: { $ne: user._id },
  }).distinct('_id');
  adminUsers.forEach((id) => inClassUserIds.add(String(id)));

  if (isTeacher) {
    const teacherDoc = await Teacher.findOne({
      $or: [
        user.teacher ? { _id: user.teacher } : null,
        user.teacherId ? { _id: user.teacherId } : null,
        user._id ? { userId: user._id } : null,
        user.email ? { email: user.email.toLowerCase() } : null,
      ].filter(Boolean),
    }).lean();

    if (teacherDoc) {
      const teacherClassIds = await CourseClass.find({
        $or: [
          { teacherRef: teacherDoc._id },
          teacherDoc.id != null ? { teacherId: teacherDoc.id } : null,
          teacherDoc.hoTen ? { teacher: teacherDoc.hoTen } : null,
        ].filter(Boolean),
      }).distinct('_id');

      const teacherClasses = await CourseClass.find({
        $or: [
          { teacherRef: teacherDoc._id },
          teacherDoc.id != null ? { teacherId: teacherDoc.id } : null,
          teacherDoc.hoTen ? { teacher: teacherDoc.hoTen } : null,
        ].filter(Boolean),
      }).lean();

      const teacherClassCodes = teacherClasses.map((c) => c.id).filter(Boolean);

      // Sinh viên ghi danh trong các lớp học phần mình phụ trách
      const enrolledStudentIds = await Enrollment.find({
        $or: [
          { classRef: { $in: teacherClassIds } },
          { classId: { $in: teacherClassCodes } },
        ],
      }).distinct('student');

      const students = await Student.find({ _id: { $in: enrolledStudentIds } }).lean();
      const studentUserIds = students.map((s) => s.userId).filter(Boolean);
      const studentEmails = students.map((s) => s.email?.toLowerCase()).filter(Boolean);

      const userStudents = await User.find({
        $or: [
          { _id: { $in: studentUserIds } },
          { student: { $in: enrolledStudentIds } },
          { studentId: { $in: enrolledStudentIds } },
          { email: { $in: studentEmails } },
        ].filter(Boolean),
        status: { $ne: 'Locked' },
      }).distinct('_id');

      studentUserIds.forEach((id) => inClassUserIds.add(String(id)));
      userStudents.forEach((id) => inClassUserIds.add(String(id)));

      // Giảng viên cùng tham gia giảng dạy lớp (nếu có)
      const otherTeacherRefs = teacherClasses
        .map((c) => c.teacherRef)
        .filter((id) => id && String(id) !== String(teacherDoc._id));
      if (otherTeacherRefs.length > 0) {
        const coTeachers = await Teacher.find({ _id: { $in: otherTeacherRefs } }).distinct('userId');
        coTeachers.forEach((id) => inClassUserIds.add(String(id)));
      }
    }
  } else if (isStudent) {
    const studentDoc = await Student.findOne({
      $or: [
        user.student ? { _id: user.student } : null,
        user.studentId ? { _id: user.studentId } : null,
        user._id ? { userId: user._id } : null,
        user.email ? { email: user.email.toLowerCase() } : null,
      ].filter(Boolean),
    }).lean();

    if (studentDoc) {
      const studentEnrollments = await Enrollment.find({ student: studentDoc._id }).lean();
      const enrolledClassRefs = studentEnrollments.map((e) => e.classRef).filter(Boolean);
      const enrolledClassCodes = studentEnrollments.map((e) => e.classId).filter(Boolean);

      const classes = await CourseClass.find({
        $or: [
          { _id: { $in: enrolledClassRefs } },
          { id: { $in: enrolledClassCodes } },
        ].filter(Boolean),
      }).lean();

      // Giảng viên phụ trách các lớp học phần sinh viên này đang học
      const teacherRefs = classes.map((c) => c.teacherRef).filter(Boolean);
      const teacherIds = classes.map((c) => c.teacherId).filter((id) => id != null);
      const teacherNames = classes.map((c) => c.teacher).filter(Boolean);

      const teachers = await Teacher.find({
        $or: [
          { _id: { $in: teacherRefs } },
          { id: { $in: teacherIds } },
          { hoTen: { $in: teacherNames } },
        ].filter(Boolean),
      }).lean();

      const teacherUserIds = teachers.map((t) => t.userId).filter(Boolean);
      const teacherEmails = teachers.map((t) => t.email?.toLowerCase()).filter(Boolean);

      const userTeachers = await User.find({
        $or: [
          { _id: { $in: teacherUserIds } },
          { teacher: { $in: teacherRefs } },
          { teacherId: { $in: teacherRefs } },
          { email: { $in: teacherEmails } },
        ].filter(Boolean),
        status: { $ne: 'Locked' },
      }).distinct('_id');

      teacherUserIds.forEach((id) => inClassUserIds.add(String(id)));
      userTeachers.forEach((id) => inClassUserIds.add(String(id)));

      // Bạn học cùng các lớp học phần
      const allClassRefs = classes.map((c) => c._id);
      const allClassCodes = classes.map((c) => c.id).filter(Boolean);
      const classmateStudentIds = await Enrollment.find({
        $or: [
          { classRef: { $in: allClassRefs } },
          { classId: { $in: allClassCodes } },
        ].filter(Boolean),
        student: { $ne: studentDoc._id },
      }).distinct('student');

      const classmateDocs = await Student.find({ _id: { $in: classmateStudentIds } }).lean();
      const classmateUserIds = classmateDocs.map((s) => s.userId).filter(Boolean);
      const classmateEmails = classmateDocs.map((s) => s.email?.toLowerCase()).filter(Boolean);

      const userClassmates = await User.find({
        $or: [
          { _id: { $in: classmateUserIds } },
          { student: { $in: classmateStudentIds } },
          { studentId: { $in: classmateStudentIds } },
          { email: { $in: classmateEmails } },
        ].filter(Boolean),
        status: { $ne: 'Locked' },
      }).distinct('_id');

      classmateUserIds.forEach((id) => inClassUserIds.add(String(id)));
      userClassmates.forEach((id) => inClassUserIds.add(String(id)));
    }
  } else if (isAdmin) {
    // Admin mặc định quản lý toàn bộ
    const allUsers = await User.find({ _id: { $ne: user._id }, status: { $ne: 'Locked' } }).distinct('_id');
    allUsers.forEach((id) => inClassUserIds.add(String(id)));
  }

  // 2. Xử lý khi KHÔNG TÌM KIẾM: CHỈ TRẢ VỀ THÀNH VIÊN TRONG LỚP HỌC PHẦN CỦA MÌNH
  if (!isSearching) {
    const inClassList = Array.from(inClassUserIds).filter((id) => id !== String(user._id));
    const contacts = await User.find({
      _id: { $in: inClassList },
      status: { $ne: 'Locked' },
    })
      .select('hoTen role email avatar teacher student teacherId studentId')
      .sort({ hoTen: 1 })
      .lean();

    const inClassUserObjIds = contacts.map((c) => c._id);
    const teacherObjIds = contacts.map((c) => c.teacher || c.teacherId).filter(Boolean);
    const studentObjIds = contacts.map((c) => c.student || c.studentId).filter(Boolean);
    const [teachersDocs, studentsDocs] = await Promise.all([
      Teacher.find({
        $or: [
          { _id: { $in: teacherObjIds } },
          { userId: { $in: inClassUserObjIds } },
        ],
      })
        .select('_id id userId')
        .lean(),
      Student.find({
        $or: [
          { _id: { $in: studentObjIds } },
          { userId: { $in: inClassUserObjIds } },
        ],
      })
        .select('_id id userId')
        .lean(),
    ]);

    const teacherCodeMap = new Map();
    teachersDocs.forEach((t) => {
      const code = `GV-${String(t.id).padStart(3, '0')}`;
      teacherCodeMap.set(String(t._id), code);
      if (t.userId) teacherCodeMap.set(String(t.userId), code);
    });

    const studentCodeMap = new Map();
    studentsDocs.forEach((s) => {
      const code = `SV-${String(s.id).padStart(3, '0')}`;
      studentCodeMap.set(String(s._id), code);
      if (s.userId) studentCodeMap.set(String(s.userId), code);
    });

    return contacts.map((c) => {
      const code =
        (c.teacher && teacherCodeMap.get(String(c.teacher))) ||
        (c.teacherId && teacherCodeMap.get(String(c.teacherId))) ||
        teacherCodeMap.get(String(c._id)) ||
        (c.student && studentCodeMap.get(String(c.student))) ||
        (c.studentId && studentCodeMap.get(String(c.studentId))) ||
        studentCodeMap.get(String(c._id)) ||
        '';

      return {
        _id: c._id,
        name: c.hoTen || c.email || 'Người dùng',
        role: c.role,
        email: c.email,
        code,
        inMyClass: true,
        avatar: c.avatar?.url || (typeof c.avatar === 'string' ? c.avatar : ''),
      };
    });
  }

  // 3. Xử lý khi CÓ TÌM KIẾM: CHỦ ĐỘNG TÌM KIẾM TOÀN TRƯỜNG THEO TÊN HOẶC MÃ SỐ (GV/SV)
  const numMatch = s.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : null;
  const vnPattern = buildVietnameseRegexPattern(s);

  const teacherSearchConditions = [
    num !== null ? { id: num } : null,
    { hoTen: { $regex: s, $options: 'i' } },
    vnPattern ? { hoTen: { $regex: vnPattern, $options: 'i' } } : null,
    { email: { $regex: s, $options: 'i' } },
  ].filter(Boolean);

  const studentSearchConditions = [
    num !== null ? { id: num } : null,
    { hoTen: { $regex: s, $options: 'i' } },
    vnPattern ? { hoTen: { $regex: vnPattern, $options: 'i' } } : null,
    { email: { $regex: s, $options: 'i' } },
  ].filter(Boolean);

  const [matchedTeachers, matchedStudents] = await Promise.all([
    Teacher.find({ $or: teacherSearchConditions })
      .select('_id id userId email hoTen')
      .lean(),
    Student.find({ $or: studentSearchConditions })
      .select('_id id userId email hoTen')
      .lean(),
  ]);

  const teacherUserIds = matchedTeachers.map((t) => t.userId).filter(Boolean);
  const teacherDocIds = matchedTeachers.map((t) => t._id);
  const teacherEmails = matchedTeachers.map((t) => t.email?.toLowerCase()).filter(Boolean);

  const studentUserIds = matchedStudents.map((s) => s.userId).filter(Boolean);
  const studentDocIds = matchedStudents.map((s) => s._id);
  const studentEmails = matchedStudents.map((s) => s.email?.toLowerCase()).filter(Boolean);

  const searchConditions = [
    { hoTen: { $regex: s, $options: 'i' } },
    vnPattern ? { hoTen: { $regex: vnPattern, $options: 'i' } } : null,
    { email: { $regex: s, $options: 'i' } },
  ].filter(Boolean);
  if (teacherUserIds.length > 0 || studentUserIds.length > 0) {
    searchConditions.push({ _id: { $in: [...teacherUserIds, ...studentUserIds] } });
  }
  if (teacherDocIds.length > 0) {
    searchConditions.push({ teacher: { $in: teacherDocIds } }, { teacherId: { $in: teacherDocIds } });
  }
  if (studentDocIds.length > 0) {
    searchConditions.push({ student: { $in: studentDocIds } }, { studentId: { $in: studentDocIds } });
  }
  if (teacherEmails.length > 0 || studentEmails.length > 0) {
    searchConditions.push({ email: { $in: [...teacherEmails, ...studentEmails] } });
  }

  const foundUsers = await User.find({
    $and: [
      { _id: { $ne: user._id }, status: { $ne: 'Locked' } },
      { $or: searchConditions },
    ],
  })
    .select('hoTen role email avatar teacher student teacherId studentId')
    .limit(40)
    .lean();

  const foundUserIds = foundUsers.map((u) => u._id);
  const teacherObjIds = foundUsers
    .map((c) => c.teacher || c.teacherId)
    .filter(Boolean)
    .concat(teacherDocIds);
  const studentObjIds = foundUsers
    .map((c) => c.student || c.studentId)
    .filter(Boolean)
    .concat(studentDocIds);

  const [teachersDocs, studentsDocs] = await Promise.all([
    Teacher.find({
      $or: [
        { _id: { $in: teacherObjIds } },
        { userId: { $in: foundUserIds } },
      ],
    })
      .select('_id id userId')
      .lean(),
    Student.find({
      $or: [
        { _id: { $in: studentObjIds } },
        { userId: { $in: foundUserIds } },
      ],
    })
      .select('_id id userId')
      .lean(),
  ]);

  const teacherCodeMap = new Map();
  teachersDocs.forEach((t) => {
    const code = `GV-${String(t.id).padStart(3, '0')}`;
    teacherCodeMap.set(String(t._id), code);
    if (t.userId) teacherCodeMap.set(String(t.userId), code);
  });

  const studentCodeMap = new Map();
  studentsDocs.forEach((s) => {
    const code = `SV-${String(s.id).padStart(3, '0')}`;
    studentCodeMap.set(String(s._id), code);
    if (s.userId) studentCodeMap.set(String(s.userId), code);
  });

  return foundUsers.map((c) => {
    const code =
      (c.teacher && teacherCodeMap.get(String(c.teacher))) ||
      (c.teacherId && teacherCodeMap.get(String(c.teacherId))) ||
      teacherCodeMap.get(String(c._id)) ||
      (c.student && studentCodeMap.get(String(c.student))) ||
      (c.studentId && studentCodeMap.get(String(c.studentId))) ||
      studentCodeMap.get(String(c._id)) ||
      '';

    return {
      _id: c._id,
      name: c.hoTen || c.email || 'Người dùng',
      role: c.role,
      email: c.email,
      code,
      inMyClass: inClassUserIds.has(String(c._id)),
      avatar: c.avatar?.url || (typeof c.avatar === 'string' ? c.avatar : ''),
    };
  });
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

    // Lấy danh sách thành viên trong lớp phục vụ nhắc nhở trực tiếp bằng @
    const enrollments = await Enrollment.find({
      $or: [
        { classRef: targetClass._id },
        { classId: targetClass.id },
      ],
    }).lean();

    const enrolledStudentIds = enrollments.map((e) => e.student).filter(Boolean);
    const studentsDocs = await Student.find({ _id: { $in: enrolledStudentIds } })
      .select('_id id userId hoTen email')
      .lean();
    const studentUserIds = studentsDocs.map((s) => s.userId).filter(Boolean);

    const studentUsers = await User.find({
      $or: [
        { _id: { $in: studentUserIds } },
        { student: { $in: enrolledStudentIds } },
        { studentId: { $in: enrolledStudentIds } },
      ],
      status: { $ne: 'Locked' },
    })
      .select('_id hoTen email avatar role student studentId')
      .lean();

    const studentCodeMap = new Map();
    studentsDocs.forEach((s) => {
      const code = `SV-${String(s.id).padStart(3, '0')}`;
      studentCodeMap.set(String(s._id), code);
      if (s.userId) studentCodeMap.set(String(s.userId), code);
    });

    const members = [
      {
        userId: 'all',
        name: 'Tất cả cả lớp',
        mentionKey: 'all',
        role: 'system',
        code: 'ALL',
        avatar: '',
      },
      {
        userId: 'admin',
        name: 'Ban Quản trị & Đào tạo',
        mentionKey: 'admin',
        role: 'dao-tao',
        code: 'ADMIN',
        avatar: '',
      },
    ];

    if (targetClass.teacherRef || targetClass.teacherId || targetClass.teacher) {
      const teacherDoc = await Teacher.findOne({
        $or: [
          targetClass.teacherRef ? { _id: targetClass.teacherRef } : null,
          targetClass.teacherId != null ? { id: targetClass.teacherId } : null,
          targetClass.teacher ? { hoTen: targetClass.teacher } : null,
        ].filter(Boolean),
      })
        .select('_id id userId hoTen email')
        .lean();

      if (teacherDoc) {
        members.push({
          userId: teacherDoc.userId ? String(teacherDoc.userId) : String(teacherDoc._id),
          name: teacherDoc.hoTen || targetClass.teacher || 'Giảng viên',
          mentionKey: teacherDoc.hoTen || 'Giảng viên',
          role: 'giao-vien',
          code: `GV-${String(teacherDoc.id).padStart(3, '0')}`,
          avatar: '',
        });
      }
    }

    studentUsers.forEach((su) => {
      const code =
        studentCodeMap.get(String(su._id)) ||
        (su.student && studentCodeMap.get(String(su.student))) ||
        (su.studentId && studentCodeMap.get(String(su.studentId))) ||
        '';
      members.push({
        userId: String(su._id),
        name: su.hoTen || su.email || 'Sinh viên',
        mentionKey: su.hoTen || su.email,
        role: su.role || 'sinh-vien',
        code,
        avatar: su.avatar?.url || (typeof su.avatar === 'string' ? su.avatar : ''),
      });
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
        members,
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
        attachments: m.attachments || [],
        mentions: m.mentions || [],
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
      attachments: m.attachments || [],
    })),
  };
}

/**
 * Sends a message to a class group or direct recipient.
 */
export async function sendMessage(
  user,
  { type = 'direct', classId = null, recipientId = null, content = '', attachments = [], mentions = [] }
) {
  const hasContent = content && content.trim();
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!hasContent && !hasAttachments) {
    throw AppError.badRequest('Nội dung tin nhắn hoặc tệp đính kèm không được để trống');
  }

  let finalContent = (content || '').trim();
  if (!finalContent && hasAttachments) {
    const first = attachments[0];
    if (first.type === 'image') finalContent = '[Hình ảnh]';
    else if (first.type === 'audio') finalContent = '🎤 [Tin nhắn thoại]';
    else finalContent = `📎 ${first.name || 'Tệp đính kèm'}`;
  }

  const senderName = user.hoTen || user.email || 'Người dùng';
  const senderAvatar = user.avatar?.url || (typeof user.avatar === 'string' ? user.avatar : '');

  const formattedAttachments = (attachments || []).map((att) => ({
    url: att.url || '',
    name: att.name || 'Tệp đính kèm',
    type: att.type || 'document',
    size: Number(att.size) || 0,
    duration: Number(att.duration) || 0,
  }));

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

    let finalMentions = Array.isArray(mentions) ? [...mentions] : [];
    // Tự động nhận diện @admin hoặc @all trong nội dung tin nhắn nếu chưa có
    if (/@(admin|dao-tao|đào tạo|dao tao)/i.test(finalContent)) {
      if (!finalMentions.some((m) => m.role === 'admin' || m.role === 'dao-tao')) {
        finalMentions.push({ userId: null, name: 'Ban Quản trị & Đào tạo', role: 'dao-tao' });
      }
    }
    if (/@all/i.test(finalContent)) {
      if (!finalMentions.some((m) => m.name === 'all')) {
        finalMentions.push({ userId: null, name: 'all', role: 'all' });
      }
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
      content: finalContent,
      attachments: formattedAttachments,
      mentions: finalMentions,
      readBy: [user._id],
    });

    await msg.save();

    return {
      _id: msg._id,
      type: msg.type,
      classId: msg.classId,
      content: msg.content,
      attachments: msg.attachments,
      mentions: msg.mentions,
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
    content: finalContent,
    attachments: formattedAttachments,
    readBy: [user._id],
  });

  await msg.save();

  return {
    _id: msg._id,
    type: msg.type,
    recipientId: msg.recipient,
    content: msg.content,
    attachments: msg.attachments,
    senderId: msg.sender,
    senderName: msg.senderName,
    senderRole: msg.senderRole,
    senderAvatar: msg.senderAvatar,
    isOwn: true,
    createdAt: msg.createdAt,
  };
}

/**
 * Uploads a chat attachment (Image, Document, Voice audio)
 */
export async function uploadChatAttachment(file, duration = 0) {
  if (!file) throw AppError.badRequest('Không tìm thấy tệp tải lên');

  let type = 'document';
  const mime = file.mimetype || '';
  const originalName = file.originalname || 'file';

  if (mime.startsWith('image/')) {
    type = 'image';
  } else if (
    mime.startsWith('audio/') ||
    originalName.endsWith('.webm') ||
    originalName.endsWith('.mp3') ||
    originalName.endsWith('.wav') ||
    originalName.endsWith('.ogg') ||
    originalName.endsWith('.m4a')
  ) {
    type = 'audio';
  }

  // 1. Try Cloudinary if enabled
  if (config.cloudinaryEnabled) {
    try {
      const resourceType = type === 'image' ? 'image' : type === 'audio' ? 'video' : 'raw';
      const result = await uploadBuffer(file.buffer, {
        folder: `chat/${type}s`,
        resourceType,
        access: 'public',
      });
      return {
        url: result.url,
        name: originalName,
        type,
        size: file.size,
        duration: Number(duration) || 0,
      };
    } catch (err) {
      console.warn('[Chat Upload] Cloudinary upload failed, falling back to local storage:', err?.message || err);
    }
  }

  // 2. Local fallback storage in uploads/chat/
  const uploadDir = path.join(process.cwd(), 'uploads', 'chat');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const ext = path.extname(originalName) || (type === 'image' ? '.jpg' : type === 'audio' ? '.webm' : '');
  const cleanBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeFilename = `${Date.now()}-${cleanBaseName}${ext}`;
  const filePath = path.join(uploadDir, safeFilename);

  fs.writeFileSync(filePath, file.buffer);

  return {
    url: `/uploads/chat/${safeFilename}`,
    name: originalName,
    type,
    size: file.size,
    duration: Number(duration) || 0,
  };
}

