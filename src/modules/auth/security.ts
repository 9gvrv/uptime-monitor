import bcrypt from "bcryptjs";
import { sign } from "hono/jwt";

/**
 * bcryptjs is a pure-JS drop-in replacement for the native `bcrypt` package,
 * which cannot run in Workerd. The hash format is identical, so hashes created
 * by the old native library still verify here.
 */

const SALT_ROUNDS = 4;
const TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

export async function hashPassword(password: string) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  password: string,
  hashedPassword: string
) {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Sign a JWT for the given user.
 *
 * - `exp` MUST be in seconds per the JWT spec (previously milliseconds, which
 *   made every token instantly-expired for any standards-compliant verifier).
 * - `sub` carries the user id so protected routes can load the row directly.
 * - The secret is passed in (from the request bindings) rather than read from
 *   a module-level config, so the function is environment-agnostic.
 */
export async function generateToken(
  user: { id: number; email: string },
  jwtSecret: string
) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  return sign(payload, jwtSecret, "HS256");
}
