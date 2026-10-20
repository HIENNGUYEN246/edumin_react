import mongoose from 'mongoose';
import { AppError } from '../../lib/AppError.js';
import * as filesService from '../../lib/files.service.js';
import { ROLES } from '../../lib/roles.js';
import { Document } from './document.model.js';
import { Course } from '../courses/course.model.js';
import { Teacher } from '../teachers/teacher.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { canAccessCourse, enrolledCourseIds, teacherAccessibleCourseIds } from '../shared/courseAccess.js';
import { extractTextFromFile } from './textExtractor.js';
import {
  findRelevantDocument,
  summarizeDocument,
  generateQuizFromDocument,
} from './documentRag.service.js';

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

export function getMimeType(filename = '', format = '') {
  let ext = (filename.split('.').pop() || format || '').toLowerCase().replace(/^\./, '');
  if (!ext || ext === 'raw') {
    const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
    if (match) ext = match[1].toLowerCase();
  }
  switch (ext) {
    case 'pdf':
      return 'application/pdf';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'doc':
      return 'application/msword';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'csv':
      return 'text/csv; charset=utf-8';
    case 'pptx':
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case 'ppt':
      return 'application/vnd.ms-powerpoint';
    case 'txt':
    case 'log':
      return 'text/plain; charset=utf-8';
    case 'md':
      return 'text/markdown; charset=utf-8';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'zip':
      return 'application/zip';
    case 'rar':
      return 'application/vnd.rar';
    case '7z':
      return 'application/x-7z-compressed';
    default:
      return 'application/octet-stream';
  }
}

function stripFile(doc) {
  const { file, ...rest } = doc;
  let resolvedFormat = (file?.format || '').toLowerCase();
  const rawName = file?.originalName || doc.name || '';
  if (!resolvedFormat || resolvedFormat === 'raw' || resolvedFormat === 'image') {
    const match = /\.([a-zA-Z0-9]+)$/.exec(rawName);
    if (match) {
      resolvedFormat = match[1].toLowerCase();
    }
  }
  if (!resolvedFormat && doc.link) {
    resolvedFormat = 'Liên kết';
  }

  const hasFile = Boolean(file?.publicId || file?.url);
  const fileUrl = file?.url || '';
  const directUrl = fileUrl || doc.link || '';

  return {
    ...rest,
    classId: doc.classId || '',
    fileName: file?.originalName || doc.name || '',
    hasFile,
    size: file?.bytes || 0,
    format: resolvedFormat,
    fileUrl,
    directUrl,
    link: doc.link || '',
    extractedText: doc.extractedText || '',
    summary: doc.summary || '',
    chapters: doc.chapters || [],
    keyConcepts: doc.keyConcepts || [],
  };
}

