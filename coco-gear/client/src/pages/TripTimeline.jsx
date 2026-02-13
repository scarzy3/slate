import { useState, useEffect, useMemo, useRef } from 'react';
import { T } from '../theme/theme.js';
import { Bt, Fl, In, Ta, ModalWrap, ConfirmDialog } from '../components/ui/index.js';
import api from '../api.js';

const PHASE_PALETTE = [T.bl, T.gn, T.am, T.pu, T.tl, T.ind, T.or, T.rd];
const DAY_MS = 86400000;

function phaseColor(phase, idx) {
  return phase.color || PHASE_PALETTE[idx % PHASE_PALETTE.length];
}

function daysBetween(a, b) {
  return Math.max(1, Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS));
}

function fmtShort(d) {
  return d ? new Date(d).toLocaleDateString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
}

function fmtFull(d) {
  return d ? new Date(d).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
}

// ─── SVG Timeline ───
function TimelineSVG({ trip, phases, milestones, zoom, onSelectPhase, onSelectMilestone, selectedPhaseId }) {
  const containerRef = useRef(null);
  const tripStart = new Date(trip.startDate).getTime();
  const tripEnd = new Date(trip.endDate).getTime();
  const totalDays = Math.max(1, Math.ceil((tripEnd - tripStart) / DAY_MS));
  const today = Date.now();
  const todayInRange = today >= tripStart && today <= tripEnd;

  // Scale: pixels per day
  const minPxPerDay = 20;
  const maxPxPerDay = 50;
  const containerWidth = containerRef.current?.clientWidth || 800;
  let pxPerDay;
  if (zoom === 'fit') pxPerDay = Math.max(4, Math.min(maxPxPerDay, containerWidth / totalDays));
  else if (zoom === 'week') pxPerDay = Math.max(minPxPerDay, containerWidth / 7);
  else if (zoom === 'day') pxPerDay = Math.max(minPxPerDay, containerWidth / 1);
  else pxPerDay = Math.max(minPxPerDay, Math.min(maxPxPerDay, containerWidth / totalDays));

  const timelineWidth = Math.max(containerWidth, totalDays * pxPerDay);
  const rowHeight = 28;
  const headerHeight = 32;
  const phaseRows = phases.length || 1;
  const milestoneRowHeight = milestones.length > 0 ? 30 : 0;
  const svgHeight = headerHeight + phaseRows * rowHeight + milestoneRowHeight + 16;

  const dateToX = (d) => {
    const ms = new Date(d).getTime();
    return ((ms - tripStart) / (tripEnd - tripStart)) * timelineWidth;
  };

  // Generate tick marks
  const ticks = [];
  const tickInterval = totalDays <= 14 ? 1 : totalDays <= 60 ? 7 : 14;
  for (let i = 0; i <= totalDays; i += tickInterval) {
    const d = new Date(tripStart + i * DAY_MS);
    ticks.push({ x: (i / totalDays) * timelineWidth, label: fmtShort(d), day: i });
  }

  return (
    <div ref={containerRef} style={{ overflowX: 'auto', borderRadius: 8, background: T.card, border: '1px solid ' + T.bd }}>
      <svg width={timelineWidth} height={svgHeight} style={{ display: 'block', fontFamily: T.m }}>
        {/* Background grid */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x} y1={headerHeight} x2={t.x} y2={svgHeight} stroke={T.bd} strokeWidth={0.5} opacity={0.5} />
        ))}

        {/* Header: date labels */}
        {ticks.map((t, i) => (
          <text key={i} x={t.x + 3} y={14} fill={T.dm} fontSize={8} fontFamily={T.m}>{t.label}</text>
        ))}
        <line x1={0} y1={headerHeight - 1} x2={timelineWidth} y2={headerHeight - 1} stroke={T.bd} strokeWidth={1} />

        {/* Phase bars */}
        {phases.map((phase, idx) => {
          const x1 = dateToX(phase.startDate);
          const x2 = dateToX(phase.endDate);
          const y = headerHeight + idx * rowHeight + 4;
          const w = Math.max(x2 - x1, 2);
          const color = phaseColor(phase, idx);
          const isSelected = selectedPhaseId === phase.id;
          return (
            <g key={phase.id} onClick={() => onSelectPhase?.(phase)} style={{ cursor: 'pointer' }}>
              <rect x={x1} y={y} width={w} height={rowHeight - 8} rx={4} ry={4}
                fill={color + '33'} stroke={isSelected ? color : color + '66'} strokeWidth={isSelected ? 2 : 1} />
              {w > 40 && <text x={x1 + 6} y={y + rowHeight / 2 - 2} fill={color} fontSize={9} fontWeight={600} fontFamily={T.m}
                style={{ pointerEvents: 'none' }}>{phase.name}</text>}
              {w <= 40 && <title>{phase.name}</title>}
            </g>
          );
        })}

        {/* Empty state for phases */}
        {phases.length === 0 && (
          <text x={timelineWidth / 2} y={headerHeight + 18} fill={T.dm} fontSize={10} fontFamily={T.m} textAnchor="middle">
            No phases defined. Add phases below to build your timeline.
          </text>
        )}

        {/* Milestone markers */}
        {milestones.map((ms, idx) => {
          const x = dateToX(ms.date);
          const y = headerHeight + phaseRows * rowHeight + 4;
          const isOverdue = !ms.completed && new Date(ms.date).getTime() < today;
          const color = ms.completed ? T.gn : isOverdue ? T.rd : T.am;
          return (
            <g key={ms.id} onClick={() => onSelectMilestone?.(ms)} style={{ cursor: 'pointer' }}>
              {/* Vertical line through phases */}
              <line x1={x} y1={headerHeight} x2={x} y2={y + 4} stroke={color + '44'} strokeWidth={1} strokeDasharray="3,3" />
              {/* Diamond marker */}
              <polygon points={`${x},${y} ${x + 6},${y + 6} ${x},${y + 12} ${x - 6},${y + 6}`}
                fill={color + '33'} stroke={color} strokeWidth={1.5} />
              {/* Label */}
              <text x={x + 10} y={y + 9} fill={color} fontSize={8} fontWeight={600} fontFamily={T.m}>{ms.name}</text>
            </g>
          );
        })}

        {/* Today marker */}
        {todayInRange && (() => {
          const x = dateToX(today);
          return (
            <g>
              <line x1={x} y1={0} x2={x} y2={svgHeight} stroke={T.rd} strokeWidth={1.5} strokeDasharray="4,3" />
              <rect x={x - 16} y={1} width={32} height={12} rx={3} fill={T.rd + '22'} stroke={T.rd} strokeWidth={0.5} />
              <text x={x} y={10} fill={T.rd} fontSize={7} fontWeight={700} fontFamily={T.m} textAnchor="middle">TODAY</text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Phase Form ───
function PhaseForm({ initial, trip, onSave, onCancel }) {
  const [fm, setFm] = useState(initial || { name: '', startDate: '', endDate: '', color: '', notes: '' });
  const save = () => {
    if (!fm.name.trim() || !fm.startDate || !fm.endDate) return;
    onSave({ name: fm.name.trim(), startDate: fm.startDate, endDate: fm.endDate, color: fm.color || null, notes: fm.notes.trim() || null });
  };
  return (
    <div style={{ padding: 14, borderRadius: 8, background: T.card, border: '1px solid ' + T.bl + '33' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Fl label="Phase Name"><In value={fm.name} onChange={e => setFm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Transit, Setup, Operations" /></Fl>
        <Fl label="Color">
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {PHASE_PALETTE.map(c => (
              <div key={c} onClick={() => setFm(p => ({ ...p, color: p.color === c ? '' : c }))}
                style={{ width: 20, height: 20, borderRadius: 4, background: c, border: '2px solid ' + (fm.color === c ? '#fff' : 'transparent'),
                  cursor: 'pointer', opacity: fm.color && fm.color !== c ? 0.3 : 1 }} />
            ))}
          </div>
        </Fl>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Fl label="Start Date"><In type="date" value={fm.startDate} onChange={e => setFm(p => ({ ...p, startDate: e.target.value }))} /></Fl>
        <Fl label="End Date"><In type="date" value={fm.endDate} onChange={e => setFm(p => ({ ...p, endDate: e.target.value }))} /></Fl>
      </div>
      <Fl label="Notes (optional)"><In value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))} placeholder="Phase notes..." /></Fl>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
        <Bt onClick={onCancel}>Cancel</Bt>
        <Bt v="primary" onClick={save} disabled={!fm.name.trim() || !fm.startDate || !fm.endDate}>Save</Bt>
      </div>
    </div>
  );
}

// ─── Milestone Form ───
function MilestoneForm({ initial, trip, onSave, onCancel }) {
  const [fm, setFm] = useState(initial || { name: '', date: '', notes: '' });
  const save = () => {
    if (!fm.name.trim() || !fm.date) return;
    onSave({ name: fm.name.trim(), date: fm.date, notes: fm.notes.trim() || null });
  };
  return (
    <div style={{ padding: 14, borderRadius: 8, background: T.card, border: '1px solid ' + T.am + '33' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Fl label="Milestone Name"><In value={fm.name} onChange={e => setFm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Wheels Up, On Station, Ops Complete" /></Fl>
        <Fl label="Date"><In type="date" value={fm.date} onChange={e => setFm(p => ({ ...p, date: e.target.value }))} /></Fl>
      </div>
      <Fl label="Notes (optional)"><In value={fm.notes} onChange={e => setFm(p => ({ ...p, notes: e.target.value }))} placeholder="Milestone notes..." /></Fl>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 10 }}>
        <Bt onClick={onCancel}>Cancel</Bt>
        <Bt v="primary" onClick={save} disabled={!fm.name.trim() || !fm.date}>Save</Bt>
      </div>
    </div>
  );
}

// ─── Main TripTimeline Component ───
export default function TripTimeline({ trip, isAdmin, editable, onRefresh }) {
  const [phases, setPhases] = useState(trip?.phases || []);
  const [milestones, setMilestones] = useState(trip?.milestones || []);
  const [zoom, setZoom] = useState('fit');
  const [addPhase, setAddPhase] = useState(false);
  const [editPhase, setEditPhase] = useState(null);
  const [addMilestone, setAddMilestone] = useState(false);
  const [editMilestone, setEditMilestone] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);
  const [presetName, setPresetName] = useState(null);
  const [presetMsName, setPresetMsName] = useState(null);

  const tripId = trip?.id;

  useEffect(() => { setPhases(trip?.phases || []); setMilestones(trip?.milestones || []); }, [trip]);

  const reload = async () => {
    try {
      const [p, m] = await Promise.all([api.trips.phases.list(tripId), api.trips.milestones.list(tripId)]);
      setPhases(p);
      setMilestones(m);
      if (onRefresh) onRefresh();
    } catch { /* ignore */ }
  };

  // Phase CRUD
  const createPhase = async (data) => {
    try { await api.trips.phases.create(tripId, data); setAddPhase(false); setPresetName(null); await reload(); } catch (e) { alert(e.message); }
  };
  const updatePhase = async (id, data) => {
    try { await api.trips.phases.update(tripId, id, data); setEditPhase(null); await reload(); } catch (e) { alert(e.message); }
  };
  const deletePhase = async (id) => {
    try { await api.trips.phases.delete(tripId, id); await reload(); } catch (e) { alert(e.message); }
  };
  const movePhase = async (idx, dir) => {
    const ids = phases.map(p => p.id);
    const ni = idx + dir;
    if (ni < 0 || ni >= ids.length) return;
    [ids[idx], ids[ni]] = [ids[ni], ids[idx]];
    try { await api.trips.phases.reorder(tripId, ids); await reload(); } catch (e) { alert(e.message); }
  };

  // Milestone CRUD
  const createMilestone = async (data) => {
    try { await api.trips.milestones.create(tripId, data); setAddMilestone(false); setPresetMsName(null); await reload(); } catch (e) { alert(e.message); }
  };
  const updateMilestone = async (id, data) => {
    try { await api.trips.milestones.update(tripId, id, data); setEditMilestone(null); await reload(); } catch (e) { alert(e.message); }
  };
  const deleteMilestone = async (id) => {
    try { await api.trips.milestones.delete(tripId, id); await reload(); } catch (e) { alert(e.message); }
  };
  const toggleMilestone = async (ms) => {
    try { await api.trips.milestones.update(tripId, ms.id, { completed: !ms.completed }); await reload(); } catch (e) { alert(e.message); }
  };

  // Phase presets: split trip duration proportionally
  const tripDays = daysBetween(trip.startDate, trip.endDate);
  const presetPhases = [
    { name: 'Transit', frac: 0.2 }, { name: 'Setup', frac: 0.1 }, { name: 'Operations', frac: 0.5 },
    { name: 'Teardown', frac: 0.1 }, { name: 'Return', frac: 0.1 },
  ];
  const getPresetDates = (presetName) => {
    const idx = presetPhases.findIndex(p => p.name === presetName);
    if (idx < 0) return { startDate: '', endDate: '' };
    let dayOffset = 0;
    for (let i = 0; i < idx; i++) dayOffset += Math.round(presetPhases[i].frac * tripDays);
    const dur = Math.max(1, Math.round(presetPhases[idx].frac * tripDays));
    const start = new Date(new Date(trip.startDate).getTime() + dayOffset * DAY_MS);
    const end = new Date(start.getTime() + dur * DAY_MS);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  };

  const milestonePresets = ['Departure', 'On Station', 'Ops Begin', 'Ops Complete', 'Return'];

  // Upcoming milestone
  const now = Date.now();
  const nextMs = milestones.filter(m => !m.completed).sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  if (!trip) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Zoom controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, color: T.dm, fontFamily: T.m, marginRight: 4 }}>ZOOM:</span>
        {[{ id: 'fit', l: 'Fit All' }, { id: 'week', l: 'Week' }, { id: 'day', l: 'Day' }].map(z => (
          <button key={z.id} onClick={() => setZoom(z.id)}
            style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: 9, fontFamily: T.m, fontWeight: 600,
              background: zoom === z.id ? T.bl + '18' : 'transparent', border: '1px solid ' + (zoom === z.id ? T.bl + '44' : T.bd),
              color: zoom === z.id ? T.bl : T.mu }}>{z.l}</button>
        ))}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 9, color: T.dm, fontFamily: T.m }}>
          {phases.length} phase{phases.length !== 1 ? 's' : ''} · {milestones.length} milestone{milestones.length !== 1 ? 's' : ''}
          {nextMs && <span style={{ color: T.am }}> · Next: {nextMs.name}</span>}
        </span>
      </div>

      {/* SVG Timeline */}
      <TimelineSVG trip={trip} phases={phases} milestones={milestones} zoom={zoom}
        selectedPhaseId={selectedPhaseId}
        onSelectPhase={p => setSelectedPhaseId(selectedPhaseId === p.id ? null : p.id)}
        onSelectMilestone={ms => { if (isAdmin && editable) setEditMilestone(ms); }} />

      {/* ═══════════════════════════════════════════ */}
      {/* ─── Phase Management ─── */}
      {/* ═══════════════════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.tx, fontFamily: T.u }}>Phases</div>
          {isAdmin && editable && !addPhase && <Bt v="primary" sm onClick={() => { setPresetName(null); setAddPhase(true); }}>+ Add Phase</Bt>}
        </div>

        {/* Quick presets */}
        {isAdmin && editable && !addPhase && phases.length === 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m, marginBottom: 6 }}>QUICK PRESETS:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {presetPhases.map(p => (
                <button key={p.name} onClick={() => { setPresetName(p.name); setAddPhase(true); }}
                  style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: 9, fontFamily: T.m, fontWeight: 600,
                    background: T.bl + '0a', border: '1px solid ' + T.bl + '22', color: T.bl }}>{p.name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Add phase form */}
        {addPhase && (
          <PhaseForm trip={trip} onCancel={() => { setAddPhase(false); setPresetName(null); }} onSave={createPhase}
            initial={presetName ? { name: presetName, ...getPresetDates(presetName), color: '', notes: '' } : null} />
        )}

        {/* Phase list */}
        {phases.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {phases.map((phase, idx) => {
              const color = phaseColor(phase, idx);
              const dur = daysBetween(phase.startDate, phase.endDate);
              const isEditing = editPhase?.id === phase.id;
              if (isEditing) {
                return <PhaseForm key={phase.id} trip={trip} onCancel={() => setEditPhase(null)}
                  onSave={data => updatePhase(phase.id, data)}
                  initial={{ name: phase.name, startDate: new Date(phase.startDate).toISOString().slice(0, 10),
                    endDate: new Date(phase.endDate).toISOString().slice(0, 10), color: phase.color || '', notes: phase.notes || '' }} />;
              }
              return (
                <div key={phase.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
                  background: selectedPhaseId === phase.id ? color + '0a' : 'rgba(255,255,255,.02)',
                  border: '1px solid ' + (selectedPhaseId === phase.id ? color + '33' : T.bd) }}
                  onClick={() => setSelectedPhaseId(selectedPhaseId === phase.id ? null : phase.id)}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m }}>{phase.name}</div>
                    <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m }}>
                      {fmtFull(phase.startDate)} - {fmtFull(phase.endDate)} · {dur}d
                      {phase.notes && <span style={{ color: T.mu, marginLeft: 6 }}>{phase.notes.length > 40 ? phase.notes.slice(0, 40) + '...' : phase.notes}</span>}
                    </div>
                  </div>
                  {isAdmin && editable && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      {idx > 0 && <button onClick={e => { e.stopPropagation(); movePhase(idx, -1); }}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 5px', fontSize: 9, color: T.mu, fontFamily: T.m }}>&#9650;</button>}
                      {idx < phases.length - 1 && <button onClick={e => { e.stopPropagation(); movePhase(idx, 1); }}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 5px', fontSize: 9, color: T.mu, fontFamily: T.m }}>&#9660;</button>}
                      <button onClick={e => { e.stopPropagation(); setEditPhase(phase); }}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', fontSize: 9, color: T.bl, fontFamily: T.m }}>Edit</button>
                      <button onClick={e => { e.stopPropagation(); setConfirmDel({ type: 'phase', id: phase.id, name: phase.name }); }}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', fontSize: 9, color: T.rd, fontFamily: T.m }}>Del</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {phases.length === 0 && !addPhase && (
          <div style={{ padding: 16, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 10 }}>
            No phases defined. {isAdmin && editable ? 'Use the presets above or add a custom phase.' : ''}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ─── Milestone Management ─── */}
      {/* ═══════════════════════════════════════════ */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.tx, fontFamily: T.u }}>Milestones</div>
          {isAdmin && editable && !addMilestone && <Bt v="primary" sm onClick={() => { setPresetMsName(null); setAddMilestone(true); }}>+ Add Milestone</Bt>}
        </div>

        {/* Quick presets */}
        {isAdmin && editable && !addMilestone && milestones.length === 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m, marginBottom: 6 }}>QUICK PRESETS:</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {milestonePresets.map(name => (
                <button key={name} onClick={() => { setPresetMsName(name); setAddMilestone(true); }}
                  style={{ all: 'unset', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, fontSize: 9, fontFamily: T.m, fontWeight: 600,
                    background: T.am + '0a', border: '1px solid ' + T.am + '22', color: T.am }}>{name}</button>
              ))}
            </div>
          </div>
        )}

        {/* Add milestone form */}
        {addMilestone && (
          <MilestoneForm trip={trip} onCancel={() => { setAddMilestone(false); setPresetMsName(null); }} onSave={createMilestone}
            initial={presetMsName ? { name: presetMsName, date: '', notes: '' } : null} />
        )}

        {/* Milestone list */}
        {milestones.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {milestones.map(ms => {
              const isOverdue = !ms.completed && new Date(ms.date).getTime() < now;
              const color = ms.completed ? T.gn : isOverdue ? T.rd : T.am;
              const isEditing = editMilestone?.id === ms.id;

              if (isEditing) {
                return <MilestoneForm key={ms.id} trip={trip} onCancel={() => setEditMilestone(null)}
                  onSave={data => updateMilestone(ms.id, data)}
                  initial={{ name: ms.name, date: new Date(ms.date).toISOString().slice(0, 10), notes: ms.notes || '' }} />;
              }

              return (
                <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6,
                  background: 'rgba(255,255,255,.02)', border: '1px solid ' + T.bd }}>
                  {/* Diamond icon */}
                  <svg width={14} height={14} style={{ flexShrink: 0 }}>
                    <polygon points="7,0 14,7 7,14 0,7" fill={color + '33'} stroke={color} strokeWidth={1.5} />
                  </svg>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m,
                        textDecoration: ms.completed ? 'line-through' : 'none', opacity: ms.completed ? 0.6 : 1 }}>{ms.name}</span>
                      {ms.completed && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: T.gn + '18',
                        color: T.gn, fontFamily: T.m, fontWeight: 600 }}>Completed</span>}
                      {isOverdue && <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: T.rd + '18',
                        color: T.rd, fontFamily: T.m, fontWeight: 600 }}>Overdue</span>}
                    </div>
                    <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m }}>
                      {fmtFull(ms.date)}
                      {ms.completedAt && <span style={{ marginLeft: 6, color: T.gn }}>Completed {fmtFull(ms.completedAt)}</span>}
                      {ms.notes && <span style={{ color: T.mu, marginLeft: 6 }}>{ms.notes.length > 40 ? ms.notes.slice(0, 40) + '...' : ms.notes}</span>}
                    </div>
                  </div>
                  {isAdmin && editable && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                      <button onClick={() => toggleMilestone(ms)}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', fontSize: 9, fontFamily: T.m,
                          color: ms.completed ? T.am : T.gn }}>{ms.completed ? 'Undo' : 'Done'}</button>
                      <button onClick={() => setEditMilestone(ms)}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', fontSize: 9, color: T.bl, fontFamily: T.m }}>Edit</button>
                      <button onClick={() => setConfirmDel({ type: 'milestone', id: ms.id, name: ms.name })}
                        style={{ all: 'unset', cursor: 'pointer', padding: '2px 6px', fontSize: 9, color: T.rd, fontFamily: T.m }}>Del</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {milestones.length === 0 && !addMilestone && (
          <div style={{ padding: 16, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 10 }}>
            No milestones defined. {isAdmin && editable ? 'Use the presets above or add a custom milestone.' : ''}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)}
        onConfirm={async () => {
          if (confirmDel?.type === 'phase') await deletePhase(confirmDel.id);
          else if (confirmDel?.type === 'milestone') await deleteMilestone(confirmDel.id);
          setConfirmDel(null);
        }}
        title={`Delete ${confirmDel?.type === 'phase' ? 'Phase' : 'Milestone'}?`}
        message={`Delete "${confirmDel?.name}"? This cannot be undone.`}
        confirmLabel="Delete" confirmColor={T.rd} />
    </div>
  );
}
