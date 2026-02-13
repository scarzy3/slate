import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme/theme.js';
import { SH, Bt } from '../components/ui/index.js';
import { dashboard as dashApi } from '../api.js';
import WIDGET_REGISTRY, { getVisibleWidgets, getDefaultConfig, mergeConfig } from './dashboard/widgetRegistry.js';
import WidgetCard from './dashboard/WidgetCard.jsx';
import CustomizePanel from './dashboard/CustomizePanel.jsx';

// Widget components
import FleetMetricsWidget from './dashboard/widgets/FleetMetricsWidget.jsx';
import ActiveAlertsWidget from './dashboard/widgets/ActiveAlertsWidget.jsx';
import QuickActionsWidget from './dashboard/widgets/QuickActionsWidget.jsx';
import ActivityFeedWidget from './dashboard/widgets/ActivityFeedWidget.jsx';
import DeptHealthWidget from './dashboard/widgets/DeptHealthWidget.jsx';
import ActiveTripsWidget from './dashboard/widgets/ActiveTripsWidget.jsx';
import StorageOverviewWidget from './dashboard/widgets/StorageOverviewWidget.jsx';
import MyKitsWidget from './dashboard/widgets/MyKitsWidget.jsx';
import InspectionsDueWidget from './dashboard/widgets/InspectionsDueWidget.jsx';
import MaintenanceQueueWidget from './dashboard/widgets/MaintenanceQueueWidget.jsx';
import MyTasksWidget from './dashboard/widgets/MyTasksWidget.jsx';

const WIDGET_COMPONENTS = {
  fleet_metrics: FleetMetricsWidget,
  active_alerts: ActiveAlertsWidget,
  quick_actions: QuickActionsWidget,
  activity_feed: ActivityFeedWidget,
  dept_health: DeptHealthWidget,
  active_trips: ActiveTripsWidget,
  storage_overview: StorageOverviewWidget,
  my_kits: MyKitsWidget,
  inspections_due: InspectionsDueWidget,
  maintenance_queue: MaintenanceQueueWidget,
  my_tasks: MyTasksWidget,
};

const REG_MAP = {};
WIDGET_REGISTRY.forEach(w => { REG_MAP[w.id] = w; });

function Dash({ kits, types, locs, comps, personnel, depts, trips, requests, analytics, logs, settings, curUserId, userRole, favorites, setFavorites, onNavigate, onAction, onFilterKits }) {
  const [dashConfig, setDashConfig] = useState(null);
  const [customizing, setCustomizing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const tier = ["developer", "director", "super", "engineer"].includes(userRole) ? "director" :
    ["manager", "admin"].includes(userRole) ? "manager" : userRole === "lead" ? "lead" : "user";

  // Load dashboard config on mount
  useEffect(() => {
    let cancelled = false;
    dashApi.getConfig().then(saved => {
      if (cancelled) return;
      setDashConfig(mergeConfig(saved, userRole));
      setLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setDashConfig(getDefaultConfig(userRole));
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, [userRole]);

  const handleSaveConfig = useCallback((newConfig) => {
    setDashConfig(newConfig);
    setCustomizing(false);
    // Persist to backend (fire-and-forget)
    dashApi.saveConfig(newConfig).catch(() => {});
  }, []);

  if (!loaded) return null;

  const config = dashConfig || getDefaultConfig(userRole);
  const available = getVisibleWidgets(userRole);
  const availableIds = new Set(available.map(w => w.id));

  // Get ordered, visible widgets
  const widgetEntries = [...(config.widgets || [])]
    .filter(w => w.visible && availableIds.has(w.id) && WIDGET_COMPONENTS[w.id])
    .sort((a, b) => a.order - b.order);

  // Shared props for all widget components
  const widgetProps = {
    kits, types, locs, comps, personnel, depts, trips, requests,
    analytics, logs, settings, curUserId, userRole, favorites, setFavorites,
    onNavigate, onAction, onFilterKits,
  };

  // Separate full-width and half-width widgets for grid layout
  const fullWidgets = [];
  const halfWidgets = [];
  widgetEntries.forEach(w => {
    const reg = REG_MAP[w.id];
    if (reg && reg.size === 'full') fullWidgets.push(w);
    else halfWidgets.push(w);
  });

  // Interleave: render in order, grouping halves into rows
  const renderOrder = [...widgetEntries];

  // Build layout sections: full-width items standalone, half-width items grouped in pairs
  const sections = [];
  let halfBuf = [];
  renderOrder.forEach(w => {
    const reg = REG_MAP[w.id];
    if (reg && reg.size === 'full') {
      if (halfBuf.length > 0) { sections.push({ type: 'grid', items: halfBuf }); halfBuf = []; }
      sections.push({ type: 'full', item: w });
    } else {
      halfBuf.push(w);
    }
  });
  if (halfBuf.length > 0) sections.push({ type: 'grid', items: halfBuf });

  return (
    <div>
      <SH title="Dashboard" sub={tier === "director" ? "Director overview" : tier === "manager" ? "Manager overview" : tier === "lead" ? "Operations overview" : "Your equipment"}
        action={<Bt v="ghost" sm onClick={() => setCustomizing(true)} style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontSize: 13 }}>{"\u2699"}</span> Customize</Bt>} />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {sections.map((sec, si) => {
          if (sec.type === 'full') {
            const w = sec.item;
            const reg = REG_MAP[w.id];
            const Comp = WIDGET_COMPONENTS[w.id];
            return (
              <WidgetCard key={w.id} id={w.id} icon={reg.icon} label={reg.label}>
                <Comp {...widgetProps} />
              </WidgetCard>
            );
          }
          // grid of half-width items
          return (
            <div key={"g" + si} className="slate-resp" style={{ display: "grid", gridTemplateColumns: sec.items.length === 1 ? "1fr" : "1fr 1fr", gap: 16 }}>
              {sec.items.map(w => {
                const reg = REG_MAP[w.id];
                const Comp = WIDGET_COMPONENTS[w.id];
                return (
                  <WidgetCard key={w.id} id={w.id} icon={reg.icon} label={reg.label}>
                    <Comp {...widgetProps} />
                  </WidgetCard>
                );
              })}
            </div>
          );
        })}
      </div>

      <CustomizePanel open={customizing} onClose={() => setCustomizing(false)}
        config={config} onSave={handleSaveConfig} userRole={userRole} />
    </div>
  );
}

export default Dash;