export async function createDocument({ courseId, classId, name, status, link }, files, user) {
  const course = await Course.findOne({
    $or: [
      { id: courseId },
      { id: new RegExp(`^${courseId}$`, 'i') },
    ],
  });
  if (!course) throw AppError.badRequest('Học phần không tồn tại');

  // Teachers may only attach documents to courses they teach or in their department.
  if (user.role === ROLES.TEACHER) {
    let allowed = await canAccessCourse(user, course.id);
    if (!allowed && classId) {
      // Secondary check: verify if the teacher is assigned directly to this specific class
      const cls = await CourseClass.findOne({
        $or: [
          { id: classId },
          { id: new RegExp(`^${classId}$`, 'i') },
          ...(mongoose.Types.ObjectId.isValid(classId) ? [{ _id: classId }] : []),
        ],
      }).lean();
      if (cls) {
        const teacher = await Teacher.findById(user.teacher).lean();
        const isAssigned =
          (cls.teacherRef && user.teacher && String(cls.teacherRef) === String(user.teacher)) ||
          (teacher?.hoTen && cls.teacher === teacher.hoTen) ||
          (teacher?.id && cls.teacherId === teacher.id) ||
          (user.hoTen && cls.teacher === user.hoTen);
        if (isAssigned) {
          allowed = true;
        }
      }
    }
    if (!allowed) throw AppError.forbidden('Bạn không phụ trách học phần này');
  }

  let classRef = null;
  let targetClassId = '';
  if (classId) {
    const cls = await CourseClass.findOne({
      $or: [
        { id: classId },
        { id: new RegExp(`^${classId}$`, 'i') },
        ...(mongoose.Types.ObjectId.isValid(classId) ? [{ _id: classId }] : []),
      ],
    });
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
        access: 'public',
      });

      uploaded.originalName = file.originalname;
      const docName = fileList.length === 1 && name ? name : file.originalname;
      const extraction = await extractTextFromFile({
        buffer: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
        name: docName,
        courseName: course.name,
        courseId: course.id,
      });

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
        extractedText: extraction.extractedText || '',
        summary: extraction.summary || '',
        chapters: extraction.chapters || [],
        keyConcepts: extraction.keyConcepts || [],
      });
      createdDocs.push(stripFile(doc.toObject()));
    }
  } else {
    // Only link provided
    const extraction = await extractTextFromFile({
      buffer: null,
      name: name || link,
      courseName: course.name,
      courseId: course.id,
    });

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
      extractedText: extraction.extractedText || '',
      summary: extraction.summary || '',
      chapters: extraction.chapters || [],
      keyConcepts: extraction.keyConcepts || [],
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

export async function updateDocument(id, body, fileOrUser, maybeUser) {
  const file = maybeUser !== undefined ? fileOrUser : null;
  const user = maybeUser !== undefined ? maybeUser : fileOrUser;
  const { classId, name, status, link } = body || {};

  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.TEACHER) {
    const isOwner = doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher);
    if (!isOwner && !(await canAccessCourse(user, doc.courseId))) {
      throw AppError.forbidden('Bạn không phụ trách học phần này');
    }
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
  if (name !== undefined && name !== '') doc.name = name;
  if (status !== undefined && status !== '') doc.status = status;
  if (link !== undefined) doc.link = link;

  // If a new file is uploaded, upload buffer and update file metadata
  if (file && file.buffer) {
    const oldPublicId = doc.file?.publicId;
    const oldResourceType = doc.file?.resourceType;

    const uploaded = await filesService.uploadBuffer(file.buffer, {
      folder: 'documents',
      resourceType: 'auto',
      access: 'public',
    });
    uploaded.originalName = file.originalname;
    doc.file = uploaded;

    if (oldPublicId) {
      filesService
        .destroy(oldPublicId, { resourceType: oldResourceType || 'raw', access: 'public' })
        .catch(() => {});
    }

    const course = (await Course.findById(doc.courseRef)) || { name: '', id: doc.courseId };
    const extraction = await extractTextFromFile({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      name: doc.name || file.originalname,
      courseName: course.name,
      courseId: course.id,
    });
    if (extraction.extractedText) doc.extractedText = extraction.extractedText;
    if (extraction.summary) doc.summary = extraction.summary;
    if (extraction.chapters?.length) doc.chapters = extraction.chapters;
    if (extraction.keyConcepts?.length) doc.keyConcepts = extraction.keyConcepts;
  }

  await doc.save();
  return stripFile(doc.toObject());
}

export async function deleteDocument(id, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.TEACHER) {
    const isOwner = doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher);
    if (!isOwner && !(await canAccessCourse(user, doc.courseId))) {
      throw AppError.forbidden('Bạn không phụ trách học phần này');
    }
  }

  await Document.deleteOne({ _id: doc._id });
  if (doc.file?.publicId) {
    await filesService
      .destroy(doc.file.publicId, { resourceType: doc.file.resourceType || 'raw', access: 'public' })
      .catch(() => {});
  }
  return { success: true };
}

