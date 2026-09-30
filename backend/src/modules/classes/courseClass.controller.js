import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './courseClass.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listClasses(req.query, req.user));
});

export const listOpen = asyncHandler(async (_req, res) => {
  res.json({ data: await service.listOpenClasses() });
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getClass(req.params.id));
});

export const students = asyncHandler(async (req, res) => {
  res.json(await service.listClassStudents(req.params.id, req.user));
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
