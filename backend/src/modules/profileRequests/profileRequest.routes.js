import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './profileRequest.controller.js';

export const profileRequestRoutes = Router();

profileRequestRoutes.use(authenticate);

// Current user can check their latest request
profileRequestRoutes.get('/my-latest', controller.getMyLatest);

// Only Admin can list, approve, reject
profileRequestRoutes.get('/', authorize(ROLES.ADMIN), controller.list);
profileRequestRoutes.put('/:id/approve', authorize(ROLES.ADMIN), controller.approve);
profileRequestRoutes.put('/:id/reject', authorize(ROLES.ADMIN), controller.reject);
profileRequestRoutes.post('/bulk-approve', authorize(ROLES.ADMIN), controller.bulkApprove);
profileRequestRoutes.patch('/bulk-approve', authorize(ROLES.ADMIN), controller.bulkApprove);
profileRequestRoutes.put('/bulk-approve', authorize(ROLES.ADMIN), controller.bulkApprove);
profileRequestRoutes.post('/bulk-reject', authorize(ROLES.ADMIN), controller.bulkReject);
profileRequestRoutes.post('/bulk-delete', authorize(ROLES.ADMIN), controller.bulkDelete);

export default profileRequestRoutes;
