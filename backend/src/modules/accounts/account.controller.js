import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './account.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listAccounts(req.query));
});

export const updateStatus = asyncHandler(async (req, res) => {
  res.json(await service.updateStatus(req.user, req.params.id, req.body));
});

export const resetPassword = asyncHandler(async (req, res) => {
  res.json(await service.resetPassword(req.params.id));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteAccount(req.user, req.params.id));
});

export const bulkDelete = asyncHandler(async (req, res) => {
  res.json(await service.bulkDeleteAccounts(req.user, req.body.ids));
});

