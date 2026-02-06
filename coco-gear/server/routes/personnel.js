import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm, requireRole } from '../middleware/rbac.js';
import { validate, personnelSchema, personnelUpdateSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

const SALT_ROUNDS = 10;

// GET / - list all users (any authenticated user — needed for kit checkout/return display)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        title: true,
        role: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { kitCheckouts: true, kitsIssued: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(users);
  } catch (err) {
    console.error('List personnel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single user (any authenticated user)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        title: true,
        role: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, color: true } },
        _count: { select: { kitCheckouts: true, kitsIssued: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create user (admin+, perm: personnel)
router.post('/', authMiddleware, requireAdminPerm('personnel'), validate(personnelSchema), async (req, res) => {
  try {
    const { name, title, role, deptId, pin } = req.validated;

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        title,
        role,
        deptId,
        pin: pinHash,
      },
      select: {
        id: true,
        name: true,
        title: true,
        role: true,
        deptId: true,
        createdAt: true,
        department: { select: { id: true, name: true, color: true } },
      },
    });

    await auditLog('personnel_create', 'user', user.id, req.user.id, { name, role });

    return res.status(201).json(user);
  } catch (err) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update user (admin+, perm: personnel)
router.put('/:id', authMiddleware, requireAdminPerm('personnel'), validate(personnelUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, title, role, deptId, pin } = req.validated;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Protect primary director from demotion
    if (['director','super','engineer'].includes(existing.role) && role && !['director','super','engineer'].includes(role)) {
      const directorCount = await prisma.user.count({ where: { role: { in: ['director', 'super', 'engineer'] } } });
      if (directorCount <= 1) {
        return res.status(403).json({ error: 'Cannot demote the only director' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (title !== undefined) data.title = title;
    if (role !== undefined) data.role = role;
    if (deptId !== undefined) data.deptId = deptId;
    if (pin !== undefined) {
      data.pin = await bcrypt.hash(pin, SALT_ROUNDS);
      data.mustChangePassword = true;
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        title: true,
        role: true,
        deptId: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, color: true } },
      },
    });

    await auditLog('personnel_update', 'user', id, req.user.id, { name: user.name });

    return res.json(user);
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete if no kits issued (admin+, perm: personnel)
router.delete('/:id', authMiddleware, requireAdminPerm('personnel'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { kitsIssued: true } } },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot delete the last director
    if (['director','super','engineer'].includes(user.role)) {
      const directorCount = await prisma.user.count({ where: { role: { in: ['director', 'super', 'engineer'] } } });
      if (directorCount <= 1) {
        return res.status(403).json({ error: 'Cannot delete the only director' });
      }
    }

    if (user._count.kitsIssued > 0) {
      return res.status(409).json({ error: 'Cannot delete user with kits currently issued' });
    }

    await prisma.user.delete({ where: { id } });

    await auditLog('personnel_delete', 'user', id, req.user.id, { name: user.name });

    return res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
