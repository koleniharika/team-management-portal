import { sign, verify } from 'hono/jwt';

const DAYS = 7;
// hono/jwt requires the algorithm to be named explicitly on verify (>=4.13)
const ALG = 'HS256';

/** Token carries only what authorisation needs: who, and what role. */
export const signToken = (user, secret) => sign(
  {
    sub: user.id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + DAYS * 24 * 60 * 60,
  },
  secret,
  ALG,
);

export async function verifyToken(token, secret) {
  try {
    return await verify(token, secret, ALG);
  } catch {
    return null; // expired, tampered, or signed with a different secret
  }
}
