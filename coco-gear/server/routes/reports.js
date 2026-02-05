import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireAdminPerm } from '../middleware/rbac.js';

const prisma = new PrismaClient();
const router = Router();

// GET /fleet - fleet status data
router.get('/fleet', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const kits = await prisma.kit.findMany({
      include: {
        type: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, shortCode: true } },
        department: { select: { id: true, name: true } },
        issuedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const data = kits.map(kit => ({
      kitId: kit.id,
      type: kit.type.name,
      color: kit.color,
      location: kit.location.name,
      locationCode: kit.location.shortCode,
      department: kit.department?.name || '',
      status: kit.issuedToId ? 'Checked Out' : kit.maintenanceStatus ? `Maintenance (${kit.maintenanceStatus})` : 'Available',
      issuedTo: kit.issuedTo?.name || '',
      lastChecked: kit.lastChecked,
      createdAt: kit.createdAt,
    }));

    return res.json({ report: 'fleet', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Fleet report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /checkouts - checkout/return history with date filters
router.get('/checkouts', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};

    if (from || to) {
      where.issuedDate = {};
      if (from) where.issuedDate.gte = new Date(from);
      if (to) where.issuedDate.lte = new Date(to);
    }

    const history = await prisma.issueHistory.findMany({
      where,
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { name: true } },
          },
        },
        person: { select: { id: true, name: true, title: true } },
        issuedBy: { select: { id: true, name: true } },
      },
      orderBy: { issuedDate: 'desc' },
    });

    const data = history.map(h => ({
      historyId: h.id,
      kitId: h.kitId,
      kitType: h.kit.type.name,
      kitColor: h.kit.color,
      person: h.person.name,
      personTitle: h.person.title || '',
      issuedBy: h.issuedBy.name,
      issuedDate: h.issuedDate,
      returnedDate: h.returnedDate,
      durationHours: h.returnedDate
        ? Math.round((new Date(h.returnedDate) - new Date(h.issuedDate)) / 3600000 * 10) / 10
        : null,
    }));

    return res.json({ report: 'checkouts', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Checkouts report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /inspections - inspection history
router.get('/inspections', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const { from, to } = req.query;
    const where = {};

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(from);
      if (to) where.date.lte = new Date(to);
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        kit: {
          select: {
            id: true,
            color: true,
            type: { select: { name: true } },
          },
        },
        results: {
          include: {
            component: { select: { key: true, label: true } },
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    const data = inspections.map(insp => {
      const total = insp.results.length;
      const good = insp.results.filter(r => r.status === 'GOOD').length;
      const missing = insp.results.filter(r => r.status === 'MISSING').length;
      const damaged = insp.results.filter(r => r.status === 'DAMAGED').length;

      return {
        inspectionId: insp.id,
        kitId: insp.kitId,
        kitType: insp.kit.type.name,
        kitColor: insp.kit.color,
        inspector: insp.inspector || '',
        date: insp.date,
        totalComponents: total,
        good,
        missing,
        damaged,
        passRate: total > 0 ? Math.round((good / total) * 100) : 100,
        notes: insp.notes || '',
      };
    });

    return res.json({ report: 'inspections', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Inspections report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /personnel - personnel stats
router.get('/personnel', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        title: true,
        role: true,
        department: { select: { name: true } },
        _count: {
          select: {
            kitCheckouts: true,
            kitsIssued: true,
            reservations: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = users.map(u => ({
      userId: u.id,
      name: u.name,
      title: u.title || '',
      role: u.role,
      department: u.department?.name || '',
      totalCheckouts: u._count.kitCheckouts,
      currentlyHolding: u._count.kitsIssued,
      totalReservations: u._count.reservations,
    }));

    return res.json({ report: 'personnel', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Personnel report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /components - component health
router.get('/components', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const components = await prisma.component.findMany({
      include: {
        kitComponentStatuses: true,
        _count: { select: { kitTypeComponents: true } },
      },
      orderBy: { label: 'asc' },
    });

    const data = components.map(c => {
      const statuses = c.kitComponentStatuses;
      const total = statuses.length;
      const good = statuses.filter(s => s.status === 'GOOD').length;
      const missing = statuses.filter(s => s.status === 'MISSING').length;
      const damaged = statuses.filter(s => s.status === 'DAMAGED').length;

      return {
        componentId: c.id,
        key: c.key,
        label: c.label,
        category: c.category,
        serialized: c.serialized,
        calibrationRequired: c.calibrationRequired,
        usedInTypes: c._count.kitTypeComponents,
        totalInstances: total,
        good,
        missing,
        damaged,
        healthPercent: total > 0 ? Math.round((good / total) * 100) : 100,
      };
    });

    return res.json({ report: 'components', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Components report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /departments - department summary
router.get('/departments', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        head: { select: { id: true, name: true } },
        _count: { select: { members: true, kits: true } },
        kits: {
          select: {
            issuedToId: true,
            maintenanceStatus: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = departments.map(d => {
      const totalKits = d.kits.length;
      const checkedOut = d.kits.filter(k => k.issuedToId !== null).length;
      const inMaintenance = d.kits.filter(k => k.maintenanceStatus !== null).length;
      const available = totalKits - checkedOut - inMaintenance;

      return {
        departmentId: d.id,
        name: d.name,
        color: d.color,
        head: d.head?.name || '',
        memberCount: d._count.members,
        totalKits,
        available,
        checkedOut,
        inMaintenance,
        utilizationPercent: totalKits > 0 ? Math.round((checkedOut / totalKits) * 100) : 0,
      };
    });

    return res.json({ report: 'departments', generated: new Date(), count: data.length, data });
  } catch (err) {
    console.error('Departments report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /custody/:kitId - chain of custody for specific kit
router.get('/custody/:kitId', authMiddleware, requireAdminPerm('reports'), async (req, res) => {
  try {
    const { kitId } = req.params;

    const kit = await prisma.kit.findUnique({
      where: { id: kitId },
      include: {
        type: { select: { name: true } },
        location: { select: { name: true } },
        issuedTo: { select: { id: true, name: true } },
      },
    });

    if (!kit) {
      return res.status(404).json({ error: 'Kit not found' });
    }

    const history = await prisma.issueHistory.findMany({
      where: { kitId },
      include: {
        person: { select: { id: true, name: true, title: true } },
        issuedBy: { select: { id: true, name: true } },
      },
      orderBy: { issuedDate: 'asc' },
    });

    const inspections = await prisma.inspection.findMany({
      where: { kitId },
      select: {
        id: true,
        inspector: true,
        date: true,
        notes: true,
      },
      orderBy: { date: 'asc' },
    });

    const maintenance = await prisma.maintenanceHistory.findMany({
      where: { kitId },
      include: {
        startedBy: { select: { id: true, name: true } },
        completedBy: { select: { id: true, name: true } },
      },
      orderBy: { startDate: 'asc' },
    });

    // Build unified timeline
    const timeline = [];

    for (const h of history) {
      timeline.push({
        type: 'checkout',
        date: h.issuedDate,
        person: h.person.name,
        personTitle: h.person.title || '',
        issuedBy: h.issuedBy.name,
        returnedDate: h.returnedDate,
      });
      if (h.returnedDate) {
        timeline.push({
          type: 'return',
          date: h.returnedDate,
          person: h.person.name,
        });
      }
    }

    for (const i of inspections) {
      timeline.push({
        type: 'inspection',
        date: i.date,
        inspector: i.inspector || '',
        notes: i.notes || '',
      });
    }

    for (const m of maintenance) {
      timeline.push({
        type: 'maintenance_start',
        date: m.startDate,
        maintenanceType: m.type,
        reason: m.reason || '',
        startedBy: m.startedBy.name,
      });
      if (m.endDate) {
        timeline.push({
          type: 'maintenance_end',
          date: m.endDate,
          maintenanceType: m.type,
          completedBy: m.completedBy?.name || '',
        });
      }
    }

    // Sort timeline chronologically
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    return res.json({
      report: 'custody',
      generated: new Date(),
      kit: {
        id: kit.id,
        type: kit.type.name,
        color: kit.color,
        location: kit.location.name,
        currentHolder: kit.issuedTo?.name || null,
        maintenanceStatus: kit.maintenanceStatus,
      },
      timeline,
    });
  } catch (err) {
    console.error('Custody report error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
