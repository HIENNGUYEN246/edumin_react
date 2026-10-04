import { z } from 'zod';
import { ROLES } from '../../lib/roles.js';

export const listAccountsSchema = z.object({
  role: z.enum([ROLES.TEACHER, ROLES.STUDENT, ROLES.ADMIN]).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(['Active', 'Locked']),
  lockReason: z.string().trim().max(300).optional().default(''),
});
