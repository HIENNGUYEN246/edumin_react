import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { createDepartmentSchema, updateDepartmentSchema } from './department.schema.js';
import * as controller from './department.controller.js';

const router = Router();

router.use(authenticate);

// Any authenticated user can read departments (needed by forms everywhere).
router.get('/', controller.list);
router.get('/:id', controller.getOne);

// Only admin can mutate.
router.post('/', authorize(ROLES.ADMIN), validate(createDepartmentSchema), controller.create);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateDepartmentSchema), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
