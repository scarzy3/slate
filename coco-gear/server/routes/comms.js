import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/rbac.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();

const commsInclude = {
  assignedTo: { select: { id: true, name: true, title: true } },
};

// ─── Trip Comms Routes (mounted under /api/trips) ───
export const commsRouter = Router();
commsRouter.use(authMiddleware);

// GET /api/trips/:tripId/comms - list all comms entries for a trip
commsRouter.get('/:tripId/comms', async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const entries = await prisma.tripCommsEntry.findMany({
      where: { tripId },
      include: commsInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return res.json(entries);
  } catch (err) {
    console.error('List comms error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/comms - create a comms entry
commsRouter.post('/:tripId/comms', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId } = req.params;
    const { type, label, value, assignedToId, notes, sortOrder } = req.body;

    if (!label || !label.trim()) {
      return res.status(400).json({ error: 'Label is required' });
    }
    if (!value || !value.trim()) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const entry = await prisma.tripCommsEntry.create({
      data: {
        tripId,
        type: type || 'radio_channel',
        label: label.trim(),
        value: value.trim(),
        assignedToId: assignedToId || null,
        notes: notes?.trim() || null,
        sortOrder: sortOrder ?? 0,
      },
      include: commsInclude,
    });

    await auditLog('comms_create', 'trip', tripId, req.user.id, { entryId: entry.id, label: entry.label, type: entry.type });
    return res.status(201).json(entry);
  } catch (err) {
    console.error('Create comms entry error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trips/:tripId/comms/:id - update a comms entry
commsRouter.put('/:tripId/comms/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId, id } = req.params;
    const { type, label, value, assignedToId, notes, sortOrder } = req.body;

    const existing = await prisma.tripCommsEntry.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Comms entry not found' });
    }

    const data = {};
    if (type !== undefined) data.type = type;
    if (label !== undefined) data.label = label.trim();
    if (value !== undefined) data.value = value.trim();
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const entry = await prisma.tripCommsEntry.update({
      where: { id },
      data,
      include: commsInclude,
    });

    await auditLog('comms_update', 'trip', tripId, req.user.id, { entryId: id, changes: Object.keys(data) });
    return res.json(entry);
  } catch (err) {
    console.error('Update comms entry error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trips/:tripId/comms/:id - delete a comms entry
commsRouter.delete('/:tripId/comms/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId, id } = req.params;

    const existing = await prisma.tripCommsEntry.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Comms entry not found' });
    }

    await prisma.tripCommsEntry.delete({ where: { id } });
    await auditLog('comms_delete', 'trip', tripId, req.user.id, { entryId: id, label: existing.label });
    return res.json({ message: 'Comms entry deleted' });
  } catch (err) {
    console.error('Delete comms entry error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/comms/reorder - reorder comms entries
commsRouter.post('/:tripId/comms/reorder', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId } = req.params;
    const { entryIds } = req.body;

    if (!Array.isArray(entryIds) || !entryIds.length) {
      return res.status(400).json({ error: 'entryIds array required' });
    }

    for (let i = 0; i < entryIds.length; i++) {
      await prisma.tripCommsEntry.updateMany({
        where: { id: entryIds[i], tripId },
        data: { sortOrder: i },
      });
    }

    return res.json({ message: 'Comms entries reordered' });
  } catch (err) {
    console.error('Reorder comms error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
