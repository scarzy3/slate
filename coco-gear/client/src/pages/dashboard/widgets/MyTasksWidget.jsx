import { useState, useEffect } from 'react';
import { T } from '../../../theme/theme.js';
import { fmtDate, daysAgo } from '../../../theme/helpers.js';
import { Bg } from '../../../components/ui/index.js';
import { tasks as tasksApi } from '../../../api.js';

const PRIORITY_COLORS = { critical: T.rd, high: T.or, medium: T.am, low: T.mu };
const PHASE_COLORS = { 'pre-deployment': T.bl, 'deployment': T.gn, 'post-deployment': T.pu };

function MyTasksWidget({ trips, curUserId, onNavigate }) {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeTrips = (trips || []).filter(t => t.status === "active" || t.status === "planning");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const results = await Promise.all(activeTrips.map(t => tasksApi.list(t.id).catch(() => [])));
        if (cancelled) return;
        const flat = [];
        results.forEach((taskList, i) => {
          const trip = activeTrips[i];
          (taskList || []).forEach(task => {
            if (task.assignedToId === curUserId && task.status !== 'done') {
              flat.push({ ...task, tripName: trip.name, tripId: trip.id });
            }
          });
        });
        setAllTasks(flat);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    if (activeTrips.length > 0) load(); else { setAllTasks([]); setLoading(false); }
    return () => { cancelled = true; };
  }, [trips?.length, curUserId]);

  if (loading) return <div style={{ padding: 20, textAlign: "center", color: T.dm, fontFamily: T.m, fontSize: 11 }}>Loading tasks...</div>;
  if (allTasks.length === 0) return <div style={{ padding: 20, textAlign: "center", color: T.dm, fontFamily: T.m, fontSize: 11 }}>No tasks assigned to you</div>;

  // Sort: overdue first, then by due date, then by priority
  const priorityWeight = { critical: 0, high: 1, medium: 2, low: 3 };
  const now = new Date();
  const sorted = [...allTasks].sort((a, b) => {
    const aOverdue = a.dueDate && new Date(a.dueDate) < now ? 0 : 1;
    const bOverdue = b.dueDate && new Date(b.dueDate) < now ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    if (a.dueDate && b.dueDate) return new Date(a.dueDate) - new Date(b.dueDate);
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;
    return (priorityWeight[a.priority] || 2) - (priorityWeight[b.priority] || 2);
  }).slice(0, 10);

  // Group by trip
  const grouped = {};
  sorted.forEach(t => {
    if (!grouped[t.tripName]) grouped[t.tripName] = [];
    grouped[t.tripName].push(t);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.entries(grouped).map(([tripName, tasks]) => (
        <div key={tripName}>
          <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: T.ind, fontFamily: T.m, marginBottom: 6 }}>{tripName}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tasks.map(task => {
              const isOverdue = task.dueDate && new Date(task.dueDate) < now;
              return (
                <div key={task.id} onClick={() => onNavigate("trips")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: isOverdue ? "rgba(248,113,113,.04)" : "rgba(255,255,255,.015)", border: "1px solid " + (isOverdue ? "rgba(248,113,113,.15)" : T.bd), cursor: "pointer" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: "2px solid " + (PRIORITY_COLORS[task.priority] || T.mu), flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.u, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{task.title}</div>
                  </div>
                  <Bg color={PRIORITY_COLORS[task.priority] || T.mu} bg={(PRIORITY_COLORS[task.priority] || T.mu) + "18"}>{task.priority}</Bg>
                  <Bg color={PHASE_COLORS[task.phase] || T.mu} bg={(PHASE_COLORS[task.phase] || T.mu) + "18"}>{task.phase}</Bg>
                  {task.dueDate && <div style={{ fontSize: 9, color: isOverdue ? T.rd : T.mu, fontFamily: T.m, whiteSpace: "nowrap" }}>{isOverdue ? daysAgo(task.dueDate) + "d overdue" : fmtDate(task.dueDate)}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MyTasksWidget;
