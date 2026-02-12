import { useState, useEffect, useRef } from 'react';
import { T } from '../theme/theme.js';
import { Bt, Bg, ModalWrap, Ta } from '../components/ui/index.js';
import api from '../api.js';

const fmtD = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
const fmtDShort = d => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';
const fmtDT = d => d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

const phaseLabels = { 'pre-deployment': 'Pre-Deployment', deployment: 'Deployment', 'post-deployment': 'Post-Deployment' };
const priorityLabels = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done' };
const commsTypeLabels = { radio_channel: 'Radio', phone: 'Phone', email: 'Email', satellite: 'Satellite', other: 'Other' };

/* ── Report-specific styling (document-like, light background) ── */
const R = {
  bg: '#ffffff', tx: '#1a1a2e', sub: '#4a4a6a', mu: '#7a7a9a', bd: '#e2e2ea',
  hd: '#0f0f23', accent: '#2563eb', good: '#16a34a', warn: '#d97706', bad: '#dc2626',
  sectionBg: '#f8f8fc', tableBd: '#d4d4de', tableHd: '#eeeef4',
  font: "'Outfit', 'Segoe UI', sans-serif", mono: "'IBM Plex Mono', monospace",
};

function SectionHeader({ num, title }) {
  return (
    <div className="aar-section-break" style={{ marginTop: 36, marginBottom: 16, pageBreakBefore: num > 1 ? 'always' : 'auto' }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: R.accent, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
        Section {num}
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: R.hd, fontFamily: R.font, borderBottom: '2px solid ' + R.accent, paddingBottom: 6 }}>
        {title}
      </h2>
    </div>
  );
}

function Table({ headers, rows, colWidths }) {
  const ths = { padding: '8px 10px', fontSize: 11, fontWeight: 700, color: R.hd, fontFamily: R.mono, textAlign: 'left',
    borderBottom: '2px solid ' + R.tableBd, background: R.tableHd, whiteSpace: 'nowrap' };
  const tds = { padding: '7px 10px', fontSize: 12, color: R.tx, fontFamily: R.font, borderBottom: '1px solid ' + R.tableBd, verticalAlign: 'top' };
  return (
    <div style={{ overflowX: 'auto', marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid ' + R.tableBd }}>
        <thead><tr>{headers.map((h, i) => <th key={i} style={{ ...ths, ...(colWidths?.[i] ? { width: colWidths[i] } : {}) }}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, ri) => <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : R.sectionBg }}>
          {row.map((cell, ci) => <td key={ci} style={tds}>{cell}</td>)}
        </tr>)}</tbody>
      </table>
    </div>
  );
}

function StatusBadge({ status }) {
  const colors = { GOOD: R.good, DAMAGED: R.warn, MISSING: R.bad, done: R.good, 'in-progress': R.accent, blocked: R.bad, todo: R.mu };
  const labels = { GOOD: 'Good', DAMAGED: 'Damaged', MISSING: 'Missing', ...statusLabels };
  const c = colors[status] || R.mu;
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    fontFamily: R.mono, color: c, background: c + '15', border: '1px solid ' + c + '33' }}>{labels[status] || status}</span>;
}

function PriorityBadge({ priority }) {
  const colors = { low: R.mu, medium: R.accent, high: R.warn, critical: R.bad };
  const c = colors[priority] || R.mu;
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
    fontFamily: R.mono, color: c, background: c + '15' }}>{priorityLabels[priority] || priority}</span>;
}

