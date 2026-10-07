import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadImage } from '../../middleware/upload.js';
import { ROLES } from '../../lib/roles.js';
import { createStudentSchema, updateStudentSchema, importStudentsSchema } from './student.schema.js';
import * as controller from './student.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.list);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.getOne);

router.post('/', authorize(ROLES.ADMIN), validate(createStudentSchema), controller.create);
router.post('/import', authorize(ROLES.ADMIN), validate(importStudentsSchema), controller.importRows);
router.post('/bulk-delete', authorize(ROLES.ADMIN), controller.bulkRemove);
router.delete('/bulk', authorize(ROLES.ADMIN), controller.bulkRemove);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateStudentSchema), controller.update);
router.put('/:id/avatar', authorize(ROLES.ADMIN), uploadImage, controller.uploadAvatar);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
