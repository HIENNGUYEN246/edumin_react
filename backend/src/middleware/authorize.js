import { AppError } from '../lib/AppError.js';

/**
 * Restrict a route to one or more roles. Must run after `authenticate`.
 * @param {...string} roles
 */
export const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (roles.length && !roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };

export default authorize;
