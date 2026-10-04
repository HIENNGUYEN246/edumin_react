import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './enrollment.controller.js';

const router = Router();

const enrollSchema = z.object({ classId: z.string().trim().min(1, 'Thiếu mã lớp') });

// Enrollment actions belong to students.
router.use(authenticate, authorize(ROLES.STUDENT));

router.get('/me', controller.listMine);
router.post('/', validate(enrollSchema), controller.enroll);
router.delete('/:classId', controller.cancel);

export default router;
