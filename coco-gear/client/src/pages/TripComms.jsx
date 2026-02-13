import { useState, useEffect, useRef } from 'react';
import { T } from '../theme/theme.js';
import { Bg, Bt, Fl, In, Sl, SH, ModalWrap, ConfirmDialog } from '../components/ui/index.js';
import api from '../api.js';

const TYPE_OPTIONS = [
  { v: 'radio_channel', l: 'Radio Channel' },
  { v: 'phone', l: 'Phone' },
  { v: 'email', l: 'Email' },
  { v: 'satellite', l: 'Satellite' },
  { v: 'other', l: 'Other' },
];
const TYPE_LABELS = { radio_channel: 'Radio Channel', phone: 'Phone', email: 'Email', satellite: 'Satellite', other: 'Other' };
const TYPE_ICONS = { radio_channel: '\u{1F4FB}', phone: '\u{1F4DE}', email: '\u2709', satellite: '\u{1F4E1}', other: '\u25CB' };
const TYPE_COLORS = { radio_channel: T.bl, phone: T.gn, email: T.am, satellite: T.pu, other: T.mu };
const TYPE_GROUPS = ['radio_channel', 'phone', 'email', 'satellite', 'other'];
const VALUE_PLACEHOLDERS = {
  radio_channel: 'e.g. Ch 16, 156.800 MHz',
  phone: 'e.g. +1-555-0100',
  email: 'e.g. ops@example.com',
  satellite: 'e.g. Iridium 8816-555-0100',
  other: 'e.g. Slack #ops-channel',
};

const emptyForm = () => ({ type: 'radio_channel', label: '', value: '', assignedToId: '', notes: '' });

