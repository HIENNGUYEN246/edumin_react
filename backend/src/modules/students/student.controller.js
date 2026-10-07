import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './student.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listStudents(req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getStudent(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createStudent(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateStudent(req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteStudent(req.params.id));
});

export const uploadAvatar = asyncHandler(async (req, res) => {
  res.json(await service.setStudentAvatar(req.params.id, req.file));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importStudents(req.body.rows));
});

export const bulkRemove = asyncHandler(async (req, res) => {
  const ids = req.body?.ids || req.body;
  res.json(await service.bulkDeleteStudents(ids));
});
