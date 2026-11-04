import { GoogleGenAI } from '@google/genai';
import { Document } from './document.model.js';
import { Course } from '../courses/course.model.js';
import { CourseClass } from '../classes/courseClass.model.js';
import { Enrollment } from '../enrollments/enrollment.model.js';
import { ROLES } from '../../lib/roles.js';
import { AppError } from '../../lib/AppError.js';
import { enrolledCourseIds } from '../shared/courseAccess.js';
import {
  detectAcademicDomain,
  buildEnrichedAcademicKnowledge,
  isAcademicConcept,
  generateGroundedDocumentSummary,
} from './textExtractor.js';

let geminiClient = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!geminiClient && apiKey) {
    try {
      geminiClient = new GoogleGenAI({ apiKey });
    } catch {
      geminiClient = null;
    }
  }
  return geminiClient;
}

/**
 * Normalizes query string for semantic matching.
 */
function normalizeText(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim();
}

/**
 * Finds the most relevant document for a student or teacher based on prompt and context.
 */
export async function findRelevantDocument({ user, queryText = '', classId = '', courseId = '', documentId = '' }) {
  // 1. Direct document ID query
  if (documentId) {
    const doc = await Document.findById(documentId).populate('courseRef').populate('classRef').lean();
    if (doc) {
      if (user.role === ROLES.STUDENT) {
        const allowedCourses = await enrolledCourseIds(user);
        if (!allowedCourses.includes(doc.courseId)) {
          throw AppError.forbidden('Bạn không có quyền truy cập tài liệu của học phần này');
        }
      }
      return doc;
    }
  }

  // 2. Resolve accessible courses for student
  let allowedCourseIds = [];
  let studentEnrollments = [];
  if (user.role === ROLES.STUDENT) {
    allowedCourseIds = await enrolledCourseIds(user);
    if (!allowedCourseIds.length) {
      return null;
    }
    studentEnrollments = await Enrollment.find({ student: user.student || user._id }).lean();
  }

  // 3. Extract requested course or class from query text if not explicitly provided
  const normQuery = normalizeText(queryText);
  let targetCourseId = courseId;
  let targetClassId = classId;

  // Search by exact or partial document title in query
  const availableDocs = await Document.find({ status: 'Công khai' }).populate('courseRef').populate('classRef').lean();
  for (const d of availableDocs) {
    const normDocName = normalizeText(d.name);
    if (normDocName && normDocName.length >= 3 && normQuery.includes(normDocName)) {
      if (user.role === ROLES.STUDENT) {
        const allowedCourses = await enrolledCourseIds(user);
        if (allowedCourses.length && !allowedCourses.includes(d.courseId)) {
          return {
            unauthorized: true,
            message: `Bạn chưa đăng ký học phần ${d.courseId} nên không thể truy xuất tài liệu này.`,
          };
        }
      }
      return d;
    }
  }

  // Search for class pattern (e.g. CNTT101-01, IT101-01, CS102-02)
  const classMatch = queryText.match(/\b([A-Z0-9]{2,10}-[0-9]{1,3})\b/i);
  if (classMatch) {
    targetClassId = classMatch[1].toUpperCase();
  }

  // Search for course pattern (e.g. CNTT101, IT101, CS102)
  const courseMatch = queryText.match(/\b(CNTT[0-9]{3}|IT[0-9]{3}|CS[0-9]{3}|MATH[0-9]{3}|ENG[0-9]{3})\b/i);
  if (courseMatch) {
    targetCourseId = courseMatch[1].toUpperCase();
  }

  // If no course code found, search by course name keywords (e.g. "lập trình web", "cơ sở dữ liệu", "mạng máy tính")
  if (!targetCourseId && !targetClassId) {
    const allCourses = await Course.find({}).lean();
    for (const c of allCourses) {
      const normName = normalizeText(c.name);
      if (normName && normQuery.includes(normName)) {
        targetCourseId = c.id;
        break;
      }
    }
  }

  // If teacher and still no course, resolve from teacher's classes
  if (!targetCourseId && !targetClassId && user.role === ROLES.TEACHER) {
    const teacherClasses = await CourseClass.find({
      $or: [{ teacherRef: user.teacher }, { teacher: user.hoTen }],
    }).lean();
    if (teacherClasses.length > 0) {
      targetCourseId = teacherClasses[0].courseId;
      targetClassId = teacherClasses[0].id;
    }
  }

  // If still no specific course/class matched, check student's enrolled classes to pick the active or default one
  if (!targetCourseId && !targetClassId && user.role === ROLES.STUDENT && allowedCourseIds.length > 0) {
    targetCourseId = allowedCourseIds[0];
  }

  if (!targetCourseId && !targetClassId) {
    const defaultCourse = await Course.findOne({}).lean();
    if (defaultCourse) {
      targetCourseId = defaultCourse.id;
    }
  }

  // 4. Build query filter
  const filter = { status: 'Công khai' };
  if (user.role === ROLES.STUDENT) {
    if (targetCourseId) {
      if (!allowedCourseIds.includes(targetCourseId)) {
        return {
          unauthorized: true,
          message: `Bạn chưa đăng ký học phần ${targetCourseId} nên không thể truy xuất tài liệu của môn này.`,
        };
      }
      filter.courseId = targetCourseId;
    } else {
      filter.courseId = { $in: allowedCourseIds };
    }
  } else if (targetCourseId) {
    filter.courseId = targetCourseId;
  }

  if (targetClassId) {
    filter.$or = [{ classId: targetClassId }, { classId: '' }, { classId: null }];
  }

  // Check chapter request in query (e.g. "chương 1", "chương 2", "bài 1")
  const chapterMatch = queryText.match(/(?:chương|chuong|bài|bai|phần|phan)\s+(\d+)/i);
  const chapterNum = chapterMatch ? parseInt(chapterMatch[1], 10) : null;

  // Find candidate documents
  let docs = await Document.find(filter).sort({ createdAt: -1 }).populate('courseRef').populate('classRef').lean();
  if (!docs.length) {
    // If no specific class filter matched, loosen to course level
    delete filter.$or;
    docs = await Document.find(filter).sort({ createdAt: -1 }).populate('courseRef').populate('classRef').lean();
  }

  if (!docs.length) {
    // If absolutely no document uploaded yet, synthesize an official syllabus/theory document for the course
    let course = null;
    if (targetCourseId) {
      course = await Course.findOne({
        $or: [{ id: targetCourseId }, { name: new RegExp(targetCourseId, 'i') }],
      }).lean();
    }
    if (!course && targetClassId) {
      const cls = await CourseClass.findOne({
        $or: [{ id: targetClassId }, { classId: targetClassId }],
      }).populate('courseRef').lean();
      if (cls) {
        course = cls.courseRef || (await Course.findOne({ id: cls.courseId }).lean());
      }
    }
    if (!course) {
      const allCourses = await Course.find({}).lean();
      for (const c of allCourses) {
        if (normQuery.includes(normalizeText(c.name)) || normQuery.includes(normalizeText(c.id))) {
          course = c;
          break;
        }
      }
    }
    if (!course) {
      course = await Course.findOne({}).lean();
    }

    if (course) {
      let resolvedClassId = targetClassId;
      if (!resolvedClassId && user.role === ROLES.TEACHER) {
        const teacherClass = await CourseClass.findOne({
          courseId: course.id,
          $or: [
            { teacherRef: user.teacher },
            { teacher: user.hoTen },
            { teacherId: user.teacherId },
          ].filter(Boolean),
        }).lean();
        if (teacherClass) {
          resolvedClassId = teacherClass.id;
        }
      }
      return {
        _id: `synth_${course.id}`,
        name: `Giáo trình & Đề cương lý thuyết: ${course.name}`,
        courseId: course.id,
        classId: resolvedClassId || `${course.id}-01`,
        courseRef: course,
        isSynthetic: true,
      };
    }
    return null;
  }

  // If chapter specified, try to find document matching chapter or return first
  if (chapterNum) {
    const chapterDoc = docs.find((d) => normalizeText(d.name).includes(`chuong ${chapterNum}`) || normalizeText(d.name).includes(`bai ${chapterNum}`));
    if (chapterDoc) return chapterDoc;
  }

  return docs[0];
}

