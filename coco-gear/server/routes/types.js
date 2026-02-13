import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, kitTypeSchema, kitTypeUpdateSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all kit types with components and fields
router.get('/', authMiddleware, async (req, res) => {
  try {
    const types = await prisma.kitType.findMany({
      include: {
        components: { include: { component: true } },
        fields: true,
        departments: { include: { department: { select: { id: true, name: true, color: true } } } },
        _count: { select: { kits: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(types);
  } catch (err) {
    console.error('List kit types error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single kit type
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const type = await prisma.kitType.findUnique({
      where: { id: req.params.id },
      include: {
        components: { include: { component: true } },
        fields: true,
        departments: { include: { department: { select: { id: true, name: true, color: true } } } },
        _count: { select: { kits: true } },
      },
    });
    if (!type) {
      return res.status(404).json({ error: 'Kit type not found' });
    }
    return res.json(type);
  } catch (err) {
    console.error('Get kit type error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create kit type (admin+, perm: types)
router.post('/', authMiddleware, requireAdminPerm('types'), validate(kitTypeSchema), async (req, res) => {
  try {
    const { name, desc, components, fields, deptIds } = req.validated;

    const type = await prisma.kitType.create({
      data: {
        name,
        desc,
        components: {
          create: components.map(c => ({
            componentId: c.componentId,
            quantity: c.quantity,
            critical: c.critical ?? false,
          })),
        },
        fields: {
          create: fields.map(f => ({
            key: f.key,
            label: f.label,
            type: f.type,
          })),
        },
        departments: deptIds?.length ? {
          create: deptIds.map(deptId => ({ deptId })),
        } : undefined,
      },
      include: {
        components: { include: { component: true } },
        fields: true,
        departments: { include: { department: { select: { id: true, name: true, color: true } } } },
      },
    });

    await auditLog('type_create', 'kitType', type.id, req.user.id, { name });

    return res.status(201).json(type);
  } catch (err) {
    console.error('Create kit type error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update kit type (admin+, perm: types)
router.put('/:id', authMiddleware, requireAdminPerm('types'), validate(kitTypeUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, components, fields, deptIds } = req.validated;

    const existing = await prisma.kitType.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Kit type not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (desc !== undefined) data.desc = desc;

    const type = await prisma.$transaction(async (tx) => {
      // Update basic fields
      const updated = await tx.kitType.update({ where: { id }, data });

      // Replace components if provided
      if (components !== undefined) {
        await tx.kitTypeComponent.deleteMany({ where: { kitTypeId: id } });
        if (components.length > 0) {
          await tx.kitTypeComponent.createMany({
            data: components.map(c => ({
              kitTypeId: id,
              componentId: c.componentId,
              quantity: c.quantity || 1,
              critical: c.critical ?? false,
            })),
          });
        }
      }

      // Replace fields if provided
      if (fields !== undefined) {
        await tx.kitTypeField.deleteMany({ where: { kitTypeId: id } });
        if (fields.length > 0) {
          await tx.kitTypeField.createMany({
            data: fields.map(f => ({
              kitTypeId: id,
              key: f.key,
              label: f.label,
              type: f.type || 'text',
            })),
          });
        }
      }

      // Replace department associations if provided
      if (deptIds !== undefined) {
        await tx.kitTypeDepartment.deleteMany({ where: { kitTypeId: id } });
        if (deptIds.length > 0) {
          await tx.kitTypeDepartment.createMany({
            data: deptIds.map(deptId => ({ kitTypeId: id, deptId })),
          });
        }
      }

      return tx.kitType.findUnique({
        where: { id },
        include: {
          components: { include: { component: true } },
          fields: true,
          departments: { include: { department: { select: { id: true, name: true, color: true } } } },
        },
      });
    });

    await auditLog('type_update', 'kitType', id, req.user.id, { name: type.name });

    return res.json(type);
  } catch (err) {
    console.error('Update kit type error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete if no kits use it (admin+, perm: types)
router.delete('/:id', authMiddleware, requireAdminPerm('types'), async (req, res) => {
  try {
    const { id } = req.params;

    const type = await prisma.kitType.findUnique({
      where: { id },
      include: { _count: { select: { kits: true } } },
    });

    if (!type) {
      return res.status(404).json({ error: 'Kit type not found' });
    }

    if (type._count.kits > 0) {
      return res.status(409).json({ error: 'Cannot delete kit type with existing kits' });
    }

    await prisma.kitType.delete({ where: { id } });

    await auditLog('type_delete', 'kitType', id, req.user.id, { name: type.name });

    return res.json({ message: 'Kit type deleted' });
  } catch (err) {
    console.error('Delete kit type error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
