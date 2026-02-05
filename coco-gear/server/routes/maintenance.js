import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, maintenanceStartSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list kits in maintenance + maintenance history
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Kits currently in maintenance
    const kitsInMaintenance = await prisma.kit.findMany({
      where: { maintenanceStatus: { not: null } },
      include: {
        type: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        maintenanceHistory: {
          orderBy: { startDate: 'desc' },
          take: 1,
          include: {
            startedBy: { select: { id: true, name: true } },
            completedBy: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Recent maintenance history
    const history = await prisma.maintenanceHistory.findMany({
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { id: true, name: true } },
          },
        },
        startedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'desc' },
      take: 100,
    });

    return res.json({ kitsInMaintenance, history });
  } catch (err) {
    console.error('List maintenance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /send - send kit to maintenance
router.post('/send', authMiddleware, requireAdminPerm('maintenance'), validate(maintenanceStartSchema), async (req, res) => {
  try {
    const { kitId, type, reason, notes } = req.validated;

    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    if (kit.maintenanceStatus) {
      return res.status(409).json({ error: 'Kit is already in maintenance' });
    }

    if (kit.issuedToId) {
      return res.status(409).json({ error: 'Kit is currently checked out. Return it before sending to maintenance.' });
    }

    const [updatedKit, historyEntry] = await prisma.$transaction([
      prisma.kit.update({
        where: { id: kitId },
        data: { maintenanceStatus: type },
        include: {
          type: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }),
      prisma.maintenanceHistory.create({
        data: {
          kitId,
          type,
          reason,
          notes,
          startedById: req.user.id,
        },
        include: {
          startedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    await auditLog('maintenance_start', 'kit', kitId, req.user.id, {
      type,
      reason,
    });

    return res.status(201).json({ kit: updatedKit, history: historyEntry });
  } catch (err) {
    console.error('Send to maintenance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:kitId/return - return kit from maintenance
router.post('/:kitId/return', authMiddleware, requireAdminPerm('maintenance'), async (req, res) => {
  try {
    const { kitId } = req.params;
    const { notes } = req.body;

    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    if (!kit.maintenanceStatus) {
      return res.status(409).json({ error: 'Kit is not currently in maintenance' });
    }

    // Find the latest open maintenance history record
    const lastHistory = await prisma.maintenanceHistory.findFirst({
      where: { kitId, endDate: null },
      orderBy: { startDate: 'desc' },
    });

    const transactions = [
      prisma.kit.update({
        where: { id: kitId },
        data: { maintenanceStatus: null },
        include: {
          type: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
      }),
    ];

    if (lastHistory) {
      const historyUpdate = {
        endDate: new Date(),
        completedById: req.user.id,
      };
      if (notes) historyUpdate.notes = (lastHistory.notes || '') + '\n--- Return Notes ---\n' + notes;
      transactions.push(
        prisma.maintenanceHistory.update({
          where: { id: lastHistory.id },
          data: historyUpdate,
        }),
      );
    }

    const [updatedKit] = await prisma.$transaction(transactions);

    await auditLog('maintenance_return', 'kit', kitId, req.user.id, {
      previousStatus: kit.maintenanceStatus,
    });

    return res.json({ kit: updatedKit });
  } catch (err) {
    console.error('Return from maintenance error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
