import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './course.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listCourses(req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getCourse(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createCourse(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateCourse(req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteCourse(req.params.id));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importCourses(req.body.rows));
});
