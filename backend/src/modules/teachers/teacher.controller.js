import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './teacher.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listTeachers(req.query));
});

export const getMe = asyncHandler(async (req, res) => {
  res.json(await service.getMyTeacher(req.user));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getTeacher(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createTeacher(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateTeacher(req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteTeacher(req.params.id));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await service.bulkDeleteTeachers(req.body.ids));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  res.json(await service.setTeacherAvatar(req.params.id, req.file));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importTeachers(req.body.rows));
});
