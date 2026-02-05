import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuper } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list audit logs (super only)
router.get('/', authMiddleware, requireSuper, async (req, res) => {
  try {
    const { action, search, limit, offset } = req.query;

    const take = Math.min(parseInt(limit) || 50, 500);
    const skip = parseInt(offset) || 0;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { target: { contains: search, mode: 'insensitive' } },
        { targetId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { date: 'desc' },
        take,
        skip,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({ logs, total, limit: take, offset: skip });
  } catch (err) {
    console.error('List audit logs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
