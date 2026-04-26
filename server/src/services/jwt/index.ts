import * as jose from 'jose';

import config from '../../config.ts';

import type { UserJWT } from '../../types.ts';

export async function generateJWT(payload: UserJWT) {
  const token = await new jose.SignJWT({ ...payload })
    .setIssuedAt()
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1d')
    .sign(new TextEncoder().encode(config.JWT_SECRET));

  return token;
}

export async function verifyJWT(token: string) {
  const { payload } = await jose.jwtVerify<UserJWT>(
    token,
    new TextEncoder().encode(config.JWT_SECRET),
  );

  return payload;
}
