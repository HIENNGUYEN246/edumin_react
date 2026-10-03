import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './tuition.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listTuitions(req.query));
});

export const stats = asyncHandler(async (req, res) => {
  res.json(await service.getTuitionStats(req.query));
});

export const getOne = asyncHandler(async (req, res) => {
  res.json(await service.getTuition(req.params.id));
});

export const myTuition = asyncHandler(async (req, res) => {
  res.json(await service.getStudentTuitions(req.user));
});

export const pay = asyncHandler(async (req, res) => {
  res.json(await service.recordPayment(req.params.id, req.body, req.user));
});

export const bulkUpdate = asyncHandler(async (req, res) => {
  res.json(await service.bulkUpdateStatus(req.body, req.user));
});

export const importRows = asyncHandler(async (req, res) => {
  res.json(await service.importTuitionRows(req.body.rows, req.user));
});

export const generate = asyncHandler(async (req, res) => {
  res.json(await service.autoGenerateTuitionsForActiveStudents(req.body?.semester));
});

export const classes = asyncHandler(async (req, res) => {
  res.json(await service.getDistinctClasses());
});

export const semesters = asyncHandler(async (req, res) => {
  res.json(await service.getDistinctSemesters());
});
