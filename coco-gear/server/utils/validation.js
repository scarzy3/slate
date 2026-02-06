import { z } from 'zod';

// ─── Auth ───
export const loginSchema = z.object({
  userId: z.string().uuid(),
  pin: z.string().min(1).max(128),
});

// ─── Component ───
export const componentSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  category: z.enum(['Comms', 'Power', 'Cables', 'Cases', 'Optics', 'Other']),
  serialized: z.boolean().optional().default(false),
  calibrationRequired: z.boolean().optional().default(false),
  calibrationIntervalDays: z.number().int().positive().nullable().optional(),
});

// ─── Kit Type ───
export const kitTypeSchema = z.object({
  name: z.string().min(1).max(200),
  desc: z.string().max(500).optional().default(''),
  components: z.array(z.object({
    componentId: z.string().uuid(),
    quantity: z.number().int().min(1).default(1),
  })).optional().default([]),
  fields: z.array(z.object({
    key: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'number', 'toggle']).default('text'),
  })).optional().default([]),
});

// ─── Kit ───
export const kitSchema = z.object({
  typeId: z.string().uuid(),
  color: z.string().min(1).max(50),
  locId: z.string().uuid(),
  deptId: z.string().uuid().nullable().optional(),
  fields: z.record(z.string(), z.any()).optional().default({}),
});

export const kitUpdateSchema = z.object({
  typeId: z.string().uuid().optional(),
  color: z.string().min(1).max(50).optional(),
  locId: z.string().uuid().optional(),
  deptId: z.string().uuid().nullable().optional(),
  fields: z.record(z.string(), z.any()).optional(),
});

// ─── Location ───
export const locationSchema = z.object({
  name: z.string().min(1).max(200),
  shortCode: z.string().min(1).max(20),
});

// ─── Department ───
export const departmentSchema = z.object({
  name: z.string().min(1).max(200),
  color: z.string().max(20).optional().default('#60a5fa'),
  headId: z.string().uuid().nullable().optional(),
});

// ─── Personnel ───
export const personnelSchema = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional().default(''),
  role: z.enum(['super', 'admin', 'user']).default('user'),
  deptId: z.string().uuid().nullable().optional(),
  pin: z.string().min(1).max(128).optional().default('password'),
});

export const personnelUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  title: z.string().max(200).optional(),
  role: z.enum(['super', 'admin', 'user']).optional(),
  deptId: z.string().uuid().nullable().optional(),
  pin: z.string().min(1).max(128).optional(),
});

// ─── Consumable ───
export const consumableSchema = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().max(50).optional().default(''),
  category: z.string().max(50).optional().default('Other'),
  qty: z.number().int().min(0).optional().default(0),
  minQty: z.number().int().min(0).optional().default(0),
  unit: z.string().max(20).optional().default('ea'),
});

export const consumableAdjustSchema = z.object({
  delta: z.number().int(),
  reason: z.string().max(500).optional().default(''),
});

// ─── Standalone Asset ───
export const assetSchema = z.object({
  name: z.string().min(1).max(200),
  serial: z.string().min(1).max(100),
  category: z.string().max(50).optional().default('Other'),
  locId: z.string().uuid().nullable().optional(),
  notes: z.string().max(1000).optional().default(''),
});

// ─── Trip ───
export const tripSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  location: z.string().max(200).optional().default(''),
  objectives: z.string().max(2000).optional().default(''),
  leadId: z.string().uuid().nullable().optional(),
  startDate: z.string().refine(d => !isNaN(Date.parse(d))),
  endDate: z.string().refine(d => !isNaN(Date.parse(d))),
  status: z.enum(['planning', 'active', 'completed', 'cancelled']).optional().default('planning'),
});

export const tripPersonnelSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['director', 'manager', 'senior-spec', 'specialist', 'engineer', 'other']).optional().default('specialist'),
  notes: z.string().max(500).optional().default(''),
});

export const tripNoteSchema = z.object({
  content: z.string().min(1).max(5000),
  category: z.enum(['general', 'logistics', 'safety', 'comms', 'after-action']).optional().default('general'),
});

// ─── Reservation ───
export const reservationSchema = z.object({
  kitId: z.string().uuid(),
  tripId: z.string().uuid().nullable().optional(),
  startDate: z.string().refine(d => !isNaN(Date.parse(d))),
  endDate: z.string().refine(d => !isNaN(Date.parse(d))),
  purpose: z.string().max(500).optional().default(''),
});

// ─── Checkout / Return ───
export const checkoutSchema = z.object({
  kitId: z.string().uuid(),
  personId: z.string().uuid().optional(), // for admin issue
  serials: z.record(z.string(), z.string()).optional().default({}),
  notes: z.string().max(1000).optional().default(''),
});

export const returnSchema = z.object({
  kitId: z.string().uuid(),
  serials: z.record(z.string(), z.string()).optional().default({}),
  notes: z.string().max(1000).optional().default(''),
});

// ─── Inspection ───
export const inspectionSchema = z.object({
  kitId: z.string().uuid(),
  inspector: z.string().max(200).optional().default(''),
  notes: z.string().max(2000).optional().default(''),
  results: z.record(z.string(), z.object({
    componentId: z.string().uuid(),
    slotIndex: z.number().int().min(0),
    status: z.enum(['GOOD', 'MISSING', 'DAMAGED']),
    serial: z.string().optional(),
  })),
});

// ─── Maintenance ───
export const maintenanceStartSchema = z.object({
  kitId: z.string().uuid(),
  type: z.enum(['repair', 'calibration', 'upgrade', 'cleaning']).default('repair'),
  reason: z.string().max(500).optional().default(''),
  notes: z.string().max(1000).optional().default(''),
});

// ─── Settings ───
export const settingsSchema = z.object({
  requireDeptApproval: z.boolean().optional(),
  allowUserLocationUpdate: z.boolean().optional(),
  requireSerialsOnCheckout: z.boolean().optional(),
  requireSerialsOnReturn: z.boolean().optional(),
  requireSerialsOnInspect: z.boolean().optional(),
  allowUserInspect: z.boolean().optional(),
  allowUserCheckout: z.boolean().optional(),
  inspectionDueThreshold: z.number().int().positive().optional(),
  overdueReturnThreshold: z.number().int().positive().optional(),
  enableReservations: z.boolean().optional(),
  enableMaintenance: z.boolean().optional(),
  enableConsumables: z.boolean().optional(),
  enableQR: z.boolean().optional(),
  adminPerms: z.object({
    analytics: z.boolean().optional(),
    reports: z.boolean().optional(),
    maintenance: z.boolean().optional(),
    consumables: z.boolean().optional(),
    types: z.boolean().optional(),
    components: z.boolean().optional(),
    locations: z.boolean().optional(),
    departments: z.boolean().optional(),
    personnel: z.boolean().optional(),
  }).optional(),
});

/**
 * Validate request body against schema
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    req.validated = result.data;
    next();
  };
}
