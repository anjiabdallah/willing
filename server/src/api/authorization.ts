import { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config.js';
import { UserJWT } from '../types/types.js';

export const authorizeOnly = (...roles: ('admin' | 'organization' | 'volunteer')[]) => {
  return ((req, res, next) => {
    if (!req.userJWT || !roles.includes(req.userJWT.role)) {
      res.status(403);
      next(new Error ('Unauthorized'));
    } else {
      next();
    }
  }) as RequestHandler;
};

export const setUserJWT = ((req, res, next) => {
  if (!req.headers.authorization) {
    next();
    return;
  };

  const token = req.headers.authorization!.split(' ')[1];
  if (!token) {
    next();
    return;
  }

  try {
    const validated = jwt.verify(token, config.JWT_SECRET) as UserJWT;
    req.userJWT = validated;
  } catch {
    // If parsing the jwt failed, consider the user not logged in
  }

  next();
}) as RequestHandler;
