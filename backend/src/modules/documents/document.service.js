import { AppError } from '../../lib/AppError.js';
import * as filesService from '../../lib/files.service.js';
import { ROLES } from '../../lib/roles.js';
import { Document } from './document.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { canAccessCourse } from '../shared/courseAccess.js';

export async function listDocuments(query, user) {
  const filter = {};
  if (query.courseId) filter.courseId = query.courseId;
  // Students only ever see published documents.
  if (user.role === ROLES.STUDENT) filter.status = 'Công khai';

  const docs = await Document.find(filter).sort({ createdAt: -1 }).lean();
  // Never expose the raw Cloudinary publicId/url; downloads go through /download.
  return { data: docs.map(stripFile) };
}

function stripFile(doc) {
  const { file, ...rest } = doc;
  return { ...rest, size: file?.bytes || 0, format: file?.format || '' };
}

export async function createDocument({ courseId, name, status }, file, user) {
  const course = await Course.findOne({ id: courseId });
  if (!course) throw AppError.badRequest('Học phần không tồn tại');
  if (!file) throw AppError.badRequest('Thiếu tệp tài liệu');

  // Teachers may only attach documents to courses they teach.
  if (user.role === ROLES.TEACHER) {
    const allowed = await canAccessCourse(user, courseId);
    if (!allowed) throw AppError.forbidden('Bạn không phụ trách học phần này');
  }

  const uploaded = await filesService.uploadBuffer(file.buffer, {
    folder: 'documents',
    resourceType: 'auto',
    access: 'authenticated',
  });

  const teacher = user.role === ROLES.TEACHER ? await Teacher.findById(user.teacher).lean() : null;
  const doc = await Document.create({
    courseRef: course._id,
    courseId: course.id,
    name: name || file.originalname,
    file: uploaded,
    status: status || 'Công khai',
    uploadedByRef: teacher?._id || null,
    uploadedBy: teacher?.hoTen || user.email,
  });
  return stripFile(doc.toObject());
}

export async function updateDocument(id, { name, status }, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.TEACHER && !(await canAccessCourse(user, doc.courseId))) {
    throw AppError.forbidden('Bạn không phụ trách học phần này');
  }
  if (name !== undefined) doc.name = name;
  if (status !== undefined) doc.status = status;
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

  const url = filesService.signedUrl(doc.file.publicId, {
    resourceType: doc.file.resourceType || 'raw',
    expiresInSeconds: 300,
  });
  return { url, name: doc.name };
}
