import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { createAssignmentSchema, updateAssignmentSchema, submitSchema } from './assignment.schema.js';
import * as controller from './assignment.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);

// Teacher/admin management.
router.post('/', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(createAssignmentSchema), controller.create);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(updateAssignmentSchema), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.remove);
router.get('/:id/submissions', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.submissions);

// Student actions.
router.post('/:id/submissions', authorize(ROLES.STUDENT), validate(submitSchema), controller.submit);
router.get('/:id/my-submission', authorize(ROLES.STUDENT), controller.mySubmission);

export default router;
