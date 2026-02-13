import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';
import { validate, consumableSchema, consumableAdjustSchema, consumableUpdateSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all consumables
router.get('/', authMiddleware, async (req, res) => {
  try {
    const consumables = await prisma.consumable.findMany({
      orderBy: { name: 'asc' },
    });
    return res.json(consumables);
  } catch (err) {
    console.error('List consumables error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create consumable (admin+, perm: consumables)
router.post('/', authMiddleware, requireAdminPerm('consumables'), validate(consumableSchema), async (req, res) => {
  try {
    const data = req.validated;

    const consumable = await prisma.consumable.create({ data });

    await auditLog('consumable_create', 'consumable', consumable.id, req.user.id, { name: data.name });

    return res.status(201).json(consumable);
  } catch (err) {
    console.error('Create consumable error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update consumable (admin+, perm: consumables)
router.put('/:id', authMiddleware, requireAdminPerm('consumables'), validate(consumableUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, category, qty, minQty, unit } = req.validated;

    const existing = await prisma.consumable.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Consumable not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (sku !== undefined) data.sku = sku;
    if (category !== undefined) data.category = category;
    if (qty !== undefined) data.qty = qty;
    if (minQty !== undefined) data.minQty = minQty;
    if (unit !== undefined) data.unit = unit;

    const consumable = await prisma.consumable.update({ where: { id }, data });

    await auditLog('consumable_update', 'consumable', id, req.user.id, { name: consumable.name });

    return res.json(consumable);
  } catch (err) {
    console.error('Update consumable error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete consumable (admin+, perm: consumables)
router.delete('/:id', authMiddleware, requireAdminPerm('consumables'), async (req, res) => {
  try {
    const { id } = req.params;

    const consumable = await prisma.consumable.findUnique({ where: { id } });
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }

    await prisma.consumable.delete({ where: { id } });

    await auditLog('consumable_delete', 'consumable', id, req.user.id, { name: consumable.name });

    return res.json({ message: 'Consumable deleted' });
  } catch (err) {
    console.error('Delete consumable error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/adjust - adjust quantity (admin+, perm: consumables)
router.post('/:id/adjust', authMiddleware, requireAdminPerm('consumables'), validate(consumableAdjustSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const { delta, reason } = req.validated;

    const consumable = await prisma.consumable.findUnique({ where: { id } });
    if (!consumable) {
      return res.status(404).json({ error: 'Consumable not found' });
    }

    const newQty = consumable.qty + delta;
    if (newQty < 0) {
      return res.status(400).json({ error: 'Quantity cannot go below zero' });
    }

    const updated = await prisma.consumable.update({
      where: { id },
      data: { qty: newQty },
    });

    await auditLog('consumable_adjust', 'consumable', id, req.user.id, {
      name: consumable.name,
      previousQty: consumable.qty,
      delta,
      newQty,
      reason,
    });

    return res.json(updated);
  } catch (err) {
    console.error('Adjust consumable error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
