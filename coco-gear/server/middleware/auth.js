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
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch current user from DB so role/permissions are never stale
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, role: true, name: true, deptId: true },
    });

    if (!currentUser) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    req.user = { ...decoded, role: currentUser.role, name: currentUser.name, deptId: currentUser.deptId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      const currentUser = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, role: true, name: true, deptId: true },
      });
      if (currentUser) {
        req.user = { ...decoded, role: currentUser.role, name: currentUser.name, deptId: currentUser.deptId };
      }
    } catch {
      // ignore invalid tokens for optional auth
    }
  }
  next();
}
