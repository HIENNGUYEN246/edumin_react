import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './courseClass.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listClasses(req.query, req.user));
});

export const listOpen = asyncHandler(async (_req, res) => {
  res.json({ data: await service.listOpenClasses() });
});

export const listByCourse = asyncHandler(async (req, res) => {
  res.json(await service.listClassesByCourse(req.params.courseId));
});

export const studentGroups = asyncHandler(async (_req, res) => {
  res.json(await service.listStudentClassesSummary());
});

export const changeStatus = asyncHandler(async (req, res) => {
  res.json(await service.changeStatus(req.params.id, req.body.status));
});

export const getNextCode = asyncHandler(async (req, res) => {
  const code = await service.generateClassId(req.query.courseId);
  res.json({ data: { nextCode: code } });
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getClass(req.params.id));
});

export const students = asyncHandler(async (req, res) => {
  res.json(await service.listClassStudents(req.params.id, req.user));
});

export const updateStudentGrades = asyncHandler(async (req, res) => {
  res.json(await service.updateStudentGrades(req.params.id, req.params.studentId, req.body.grades, req.user, req.body.reason));
});

export const adminGradebookOverview = asyncHandler(async (req, res) => {
  res.json(await service.getAdminGradebookOverview(req.query));
});

export const toggleGradeLock = asyncHandler(async (req, res) => {
  res.json(await service.toggleGradeLock(req.params.id, req.body, req.user));
});

export const lockAllGrades = asyncHandler(async (req, res) => {
  res.json(await service.lockAllGrades(req.body, req.user));
});

export const gradeAuditLogs = asyncHandler(async (req, res) => {
  res.json(await service.getGradeAuditLogs(req.params.id));
});

export const allGradeAuditLogs = asyncHandler(async (_req, res) => {
  res.json(await service.getGradeAuditLogs());
});

export const updateGradeConfig = asyncHandler(async (req, res) => {
  res.json(await service.updateGradeConfig(req.params.id, req.body, req.user));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createClass(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateClass(req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteClass(req.params.id));
});
