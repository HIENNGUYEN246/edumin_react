import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../../config/env.js';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { uploadImage } from '../../middleware/upload.js';
import { loginSchema, changePasswordSchema } from './auth.schema.js';
import { registerSchema } from '../students/student.schema.js';
import * as controller from './auth.controller.js';

const router = Router();

// Tighter limit on the credential endpoint to slow brute-force attempts.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần thử, vui lòng thử lại sau' } },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { error: { code: 'RATE_LIMITED', message: 'Quá nhiều lần thử, vui lòng thử lại sau' } },
});

router.post('/login', loginLimiter, validate(loginSchema), controller.login);

// Public student self-registration.
router.get('/registration-options', controller.registrationOptions);
router.post('/register', registerLimiter, validate(registerSchema), controller.register);

router.get('/me', authenticate, controller.me);
router.patch('/me/password', authenticate, validate(changePasswordSchema), controller.changePassword);
router.put('/me/avatar', authenticate, uploadImage, controller.updateAvatar);

export default router;
