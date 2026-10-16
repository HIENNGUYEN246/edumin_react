import { z } from 'zod';

const questionSchema = z
  .object({
    id: z.string().trim().min(1),
    text: z.string().trim().optional(),
    question: z.string().trim().optional(),
    options: z.array(z.string()).min(2, 'Cần ít nhất 2 lựa chọn'),
    correctIndex: z.coerce.number().int().min(0),
    explanation: z.string().optional().default(''),
  })
  .transform((val) => ({
    id: val.id,
    text: val.text || val.question || 'Câu hỏi trắc nghiệm',
    options: val.options,
    correctIndex: val.correctIndex,
    explanation: val.explanation || '',
  }));

export const createAssignmentSchema = z
  .object({
    courseId: z.string().trim().optional().default(''),
    classId: z.string().trim().optional().default(''),
    type: z.enum(['file', 'quiz']).default('file'),
    title: z.string().trim().min(1, 'Tiêu đề là bắt buộc').max(200),
    description: z.string().trim().optional().default(''),
    dueDate: z.string().trim().optional().default(''),
    status: z.enum(['Công khai', 'Ẩn']).optional().default('Công khai'),
    questions: z.array(questionSchema).optional().default([]),
  })
  .refine((v) => Boolean(v.courseId || v.classId), {
    message: 'Chọn học phần hoặc lớp học phần',
    path: ['courseId'],
  })
  .refine((v) => v.type !== 'quiz' || v.questions.length > 0, {
    message: 'Bài quiz cần ít nhất một câu hỏi',
    path: ['questions'],
  });

export const updateAssignmentSchema = z.object({
  classId: z.string().trim().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().optional(),
  dueDate: z.string().trim().optional(),
  status: z.enum(['Công khai', 'Ẩn']).optional(),
  questions: z.array(questionSchema).optional(),
});

export const submitSchema = z.object({
  // answers: { [questionId]: selectedOptionIndex }
  answers: z.record(z.coerce.number().int().min(0)),
});
