import { AppError } from '../../lib/AppError.js';
import * as filesService from '../../lib/files.service.js';
import { ROLES } from '../../lib/roles.js';
import { Document } from './document.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { canAccessCourse, enrolledCourseIds, teacherAccessibleCourseIds } from '../shared/courseAccess.js';

export async function listDocuments(query, user) {
  const filter = {};
  if (query.courseId) filter.courseId = query.courseId;

  if (user.role === ROLES.STUDENT) {
    filter.status = 'Công khai';
    const courseIds = await enrolledCourseIds(user);
    if (!courseIds.length) return { data: [] };
    filter.courseId = query.courseId && courseIds.includes(query.courseId)
      ? query.courseId
      : { $in: courseIds };
  } else if (user.role === ROLES.TEACHER) {
    const courseIds = await teacherAccessibleCourseIds(user);
    if (!courseIds.length) return { data: [] };
    filter.courseId = query.courseId && courseIds.includes(query.courseId)
      ? query.courseId
      : { $in: courseIds };
  }

  const docs = await Document.find(filter).sort({ createdAt: -1 }).lean();
  // Never expose the raw Cloudinary publicId/url; downloads go through /download.
  return { data: docs.map(stripFile) };
}

function stripFile(doc) {
  const { file, ...rest } = doc;
  return {
    ...rest,
    classId: doc.classId || '',
    hasFile: Boolean(file?.publicId),
    size: file?.bytes || 0,
    format: file?.format || (doc.link ? 'Liên kết' : ''),
    link: doc.link || '',
  };
}

export async function createDocument({ courseId, classId, name, status, link }, files, user) {
  const course = await Course.findOne({ id: courseId });
  if (!course) throw AppError.badRequest('Học phần không tồn tại');

  // Teachers may only attach documents to courses they teach or in their department.
  if (user.role === ROLES.TEACHER) {
    const allowed = await canAccessCourse(user, courseId);
    if (!allowed) throw AppError.forbidden('Bạn không phụ trách học phần này');
  }

  let classRef = null;
  let targetClassId = '';
  if (classId) {
    const cls = await CourseClass.findOne({ id: classId });
    if (cls) {
      classRef = cls._id;
      targetClassId = cls.id;
    } else {
      targetClassId = classId;
    }
  }

  const fileList = Array.isArray(files) ? files : files ? [files] : [];
  if (!fileList.length && !link) {
    throw AppError.badRequest('Vui lòng chọn tệp tài liệu hoặc nhập đường link liên kết');
  }

  const teacher = user.role === ROLES.TEACHER ? await Teacher.findById(user.teacher).lean() : null;
  const createdDocs = [];

  if (fileList.length > 0) {
    for (const file of fileList) {
      const uploaded = await filesService.uploadBuffer(file.buffer, {
        folder: 'documents',
        resourceType: 'auto',
        access: 'authenticated',
      });

      const docName = fileList.length === 1 && name ? name : file.originalname;
      const doc = await Document.create({
        courseRef: course._id,
        courseId: course.id,
        classRef,
        classId: targetClassId,
        name: docName,
        file: uploaded,
        link: link || '',
        status: status || 'Công khai',
        uploadedByRef: teacher?._id || null,
        uploadedBy: teacher?.hoTen || user.email,
      });
      createdDocs.push(stripFile(doc.toObject()));
    }
  } else {
    // Only link provided
    const doc = await Document.create({
      courseRef: course._id,
      courseId: course.id,
      classRef,
      classId: targetClassId,
      name: name || link,
      file: {},
      link: link || '',
      status: status || 'Công khai',
      uploadedByRef: teacher?._id || null,
      uploadedBy: teacher?.hoTen || user.email,
    });
    createdDocs.push(stripFile(doc.toObject()));
  }

  if (createdDocs.length === 1) {
    return createdDocs[0];
  }
  return {
    ...createdDocs[0],
    items: createdDocs,
    totalCreated: createdDocs.length,
  };
}

export async function updateDocument(id, { classId, name, status, link }, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.TEACHER && !(await canAccessCourse(user, doc.courseId))) {
    throw AppError.forbidden('Bạn không phụ trách học phần này');
  }
  if (classId !== undefined) {
    if (classId) {
      const cls = await CourseClass.findOne({ id: classId });
      doc.classRef = cls?._id || null;
      doc.classId = cls?.id || classId;
    } else {
      doc.classRef = null;
      doc.classId = '';
    }
  }
  if (name !== undefined) doc.name = name;
  if (status !== undefined) doc.status = status;
  if (link !== undefined) doc.link = link;
  await doc.save();
  return stripFile(doc.toObject());
}

export async function deleteDocument(id, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.TEACHER && !(await canAccessCourse(user, doc.courseId))) {
    throw AppError.forbidden('Bạn không phụ trách học phần này');
  }

  await Document.deleteOne({ _id: doc._id });
  if (doc.file?.publicId) {
    await filesService
      .destroy(doc.file.publicId, { resourceType: doc.file.resourceType || 'raw', access: 'authenticated' })
      .catch(() => {});
  }
  return { success: true };
}

/** Issue a short-lived signed URL after checking the caller may access it. */
export async function getDownloadUrl(id, user) {
  const doc = await Document.findById(id).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.STUDENT && doc.status !== 'Công khai') {
    throw AppError.forbidden('Tài liệu không khả dụng');
  }
  const allowed = await canAccessCourse(user, doc.courseId);
  if (!allowed) throw AppError.forbidden('Bạn không có quyền tải tài liệu này');

  if (!doc.file?.publicId) {
    if (doc.link) {
      return { url: doc.link, name: doc.name, isExternal: true };
    }
    throw AppError.badRequest('Tài liệu không có tệp đính kèm');
  }

  const url = filesService.signedUrl(doc.file.publicId, {
    resourceType: doc.file.resourceType || 'raw',
    expiresInSeconds: 300,
  });
  return { url, name: doc.name };
}
