import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate, assetSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

// GET / - list all standalone assets with issueHistory
router.get('/', authMiddleware, async (req, res) => {
  try {
    const assets = await prisma.standaloneAsset.findMany({
      include: {
        location: { select: { id: true, name: true, shortCode: true } },
        issueHistory: {
          include: {
            person: { select: { id: true, name: true } },
            issuedBy: { select: { id: true, name: true } },
          },
          orderBy: { issuedDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return res.json(assets);
  } catch (err) {
    console.error('List assets error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create asset (admin+)
router.post('/', authMiddleware, requireRole('admin'), validate(assetSchema), async (req, res) => {
  try {
    const data = req.validated;

    const asset = await prisma.standaloneAsset.create({
      data,
      include: { location: true },
    });

    await auditLog('asset_create', 'asset', asset.id, req.user.id, { name: data.name, serial: data.serial });

    return res.status(201).json(asset);
  } catch (err) {
    console.error('Create asset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update asset (admin+)
router.put('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, serial, category, locId, notes, condition } = req.body;

    const existing = await prisma.standaloneAsset.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name;
    if (serial !== undefined) data.serial = serial;
    if (category !== undefined) data.category = category;
    if (locId !== undefined) data.locId = locId;
    if (notes !== undefined) data.notes = notes;
    if (condition !== undefined) data.condition = condition;

    const asset = await prisma.standaloneAsset.update({
      where: { id },
      data,
      include: { location: true },
    });

    await auditLog('asset_update', 'asset', id, req.user.id, { name: asset.name });

    return res.json(asset);
  } catch (err) {
    console.error('Update asset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete asset (admin+)
router.delete('/:id', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await prisma.standaloneAsset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    await prisma.standaloneAsset.delete({ where: { id } });

    await auditLog('asset_delete', 'asset', id, req.user.id, { name: asset.name, serial: asset.serial });

    return res.json({ message: 'Asset deleted' });
  } catch (err) {
    console.error('Delete asset error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/checkout - checkout asset to a person
router.post('/:id/checkout', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { personId } = req.body;

    if (!personId) {
      return res.status(400).json({ error: 'personId is required' });
    }

    const asset = await prisma.standaloneAsset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (asset.issuedToId) {
      return res.status(409).json({ error: 'Asset is already checked out' });
    }

    const person = await prisma.user.findUnique({ where: { id: personId } });
    if (!person) {
      return res.status(404).json({ error: 'Person not found' });
    }

    const [updated, history] = await prisma.$transaction([
      prisma.standaloneAsset.update({
        where: { id },
        data: { issuedToId: personId },
        include: { location: true },
      }),
      prisma.assetIssueHistory.create({
        data: {
          assetId: id,
          personId,
          issuedById: req.user.id,
        },
      }),
    ]);

    await auditLog('asset_checkout', 'asset', id, req.user.id, {
      name: asset.name,
      serial: asset.serial,
      personId,
      personName: person.name,
    });

    return res.json({ asset: updated, history });
  } catch (err) {
    console.error('Asset checkout error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/return - return asset
router.post('/:id/return', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const asset = await prisma.standaloneAsset.findUnique({ where: { id } });
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    if (!asset.issuedToId) {
      return res.status(409).json({ error: 'Asset is not currently checked out' });
    }

    // Find the latest open issue history record
    const lastHistory = await prisma.assetIssueHistory.findFirst({
      where: { assetId: id, returnedDate: null },
      orderBy: { issuedDate: 'desc' },
    });

    const [updated] = await prisma.$transaction([
      prisma.standaloneAsset.update({
        where: { id },
        data: { issuedToId: null },
        include: { location: true },
      }),
      ...(lastHistory
        ? [prisma.assetIssueHistory.update({
            where: { id: lastHistory.id },
            data: { returnedDate: new Date() },
          })]
        : []),
    ]);

    await auditLog('asset_return', 'asset', id, req.user.id, {
      name: asset.name,
      serial: asset.serial,
      returnedFrom: asset.issuedToId,
    });

    return res.json({ asset: updated });
  } catch (err) {
    console.error('Asset return error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