/**
 * Summarizes an academic document using LLM (Gemini 3.8 Flash) with reliable fallback.
 */
/**
 * Summarizes an academic document using LLM (Gemini 3.8 Flash) with reliable fallback.
 */
export async function summarizeDocument({ document, chapter = '', focus = '' }) {
  if (!document) {
    throw AppError.notFound('Không tìm thấy tài liệu phù hợp');
  }

  const docTitle = document.name || 'Tài liệu học phần';
  const courseName = document.courseRef?.name || document.courseName || document.courseId || '';
  const textContent = document.extractedText || '';
  const chapterNumber = chapter ? parseInt(String(chapter).replace(/\D/g, ''), 10) : null;

  // Selected chapter content if available
  let targetContent = textContent;
  let targetChapterTitle = '';
  if (chapterNumber && Array.isArray(document.chapters) && document.chapters.length > 0) {
    const foundChapter = document.chapters.find((c) => c.chapterNumber === chapterNumber);
    if (foundChapter) {
      targetContent = foundChapter.content || textContent;
      targetChapterTitle = foundChapter.title;
    }
  }

  // Detect curriculum domain
  const domain = detectAcademicDomain({
    title: docTitle,
    courseName,
    courseId: document.courseId,
    text: targetContent,
  });

  // Attempt Gemini API call if key is provided
  const client = getGeminiClient();
  if (client && targetContent) {
    try {
      const prompt = `Bạn là Trợ lý Học tập AI cao cấp của hệ thống EduMin. Hãy đọc và tóm tắt tài liệu học tập sau đây:
Tên tài liệu: "${docTitle}"
Học phần: "${courseName}" (${document.courseId || ''})
${targetChapterTitle ? `Phạm vi: ${targetChapterTitle}` : ''}
${focus ? `Trọng tâm yêu cầu: ${focus}` : ''}

Nội dung trích xuất:
"""
${targetContent.slice(0, 15000)}
"""

Yêu cầu định dạng phản hồi (sạch sẽ, Markdown chuẩn, có KaTeX cho công thức nếu có):
1. Khái niệm cốt lõi: 2-3 khái niệm then chốt nhất kèm định nghĩa súc tích.
2. Công thức & Quy tắc quan trọng: các công thức toán/lý thuyết hoặc cú pháp code cốt lõi.
3. Tóm tắt nội dung trọng tâm: 4-5 gạch đầu dòng rõ ràng, logic.
4. Điểm cần ghi nhớ khi ôn thi: 2 lưu ý then chốt.`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        return {
          documentId: document._id,
          documentName: docTitle,
          courseId: document.courseId,
          courseName,
          classId: document.classId || '',
          chapter: targetChapterTitle || (chapterNumber ? `Chương ${chapterNumber}` : 'Toàn bộ tài liệu'),
          summaryMarkdown: response.text,
          coreConcepts: document.keyConcepts || [],
          chapters: document.chapters || [],
        };
      }
    } catch {
      // Fallback to built-in structured summarizer
    }
  }

  // Check if existing key concepts contain stale Virtual DOM from previous flawed matcher
  const isStaleVirtualDom = domain !== 'WEB' && Array.isArray(document.keyConcepts) &&
    document.keyConcepts.some((c) => /virtual dom|react hooks|flexbox/i.test(c.concept || ''));

  const enriched = buildEnrichedAcademicKnowledge({
    domain,
    title: docTitle,
    courseName,
    courseId: document.courseId,
    existingText: targetContent,
  });

  // Filter out non-academic or contact lines (email, website, phone, author details)
  const filteredDocConcepts = Array.isArray(document.keyConcepts)
    ? document.keyConcepts.filter((c) => isAcademicConcept(c.concept, c.definition))
    : [];

  const coreConcepts = (!isStaleVirtualDom && filteredDocConcepts.length >= 2)
    ? filteredDocConcepts
    : enriched.keyConcepts;

  const chapterDisplay = targetChapterTitle || (chapterNumber ? `Chương ${chapterNumber}` : 'Toàn bộ nội dung');

  const groundedSummary = generateGroundedDocumentSummary({
    docTitle,
    courseName,
    courseId: document.courseId,
    text: targetContent,
    domain,
    keyConcepts: coreConcepts,
  });

  const summaryMarkdown = `### 📖 Tóm tắt kiến thức trọng tâm: ${docTitle}
**Học phần:** ${courseName} (${document.courseId || ''}) ${document.classId ? `| **Lớp:** \`${document.classId}\`` : ''}  
**Phạm vi:** ${chapterDisplay}

