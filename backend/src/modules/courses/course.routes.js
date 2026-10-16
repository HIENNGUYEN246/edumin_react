import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { createCourseSchema, updateCourseSchema, importCoursesSchema } from './course.schema.js';
import * as controller from './course.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id', controller.getOne);

router.post('/', authorize(ROLES.ADMIN), validate(createCourseSchema), controller.create);
router.post('/import', authorize(ROLES.ADMIN), validate(importCoursesSchema), controller.importRows);
router.post('/bulk-delete', authorize(ROLES.ADMIN), controller.bulkDelete);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateCourseSchema), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
