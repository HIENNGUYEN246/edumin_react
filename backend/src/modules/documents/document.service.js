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
    sampleQuizzes: doc.sampleQuizzes || [],
    publishedSummary: doc.publishedSummary || '',
    publishedKeyConcepts: doc.publishedKeyConcepts || [],
    publishedChapters: doc.publishedChapters || [],
    isSummaryPublished: Boolean(doc.isSummaryPublished),
    summaryPublishedAt: doc.summaryPublishedAt || null,
    summaryLastEditedBy: doc.summaryLastEditedBy || '',
    publishedQuizzes: doc.publishedQuizzes || [],
    isQuizPublished: Boolean(doc.isQuizPublished),
    quizPublishedAt: doc.quizPublishedAt || null,
    quizLastEditedBy: doc.quizLastEditedBy || '',
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
      const isPdfExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
      const isPdfMime = file.mimetype === 'application/pdf';
      const isPdfMagic = file.buffer && file.buffer.length >= 4 && file.buffer.slice(0, 4).toString() === '%PDF';
      if (!isPdfExt || (!isPdfMime && !isPdfMagic)) {
        throw AppError.badRequest(
          `Tệp "${file.originalname}" không hợp lệ. Hệ thống chỉ chấp nhận tệp tài liệu định dạng PDF (.pdf). Vui lòng lưu/xuất file sang PDF trước khi tải lên. Các định dạng khác và thư mục đều bị từ chối.`
        );
      }
    }

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
    const isPdfExt = file.originalname && file.originalname.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.mimetype === 'application/pdf';
    const isPdfMagic = file.buffer && file.buffer.length >= 4 && file.buffer.slice(0, 4).toString() === '%PDF';
    if (!isPdfExt || (!isPdfMime && !isPdfMagic)) {
      throw AppError.badRequest(
        `Tệp "${file.originalname}" không hợp lệ. Hệ thống chỉ chấp nhận tệp tài liệu định dạng PDF (.pdf). Vui lòng lưu/xuất file sang PDF trước khi tải lên. Các định dạng khác và thư mục đều bị từ chối.`
      );
    }
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
  const isOwner = Boolean(
    (doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher)) ||
    (doc.uploadedBy && (doc.uploadedBy === user.email || doc.uploadedBy === user.hoTen))
  );
  const allowed = isOwner || (await canAccessCourse(user, doc.courseId));
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
  const isOwner = Boolean(
    (doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher)) ||
    (doc.uploadedBy && (doc.uploadedBy === user.email || doc.uploadedBy === user.hoTen))
  );
  const allowed = isOwner || (await canAccessCourse(user, doc.courseId));
  if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');

  if (!doc.file?.publicId && !doc.file?.url) {
    if (doc.link) {
      return { redirect: doc.link };
    }
    throw AppError.badRequest('Tài liệu không có tệp đính kèm');
  }

  // Thu thập danh sách candidate URLs để fetch buffer.
  // Đối với PDF và tài liệu, Cloudinary CDN chặn phân phối trực tiếp (lỗi 401 deny or ACL failure).
  // Vì vậy ưu tiên dùng privateDownloadUrl (chữ ký HMAC API trực tiếp tới Cloudinary Server).
  const candidateUrls = [];
  if (doc.file?.publicId) {
    const resType = doc.file.resourceType || 'image';
    const fmt = doc.file.format || 'pdf';
    if (typeof filesService.privateDownloadUrl === 'function') {
      try {
        const pUrl = filesService.privateDownloadUrl(doc.file.publicId, {
          resourceType: resType,
          format: fmt,
          access: doc.file.access || 'public',
          attachment: false,
        });
        if (pUrl) candidateUrls.push(pUrl);
      } catch {
        // ignore
      }
      try {
        const pRawUrl = filesService.privateDownloadUrl(doc.file.publicId, {
          resourceType: 'raw',
          format: fmt,
          access: doc.file.access || 'public',
          attachment: false,
        });
        if (pRawUrl && !candidateUrls.includes(pRawUrl)) candidateUrls.push(pRawUrl);
      } catch {
        // ignore
      }
    }

    try {
      const sUrl = filesService.signedUrl(doc.file.publicId, {
        resourceType: resType,
        format: fmt,
        access: doc.file.access || 'public',
        expiresInSeconds: 3600,
      });
      if (sUrl && !candidateUrls.includes(sUrl)) candidateUrls.push(sUrl);
    } catch {
      // ignore
    }
  }

  if (doc.file?.url && !candidateUrls.includes(doc.file.url)) {
    candidateUrls.push(doc.file.url);
  }

  if (!candidateUrls.length) {
    throw AppError.badRequest('Không tìm thấy đường dẫn tệp');
  }

  let response = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        response = res;
        break;
      }
    } catch {
      // Thử URL ứng viên tiếp theo
    }
  }

  if (!response || !response.ok) {
    throw AppError.badRequest('Không thể tải tệp từ lưu trữ đám mây. Vui lòng thử lại sau.');
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

/** Issue a direct download URL or stream route with valid signature to prevent Cloudinary 401 ACL error. */
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

  // Ưu tiên signedUrl nếu được tạo hợp lệ
  let downloadUrl = '';
  if (doc.file?.publicId) {
    try {
      if (typeof filesService.signedUrl === 'function') {
        downloadUrl = filesService.signedUrl(doc.file.publicId, {
          resourceType: doc.file.resourceType || 'image',
          format: doc.file.format || 'pdf',
          access: doc.file.access || 'public',
          expiresInSeconds: 3600,
        });
      }
    } catch {
      downloadUrl = '';
    }
  }

  // Fallback về stream route nội bộ của máy chủ nếu không tạo được signedUrl
  if (!downloadUrl) {
    downloadUrl = `/api/documents/${doc._id}/file?download=1`;
  }

  return {
    url: downloadUrl,
    name: doc.name,
    hasDirectFile: true,
  };
}

