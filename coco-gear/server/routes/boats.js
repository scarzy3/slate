import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate, boatSchema, boatUpdateSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

// GET / - list all boats
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const boats = await prisma.boat.findMany({
      where,
      include: {
        trips: {
          include: {
            trip: { select: { id: true, name: true, status: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(boats);
  } catch (err) {
    console.error('List boats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create boat (manager+)
router.post('/', requireRole('manager'), validate(boatSchema), async (req, res) => {
  try {
    const { name, type, hullId, length, homePort, status: boatStatus, notes } = req.validated;

    const boat = await prisma.boat.create({
      data: { name, type, hullId, length, homePort, status: boatStatus, notes },
    });

    await auditLog('boat_create', 'boat', boat.id, req.user.id, { name });
    return res.status(201).json(boat);
  } catch (err) {
    console.error('Create boat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update boat (manager+)
router.put('/:id', requireRole('manager'), validate(boatUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.boat.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Boat not found' });

    const boat = await prisma.boat.update({
      where: { id },
      data: req.validated,
    });

    await auditLog('boat_update', 'boat', id, req.user.id, { name: boat.name });
    return res.json(boat);
  } catch (err) {
    console.error('Update boat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete boat (manager+)
router.delete('/:id', requireRole('manager'), async (req, res) => {
  try {
    const { id } = req.params;
    const boat = await prisma.boat.findUnique({ where: { id } });
    if (!boat) return res.status(404).json({ error: 'Boat not found' });

    await prisma.boat.delete({ where: { id } });
    await auditLog('boat_delete', 'boat', id, req.user.id, { name: boat.name });
    return res.json({ message: 'Boat deleted' });
  } catch (err) {
    console.error('Delete boat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
