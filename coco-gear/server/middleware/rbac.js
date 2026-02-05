import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Role hierarchy: super > admin > user
const ROLE_LEVEL = { super: 3, admin: 2, user: 1 };

/**
 * Require minimum role level
 * @param {'user'|'admin'|'super'} minRole
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    const userLevel = ROLE_LEVEL[req.user.role] || 0;
    const required = ROLE_LEVEL[minRole] || 0;
    if (userLevel < required) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Require super admin
 */
export function requireSuper(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'super') {
    return res.status(403).json({ error: 'Super admin required' });
  }
  next();
}

/**
 * Require admin or super, respecting adminPerms settings
 * @param {string} perm - the admin permission key (e.g., 'analytics', 'maintenance')
 */
export function requireAdminPerm(perm) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    // Super always has access
    if (req.user.role === 'super') return next();

    // Must be admin at minimum
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Check adminPerms setting
    if (perm) {
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'adminPerms' } });
        if (setting && setting.value && setting.value[perm] === false) {
          return res.status(403).json({ error: 'Permission disabled for admins' });
        }
      } catch {
        // if settings don't exist yet, allow by default
      }
    }

    next();
  };
}

/**
 * Check if user is the approver (dept head or super/admin)
 */
export function requireApprover(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'super' || req.user.role === 'admin') return next();
  // Department heads will be checked in the route handler
  req.isApproverCheck = true;
  next();
}
