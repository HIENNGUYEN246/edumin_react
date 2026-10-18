import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './profileRequest.controller.js';

export const profileRequestRoutes = Router();

profileRequestRoutes.use(authenticate);

// Current user can check their latest request
profileRequestRoutes.get('/my-latest', controller.getMyLatest);

// Admin or Teacher can list, approve, reject
profileRequestRoutes.get('/', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.list);
profileRequestRoutes.put('/:id/approve', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.approve);
profileRequestRoutes.put('/:id/reject', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.reject);
profileRequestRoutes.post('/bulk-approve', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.bulkApprove);
profileRequestRoutes.patch('/bulk-approve', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.bulkApprove);
profileRequestRoutes.put('/bulk-approve', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.bulkApprove);
profileRequestRoutes.post('/bulk-reject', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.bulkReject);
profileRequestRoutes.post('/bulk-delete', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.bulkDelete);

export default profileRequestRoutes;
