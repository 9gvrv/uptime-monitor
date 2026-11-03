import bcrypt from "bcrypt";
import { sign } from "hono/jwt";
import config from "../../config.js";

const SALT_ROUNDS = 12;
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
 */
export async function generateToken(user: { id: number; email: string }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: String(user.id),
    email: user.email,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  return sign(payload, config.jwt_secret, "HS256");
}
