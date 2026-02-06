import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Role hierarchy: director > manager > lead > user
// Backwards compat: super → director, admin → manager
const ROLE_LEVEL = { director: 4, super: 4, engineer: 4, manager: 3, admin: 3, lead: 2, user: 1 };

/**
 * Require minimum role level
 * @param {'user'|'lead'|'manager'|'director'} minRole
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
 * Require director (top-level access - settings, audit, system config)
 */
export function requireDirector(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const level = ROLE_LEVEL[req.user.role] || 0;
  if (level < ROLE_LEVEL.director) {
    return res.status(403).json({ error: 'Director access required' });
  }
  next();
}

// Legacy alias
export const requireSuper = requireDirector;

/**
 * Require manager or above, respecting adminPerms settings
 * @param {string} perm - the permission key (e.g., 'analytics', 'maintenance')
 */
export function requireAdminPerm(perm) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const level = ROLE_LEVEL[req.user.role] || 0;

    // Director always has access
    if (level >= ROLE_LEVEL.director) return next();

    // Must be manager at minimum
    if (level < ROLE_LEVEL.manager) {
      return res.status(403).json({ error: 'Manager access required' });
    }

    // Check adminPerms setting for managers
    if (perm) {
      try {
        const setting = await prisma.systemSetting.findUnique({ where: { key: 'adminPerms' } });
        if (setting && setting.value && setting.value[perm] === false) {
          return res.status(403).json({ error: 'Permission disabled' });
        }
      } catch {
        // if settings don't exist yet, allow by default
      }
    }

    next();
  };
}

/**
 * Check if user is an approver (dept head or lead+)
 */
export function requireApprover(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const level = ROLE_LEVEL[req.user.role] || 0;
  if (level >= ROLE_LEVEL.lead) return next();
  // Department heads will be checked in the route handler
  req.isApproverCheck = true;
  next();
}
