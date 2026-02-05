import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, locationSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all locations with kit count
router.get('/', authMiddleware, async (req, res) => {
  try {
    const locations = await prisma.location.findMany({
      include: {
        _count: { select: { kits: true, assets: true } },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(locations);
  } catch (err) {
    console.error('List locations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create location (admin+, perm: locations)
router.post('/', authMiddleware, requireAdminPerm('locations'), validate(locationSchema), async (req, res) => {
  try {
    const data = req.validated;

    const location = await prisma.location.create({ data });

    await auditLog('location_create', 'location', location.id, req.user.id, { name: data.name });

    return res.status(201).json(location);
  } catch (err) {
    console.error('Create location error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update location (admin+, perm: locations)
router.put('/:id', authMiddleware, requireAdminPerm('locations'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortCode } = req.body;

    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (shortCode !== undefined) data.shortCode = shortCode;

    const location = await prisma.location.update({ where: { id }, data });

    await auditLog('location_update', 'location', id, req.user.id, { name: location.name });

    return res.json(location);
  } catch (err) {
    console.error('Update location error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete if no kits there (admin+, perm: locations)
router.delete('/:id', authMiddleware, requireAdminPerm('locations'), async (req, res) => {
  try {
    const { id } = req.params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: { _count: { select: { kits: true } } },
    });

    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    if (location._count.kits > 0) {
      return res.status(409).json({ error: 'Cannot delete location with existing kits' });
    }

    await prisma.location.delete({ where: { id } });

    await auditLog('location_delete', 'location', id, req.user.id, { name: location.name });

    return res.json({ message: 'Location deleted' });
  } catch (err) {
    console.error('Delete location error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