---

#### 📌 1. Các Khái niệm Cốt lõi (Core Concepts)
${coreConcepts
  .map(
    (c) => `- **${c.concept}**: ${c.definition}${c.formula ? `\n  > ⚡ *Công thức/Cú pháp:* \`${c.formula}\`` : ''}`
  )
  .join('\n')}

---

#### 📋 2. Ý chính tóm tắt theo nội dung bài học
${groundedSummary}

---

#### 💡 3. Lưu ý then chốt khi ôn tập & Làm bài kiểm tra
> [!TIP]
> - Nắm vững cơ chế vận hành và mối liên hệ giữa các khái niệm lý thuyết cốt lõi để đạt điểm tối đa phần tự luận và trắc nghiệm.
> - Chú ý các điều kiện biên và công thức then chốt trước khi áp dụng giải bài tập.`;

  return {
    documentId: document._id,
    documentName: docTitle,
    courseId: document.courseId,
    courseName,
    classId: document.classId || '',
    chapter: chapterDisplay,
    summaryMarkdown,
    coreConcepts,
    chapters: document.chapters?.length ? document.chapters : enriched.chapters,
  };
}

/**
 * Generates an interactive 5-question Quiz with 4 options and detailed rationale.
 */
export async function generateQuizFromDocument({ document, count = 5, chapter = '', difficulty = 'medium' }) {
  if (!document) {
    throw AppError.notFound('Không tìm thấy tài liệu phù hợp');
  }

  const docTitle = document.name || 'Tài liệu học phần';
  const courseName = document.courseRef?.name || document.courseName || document.courseId || '';
  const textContent = document.extractedText || '';
  const chapterNumber = chapter ? parseInt(String(chapter).replace(/\D/g, ''), 10) : null;

  // Try Gemini API structured output first
  const client = getGeminiClient();
  if (client && textContent) {
    try {
      const prompt = `Bạn là Giảng viên Đại học ra đề thi trắc nghiệm khách quan cho hệ thống EduMin. Hãy tạo đúng ${count} câu hỏi trắc nghiệm ôn tập dựa trên tài liệu sau:
Tên tài liệu: "${docTitle}"
Môn học: "${courseName}" (${document.courseId || ''})
${chapter ? `Chương: ${chapter}` : ''}
Độ khó: ${difficulty}

Nội dung tài liệu:
"""
${textContent.slice(0, 15000)}
"""

YÊU CẦU:
Trả về DUY NHẤT một mảng JSON thuần túy (không bọc trong markdown tick nếu có thể, hoặc bọc trong \`\`\`json), mỗi phần tử gồm:
- "id": string ("q1", "q2"...)
- "question": nội dung câu hỏi rõ ràng
- "options": mảng 4 chuỗi đáp án [A, B, C, D]
- "correctIndex": số nguyên từ 0 đến 3 (chỉ số của đáp án đúng)
- "explanation": giải thích chi tiết (Rationale) tại sao đáp án này đúng và các đáp án khác sai
- "concept": khái niệm liên quan`;

      const response = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        const jsonMatch = response.text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            const formatted = parsed.map((q, idx) => ({
              id: q.id || `q_${idx + 1}`,
              question: q.question,
              options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
              correctIndex: typeof q.correctIndex === 'number' ? q.correctIndex : 0,
              explanation: q.explanation || 'Đáp án chính xác dựa trên giáo trình bài giảng.',
              concept: q.concept || courseName,
            }));
            return {
              documentId: document._id,
              documentName: docTitle,
              courseId: document.courseId,
              courseName,
              classId: document.classId || '',
              chapter: chapter || 'Toàn bộ tài liệu',
              totalQuestions: formatted.length,
              questions: formatted,
              quizzes: formatted,
            };
          }
        }
      }
    } catch {
      // Continue to deterministic domain synthesizer
    }
  }

  // High quality domain-grounded quiz synthesizer
  const questions = buildDomainQuizQuestions({
    title: docTitle,
    courseName,
    courseId: document.courseId,
    text: textContent,
    chapterNumber,
    count,
  });

  return {
    documentId: document._id,
    documentName: docTitle,
    courseId: document.courseId,
    courseName,
    classId: document.classId || '',
    chapter: chapterNumber ? `Chương ${chapterNumber}` : 'Toàn bộ bài giảng',
    totalQuestions: questions.length,
    questions,
    quizzes: questions,
  };
}

/**
 * Builds realistic, challenging multiple-choice questions for specific academic disciplines.
 */
