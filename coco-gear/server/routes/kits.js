import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate, kitSchema, kitUpdateSchema, checkoutSchema, returnSchema, inspectionSchema, kitSerialUpdateSchema } from '../utils/validation.js';
import auditLog from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

const KIT_INCLUDE = {
  type: { include: { components: { include: { component: true } }, fields: true } },
  location: true,
  department: true,
  issuedTo: { select: { id: true, name: true, title: true, role: true, deptId: true } },
  fieldValues: true,
  componentStatuses: { include: { component: true } },
  serials: { include: { component: true } },
  calibrationDates: { include: { component: true } },
  issueHistory: {
    include: {
      person: { select: { id: true, name: true, title: true } },
      issuedBy: { select: { id: true, name: true } },
    },
    orderBy: { issuedDate: 'desc' },
  },
  inspections: { include: { results: true, photos: true }, orderBy: { date: 'desc' } },
  maintenanceHistory: {
    include: {
      startedBy: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: { startDate: 'desc' },
  },
  reservations: true,
  photos: true,
  trip: { select: { id: true, name: true, status: true, startDate: true, endDate: true } },
};

function compKey(componentId, slotIndex, quantity) {
  return quantity > 1 ? `${componentId}#${slotIndex}` : componentId;
}

function parseCompKey(key) {
  const parts = key.split('#');
  return { componentId: parts[0], slotIndex: parts.length > 1 ? parseInt(parts[1], 10) : 0 };
}

function serializeKit(kit) {
  const qtyMap = {};
  if (kit.type?.components) {
    for (const c of kit.type.components) {
      qtyMap[c.componentId] = c.quantity ?? 1;
    }
  }

  const fields = {};
  if (kit.fieldValues) {
    for (const fv of kit.fieldValues) fields[fv.key] = fv.value;
  }

  const comps = {};
  if (kit.componentStatuses) {
    for (const cs of kit.componentStatuses) {
      const qty = qtyMap[cs.componentId] ?? 1;
      comps[compKey(cs.componentId, cs.slotIndex ?? 0, qty)] = cs.status;
    }
  }

  const serials = {};
  if (kit.serials) {
    for (const s of kit.serials) {
      const qty = qtyMap[s.componentId] ?? 1;
      serials[compKey(s.componentId, s.slotIndex ?? 0, qty)] = s.serial;
    }
  }

  const calibrationDates = {};
  if (kit.calibrationDates) {
    for (const cd of kit.calibrationDates) {
      const qty = qtyMap[cd.componentId] ?? 1;
      calibrationDates[compKey(cd.componentId, cd.slotIndex ?? 0, qty)] = cd.calibDate;
    }
  }

  return {
    id: kit.id,
    typeId: kit.typeId,
    color: kit.color,
    locId: kit.locId,
    deptId: kit.deptId ?? null,
    issuedTo: kit.issuedToId ?? null,
    lastChecked: kit.lastChecked ?? null,
    maintenanceStatus: kit.maintenanceStatus ?? null,
    fields,
    comps,
    serials,
    calibrationDates,
    inspections: (kit.inspections ?? []).map(i => ({
      id: i.id,
      date: i.date,
      inspector: i.inspector,
      notes: i.notes,
      results: Object.fromEntries((i.results ?? []).map(r => {
        const qty = qtyMap[r.componentId] ?? 1;
        return [compKey(r.componentId, r.slotIndex, qty), r.status];
      })),
      serials: Object.fromEntries((i.results ?? []).filter(r => r.serial).map(r => {
        const qty = qtyMap[r.componentId] ?? 1;
        return [compKey(r.componentId, r.slotIndex, qty), r.serial];
      })),
      photos: i.photos ?? [],
    })),
    issueHistory: (kit.issueHistory ?? []).map(h => ({
      id: h.id,
      personId: h.personId,
      issuedDate: h.issuedDate,
      returnedDate: h.returnedDate,
      issuedBy: h.issuedById,
      checkoutSerials: h.checkoutSerials ?? {},
      returnSerials: h.returnSerials ?? {},
      returnNotes: h.returnNotes,
      checkoutLoc: h.checkoutLocId,
      returnLoc: h.returnLocId,
      person: h.person,
      issuedByUser: h.issuedBy,
    })),
    maintenanceHistory: (kit.maintenanceHistory ?? []).map(m => ({
      id: m.id,
      type: m.type,
      reason: m.reason,
      notes: m.notes,
      startDate: m.startDate,
      endDate: m.endDate,
      startedBy: m.startedById,
      completedBy: m.completedById,
      startedByUser: m.startedBy,
      completedByUser: m.completedBy,
    })),
    photos: kit.photos ?? [],
    reservations: kit.reservations ?? [],
    tripId: kit.tripId ?? null,
    _trip: kit.trip ?? null,
    // Include type info for the frontend
    _type: kit.type ? {
      id: kit.type.id,
      name: kit.type.name,
      desc: kit.type.desc,
      compIds: kit.type.components.map(c => c.componentId),
      compQtys: Object.fromEntries(kit.type.components.filter(c => c.quantity > 1).map(c => [c.componentId, c.quantity])),
      fields: kit.type.fields.map(f => ({ key: f.key, label: f.label, type: f.type })),
    } : null,
    _location: kit.location,
    _department: kit.department,
    _issuedTo: kit.issuedTo,
  };
}

router.use(authMiddleware);

// GET / - list kits
router.get('/', async (req, res) => {
  try {
    const { status, locId, search, typeId } = req.query;
    const where = {};

    if (status && status !== 'all') {
      if (status === 'available') { where.issuedToId = null; where.maintenanceStatus = null; }
      else if (status === 'issued') { where.issuedToId = { not: null }; }
      else if (status === 'maintenance') { where.maintenanceStatus = { not: null }; }
    }
    if (locId) where.locId = locId;
    if (typeId) where.typeId = typeId;
    if (search) {
      where.OR = [
        { color: { contains: search, mode: 'insensitive' } },
        { fieldValues: { some: { value: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    const kits = await prisma.kit.findMany({ where, include: KIT_INCLUDE, orderBy: { createdAt: 'asc' } });
    res.json(kits.map(serializeKit));
  } catch (err) {
    console.error('List kits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single kit
router.get('/:id', async (req, res) => {
  try {
    const kit = await prisma.kit.findUnique({ where: { id: req.params.id }, include: KIT_INCLUDE });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    res.json(serializeKit(kit));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create kit (admin+)
router.post('/', requireRole('admin'), validate(kitSchema), async (req, res) => {
  try {
    const { typeId, color, locId, deptId, fields } = req.validated;
    const kitType = await prisma.kitType.findUnique({
      where: { id: typeId },
      include: { components: true, fields: true },
    });
    if (!kitType) return res.status(400).json({ error: 'Invalid kit type' });

    const kit = await prisma.$transaction(async (tx) => {
      const created = await tx.kit.create({ data: { typeId, color, locId, deptId: deptId ?? null } });

      // Init field values
      if (kitType.fields?.length) {
        await tx.kitFieldValue.createMany({
          data: kitType.fields.map(f => ({ kitId: created.id, key: f.key, value: String(fields?.[f.key] ?? '') })),
        });
      }

      // Init component statuses, serials, calibration dates
      const slots = [];
      for (const comp of kitType.components) {
        for (let i = 0; i < (comp.quantity ?? 1); i++) {
          slots.push({ componentId: comp.componentId, slotIndex: i });
        }
      }

      if (slots.length) {
        await tx.kitComponentStatus.createMany({
          data: slots.map(s => ({ kitId: created.id, componentId: s.componentId, slotIndex: s.slotIndex, status: 'GOOD' })),
        });
        await tx.kitSerial.createMany({
          data: slots.map(s => ({ kitId: created.id, componentId: s.componentId, slotIndex: s.slotIndex, serial: '' })),
        });
        await tx.kitCalibrationDate.createMany({
          data: slots.map(s => ({ kitId: created.id, componentId: s.componentId, slotIndex: s.slotIndex, calibDate: null })),
        });
      }

      return tx.kit.findUnique({ where: { id: created.id }, include: KIT_INCLUDE });
    });

    await auditLog('kit_create', 'kit', kit.id, req.user.id, { color, typeId });
    res.status(201).json(serializeKit(kit));
  } catch (err) {
    console.error('Create kit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update kit (admin+)
router.put('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { color, locId, deptId, tripId, fields } = req.body;
    const data = {};
    if (color !== undefined) data.color = color;
    if (locId !== undefined) data.locId = locId;
    if (deptId !== undefined) data.deptId = deptId;
    if (tripId !== undefined) data.tripId = tripId;

    await prisma.kit.update({ where: { id: req.params.id }, data });

    if (fields && typeof fields === 'object') {
      for (const [key, value] of Object.entries(fields)) {
        await prisma.kitFieldValue.upsert({
          where: { kitId_key: { kitId: req.params.id, key } },
          create: { kitId: req.params.id, key, value: String(value) },
          update: { value: String(value) },
        });
      }
    }

    const kit = await prisma.kit.findUnique({ where: { id: req.params.id }, include: KIT_INCLUDE });
    await auditLog('kit_update', 'kit', req.params.id, req.user.id, { color, locId });
    res.json(serializeKit(kit));
  } catch (err) {
    console.error('Update kit error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete kit (admin+)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const kit = await prisma.kit.findUnique({ where: { id: req.params.id } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    await prisma.kit.delete({ where: { id: req.params.id } });
    await auditLog('kit_delete', 'kit', req.params.id, req.user.id, { color: kit.color });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /checkout - checkout kit
router.post('/checkout', validate(checkoutSchema), async (req, res) => {
  try {
    const { kitId, personId, serials, notes } = req.validated;
    const kit = await prisma.kit.findUnique({ where: { id: kitId }, include: { department: true } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    if (kit.issuedToId) return res.status(409).json({ error: 'Kit already issued' });
    if (kit.maintenanceStatus) return res.status(409).json({ error: 'Kit in maintenance' });

    const recipientId = personId || req.user.id;
    const directorRoles = ['developer','director','super','engineer'];
    const roleLevel = { user: 0, lead: 1, manager: 2, admin: 2, director: 3, super: 3, developer: 3, engineer: 3 };

    // Check if approval needed for cross-dept kits
    if (kit.deptId) {
      const settings = await prisma.systemSetting.findMany();
      const requireApproval = settings.find(s => s.key === 'requireDeptApproval')?.value ?? true;
      const directorBypass = settings.find(s => s.key === 'directorBypassApproval')?.value ?? true;
      const minRole = settings.find(s => s.key === 'deptApprovalMinRole')?.value ?? 'lead';

      if (requireApproval) {
        const isDirector = directorRoles.includes(req.user.role);
        // Directors bypass if setting enabled
        const bypassed = directorBypass && isDirector;
        if (!bypassed) {
          const dept = await prisma.department.findUnique({ where: { id: kit.deptId } });
          const isDeptHead = dept && dept.headId === req.user.id;
          const isInSameDept = req.user.deptId === kit.deptId;
          const userLevel = roleLevel[req.user.role] || 0;
          const minLevel = roleLevel[minRole] || 1;
          const hasMinRole = userLevel >= minLevel;
          // Can bypass if: dept head, in same dept, or has min approval role
          if (!isDeptHead && !isInSameDept && !hasMinRole) {
            const request = await prisma.checkoutRequest.create({
              data: { kitId, personId: req.user.id, deptId: kit.deptId, status: 'pending', serials: serials || {}, notes },
            });
            await auditLog('checkout_request', 'kit', kitId, req.user.id, { kitColor: kit.color });
            return res.status(202).json({ pending: true, requestId: request.id });
          }
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.kit.update({ where: { id: kitId }, data: { issuedToId: recipientId } });
      await tx.issueHistory.create({
        data: { kitId, personId: recipientId, issuedById: req.user.id, checkoutSerials: serials || {}, checkoutLocId: kit.locId },
      });
      if (serials) {
        for (const [key, serial] of Object.entries(serials)) {
          if (!serial) continue;
          const { componentId, slotIndex } = parseCompKey(key);
          await tx.kitSerial.upsert({
            where: { kitId_componentId_slotIndex: { kitId, componentId, slotIndex } },
            create: { kitId, componentId, slotIndex, serial },
            update: { serial },
          });
        }
      }
      return tx.kit.findUnique({ where: { id: kitId }, include: KIT_INCLUDE });
    });

    await auditLog('checkout', 'kit', kitId, req.user.id, { kitColor: kit.color, recipientId });
    res.json(serializeKit(updated));
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /return - return kit
router.post('/return', validate(returnSchema), async (req, res) => {
  try {
    const { kitId, serials, notes } = req.validated;
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });
    if (!kit.issuedToId) return res.status(409).json({ error: 'Kit not issued' });

    // Any authenticated user can return a kit (operators are primary users for returns)

    const updated = await prisma.$transaction(async (tx) => {
      await tx.kit.update({ where: { id: kitId }, data: { issuedToId: null } });
      const lastIssue = await tx.issueHistory.findFirst({
        where: { kitId, returnedDate: null },
        orderBy: { issuedDate: 'desc' },
      });
      if (lastIssue) {
        await tx.issueHistory.update({
          where: { id: lastIssue.id },
          data: { returnedDate: new Date(), returnNotes: notes, returnSerials: serials || {}, returnLocId: kit.locId },
        });
      }
      if (serials) {
        for (const [key, serial] of Object.entries(serials)) {
          if (!serial) continue;
          const { componentId, slotIndex } = parseCompKey(key);
          await tx.kitSerial.upsert({
            where: { kitId_componentId_slotIndex: { kitId, componentId, slotIndex } },
            create: { kitId, componentId, slotIndex, serial },
            update: { serial },
          });
        }
      }
      return tx.kit.findUnique({ where: { id: kitId }, include: KIT_INCLUDE });
    });

    await auditLog('return', 'kit', kitId, req.user.id, { kitColor: kit.color });
    res.json(serializeKit(updated));
  } catch (err) {
    console.error('Return error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /inspect - submit inspection results
router.post('/inspect', validate(inspectionSchema), async (req, res) => {
  try {
    const { kitId, inspector, notes, results } = req.validated;
    const kit = await prisma.kit.findUnique({ where: { id: kitId } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });

    const updated = await prisma.$transaction(async (tx) => {
      const inspection = await tx.inspection.create({
        data: { kitId, inspector: inspector || req.user.name || 'Unknown', notes },
      });

      for (const [, result] of Object.entries(results)) {
        const { componentId, slotIndex, status, serial } = result;
        const idx = slotIndex ?? 0;
        await tx.inspectionResult.create({
          data: { inspectionId: inspection.id, componentId, slotIndex: idx, status, serial },
        });
        await tx.kitComponentStatus.upsert({
          where: { kitId_componentId_slotIndex: { kitId, componentId, slotIndex: idx } },
          create: { kitId, componentId, slotIndex: idx, status },
          update: { status },
        });
        if (serial) {
          await tx.kitSerial.upsert({
            where: { kitId_componentId_slotIndex: { kitId, componentId, slotIndex: idx } },
            create: { kitId, componentId, slotIndex: idx, serial },
            update: { serial },
          });
        }
      }

      await tx.kit.update({ where: { id: kitId }, data: { lastChecked: new Date() } });
      return tx.kit.findUnique({ where: { id: kitId }, include: KIT_INCLUDE });
    });

    await auditLog('inspect', 'kit', kitId, req.user.id, { kitColor: kit.color });
    res.json(serializeKit(updated));
  } catch (err) {
    console.error('Inspect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/serials - directly update kit serials (admin+)
router.put('/:id/serials', requireRole('admin'), validate(kitSerialUpdateSchema), async (req, res) => {
  try {
    const { serials } = req.validated;
    const kit = await prisma.kit.findUnique({ where: { id: req.params.id }, include: KIT_INCLUDE });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });

    await prisma.$transaction(async (tx) => {
      for (const [key, serial] of Object.entries(serials)) {
        const { componentId, slotIndex } = parseCompKey(key);
        await tx.kitSerial.upsert({
          where: { kitId_componentId_slotIndex: { kitId: req.params.id, componentId, slotIndex } },
          create: { kitId: req.params.id, componentId, slotIndex, serial },
          update: { serial },
        });
      }
    });

    const updated = await prisma.kit.findUnique({ where: { id: req.params.id }, include: KIT_INCLUDE });
    await auditLog('serial_update', 'kit', req.params.id, req.user.id, { kitColor: kit.color, serialCount: Object.keys(serials).length });
    res.json(serializeKit(updated));
  } catch (err) {
    console.error('Update serials error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/location - update kit location
router.put('/:id/location', async (req, res) => {
  try {
    const { locId } = req.body;
    if (!locId) return res.status(400).json({ error: 'locId required' });

    const kit = await prisma.kit.findUnique({ where: { id: req.params.id } });
    if (!kit) return res.status(404).json({ error: 'Kit not found' });

    const isAdmin = ['developer','director','super','engineer','manager','admin'].includes(req.user.role);
    if (!isAdmin) {
      const settings = await prisma.systemSetting.findMany();
      const allowed = settings.find(s => s.key === 'allowUserLocationUpdate')?.value ?? true;
      if (!allowed) return res.status(403).json({ error: 'Location updates not allowed' });
    }

    const prevLoc = kit.locId;
    const updated = await prisma.kit.update({
      where: { id: req.params.id },
      data: { locId },
      include: KIT_INCLUDE,
    });

    await auditLog('location_change', 'kit', req.params.id, req.user.id, { from: prevLoc, to: locId, kitColor: kit.color });
    res.json(serializeKit(updated));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
