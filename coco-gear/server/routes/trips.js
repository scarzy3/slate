import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/rbac.js';
import { validate, tripSchema, tripPersonnelSchema, tripNoteSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

const tripIncludes = {
  lead: { select: { id: true, name: true, title: true } },
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
  boats: {
    include: {
      boat: true,
    },
  },
  personnel: {
    include: {
      user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  notes: {
    include: {
      author: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
  tasks: {
    select: {
      id: true,
      title: true,
      phase: true,
      priority: true,
      status: true,
      sortOrder: true,
      dueDate: true,
      completedAt: true,
      assignedTo: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  _count: { select: { reservations: true, personnel: true, boats: true, tasks: true } },
};

// GET / - list all trips with kit counts
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const where = {};
    if (status) where.status = status;

    const trips = await prisma.trip.findMany({
      where,
      include: tripIncludes,
      orderBy: { startDate: 'desc' },
    });
    return res.json(trips);
  } catch (err) {
    console.error('List trips error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single trip with full details
router.get('/:id', async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: {
        ...tripIncludes,
        tasks: {
          select: {
            id: true,
            title: true,
            description: true,
            assignedToId: true,
            phase: true,
            priority: true,
            status: true,
            dueDate: true,
            completedAt: true,
            completedById: true,
            sortOrder: true,
            createdAt: true,
            assignedTo: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
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
router.post('/', requirePerm('trips'), validate(tripSchema), async (req, res) => {
  try {
    const { name, description, location, objectives, leadId, startDate, endDate, status: tripStatus } = req.validated;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const trip = await prisma.trip.create({
      data: {
        name,
        description,
        location,
        objectives,
        leadId: leadId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: tripStatus || 'planning',
      },
      include: tripIncludes,
    });

    // If lead assigned, also add them as personnel
    if (leadId) {
      try {
        await prisma.tripPersonnel.create({
          data: { tripId: trip.id, userId: leadId, role: 'lead' },
        });
      } catch { /* already exists */ }
    }

    await auditLog('trip_create', 'trip', trip.id, req.user.id, { name });
    return res.status(201).json(trip);
  } catch (err) {
    console.error('Create trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update trip (admin+)
router.put('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, location, objectives, leadId, startDate, endDate, status: tripStatus } = req.body;

    const existing = await prisma.trip.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Trip not found' });

    const data = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (location !== undefined) data.location = location;
    if (objectives !== undefined) data.objectives = objectives;
    if (leadId !== undefined) data.leadId = leadId || null;
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
      include: tripIncludes,
    });

    await auditLog('trip_update', 'trip', id, req.user.id, { name: trip.name, status: trip.status });
    return res.json(trip);
  } catch (err) {
    console.error('Update trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete trip (admin+)
router.delete('/:id', requirePerm('trips'), async (req, res) => {
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

// ─── Kit Assignment ───

// POST /:id/kits - assign kits to trip
router.post('/:id/kits', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { kitIds, autoReserve } = req.body;

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

    // Auto-create reservations for the trip date range
    if (autoReserve) {
      for (const kitId of kitIds) {
        try {
          await prisma.reservation.create({
            data: {
              kitId,
              personId: req.user.id,
              tripId: id,
              startDate: trip.startDate,
              endDate: trip.endDate,
              purpose: `Auto-reserved for trip: ${trip.name}`,
              status: 'confirmed',
            },
          });
        } catch { /* skip if reservation already exists or conflicts */ }
      }
    }

    const updated = await prisma.trip.findUnique({
      where: { id },
      include: tripIncludes,
    });

    await auditLog('trip_assign_kits', 'trip', id, req.user.id, { kitCount: kitIds.length, autoReserve: !!autoReserve });
    return res.json(updated);
  } catch (err) {
    console.error('Assign kits to trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/kits/:kitId - remove kit from trip
router.delete('/:id/kits/:kitId', requirePerm('trips'), async (req, res) => {
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

// ─── Personnel Assignment ───

// POST /:id/personnel - add person to trip
router.post('/:id/personnel', requirePerm('trips'), validate(tripPersonnelSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, notes } = req.validated;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const entry = await prisma.tripPersonnel.create({
      data: { tripId: id, userId, role, notes },
      include: {
        user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
      },
    });

    await auditLog('trip_add_personnel', 'trip', id, req.user.id, { userId, role, userName: user.name });
    return res.status(201).json(entry);
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Person already assigned to this trip' });
    }
    console.error('Add trip personnel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/personnel/:personnelId - update person's trip role
router.put('/:id/personnel/:personnelId', requirePerm('trips'), async (req, res) => {
  try {
    const { personnelId } = req.params;
    const { role, notes } = req.body;

    const data = {};
    if (role !== undefined) data.role = role;
    if (notes !== undefined) data.notes = notes;

    const entry = await prisma.tripPersonnel.update({
      where: { id: personnelId },
      data,
      include: {
        user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
      },
    });

    return res.json(entry);
  } catch (err) {
    console.error('Update trip personnel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/personnel/:personnelId - remove person from trip
router.delete('/:id/personnel/:personnelId', requirePerm('trips'), async (req, res) => {
  try {
    const { id, personnelId } = req.params;

    await prisma.tripPersonnel.delete({ where: { id: personnelId } });
    await auditLog('trip_remove_personnel', 'trip', id, req.user.id, { personnelId });
    return res.json({ message: 'Person removed from trip' });
  } catch (err) {
    console.error('Remove trip personnel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/personnel/bulk - add multiple people at once
router.post('/:id/personnel/bulk', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { userIds, role = 'specialist' } = req.body;

    if (!Array.isArray(userIds) || !userIds.length) {
      return res.status(400).json({ error: 'userIds array required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const results = [];
    for (const userId of userIds) {
      try {
        const entry = await prisma.tripPersonnel.create({
          data: { tripId: id, userId, role },
          include: {
            user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
          },
        });
        results.push(entry);
      } catch { /* skip duplicates */ }
    }

    await auditLog('trip_add_personnel_bulk', 'trip', id, req.user.id, { count: results.length });
    return res.json({ added: results.length, personnel: results });
  } catch (err) {
    console.error('Bulk add trip personnel error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Trip Notes ───

// POST /:id/notes - add a note
router.post('/:id/notes', validate(tripNoteSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { content, category } = req.validated;

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const note = await prisma.tripNote.create({
      data: { tripId: id, authorId: req.user.id, content, category },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return res.status(201).json(note);
  } catch (err) {
    console.error('Add trip note error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/notes/:noteId - delete a note (author or admin)
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const { noteId } = req.params;

    const note = await prisma.tripNote.findUnique({ where: { id: noteId } });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    // Only author or admin can delete
    if (note.authorId !== req.user.id && !['developer','director','super','engineer','manager','admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized to delete this note' });
    }

    await prisma.tripNote.delete({ where: { id: noteId } });
    return res.json({ message: 'Note deleted' });
  } catch (err) {
    console.error('Delete trip note error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Boat Assignment ───

// POST /:id/boats - assign boats to trip
router.post('/:id/boats', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { boatIds, role = 'primary', autoReserve } = req.body;

    if (!Array.isArray(boatIds) || !boatIds.length) {
      return res.status(400).json({ error: 'boatIds array required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot assign boats to a ' + trip.status + ' trip' });
    }

    const results = [];
    for (const boatId of boatIds) {
      try {
        const entry = await prisma.tripBoat.create({
          data: { tripId: id, boatId, role },
          include: { boat: true },
        });
        results.push(entry);
      } catch { /* skip duplicates */ }
    }

    await auditLog('trip_assign_boats', 'trip', id, req.user.id, { count: results.length, autoReserve: !!autoReserve });
    return res.json({ added: results.length, boats: results });
  } catch (err) {
    console.error('Assign boats to trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/boats/:tripBoatId - update boat role on trip
router.put('/:id/boats/:tripBoatId', requirePerm('trips'), async (req, res) => {
  try {
    const { tripBoatId } = req.params;
    const { role, notes } = req.body;

    const data = {};
    if (role !== undefined) data.role = role;
    if (notes !== undefined) data.notes = notes;

    const entry = await prisma.tripBoat.update({
      where: { id: tripBoatId },
      data,
      include: { boat: true },
    });

    return res.json(entry);
  } catch (err) {
    console.error('Update trip boat error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id/boats/:tripBoatId - remove boat from trip
router.delete('/:id/boats/:tripBoatId', requirePerm('trips'), async (req, res) => {
  try {
    const { id, tripBoatId } = req.params;

    await prisma.tripBoat.delete({ where: { id: tripBoatId } });
    await auditLog('trip_remove_boat', 'trip', id, req.user.id, { tripBoatId });
    return res.json({ message: 'Boat removed from trip' });
  } catch (err) {
    console.error('Remove boat from trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Trip Manifest ───

// GET /:id/manifest - get a full manifest of the trip
router.get('/:id/manifest', async (req, res) => {
  try {
    const trip = await prisma.trip.findUnique({
      where: { id: req.params.id },
      include: {
        lead: { select: { id: true, name: true, title: true } },
        personnel: {
          include: {
            user: {
              select: {
                id: true, name: true, title: true, role: true, deptId: true,
                department: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        kits: {
          include: {
            type: { select: { id: true, name: true } },
            location: { select: { id: true, name: true, shortCode: true } },
            department: { select: { id: true, name: true, color: true } },
            issuedTo: { select: { id: true, name: true } },
            componentStatuses: {
              include: { component: { select: { id: true, key: true, label: true, category: true } } },
            },
            serials: {
              include: { component: { select: { id: true, key: true, label: true } } },
            },
          },
        },
        boats: {
          include: { boat: true },
        },
        reservations: {
          include: {
            kit: { select: { id: true, color: true, type: { select: { name: true } } } },
            person: { select: { id: true, name: true } },
          },
        },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });
    return res.json(trip);
  } catch (err) {
    console.error('Get trip manifest error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
