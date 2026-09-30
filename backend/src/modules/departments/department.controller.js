import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './department.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listDepartments(req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getDepartment(req.params.id));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createDepartment(req.body));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateDepartment(req.params.id, req.body));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteDepartment(req.params.id));
});
