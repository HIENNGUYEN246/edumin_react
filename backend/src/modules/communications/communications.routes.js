import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { listRecipientsSchema, sendAccountCredentialsSchema } from './communications.schema.js';
import * as controller from './communications.controller.js';

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));
router.get('/recipients', validate(listRecipientsSchema, 'query'), controller.listRecipients);
router.post(
  '/account-credentials',
  validate(sendAccountCredentialsSchema),
  controller.sendAccountCredentials
);

export default router;
