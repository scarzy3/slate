import { broadcast } from '../socket.js';

/**
 * Map URL path prefixes to entity names that the client understands.
 * Order matters — more specific prefixes should come first.
 */
const ENTITY_MAP = [
  ['/api/kits/checkout', 'kits'],
  ['/api/kits/return', 'kits'],
  ['/api/kits/inspect', 'kits'],
  ['/api/kits', 'kits'],
  ['/api/trips', 'trips'],
  ['/api/types', 'types'],
  ['/api/components', 'components'],
  ['/api/locations', 'locations'],
  ['/api/departments', 'departments'],
  ['/api/personnel', 'personnel'],
  ['/api/consumables', 'consumables'],
  ['/api/assets', 'assets'],
  ['/api/reservations', 'reservations'],
  ['/api/boats', 'boats'],
  ['/api/maintenance', 'kits'],   // maintenance affects kits
  ['/api/settings', 'settings'],
  ['/api/packing-templates', 'trips'],
  ['/api/task-templates', 'trips'],
];

const METHOD_TO_ACTION = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * Express middleware that intercepts successful mutation responses (POST/PUT/PATCH/DELETE)
 * and broadcasts a real-time event to other connected clients.
 *
 * Must be applied before routes so it can wrap res.json().
 */
export function realtimeBroadcast(req, res, next) {
  // Only intercept mutations
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Call original first
    const result = originalJson(body);

    // Only broadcast for successful responses (2xx)
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const entity = resolveEntity(req.originalUrl || req.url);
      if (entity) {
        const action = resolveAction(req);
        const userId = req.user?.id || null;
        broadcast(entity, action, { userName: req.user?.name }, userId);
      }
    }

    return result;
  };

  next();
}

function resolveEntity(url) {
  // Strip query string
  const path = url.split('?')[0];
  for (const [prefix, entity] of ENTITY_MAP) {
    if (path.startsWith(prefix)) return entity;
  }
  return null;
}

function resolveAction(req) {
  const url = (req.originalUrl || req.url).split('?')[0];

  // Specific actions based on URL patterns
  if (url.includes('/checkout')) return 'checkout';
  if (url.includes('/return')) return 'return';
  if (url.includes('/inspect')) return 'inspect';
  if (url.includes('/approve')) return 'approve';
  if (url.includes('/cancel')) return 'cancel';
  if (url.includes('/adjust')) return 'adjust';
  if (url.includes('/resolve-degraded')) return 'resolve';
  if (url.includes('/reorder')) return 'reorder';
  if (url.includes('/from-template')) return 'create';

  return METHOD_TO_ACTION[req.method] || 'update';
}
