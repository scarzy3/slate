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
  _count: { select: { reservations: true, personnel: true, boats: true, tasks: true, commsEntries: true } },
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

    // Compute lightweight conflict counts for planning/active trips
    const tripsWithConflicts = await Promise.all(trips.map(async (trip) => {
      if (trip.status !== 'planning' && trip.status !== 'active') {
        return { ...trip, conflictCount: 0 };
      }

      let conflictCount = 0;

      // Personnel conflicts: count personnel on overlapping trips
      for (const tp of trip.personnel) {
        const overlapping = await prisma.tripPersonnel.count({
          where: {
            userId: tp.userId,
            tripId: { not: trip.id },
            trip: {
              status: { in: ['planning', 'active'] },
              startDate: { lt: trip.endDate },
              endDate: { gt: trip.startDate },
            },
          },
        });
        conflictCount += overlapping;
      }

      // Equipment conflicts: count kits assigned to overlapping trips or with overlapping reservations
      for (const kit of trip.kits) {
        const kitOnOtherTrip = await prisma.kit.count({
          where: {
            id: kit.id,
            tripId: { not: null },
            trip: {
              id: { not: trip.id },
              status: { in: ['planning', 'active'] },
              startDate: { lt: trip.endDate },
              endDate: { gt: trip.startDate },
            },
          },
        });
        conflictCount += kitOnOtherTrip;

        const overlappingRes = await prisma.reservation.count({
          where: {
            kitId: kit.id,
            status: { in: ['pending', 'confirmed'] },
            startDate: { lt: trip.endDate },
            endDate: { gt: trip.startDate },
            OR: [
              { tripId: null },
              { tripId: { not: trip.id } },
            ],
          },
        });
        conflictCount += overlappingRes;
      }

      return { ...trip, conflictCount };
    }));

    return res.json(tripsWithConflicts);
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

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' });
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

// ─── Clone Trip ───

