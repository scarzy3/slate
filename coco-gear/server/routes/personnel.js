import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm, requireRole } from '../middleware/rbac.js';
import { validate, personnelSchema, personnelUpdateSchema, bulkImportSchema } from '../utils/validation.js';
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
        email: true,
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
        email: true,
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
    const { name, email, title, role, deptId, pin } = req.validated;

    // Check email uniqueness if provided
    if (email) {
      const existingEmail = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existingEmail) {
        return res.status(409).json({ error: `Email ${email} is already in use` });
      }
    }

    const pinHash = await bcrypt.hash(pin, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name,
        email: email ? email.toLowerCase() : null,
        title,
        role,
        deptId,
        pin: pinHash,
      },
      select: {
        id: true,
        name: true,
        email: true,
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
    const { name, email, title, role, deptId, pin } = req.validated;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Developer account cannot be demoted
    if (existing.role === 'developer') {
      if (role && role !== 'developer') {
        return res.status(403).json({ error: 'Cannot modify the developer account role' });
      }
    }

    // Protect primary director from demotion
    if (['director','super','engineer'].includes(existing.role) && role && !['director','super','engineer','developer'].includes(role)) {
      const directorCount = await prisma.user.count({ where: { role: { in: ['developer', 'director', 'super', 'engineer'] } } });
      if (directorCount <= 1) {
        return res.status(403).json({ error: 'Cannot demote the only director' });
      }
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email ? email.toLowerCase() : null;
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
        email: true,
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

    // Developer account cannot be deleted
    if (user.role === 'developer') {
      return res.status(403).json({ error: 'Cannot delete the developer account' });
    }

    // Cannot delete the last director
    if (['director','super','engineer'].includes(user.role)) {
      const directorCount = await prisma.user.count({ where: { role: { in: ['developer', 'director', 'super', 'engineer'] } } });
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

// POST /import - bulk import team members (admin+, perm: personnel)
router.post('/import', authMiddleware, requireAdminPerm('personnel'), validate(bulkImportSchema), async (req, res) => {
  try {
    const { members } = req.validated;

    // Validate email domain against allowed domain setting
    const domainSetting = await prisma.systemSetting.findUnique({ where: { key: 'allowedEmailDomain' } });
    const allowedDomain = domainSetting?.value;

    if (allowedDomain) {
      const invalidEmails = members.filter(m => {
        const domain = m.email.toLowerCase().split('@')[1];
        return domain !== allowedDomain.toLowerCase();
      });
      if (invalidEmails.length > 0) {
        return res.status(400).json({
          error: `Some emails don't match the allowed domain @${allowedDomain}`,
          invalidEmails: invalidEmails.map(m => m.email),
        });
      }
    }

    // Check for duplicate emails in the request
    const emails = members.map(m => m.email.toLowerCase());
    const uniqueEmails = new Set(emails);
    if (uniqueEmails.size !== emails.length) {
      return res.status(400).json({ error: 'Duplicate emails in import list' });
    }

    // Check for existing emails in database
    const existingUsers = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    });
    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: 'Some emails already exist',
        existingEmails: existingUsers.map(u => u.email),
      });
    }

    // Create all users with default password
    const defaultPin = await bcrypt.hash('password', SALT_ROUNDS);
    const created = [];

    for (const member of members) {
      const user = await prisma.user.create({
        data: {
          name: member.name,
          email: member.email.toLowerCase(),
          title: member.title || '',
          role: member.role || 'user',
          deptId: member.deptId || null,
          pin: defaultPin,
          mustChangePassword: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          role: true,
          deptId: true,
          createdAt: true,
          department: { select: { id: true, name: true, color: true } },
        },
      });
      created.push(user);
    }

    await auditLog('personnel_bulk_import', 'user', null, req.user.id, {
      count: created.length,
      emails: emails,
    });

    return res.status(201).json({
      message: `${created.length} team member(s) imported successfully`,
      users: created,
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
