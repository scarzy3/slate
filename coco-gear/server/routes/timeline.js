import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/rbac.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();

const PRIVILEGED_ROLES = ['developer', 'director', 'super', 'admin', 'engineer'];

function canAccessTrip(trip, userId, userRole) {
  if (!trip.restricted) return true;
  if (PRIVILEGED_ROLES.includes(userRole)) return true;
  if (trip.leadId === userId) return true;
  if (trip.personnel?.some(p => p.userId === userId)) return true;
  return false;
}

async function requireTripAccess(req, res, next) {
  try {
    const tripId = req.params.tripId || req.params.id;
    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: { personnel: { select: { userId: true } } },
    });
    if (!trip || !canAccessTrip(trip, req.user.id, req.user.role)) {
      return res.status(404).json({ error: 'Not found' });
    }
    req.trip = trip;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Trip Timeline Routes (mounted under /api/trips) ───
export const timelineRouter = Router();
timelineRouter.use(authMiddleware);

// ═══════════════════════════════════════════
// ─── Phases ───
// ═══════════════════════════════════════════

// GET /api/trips/:tripId/phases
timelineRouter.get('/:tripId/phases', requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const phases = await prisma.tripPhase.findMany({
      where: { tripId },
      orderBy: [{ sortOrder: 'asc' }, { startDate: 'asc' }],
    });
    return res.json(phases);
  } catch (err) {
    console.error('List phases error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/phases
timelineRouter.post('/:tripId/phases', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, startDate, endDate, color, notes, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    const phase = await prisma.tripPhase.create({
      data: {
        tripId,
        name: name.trim(),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        color: color || null,
        notes: notes?.trim() || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    await auditLog('phase_create', 'trip', tripId, req.user.id, { phaseId: phase.id, name: phase.name });
    return res.status(201).json(phase);
  } catch (err) {
    console.error('Create phase error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trips/:tripId/phases/:id
timelineRouter.put('/:tripId/phases/:id', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, id } = req.params;
    const { name, startDate, endDate, color, notes, sortOrder } = req.body;

    const existing = await prisma.tripPhase.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (startDate !== undefined) data.startDate = new Date(startDate);
    if (endDate !== undefined) data.endDate = new Date(endDate);
    if (color !== undefined) data.color = color || null;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    // Validate dates if both are being set
    const finalStart = data.startDate || existing.startDate;
    const finalEnd = data.endDate || existing.endDate;
    if (new Date(finalStart) >= new Date(finalEnd)) {
      return res.status(400).json({ error: 'startDate must be before endDate' });
    }

    const phase = await prisma.tripPhase.update({
      where: { id },
      data,
    });

    await auditLog('phase_update', 'trip', tripId, req.user.id, { phaseId: id, changes: Object.keys(data) });
    return res.json(phase);
  } catch (err) {
    console.error('Update phase error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trips/:tripId/phases/:id
timelineRouter.delete('/:tripId/phases/:id', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, id } = req.params;

    const existing = await prisma.tripPhase.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    await prisma.tripPhase.delete({ where: { id } });
    await auditLog('phase_delete', 'trip', tripId, req.user.id, { phaseId: id, name: existing.name });
    return res.json({ message: 'Phase deleted' });
  } catch (err) {
    console.error('Delete phase error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/phases/reorder
timelineRouter.post('/:tripId/phases/reorder', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { phaseIds } = req.body;

    if (!Array.isArray(phaseIds) || !phaseIds.length) {
      return res.status(400).json({ error: 'phaseIds array required' });
    }

    for (let i = 0; i < phaseIds.length; i++) {
      await prisma.tripPhase.updateMany({
        where: { id: phaseIds[i], tripId },
        data: { sortOrder: i },
      });
    }

    return res.json({ message: 'Phases reordered' });
  } catch (err) {
    console.error('Reorder phases error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════
// ─── Milestones ───
// ═══════════════════════════════════════════

// GET /api/trips/:tripId/milestones
timelineRouter.get('/:tripId/milestones', requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const milestones = await prisma.tripMilestone.findMany({
      where: { tripId },
      orderBy: [{ date: 'asc' }, { sortOrder: 'asc' }],
    });
    return res.json(milestones);
  } catch (err) {
    console.error('List milestones error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/milestones
timelineRouter.post('/:tripId/milestones', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name, date, notes, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    const milestone = await prisma.tripMilestone.create({
      data: {
        tripId,
        name: name.trim(),
        date: new Date(date),
        notes: notes?.trim() || null,
        sortOrder: sortOrder ?? 0,
      },
    });

    await auditLog('milestone_create', 'trip', tripId, req.user.id, { milestoneId: milestone.id, name: milestone.name });
    return res.status(201).json(milestone);
  } catch (err) {
    console.error('Create milestone error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trips/:tripId/milestones/:id
timelineRouter.put('/:tripId/milestones/:id', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, id } = req.params;
    const { name, date, completed, notes, sortOrder } = req.body;

    const existing = await prisma.tripMilestone.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (date !== undefined) data.date = new Date(date);
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    // Handle completion toggle
    if (completed !== undefined) {
      data.completed = completed;
      if (completed && !existing.completed) {
        data.completedAt = new Date();
      } else if (!completed) {
        data.completedAt = null;
      }
    }

    const milestone = await prisma.tripMilestone.update({
      where: { id },
      data,
    });

    await auditLog('milestone_update', 'trip', tripId, req.user.id, { milestoneId: id, changes: Object.keys(data) });
    return res.json(milestone);
  } catch (err) {
    console.error('Update milestone error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trips/:tripId/milestones/:id
timelineRouter.delete('/:tripId/milestones/:id', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, id } = req.params;

    const existing = await prisma.tripMilestone.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await prisma.tripMilestone.delete({ where: { id } });
    await auditLog('milestone_delete', 'trip', tripId, req.user.id, { milestoneId: id, name: existing.name });
    return res.json({ message: 'Milestone deleted' });
  } catch (err) {
    console.error('Delete milestone error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
