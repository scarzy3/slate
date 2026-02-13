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

const taskSelect = {
  id: true,
  tripId: true,
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
  updatedAt: true,
  assignedTo: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
};

// ─── Trip Task Routes (mounted under /api/trips) ───
export const taskRouter = Router();
taskRouter.use(authMiddleware);

// GET /api/trips/:tripId/tasks - list all tasks for a trip, grouped by phase
taskRouter.get('/:tripId/tasks', requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    const tasks = await prisma.tripTask.findMany({
      where: { tripId },
      select: taskSelect,
      orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    const grouped = {
      'pre-deployment': tasks.filter(t => t.phase === 'pre-deployment'),
      'deployment': tasks.filter(t => t.phase === 'deployment'),
      'post-deployment': tasks.filter(t => t.phase === 'post-deployment'),
    };

    return res.json(grouped);
  } catch (err) {
    console.error('List tasks error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/tasks - create a task
taskRouter.post('/:tripId/tasks', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { title, description, assignedToId, phase, priority, dueDate, sortOrder } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot add tasks to a ' + trip.status + ' trip' });
    }

    const task = await prisma.tripTask.create({
      data: {
        tripId,
        title: title.trim(),
        description: description?.trim() || null,
        assignedToId: assignedToId || null,
        phase: phase || 'pre-deployment',
        priority: priority || 'medium',
        dueDate: dueDate ? new Date(dueDate) : null,
        sortOrder: sortOrder ?? 0,
      },
      select: taskSelect,
    });

    await auditLog('task_create', 'trip', tripId, req.user.id, { taskId: task.id, title: task.title, phase: task.phase });
    return res.status(201).json(task);
  } catch (err) {
    console.error('Create task error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/trips/:tripId/tasks/:taskId - update a task (SEC-015 fix: added requirePerm)
taskRouter.put('/:tripId/tasks/:taskId', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, taskId } = req.params;
    const { title, description, assignedToId, phase, priority, status, dueDate, sortOrder } = req.body;

    const existing = await prisma.tripTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (phase !== undefined) data.phase = phase;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (sortOrder !== undefined) data.sortOrder = sortOrder;

    if (status !== undefined) {
      data.status = status;
      if (status === 'done' && existing.status !== 'done') {
        data.completedAt = new Date();
        data.completedById = req.user.id;
      }
      if (status !== 'done' && existing.status === 'done') {
        data.completedAt = null;
        data.completedById = null;
      }
    }

    const task = await prisma.tripTask.update({
      where: { id: taskId },
      data,
      select: taskSelect,
    });

    await auditLog('task_update', 'trip', tripId, req.user.id, { taskId, changes: Object.keys(data) });
    return res.json(task);
  } catch (err) {
    console.error('Update task error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/trips/:tripId/tasks/:taskId - delete a task
taskRouter.delete('/:tripId/tasks/:taskId', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId, taskId } = req.params;

    const existing = await prisma.tripTask.findUnique({ where: { id: taskId } });
    if (!existing || existing.tripId !== tripId) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.tripTask.delete({ where: { id: taskId } });
    await auditLog('task_delete', 'trip', tripId, req.user.id, { taskId, title: existing.title });
    return res.json({ message: 'Task deleted' });
  } catch (err) {
    console.error('Delete task error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/tasks/reorder - reorder tasks within a phase
taskRouter.post('/:tripId/tasks/reorder', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds) || !taskIds.length) {
      return res.status(400).json({ error: 'taskIds array required' });
    }

    for (let i = 0; i < taskIds.length; i++) {
      await prisma.tripTask.updateMany({
        where: { id: taskIds[i], tripId },
        data: { sortOrder: i },
      });
    }

    return res.json({ message: 'Tasks reordered' });
  } catch (err) {
    console.error('Reorder tasks error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/trips/:tripId/tasks/from-template - create tasks from a template
taskRouter.post('/:tripId/tasks/from-template', requirePerm('trips'), requireTripAccess, async (req, res) => {
  try {
    const { tripId } = req.params;
    const { templateId } = req.body;

    if (!templateId) {
      return res.status(400).json({ error: 'templateId required' });
    }

    const trip = await prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) return res.status(404).json({ error: 'Trip not found' });

    if (trip.status === 'completed' || trip.status === 'cancelled') {
      return res.status(409).json({ error: 'Cannot add tasks to a ' + trip.status + ' trip' });
    }

    const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const templateTasks = template.tasks || [];
    const created = [];

    for (const t of templateTasks) {
      const task = await prisma.tripTask.create({
        data: {
          tripId,
          title: t.title,
          description: t.description || null,
          phase: t.phase || 'pre-deployment',
          priority: t.priority || 'medium',
          sortOrder: t.sortOrder ?? 0,
        },
        select: taskSelect,
      });
      created.push(task);
    }

    await auditLog('task_from_template', 'trip', tripId, req.user.id, { templateId, templateName: template.name, count: created.length });
    return res.json(created);
  } catch (err) {
    console.error('Tasks from template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Task Template Routes (mounted under /api/task-templates) ───
export const templateRouter = Router();
templateRouter.use(authMiddleware);

// GET /api/task-templates - list all templates
templateRouter.get('/', async (req, res) => {
  try {
    const templates = await prisma.taskTemplate.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(templates);
  } catch (err) {
    console.error('List templates error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/task-templates - create a template
templateRouter.post('/', requirePerm('trips'), async (req, res) => {
  try {
    const { name, description, tasks } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const template = await prisma.taskTemplate.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        tasks: tasks || [],
      },
    });

    return res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/task-templates/:id - update a template
templateRouter.put('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, tasks } = req.body;

    const existing = await prisma.taskTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (tasks !== undefined) data.tasks = tasks;

    const template = await prisma.taskTemplate.update({
      where: { id },
      data,
    });

    return res.json(template);
  } catch (err) {
    console.error('Update template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/task-templates/:id - delete a template
templateRouter.delete('/:id', requirePerm('trips'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.taskTemplate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    await prisma.taskTemplate.delete({ where: { id } });
    return res.json({ message: 'Template deleted' });
  } catch (err) {
    console.error('Delete template error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
