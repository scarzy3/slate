import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/rbac.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();

// ─── Packing Template Routes (mounted at /api/packing-templates) ───
export const packingTemplateRouter = Router();
packingTemplateRouter.use(authMiddleware);

// GET / - list all templates, optional ?role= filter
packingTemplateRouter.get('/', async (req, res) => {
  try {
    const { role } = req.query;
    const where = {};
    if (role) where.role = role;

    const templates = await prisma.packingTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    return res.json(templates);
  } catch (err) {
    console.error('List packing templates error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create template
packingTemplateRouter.post('/', requirePerm('trips'), async (req, res) => {
  try {
    const { name, role, category, items, isDefault } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const template = await prisma.packingTemplate.create({
      data: {
        name: name.trim(),
        role: role || null,
        category: category || 'general',
        items,
        isDefault: isDefault || false,
      },
    });

    await auditLog('packing_template_create', 'packing_template', template.id, req.user.id, { name: template.name });
    return res.status(201).json(template);
  } catch (err) {
    console.error('Create packing template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update template
packingTemplateRouter.put('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, category, items, isDefault } = req.body;

    const existing = await prisma.packingTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (role !== undefined) data.role = role || null;
    if (category !== undefined) data.category = category;
    if (items !== undefined) data.items = items;
    if (isDefault !== undefined) data.isDefault = isDefault;

    const template = await prisma.packingTemplate.update({ where: { id }, data });
    await auditLog('packing_template_update', 'packing_template', id, req.user.id, { changes: Object.keys(data) });
    return res.json(template);
  } catch (err) {
    console.error('Update packing template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete template
packingTemplateRouter.delete('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.packingTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.packingTemplate.delete({ where: { id } });
    await auditLog('packing_template_delete', 'packing_template', id, req.user.id, { name: existing.name });
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete packing template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Trip Packing Routes (mounted at /api/trips) ───
export const packingRouter = Router();
packingRouter.use(authMiddleware);

// GET /:tripId/packing - compile and return full packing list
packingRouter.get('/:tripId/packing', async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        kits: {
          include: {
            type: { select: { id: true, name: true, components: { include: { component: true } } } },
            location: { select: { id: true, name: true, shortCode: true } },
            department: { select: { id: true, name: true, color: true } },
            componentStatuses: true,
            serials: true,
          },
        },
        personnel: {
          include: {
            user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
          },
        },
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // ── Build Equipment Section ──
    const kitsByLocation = {};
    for (const kit of trip.kits) {
      const locKey = kit.location.id;
      if (!kitsByLocation[locKey]) {
        kitsByLocation[locKey] = { location: kit.location, kits: [] };
      }
      const components = [];
      if (kit.type.components) {
        for (const tc of kit.type.components) {
          const comp = tc.component;
          const statuses = kit.componentStatuses.filter(s => s.componentId === comp.id);
          const serialNums = kit.serials.filter(s => s.componentId === comp.id);
          const slots = [];
          for (let i = 0; i < tc.quantity; i++) {
            const st = statuses.find(s => s.slotIndex === i);
            const sr = serialNums.find(s => s.slotIndex === i);
            slots.push({ slotIndex: i, status: st?.status || 'GOOD', serial: sr?.serial || '' });
          }
          components.push({
            componentId: comp.id,
            label: comp.label,
            category: comp.category,
            quantity: tc.quantity,
            serialNumbers: slots.map(s => s.serial).filter(Boolean),
            status: slots.some(s => s.status === 'DAMAGED') ? 'DAMAGED' : slots.some(s => s.status === 'MISSING') ? 'MISSING' : 'GOOD',
            slots,
          });
        }
      }
      kitsByLocation[locKey].kits.push({
        id: kit.id,
        color: kit.color,
        typeId: kit.type.id,
        typeName: kit.type.name,
        deptId: kit.department?.id || null,
        deptName: kit.department?.name || null,
        components,
      });
    }

    const byLocation = Object.values(kitsByLocation);
    const equipTripItems = await prisma.tripPackingItem.findMany({
      where: { tripId, tier: 'equipment' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const typeBreakdown = {};
    for (const kit of trip.kits) {
      const tn = kit.type.name;
      typeBreakdown[tn] = (typeBreakdown[tn] || 0) + 1;
    }

    const equipment = {
      byLocation,
      tripItems: equipTripItems,
      summary: {
        totalKits: trip.kits.length,
        totalComponents: trip.kits.reduce((sum, k) => sum + (k.type.components?.length || 0), 0),
        locationCount: byLocation.length,
        kitTypeBreakdown: typeBreakdown,
      },
    };

    // ── Build Personal Section ──
    const personalTripItems = await prisma.tripPackingItem.findMany({
      where: { tripId, tier: 'personal' },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const allTemplates = await prisma.packingTemplate.findMany();
    const defaultTemplates = allTemplates.filter(t => t.isDefault);

    // Group personnel by role
    const roleMap = {};
    for (const p of trip.personnel) {
      const role = p.role;
      if (!roleMap[role]) roleMap[role] = [];
      roleMap[role].push(p);
    }

    const ROLE_NAMES = {
      director: 'Director', manager: 'Manager', 'senior-spec': 'Senior Specialist',
      specialist: 'Specialist', engineer: 'Engineer', lead: 'Lead', other: 'Other',
    };

    const byRole = Object.entries(roleMap).map(([role, members]) => {
      // Find default templates for this role
      const roleTemplates = defaultTemplates.filter(t => t.role === role);
      // Get trip items for this role and "all" scope
      const roleItems = personalTripItems.filter(i => i.scope === role || i.scope === 'all');

      // Merge template items and trip-specific items
      const templateItems = [];
      for (const tpl of roleTemplates) {
        const items = tpl.items || [];
        items.forEach((item, idx) => {
          templateItems.push({
            ...item,
            source: 'template',
            templateId: tpl.id,
            templateName: tpl.name,
            itemIndex: idx,
            itemKey: `template:${tpl.id}:${idx}`,
          });
        });
      }

      const tripSpecificItems = roleItems.map(item => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        notes: item.notes,
        required: item.required,
        category: item.category,
        source: 'trip',
        itemKey: `trip:${item.id}`,
      }));

      // Group all items by category
      const allItems = [...templateItems, ...tripSpecificItems];
      const byCategory = {};
      for (const item of allItems) {
        const cat = item.category || 'general';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
      }

      return {
        role,
        roleName: ROLE_NAMES[role] || role,
        personnel: members.map(m => ({
          userId: m.user.id,
          name: m.user.name,
          title: m.user.title,
          dept: m.user.deptId,
        })),
        items: allItems,
        itemsByCategory: byCategory,
        templateIds: roleTemplates.map(t => t.id),
      };
    });

    // Build byPerson
    const byPerson = trip.personnel.map(p => {
      const role = p.role;
      const roleTemplates = defaultTemplates.filter(t => t.role === role);

      const items = [];
      // Template items
      for (const tpl of roleTemplates) {
        (tpl.items || []).forEach((item, idx) => {
          items.push({
            ...item,
            source: 'template',
            templateId: tpl.id,
            templateName: tpl.name,
            itemIndex: idx,
            itemKey: `template:${tpl.id}:${idx}`,
          });
        });
      }

      // Trip items: role-scoped, "all"-scoped, and user-specific
      const userTripItems = personalTripItems.filter(
        i => i.scope === role || i.scope === 'all' || i.scope === p.user.id
      );
      for (const item of userTripItems) {
        items.push({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          notes: item.notes,
          required: item.required,
          category: item.category,
          source: 'trip',
          itemKey: `trip:${item.id}`,
        });
      }

      return {
        user: { id: p.user.id, name: p.user.name, title: p.user.title, tripRole: role },
        items,
        progress: { checked: 0, total: items.length },
      };
    });

    // Get check states for the requesting user
    const checks = await prisma.tripPackingCheck.findMany({
      where: { tripId, userId: req.user.id },
    });
    const checkMap = {};
    for (const c of checks) {
      checkMap[c.itemKey] = c.checked;
    }

    // Update byPerson progress with check data
    for (const person of byPerson) {
      if (person.user.id === req.user.id) {
        const checkedCount = person.items.filter(i => checkMap[i.itemKey]).length;
        person.progress = { checked: checkedCount, total: person.items.length };
      }
    }

    // Also get all checks for all users (for equipment tab progress)
    const allChecks = await prisma.tripPackingCheck.findMany({
      where: { tripId },
    });
    const allCheckMap = {};
    for (const c of allChecks) {
      if (!allCheckMap[c.userId]) allCheckMap[c.userId] = {};
      allCheckMap[c.userId][c.itemKey] = c.checked;
    }

    return res.json({
      equipment,
      personal: { byRole, byPerson },
      checks: checkMap,
      allChecks: allCheckMap,
    });
  } catch (err) {
    console.error('Get packing list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:tripId/packing/items - add trip-specific item(s)
packingRouter.post('/:tripId/packing/items', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId } = req.params;
    const { tier, scope, category, name, quantity, notes, required, sortOrder } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const item = await prisma.tripPackingItem.create({
      data: {
        tripId,
        tier: tier || 'personal',
        scope: scope || 'all',
        category: category || 'general',
        name: name.trim(),
        quantity: quantity || 1,
        notes: notes?.trim() || null,
        required: required !== undefined ? required : true,
        sortOrder: sortOrder ?? 0,
      },
    });

    await auditLog('packing_item_create', 'trip', tripId, req.user.id, { itemId: item.id, name: item.name, tier: item.tier });
    return res.status(201).json(item);
  } catch (err) {
    console.error('Create packing item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:tripId/packing/items/:id - update a trip packing item
packingRouter.put('/:tripId/packing/items/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId, id } = req.params;
    const { name, quantity, notes, required, category, scope, sortOrder } = req.body;

    const existing = await prisma.tripPackingItem.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (quantity !== undefined) data.quantity = quantity;
    if (notes !== undefined) data.notes = notes?.trim() || null;
    if (required !== undefined) data.required = required;
    if (category !== undefined) data.category = category;
    if (scope !== undefined) data.scope = scope;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    const item = await prisma.tripPackingItem.update({ where: { id }, data });
    await auditLog('packing_item_update', 'trip', tripId, req.user.id, { itemId: id, changes: Object.keys(data) });
    return res.json(item);
  } catch (err) {
    console.error('Update packing item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:tripId/packing/items/:id - delete a trip packing item
packingRouter.delete('/:tripId/packing/items/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId, id } = req.params;

    const existing = await prisma.tripPackingItem.findUnique({ where: { id } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Item not found' });
    }

    await prisma.tripPackingItem.delete({ where: { id } });
    await auditLog('packing_item_delete', 'trip', tripId, req.user.id, { itemId: id, name: existing.name });
    return res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error('Delete packing item error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:tripId/packing/items/bulk - bulk add items
packingRouter.post('/:tripId/packing/items/bulk', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId } = req.params;
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const created = [];
    for (const item of items) {
      if (!item.name?.trim()) continue;
      const record = await prisma.tripPackingItem.create({
        data: {
          tripId,
          tier: item.tier || 'personal',
          scope: item.scope || 'all',
          category: item.category || 'general',
          name: item.name.trim(),
          quantity: item.quantity || 1,
          notes: item.notes?.trim() || null,
          required: item.required !== undefined ? item.required : true,
          sortOrder: item.sortOrder ?? 0,
        },
      });
      created.push(record);
    }

    await auditLog('packing_items_bulk_create', 'trip', tripId, req.user.id, { count: created.length });
    return res.json(created);
  } catch (err) {
    console.error('Bulk create packing items error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:tripId/packing/check - toggle check state for current user
packingRouter.put('/:tripId/packing/check', async (req, res) => {
  try {
    const { tripId } = req.params;
    const { itemKey, checked } = req.body;

    if (!itemKey) {
      return res.status(400).json({ error: 'itemKey is required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const result = await prisma.tripPackingCheck.upsert({
      where: {
        tripId_userId_itemKey: {
          tripId,
          userId: req.user.id,
          itemKey,
        },
      },
      update: {
        checked: checked ?? true,
        checkedAt: checked ? new Date() : null,
      },
      create: {
        tripId,
        userId: req.user.id,
        itemKey,
        checked: checked ?? true,
        checkedAt: checked ? new Date() : null,
      },
    });

    return res.json(result);
  } catch (err) {
    console.error('Update packing check error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:tripId/packing/my-checks - get current user's check states
packingRouter.get('/:tripId/packing/my-checks', async (req, res) => {
  try {
    const { tripId } = req.params;

    const checks = await prisma.tripPackingCheck.findMany({
      where: { tripId, userId: req.user.id },
    });

    const checkMap = {};
    for (const c of checks) {
      checkMap[c.itemKey] = c.checked;
    }

    return res.json(checkMap);
  } catch (err) {
    console.error('Get my checks error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