/** Summarize an academic document by ID with security checks. */
export async function summarizeDocumentById(id, { chapter, focus } = {}, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef');
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.STUDENT) {
    if (doc.status !== 'Công khai') throw AppError.forbidden('Tài liệu không khả dụng');
    const allowed = await canAccessCourse(user, doc.courseId);
    if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');
  }

  const courseName = doc.courseRef?.name || doc.courseId || '';
  // Nếu dữ liệu text cũ bị gán nhầm Virtual DOM hoặc trống, cố gắng trích xuất lại từ file
  if (!doc.extractedText || doc.extractedText.includes('Virtual DOM')) {
    try {
      if (doc.file?.publicId) {
        const streamRes = await streamDocumentFile(doc._id, user, { download: false });
        if (streamRes?.buffer) {
          const freshExt = await extractTextFromFile({
            buffer: streamRes.buffer,
            mimetype: streamRes.mimeType,
            originalname: streamRes.filename,
            name: doc.name,
            courseName,
            courseId: doc.courseId,
          });
          if (freshExt?.extractedText) {
            doc.extractedText = freshExt.extractedText;
            doc.keyConcepts = freshExt.keyConcepts;
            doc.chapters = freshExt.chapters;
          }
        }
      }
    } catch {}
  }

  const result = await summarizeDocument({ document: doc, chapter, focus });
  if (result?.summaryMarkdown) {
    doc.summary = result.summaryMarkdown;
    doc.keyConcepts = result.coreConcepts || [];
    doc.chapters = result.chapters || [];
    await doc.save().catch(() => {});
  }
  return result;
}

/** Generate an interactive Quiz from an academic document by ID with security checks. */
export async function generateQuizByDocumentId(id, { chapter, count, difficulty } = {}, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef');
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');
  if (user.role === ROLES.STUDENT) {
    if (doc.status !== 'Công khai') throw AppError.forbidden('Tài liệu không khả dụng');
    const allowed = await canAccessCourse(user, doc.courseId);
    if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');
  }
  const result = await generateQuizFromDocument({ document: doc, count, chapter, difficulty });
  const quizList = result?.questions || result?.quizzes || [];
  if (quizList.length) {
    doc.sampleQuizzes = quizList;
    await doc.save().catch(() => {});
  }
  return { ...result, quizzes: quizList, questions: quizList };
}

/** Find relevant document for AI Study coordinator. */
export async function findDocumentForStudy(params, user) {
  return findRelevantDocument({ ...params, user });
}

