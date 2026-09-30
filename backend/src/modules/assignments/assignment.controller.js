import { asyncHandler } from '../../lib/asyncHandler.js';
import * as service from './assignment.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json(await service.listAssignments(req.query, req.user));
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json(await service.createAssignment(req.body, req.user));
});

export const update = asyncHandler(async (req, res) => {
  res.json(await service.updateAssignment(req.params.id, req.body, req.user));
});

export const remove = asyncHandler(async (req, res) => {
  res.json(await service.deleteAssignment(req.params.id, req.user));
});

export const submissions = asyncHandler(async (req, res) => {
  res.json(await service.listSubmissions(req.params.id, req.user));
});

export const submit = asyncHandler(async (req, res) => {
  res.status(201).json(await service.submitQuiz(req.params.id, req.body.answers, req.user));
});

export const mySubmission = asyncHandler(async (req, res) => {
  res.json(await service.getMySubmission(req.params.id, req.user));
});