// POST /:id/clone - clone an existing trip
router.post('/:id/clone', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, location } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' });
    }

    // Load source trip with all relations
    const source = await prisma.trip.findUnique({
      where: { id },
      include: {
        personnel: true,
        tasks: true,
        commsEntries: true,
        packingItems: true,
      },
    });
    if (!source) return res.status(404).json({ error: 'Trip not found' });

    // Create new trip
    const newTrip = await prisma.trip.create({
      data: {
        name: name || `${source.name} (Copy)`,
        description: source.description,
        location: location !== undefined ? location : source.location,
        objectives: source.objectives,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'planning',
      },
    });

    // Clone personnel — skip users that no longer exist
    const clonedUserIds = new Set();
    for (const p of source.personnel) {
      try {
        const userExists = await prisma.user.findUnique({ where: { id: p.userId }, select: { id: true } });
        if (!userExists) continue;
        await prisma.tripPersonnel.create({
          data: { tripId: newTrip.id, userId: p.userId, role: p.role, notes: p.notes },
        });
        clonedUserIds.add(p.userId);
      } catch { /* skip duplicates or missing users */ }
    }

    // Clone tasks — reset status, preserve assignee if in cloned personnel
    for (const t of source.tasks) {
      await prisma.tripTask.create({
        data: {
          tripId: newTrip.id,
          title: t.title,
          description: t.description,
          assignedToId: t.assignedToId && clonedUserIds.has(t.assignedToId) ? t.assignedToId : null,
          phase: t.phase,
          priority: t.priority,
          status: 'todo',
          dueDate: null,
          sortOrder: t.sortOrder,
        },
      });
    }

    // Clone comms entries — preserve assignee if in cloned personnel
    for (const c of source.commsEntries) {
      await prisma.tripCommsEntry.create({
        data: {
          tripId: newTrip.id,
          type: c.type,
          label: c.label,
          value: c.value,
          assignedToId: c.assignedToId && clonedUserIds.has(c.assignedToId) ? c.assignedToId : null,
          notes: c.notes,
          sortOrder: c.sortOrder,
        },
      });
    }

    // Clone packing items
    for (const item of source.packingItems) {
      await prisma.tripPackingItem.create({
        data: {
          tripId: newTrip.id,
          tier: item.tier,
          scope: item.scope,
          category: item.category,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
          required: item.required,
          sortOrder: item.sortOrder,
        },
      });
    }

    // Return new trip with full includes
    const result = await prisma.trip.findUnique({
      where: { id: newTrip.id },
      include: tripIncludes,
    });

    await auditLog('trip_clone', 'trip', newTrip.id, req.user.id, {
      sourceId: id, sourceName: source.name, name: result.name,
      personnel: source.personnel.length, tasks: source.tasks.length,
      comms: source.commsEntries.length, packingItems: source.packingItems.length,
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('Clone trip error:', err);
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

    // Deduplicate kit IDs and filter out kits already assigned to this trip
    const uniqueKitIds = [...new Set(kitIds)];
    const alreadyAssigned = await prisma.kit.findMany({
      where: { id: { in: uniqueKitIds }, tripId: id },
      select: { id: true },
    });
    const alreadyAssignedIds = new Set(alreadyAssigned.map(k => k.id));
    const newKitIds = uniqueKitIds.filter(kid => !alreadyAssignedIds.has(kid));

    if (newKitIds.length > 0) {
      await prisma.kit.updateMany({
        where: { id: { in: newKitIds } },
        data: { tripId: id },
      });
    }

    // Auto-create reservations for the trip date range (only for newly assigned kits)
    if (autoReserve && newKitIds.length > 0) {
      // Check if a manager or director is on the trip — if not, reservations need approval
      const tripPersonnel = await prisma.tripPersonnel.findMany({
        where: { tripId: id },
        include: { user: { select: { role: true } } },
      });
      const seniorRoles = ['director', 'manager', 'developer', 'engineer', 'super'];
      const hasSeniorOnTrip = tripPersonnel.some(tp =>
        seniorRoles.includes(tp.role) || seniorRoles.includes(tp.user?.role)
      );
      const reservationStatus = hasSeniorOnTrip ? 'confirmed' : 'pending';

      for (const kitId of newKitIds) {
        // Check for existing reservation to avoid duplicates
        const existing = await prisma.reservation.count({
          where: { kitId, tripId: id, status: { in: ['confirmed', 'pending'] } },
        });
        if (existing > 0) continue;
        try {
          await prisma.reservation.create({
            data: {
              kitId,
              personId: req.user.id,
              tripId: id,
              startDate: trip.startDate,
              endDate: trip.endDate,
              purpose: hasSeniorOnTrip
                ? `Auto-reserved for trip: ${trip.name}`
                : `Pending approval — auto-reserved for trip: ${trip.name}`,
              status: reservationStatus,
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
        commsEntries: {
          include: { assignedTo: { select: { id: true, name: true, title: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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

// ─── After-Action Report ───

// GET /:id/aar - compile comprehensive after-action report data
router.get('/:id/aar', async (req, res) => {
  try {
    const { id } = req.params;

    // Load trip with all direct relations
    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true, title: true } },
        personnel: {
          include: {
            user: {
              select: {
                id: true, name: true, title: true, role: true, deptId: true,
                department: { select: { id: true, name: true, color: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        boats: { include: { boat: true } },
        notes: {
          include: { author: { select: { id: true, name: true } } },
          orderBy: { createdAt: 'asc' },
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
          orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        commsEntries: {
          include: { assignedTo: { select: { id: true, name: true, title: true } } },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
        kits: {
          include: {
            type: { select: { id: true, name: true } },
            department: { select: { id: true, name: true, color: true } },
            componentStatuses: {
              include: { component: { select: { id: true, key: true, label: true, category: true } } },
            },
            serials: {
              include: { component: { select: { id: true, key: true, label: true } } },
            },
          },
        },
      },
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // For completed trips, kits are unassigned — find them via reservations
    let kitIds = trip.kits.map(k => k.id);
    if (kitIds.length === 0) {
      const tripReservations = await prisma.reservation.findMany({
        where: { tripId: id },
        select: { kitId: true },
      });
      kitIds = [...new Set(tripReservations.map(r => r.kitId))];
    }

    // Load kits if we found them through reservations
    let allKits = trip.kits;
    if (trip.kits.length === 0 && kitIds.length > 0) {
      allKits = await prisma.kit.findMany({
        where: { id: { in: kitIds } },
        include: {
          type: { select: { id: true, name: true } },
          department: { select: { id: true, name: true, color: true } },
          componentStatuses: {
            include: { component: { select: { id: true, key: true, label: true, category: true } } },
          },
          serials: {
            include: { component: { select: { id: true, key: true, label: true } } },
          },
        },
      });
    }

    // Define trip date window with 7-day buffer for activity queries
    const DAY_MS = 86400000;
    const bufferDays = 7;
    const windowStart = new Date(new Date(trip.startDate).getTime() - bufferDays * DAY_MS);
    const windowEnd = new Date(new Date(trip.endDate).getTime() + bufferDays * DAY_MS);

    // Query equipment issues, activity, and maintenance for trip kits
    let damageReport = [];
    let maintenanceEvents = [];
    let checkouts = [];
    let returns = [];
    let inspections = [];

    if (kitIds.length > 0) {
      // Component statuses that aren't GOOD
      const badStatuses = await prisma.kitComponentStatus.findMany({
        where: { kitId: { in: kitIds }, status: { not: 'GOOD' } },
        include: {
          kit: { select: { id: true, color: true, type: { select: { name: true } } } },
          component: { select: { id: true, label: true, category: true } },
        },
      });
      damageReport = badStatuses.map(cs => ({
        kitColor: cs.kit.color,
        kitType: cs.kit.type?.name || 'Unknown',
        componentLabel: cs.component?.label || 'Unknown',
        status: cs.status,
        discoveredDuring: 'inspection',
      }));

      // Maintenance events within trip window
      const maintRecords = await prisma.maintenanceHistory.findMany({
        where: {
          kitId: { in: kitIds },
          startDate: { gte: windowStart, lte: windowEnd },
        },
        include: {
          kit: { select: { id: true, color: true, type: { select: { name: true } } } },
          startedBy: { select: { name: true } },
          completedBy: { select: { name: true } },
        },
        orderBy: { startDate: 'asc' },
      });
      maintenanceEvents = maintRecords.map(m => ({
        kitColor: m.kit.color,
        kitType: m.kit.type?.name || 'Unknown',
        maintenanceType: m.type,
        reason: m.reason || '',
        startDate: m.startDate,
        endDate: m.endDate,
        startedBy: m.startedBy?.name || null,
        completedBy: m.completedBy?.name || null,
      }));

      // Issue history (checkouts/returns) within trip window
      const issueRecords = await prisma.issueHistory.findMany({
        where: {
          kitId: { in: kitIds },
          issuedDate: { gte: windowStart, lte: windowEnd },
        },
        include: {
          kit: { select: { id: true, color: true, type: { select: { name: true } } } },
          person: { select: { id: true, name: true } },
        },
        orderBy: { issuedDate: 'asc' },
      });
      for (const issue of issueRecords) {
        checkouts.push({
          kitColor: issue.kit.color,
          kitType: issue.kit.type?.name || 'Unknown',
          personName: issue.person?.name || 'Unknown',
          date: issue.issuedDate,
        });
        if (issue.returnedDate) {
          returns.push({
            kitColor: issue.kit.color,
            kitType: issue.kit.type?.name || 'Unknown',
            personName: issue.person?.name || 'Unknown',
            date: issue.returnedDate,
            notes: issue.returnNotes || '',
          });
        }
      }

      // Inspections within trip window
      const inspRecords = await prisma.inspection.findMany({
        where: {
          kitId: { in: kitIds },
          date: { gte: windowStart, lte: windowEnd },
        },
        include: {
          kit: { select: { id: true, color: true, type: { select: { name: true } } } },
          results: {
            include: { component: { select: { id: true, label: true, category: true } } },
          },
        },
        orderBy: { date: 'asc' },
      });
      inspections = inspRecords.map(insp => ({
        kitColor: insp.kit.color,
        kitType: insp.kit.type?.name || 'Unknown',
        inspector: insp.inspector || 'Unknown',
        date: insp.date,
        issuesFound: insp.results.filter(r => r.status !== 'GOOD').length,
        issues: insp.results.filter(r => r.status !== 'GOOD').map(r => ({
          componentLabel: r.component?.label || 'Unknown',
          status: r.status,
        })),
      }));
    }

    // Compute duration
    const durationMs = new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime();
    const durationDays = Math.max(1, Math.ceil(durationMs / DAY_MS));

    // Build personnel by role
    const roleNames = {
      director: 'Director', manager: 'Manager', 'senior-spec': 'Senior Specialist',
      specialist: 'Specialist', engineer: 'Engineer', lead: 'Lead', other: 'Other',
    };
    const personnelByRole = {};
    for (const p of trip.personnel) {
      const role = p.role || 'other';
      if (!personnelByRole[role]) personnelByRole[role] = [];
      personnelByRole[role].push({
        name: p.user?.name || 'Unknown',
        title: p.user?.title || '',
        department: p.user?.department?.name || '',
        tripRole: roleNames[role] || role,
      });
    }

    // Build equipment data
    const kitsByType = {};
    const kitsData = allKits.map(k => {
      const typeName = k.type?.name || 'Unknown';
      kitsByType[typeName] = (kitsByType[typeName] || 0) + 1;

      const serialsByComp = {};
      for (const s of (k.serials || [])) {
        if (s.serial) {
          const label = s.component?.label || 'Unknown';
          if (!serialsByComp[label]) serialsByComp[label] = [];
          serialsByComp[label].push(s.serial);
        }
      }

      const components = (k.componentStatuses || []).map(cs => ({
        label: cs.component?.label || 'Unknown',
        category: cs.component?.category || 'Other',
        status: cs.status,
      }));

      return {
        color: k.color,
        typeName,
        department: k.department?.name || '',
        components,
        serialNumbers: Object.entries(serialsByComp).map(([comp, sns]) => `${comp}: ${sns.join(', ')}`),
      };
    });

    // Build tasks data
    const taskPhases = {};
    const incompleteTasks = [];
    for (const t of trip.tasks) {
      const phase = t.phase || 'pre-deployment';
      if (!taskPhases[phase]) taskPhases[phase] = { tasks: [], completed: 0, total: 0 };
      taskPhases[phase].total++;
      if (t.status === 'done') taskPhases[phase].completed++;
      taskPhases[phase].tasks.push({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignedTo: t.assignedTo?.name || null,
        completedAt: t.completedAt,
      });
      if (t.status !== 'done') {
        incompleteTasks.push({
          title: t.title,
          phase,
          priority: t.priority,
          status: t.status,
          assignedTo: t.assignedTo?.name || null,
        });
      }
    }

    // Build notes data
    const notesByCategory = {};
    const afterActionNotes = [];
    for (const n of trip.notes) {
      const cat = n.category || 'general';
      const entry = {
        content: n.content,
        authorName: n.author?.name || 'Unknown',
        createdAt: n.createdAt,
      };
      if (cat === 'after-action') {
        afterActionNotes.push(entry);
      }
      if (!notesByCategory[cat]) notesByCategory[cat] = [];
      notesByCategory[cat].push(entry);
    }

    // Get unique departments from personnel
    const deptSet = new Set();
    for (const p of trip.personnel) {
      if (p.user?.department?.name) deptSet.add(p.user.department.name);
    }

    // Build response
    const totalTasks = trip.tasks.length;
    const completedTasks = trip.tasks.filter(t => t.status === 'done').length;

    const response = {
      trip: {
        name: trip.name,
        description: trip.description || '',
        location: trip.location || '',
        objectives: trip.objectives || '',
        startDate: trip.startDate,
        endDate: trip.endDate,
        duration: durationDays,
        status: trip.status,
        lead: trip.lead ? { id: trip.lead.id, name: trip.lead.name, title: trip.lead.title || '' } : null,
      },

      personnel: {
        total: trip.personnel.length,
        departments: deptSet.size,
        byRole: Object.entries(personnelByRole).map(([role, members]) => ({
          role,
          roleName: roleNames[role] || role,
          members,
        })),
      },

      equipment: {
        totalKits: allKits.length,
        byType: Object.entries(kitsByType).map(([typeName, count]) => ({ typeName, count })),
        kits: kitsData,
      },

      usvs: trip.boats.map(tb => ({
        name: tb.boat?.name || 'Unknown',
        type: tb.boat?.type || '',
        hullId: tb.boat?.hullId || '',
        role: tb.role,
        notes: tb.notes || '',
      })),

      tasks: {
        total: totalTasks,
        completed: completedTasks,
        byPhase: Object.entries(taskPhases).map(([phase, data]) => ({
          phase,
          total: data.total,
          completed: data.completed,
          tasks: data.tasks,
        })),
        incomplete: incompleteTasks,
      },

      comms: trip.commsEntries.map(c => ({
        type: c.type,
        label: c.label,
        value: c.value,
        assignedTo: c.assignedTo?.name || null,
        notes: c.notes || '',
      })),

      notes: {
        byCategory: Object.entries(notesByCategory).map(([category, notes]) => ({
          category,
          notes,
        })),
        afterAction: afterActionNotes,
      },

      equipmentIssues: {
        damageReport,
        maintenanceEvents,
      },

      activity: {
        checkouts,
        returns,
        inspections,
      },

      summary: {
        totalPersonnel: trip.personnel.length,
        totalKits: allKits.length,
        totalUSVs: trip.boats.length,
        daysOfOperation: durationDays,
        tasksCompleted: completedTasks,
        tasksTotal: totalTasks,
        equipmentIssuesFound: damageReport.length,
        maintenanceEventsCount: maintenanceEvents.length,
        totalCheckouts: checkouts.length,
        totalReturns: returns.length,
        totalInspections: inspections.length,
      },
    };

    return res.json(response);
  } catch (err) {
    console.error('Get trip AAR error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Trip Conflicts ───

// Helper: calculate overlap days between two date ranges
function overlapDays(s1, e1, s2, e2) {
  const start = Math.max(new Date(s1).getTime(), new Date(s2).getTime());
  const end = Math.min(new Date(e1).getTime(), new Date(e2).getTime());
  if (end <= start) return 0;
  return Math.ceil((end - start) / 86400000);
}

// GET /:id/conflicts - compute all scheduling conflicts for a trip
router.get('/:id/conflicts', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        personnel: {
          include: { user: { select: { id: true, name: true } } },
        },
        kits: {
          select: { id: true, color: true, type: { select: { name: true } } },
        },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const personnelConflicts = [];
    const equipmentConflicts = [];

    // Check each person for overlapping trips
    for (const tp of trip.personnel) {
      const overlapping = await prisma.tripPersonnel.findMany({
        where: {
          userId: tp.userId,
          tripId: { not: id },
          trip: {
            status: { in: ['planning', 'active'] },
            startDate: { lt: trip.endDate },
            endDate: { gt: trip.startDate },
          },
        },
        include: {
          trip: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
        },
      });

      if (overlapping.length > 0) {
        personnelConflicts.push({
          userId: tp.userId,
          userName: tp.user?.name || 'Unknown',
          tripRole: tp.role,
          conflictingTrips: overlapping.map(o => ({
            tripId: o.trip.id,
            tripName: o.trip.name,
            tripStatus: o.trip.status,
            startDate: o.trip.startDate,
            endDate: o.trip.endDate,
            role: o.role,
            overlapDays: overlapDays(trip.startDate, trip.endDate, o.trip.startDate, o.trip.endDate),
          })),
        });
      }
    }

    // Check each kit for overlapping trips and reservations
    for (const kit of trip.kits) {
      const conflicts = [];

      // Other trips with this kit assigned
      const otherTripKits = await prisma.kit.findMany({
        where: {
          id: kit.id,
          tripId: { not: null },
          trip: {
            id: { not: id },
            status: { in: ['planning', 'active'] },
            startDate: { lt: trip.endDate },
            endDate: { gt: trip.startDate },
          },
        },
        select: {
          trip: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
        },
      });

      for (const otk of otherTripKits) {
        if (otk.trip) {
          conflicts.push({
            type: 'trip',
            id: otk.trip.id,
            name: otk.trip.name,
            startDate: otk.trip.startDate,
            endDate: otk.trip.endDate,
            overlapDays: overlapDays(trip.startDate, trip.endDate, otk.trip.startDate, otk.trip.endDate),
          });
        }
      }

      // Overlapping reservations (not for this trip)
      const overlappingRes = await prisma.reservation.findMany({
        where: {
          kitId: kit.id,
          status: { in: ['pending', 'confirmed'] },
          startDate: { lt: trip.endDate },
          endDate: { gt: trip.startDate },
          OR: [
            { tripId: null },
            { tripId: { not: id } },
          ],
        },
        include: {
          person: { select: { name: true } },
        },
      });

      for (const r of overlappingRes) {
        conflicts.push({
          type: 'reservation',
          id: r.id,
          name: r.purpose || ('Reserved by ' + (r.person?.name || 'Unknown')),
          startDate: r.startDate,
          endDate: r.endDate,
          overlapDays: overlapDays(trip.startDate, trip.endDate, r.startDate, r.endDate),
        });
      }

      if (conflicts.length > 0) {
        equipmentConflicts.push({
          kitId: kit.id,
          kitColor: kit.color,
          kitType: kit.type?.name || 'Unknown',
          conflicts,
        });
      }
    }

    const totalPersonnelConflicts = personnelConflicts.reduce((s, p) => s + p.conflictingTrips.length, 0);
    const totalEquipmentConflicts = equipmentConflicts.reduce((s, e) => s + e.conflicts.length, 0);

    return res.json({
      hasConflicts: totalPersonnelConflicts + totalEquipmentConflicts > 0,
      personnelConflicts,
      equipmentConflicts,
      summary: {
        totalPersonnelConflicts,
        totalEquipmentConflicts,
        affectedPersonnel: personnelConflicts.length,
        affectedKits: equipmentConflicts.length,
      },
    });
  } catch (err) {
    console.error('Get trip conflicts error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Trip Readiness ───

// GET /:id/readiness - compile readiness data for deployment gate
router.get('/:id/readiness', async (req, res) => {
  try {
    const { id } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id },
      include: {
        lead: { select: { id: true, name: true } },
        personnel: {
          include: { user: { select: { id: true, name: true } } },
        },
        kits: {
          include: {
            type: {
              select: {
                id: true, name: true,
                components: {
                  include: { component: true },
                },
              },
            },
            componentStatuses: {
              include: { component: { select: { id: true, key: true, label: true, calibrationRequired: true, calibrationIntervalDays: true } } },
            },
            calibrationDates: true,
          },
        },
        boats: {
          include: { boat: true },
        },
        tasks: {
          select: {
            id: true, title: true, phase: true, priority: true, status: true,
            assignedTo: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Load system settings for inspection threshold
    const dbSettings = await prisma.systemSetting.findMany();
    let inspectionDueThreshold = 30;
    for (const s of dbSettings) {
      if (s.key === 'inspectionDueThreshold') inspectionDueThreshold = s.value;
    }

    const DAY_MS = 86400000;
    const daysAgo = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / DAY_MS) : null;

    const checks = [];

    // 1. has_lead
    checks.push({
      id: 'has_lead',
      label: 'Trip lead assigned',
      passed: !!trip.leadId,
      required: true,
      details: trip.leadId ? null : 'No trip lead assigned',
    });

    // 2. has_kits
    checks.push({
      id: 'has_kits',
      label: 'At least one kit assigned',
      passed: trip.kits.length > 0,
      required: true,
      details: trip.kits.length > 0 ? null : 'No kits assigned to this trip',
    });

    // 3. has_personnel
    checks.push({
      id: 'has_personnel',
      label: 'Personnel assigned',
      passed: trip.personnel.length > 0,
      required: true,
      details: trip.personnel.length > 0 ? null : 'No personnel assigned',
    });

    // 4. kits_inspected - all kits inspected within threshold
    const inspectionFailures = [];
    for (const kit of trip.kits) {
      const da = daysAgo(kit.lastChecked);
      if (da === null || da > inspectionDueThreshold) {
        inspectionFailures.push({
          kitId: kit.id,
          kitColor: kit.color,
          kitType: kit.type?.name || 'Unknown',
          lastInspected: kit.lastChecked || null,
          daysAgo: da,
        });
      }
    }
    checks.push({
      id: 'kits_inspected',
      label: 'All kits inspected within threshold',
      passed: inspectionFailures.length === 0,
      required: true,
      ...(inspectionFailures.length > 0 ? { failures: inspectionFailures } : {}),
    });

    // 5. kits_no_maintenance - no kits in maintenance
    const maintenanceFailures = [];
    for (const kit of trip.kits) {
      if (kit.maintenanceStatus) {
        maintenanceFailures.push({
          kitId: kit.id,
          kitColor: kit.color,
          kitType: kit.type?.name || 'Unknown',
          maintenanceStatus: kit.maintenanceStatus,
        });
      }
    }
    checks.push({
      id: 'kits_no_maintenance',
      label: 'No kits in maintenance',
      passed: maintenanceFailures.length === 0,
      required: true,
      ...(maintenanceFailures.length > 0 ? { failures: maintenanceFailures } : {}),
    });

    // 6. kits_no_damage - no missing or damaged components
    const damageFailures = [];
    for (const kit of trip.kits) {
      for (const cs of kit.componentStatuses) {
        if (cs.status !== 'GOOD') {
          damageFailures.push({
            kitId: kit.id,
            kitColor: kit.color,
            componentLabel: cs.component?.label || cs.componentId,
            slotIndex: cs.slotIndex,
            status: cs.status,
          });
        }
      }
    }
    checks.push({
      id: 'kits_no_damage',
      label: 'No missing or damaged components',
      passed: damageFailures.length === 0,
      required: false,
      ...(damageFailures.length > 0 ? { failures: damageFailures } : {}),
    });

    // 7. calibrations_current - all calibrations current
    const calibrationFailures = [];
    for (const kit of trip.kits) {
      // Get calibration-required components for this kit type
      const typeComps = kit.type?.components || [];
      for (const tc of typeComps) {
        const comp = tc.component;
        if (!comp.calibrationRequired || !comp.calibrationIntervalDays) continue;
        const qty = tc.quantity || 1;
        for (let slot = 0; slot < qty; slot++) {
          const calEntry = kit.calibrationDates.find(
            cd => cd.componentId === comp.id && cd.slotIndex === slot
          );
          const lastCal = calEntry?.calibDate || null;
          let dueIn = null;
          if (lastCal) {
            const dueDate = new Date(new Date(lastCal).getTime() + comp.calibrationIntervalDays * DAY_MS);
            dueIn = Math.floor((dueDate.getTime() - Date.now()) / DAY_MS);
          }
          if (!lastCal || (dueIn !== null && dueIn <= 0)) {
            calibrationFailures.push({
              kitId: kit.id,
              kitColor: kit.color,
              componentLabel: comp.label,
              lastCalibration: lastCal,
              dueIn: dueIn,
            });
          }
        }
      }
    }
    checks.push({
      id: 'calibrations_current',
      label: 'All calibrations current',
      passed: calibrationFailures.length === 0,
      required: false,
      ...(calibrationFailures.length > 0 ? { failures: calibrationFailures } : {}),
    });

    // 8. usvs_available - all assigned USVs available
    const boatFailures = [];
    for (const tb of trip.boats) {
      if (tb.boat.status !== 'available') {
        boatFailures.push({
          boatId: tb.boat.id,
          boatName: tb.boat.name,
          status: tb.boat.status,
        });
      }
    }
    checks.push({
      id: 'usvs_available',
      label: 'All assigned USVs available',
      passed: boatFailures.length === 0,
      required: true,
      ...(boatFailures.length > 0 ? { failures: boatFailures } : {}),
    });

    // 9. critical_tasks_done - all critical tasks completed
    const criticalTaskFailures = [];
    for (const task of trip.tasks) {
      if (task.priority === 'critical' && task.status !== 'done') {
        criticalTaskFailures.push({
          taskId: task.id,
          taskTitle: task.title,
          phase: task.phase,
          assignedTo: task.assignedTo?.name || null,
        });
      }
    }
    checks.push({
      id: 'critical_tasks_done',
      label: 'All critical tasks completed',
      passed: criticalTaskFailures.length === 0,
      required: false,
      ...(criticalTaskFailures.length > 0 ? { failures: criticalTaskFailures } : {}),
    });

    // Compute overall score
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const ready = checks.filter(c => c.required).every(c => c.passed);

    return res.json({
      ready,
      score: { passed, total },
      checks,
    });
  } catch (err) {
    console.error('Get trip readiness error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
