import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './enrollment.service.js';

export const listMine = asyncHandler(async (req, res) => {
  res.json({ data: await service.listMyEnrollments(req.user) });
});

export const enroll = asyncHandler(async (req, res) => {
  res.status(201).json(await service.enroll(req.user, req.body.classId));
});

export const cancel = asyncHandler(async (req, res) => {
  res.json(await service.cancel(req.user, req.params.classId));
});
