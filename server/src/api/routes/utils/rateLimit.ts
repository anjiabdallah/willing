import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

import type { Request } from 'express';

export const createCertificateVerificationRateLimit = () => rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    valid: false,
    message: 'Too many verification attempts. Please try again later.',
  },
});

export const createGlobalRateLimit = () => rateLimit({
  windowMs: 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: request => request.method === 'OPTIONS' || Boolean(request.userJWT),
  message: {
    message: 'Too many requests. Please slow down and try again shortly.',
  },
});

const PROFILE_RECOMPUTE_WINDOW_MS = 5 * 60 * 1000;
const PROFILE_RECOMPUTE_MAX_PER_WINDOW = 3;
const profileRecomputeAttempts = new Map<string, number[]>();

const getProfileRecomputeKey = (request: Request) => request.userJWT
  ? `user:${request.userJWT.role}:${request.userJWT.id}`
  : `ip:${ipKeyGenerator(request.ip ?? '127.0.0.1')}`;

export const canRecomputeProfileVector = (request: Request, now = Date.now()) => {
  const key = getProfileRecomputeKey(request);
  const recentAttempts = (profileRecomputeAttempts.get(key) ?? []).filter(
    timestamp => now - timestamp < PROFILE_RECOMPUTE_WINDOW_MS,
  );

  if (recentAttempts.length >= PROFILE_RECOMPUTE_MAX_PER_WINDOW) {
    profileRecomputeAttempts.set(key, recentAttempts);
    return false;
  }

  recentAttempts.push(now);
  profileRecomputeAttempts.set(key, recentAttempts);
  return true;
};