/** Lấy toàn bộ dữ liệu Tóm tắt & Quiz chuyên sâu cho trang AI Study */
export async function getAiStudyData(id, user) {
  const doc = await Document.findById(id).populate('courseRef').populate('classRef');
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  const isTeacherOrAdmin = user.role === ROLES.ADMIN || user.role === ROLES.TEACHER;
  if (user.role === ROLES.STUDENT) {
    if (doc.status !== 'Công khai') throw AppError.forbidden('Tài liệu không khả dụng');
    const allowed = await canAccessCourse(user, doc.courseId);
    if (!allowed) throw AppError.forbidden('Bạn không có quyền truy cập tài liệu này');
  }

  const courseName = doc.courseRef?.name || doc.courseId || '';
  const className = doc.classRef?.name || doc.classId || '';

  // Nhận diện xem tài liệu có bị gán nhầm nội dung Web/Virtual DOM hay không
  const isWebSubject = /web|html|css|react|javascript/i.test(`${doc.name} ${courseName} ${doc.courseId}`);
  const hasStaleVirtualDom = !isWebSubject && Boolean(
    (doc.summary && doc.summary.includes('Virtual DOM')) ||
    (doc.keyConcepts && doc.keyConcepts.some((c) => /virtual dom|react hooks|flexbox/i.test(c.concept || '')))
  );

  // Nhận diện xem tài liệu có bị lưu tóm tắt tĩnh chung chung cũ hoặc dính email/website giảng viên hay không
  const hasStaleGenericSummary = Boolean(
    doc.summary && (
      doc.summary.includes('vai trò trung gian giữa phần cứng máy tính và ứng dụng người dùng. Trọng tâm gồm kiến trúc Nhân') ||
      doc.summary.includes('trinhtandat@sgu.edu.vn') ||
      doc.summary.includes('sites.google.com')
    )
  );

  const hasInvalidKeyConcepts = Boolean(
    doc.keyConcepts && doc.keyConcepts.some((c) =>
      /email|website|url|sgu\.edu\.vn|sites\.google/i.test(`${c.concept} ${c.definition}`)
    )
  );

  // Nếu text trích xuất bị trống hoặc dính text nhầm Virtual DOM, trích xuất lại từ file PDF
  if (hasStaleVirtualDom || hasStaleGenericSummary || hasInvalidKeyConcepts || !doc.extractedText || doc.extractedText.includes('Virtual DOM')) {
    try {
      if (doc.file?.publicId) {
        const streamRes = await streamDocumentFile(doc._id, user, { download: false });
        if (streamRes?.buffer) {
          const freshExt = await extractTextFromFile({
            buffer: streamRes.buffer,
            mimetype: streamRes.mimeType,
            originalname: streamRes.filename,
            name: doc.name,
            courseName,
            courseId: doc.courseId,
          });
          if (freshExt?.extractedText) {
            doc.extractedText = freshExt.extractedText;
            doc.keyConcepts = freshExt.keyConcepts;
            doc.chapters = freshExt.chapters;
            doc.summary = freshExt.summary;
          }
        }
      }
    } catch {}
  }

  // Tự động khởi tạo AI Summary nếu chưa có hoặc đang chứa nội dung sai môn học / tóm tắt tĩnh cũ
  if (!doc.summary || hasStaleVirtualDom || hasStaleGenericSummary || hasInvalidKeyConcepts) {
    try {
      const sumResult = await summarizeDocument({ document: doc });
      if (sumResult?.summaryMarkdown) {
        doc.summary = sumResult.summaryMarkdown;
        doc.keyConcepts = sumResult.coreConcepts || [];
        doc.chapters = sumResult.chapters || [];
        await doc.save().catch(() => {});
      }
    } catch {}
  }

  // Tự động khởi tạo Quiz nếu chưa có hoặc quiz dính React sai môn học hoặc sai chủ đề
  const isFileDoc = /file|tap tin|bg_hdh/i.test(`${doc.name} ${courseName}`);
  const hasWrongQuizTopic = isFileDoc && Boolean(
    doc.sampleQuizzes && !doc.sampleQuizzes.some((q) => /file|tep tin|thu muc|flag|read-only/i.test(q.question || q.concept || ''))
  );

  const hasStaleQuiz = !isWebSubject && Boolean(
    doc.sampleQuizzes && doc.sampleQuizzes.some((q) => /react|virtual dom|flexbox|hooks/i.test(q.question || q.concept || ''))
  );

  if (!doc.sampleQuizzes || doc.sampleQuizzes.length === 0 || hasStaleQuiz || hasWrongQuizTopic) {
    try {
      const qResult = await generateQuizFromDocument({ document: doc, count: 5 });
      const quizList = qResult?.questions || qResult?.quizzes;
      if (quizList?.length) {
        doc.sampleQuizzes = quizList;
        await doc.save().catch(() => {});
      }
    } catch {}
  }

  // Phản hồi cho Sinh viên
  if (user.role === ROLES.STUDENT) {
    const hasTeacherSummary = Boolean(doc.isSummaryPublished && doc.publishedSummary);
    const hasTeacherQuiz = Boolean(doc.isQuizPublished && doc.publishedQuizzes?.length);

    return {
      document: {
        _id: doc._id,
        name: doc.name,
        courseId: doc.courseId,
        courseName,
        classId: doc.classId,
        className,
        format: doc.file?.format || 'pdf',
        size: doc.file?.bytes || 0,
        uploadedBy: doc.uploadedBy,
      },
      canEdit: false,
      summary: {
        content: hasTeacherSummary ? doc.publishedSummary : (doc.summary || ''),
        keyConcepts: hasTeacherSummary ? (doc.publishedKeyConcepts?.length ? doc.publishedKeyConcepts : doc.keyConcepts) : (doc.keyConcepts || []),
        chapters: hasTeacherSummary ? (doc.publishedChapters?.length ? doc.publishedChapters : doc.chapters) : (doc.chapters || []),
        isTeacherPublished: hasTeacherSummary,
        publishedAt: doc.summaryPublishedAt,
        publishedBy: doc.summaryLastEditedBy,
      },
      quiz: {
        questions: hasTeacherQuiz ? doc.publishedQuizzes : (doc.sampleQuizzes || []),
        isTeacherPublished: hasTeacherQuiz,
        publishedAt: doc.quizPublishedAt,
        publishedBy: doc.quizLastEditedBy,
      },
    };
  }

  // Phản hồi cho Giáo viên và Admin
  return {
    document: {
      _id: doc._id,
      name: doc.name,
      courseId: doc.courseId,
      courseName,
      classId: doc.classId,
      className,
      format: doc.file?.format || 'pdf',
      size: doc.file?.bytes || 0,
      uploadedBy: doc.uploadedBy,
    },
    canEdit: isTeacherOrAdmin,
    summary: {
      aiSummary: doc.summary || '',
      aiKeyConcepts: doc.keyConcepts || [],
      aiChapters: doc.chapters || [],
      publishedSummary: doc.publishedSummary || '',
      publishedKeyConcepts: doc.publishedKeyConcepts || [],
      publishedChapters: doc.publishedChapters || [],
      isPublished: Boolean(doc.isSummaryPublished),
      publishedAt: doc.summaryPublishedAt,
      publishedBy: doc.summaryLastEditedBy,
    },
    quiz: {
      aiQuizzes: doc.sampleQuizzes || [],
      publishedQuizzes: doc.publishedQuizzes || [],
      isPublished: Boolean(doc.isQuizPublished),
      publishedAt: doc.quizPublishedAt,
      publishedBy: doc.quizLastEditedBy,
    },
  };
}

