import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate, tripSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

// GET / - list all trips with kit counts
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const trips = await prisma.trip.findMany({
      where,
      include: {
        kits: {
          select: {
            id: true,
            color: true,
            typeId: true,
            deptId: true,
            issuedToId: true,
            type: { select: { id: true, name: true } },
          },
        },
        _count: { select: { reservations: true } },
      },
      orderBy: { startDate: 'desc' },
    });
    return res.json(trips);
  } catch (err) {
    console.error('List trips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single trip
router.get('/:id', async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: {
        kits: {
          select: {
            id: true,
            color: true,
            typeId: true,
            deptId: true,
            issuedToId: true,
            type: { select: { id: true, name: true } },
            department: { select: { id: true, name: true, color: true } },
            issuedTo: { select: { id: true, name: true } },
          },
        },
        reservations: {
          include: {
            kit: { select: { id: true, color: true, type: { select: { name: true } } } },
            person: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    return res.json(trip);
  } catch (err) {
    console.error('Get trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create trip (admin+)
router.post('/', requireRole('admin'), validate(tripSchema), async (req, res) => {
  try {
    const { name, description, startDate, endDate, status: tripStatus } = req.validated;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const trip = await prisma.trip.create({
      data: {
        name,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: tripStatus || 'planning',
      },
    });

    await auditLog('trip_create', 'trip', trip.id, req.user.id, { name });
    return res.status(201).json(trip);
  } catch (err) {
    console.error('Create trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update trip (admin+)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, startDate, endDate, status: tripStatus } = req.body;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Trip not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (tripStatus !== undefined) data.status = tripStatus;

    // If completing/cancelling a trip, unassign all kits
    if (tripStatus === 'completed' || tripStatus === 'cancelled') {
      await prisma.kit.updateMany({
        where: { tripId: id },
        data: { tripId: null },
      });
    }

    const trip = await prisma.trip.update({
      where: { id },
      data,
      include: {
        kits: {
          select: {
            id: true, color: true, typeId: true,
            type: { select: { id: true, name: true } },
          },
        },
        _count: { select: { reservations: true } },
      },
    });

    await auditLog('trip_update', 'trip', id, req.user.id, { name: trip.name, status: trip.status });
    return res.json(trip);
  } catch (err) {
    console.error('Update trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete trip (admin+)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Unassign kits first
    await prisma.kit.updateMany({
      where: { tripId: id },
      data: { tripId: null },
    });

    await prisma.trip.delete({ where: { id } });
    await auditLog('trip_delete', 'trip', id, req.user.id, { name: trip.name });
    return res.json({ message: 'Trip deleted' });
  } catch (err) {
    console.error('Delete trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/kits - assign kits to trip
router.post('/:id/kits', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { kitIds } = req.body;

    if (!Array.isArray(kitIds) || !kitIds.length) {
      return res.status(400).json({ error: 'kitIds array required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot assign kits to a ' + trip.status + ' trip' });
    }

    await prisma.kit.updateMany({
      where: { id: { in: kitIds } },
      data: { tripId: id },
    });

    const updated = await prisma.trip.findUnique({
      where: { id },
      include: {
        kits: {
          select: {
            id: true, color: true, typeId: true,
            type: { select: { id: true, name: true } },
          },
        },
        _count: { select: { reservations: true } },
      },
    });

    await auditLog('trip_assign_kits', 'trip', id, req.user.id, { kitCount: kitIds.length });
    return res.json(updated);
  } catch (err) {
    console.error('Assign kits to trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/kits/:kitId - remove kit from trip
router.delete('/:id/kits/:kitId', requireRole('admin'), async (req, res) => {
  try {
    const { id, kitId } = req.params;

    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit || kit.tripId !== id) {
      return res.status(404).json({ error: 'Kit not assigned to this trip' });
    }

    await prisma.kit.update({
      where: { id: kitId },
      data: { tripId: null },
    });

    await auditLog('trip_remove_kit', 'trip', id, req.user.id, { kitId });
    return res.json({ message: 'Kit removed from trip' });
  } catch (err) {
    console.error('Remove kit from trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
