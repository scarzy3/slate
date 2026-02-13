// Widget registry — defines all available dashboard widgets
const WIDGET_REGISTRY = [
  {
    id: 'fleet_metrics',
    label: 'Fleet Metrics',
    description: 'Key stats: total kits, checked out, available, maintenance',
    icon: '\u25A3',
    defaultVisible: true,
    defaultOrder: 0,
    minRole: 'user',
    size: 'full',
  },
  {
    id: 'active_alerts',
    label: 'Active Alerts',
    description: 'Overdue inspections, calibrations, returns, and pending requests',
    icon: '\u26A0',
    defaultVisible: true,
    defaultOrder: 1,
    minRole: 'lead',
    size: 'half',
  },
  {
    id: 'quick_actions',
    label: 'Quick Actions',
    description: 'Shortcut buttons for checkout, return, and inspect',
    icon: '\u26A1',
    defaultVisible: true,
    defaultOrder: 2,
    minRole: 'user',
    size: 'half',
  },
  {
    id: 'activity_feed',
    label: 'Recent Activity',
    description: 'Latest checkout, return, and inspection events',
    icon: '\u23F3',
    defaultVisible: true,
    defaultOrder: 3,
    minRole: 'user',
    size: 'half',
  },
  {
    id: 'dept_health',
    label: 'Department Health',
    description: 'Compliance and inspection rates by department',
    icon: '\u25C9',
    defaultVisible: true,
    defaultOrder: 4,
    minRole: 'manager',
    size: 'half',
  },
  {
    id: 'active_trips',
    label: 'Active Trips',
    description: 'Currently active and planning trips',
    icon: '\u2690',
    defaultVisible: true,
    defaultOrder: 5,
    minRole: 'lead',
    size: 'half',
  },
  {
    id: 'storage_overview',
    label: 'By Storage',
    description: 'Kit counts and checkout status by storage location',
    icon: '\u2302',
    defaultVisible: true,
    defaultOrder: 6,
    minRole: 'manager',
    size: 'half',
  },
  {
    id: 'my_kits',
    label: 'My Kits',
    description: 'Kits currently checked out to you',
    icon: '\u2606',
    defaultVisible: true,
    defaultOrder: 7,
    minRole: 'user',
    size: 'full',
  },
  {
    id: 'inspections_due',
    label: 'Inspections Due',
    description: 'Kits needing inspection, sorted by urgency',
    icon: '\u2315',
    defaultVisible: true,
    defaultOrder: 8,
    minRole: 'lead',
    size: 'half',
  },
  {
    id: 'maintenance_queue',
    label: 'In Maintenance',
    description: 'Kits currently in repair, calibration, or upgrade',
    icon: '\u2699',
    defaultVisible: true,
    defaultOrder: 9,
    minRole: 'lead',
    size: 'half',
  },
  {
    id: 'my_tasks',
    label: 'My Tasks',
    description: 'Tasks assigned to you across active trips',
    icon: '\u2611',
    defaultVisible: true,
    defaultOrder: 10,
    minRole: 'user',
    size: 'full',
  },
];

// Role hierarchy for minRole checks
const ROLE_LEVEL = {
  developer: 5, director: 4, super: 4, engineer: 4,
  manager: 3, admin: 3,
  lead: 2,
  user: 1,
};

export function getUserRoleLevel(role) {
  return ROLE_LEVEL[role] || 1;
}

export function getVisibleWidgets(userRole) {
  const level = getUserRoleLevel(userRole);
  return WIDGET_REGISTRY.filter(w => getUserRoleLevel(w.minRole) <= level);
}

export function getDefaultConfig(userRole) {
  const available = getVisibleWidgets(userRole);
  return {
    widgets: available.map(w => ({ id: w.id, visible: w.defaultVisible, order: w.defaultOrder })),
  };
}

export function mergeConfig(savedConfig, userRole) {
  const available = getVisibleWidgets(userRole);
  if (!savedConfig || !savedConfig.widgets) return getDefaultConfig(userRole);

  const savedMap = {};
  savedConfig.widgets.forEach(w => { savedMap[w.id] = w; });

  // Merge: keep saved state for known widgets, add new ones at end
  let maxOrder = Math.max(0, ...savedConfig.widgets.map(w => w.order));
  const merged = available.map(reg => {
    if (savedMap[reg.id]) return savedMap[reg.id];
    maxOrder++;
    return { id: reg.id, visible: reg.defaultVisible, order: maxOrder };
  });

  return { widgets: merged, columns: savedConfig.columns };
}

export default WIDGET_REGISTRY;
