import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Role hierarchy: developer > director > manager > lead > user
// Backwards compat: super → director, admin → manager
const ROLE_LEVEL = { developer: 5, director: 4, super: 4, engineer: 4, manager: 3, admin: 3, lead: 2, user: 1 };

// Normalize legacy role names
function normalizeRole(role) {
  if (role === 'admin') return 'manager';
  if (role === 'super' || role === 'engineer') return 'director';
  return role;
}

// Default per-role permissions (what each role can do out of the box)
// Directors always have full access and aren't listed here
export const DEFAULT_ROLE_PERMS = {
  lead: {
    trips: true,
    maintenance: false,
    consumables: false,
    analytics: false,
    reports: false,
    types: false,
    components: false,
    locations: false,
    departments: false,
    personnel: false,
    boats: false,
  },
  manager: {
    trips: true,
    maintenance: true,
    consumables: true,
    analytics: true,
    reports: true,
    types: true,
    components: true,
    locations: true,
    departments: true,
    personnel: true,
    boats: true,
  },
};

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
 * Require a specific permission, checked against rolePerms settings.
 * Directors always have access. For leads/managers, checks the rolePerms
 * setting (falls back to DEFAULT_ROLE_PERMS if no setting configured).
 * @param {string} perm - the permission key (e.g., 'trips', 'analytics', 'maintenance')
 */
export function requirePerm(perm) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const level = ROLE_LEVEL[req.user.role] || 0;

    // Directors+ always have access
    if (level >= ROLE_LEVEL.director) return next();

    // Must be at least lead to have configurable permissions
    if (level < ROLE_LEVEL.lead) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    const role = normalizeRole(req.user.role);

    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'rolePerms' } });
      const perms = setting?.value?.[role];

      if (perms && perm in perms) {
        return perms[perm]
          ? next()
          : res.status(403).json({ error: 'Permission disabled for your role' });
      }

      // Fall back to defaults
      const defaults = DEFAULT_ROLE_PERMS[role];
      if (defaults && perm in defaults) {
        return defaults[perm]
          ? next()
          : res.status(403).json({ error: 'Insufficient permissions' });
      }

      return res.status(403).json({ error: 'Insufficient permissions' });
    } catch {
      // DB error — fall back to defaults
      const defaults = DEFAULT_ROLE_PERMS[role];
      if (defaults?.[perm]) return next();
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
  };
}

/**
 * Require manager or above, respecting adminPerms/rolePerms settings.
 * Now delegates to requirePerm for unified permission checking.
 * @param {string} perm - the permission key (e.g., 'analytics', 'maintenance')
 */
export function requireAdminPerm(perm) {
  return requirePerm(perm);
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
