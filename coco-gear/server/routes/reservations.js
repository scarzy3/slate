import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, requireApprover } from '../middleware/rbac.js';
import { validate, reservationSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

/**
 * Check for conflicting reservations (confirmed or pending) for the same kit
 * in an overlapping date range, optionally excluding a specific reservation ID.
 */
async function hasConflict(kitId, startDate, endDate, excludeId = null) {
  const where = {
    kitId,
    status: { in: ['confirmed', 'pending'] },
    startDate: { lt: new Date(endDate) },
    endDate: { gt: new Date(startDate) },
  };
  if (excludeId) {
    where.id = { not: excludeId };
  }
  const count = await prisma.reservation.count({ where });
  return count > 0;
}

// GET / - list all reservations with kit and person info
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, kitId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (kitId) where.kitId = kitId;

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { id: true, name: true } },
            location: { select: { id: true, name: true } },
          },
        },
        person: { select: { id: true, name: true, title: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    return res.json(reservations);
  } catch (err) {
    console.error('List reservations error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create reservation (any auth user)
router.post('/', authMiddleware, validate(reservationSchema), async (req, res) => {
  try {
    const { kitId, startDate, endDate, purpose } = req.validated;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    // Check kit exists
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    // Check for conflicts
    const conflict = await hasConflict(kitId, startDate, endDate);
    if (conflict) {
      return res.status(409).json({ error: 'Conflicting reservation exists for this kit and date range' });
    }

    // Admin/super auto-confirms; regular users create pending
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super';
    const status = isAdmin ? 'confirmed' : 'pending';

    const reservation = await prisma.reservation.create({
      data: {
        kitId,
        personId: req.user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        purpose,
        status,
      },
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { id: true, name: true } },
          },
        },
        person: { select: { id: true, name: true } },
      },
    });

    await auditLog('reservation_create', 'reservation', reservation.id, req.user.id, {
      kitId,
      startDate,
      endDate,
      status,
    });

    return res.status(201).json(reservation);
  } catch (err) {
    console.error('Create reservation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/approve - approve reservation (admin/super/dept head)
router.put('/:id/approve', authMiddleware, requireApprover, async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { kit: true },
    });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending reservations can be approved' });
    }

    // If the user is a dept head, verify they head the kit's department
    if (req.isApproverCheck) {
      if (!reservation.kit.deptId) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      const dept = await prisma.department.findUnique({ where: { id: reservation.kit.deptId } });
      if (!dept || dept.headId !== req.user.id) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
    }

    // Re-check conflicts before confirming
    const conflict = await hasConflict(
      reservation.kitId,
      reservation.startDate,
      reservation.endDate,
      id,
    );
    if (conflict) {
      return res.status(409).json({ error: 'A conflicting reservation was confirmed in the meantime' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'confirmed' },
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { id: true, name: true } },
          },
        },
        person: { select: { id: true, name: true } },
      },
    });

    await auditLog('reservation_approve', 'reservation', id, req.user.id, {
      kitId: reservation.kitId,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Approve reservation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/cancel - cancel reservation (owner or admin)
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(409).json({ error: 'Reservation is already cancelled' });
    }

    // Only the owner or admin/super can cancel
    const isOwner = reservation.personId === req.user.id;
    const isAdmin = req.user.role === 'admin' || req.user.role === 'super';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Only the reservation owner or an admin can cancel' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'cancelled' },
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { id: true, name: true } },
          },
        },
        person: { select: { id: true, name: true } },
      },
    });

    await auditLog('reservation_cancel', 'reservation', id, req.user.id, {
      kitId: reservation.kitId,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Cancel reservation error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
