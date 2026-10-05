import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './teacher.service.js';

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
  res.json(await service.listTeachers(req.query));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(await service.getMyTeacher(req.user));
});

export const getOne = asyncHandler(async (req, res) => {
  const teacherId = extractEntityId(req);
  res.json(await service.getTeacher(teacherId));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTeacher(req.body));
});

export const update = asyncHandler(async (req, res) => {
  const teacherId = extractEntityId(req);
  res.json(await service.updateTeacher(teacherId, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  const teacherId = extractEntityId(req);
  res.json(await service.deleteTeacher(teacherId));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await service.bulkDeleteTeachers(req.body.ids));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  const teacherId = extractEntityId(req);
  res.json(await service.setTeacherAvatar(teacherId, req.file));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importTeachers(req.body.rows));
});
