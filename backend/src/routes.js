import { Router } from 'express';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/department.routes.js';
import teacherRoutes from './modules/teachers/teacher.routes.js';
import studentRoutes from './modules/students/student.routes.js';
import accountRoutes from './modules/accounts/account.routes.js';
import courseRoutes from './modules/courses/course.routes.js';
import classRoutes from './modules/classes/courseClass.routes.js';
import enrollmentRoutes from './modules/enrollments/enrollment.routes.js';
import documentRoutes from './modules/documents/document.routes.js';
import assignmentRoutes from './modules/assignments/assignment.routes.js';
import statsRoutes from './modules/stats/stats.routes.js';

/**
 * Aggregate router. Feature modules register their sub-routers here.
 */
export const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/departments', departmentRoutes);
apiRouter.use('/teachers', teacherRoutes);
apiRouter.use('/students', studentRoutes);
apiRouter.use('/accounts', accountRoutes);
apiRouter.use('/courses', courseRoutes);
apiRouter.use('/classes', classRoutes);
apiRouter.use('/enrollments', enrollmentRoutes);
apiRouter.use('/documents', documentRoutes);
apiRouter.use('/assignments', assignmentRoutes);
apiRouter.use('/stats', statsRoutes);

export default apiRouter;