function TripComms({ tripId, tripName, tripLocation, tripStart, tripEnd, tripPersonnel, isAdmin, editable, onCommsCountChange }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addMd, setAddMd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [confirmDel, setConfirmDel] = useState(null);
  const [printing, setPrinting] = useState(false);
  const printRef = useRef(null);

  useEffect(() => { loadEntries(); }, [tripId]);
  useEffect(() => { if (onCommsCountChange) onCommsCountChange(entries.length); }, [entries.length]);

  // Clear printing state after print completes
  useEffect(() => {
    const onAfterPrint = () => setPrinting(false);
    window.addEventListener('afterprint', onAfterPrint);
    return () => window.removeEventListener('afterprint', onAfterPrint);
  }, []);

  const loadEntries = async () => {
    try {
      const data = await api.comms.list(tripId);
      setEntries(data);
    } catch (e) { console.error('Load comms error:', e); }
    setLoading(false);
  };

  const createEntry = async () => {
    if (!form.label.trim() || !form.value.trim()) return;
    try {
      await api.comms.create(tripId, {
        type: form.type,
        label: form.label.trim(),
        value: form.value.trim(),
        assignedToId: form.assignedToId || undefined,
        notes: form.notes.trim() || undefined,
      });
      await loadEntries();
      setForm(emptyForm());
      setAddMd(false);
    } catch (e) { alert(e.message); }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    setForm({
      type: entry.type,
      label: entry.label,
      value: entry.value,
      assignedToId: entry.assignedToId || '',
      notes: entry.notes || '',
    });
    setAddMd(true);
  };

  const saveEdit = async () => {
    if (!editingId || !form.label.trim() || !form.value.trim()) return;
    try {
      await api.comms.update(tripId, editingId, {
        type: form.type,
        label: form.label.trim(),
        value: form.value.trim(),
        assignedToId: form.assignedToId || null,
        notes: form.notes.trim() || null,
      });
      setEditingId(null);
      setAddMd(false);
      await loadEntries();
    } catch (e) { alert(e.message); }
  };

  const deleteEntry = async () => {
    if (!confirmDel) return;
    try {
      await api.comms.delete(tripId, confirmDel);
      setConfirmDel(null);
      await loadEntries();
    } catch (e) { alert(e.message); }
  };

  const moveEntry = async (idx, dir) => {
    const list = [...entries];
    const ni = idx + dir;
    if (ni < 0 || ni >= list.length) return;
    [list[idx], list[ni]] = [list[ni], list[idx]];
    try {
      await api.comms.reorder(tripId, list.map(e => e.id));
      await loadEntries();
    } catch (e) { alert(e.message); }
  };

  const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?';

  const fmtD = d => d ? new Date(d).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '';

  const handlePrint = () => {
    setPrinting(true);
    setTimeout(() => window.print(), 100);
  };

  const grouped = TYPE_GROUPS.map(type => ({
    type,
    entries: entries.filter(e => e.type === type),
  })).filter(g => g.entries.length > 0);

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>Loading comms plan...</div>;

  return (
    <div>
      {/* Print-only comms card */}
      {printing && <div className="comms-print-card" ref={printRef}>
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            .comms-print-card, .comms-print-card * { visibility: visible !important; }
            .comms-print-card {
              position: fixed !important; left: 0; top: 0; width: 100%; background: #fff !important;
              color: #000 !important; padding: 10mm 12mm !important; font-family: 'IBM Plex Mono', monospace !important;
              font-size: 10pt !important; z-index: 999999;
            }
            .comms-print-card table { border-collapse: collapse; width: 100%; }
            .comms-print-card th, .comms-print-card td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
            .comms-print-card th { background: #eeeef4 !important; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.8px; color: #0f0f23; }
            .comms-print-card td { font-size: 9pt; color: #1a1a2e; }
            .comms-print-card .val-col { font-weight: 700; font-size: 10pt; color: #0f0f23; }
            .comms-print-card .group-hdr { background: #f8f8fc !important; font-weight: 700; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; border-top: 2px solid #2563eb; }
            .comms-print-card .footer { margin-top: 12px; font-size: 7pt; color: #7a7a9a; border-top: 1px solid #d4d4de; padding-top: 6px; text-align: center; }
            * { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
          }
          @media screen { .comms-print-card { display: none; } }
        `}</style>
        <div style={{ textAlign: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '2px solid #2563eb' }}>
          <div style={{ fontSize: '9pt', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: 3, marginBottom: 4 }}>Communications Card</div>
          <div style={{ fontSize: '14pt', fontWeight: 800, letterSpacing: 1, color: '#0f0f23' }}>{tripName}</div>
          <div style={{ fontSize: '9pt', marginTop: 4, color: '#4a4a6a' }}>
            {fmtD(tripStart)} — {fmtD(tripEnd)}{tripLocation ? ' | ' + tripLocation : ''}
          </div>
        </div>
        <table>
          <thead><tr>
            <th style={{ width: '12%' }}>Type</th>
            <th style={{ width: '20%' }}>Label</th>
            <th style={{ width: '28%' }}>Value / Frequency</th>
            <th style={{ width: '18%' }}>Monitor</th>
            <th style={{ width: '22%' }}>Notes</th>
          </tr></thead>
          <tbody>
            {grouped.map(g => (
              <>{/* eslint-disable-next-line react/jsx-key */}
                <tr key={'gh-' + g.type}><td colSpan={5} className="group-hdr">{TYPE_ICONS[g.type]} {TYPE_LABELS[g.type]}s ({g.entries.length})</td></tr>
                {g.entries.map(e => (
                  <tr key={e.id}>
                    <td>{TYPE_ICONS[e.type]}</td>
                    <td style={{ fontWeight: 600 }}>{e.label}</td>
                    <td className="val-col">{e.value}</td>
                    <td>{e.assignedTo?.name || '—'}</td>
                    <td style={{ fontSize: '8pt', color: '#4a4a6a' }}>{e.notes || ''}</td>
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
        <div className="footer">Generated {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} | {entries.length} entries | COCO Gear</div>
      </div>}

      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m }}>
            Communications Plan ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {entries.length > 0 && <Bt sm onClick={handlePrint}>Print Comms Card</Bt>}
          {isAdmin && editable && <Bt v="primary" sm onClick={() => { setEditingId(null); setForm(emptyForm()); setAddMd(true); }}>+ Add Entry</Bt>}
        </div>
      </div>

      {/* Empty state */}
      {entries.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', borderRadius: 10, background: T.card, border: '1px solid ' + T.bd }}>
          <div style={{ fontSize: 20, marginBottom: 8 }}>{'\u{1F4FB}'}</div>
          <div style={{ fontSize: 12, color: T.sub, fontFamily: T.m, marginBottom: 4 }}>No communications plan defined yet.</div>
          <div style={{ fontSize: 10, color: T.dm, fontFamily: T.m, marginBottom: 14 }}>
            Add radio channels, phone numbers, and contact info for this operation.
          </div>
          {isAdmin && editable && <Bt v="primary" onClick={() => { setEditingId(null); setForm(emptyForm()); setAddMd(true); }}>Add Entry</Bt>}
        </div>
      )}

      {/* Grouped entries */}
      {grouped.map(g => {
        const tc = TYPE_COLORS[g.type];
        return (
          <div key={g.type} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid ' + tc + '22' }}>
              <span style={{ fontSize: 13 }}>{TYPE_ICONS[g.type]}</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: tc, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>
                {TYPE_LABELS[g.type]}s
              </span>
              <Bg color={tc} bg={tc + '18'}>{g.entries.length}</Bg>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {g.entries.map((entry, idx) => {
                const globalIdx = entries.indexOf(entry);
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 8,
                    background: T.card, border: '1px solid ' + T.bd, transition: 'all .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = T.bdH; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.bd; }}>

                    {/* Type icon */}
                    <div style={{ width: 28, height: 28, borderRadius: 6, background: tc + '12', border: '1px solid ' + tc + '22',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                      {TYPE_ICONS[entry.type]}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.tx, fontFamily: T.u, lineHeight: 1.3 }}>{entry.label}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: tc, fontFamily: T.m, lineHeight: 1.4, marginTop: 1 }}>{entry.value}</div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginTop: 3 }}>
                        {entry.assignedTo && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <div style={{ width: 16, height: 16, borderRadius: 8, background: T.bl + '22', border: '1px solid ' + T.bl + '33',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: T.bl, fontFamily: T.m }}>
                              {initials(entry.assignedTo.name)}
                            </div>
                            <span style={{ fontSize: 9, color: T.sub, fontFamily: T.m }}>{entry.assignedTo.name}</span>
                          </div>
                        )}
                        {entry.notes && <span style={{ fontSize: 9, color: T.dm, fontFamily: T.m, fontStyle: 'italic' }}>{entry.notes}</span>}
                      </div>
                    </div>

                    {/* Admin actions */}
                    {isAdmin && editable && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <button onClick={() => moveEntry(globalIdx, -1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 8, color: T.dm, padding: '0 2px', lineHeight: 1 }}
                            title="Move up">{'\u25B2'}</button>
                          <button onClick={() => moveEntry(globalIdx, 1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 8, color: T.dm, padding: '0 2px', lineHeight: 1 }}
                            title="Move down">{'\u25BC'}</button>
                        </div>
                        <Bt v="ghost" sm onClick={() => startEdit(entry)} style={{ fontSize: 9 }}>Edit</Bt>
                        <Bt v="ghost" sm onClick={() => setConfirmDel(entry.id)} style={{ color: T.rd, fontSize: 9 }}>{'\u00D7'}</Bt>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add/Edit Modal */}
      <ModalWrap open={addMd} onClose={() => { setAddMd(false); setEditingId(null); }} title={editingId ? 'Edit Comms Entry' : 'Add Comms Entry'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fl label="Type">
            <Sl options={TYPE_OPTIONS} value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} />
          </Fl>
          <Fl label="Label">
            <In value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              placeholder="e.g. Primary Ops, Emergency, Base Camp" />
          </Fl>
          <Fl label="Value">
            <In value={form.value} onChange={e => setForm(p => ({ ...p, value: e.target.value }))}
              placeholder={VALUE_PLACEHOLDERS[form.type] || ''} style={{ fontFamily: T.m }} />
          </Fl>
          <Fl label="Assigned To">
            <Sl options={[{ v: '', l: '— Unassigned —' }, ...tripPersonnel.map(p => ({ v: p.userId, l: p.name }))]}
              value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))} />
          </Fl>
          <Fl label="Notes">
            <In value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="e.g. Monitor during daylight hours, Check in every 2 hours" />
          </Fl>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Bt onClick={() => { setAddMd(false); setEditingId(null); }}>Cancel</Bt>
            <Bt v="primary" onClick={editingId ? saveEdit : createEntry}
              disabled={!form.label.trim() || !form.value.trim()}>
              {editingId ? 'Save Changes' : 'Add Entry'}
            </Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Delete confirmation */}
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={deleteEntry}
        title="Delete Comms Entry?" message="This will permanently delete this communications entry. This cannot be undone."
        confirmLabel="Delete Entry" confirmColor={T.rd} />
    </div>
  );
}

export default TripComms;
