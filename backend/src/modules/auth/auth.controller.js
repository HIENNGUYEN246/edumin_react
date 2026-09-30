import { asyncHandler } from '../../lib/asyncHandler.js';
import * as authService from './auth.service.js';
import { registerStudent } from '../students/student.service.js';
import { Department } from '../departments/department.model.js';

export const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.json(result);
});

export const registrationOptions = asyncHandler(async (_req, res) => {
  const departments = await Department.find({}).select('id name').sort({ name: 1 }).lean();
  res.json({ departments });
});

export const register = asyncHandler(async (req, res) => {
  res.status(201).json(await registerStudent(req.body));
});

export const me = asyncHandler(async (req, res) => {
  res.json(await authService.getMe(req.user));
});

export const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changeOwnPassword(req.user._id, req.body);
  res.json(result);
});

export const updateAvatar = asyncHandler(async (req, res) => {
  res.json(await authService.updateMyAvatar(req.user, req.file));
});
