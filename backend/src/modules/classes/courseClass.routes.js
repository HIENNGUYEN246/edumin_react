import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import { ROLES } from '../../lib/roles.js';
import { createClassSchema, updateClassSchema, changeStatusSchema, updateStudentGradesSchema, updateGradeConfigSchema } from './courseClass.schema.js';
import * as controller from './courseClass.controller.js';

const router = Router();

router.use(authenticate);

// Admin gradebook overview & batch locking (must precede /:id)
router.get('/admin/gradebook-overview', authorize(ROLES.ADMIN), controller.adminGradebookOverview);
router.post('/admin/lock-all-grades', authorize(ROLES.ADMIN), controller.lockAllGrades);
router.get('/audit-logs/all', authorize(ROLES.ADMIN), controller.allGradeAuditLogs);

// Open classes inside the registration window (students browse these).
router.get('/open', controller.listOpen);
// All classes of a course (admin course-detail page).
router.get('/by-course/:courseId', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.listByCourse);
router.get('/student-groups', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.studentGroups);
router.get('/', controller.list);
router.get('/next-code', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.getNextCode);
router.get('/:id', controller.getOne);

// Student grades and gradebook configuration
router.patch('/:id/students/:studentId/grades', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(updateStudentGradesSchema), controller.updateStudentGrades);
router.patch('/:id/grade-lock', authorize(ROLES.ADMIN), controller.toggleGradeLock);
router.get('/:id/audit-logs', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.gradeAuditLogs);
router.patch('/:id/grade-config', authorize(ROLES.ADMIN, ROLES.TEACHER), validate(updateGradeConfigSchema), controller.updateGradeConfig);
router.get('/:id/students', authorize(ROLES.ADMIN, ROLES.TEACHER), controller.students);

router.post('/', authorize(ROLES.ADMIN), validate(createClassSchema), controller.create);
router.patch('/:id/status', authorize(ROLES.ADMIN), validate(changeStatusSchema), controller.changeStatus);
router.patch('/:id', authorize(ROLES.ADMIN), validate(updateClassSchema), controller.update);
router.delete('/:id', authorize(ROLES.ADMIN), controller.remove);

export default router;