/* ── Markdown generator ── */
function generateMarkdown(data) {
  const d = data;
  const t = d.trip;
  let md = '';
  const ln = (s = '') => { md += s + '\n'; };
  const tbl = (headers, rows) => {
    ln('| ' + headers.join(' | ') + ' |');
    ln('| ' + headers.map(() => '---').join(' | ') + ' |');
    rows.forEach(r => ln('| ' + r.join(' | ') + ' |'));
    ln();
  };

  ln('# After-Action Report: ' + t.name);
  ln();
  ln('**Dates:** ' + fmtD(t.startDate) + ' — ' + fmtD(t.endDate) + ' (' + t.duration + ' days)');
  ln('**Location:** ' + (t.location || 'N/A'));
  ln('**Trip Lead:** ' + (t.lead ? t.lead.name + (t.lead.title ? ', ' + t.lead.title : '') : 'N/A'));
  ln('**Generated:** ' + new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));
  ln();

  // Executive Summary
  ln('## 1. Executive Summary');
  ln();
  const pct = d.summary.tasksTotal > 0 ? Math.round((d.summary.tasksCompleted / d.summary.tasksTotal) * 100) : 0;
  ln(`${t.name} was conducted from ${fmtDShort(t.startDate)} to ${fmtDShort(t.endDate)} at ${t.location || 'unspecified location'} over ${t.duration} days.`);
  ln(`${d.summary.totalPersonnel} personnel from ${d.personnel.departments} department(s) participated. ${d.summary.totalKits} equipment kits and ${d.summary.totalUSVs} USVs were deployed.`);
  if (d.summary.tasksTotal > 0) ln(`${d.summary.tasksCompleted}/${d.summary.tasksTotal} tasks were completed (${pct}%).`);
  if (d.summary.equipmentIssuesFound > 0) ln(`${d.summary.equipmentIssuesFound} equipment issue(s) were identified during the operation.`);
  if (t.objectives) { ln(); ln('**Objectives:**'); ln(t.objectives); }
  ln();

  // Personnel
  ln('## 2. Personnel Roster');
  ln();
  tbl(['Name', 'Title', 'Department', 'Role'],
    d.personnel.byRole.flatMap(rg => rg.members.map(m => [m.name, m.title || '--', m.department || '--', m.tripRole])));

  // Equipment
  ln('## 3. Equipment Manifest');
  ln();
  d.equipment.byType.forEach(bt => ln(`- ${bt.count}x ${bt.typeName}`));
  ln();
  tbl(['Kit', 'Type', 'Department', 'Components', 'Condition'],
    d.equipment.kits.map(k => {
      const issues = k.components.filter(c => c.status !== 'GOOD').length;
      return [k.color, k.typeName, k.department || '--', String(k.components.length), issues > 0 ? issues + ' issue(s)' : 'Good'];
    }));

  // USVs
  if (d.usvs.length > 0) {
    ln('## 4. USV Manifest');
    ln();
    tbl(['Name', 'Type', 'Hull ID', 'Role', 'Notes'],
      d.usvs.map(u => [u.name, u.type || '--', u.hullId || '--', u.role, u.notes || '--']));
  }

  // Comms
  if (d.comms.length > 0) {
    ln('## 5. Communications Plan');
    ln();
    tbl(['Type', 'Label', 'Value', 'Monitor', 'Notes'],
      d.comms.map(c => [commsTypeLabels[c.type] || c.type, c.label, c.value, c.assignedTo || '--', c.notes || '--']));
  }

  // Tasks
  if (d.tasks.total > 0) {
    ln('## 6. Task Completion');
    ln();
    ln(`**${d.tasks.completed}/${d.tasks.total} tasks completed (${pct}%)**`);
    ln();
    d.tasks.byPhase.forEach(ph => {
      ln('### ' + (phaseLabels[ph.phase] || ph.phase));
      tbl(['Task', 'Priority', 'Assigned To', 'Status', 'Completed'],
        ph.tasks.map(tk => [tk.title, tk.priority, tk.assignedTo || '--', statusLabels[tk.status] || tk.status, tk.completedAt ? fmtDShort(tk.completedAt) : '--']));
    });
  }

  // Notes
  if (d.notes.byCategory.length > 0) {
    ln('## 7. Operations Log');
    ln();
    d.notes.byCategory.forEach(cat => {
      cat.notes.forEach(n => {
        ln(`**[${fmtDT(n.createdAt)}] ${n.authorName} (${cat.category}):**`);
        ln(n.content);
        ln();
      });
    });
  }

  // Equipment Issues
  if (d.equipmentIssues.damageReport.length > 0 || d.equipmentIssues.maintenanceEvents.length > 0) {
    ln('## 8. Equipment Issues');
    ln();
    if (d.equipmentIssues.damageReport.length > 0) {
      ln('### Component Issues');
      tbl(['Kit', 'Type', 'Component', 'Status'],
        d.equipmentIssues.damageReport.map(dr => [dr.kitColor, dr.kitType, dr.componentLabel, dr.status]));
    }
    if (d.equipmentIssues.maintenanceEvents.length > 0) {
      ln('### Maintenance Events');
      tbl(['Kit', 'Type', 'Maintenance', 'Reason', 'Dates'],
        d.equipmentIssues.maintenanceEvents.map(me => [me.kitColor, me.kitType, me.maintenanceType, me.reason || '--',
          fmtDShort(me.startDate) + (me.endDate ? ' — ' + fmtDShort(me.endDate) : ' — ongoing')]));
    }
  }

  // Activity
  if (d.activity.checkouts.length > 0 || d.activity.inspections.length > 0) {
    ln('## 9. Activity Summary');
    ln();
    if (d.activity.checkouts.length > 0) {
      ln('### Checkouts');
      tbl(['Kit', 'Person', 'Date'], d.activity.checkouts.map(co => [co.kitColor, co.personName, fmtDShort(co.date)]));
    }
    if (d.activity.returns.length > 0) {
      ln('### Returns');
      tbl(['Kit', 'Person', 'Date', 'Notes'], d.activity.returns.map(rt => [rt.kitColor, rt.personName, fmtDShort(rt.date), rt.notes || '--']));
    }
    if (d.activity.inspections.length > 0) {
      ln('### Inspections');
      tbl(['Kit', 'Inspector', 'Date', 'Issues Found'], d.activity.inspections.map(ins => [ins.kitColor, ins.inspector, fmtDShort(ins.date), String(ins.issuesFound)]));
    }
  }

  // Lessons Learned
  ln('## 10. Lessons Learned');
  ln();
  if (d.notes.afterAction.length > 0) {
    d.notes.afterAction.forEach(n => {
      ln(`**${n.authorName}** (${fmtDT(n.createdAt)}):  `);
      ln(n.content);
      ln();
    });
  } else {
    ln('_No after-action notes have been documented for this operation._');
  }

  return md;
}

