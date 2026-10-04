import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', controller.list);
notificationRoutes.patch('/mark-all-read', controller.markAllRead);
notificationRoutes.patch('/:id/read', controller.markRead);
notificationRoutes.delete('/:id', controller.remove);
notificationRoutes.post('/bulk-delete', controller.bulkDelete);

export default notificationRoutes;

