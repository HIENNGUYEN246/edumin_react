import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { uploadDocument } from '../../middleware/upload.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './document.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.get('/:id/download', controller.download);

// Only admin/teacher manage documents.
router.post('/', authorize(ROLES.ADMIN, ROLES.TEACHER), uploadDocument, controller.create);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.remove);

export default router;
