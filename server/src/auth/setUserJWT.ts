import { type Kysely } from 'kysely';

import { verifyJWT } from '../services/jwt/index.ts';

import type { Database } from '../db/tables/index.ts';
import type { RequestHandler } from 'express';

const createSetUserJWT = (db: Kysely<Database>) => {
  const setUserJWT: RequestHandler = async (req, _res, next) => {
    if (!req.headers.authorization) {
      next();
      return;
    }

    const token = req.headers.authorization!.split(' ')[1];
    if (!token) {
      next();
      return;
    }

    try {
      const payload = await verifyJWT(token);

      if (payload.role === 'admin') {
        const adminRow = await db
          .selectFrom('admin_account')
          .select('token_version')
          .where('id', '=', payload.id)
          .executeTakeFirst();

        const adminTokenVersion = adminRow ? Number(adminRow.token_version) : undefined;
        if (adminRow && adminTokenVersion === payload.token_version) {
          req.userJWT = payload;
          next();
          return;
        }

        _res.setHeader('x-jwt-status', 'invalid');
        next();
        return;
      }

      const accountTable = payload.role === 'organization' ? 'organization_account' : 'volunteer_account';
      const row = await db
        .selectFrom(accountTable)
        .select(['token_version', 'is_deleted', 'is_disabled'])
        .where('id', '=', payload.id)
        .executeTakeFirst();

      const rowTokenVersion = row ? Number(row.token_version) : undefined;

      if (row && rowTokenVersion === payload.token_version && !row.is_deleted && !row.is_disabled) {
        req.userJWT = payload;
      } else {
        _res.setHeader('x-jwt-status', 'invalid');
      }
    } catch {
      _res.setHeader('x-jwt-status', 'invalid');
    }

    next();
  };

  return setUserJWT;
};

export default createSetUserJWT;
