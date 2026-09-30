import { hashPassword } from '../../src/lib/password.js';
import { signToken } from '../../src/lib/jwt.js';
import { ROLES } from '../../src/lib/roles.js';
import { User } from '../../src/modules/auth/user.model.js';

let counter = 0;

/** Create a User with a known password and return the doc + a valid token. */
export async function createUser({ role = ROLES.ADMIN, password = 'Passw0rd!', ...rest } = {}) {
  counter += 1;
  const user = await User.create({
    email: `user${counter}@edu.vn`,
    hoTen: `User ${counter}`,
    status: 'Active',
    lockReason: '',
    ...rest,
    role,
    passwordHash: await hashPassword(password),
  });
  return { user, token: signToken(user), password };
}

export function authHeader(token) {
  return { Authorization: `Bearer ${token}` };
}
