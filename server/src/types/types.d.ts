import { JwtPayload } from 'jsonwebtoken';

interface UserJWT extends JwtPayload {
  id: number;
  role: 'admin' | 'organization' | 'volunteer';
}

declare global {
  namespace Express {
    export interface Request {
      userJWT?: UserJWT;
    }
  }
}
