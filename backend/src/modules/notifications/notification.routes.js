import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import * as controller from './notification.controller.js';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', controller.list);
notificationRoutes.post('/', controller.createTargeted);
notificationRoutes.post('/targeted', controller.createTargeted);
notificationRoutes.post('/schedule-change', controller.createTargeted);
notificationRoutes.post('/broadcast', controller.createTargeted);
notificationRoutes.patch('/mark-all-read', controller.markAllRead);
notificationRoutes.patch('/:id/read', controller.markRead);
notificationRoutes.delete('/:id', controller.remove);
notificationRoutes.post('/bulk-delete', controller.bulkDelete);

export default notificationRoutes;

