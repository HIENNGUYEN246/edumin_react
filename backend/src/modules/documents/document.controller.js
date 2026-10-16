import mongoose from 'mongoose';
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
  const file = req.files?.file?.[0] || req.file || req.files?.files?.[0] || null;
  res.json(await service.updateDocument(req.params.id, req.body, file, req.user));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteDocument(req.params.id, req.user));
});

export const download = asyncHandler(async (req, res) => {
  res.json(await service.getDownloadUrl(req.params.id, req.user));
});

export const summarize = asyncHandler(async (req, res) => {
  const result = await service.summarizeDocumentById(req.params.id, req.body, req.user);
  res.json({ success: true, ...result });
});

export const generateQuiz = asyncHandler(async (req, res) => {
  const result = await service.generateQuizByDocumentId(req.params.id, req.body, req.user);
  res.json({ success: true, ...result });
});

export const studyQuery = asyncHandler(async (req, res) => {
  const doc = await service.findDocumentForStudy(req.body, req.user);
  if (!doc) {
    return res.status(404).json({ error: 'Không tìm thấy tài liệu phù hợp cho yêu cầu này' });
  }
  if (doc.unauthorized) {
    return res.status(403).json({ error: doc.message });
  }
  const { mode, chapter, focus, count } = req.body;
  if (mode === 'quiz') {
    const result = await service.generateQuizByDocumentId(doc._id, { chapter, count }, req.user);
    return res.json({ success: true, ...result });
  }
  const result = await service.summarizeDocumentById(doc._id, { chapter, focus }, req.user);
  res.json({ success: true, ...result });
});

