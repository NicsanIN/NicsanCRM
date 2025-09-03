import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';
import { createError } from './errorHandler';

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.method === 'OPTIONS') return next();

  // TEMP DEBUG: see what the server actually receives
  console.log('[AUTH]', req.method, req.originalUrl, 'auth=', req.headers.authorization || '<none>');

  const hdr = req.headers.authorization;
  if (!hdr) return next(createError('Access token required', 401));

  const m = /^Bearer\s+(.+)$/.exec(hdr);
  if (!m) return next(createError('Invalid authorization header', 401));
  const token = m[1];

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, secret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(createError('Invalid token', 401));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(createError('Token expired', 401));
    }
    return next(createError('Token verification failed', 401));
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(createError('Authentication required', 401));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(createError('Insufficient permissions', 403));
    }

    next();
  };
};

export const requireOpsRole = requireRole(['ops']);
export const requireFounderRole = requireRole(['founder']);
export const requireAnyRole = requireRole(['ops', 'founder']);
