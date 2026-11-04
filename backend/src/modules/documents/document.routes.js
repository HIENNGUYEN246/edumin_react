import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { uploadDocument } from '../../middleware/upload.js';
import { ROLES } from '../../lib/roles.js';
import * as controller from './document.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/study/query', controller.studyQuery);
router.get('/:id/file', controller.streamFile);
router.get('/:id/download', controller.download);
router.get('/:id/ai-study', controller.getAiStudy);
router.get('/:id', controller.getById);
router.post('/:id/summarize', controller.summarize);
router.post('/:id/generate-quiz', controller.generateQuiz);
router.put('/:id/publish-summary', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.publishSummary);
router.put('/:id/publish-quiz', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.publishQuiz);

router.post('/', authorize(ROLES.ADMIN, ROLES.TEACHER), uploadDocument, controller.create);
router.patch('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), uploadDocument, controller.update);
router.delete('/:id', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.remove);

export default router;
