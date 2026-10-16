import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './profileRequest.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listRequests(req.query));
});

export const getMyLatest = asyncHandler(async (req, res) => {
  res.json(await service.getMyLatestRequest(req.user));
});

export const approve = asyncHandler(async (req, res) => {
  res.json(await service.approveOne(req.params.id, req.user));
});

export const reject = asyncHandler(async (req, res) => {
  res.json(await service.rejectOne(req.params.id, req.user, req.body.reason));
});

export const bulkApprove = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body) ? req.body : req.body.ids || req.body.items || [];
  res.json(await service.bulkApprove(ids, req.user));
});

export const bulkReject = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body) ? req.body : req.body.ids || req.body.items || [];
  res.json(await service.bulkReject(ids, req.user, req.body.reason));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await service.bulkDelete(req.body.ids));
});