/* ── Main AAR Component ── */
export default function TripAAR({ tripId, tripName, onClose, onAddNote }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lessonText, setLessonText] = useState('');
  const [addingLesson, setAddingLesson] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    if (!tripId) return;
    setLoading(true);
    setError('');
    api.trips.aar(tripId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message || 'Failed to load report'); setLoading(false); });
  }, [tripId]);

  const handlePrint = () => window.print();

  const handleExportMd = () => {
    if (!data) return;
    const md = generateMarkdown(data);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AAR-${data.trip.name.replace(/[^a-zA-Z0-9]/g, '-')}-${fmtDShort(data.trip.startDate).replace(/[^a-zA-Z0-9]/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddLesson = async () => {
    if (!lessonText.trim() || !onAddNote) return;
    setAddingLesson(true);
    try {
      await onAddNote({ content: lessonText.trim(), category: 'after-action' });
      setLessonText('');
      // Reload AAR data
      const d = await api.trips.aar(tripId);
      setData(d);
    } catch (e) { /* ignore */ }
    setAddingLesson(false);
  };

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(6px)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e', fontFamily: R.font, marginBottom: 8 }}>Generating After-Action Report</div>
        <div style={{ fontSize: 12, color: '#7a7a9a', fontFamily: R.mono }}>Compiling data for {tripName}...</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.6)' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#dc2626', marginBottom: 8 }}>Error Loading Report</div>
        <div style={{ fontSize: 12, color: '#7a7a9a', fontFamily: R.mono, marginBottom: 16 }}>{error}</div>
        <Bt onClick={onClose}>Close</Bt>
      </div>
    </div>
  );

  if (!data) return null;

  const d = data;
  const t = d.trip;
  const pct = d.summary.tasksTotal > 0 ? Math.round((d.summary.tasksCompleted / d.summary.tasksTotal) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: '#e8e8ee' }} className="aar-overlay">
      {/* Action bar — hidden in print */}
      <div className="aar-action-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
        background: T.panel, borderBottom: '1px solid ' + T.bd, flexShrink: 0 }}>
        <Bt onClick={onClose}>← Close</Bt>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>
          After-Action Report: {t.name}
        </div>
        <Bt onClick={handleExportMd}>Export Markdown</Bt>
        <Bt v="primary" onClick={handlePrint}>Print</Bt>
      </div>

      {/* Report body — scrollable */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }} className="aar-scroll">
        <div ref={reportRef} className="aar-report" style={{ maxWidth: 900, margin: '0 auto', background: R.bg, borderRadius: 8,
          boxShadow: '0 2px 20px rgba(0,0,0,.12)', padding: '48px 52px', color: R.tx, fontFamily: R.font, lineHeight: 1.6 }}>

          {/* COVER / HEADER */}
          <div style={{ textAlign: 'center', marginBottom: 40, paddingBottom: 32, borderBottom: '3px solid ' + R.accent }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: R.accent, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 3, marginBottom: 12 }}>
              After-Action Report
            </div>
            <h1 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 800, color: R.hd, fontFamily: R.font, lineHeight: 1.2 }}>
              {t.name}
            </h1>
            <div style={{ fontSize: 14, color: R.sub, marginBottom: 4 }}>
              {fmtD(t.startDate)} — {fmtD(t.endDate)} ({t.duration} days)
            </div>
            {t.location && <div style={{ fontSize: 14, color: R.sub, marginBottom: 4 }}>{t.location}</div>}
            {t.lead && <div style={{ fontSize: 13, color: R.mu, marginTop: 8 }}>
              Trip Lead: <strong style={{ color: R.tx }}>{t.lead.name}</strong>{t.lead.title ? ', ' + t.lead.title : ''}
            </div>}
            <div style={{ fontSize: 10, color: R.mu, fontFamily: R.mono, marginTop: 12 }}>
              Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>

          {/* EXECUTIVE SUMMARY */}
          <SectionHeader num={1} title="Executive Summary" />
          <div style={{ fontSize: 13, color: R.tx, lineHeight: 1.8, marginBottom: 8 }}>
            <strong>{t.name}</strong> was conducted from {fmtDShort(t.startDate)} to {fmtDShort(t.endDate)}{' '}
            at {t.location || 'an unspecified location'} over {t.duration} days.{' '}
            {d.summary.totalPersonnel} personnel from {d.personnel.departments} department{d.personnel.departments !== 1 ? 's' : ''} participated.{' '}
            {d.summary.totalKits} equipment kit{d.summary.totalKits !== 1 ? 's' : ''}{d.summary.totalUSVs > 0 ? ` and ${d.summary.totalUSVs} USV${d.summary.totalUSVs !== 1 ? 's' : ''}` : ''} {d.summary.totalKits + d.summary.totalUSVs === 1 ? 'was' : 'were'} deployed.
            {d.summary.tasksTotal > 0 && <>{' '}{d.summary.tasksCompleted}/{d.summary.tasksTotal} tasks were completed ({pct}%).</>}
            {d.summary.equipmentIssuesFound > 0 && <>{' '}{d.summary.equipmentIssuesFound} equipment issue{d.summary.equipmentIssuesFound !== 1 ? 's were' : ' was'} identified during the operation.</>}
          </div>
          {t.objectives && <div style={{ marginTop: 12, padding: '12px 16px', background: R.sectionBg, borderRadius: 6, border: '1px solid ' + R.bd }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: R.accent, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Objectives</div>
            <div style={{ fontSize: 12, color: R.tx, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{t.objectives}</div>
          </div>}

          {/* Summary stats grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginTop: 20, marginBottom: 8 }}>
            {[
              { label: 'Personnel', value: d.summary.totalPersonnel, color: R.accent },
              { label: 'Equipment Kits', value: d.summary.totalKits, color: '#8b5cf6' },
              { label: 'USVs', value: d.summary.totalUSVs, color: '#0891b2' },
              { label: 'Days', value: d.summary.daysOfOperation, color: '#059669' },
              { label: 'Tasks Done', value: d.summary.tasksTotal > 0 ? `${d.summary.tasksCompleted}/${d.summary.tasksTotal}` : '0', color: d.summary.tasksCompleted === d.summary.tasksTotal ? '#059669' : R.warn },
              { label: 'Issues Found', value: d.summary.equipmentIssuesFound, color: d.summary.equipmentIssuesFound > 0 ? R.bad : '#059669' },
            ].map((s, i) => <div key={i} style={{ padding: '12px 14px', borderRadius: 6, background: s.color + '08', border: '1px solid ' + s.color + '22', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: R.font }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 600, color: R.mu, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1 }}>{s.label}</div>
            </div>)}
          </div>

          {/* PERSONNEL ROSTER */}
          <SectionHeader num={2} title="Personnel Roster" />
          <div style={{ fontSize: 12, color: R.sub, marginBottom: 12 }}>
            {d.personnel.total} personnel assigned across {d.personnel.departments} department{d.personnel.departments !== 1 ? 's' : ''}
          </div>
          {d.personnel.byRole.map(rg => (
            <div key={rg.role} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: R.accent, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                {rg.roleName}s ({rg.members.length})
              </div>
              <Table
                headers={['Name', 'Title', 'Department']}
                rows={rg.members.map(m => [m.name, m.title || '--', m.department || '--'])}
              />
            </div>
          ))}

          {/* EQUIPMENT MANIFEST */}
          <SectionHeader num={3} title="Equipment Manifest" />
          <div style={{ fontSize: 12, color: R.sub, marginBottom: 8 }}>
            {d.equipment.totalKits} kit{d.equipment.totalKits !== 1 ? 's' : ''} deployed:
            {' '}{d.equipment.byType.map(bt => `${bt.count}x ${bt.typeName}`).join(', ')}
          </div>
          <Table
            headers={['Kit', 'Type', 'Department', 'Components', 'Serials', 'Condition']}
            rows={d.equipment.kits.map(k => {
              const issues = k.components.filter(c => c.status !== 'GOOD');
              const condCell = issues.length > 0
                ? <span style={{ color: R.bad, fontWeight: 600 }}>{issues.length} issue{issues.length !== 1 ? 's' : ''}</span>
                : <span style={{ color: R.good, fontWeight: 600 }}>Good</span>;
              return [
                <strong>{k.color}</strong>,
                k.typeName,
                k.department || '--',
                String(k.components.length),
                k.serialNumbers.length > 0 ? <span style={{ fontSize: 10, fontFamily: R.mono }}>{k.serialNumbers.join('; ')}</span> : '--',
                condCell,
              ];
            })}
          />

          {/* USV MANIFEST */}
          {d.usvs.length > 0 && <>
            <SectionHeader num={4} title="USV Manifest" />
            <Table
              headers={['Name', 'Type', 'Hull ID', 'Role', 'Notes']}
              rows={d.usvs.map(u => [<strong>{u.name}</strong>, u.type || '--', u.hullId || '--', u.role, u.notes || '--'])}
            />
          </>}

          {/* COMMUNICATIONS PLAN */}
          {d.comms.length > 0 && <>
            <SectionHeader num={d.usvs.length > 0 ? 5 : 4} title="Communications Plan" />
            <Table
              headers={['Type', 'Label', 'Value / Frequency', 'Monitor', 'Notes']}
              rows={d.comms.map(c => [
                commsTypeLabels[c.type] || c.type,
                <strong>{c.label}</strong>,
                <span style={{ fontFamily: R.mono, fontWeight: 600 }}>{c.value}</span>,
                c.assignedTo || '--',
                c.notes || '--',
              ])}
            />
          </>}

          {/* TASK COMPLETION */}
          {d.tasks.total > 0 && <>
            <SectionHeader num={d.usvs.length > 0 ? 6 : (d.comms.length > 0 ? 5 : 4)} title="Task Completion" />
            <div style={{ fontSize: 14, fontWeight: 600, color: R.tx, marginBottom: 4 }}>
              {d.tasks.completed}/{d.tasks.total} tasks completed ({pct}%)
            </div>
            <div style={{ height: 8, borderRadius: 4, background: R.tableBd, marginBottom: 20, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, width: pct + '%', background: pct === 100 ? R.good : R.accent, transition: 'width .3s' }} />
            </div>
            {d.tasks.byPhase.map(ph => (
              <div key={ph.phase} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.sub, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  {phaseLabels[ph.phase] || ph.phase} ({ph.completed}/{ph.total})
                </div>
                <Table
                  headers={['Task', 'Priority', 'Assigned To', 'Status', 'Completed']}
                  rows={ph.tasks.map(tk => [
                    tk.title,
                    <PriorityBadge priority={tk.priority} />,
                    tk.assignedTo || '--',
                    <StatusBadge status={tk.status} />,
                    tk.completedAt ? fmtDShort(tk.completedAt) : '--',
                  ])}
                />
              </div>
            ))}
            {d.tasks.incomplete.length > 0 && <div style={{ padding: '12px 16px', background: R.warn + '08', border: '1px solid ' + R.warn + '22', borderRadius: 6, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: R.warn, fontFamily: R.mono, marginBottom: 6 }}>
                INCOMPLETE TASKS ({d.tasks.incomplete.length})
              </div>
              {d.tasks.incomplete.map((tk, i) => (
                <div key={i} style={{ fontSize: 12, color: R.tx, padding: '4px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{tk.title}</span>
                  <PriorityBadge priority={tk.priority} />
                  <StatusBadge status={tk.status} />
                  {tk.assignedTo && <span style={{ fontSize: 10, color: R.mu }}>({tk.assignedTo})</span>}
                </div>
              ))}
            </div>}
          </>}

          {/* OPERATIONS LOG */}
          {d.notes.byCategory.length > 0 && (() => {
            let secNum = 4;
            if (d.usvs.length > 0) secNum++;
            if (d.comms.length > 0) secNum++;
            if (d.tasks.total > 0) secNum++;
            return <>
              <SectionHeader num={secNum} title="Operations Log" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {d.notes.byCategory.flatMap(cat => cat.notes.map(n => ({ ...n, category: cat.category })))
                  .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                  .map((n, i) => (
                    <div key={i} style={{ padding: '10px 14px', borderRadius: 6, background: R.sectionBg, border: '1px solid ' + R.bd, borderLeft: '3px solid ' + R.accent }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: R.hd }}>{n.authorName}</span>
                          <span style={{ fontSize: 9, fontWeight: 600, fontFamily: R.mono, padding: '2px 6px', borderRadius: 3,
                            background: R.accent + '12', color: R.accent, textTransform: 'uppercase' }}>{n.category}</span>
                        </div>
                        <span style={{ fontSize: 10, color: R.mu, fontFamily: R.mono }}>{fmtDT(n.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: R.tx, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{n.content}</div>
                    </div>
                  ))}
              </div>
            </>;
          })()}

          {/* EQUIPMENT ISSUES */}
          {(() => {
            const hasIssues = d.equipmentIssues.damageReport.length > 0 || d.equipmentIssues.maintenanceEvents.length > 0;
            let secNum = 4;
            if (d.usvs.length > 0) secNum++;
            if (d.comms.length > 0) secNum++;
            if (d.tasks.total > 0) secNum++;
            if (d.notes.byCategory.length > 0) secNum++;
            return <>
              <SectionHeader num={secNum} title="Equipment Issues" />
              {!hasIssues && <div style={{ fontSize: 13, color: R.good, fontWeight: 600, padding: '16px 0' }}>
                No equipment issues were reported during this operation.
              </div>}
              {d.equipmentIssues.damageReport.length > 0 && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.bad, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Component Issues ({d.equipmentIssues.damageReport.length})
                </div>
                <Table
                  headers={['Kit', 'Type', 'Component', 'Status']}
                  rows={d.equipmentIssues.damageReport.map(dr => [
                    <strong>{dr.kitColor}</strong>, dr.kitType, dr.componentLabel, <StatusBadge status={dr.status} />,
                  ])}
                />
              </>}
              {d.equipmentIssues.maintenanceEvents.length > 0 && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.warn, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Maintenance Events ({d.equipmentIssues.maintenanceEvents.length})
                </div>
                <Table
                  headers={['Kit', 'Type', 'Maintenance', 'Reason', 'Started', 'Completed']}
                  rows={d.equipmentIssues.maintenanceEvents.map(me => [
                    <strong>{me.kitColor}</strong>, me.kitType, me.maintenanceType,
                    me.reason || '--', fmtDShort(me.startDate), me.endDate ? fmtDShort(me.endDate) : 'Ongoing',
                  ])}
                />
              </>}
            </>;
          })()}

          {/* ACTIVITY SUMMARY */}
          {(() => {
            const hasActivity = d.activity.checkouts.length > 0 || d.activity.returns.length > 0 || d.activity.inspections.length > 0;
            let secNum = 5;
            if (d.usvs.length > 0) secNum++;
            if (d.comms.length > 0) secNum++;
            if (d.tasks.total > 0) secNum++;
            if (d.notes.byCategory.length > 0) secNum++;
            return <>
              <SectionHeader num={secNum} title="Activity Summary" />
              {!hasActivity && <div style={{ fontSize: 13, color: R.mu, padding: '8px 0' }}>No checkout, return, or inspection activity recorded during the trip window.</div>}
              {d.activity.checkouts.length > 0 && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.sub, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>
                  Checkouts ({d.activity.checkouts.length})
                </div>
                <Table headers={['Kit', 'Person', 'Date']}
                  rows={d.activity.checkouts.map(co => [<strong>{co.kitColor}</strong>, co.personName, fmtDShort(co.date)])} />
              </>}
              {d.activity.returns.length > 0 && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.sub, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 12 }}>
                  Returns ({d.activity.returns.length})
                </div>
                <Table headers={['Kit', 'Person', 'Date', 'Notes']}
                  rows={d.activity.returns.map(rt => [<strong>{rt.kitColor}</strong>, rt.personName, fmtDShort(rt.date), rt.notes || '--'])} />
              </>}
              {d.activity.inspections.length > 0 && <>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.sub, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 12 }}>
                  Inspections ({d.activity.inspections.length})
                </div>
                <Table headers={['Kit', 'Inspector', 'Date', 'Issues Found']}
                  rows={d.activity.inspections.map(ins => [<strong>{ins.kitColor}</strong>, ins.inspector, fmtDShort(ins.date),
                    ins.issuesFound > 0 ? <span style={{ color: R.bad, fontWeight: 600 }}>{ins.issuesFound}</span> : <span style={{ color: R.good }}>0</span>])} />
              </>}
            </>;
          })()}

          {/* LESSONS LEARNED */}
          {(() => {
            let secNum = 6;
            if (d.usvs.length > 0) secNum++;
            if (d.comms.length > 0) secNum++;
            if (d.tasks.total > 0) secNum++;
            if (d.notes.byCategory.length > 0) secNum++;
            return <>
              <SectionHeader num={secNum} title="Lessons Learned" />
              {d.notes.afterAction.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {d.notes.afterAction.map((n, i) => (
                    <div key={i} style={{ padding: '14px 18px', borderRadius: 8, background: R.warn + '06', border: '1px solid ' + R.warn + '22', borderLeft: '4px solid ' + R.warn }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: R.hd }}>{n.authorName}</span>
                        <span style={{ fontSize: 10, color: R.mu, fontFamily: R.mono }}>{fmtDT(n.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 13, color: R.tx, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{n.content}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: R.mu, fontStyle: 'italic', marginBottom: 8 }}>
                  No after-action notes have been documented for this operation.
                </div>
              )}
              {/* Add lesson form — hidden in print */}
              {onAddNote && <div className="aar-no-print" style={{ marginTop: 16, padding: '16px', borderRadius: 8, background: R.sectionBg, border: '1px solid ' + R.bd }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: R.accent, fontFamily: R.mono, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                  Add Lesson Learned
                </div>
                <textarea value={lessonText} onChange={e => setLessonText(e.target.value)}
                  placeholder="Document key observations, improvements, or recommendations for future operations..."
                  rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid ' + R.bd,
                    background: '#fff', color: R.tx, fontFamily: R.font, fontSize: 13, lineHeight: 1.6, resize: 'vertical', outline: 'none' }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button onClick={handleAddLesson} disabled={!lessonText.trim() || addingLesson}
                    style={{ padding: '8px 20px', borderRadius: 6, border: 'none', background: R.accent, color: '#fff',
                      fontFamily: R.font, fontSize: 12, fontWeight: 600, cursor: lessonText.trim() ? 'pointer' : 'not-allowed',
                      opacity: lessonText.trim() && !addingLesson ? 1 : 0.5 }}>
                    {addingLesson ? 'Saving...' : 'Save Lesson'}
                  </button>
                </div>
              </div>}
            </>;
          })()}

          {/* FOOTER */}
          <div style={{ marginTop: 48, paddingTop: 20, borderTop: '2px solid ' + R.bd, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: R.mu, fontFamily: R.mono }}>
              End of After-Action Report — {t.name}
            </div>
            <div style={{ fontSize: 9, color: R.mu, fontFamily: R.mono, marginTop: 4 }}>
              Generated by COCO Gear on {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>

      {/* Print styles injected as <style> */}
      <style>{`
        @media print {
          body { background: #fff !important; margin: 0 !important; }
          .aar-overlay { position: static !important; background: #fff !important; }
          .aar-action-bar { display: none !important; }
          .aar-no-print { display: none !important; }
          .aar-scroll { overflow: visible !important; padding: 0 !important; }
          .aar-report {
            max-width: 100% !important; margin: 0 !important; padding: 24px 32px !important;
            box-shadow: none !important; border-radius: 0 !important;
          }
          .aar-section-break { page-break-before: auto; }
          .aar-section-break h2 { page-break-after: avoid; }
          table { page-break-inside: avoid; }
          nav, header, .sidebar, [class*="nav"], [class*="sidebar"] { display: none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
