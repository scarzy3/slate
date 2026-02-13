import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requirePerm } from '../middleware/rbac.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

router.use(authMiddleware);

const templateIncludes = {
  createdBy: { select: { id: true, name: true } },
};

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
  boats: { include: { boat: true } },
  personnel: {
    include: {
      user: { select: { id: true, name: true, title: true, role: true, deptId: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  notes: {
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  },
  tasks: {
    select: {
      id: true, title: true, phase: true, priority: true, status: true, sortOrder: true,
      dueDate: true, completedAt: true,
      assignedTo: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  },
  _count: { select: { reservations: true, personnel: true, boats: true, tasks: true, commsEntries: true } },
};

// GET / - list all templates
router.get('/', async (req, res) => {
  try {
    const templates = await prisma.tripTemplate.findMany({
      include: templateIncludes,
      orderBy: { name: 'asc' },
    });
    return res.json(templates);
  } catch (err) {
    console.error('List trip templates error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /:id - single template
router.get('/:id', async (req, res) => {
  try {
    const template = await prisma.tripTemplate.findUnique({
      where: { id: req.params.id },
      include: templateIncludes,
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    return res.json(template);
  } catch (err) {
    console.error('Get trip template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST / - create a template from scratch
router.post('/', requirePerm('trips'), async (req, res) => {
  try {
    const { name, description, location, objectives, personnelRoles, kitTypeRequirements, tasks, commsEntries, packingItems, phases, milestones } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const template = await prisma.tripTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        objectives: objectives?.trim() || null,
        personnelRoles: personnelRoles || null,
        kitTypeRequirements: kitTypeRequirements || null,
        tasks: tasks || null,
        commsEntries: commsEntries || null,
        packingItems: packingItems || null,
        phases: phases || null,
        milestones: milestones || null,
        createdById: req.user.id,
      },
      include: templateIncludes,
    });

    await auditLog('trip_template_create', 'trip_template', template.id, req.user.id, { name: template.name });
    return res.status(201).json(template);
  } catch (err) {
    console.error('Create trip template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /from-trip/:tripId - create a template from an existing trip
router.post('/from-trip/:tripId', requirePerm('trips'), async (req, res) => {
  try {
    const { tripId } = req.params;
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        personnel: true,
        tasks: true,
        commsEntries: true,
        packingItems: true,
        kits: { include: { type: { select: { id: true, name: true } } } },
        phases: true,
        milestones: true,
      },
    });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    // Extract personnel as role counts
    const roleCounts = {};
    for (const p of trip.personnel) {
      if (!roleCounts[p.role]) roleCounts[p.role] = { role: p.role, count: 0 };
      roleCounts[p.role].count++;
    }
    const personnelRoles = Object.values(roleCounts);

    // Extract kit assignments as type requirements
    const kitTypeCounts = {};
    for (const kit of trip.kits) {
      const typeId = kit.typeId;
      const typeName = kit.type?.name || 'Unknown';
      if (!kitTypeCounts[typeId]) kitTypeCounts[typeId] = { typeId, typeName, quantity: 0 };
      kitTypeCounts[typeId].quantity++;
    }
    const kitTypeRequirements = Object.values(kitTypeCounts);

    // Extract tasks as templates (no assignee)
    const tasks = trip.tasks.map(t => ({
      title: t.title,
      description: t.description || undefined,
      phase: t.phase,
      priority: t.priority,
      sortOrder: t.sortOrder,
    }));

    // Extract comms entries (no assignee)
    const commsEntries = trip.commsEntries.map(c => ({
      type: c.type,
      label: c.label,
      value: c.value || undefined,
      notes: c.notes || undefined,
      sortOrder: c.sortOrder,
    }));

    // Extract packing items
    const packingItems = trip.packingItems.map(item => ({
      tier: item.tier,
      scope: item.scope,
      category: item.category,
      name: item.name,
      quantity: item.quantity,
      notes: item.notes || undefined,
      required: item.required,
      sortOrder: item.sortOrder,
    }));

    // Extract phases as day offsets relative to trip start
    const DAY_MS = 86400000;
    const tripStartMs = new Date(trip.startDate).getTime();
    const tripDuration = Math.max(1, Math.ceil((new Date(trip.endDate).getTime() - tripStartMs) / DAY_MS));
    const phaseTemplates = (trip.phases || []).map(p => ({
      name: p.name,
      startDayOffset: Math.round((new Date(p.startDate).getTime() - tripStartMs) / DAY_MS),
      endDayOffset: Math.round((new Date(p.endDate).getTime() - tripStartMs) / DAY_MS),
      color: p.color || undefined,
      notes: p.notes || undefined,
      sortOrder: p.sortOrder,
    }));

    // Extract milestones as day offsets
    const milestoneTemplates = (trip.milestones || []).map(m => ({
      name: m.name,
      dayOffset: Math.round((new Date(m.date).getTime() - tripStartMs) / DAY_MS),
      notes: m.notes || undefined,
      sortOrder: m.sortOrder,
    }));

    const template = await prisma.tripTemplate.create({
      data: {
        name: name.trim(),
        description: trip.description || null,
        location: trip.location || null,
        objectives: trip.objectives || null,
        personnelRoles: personnelRoles.length > 0 ? personnelRoles : null,
        kitTypeRequirements: kitTypeRequirements.length > 0 ? kitTypeRequirements : null,
        tasks: tasks.length > 0 ? tasks : null,
        commsEntries: commsEntries.length > 0 ? commsEntries : null,
        packingItems: packingItems.length > 0 ? packingItems : null,
        phases: phaseTemplates.length > 0 ? phaseTemplates : null,
        milestones: milestoneTemplates.length > 0 ? milestoneTemplates : null,
        createdById: req.user.id,
      },
      include: templateIncludes,
    });

    await auditLog('trip_template_from_trip', 'trip_template', template.id, req.user.id, {
      name: template.name, sourceTripId: tripId, sourceTripName: trip.name,
    });
    return res.status(201).json(template);
  } catch (err) {
    console.error('Create template from trip error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id - update a template
router.put('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, location, objectives, personnelRoles, kitTypeRequirements, tasks, commsEntries, packingItems, phases, milestones } = req.body;

    const existing = await prisma.tripTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (location !== undefined) data.location = location?.trim() || null;
    if (objectives !== undefined) data.objectives = objectives?.trim() || null;
    if (personnelRoles !== undefined) data.personnelRoles = personnelRoles;
    if (kitTypeRequirements !== undefined) data.kitTypeRequirements = kitTypeRequirements;
    if (tasks !== undefined) data.tasks = tasks;
    if (commsEntries !== undefined) data.commsEntries = commsEntries;
    if (packingItems !== undefined) data.packingItems = packingItems;
    if (phases !== undefined) data.phases = phases;
    if (milestones !== undefined) data.milestones = milestones;

    const template = await prisma.tripTemplate.update({
      where: { id },
      data,
      include: templateIncludes,
    });

    await auditLog('trip_template_update', 'trip_template', id, req.user.id, { changes: Object.keys(data) });
    return res.json(template);
  } catch (err) {
    console.error('Update trip template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /:id - delete a template
router.delete('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.tripTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.tripTemplate.delete({ where: { id } });
    await auditLog('trip_template_delete', 'trip_template', id, req.user.id, { name: existing.name });
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete trip template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /:id/apply - create a new trip from a template
router.post('/:id/apply', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate, location, leadId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Trip name is required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date' });
    }

    const template = await prisma.tripTemplate.findUnique({ where: { id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Create trip
    const newTrip = await prisma.trip.create({
      data: {
        name: name.trim(),
        description: template.description || null,
        location: location !== undefined ? (location?.trim() || null) : (template.location || null),
        objectives: template.objectives || null,
        leadId: leadId || null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: 'planning',
      },
    });

    // If lead assigned, also add them as personnel
    if (leadId) {
      try {
        await prisma.tripPersonnel.create({
          data: { tripId: newTrip.id, userId: leadId, role: 'lead' },
        });
      } catch { /* already exists */ }
    }

    // Create tasks from template
    const templateTasks = template.tasks || [];
    for (const t of templateTasks) {
      await prisma.tripTask.create({
        data: {
          tripId: newTrip.id,
          title: t.title,
          description: t.description || null,
          phase: t.phase || 'pre-deployment',
          priority: t.priority || 'medium',
          sortOrder: t.sortOrder ?? 0,
        },
      });
    }

    // Create comms entries from template
    const templateComms = template.commsEntries || [];
    for (const c of templateComms) {
      await prisma.tripCommsEntry.create({
        data: {
          tripId: newTrip.id,
          type: c.type || 'radio_channel',
          label: c.label,
          value: c.value || '',
          notes: c.notes || null,
          sortOrder: c.sortOrder ?? 0,
        },
      });
    }

    // Create packing items from template
    const templatePacking = template.packingItems || [];
    for (const item of templatePacking) {
      await prisma.tripPackingItem.create({
        data: {
          tripId: newTrip.id,
          tier: item.tier || 'personal',
          scope: item.scope || 'all',
          category: item.category || 'general',
          name: item.name,
          quantity: item.quantity || 1,
          notes: item.notes || null,
          required: item.required !== undefined ? item.required : true,
          sortOrder: item.sortOrder ?? 0,
        },
      });
    }

    // Create phases from template (day offsets -> absolute dates)
    const DAY_MS = 86400000;
    const newStartMs = new Date(startDate).getTime();
    const templatePhases = template.phases || [];
    for (const p of templatePhases) {
      await prisma.tripPhase.create({
        data: {
          tripId: newTrip.id,
          name: p.name,
          startDate: new Date(newStartMs + (p.startDayOffset || 0) * DAY_MS),
          endDate: new Date(newStartMs + (p.endDayOffset || 1) * DAY_MS),
          color: p.color || null,
          notes: p.notes || null,
          sortOrder: p.sortOrder ?? 0,
        },
      });
    }

    // Create milestones from template (day offsets -> absolute dates)
    const templateMilestones = template.milestones || [];
    for (const m of templateMilestones) {
      await prisma.tripMilestone.create({
        data: {
          tripId: newTrip.id,
          name: m.name,
          date: new Date(newStartMs + (m.dayOffset || 0) * DAY_MS),
          notes: m.notes || null,
          sortOrder: m.sortOrder ?? 0,
        },
      });
    }

    // Return new trip with full includes
    const result = await prisma.trip.findUnique({
      where: { id: newTrip.id },
      include: tripIncludes,
    });

    await auditLog('trip_from_template', 'trip', newTrip.id, req.user.id, {
      templateId: id, templateName: template.name, name: result.name,
      tasks: templateTasks.length, comms: templateComms.length, packingItems: templatePacking.length,
      phases: templatePhases.length, milestones: templateMilestones.length,
    });
    return res.status(201).json(result);
  } catch (err) {
    console.error('Apply trip template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
