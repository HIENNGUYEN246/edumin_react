import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { uploadImage } from '../../middleware/upload.js';
import { ROLES } from '../../lib/roles.js';
import { createTeacherSchema, updateTeacherSchema, importTeachersSchema } from './teacher.schema.js';
import * as controller from './teacher.controller.js';

const router = Router();

router.use(authenticate);

// Reading the teacher directory is available to any authenticated user
// (forms elsewhere need it, e.g. picking a department head or class teacher).
router.get('/', controller.list);
router.get('/me', authorize(ROLES.TEACHER), controller.getMe);
router.get('/:id', controller.getOne);

router.post('/', authorize(ROLES.ADMIN), validate(createTeacherSchema), controller.create);
router.post('/import', authorize(ROLES.ADMIN), validate(importTeachersSchema), controller.importRows);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateTeacherSchema), controller.update);
router.put('/:id/avatar', authorize(ROLES.ADMIN), uploadImage, controller.uploadAvatar);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
