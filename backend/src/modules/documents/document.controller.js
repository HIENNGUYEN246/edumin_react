import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './document.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listDocuments(req.query, req.user));
});

export const create = asyncHandler(async (req, res) => {
  const files = req.files?.files?.length
    ? req.files.files
    : req.file
    ? [req.file]
    : [];
  res.status(201).json(await service.createDocument(req.body, files, req.user));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateDocument(req.params.id, req.body, req.user));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteDocument(req.params.id, req.user));
});

export const download = asyncHandler(async (req, res) => {
  res.json(await service.getDownloadUrl(req.params.id, req.user));
});
