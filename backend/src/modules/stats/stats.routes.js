import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { ROLES } from '../../lib/roles.js';
import { getOverview } from './stats.service.js';

const router = Router();

router.get(
  '/overview',
  authenticate,
  authorize(ROLES.ADMIN),
  asyncHandler(async (_req, res) => {
    res.json(await getOverview());
  })
);

export default router;