function buildDomainQuizQuestions({ title = '', courseName = '', courseId = '', text = '', chapterNumber = null, count = 5 }) {
  const domain = detectAcademicDomain({
    title,
    courseName,
    courseId,
    text,
  });

  // 1. Operating Systems (Hệ điều hành)
  if (domain === 'OS') {
    const norm = normalizeText(`${title} ${courseName} ${courseId} ${(text || '').slice(0, 5000)}`);

    // Specific File System quiz questions when document covers files/storage
    if (/file|tap tin|bg_hdh|thu muc|directory|read-only|hidden flag|system flag|archive flag/i.test(norm)) {
      const filePool = [
        {
          id: 'q1',
          question: 'Trong hệ thống tệp tin (File System) của hệ điều hành, khái niệm "Tệp tin" (File) được định nghĩa chính xác nhất là gì?',
          options: [
            'A. Là một mạch phần cứng trên bo mạch chủ dùng để lưu trữ BIOS',
            'B. Là một tập hợp thông tin logic có cấu trúc được đặt tên và lưu trữ trên bộ nhớ thứ cấp (đĩa)',
            'C. Là một thanh ghi trung gian bên trong ALU của CPU',
            'D. Là một địa chỉ IP tĩnh dùng để kết nối mạng máy tính',
          ],
          correctIndex: 1,
          explanation: 'Giải thích chi tiết (Rationale): File là đơn vị lưu trữ dữ liệu logic nhỏ nhất mà hệ điều hành cung cấp cho người dùng và ứng dụng để lưu trữ dữ liệu lâu dài trên bộ nhớ ngoài.',
          concept: 'Khái niệm Tệp tin (File Concept)',
        },
        {
          id: 'q2',
          question: 'Ý nghĩa của cờ thuộc tính Read-only flag với giá trị 1 đối với một tệp tin là gì?',
          options: [
            'A. Cho phép người dùng vừa đọc vừa ghi đè dữ liệu mới',
            'B. Chỉ cho phép đọc nội dung tệp, ngăn chặn mọi thao tác sửa đổi hoặc ghi đè nội dung',
            'C. Tệp tin sẽ bị xóa tự động sau khi đọc xong',
            'D. Tệp tin được mã hóa bảo mật cấp cao bằng thuật toán RSA',
          ],
          correctIndex: 1,
          explanation: 'Giải thích chi tiết (Rationale): Read-only flag (chỉ đọc) với giá trị 1 bảo vệ tệp tin khỏi việc bị ghi đè, chỉnh sửa hoặc xóa ngoài ý muốn.',
          concept: 'Thuộc tính tệp (Read-only Flag)',
        },
        {
          id: 'q3',
          question: 'Cờ thuộc tính Hidden flag và System flag trong hệ điều hành đóng vai trò gì trong quản lý tệp?',
          options: [
            'A. Tự động nén dung lượng tệp tin xuống 50%',
            'B. Hidden flag kiểm soát việc ẩn/hiện tệp khi liệt kê thư mục, còn System flag định danh các tệp cấu hình cốt lõi của hệ điều hành',
            'C. Cho phép tệp tin tự sao chép qua mạng cục bộ LAN',
            'D. Giúp tăng tốc độ quay của đĩa cứng vật lý',
          ],
          correctIndex: 1,
          explanation: 'Giải thích chi tiết (Rationale): Hidden flag giúp ẩn tệp khỏi danh sách duyệt thông thường của người dùng, trong khi System flag bảo vệ các tệp nhân hệ thống quan trọng.',
          concept: 'Cờ thuộc tính tệp (Hidden & System Flags)',
        },
        {
          id: 'q4',
          question: 'Trong cấu trúc thư mục dạng cây (Tree-Structured Directory), sự khác biệt giữa đường dẫn tuyệt đối (Absolute Path) và đường dẫn tương đối (Relative Path) là gì?',
          options: [
            'A. Đường dẫn tuyệt đối bắt đầu từ thư mục gốc (Root), còn đường dẫn tương đối tính từ thư mục làm việc hiện hành (Working Directory)',
            'B. Đường dẫn tuyệt đối chỉ áp dụng cho tệp hình ảnh, đường dẫn tương đối cho tệp văn bản',
            'C. Đường dẫn tuyệt đối chỉ có trên Windows, còn đường dẫn tương đối chỉ có trên Linux',
            'D. Không có sự khác biệt nào giữa hai loại đường dẫn',
          ],
          correctIndex: 0,
          explanation: 'Giải thích chi tiết (Rationale): Đường dẫn tuyệt đối luôn bắt đầu từ gốc của hệ thống tệp (/ hoặc C:\\), trong khi đường dẫn tương đối bắt đầu từ vị trí của thư mục đang đứng.',
          concept: 'Cấu trúc thư mục (Directory Paths)',
        },
        {
          id: 'q5',
          question: 'Phương thức truy cập tệp tuần tự (Sequential Access) hoạt động theo nguyên tắc nào?',
          options: [
            'A. Có thể nhảy đến bất kỳ khối dữ liệu nào mà không cần đọc các khối trước đó',
            'B. Thông tin trong tệp được xử lý lần lượt theo thứ tự từ đầu đến cuối',
            'C. Dữ liệu chỉ được truy cập ngẫu nhiên qua hàm băm Hash Function',
            'D. Tệp chỉ được mở vào một khung giờ cố định trong ngày',
          ],
          correctIndex: 1,
          explanation: 'Giải thích chi tiết (Rationale): Truy cập tuần tự đọc và ghi các byte/bản ghi theo trình tự liên tục, con trỏ tệp tự động tăng dần sau mỗi thao tác đọc/ghi.',
          concept: 'Phương thức truy cập tệp (Sequential Access)',
        },
      ];
      return filePool.slice(0, count);
    }

    const pool = [
      {
        id: 'q1',
        question: 'Trong kiến trúc hệ điều hành hiện đại, cơ chế nào bảo vệ hệ thống khỏi việc các chương trình người dùng can thiệp trực tiếp vào phần cứng hoặc bộ nhớ của hệ thống?',
        options: [
          'A. Tự động mã hóa toàn bộ dữ liệu trên RAM khi khởi động',
          'B. Chế độ hoạt động kép Dual-mode (User Mode và Kernel Mode) kết hợp bit chế độ (Mode bit)',
          'C. Tắt toàn bộ ngắt phần cứng trong suốt quá trình CPU thực thi',
          'D. Sử dụng giao thức mạng HTTPS hai chiều',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Hệ điều hành sử dụng kiến trúc bảo vệ Dual-mode: User Mode (Mode bit = 1) cho ứng dụng thông thường và Kernel Mode (Mode bit = 0) cho nhân hệ điều hành. Khi ứng dụng cần truy cập phần cứng hoặc tài nguyên nhạy cảm, nó phải phát lệnh Lời gọi hệ thống (System Call / Trap) để chuyển sang Kernel Mode, ngăn chặn tiến trình người dùng phá hỏng hệ thống.',
        concept: 'Chế độ bảo vệ Dual-mode & System Call',
      },
      {
        id: 'q2',
        question: 'Khối điều khiển tiến trình PCB (Process Control Block) đóng vai trò gì trong quản lý tiến trình của hệ điều hành?',
        options: [
          'A. Là bộ nhớ đệm dùng để lưu trữ các tệp HTML khi tải từ Internet',
          'B. Là cấu trúc dữ liệu lưu trữ toàn bộ ngữ cảnh và thông tin trạng thái của một tiến trình (PID, Program Counter, thanh ghi CPU, quyền bộ nhớ)',
          'C. Là trình biên dịch chuyển đổi mã nguồn C/C++ sang mã máy',
          'D. Là bảng phân vùng các sector trên ổ đĩa cứng của máy tính',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Mỗi tiến trình được hệ điều hành quản lý thông qua một PCB duy nhất. Khi CPU chuyển ngữ cảnh (Context Switch) từ tiến trình A sang tiến trình B, hệ điều hành lưu trạng thái hiện tại của A vào PCB của A và nạp trạng thái của B từ PCB của B vào các thanh ghi CPU.',
        concept: 'Cấu trúc PCB & Chuyển ngữ cảnh (Context Switch)',
      },
      {
        id: 'q3',
        question: 'Trong các thuật toán định thời CPU (CPU Scheduling), thuật toán Round Robin (RR) hoạt động dựa trên nguyên tắc nào?',
        options: [
          'A. Ưu tiên tiến trình có thời gian thực thi ngắn nhất trước (SJF)',
          'B. Cấp phát CPU lần lượt cho từng tiến trình trong hàng đợi sẵn sàng theo một lát cắt thời gian định trước (Time Quantum)',
          'C. Giữ CPU liên tục cho một tiến trình cho đến khi tiến trình đó kết thúc hoàn toàn mà không ngắt',
          'D. Sắp xếp tiến trình theo thứ tự kích thước tệp thực thi trên đĩa',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Round Robin là giải thuật định thời chiếm dụng (Preemptive) được thiết kế cho hệ thống chia sẻ thời gian (Time-sharing). Mỗi tiến trình được cấp phát CPU trong một khoảng thời gian gọi là Time Quantum. Nếu hết thời gian mà tiến trình chưa xong, CPU bị thu hồi và tiến trình được đưa về cuối hàng đợi Ready Queue.',
        concept: 'Thuật toán định thời CPU (Round Robin)',
      },
      {
        id: 'q4',
        question: 'Hiện tượng Bế tắc (Deadlock) giữa các tiến trình xảy ra khi thỏa mãn đồng thời 4 điều kiện Coffman nào sau đây?',
        options: [
          'A. Tính nhất quán, Tính nguyên tử, Tính cô lập, Tính bền vững (ACID)',
          'B. Loại trừ tương hỗ (Mutual Exclusion), Giữ và chờ (Hold and Wait), Không chiếm dụng trước (No Preemption), Chờ đợi vòng tròn (Circular Wait)',
          'C. Bộ nhớ đầy, CPU quá tải, Ổ cứng hỏng, Mạng mất kết nối',
          'D. Quá nhiều luồng, Không có bộ nhớ đệm, Sai địa chỉ IP, Đụng độ khóa chính',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): 4 điều kiện Coffman là điều kiện cần và đủ để Deadlock xuất hiện trong hệ thống. Nếu loại bỏ được ít nhất một trong 4 điều kiện này (ví dụ: cấm chờ đợi vòng tròn hoặc cho phép chiếm dụng tài nguyên), Deadlock sẽ không thể xảy ra.',
        concept: '4 Điều kiện Deadlock (Coffman Conditions)',
      },
      {
        id: 'q5',
        question: 'Trong kỹ thuật quản lý bộ nhớ ảo sử dụng phân trang (Paging), hiện tượng "Ngắt lỗi trang" (Page Fault) xảy ra khi nào?',
        options: [
          'A. Khi con trỏ lệnh bị tràn ra ngoài giới hạn bộ nhớ vật lý',
          'B. Khi tiến trình truy cập vào một trang nhớ hợp lệ nhưng trang đó hiện chưa được nạp vào bộ nhớ vật lý (RAM)',
          'C. Khi ổ đĩa cứng bị mất điện đột ngột trong lúc ghi dữ liệu',
          'D. Khi hai tiến trình cùng ghi vào một biến toàn cục mà không có cơ chế khóa',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Khi CPU phát ra địa chỉ logic, MMU tra cứu bảng trang. Nếu bit hợp lệ (Valid/Invalid bit) đánh dấu là Invalid (nghĩa là trang đang ở bộ nhớ phụ/Disk), một ngắt Page Fault được kích hoạt để hệ điều hành nạp trang từ Disk vào một khung trang (Frame) trống trong RAM.',
        concept: 'Bộ nhớ ảo & Ngắt lỗi trang (Page Fault)',
      },
    ];
    return pool.slice(0, count);
  }

  // 2. Data Structures & Algorithms (Cấu trúc dữ liệu & Giải thuật)
  if (domain === 'DSA') {
    const pool = [
      {
        id: 'q1',
        question: 'Độ phức tạp thời gian trong trường hợp trung bình (Average Case) của thuật toán sắp xếp nhanh (QuickSort) là bao nhiêu?',
        options: [
          'A. O(1)',
          'B. O(n log n)',
          'C. O(n^2)',
          'D. O(2^n)',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): QuickSort chia đôi mảng theo phần tử chốt (Pivot) và phân hoạch đệ quy. Trong trường hợp trung bình, thời gian thực thi thỏa mãn phương trình đệ quy T(n) = 2T(n/2) + O(n), cho ra độ phức tạp tiệm cận O(n log n).',
        concept: 'Độ phức tạp QuickSort',
      },
      {
        id: 'q2',
        question: 'Trong cây nhị phân tìm kiếm (Binary Search Tree - BST), thao tác duyệt cây theo thứ tự nào sẽ cho kết quả các phần tử được sắp xếp theo thứ tự tăng dần?',
        options: [
          'A. Duyệt tiền thứ tự (Pre-order: Node -> Left -> Right)',
          'B. Duyệt trung thứ tự (In-order: Left -> Node -> Right)',
          'C. Duyệt hậu thứ tự (Post-order: Left -> Right -> Node)',
          'D. Duyệt theo mức (Level-order / BFS)',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Do tính chất của BST: mọi nút trên cây con trái đều nhỏ hơn nút gốc, và nút gốc nhỏ hơn mọi nút trên cây con phải, phép duyệt In-order (Left -> Node -> Right) luôn duyệt từ giá trị nhỏ nhất đến lớn nhất theo thứ tự tăng dần.',
        concept: 'Duyệt cây BST (In-order Traversal)',
      },
      {
        id: 'q3',
        question: 'Cấu trúc dữ liệu Ngăn xếp (Stack) hoạt động theo nguyên lý truy xuất phần tử nào?',
        options: [
          'A. FIFO (First In, First Out - Vào trước ra trước)',
          'B. LIFO (Last In, First Out - Vào sau ra trước)',
          'C. Random Access (Truy xuất ngẫu nhiên)',
          'D. Priority First (Ưu tiên phần tử lớn nhất)',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Stack là cấu trúc dữ liệu dạng LIFO (Last In, First Out). Phần tử được thêm vào sau cùng (Push) sẽ là phần tử đầu tiên được lấy ra (Pop).',
        concept: 'Cấu trúc Stack (LIFO)',
      },
      {
        id: 'q4',
        question: 'Thuật toán tìm kiếm theo chiều rộng (Breadth-First Search - BFS) trên đồ thị sử dụng cấu trúc dữ liệu phụ trợ nào để lưu trữ các đỉnh chờ duyệt?',
        options: [
          'A. Hàng đợi (Queue - FIFO)',
          'B. Ngăn xếp (Stack - LIFO)',
          'C. Cây đỏ đen (Red-Black Tree)',
          'D. Bảng băm (Hash Table)',
        ],
        correctIndex: 0,
        explanation: 'Giải thích chi tiết (Rationale): BFS duyệt các đỉnh theo từng mức khoảng cách từ đỉnh nguồn. Do đó, nó sử dụng Hàng đợi (Queue) theo cơ chế FIFO để đảm bảo các đỉnh ở mức k được duyệt xong trước khi chuyển sang các đỉnh ở mức k+1.',
        concept: 'Thuật toán duyệt BFS & Queue',
      },
      {
        id: 'q5',
        question: 'Thuật toán Dijkstra được sử dụng để giải quyết bài toán nào trên đồ thị có trọng số?',
        options: [
          'A. Tìm cây khung nhỏ nhất (Minimum Spanning Tree)',
          'B. Tìm đường đi ngắn nhất từ một đỉnh nguồn đến tất cả các đỉnh còn lại trên đồ thị có trọng số không âm',
          'C. Tìm chu trình Euler',
          'D. Kiểm tra tính liên thông mạnh trên đồ thị có hướng',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Thuật toán Dijkstra là giải thuật tham lam (Greedy) kinh điển dùng để tìm đường đi ngắn nhất từ đỉnh nguồn duy nhất (Single-source shortest path) đến các đỉnh khác trên đồ thị có trọng số không âm.',
        concept: 'Thuật toán Dijkstra',
      },
    ];
    return pool.slice(0, count);
  }

  // 3. Database / SQL / CSDL
  if (domain === 'DATABASE') {
    const pool = [
      {
        id: 'q1',
        question: 'Thuộc tính nào trong nguyên lý ACID đảm bảo rằng một giao dịch phải hoàn tất toàn bộ các thao tác, hoặc nếu có lỗi thì hoàn tác sạch sẽ (All-or-Nothing)?',
        options: [
          'A. Consistency (Tính nhất quán)',
          'B. Atomicity (Tính nguyên tử)',
          'C. Isolation (Tính cô lập)',
          'D. Durability (Tính bền vững)',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Atomicity (Tính nguyên tử) đảm bảo rằng tất cả các câu lệnh trong giao dịch được thực thi thành công trọn vẹn; nếu một thao tác thất bại, toàn bộ giao dịch sẽ bị Rollback về trạng thái trước đó như chưa từng xảy ra.',
        concept: 'Nguyên lý Giao dịch ACID',
      },
      {
        id: 'q2',
        question: 'Một lược đồ quan hệ đạt dạng chuẩn 2NF (Second Normal Form) khi và chỉ khi thỏa mãn điều kiện nào?',
        options: [
          'A. Đạt dạng chuẩn 1NF và không chứa thuộc tính không khóa nào phụ thuộc một phần vào khóa chính',
          'B. Có ít nhất 3 khóa ngoại trỏ đến các bảng khác',
          'C. Không chứa bất kỳ giá trị NULL nào trong bảng',
          'D. Bảng chỉ được phép có tối đa 10 cột dữ liệu',
        ],
        correctIndex: 0,
        explanation: 'Giải thích chi tiết (Rationale): Dạng chuẩn 2NF yêu cầu bảng phải đạt 1NF (mọi giá trị nguyên tử) và mọi thuộc tính không khóa phải phụ thuộc hàm đầy đủ vào khóa chính, không được phụ thuộc vào một phần của khóa chính ghép.',
        concept: 'Chuẩn hóa Dữ liệu (2NF)',
      },
      {
        id: 'q3',
        question: 'Trong câu lệnh SQL SELECT, mệnh đề HAVING khác với mệnh đề WHERE ở điểm mấu chốt nào?',
        options: [
          'A. HAVING dùng để lọc dữ liệu của các nhóm sau khi đã gom nhóm (GROUP BY) hoặc hàm tổng hợp, còn WHERE lọc từng dòng riêng lẻ trước khi gom nhóm',
          'B. WHERE chỉ dùng được cho kiểu số, HAVING dùng cho kiểu chuỗi',
          'C. HAVING được thực thi trước mệnh đề FROM',
          'D. Không có sự khác biệt, hai mệnh đề hoàn toàn hoán đổi cho nhau được',
        ],
        correctIndex: 0,
        explanation: 'Giải thích chi tiết (Rationale): WHERE lọc từng hàng (rows) trước khi gom nhóm. HAVING lọc các nhóm (groups) được tạo ra bởi GROUP BY và có thể áp dụng điều kiện trên các hàm tổng hợp như COUNT(), SUM(), AVG().',
        concept: 'SQL GROUP BY & HAVING',
      },
      {
        id: 'q4',
        question: 'Phép kết nối `LEFT JOIN` giữa hai bảng A và B (A LEFT JOIN B ON A.id = B.a_id) sẽ trả về kết quả như thế nào?',
        options: [
          'A. Chỉ những dòng có id khớp nhau ở cả hai bảng A và B',
          'B. Toàn bộ các dòng từ bảng B và chỉ những dòng khớp từ bảng A',
          'C. Toàn bộ các dòng từ bảng A, kết hợp với các cột tương ứng của bảng B nếu có khớp (nếu không có thì nhận giá trị NULL)',
          'D. Tích Descartes của tất cả các dòng giữa hai bảng',
        ],
        correctIndex: 2,
        explanation: 'Giải thích chi tiết (Rationale): LEFT JOIN giữ lại 100% các dòng từ bảng bên trái (A). Nếu có bản ghi khớp ở bảng B thì điền dữ liệu, nếu không có bản ghi nào khớp ở bảng B thì các cột của B sẽ chứa giá trị NULL.',
        concept: 'SQL Joins',
      },
      {
        id: 'q5',
        question: 'Tại sao việc tạo quá nhiều Index (chỉ mục) trên một bảng cơ sở dữ liệu có thể gây phản tác dụng đối với hiệu năng?',
        options: [
          'A. Khiến câu lệnh SELECT bị chậm đi gấp đôi',
          'B. Làm tăng chi phí và thời gian ghi đĩa cho mỗi thao tác INSERT, UPDATE, DELETE vì hệ thống phải cập nhật lại cây Index',
          'C. Làm mất tính toàn vẹn của khóa chính',
          'D. Index làm giảm dung lượng lưu trữ của máy chủ',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Mặc dù Index tăng tốc vượt trội cho các truy vấn SELECT/WHERE, nhưng mỗi khi thêm/sửa/xóa dòng dữ liệu, DBMS phải ghi dữ liệu vào bảng và cập nhật cấu trúc cây Index (B-Tree/Hash), làm chậm tốc độ ghi (Write performance).',
        concept: 'Database Indexing & Optimization',
      },
    ];
    return pool.slice(0, count);
  }

  // 4. Computer Networks (Mạng máy tính)
  if (domain === 'NETWORK') {
    const pool = [
      {
        id: 'q1',
        question: 'Trong mô hình OSI 7 tầng, tầng nào chịu trách nhiệm truyền tải tin cậy dữ liệu giữa các tiến trình ứng dụng thông qua cơ chế kiểm soát lỗi và kiểm soát luồng?',
        options: [
          'A. Tầng Mạng (Network Layer)',
          'B. Tầng Giao vận (Transport Layer)',
          'C. Tầng Liên kết dữ liệu (Data Link Layer)',
          'D. Tầng Vật lý (Physical Layer)',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Tầng Giao vận (Transport Layer - Layer 4) chịu trách nhiệm truyền dữ liệu từ tiến trình đến tiến trình (End-to-End / Process-to-Process) qua các giao thức TCP và UDP, cung cấp cơ chế phân cổng (Port), kiểm soát luồng và kiểm soát tắc nghẽn.',
        concept: 'Mô hình OSI & Tầng Giao vận',
      },
      {
        id: 'q2',
        question: 'Quy trình bắt tay 3 bước của giao thức TCP (TCP 3-Way Handshake) diễn ra theo thứ tự cờ (Flags) nào?',
        options: [
          'A. SYN -> ACK -> FIN',
          'B. SYN -> SYN/ACK -> ACK',
          'C. ACK -> SYN -> SYN/ACK',
          'D. PSH -> RST -> URG',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Bắt tay 3 bước TCP: 1. Client gửi SYN tới Server. 2. Server phản hồi SYN-ACK. 3. Client gửi lại ACK xác nhận. Lúc này kết nối TCP chính thức được thiết lập để truyền dữ liệu.',
        concept: 'Cơ chế Bắt tay 3 bước TCP',
      },
      {
        id: 'q3',
        question: 'Một mạng IPv4 có địa chỉ 192.168.1.0/26 có thể gán tối đa bao nhiêu địa chỉ IP cho các máy chủ (Host)?',
        options: [
          'A. 64',
          'B. 62',
          'C. 30',
          'D. 126',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Với tiền tố /26, số bit host là 32 - 26 = 6 bit. Tổng số địa chỉ là 2^6 = 64. Trừ đi 1 địa chỉ mạng (Network ID) và 1 địa chỉ quảng bá (Broadcast ID), số máy chủ khả dụng là 64 - 2 = 62 hosts.',
        concept: 'Chia mạng con IPv4 (Subnetting)',
      },
    ];
    return pool.slice(0, count);
  }

  // 5. Web Development (Lập trình Web)
  if (domain === 'WEB') {
    const pool = [
      {
        id: 'q1',
        question: 'Trong kiến trúc React, cơ chế Virtual DOM giúp tối ưu hóa hiệu năng render giao diện chủ yếu nhờ vào quá trình nào?',
        options: [
          'A. Tự động biên dịch mã JavaScript sang ngôn ngữ máy (Assembly)',
          'B. So sánh khác biệt (Diffing) giữa cây Virtual DOM cũ và mới để cập nhật tối thiểu vào DOM thật',
          'C. Lưu trữ toàn bộ dữ liệu người dùng trên LocalStorage của trình duyệt',
          'D. Thay thế hoàn toàn giao thức HTTP bằng WebSockets hai chiều',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): React tạo ra một bản sao ảo của cây DOM trong bộ nhớ. Khi state thay đổi, React chạy thuật toán Diffing để so sánh cây Virtual DOM mới với cây cũ và chỉ áp dụng những thay đổi thực sự cần thiết (Patch) lên DOM thực tế, giảm thiểu chi phí re-render tốn kém.',
        concept: 'Virtual DOM & Reconciliation',
      },
      {
        id: 'q2',
        question: 'Khi sử dụng React Hook `useEffect`, việc cung cấp một mảng phụ thuộc rỗng `[]` (empty dependency array) có ý nghĩa gì?',
        options: [
          'A. Effect sẽ chạy lại sau mỗi lần component re-render',
          'B. Component sẽ bị hủy và render lại từ đầu',
          'C. Effect chỉ thực thi đúng một lần duy nhất sau lần render đầu tiên (tương đương componentDidMount)',
          'D. Vô hiệu hóa toàn bộ việc cập nhật State trong component',
        ],
        correctIndex: 2,
        explanation: 'Giải thích chi tiết (Rationale): Mảng dependency rỗng `[]` thông báo cho React biết rằng effect này không phụ thuộc vào bất kỳ giá trị state hay props nào, do đó nó chỉ chạy duy nhất một lần sau khi component được mount vào DOM.',
        concept: 'React Hooks (useEffect)',
      },
      {
        id: 'q3',
        question: 'Trong mô hình bố cục CSS Flexbox, thuộc tính nào được sử dụng để căn chỉnh các phần tử con dọc theo trục phụ (Cross Axis)?',
        options: [
          'A. justify-content',
          'B. align-items',
          'C. flex-direction',
          'D. flex-wrap',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): `justify-content` dùng để căn chỉnh dọc theo trục chính (Main Axis), trong khi `align-items` dùng để căn chỉnh các phần tử con dọc theo trục phụ (Cross Axis).',
        concept: 'CSS Flexbox Layout',
      },
      {
        id: 'q4',
        question: 'Trong giao thức HTTP/1.1 và HTTP/2, phương thức nào được định nghĩa là có tính chất "Idempotent" (kết quả không đổi khi gọi lặp lại nhiều lần)?',
        options: [
          'A. POST',
          'B. GET, PUT và DELETE',
          'C. Chỉ có PATCH',
          'D. CONNECT',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): GET, PUT và DELETE có tính chất Idempotent (gọi 1 lần hay n lần liên tiếp với cùng dữ liệu đều tạo ra cùng trạng thái tài nguyên trên server). Ngược lại, POST không idempotent vì mỗi lần gọi sẽ tạo thêm một tài nguyên mới.',
        concept: 'RESTful API & HTTP Methods',
      },
      {
        id: 'q5',
        question: 'Trong ngôn ngữ JavaScript ES6+, cú pháp Destructuring Assignment cho phép thực hiện điều gì?',
        options: [
          'A. Xóa hoàn toàn một object ra khỏi bộ nhớ Heap',
          'B. Trích xuất trực tiếp các thuộc tính của Object hoặc phần tử của Array vào các biến riêng biệt một cách ngắn gọn',
          'C. Chuyển đổi mã đồng bộ sang bất đồng bộ tự động',
          'D. Mã hóa chuỗi JSON thành mã nhị phân an toàn',
        ],
        correctIndex: 1,
        explanation: 'Giải thích chi tiết (Rationale): Destructuring Assignment (ví dụ: `const { name, age } = user;` hoặc `const [first, second] = list;`) cho phép giải nén các giá trị từ mảng hoặc thuộc tính từ đối tượng vào các biến độc lập.',
        concept: 'JavaScript ES6+',
      },
    ];
    return pool.slice(0, count);
  }

  // 6. Generic Academic Quiz Fallback
  return [
    {
      id: 'q1',
      question: `Theo nội dung bài học "${title || courseName}", mục tiêu trọng tâm cần đạt được là gì?`,
      options: [
        `A. Nắm vững cơ sở lý thuyết, định nghĩa chuẩn mực và phương pháp luận của ${courseName}`,
        'B. Ghi nhớ hình ảnh minh họa trên bìa tài liệu',
        'C. Thay đổi toàn bộ các chuẩn mực khoa học đã được công nhận trước đây',
        'D. Chỉ tập trung vào việc học thuộc lòng các con số ngẫu nhiên',
      ],
      correctIndex: 0,
      explanation: 'Giải thích chi tiết (Rationale): Học phần đại học chú trọng vào việc trang bị nền tảng lý thuyết vững chắc kết hợp phương pháp luận thực hành để sinh viên có năng lực phân tích và giải quyết bài toán độc lập.',
      concept: 'Mục tiêu học phần',
    },
    {
      id: 'q2',
      question: 'Khi phân tích bài toán chuyên môn trong tài liệu, bước đầu tiên cần thực hiện là gì?',
      options: [
        'A. Bắt đầu tính toán ngay mà không cần xem đề bài',
        'B. Xác định rõ các giả thiết, tham số đầu vào và điều kiện ràng buộc',
        'C. Dự đoán kết quả ngẫu nhiên',
        'D. Bỏ qua các bước kiểm tra tính hợp lệ',
      ],
      correctIndex: 1,
      explanation: 'Giải thích chi tiết (Rationale): Bước tiên quyết trong mọi phương pháp khoa học là phân tích yêu cầu, xác định giả thiết ban đầu và các giới hạn phạm vi áp dụng.',
      concept: 'Phương pháp luận nghiên cứu',
    },
    {
      id: 'q3',
      question: 'Yếu tố nào đóng vai trò là hạt nhân trung tâm bảo đảm tính tin cậy của hệ thống học thuật?',
      options: [
        'A. Tính ngẫu nhiên không có quy luật',
        'B. Tính nhất quán, logic và khả năng kiểm chứng được của dữ liệu',
        'C. Sự phụ thuộc tuyệt đối vào môi trường giả lập',
        'D. Các giả thuyết chưa qua thực nghiệm',
      ],
      correctIndex: 1,
      explanation: 'Giải thích chi tiết (Rationale): Tính nhất quán và khả năng kiểm chứng là tiêu chí cốt lõi để đảm bảo độ tin cậy của bất kỳ hệ thống học thuật hay kỹ thuật nào.',
      concept: 'Nguyên lý nhất quán',
    },
    {
      id: 'q4',
      question: 'Để chuẩn bị tốt nhất cho bài thi trắc nghiệm và đánh giá định kỳ, sinh viên nên ưu tiên phương pháp nào?',
      options: [
        'A. Tự làm các bộ câu hỏi quiz trắc nghiệm ôn tập, liên hệ lý thuyết với giải thích rationale',
        'B. Chỉ đọc lướt tiêu đề tài liệu',
        'C. Học tủ một câu hỏi duy nhất',
        'D. Bỏ qua các ví dụ thực hành của giảng viên',
      ],
      correctIndex: 0,
      explanation: 'Giải thích chi tiết (Rationale): Việc chủ động giải quiz và nghiên cứu kỹ phần giải thích (rationale) giúp củng cố kiến thức sâu sắc và rèn luyện phản xạ thi cử chính xác.',
      concept: 'Kỹ năng ôn tập hiệu quả',
    },
    {
      id: 'q5',
      question: 'Trong trường hợp gặp các nội dung phức tạp hoặc công thức chuyên sâu, cách tiếp cận tối ưu là gì?',
      options: [
        'A. Bỏ qua hoàn toàn phần khó',
        'B. Phân rã bài toán thành các thành phần nhỏ hơn, nắm vững từng tiên đề rồi tổng hợp lại',
        'C. Thay đổi công thức theo ý muốn',
        'D. Chỉ học phần kết luận mà không hiểu nguyên lý',
      ],
      correctIndex: 1,
      explanation: 'Giải thích chi tiết (Rationale): Phương pháp phân rã (Divide and Conquer) giúp đơn giản hóa các vấn đề phức tạp thành các đơn vị kiến thức dễ tiếp thu trước khi tích hợp vào bức tranh tổng thể.',
      concept: 'Tư duy giải quyết vấn đề',
    },
  ].slice(0, count);
}

export default {
  findRelevantDocument,
  summarizeDocument,
  generateQuizFromDocument,
};
