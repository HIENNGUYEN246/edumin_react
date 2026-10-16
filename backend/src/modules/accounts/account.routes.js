import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { listAccountsSchema, updateStatusSchema } from './account.schema.js';
import * as controller from './account.controller.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.get('/', validate(listAccountsSchema, 'query'), controller.list);
router.patch('/:id/status', validate(updateStatusSchema), controller.updateStatus);
router.post('/:id/reset-password', controller.resetPassword);
router.post('/bulk-delete', controller.bulkDelete);
router.delete('/:id', controller.remove);

export default router;
