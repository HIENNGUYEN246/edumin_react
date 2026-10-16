import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './tuition.controller.js';

const router = Router();

router.use(authenticate);

// Student self-service
router.get('/me', authorize(ROLES.STUDENT), controller.myTuition);

// Finance & Admin management routes
router.get('/', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.list);
router.get('/stats', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.stats);
router.get('/classes', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.classes);
router.get('/semesters', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.semesters);
router.patch('/bulk-status', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.bulkUpdate);
router.post('/import', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.importRows);
router.post('/generate', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.generate);
router.get('/:id', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.getOne);
router.post('/:id/pay', authorize(ROLES.ADMIN, ROLES.ACCOUNTANT), controller.pay);

export default router;
