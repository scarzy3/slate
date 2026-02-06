import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, departmentSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all departments with member count and kit count
router.get('/', authMiddleware, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, name: true, title: true } },
        kitTypes: { include: { kitType: { select: { id: true, name: true } } } },
        _count: { select: { members: true, kits: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(departments);
  } catch (err) {
    console.error('List departments error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create department (admin+, perm: departments)
router.post('/', authMiddleware, requireAdminPerm('departments'), validate(departmentSchema), async (req, res) => {
  try {
    const data = req.validated;

    const department = await prisma.department.create({
      data,
      include: {
        head: { select: { id: true, name: true, title: true } },
        _count: { select: { members: true, kits: true } },
      },
    });

    await auditLog('department_create', 'department', department.id, req.user.id, { name: data.name });

    return res.status(201).json(department);
  } catch (err) {
    console.error('Create department error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update department (admin+, perm: departments)
router.put('/:id', authMiddleware, requireAdminPerm('departments'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, site, headId } = req.body;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (color !== undefined) data.color = color;
    if (site !== undefined) data.site = site;
    if (headId !== undefined) data.headId = headId;

    const department = await prisma.department.update({
      where: { id },
      data,
      include: {
        head: { select: { id: true, name: true, title: true } },
        _count: { select: { members: true, kits: true } },
      },
    });

    await auditLog('department_update', 'department', id, req.user.id, { name: department.name });

    return res.json(department);
  } catch (err) {
    console.error('Update department error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete if no kits assigned (admin+, perm: departments)
router.delete('/:id', authMiddleware, requireAdminPerm('departments'), async (req, res) => {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { kits: true } } },
    });

    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }

    if (department._count.kits > 0) {
      return res.status(409).json({ error: 'Cannot delete department with assigned kits' });
    }

    await prisma.department.delete({ where: { id } });

    await auditLog('department_delete', 'department', id, req.user.id, { name: department.name });

    return res.json({ message: 'Department deleted' });
  } catch (err) {
    console.error('Delete department error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
