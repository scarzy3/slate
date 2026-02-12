import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireSuper } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list audit logs (super only)
router.get('/', authMiddleware, requireSuper, async (req, res) => {
  try {
    const { action, search, target, userId, from, to, limit, offset } = req.query;

    const take = Math.min(parseInt(limit) || 50, 500);
    const skip = parseInt(offset) || 0;

    const where = {};

    if (action) {
      where.action = action;
    }

    if (target) {
      where.target = target;
    }

    if (userId) {
      where.userId = userId;
    }

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
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

// GET /stats - aggregated audit log statistics (super only)
router.get('/stats', authMiddleware, requireSuper, async (req, res) => {
  try {
    const { from, to } = req.query;

    const where = {};
    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }

    const [total, byAction, byTarget, byUser, recentDays] = await prisma.$transaction([
      prisma.auditLog.count({ where }),

      // Count per action
      prisma.auditLog.groupBy({
        by: ['action'],
        where,
        _count: { action: true },
        orderBy: { _count: { action: 'desc' } },
      }),

      // Count per target
      prisma.auditLog.groupBy({
        by: ['target'],
        where,
        _count: { target: true },
        orderBy: { _count: { target: 'desc' } },
      }),

      // Count per user (top 10)
      prisma.auditLog.groupBy({
        by: ['userId'],
        where: { ...where, userId: { not: null } },
        _count: { userId: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 10,
      }),

      // Activity per day (last 30 days)
      prisma.$queryRaw`
        SELECT DATE(date) as day, COUNT(*)::int as count
        FROM "AuditLog"
        WHERE date >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(date)
        ORDER BY day DESC
      `.catch(() => []),
    ]);

    // Resolve user names for top actors
    const userIds = byUser.map(u => u.userId).filter(Boolean);
    const users = userIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, role: true } })
      : [];

    const topActors = byUser.map(u => {
      const user = users.find(x => x.id === u.userId);
      return { userId: u.userId, name: user?.name || 'Unknown', role: user?.role || '', count: u._count.userId };
    });

    return res.json({
      total,
      byAction: byAction.map(a => ({ action: a.action, count: a._count.action })),
      byTarget: byTarget.map(t => ({ target: t.target, count: t._count.target })),
      topActors,
      recentDays: (recentDays || []).map(d => ({ day: d.day, count: d.count })),
    });
  } catch (err) {
    console.error('Audit stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