/** Issue a short-lived signed URL after checking the caller may access it. */
export async function getDocumentById(id, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef').lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.STUDENT && doc.status !== 'Công khai') {
    throw AppError.forbidden('Tài liệu không khả dụng');
  }
  const allowed = await canAccessCourse(user, doc.courseId);
  if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');

  const stripped = stripFile(doc);
  return {
    ...stripped,
    courseName: doc.courseRef?.name || doc.courseId || '',
    className: doc.classRef?.name || doc.classId || '',
  };
}

export async function streamDocumentFile(id, user, { download = false } = {}) {
  const doc = await Document.findById(id).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.STUDENT && doc.status !== 'Công khai') {
    throw AppError.forbidden('Tài liệu không khả dụng');
  }
  const allowed = await canAccessCourse(user, doc.courseId);
  if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');

  if (!doc.file?.publicId && !doc.file?.url) {
    if (doc.link) {
      return { redirect: doc.link };
    }
    throw AppError.badRequest('Tài liệu không có tệp đính kèm');
  }

  let sourceUrl = doc.file?.url || '';
  if (!sourceUrl || doc.file?.access === 'authenticated') {
    try {
      sourceUrl = filesService.signedUrl(doc.file.publicId, {
        resourceType: doc.file.resourceType || 'raw',
        expiresInSeconds: 300,
      });
    } catch {
      sourceUrl = doc.file?.url || '';
    }
  }

  if (!sourceUrl) {
    throw AppError.badRequest('Không tìm thấy đường dẫn tệp');
  }

  let response = await fetch(sourceUrl);
  if (!response.ok && doc.file?.url && doc.file.url !== sourceUrl) {
    response = await fetch(doc.file.url);
  }
  if (!response.ok) {
    throw AppError.badRequest(`Không thể tải tệp từ lưu trữ đám mây (Mã lỗi: ${response.status})`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = doc.name || doc.file?.originalName || 'tai-lieu';
  const mimeType = getMimeType(filename, doc.file?.format);

  return {
    buffer,
    mimeType,
    filename,
    download,
  };
}

/** Issue a direct download URL or stream route. */
export async function getDownloadUrl(id, user) {
  const doc = await Document.findById(id).lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.STUDENT && doc.status !== 'Công khai') {
    throw AppError.forbidden('Tài liệu không khả dụng');
  }
  const allowed = await canAccessCourse(user, doc.courseId);
  if (!allowed) throw AppError.forbidden('Bạn không có quyền tải tài liệu này');

  if (!doc.file?.publicId && !doc.file?.url) {
    if (doc.link) {
      return { url: doc.link, name: doc.name, isExternal: true };
    }
    throw AppError.badRequest('Tài liệu không có tệp đính kèm');
  }

  if (doc.file?.url && doc.file.access === 'public') {
    return { url: doc.file.url, name: doc.name, hasDirectFile: true };
  }

  try {
    const url = filesService.signedUrl(doc.file.publicId, {
      resourceType: doc.file.resourceType || 'raw',
      expiresInSeconds: 300,
    });
    return { url, name: doc.name };
  } catch {
    return { url: doc.file?.url || `/api/documents/${doc._id}/file?download=1`, name: doc.name };
  }
}

/** Summarize an academic document by ID with security checks. */
export async function summarizeDocumentById(id, { chapter, focus } = {}, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef').lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.STUDENT) {
    if (doc.status !== 'Công khai') throw AppError.forbidden('Tài liệu không khả dụng');
    const allowed = await canAccessCourse(user, doc.courseId);
    if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');
  }
  return summarizeDocument({ document: doc, chapter, focus });
}

/** Generate an interactive Quiz from an academic document by ID with security checks. */
export async function generateQuizByDocumentId(id, { chapter, count, difficulty } = {}, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef').lean();
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.STUDENT) {
    if (doc.status !== 'Công khai') throw AppError.forbidden('Tài liệu không khả dụng');
    const allowed = await canAccessCourse(user, doc.courseId);
    if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');
  }
  return generateQuizFromDocument({ document: doc, count, chapter, difficulty });
}

/** Find relevant document for AI Study coordinator. */
export async function findDocumentForStudy(params, user) {
  return findRelevantDocument({ ...params, user });
}

