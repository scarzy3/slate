import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

export async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // Allow recently-expired tokens (within 7 days) for the refresh endpoint only
      if (err.name === 'TokenExpiredError' && req.path === '/refresh') {
        decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        const expiredAt = decoded.exp * 1000;
        const gracePeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (Date.now() - expiredAt > gracePeriod) {
          return res.status(401).json({ error: 'Token expired beyond refresh window' });
        }
      } else {
        throw err;
      }
    }

    // Fetch current user from DB so role/permissions are never stale
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, deptId: true, approvalStatus: true },
    });

    if (!currentUser) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = { ...decoded, role: currentUser.role, name: currentUser.name, deptId: currentUser.deptId, approvalStatus: currentUser.approvalStatus };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware that blocks users whose account has not been approved.
 * Must be used AFTER authMiddleware so req.user is populated.
 * Returns 403 with a specific code so the frontend can show the right screen.
 */
export function requireApproved(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  if (req.user.approvalStatus === 'pending') {
    return res.status(403).json({
      error: 'Your account is pending approval',
      code: 'PENDING_APPROVAL',
    });
  }

  if (req.user.approvalStatus === 'denied') {
    return res.status(403).json({
      error: 'Your account has been denied',
      code: 'ACCOUNT_DENIED',
    });
  }

  next();
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, name: true, deptId: true, approvalStatus: true },
      });
      if (currentUser) {
        req.user = { ...decoded, role: currentUser.role, name: currentUser.name, deptId: currentUser.deptId, approvalStatus: currentUser.approvalStatus };
      }
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}
