import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './communications.service.js';

export const listRecipients = asyncHandler(async (req, res) => {
  res.json(await service.listRecipients(req.query));
});

export const sendAccountCredentials = asyncHandler(async (req, res) => {
  res.json(await service.sendAccountCredentials(req.body.recipients));
});
