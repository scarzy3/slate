import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole, requireSuper } from '../middleware/rbac.js';
import { validate, settingsSchema } from '../utils/validation.js';
import { auditLog } from '../utils/auditLogger.js';

const prisma = new PrismaClient();
const router = Router();

const DEFAULT_SETTINGS = {
  requireDeptApproval: true,
  allowUserLocationUpdate: true,
  requireSerialsOnCheckout: true,
  requireSerialsOnReturn: true,
  requireSerialsOnInspect: true,
  allowUserInspect: true,
  allowUserCheckout: true,
  inspectionDueThreshold: 30,
  overdueReturnThreshold: 14,
  enableReservations: true,
  enableMaintenance: true,
  enableConsumables: true,
  enableQR: true,
  adminPerms: {
    analytics: true,
    reports: true,
    maintenance: true,
    consumables: true,
    types: true,
    components: true,
    locations: true,
    departments: true,
    personnel: true,
  },
};

/**
 * Merge DB settings over defaults, handling nested objects
 */
function mergeSettings(dbSettings) {
  const merged = { ...DEFAULT_SETTINGS };

  for (const row of dbSettings) {
    if (row.key === 'adminPerms' && typeof row.value === 'object') {
      merged.adminPerms = { ...DEFAULT_SETTINGS.adminPerms, ...row.value };
    } else {
      merged[row.key] = row.value;
    }
  }

  return merged;
}

// GET / - get all settings (any authenticated user — needed for feature flags)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const dbSettings = await prisma.systemSetting.findMany();
    const settings = mergeSettings(dbSettings);
    return res.json(settings);
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT / - update settings (super only)
router.put('/', authMiddleware, requireSuper, validate(settingsSchema), async (req, res) => {
  try {
    const data = req.validated;

    // Upsert each setting key
    const upserts = [];
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        upserts.push(
          prisma.systemSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
          }),
        );
      }
    }

    await prisma.$transaction(upserts);

    // Return the merged settings
    const dbSettings = await prisma.systemSetting.findMany();
    const settings = mergeSettings(dbSettings);

    await auditLog('settings_update', 'settings', null, req.user.id, {
      updatedKeys: Object.keys(data),
    });

    return res.json(settings);
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
