import { PrismaClient } from '@prisma/client';
import { Router } from 'express';
import { authMiddleware, requireApproved } from '../middleware/auth.js';
import { auditLog } from '../utils/auditLogger.js';
import { getIO } from '../socket.js';

const prisma = new PrismaClient();
const router = Router();

// Role hierarchy for permission checks — directors (4), engineers/MOE (4), managers (3)
const ROLE_LEVEL = { developer: 5, director: 4, super: 4, engineer: 4, manager: 3, admin: 3, lead: 2, user: 1 };
const APPROVAL_MIN_LEVEL = ROLE_LEVEL.manager; // manager, engineer, director can approve

/**
 * Middleware: require the user to be an approver (manager, engineer, or director)
 */
function requireApprovalRole(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const level = ROLE_LEVEL[req.user.role] || 0;
  if (level < APPROVAL_MIN_LEVEL) {
    return res.status(403).json({ error: 'Only directors, engineers, and managers can manage user approvals' });
  }
  next();
}

// All approval routes require auth + approved status + manager+ role
router.use(authMiddleware, requireApproved, requireApprovalRole);

// GET / - list users by approval status
// Query params: ?status=pending (default), ?status=all, ?status=approved, ?status=denied
router.get('/', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    const where = status === 'all' ? {} : { approvalStatus: status };

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        title: true,
        role: true,
        deptId: true,
        approvalStatus: true,
        approvedById: true,
        approvedAt: true,
        denialReason: true,
        createdAt: true,
        approvedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(users);
  } catch (err) {
    console.error('List approval users error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /count - get count of pending approvals (for badge display)
router.get('/count', async (req, res) => {
  try {
    const count = await prisma.user.count({ where: { approvalStatus: 'pending' } });
    return res.json({ count });
  } catch (err) {
    console.error('Approval count error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/approve - approve a pending user and set their role/department
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, deptId } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.approvalStatus === 'approved') {
      return res.status(400).json({ error: 'User is already approved' });
    }

    // Validate the role if provided
    const validRoles = ['user', 'lead', 'manager', 'engineer', 'director'];
    const assignedRole = role && validRoles.includes(role) ? role : 'user';

    // Approvers cannot assign a role higher than their own
    const approverLevel = ROLE_LEVEL[req.user.role] || 0;
    const targetLevel = ROLE_LEVEL[assignedRole] || 0;
    if (targetLevel > approverLevel) {
      return res.status(403).json({ error: 'Cannot assign a role higher than your own' });
    }

    const data = {
      approvalStatus: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date(),
      role: assignedRole,
      denialReason: null,
    };

    // Optionally assign department
    if (deptId !== undefined) {
      if (deptId === null || deptId === '') {
        data.deptId = null;
      } else {
        const dept = await prisma.department.findUnique({ where: { id: deptId } });
        if (!dept) {
          return res.status(400).json({ error: 'Department not found' });
        }
        data.deptId = deptId;
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true, name: true, email: true, title: true, role: true,
        deptId: true, approvalStatus: true, approvedAt: true,
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await auditLog('user_approved', 'user', id, req.user.id, {
      name: target.name,
      email: target.email,
      assignedRole,
      deptId: data.deptId || null,
    });

    // Emit real-time update
    try {
      const io = getIO();
      io.emit('update:approvals', { type: 'approved', userId: id });
      io.emit('update:personnel');
    } catch { /* socket not initialized */ }

    return res.json(updated);
  } catch (err) {
    console.error('Approve user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/deny - deny a pending user
router.put('/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (target.approvalStatus === 'denied') {
      return res.status(400).json({ error: 'User is already denied' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        approvalStatus: 'denied',
        approvedById: req.user.id,
        approvedAt: new Date(),
        denialReason: reason || null,
      },
      select: {
        id: true, name: true, email: true, title: true,
        approvalStatus: true, denialReason: true, approvedAt: true,
        approvedBy: { select: { id: true, name: true } },
      },
    });

    await auditLog('user_denied', 'user', id, req.user.id, {
      name: target.name,
      email: target.email,
      reason: reason || null,
    });

    // Emit real-time update
    try {
      const io = getIO();
      io.emit('update:approvals', { type: 'denied', userId: id });
    } catch { /* socket not initialized */ }

    return res.json(updated);
  } catch (err) {
    console.error('Deny user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /:id/revoke - revoke an approved user's access (set back to denied)
router.put('/:id/revoke', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Cannot revoke directors/engineers unless you're also a director
    const targetLevel = ROLE_LEVEL[target.role] || 0;
    const approverLevel = ROLE_LEVEL[req.user.role] || 0;
    if (targetLevel >= approverLevel && req.user.id !== target.id) {
      return res.status(403).json({ error: 'Cannot revoke access for a user at or above your role level' });
    }

    // Cannot revoke your own access
    if (req.user.id === id) {
      return res.status(400).json({ error: 'Cannot revoke your own access' });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        approvalStatus: 'denied',
        approvedById: req.user.id,
        approvedAt: new Date(),
        denialReason: reason || 'Access revoked',
      },
      select: {
        id: true, name: true, email: true,
        approvalStatus: true, denialReason: true,
      },
    });

    await auditLog('user_revoked', 'user', id, req.user.id, {
      name: target.name,
      email: target.email,
      reason: reason || 'Access revoked',
    });

    try {
      const io = getIO();
      io.emit('update:approvals', { type: 'revoked', userId: id });
      io.emit('update:personnel');
    } catch { /* socket not initialized */ }

    return res.json(updated);
  } catch (err) {
    console.error('Revoke user error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