/** Lưu và phát hành tóm tắt bài học do Giáo viên chỉnh sửa */
export async function publishSummary(id, { summary, keyConcepts, chapters, isPublished = true }, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.TEACHER) {
    const isOwner = Boolean(
      (doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher)) ||
      (doc.uploadedBy && (doc.uploadedBy === user.email || doc.uploadedBy === user.hoTen))
    );
    const allowed = isOwner || (await canAccessCourse(user, doc.courseId));
    if (!allowed) throw AppError.forbidden('Bạn không có quyền chỉnh sửa tài liệu này');
  }

  doc.publishedSummary = summary !== undefined ? summary : doc.publishedSummary;
  if (Array.isArray(keyConcepts)) doc.publishedKeyConcepts = keyConcepts;
  if (Array.isArray(chapters)) doc.publishedChapters = chapters;
  doc.isSummaryPublished = Boolean(isPublished);
  doc.summaryPublishedAt = isPublished ? new Date() : doc.summaryPublishedAt;
  doc.summaryLastEditedBy = user.hoTen || user.email || 'Giảng viên';

  await doc.save();
  return getAiStudyData(id, user);
}

/** Lưu và phát hành bộ câu hỏi Quiz do Giáo viên chỉnh sửa */
export async function publishQuiz(id, { quizzes, isPublished = true }, user) {
  const doc = await Document.findById(id);
  if (!doc) throw AppError.notFound('Không tìm thấy tài liệu');

  if (user.role === ROLES.TEACHER) {
    const isOwner = Boolean(
      (doc.uploadedByRef && user.teacher && String(doc.uploadedByRef) === String(user.teacher)) ||
      (doc.uploadedBy && (doc.uploadedBy === user.email || doc.uploadedBy === user.hoTen))
    );
    const allowed = isOwner || (await canAccessCourse(user, doc.courseId));
    if (!allowed) throw AppError.forbidden('Bạn không có quyền chỉnh sửa tài liệu này');
  }

  if (Array.isArray(quizzes)) {
    doc.publishedQuizzes = quizzes;
  }
  doc.isQuizPublished = Boolean(isPublished);
  doc.quizPublishedAt = isPublished ? new Date() : doc.quizPublishedAt;
  doc.quizLastEditedBy = user.hoTen || user.email || 'Giảng viên';

  await doc.save();
  return getAiStudyData(id, user);
}

