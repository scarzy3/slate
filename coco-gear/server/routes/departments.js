import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, departmentSchema, departmentUpdateSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

const DEPT_INCLUDE = {
  managers: { include: { user: { select: { id: true, name: true, title: true, role: true } } } },
  leads: { include: { user: { select: { id: true, name: true, title: true, role: true } } } },
  kitTypes: { include: { kitType: { select: { id: true, name: true } } } },
  _count: { select: { members: true, kits: true } },
};

// Minimum role levels for auto-promotion
const ROLE_LEVEL = { user: 1, lead: 2, manager: 3, admin: 3, director: 4, super: 4, engineer: 4, developer: 5 };

/**
 * Auto-promote users when assigned as department managers or leads.
 * Managers get promoted to at least 'manager' role; leads to at least 'lead' role.
 */
async function autoPromoteUsers(managerIds, leadIds, tx) {
  const db = tx || prisma;
  // Promote managers: any user below 'manager' level gets promoted
  for (const userId of managerIds) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (user && (ROLE_LEVEL[user.role] || 0) < ROLE_LEVEL.manager) {
      await db.user.update({ where: { id: userId }, data: { role: 'manager' } });
    }
  }
  // Promote leads: any user below 'lead' level gets promoted
  for (const userId of leadIds) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
    if (user && (ROLE_LEVEL[user.role] || 0) < ROLE_LEVEL.lead) {
      await db.user.update({ where: { id: userId }, data: { role: 'lead' } });
    }
  }
}

// GET / - list all departments with managers, leads, member count and kit count
router.get('/', authMiddleware, async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: DEPT_INCLUDE,
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
    const { name, color, site, managerIds, leadIds } = req.validated;

    const department = await prisma.$transaction(async (tx) => {
      const dept = await tx.department.create({
        data: {
          name,
          color,
          site,
          managers: { create: managerIds.map(userId => ({ userId })) },
          leads: { create: leadIds.map(userId => ({ userId })) },
        },
        include: DEPT_INCLUDE,
      });

      await autoPromoteUsers(managerIds, leadIds, tx);

      return dept;
    });

    await auditLog('department_create', 'department', department.id, req.user.id, { name });

    return res.status(201).json(department);
  } catch (err) {
    console.error('Create department error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update department (admin+, perm: departments)
router.put('/:id', authMiddleware, requireAdminPerm('departments'), validate(departmentUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, site, managerIds, leadIds } = req.validated;

    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Department not found' });
    }

    const department = await prisma.$transaction(async (tx) => {
      const data = {};
      if (name !== undefined) data.name = name;
      if (color !== undefined) data.color = color;
      if (site !== undefined) data.site = site;

      // Sync managers if provided
      if (managerIds !== undefined) {
        await tx.departmentManager.deleteMany({ where: { deptId: id } });
        if (managerIds.length > 0) {
          await tx.departmentManager.createMany({
            data: managerIds.map(userId => ({ deptId: id, userId })),
          });
        }
      }

      // Sync leads if provided
      if (leadIds !== undefined) {
        await tx.departmentLead.deleteMany({ where: { deptId: id } });
        if (leadIds.length > 0) {
          await tx.departmentLead.createMany({
            data: leadIds.map(userId => ({ deptId: id, userId })),
          });
        }
      }

      const dept = await tx.department.update({
        where: { id },
        data,
        include: DEPT_INCLUDE,
      });

      // Auto-promote new managers/leads
      if (managerIds !== undefined || leadIds !== undefined) {
        await autoPromoteUsers(managerIds || [], leadIds || [], tx);
      }

      return dept;
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
