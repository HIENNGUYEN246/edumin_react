import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { createClassSchema, updateClassSchema } from './courseClass.schema.js';
import * as controller from './courseClass.controller.js';

const router = Router();

router.use(authenticate);

// Open classes inside the registration window (students browse these).
router.get('/open', controller.listOpen);
router.get('/', controller.list);
router.get('/:id', controller.getOne);
router.get('/:id/students', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.students);

router.post('/', authorize(ROLES.ADMIN), validate(createClassSchema), controller.create);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateClassSchema), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
