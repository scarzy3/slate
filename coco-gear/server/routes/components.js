import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, componentSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all components
router.get('/', authMiddleware, async (req, res) => {
  try {
    const components = await prisma.component.findMany({
      include: {
        _count: { select: { kitTypeComponents: true } },
      },
      orderBy: { label: 'asc' },
    });
    return res.json(components);
  } catch (err) {
    console.error('List components error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create component (admin+, perm: components)
router.post('/', authMiddleware, requireAdminPerm('components'), validate(componentSchema), async (req, res) => {
  try {
    const data = req.validated;

    const existing = await prisma.component.findUnique({ where: { key: data.key } });
    if (existing) {
      return res.status(409).json({ error: 'Component with this key already exists' });
    }

    const component = await prisma.component.create({ data });

    await auditLog('component_create', 'component', component.id, req.user.id, { key: data.key });

    return res.status(201).json(component);
  } catch (err) {
    console.error('Create component error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update component (admin+, perm: components)
router.put('/:id', authMiddleware, requireAdminPerm('components'), async (req, res) => {
  try {
    const { id } = req.params;
    const { key, label, category, serialized, calibrationRequired, calibrationIntervalDays } = req.body;

    const existing = await prisma.component.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Component not found' });
    }

    // If changing key, check for uniqueness
    if (key !== undefined && key !== existing.key) {
      const conflict = await prisma.component.findUnique({ where: { key } });
      if (conflict) {
        return res.status(409).json({ error: 'Component with this key already exists' });
      }
    }

    const data = {};
    if (key !== undefined) data.key = key;
    if (label !== undefined) data.label = label;
    if (category !== undefined) data.category = category;
    if (serialized !== undefined) data.serialized = serialized;
    if (calibrationRequired !== undefined) data.calibrationRequired = calibrationRequired;
    if (calibrationIntervalDays !== undefined) data.calibrationIntervalDays = calibrationIntervalDays;

    const component = await prisma.component.update({ where: { id }, data });

    await auditLog('component_update', 'component', id, req.user.id, { key: component.key });

    return res.json(component);
  } catch (err) {
    console.error('Update component error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete if not used in any kit type (admin+, perm: components)
router.delete('/:id', authMiddleware, requireAdminPerm('components'), async (req, res) => {
  try {
    const { id } = req.params;

    const component = await prisma.component.findUnique({
      where: { id },
      include: { _count: { select: { kitTypeComponents: true } } },
    });

    if (!component) {
      return res.status(404).json({ error: 'Component not found' });
    }

    if (component._count.kitTypeComponents > 0) {
      return res.status(409).json({ error: 'Cannot delete component used in kit types' });
    }

    await prisma.component.delete({ where: { id } });

    await auditLog('component_delete', 'component', id, req.user.id, { key: component.key });

    return res.json({ message: 'Component deleted' });
  } catch (err) {
    console.error('Delete component error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
