import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './student.service.js';

function extractEntityId(req) {
  const paramId = req.params?.id;
  if (paramId && paramId !== 'undefined' && paramId !== 'null' && paramId !== '[object Object]') {
    return String(paramId).trim();
  }
  const bodyId = req.body?.id || req.body?._id;
  if (bodyId && bodyId !== 'undefined' && bodyId !== 'null' && bodyId !== '[object Object]') {
    return typeof bodyId === 'string' ? bodyId.trim() : bodyId;
  }
  return paramId || bodyId;
}

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listStudents(req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  const studentId = extractEntityId(req);
  res.json(await service.getStudent(studentId));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createStudent(req.body));
});

export const update = asyncHandler(async (req, res) => {
  const studentId = extractEntityId(req);
  res.json(await service.updateStudent(studentId, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  const studentId = extractEntityId(req);
  res.json(await service.deleteStudent(studentId));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await service.bulkDeleteStudents(req.body.ids));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const studentId = extractEntityId(req);
  res.json(await service.setStudentAvatar(studentId, req.file));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importStudents(req.body.rows));
});
