import { useState, useEffect, useMemo, useCallback } from 'react';
import { T, CM } from '../theme/theme.js';
import { Sw, Bg, Bt, Fl, In, Ta, Sl, SH, Tabs, ModalWrap, ConfirmDialog, ProgressBar, Tg } from '../components/ui/index.js';
import api from '../api.js';

const CATEGORIES = ['safety','electronics','clothing','documents','tools','general','other'];
const CAT_LABELS = {safety:'Safety',electronics:'Electronics',clothing:'Clothing',documents:'Documents',tools:'Tools',general:'General',other:'Other'};
const CAT_COLORS = {safety:T.rd,electronics:T.bl,clothing:T.pu,documents:T.am,tools:T.or,general:T.mu,other:T.dm};
const ROLE_LABELS = {director:'Director',manager:'Manager','senior-spec':'Senior Specialist',specialist:'Specialist',engineer:'Engineer',lead:'Lead',other:'Other'};
const ROLE_COLORS = {director:T.rd,manager:T.am,'senior-spec':T.or,specialist:T.bl,engineer:T.tl,lead:T.gn,other:T.pu};
const STATUS_COLORS = {GOOD:T.gn,MISSING:T.rd,DAMAGED:T.am};
const ROLE_OPTIONS = [{v:'specialist',l:'Specialist'},{v:'director',l:'Director'},{v:'manager',l:'Manager'},{v:'senior-spec',l:'Senior Specialist'},{v:'engineer',l:'Engineer'},{v:'lead',l:'Lead'},{v:'other',l:'Other'}];

function TripPacking({ tripId, tripPersonnel, isAdmin, isSuper, editable, curUserId, onPackingCountChange }) {
  const [data, setData] = useState(null);
  const [checks, setChecks] = useState({});
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [expandedKits, setExpandedKits] = useState({});
  const [expandedTpls, setExpandedTpls] = useState({});

  // Add item form
  const [addItemMd, setAddItemMd] = useState(null); // null | { tier, scope }
  const [itemForm, setItemForm] = useState({ name: '', quantity: 1, category: 'general', notes: '', required: true, scope: 'all' });

  // Template CRUD
  const [tplMd, setTplMd] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', role: '', category: 'general', isDefault: false, items: [{ name: '', quantity: 1, notes: '', required: true, category: 'general' }] });
  const [editingTplId, setEditingTplId] = useState(null);
  const [confirmDelTpl, setConfirmDelTpl] = useState(null);
  const [confirmDelItem, setConfirmDelItem] = useState(null);

  // Apply template picker
  const [applyTplMd, setApplyTplMd] = useState(null); // null | role

  // Print mode
  const [printMode, setPrintMode] = useState(null);

  const isUserOnTrip = useMemo(() => tripPersonnel.some(p => p.userId === curUserId), [tripPersonnel, curUserId]);
  const myTripRole = useMemo(() => {
    const p = tripPersonnel.find(p => p.userId === curUserId);
    return p?.tripRole || p?.role || null;
  }, [tripPersonnel, curUserId]);

  // Default sub-tab: "my" for non-admins on trip, "equipment" otherwise
  useEffect(() => {
    if (subTab === null) {
      setSubTab(isUserOnTrip && !isAdmin ? 'my' : 'equipment');
    }
  }, [isUserOnTrip, isAdmin, subTab]);

  const loadData = useCallback(async () => {
    try {
      const result = await api.packing.get(tripId);
      setData(result);
      setChecks(result.checks || {});
    } catch (e) { console.error('Load packing error:', e); }
    setLoading(false);
  }, [tripId]);

  const loadTemplates = useCallback(async () => {
    try { const t = await api.packingTemplates.list(); setTemplates(t); } catch (e) {}
  }, []);

  useEffect(() => { loadData(); }, [tripId, loadData]);
  useEffect(() => { if (subTab === 'templates') loadTemplates(); }, [subTab, loadTemplates]);

  // Report progress
  useEffect(() => {
    if (!data || !onPackingCountChange) return;
    const myPerson = data.personal?.byPerson?.find(p => p.user.id === curUserId);
    if (myPerson) {
      const total = myPerson.items.length;
      const checked = myPerson.items.filter(i => checks[i.itemKey]).length;
      onPackingCountChange(checked, total);
    }
  }, [data, checks, curUserId, onPackingCountChange]);

  const toggleCheck = async (itemKey) => {
    const newVal = !checks[itemKey];
    setChecks(prev => ({ ...prev, [itemKey]: newVal }));
    try { await api.packing.check(tripId, itemKey, newVal); } catch (e) { setChecks(prev => ({ ...prev, [itemKey]: !newVal })); }
  };

  const addItem = async () => {
    if (!itemForm.name.trim() || !addItemMd) return;
    try {
      await api.packing.addItem(tripId, {
        tier: addItemMd.tier,
        scope: addItemMd.tier === 'equipment' ? 'all' : itemForm.scope,
        category: itemForm.category,
        name: itemForm.name.trim(),
        quantity: itemForm.quantity || 1,
        notes: itemForm.notes.trim() || undefined,
        required: itemForm.required,
      });
      setAddItemMd(null);
      setItemForm({ name: '', quantity: 1, category: 'general', notes: '', required: true, scope: 'all' });
      await loadData();
    } catch (e) { alert(e.message); }
  };

  const deleteItem = async () => {
    if (!confirmDelItem) return;
    try {
      await api.packing.deleteItem(tripId, confirmDelItem);
      setConfirmDelItem(null);
      await loadData();
    } catch (e) { alert(e.message); }
  };

  const applyTemplate = async (tplId, role) => {
    try {
      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) return;
      const items = (tpl.items || []).map((item, i) => ({
        tier: 'personal',
        scope: role || 'all',
        category: item.category || 'general',
        name: item.name,
        quantity: item.quantity || 1,
        notes: item.notes || '',
        required: item.required !== false,
        sortOrder: i,
      }));
      await api.packing.bulkAddItems(tripId, items);
      setApplyTplMd(null);
      await loadData();
    } catch (e) { alert(e.message); }
  };

  // Template CRUD
  const openCreateTpl = () => { setEditingTplId(null); setTplForm({ name: '', role: '', category: 'general', isDefault: false, items: [{ name: '', quantity: 1, notes: '', required: true, category: 'general' }] }); setTplMd(true); };
  const openEditTpl = (tpl) => {
    setEditingTplId(tpl.id);
    setTplForm({
      name: tpl.name, role: tpl.role || '', category: tpl.category || 'general', isDefault: tpl.isDefault || false,
      items: (tpl.items || []).length > 0 ? tpl.items.map(i => ({ name: i.name || '', quantity: i.quantity || 1, notes: i.notes || '', required: i.required !== false, category: i.category || 'general' })) : [{ name: '', quantity: 1, notes: '', required: true, category: 'general' }],
    });
    setTplMd(true);
  };
  const cloneTpl = (tpl) => {
    setEditingTplId(null);
    setTplForm({
      name: tpl.name + ' (Copy)', role: tpl.role || '', category: tpl.category || 'general', isDefault: false,
      items: (tpl.items || []).map(i => ({ name: i.name || '', quantity: i.quantity || 1, notes: i.notes || '', required: i.required !== false, category: i.category || 'general' })),
    });
    setTplMd(true);
  };
  const saveTpl = async () => {
    if (!tplForm.name.trim()) return;
    const validItems = tplForm.items.filter(i => i.name.trim());
    if (validItems.length === 0) { alert('Add at least one item'); return; }
    const payload = { name: tplForm.name.trim(), role: tplForm.role || null, category: tplForm.category, isDefault: tplForm.isDefault, items: validItems };
    try {
      if (editingTplId) { await api.packingTemplates.update(editingTplId, payload); }
      else { await api.packingTemplates.create(payload); }
      setTplMd(false);
      await loadTemplates();
      await loadData();
    } catch (e) { alert(e.message); }
  };
  const deleteTpl = async () => {
    if (!confirmDelTpl) return;
    try { await api.packingTemplates.delete(confirmDelTpl); setConfirmDelTpl(null); await loadTemplates(); } catch (e) { alert(e.message); }
  };
  const addTplItem = () => setTplForm(p => ({ ...p, items: [...p.items, { name: '', quantity: 1, notes: '', required: true, category: 'general' }] }));
  const removeTplItem = (i) => setTplForm(p => ({ ...p, items: p.items.filter((_, j) => j !== i) }));
  const updateTplItem = (i, field, val) => setTplForm(p => ({ ...p, items: p.items.map((t, j) => j === i ? { ...t, [field]: val } : t) }));
  const moveTplItem = (i, dir) => {
    const ni = i + dir;
    if (ni < 0 || ni >= tplForm.items.length) return;
    setTplForm(p => {
      const items = [...p.items];
      [items[i], items[ni]] = [items[ni], items[i]];
      return { ...p, items };
    });
  };

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>Loading packing lists...</div>;
  if (!data) return <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>Failed to load packing data.</div>;

  const { equipment, personal } = data;

  const CatBg = ({ cat }) => <Bg color={CAT_COLORS[cat] || T.mu} bg={(CAT_COLORS[cat] || T.mu) + '18'}>{CAT_LABELS[cat] || cat}</Bg>;

  const CheckBox = ({ checked, onChange, size = 16 }) => (
    <button onClick={onChange} style={{ all: 'unset', cursor: 'pointer', width: size, height: size, borderRadius: 4, flexShrink: 0,
      border: '1.5px solid ' + (checked ? T.gn : T.bd), background: checked ? T.gn : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size - 5, color: '#fff', fontWeight: 700 }}>
      {checked ? '✓' : ''}
    </button>
  );

  const PrintCheckBox = () => (
    <span style={{ display: 'inline-block', width: 12, height: 12, border: '1.5px solid #333', borderRadius: 2, marginRight: 6, verticalAlign: 'middle' }} />
  );

  // ─── EQUIPMENT SUB-TAB ───
  const EquipmentTab = () => {
    const totalKits = equipment.summary.totalKits;
    const checkedKits = equipment.byLocation.reduce((sum, loc) =>
      sum + loc.kits.filter(k => checks['kit:' + k.id]).length, 0);

    return (<div>
      {/* Summary bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m, marginBottom: 4 }}>
            {totalKits} kits from {equipment.summary.locationCount} locations — {checkedKits}/{totalKits} packed
          </div>
          <ProgressBar value={checkedKits} max={Math.max(totalKits, 1)} color={checkedKits === totalKits ? T.gn : T.bl} height={5} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <Bt sm onClick={() => { setPrintMode('equipment'); setTimeout(() => window.print(), 100); }}>Print</Bt>
        </div>
      </div>

      {/* By location */}
      {equipment.byLocation.map(loc => (
        <div key={loc.location.id} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid ' + T.ind + '22' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: T.ind }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: T.ind, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>
              {loc.location.name} ({loc.location.shortCode})
            </span>
            <Bg color={T.ind} bg={T.ind + '18'}>{loc.kits.length} kits</Bg>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {loc.kits.map(kit => {
              const isExpanded = expandedKits[kit.id];
              const isChecked = checks['kit:' + kit.id];
              return (
                <div key={kit.id} style={{ padding: '8px 12px', borderRadius: 8, background: isChecked ? T.gn + '06' : T.card,
                  border: '1px solid ' + (isChecked ? T.gn + '22' : T.bd) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckBox checked={isChecked} onChange={() => toggleCheck('kit:' + kit.id)} />
                    <Sw color={kit.color} size={20} />
                    <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedKits(p => ({ ...p, [kit.id]: !p[kit.id] }))}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isChecked ? T.dm : T.tx, fontFamily: T.m, textDecoration: isChecked ? 'line-through' : 'none' }}>
                        {kit.color} <span style={{ color: T.dm }}>({kit.typeName})</span>
                      </div>
                      {kit.deptName && <Bg color={T.mu} bg={T.mu + '18'}>{kit.deptName}</Bg>}
                    </div>
                    <button onClick={() => setExpandedKits(p => ({ ...p, [kit.id]: !p[kit.id] }))}
                      style={{ all: 'unset', cursor: 'pointer', fontSize: 9, color: T.dm, padding: '2px 6px' }}>{isExpanded ? '▲' : '▼'}</button>
                  </div>
                  {isExpanded && kit.components.length > 0 && (
                    <div style={{ marginTop: 8, marginLeft: 28, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {kit.components.map(comp => (
                        <div key={comp.componentId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, fontFamily: T.m }}>
                          <span style={{ color: T.sub }}>{comp.label}</span>
                          {comp.quantity > 1 && <span style={{ color: T.dm }}>×{comp.quantity}</span>}
                          {comp.serialNumbers.length > 0 && <span style={{ color: T.dm }}>S/N: {comp.serialNumbers.join(', ')}</span>}
                          <Bg color={STATUS_COLORS[comp.status] || T.mu} bg={(STATUS_COLORS[comp.status] || T.mu) + '18'}>{comp.status}</Bg>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Additional equipment items */}
      {(equipment.tripItems.length > 0 || (isAdmin && editable)) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: T.or, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8,
            paddingBottom: 4, borderBottom: '1px solid ' + T.or + '22' }}>Additional Equipment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {equipment.tripItems.map(item => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
                background: checks['trip:' + item.id] ? T.gn + '06' : 'rgba(255,255,255,.02)', border: '1px solid ' + (checks['trip:' + item.id] ? T.gn + '15' : T.bd) }}>
                <CheckBox checked={checks['trip:' + item.id]} onChange={() => toggleCheck('trip:' + item.id)} />
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: checks['trip:' + item.id] ? T.dm : T.tx, fontFamily: T.m,
                    textDecoration: checks['trip:' + item.id] ? 'line-through' : 'none' }}>{item.name}</span>
                  {item.quantity > 1 && <span style={{ fontSize: 9, color: T.dm, fontFamily: T.m, marginLeft: 4 }}>×{item.quantity}</span>}
                  {item.notes && <span style={{ fontSize: 8, color: T.dm, fontFamily: T.m, marginLeft: 6 }}>{item.notes}</span>}
                </div>
                <CatBg cat={item.category} />
                {isAdmin && editable && <button onClick={() => setConfirmDelItem(item.id)}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 10, color: T.rd, opacity: .5, padding: '2px 4px' }}>×</button>}
              </div>
            ))}
          </div>
          {isAdmin && editable && <Bt sm style={{ marginTop: 8 }} onClick={() => {
            setItemForm({ name: '', quantity: 1, category: 'general', notes: '', required: true, scope: 'all' });
            setAddItemMd({ tier: 'equipment', scope: 'all' });
          }}>+ Add Item</Bt>}
        </div>
      )}
    </div>);
  };

  // ─── PERSONAL SUB-TAB ───
  const PersonalTab = () => {
    const byRole = personal.byRole || [];

    return (<div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap' }}>
        <Bt sm onClick={() => { setPrintMode('personal-role'); setTimeout(() => window.print(), 100); }}>Print (Role Summary)</Bt>
        <Bt sm onClick={() => { setPrintMode('personal-individual'); setTimeout(() => window.print(), 100); }}>Print (Individual Lists)</Bt>
      </div>

      {byRole.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>No personnel assigned to this trip yet.</div>}

      {byRole.map(roleGroup => (
        <div key={roleGroup.role} style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, paddingBottom: 4,
            borderBottom: '1px solid ' + (ROLE_COLORS[roleGroup.role] || T.mu) + '22' }}>
            <div style={{ width: 8, height: 8, borderRadius: 4, background: ROLE_COLORS[roleGroup.role] || T.mu }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: ROLE_COLORS[roleGroup.role] || T.mu, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>
              {roleGroup.roleName}
            </span>
            <Bg color={ROLE_COLORS[roleGroup.role] || T.mu} bg={(ROLE_COLORS[roleGroup.role] || T.mu) + '18'}>{roleGroup.personnel.length} personnel</Bg>
          </div>

          {/* Items grouped by category */}
          {CATEGORIES.filter(cat => roleGroup.items.some(i => (i.category || 'general') === cat)).map(cat => (
            <div key={cat} style={{ marginBottom: 8, marginLeft: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: CAT_COLORS[cat] || T.mu, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                {CAT_LABELS[cat]}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {roleGroup.items.filter(i => (i.category || 'general') === cat).map((item, idx) => (
                  <div key={item.itemKey || idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', borderRadius: 4,
                    background: 'rgba(255,255,255,.02)', border: '1px solid ' + T.bd }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: T.tx, fontFamily: T.m, flex: 1 }}>
                      {item.name}
                      {item.quantity > 1 && <span style={{ color: T.dm }}> ×{item.quantity}</span>}
                      {item.required && <span style={{ color: T.rd, fontSize: 8, marginLeft: 3 }}>*</span>}
                    </span>
                    {item.notes && <span style={{ fontSize: 8, color: T.dm, fontFamily: T.m }}>{item.notes}</span>}
                    {item.source === 'template' && <Bg color={T.pu} bg={T.pu + '18'}>Template: {item.templateName}</Bg>}
                    {item.source === 'trip' && isAdmin && editable && (
                      <button onClick={() => setConfirmDelItem(item.id)}
                        style={{ all: 'unset', cursor: 'pointer', fontSize: 10, color: T.rd, opacity: .5, padding: '2px 4px' }}>×</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {isAdmin && editable && <div style={{ display: 'flex', gap: 4, marginTop: 8, marginLeft: 8 }}>
            <Bt sm onClick={() => {
              setItemForm({ name: '', quantity: 1, category: 'general', notes: '', required: true, scope: roleGroup.role });
              setAddItemMd({ tier: 'personal', scope: roleGroup.role });
            }}>+ Add Item</Bt>
            <Bt sm onClick={() => { loadTemplates(); setApplyTplMd(roleGroup.role); }}>Apply Template</Bt>
          </div>}
        </div>
      ))}
    </div>);
  };

  // ─── MY LIST SUB-TAB ───
  const MyListTab = () => {
    if (!isUserOnTrip) {
      return (<div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>
        You are not assigned to this trip. View the Personal tab to see packing requirements by role.
      </div>);
    }

    const myPerson = personal.byPerson?.find(p => p.user.id === curUserId);
    if (!myPerson) return <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>No packing items found for your role.</div>;

    const myItems = myPerson.items;
    const totalItems = myItems.length;
    const checkedItems = myItems.filter(i => checks[i.itemKey]).length;
    const pct = totalItems > 0 ? Math.round(checkedItems / totalItems * 100) : 0;

    return (<div>
      {/* Progress bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m, marginBottom: 4 }}>
            {checkedItems}/{totalItems} items packed ({pct}%)
          </div>
          <ProgressBar value={checkedItems} max={Math.max(totalItems, 1)} color={pct === 100 ? T.gn : T.bl} height={5} />
        </div>
        {myTripRole && <Bg color={ROLE_COLORS[myTripRole] || T.mu} bg={(ROLE_COLORS[myTripRole] || T.mu) + '18'}>{ROLE_LABELS[myTripRole] || myTripRole}</Bg>}
      </div>

      {totalItems === 0 && <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>No packing items for your role yet.</div>}

      {/* Items by category */}
      {CATEGORIES.filter(cat => myItems.some(i => (i.category || 'general') === cat)).map(cat => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: CAT_COLORS[cat] || T.mu, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
            paddingBottom: 3, borderBottom: '1px solid ' + (CAT_COLORS[cat] || T.mu) + '22' }}>{CAT_LABELS[cat]}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {myItems.filter(i => (i.category || 'general') === cat).map((item, idx) => {
              const isChk = checks[item.itemKey];
              return (
                <div key={item.itemKey || idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 6,
                  background: isChk ? T.gn + '06' : 'rgba(255,255,255,.02)', border: '1px solid ' + (isChk ? T.gn + '15' : T.bd) }}>
                  <CheckBox checked={isChk} onChange={() => toggleCheck(item.itemKey)} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: isChk ? T.dm : T.tx, fontFamily: T.m,
                      textDecoration: isChk ? 'line-through' : 'none' }}>
                      {item.name}
                      {item.quantity > 1 && <span style={{ color: T.dm }}> ×{item.quantity}</span>}
                    </span>
                    {item.required && <span style={{ color: T.rd, fontSize: 8, marginLeft: 3 }}>Required</span>}
                    {item.notes && <div style={{ fontSize: 8, color: T.dm, fontFamily: T.m, marginTop: 1 }}>{item.notes}</div>}
                  </div>
                  {isChk && <span style={{ color: T.gn, fontSize: 12 }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>);
  };

  // ─── TEMPLATES SUB-TAB ───
  const TemplatesTab = () => {
    return (<div>
      {isAdmin && <div style={{ marginBottom: 14 }}><Bt v="primary" sm onClick={openCreateTpl}>+ New Template</Bt></div>}

      {templates.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>No packing templates yet.{isAdmin ? ' Create one to get started.' : ''}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.map(tpl => {
          const isExpanded = expandedTpls[tpl.id];
          const items = tpl.items || [];
          return (
            <div key={tpl.id} style={{ padding: '10px 14px', borderRadius: 8, background: T.card, border: '1px solid ' + T.bd }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setExpandedTpls(p => ({ ...p, [tpl.id]: !p[tpl.id] }))}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{tpl.name}</span>
                    {tpl.role ? <Bg color={ROLE_COLORS[tpl.role] || T.mu} bg={(ROLE_COLORS[tpl.role] || T.mu) + '18'}>{ROLE_LABELS[tpl.role] || tpl.role}</Bg>
                      : <Bg color={T.pu} bg={T.pu + '18'}>Add-on</Bg>}
                    {tpl.isDefault && <Bg color={T.gn} bg={T.gn + '18'}>Auto-apply</Bg>}
                    <Bg color={T.mu} bg={T.mu + '18'}>{items.length} items</Bg>
                  </div>
                </div>
                {isAdmin && <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  <Bt sm onClick={() => openEditTpl(tpl)}>Edit</Bt>
                  <Bt sm onClick={() => cloneTpl(tpl)}>Clone</Bt>
                  <Bt v="danger" sm onClick={() => setConfirmDelTpl(tpl.id)}>Delete</Bt>
                </div>}
                <button onClick={() => setExpandedTpls(p => ({ ...p, [tpl.id]: !p[tpl.id] }))}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: 9, color: T.dm, padding: '2px 6px' }}>{isExpanded ? '▲' : '▼'}</button>
              </div>
              {isExpanded && items.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,.02)' }}>
                      <span style={{ fontSize: 10, color: T.tx, fontFamily: T.m, flex: 1 }}>
                        {item.name}
                        {item.quantity > 1 && <span style={{ color: T.dm }}> ×{item.quantity}</span>}
                        {item.required && <span style={{ color: T.rd, fontSize: 8, marginLeft: 3 }}>*</span>}
                      </span>
                      <CatBg cat={item.category || 'general'} />
                      {item.notes && <span style={{ fontSize: 8, color: T.dm, fontFamily: T.m }}>{item.notes}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>);
  };

  // ─── PRINT VIEWS ───
  const PrintEquipment = () => (
    <div className="print-only" style={{ padding: 20, fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Equipment Packing List</h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>Generated {new Date().toLocaleDateString()}</div>
      {equipment.byLocation.map(loc => (
        <div key={loc.location.id} style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>{loc.location.name} ({loc.location.shortCode}) — {loc.kits.length} kits</h3>
          {loc.kits.map(kit => (
            <div key={kit.id} style={{ marginLeft: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11 }}><PrintCheckBox /><strong>{kit.color}</strong> — {kit.typeName}{kit.deptName ? ' [' + kit.deptName + ']' : ''}</div>
              {kit.components.map(comp => (
                <div key={comp.componentId} style={{ marginLeft: 24, fontSize: 9, color: '#444' }}>
                  {comp.label}{comp.quantity > 1 ? ' ×' + comp.quantity : ''}{comp.serialNumbers.length > 0 ? ' (S/N: ' + comp.serialNumbers.join(', ') + ')' : ''} — {comp.status}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
      {equipment.tripItems.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <h3 style={{ fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>Additional Equipment</h3>
          {equipment.tripItems.map(item => (
            <div key={item.id} style={{ marginLeft: 12, fontSize: 11, marginBottom: 4 }}>
              <PrintCheckBox />{item.name}{item.quantity > 1 ? ' ×' + item.quantity : ''}{item.notes ? ' — ' + item.notes : ''}
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 16, fontSize: 10, color: '#666', borderTop: '1px solid #ccc', paddingTop: 8 }}>
        Summary: {equipment.summary.totalKits} kits — {Object.entries(equipment.summary.kitTypeBreakdown).map(([t, c]) => c + '× ' + t).join(', ')}
      </div>
    </div>
  );

  const PrintPersonalRole = () => (
    <div className="print-only" style={{ padding: 20, fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Personal Packing List — Role Summary</h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>Generated {new Date().toLocaleDateString()}</div>
      {(personal.byRole || []).map(roleGroup => (
        <div key={roleGroup.role} style={{ marginBottom: 16, pageBreakInside: 'avoid' }}>
          <h3 style={{ fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>{roleGroup.roleName} ({roleGroup.personnel.length} personnel)</h3>
          {CATEGORIES.filter(cat => roleGroup.items.some(i => (i.category || 'general') === cat)).map(cat => (
            <div key={cat} style={{ marginLeft: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{CAT_LABELS[cat]}</div>
              {roleGroup.items.filter(i => (i.category || 'general') === cat).map((item, idx) => (
                <div key={idx} style={{ marginLeft: 12, fontSize: 10, marginBottom: 2 }}>
                  <PrintCheckBox />{item.name}{item.quantity > 1 ? ' ×' + item.quantity : ''}{item.required ? ' *' : ''}{item.notes ? ' — ' + item.notes : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  const PrintPersonalIndividual = () => (
    <div className="print-only" style={{ padding: 20, fontFamily: 'Arial, sans-serif', color: '#000', background: '#fff' }}>
      <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Personal Packing Lists — Individual</h1>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>Generated {new Date().toLocaleDateString()}</div>
      {(personal.byPerson || []).map((person, pi) => (
        <div key={person.user.id} style={{ marginBottom: 16, pageBreakBefore: pi > 0 ? 'always' : 'auto' }}>
          <h3 style={{ fontSize: 13, borderBottom: '1px solid #ccc', paddingBottom: 4 }}>
            {person.user.name}{person.user.title ? ' — ' + person.user.title : ''} ({ROLE_LABELS[person.user.tripRole] || person.user.tripRole})
          </h3>
          {CATEGORIES.filter(cat => person.items.some(i => (i.category || 'general') === cat)).map(cat => (
            <div key={cat} style={{ marginLeft: 12, marginBottom: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>{CAT_LABELS[cat]}</div>
              {person.items.filter(i => (i.category || 'general') === cat).map((item, idx) => (
                <div key={idx} style={{ marginLeft: 12, fontSize: 10, marginBottom: 2 }}>
                  <PrintCheckBox />{item.name}{item.quantity > 1 ? ' ×' + item.quantity : ''}{item.required ? ' *' : ''}{item.notes ? ' — ' + item.notes : ''}
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      {/* Sub-tabs */}
      <Tabs tabs={[
        { id: 'equipment', l: 'Equipment' },
        { id: 'personal', l: 'Personal' },
        { id: 'my', l: 'My List' },
        { id: 'templates', l: 'Templates' },
      ]} active={subTab} onChange={setSubTab} />

      {subTab === 'equipment' && <EquipmentTab />}
      {subTab === 'personal' && <PersonalTab />}
      {subTab === 'my' && <MyListTab />}
      {subTab === 'templates' && <TemplatesTab />}

      {/* ── MODALS ── */}

      {/* Add Item Modal */}
      <ModalWrap open={!!addItemMd} onClose={() => setAddItemMd(null)} title={addItemMd?.tier === 'equipment' ? 'Add Equipment Item' : 'Add Personal Item'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fl label="Item Name"><In value={itemForm.name} onChange={e => setItemForm(p => ({ ...p, name: e.target.value }))} placeholder="Item name..." /></Fl>
          <div className="slate-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fl label="Quantity"><In type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))} /></Fl>
            <Fl label="Category"><Sl options={CATEGORIES.map(c => ({ v: c, l: CAT_LABELS[c] }))} value={itemForm.category}
              onChange={e => setItemForm(p => ({ ...p, category: e.target.value }))} /></Fl>
          </div>
          {addItemMd?.tier === 'personal' && (
            <Fl label="Scope"><Sl options={[{ v: 'all', l: 'All Roles' }, ...ROLE_OPTIONS]}
              value={itemForm.scope} onChange={e => setItemForm(p => ({ ...p, scope: e.target.value }))} /></Fl>
          )}
          <Fl label="Notes"><In value={itemForm.notes} onChange={e => setItemForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes..." /></Fl>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tg checked={itemForm.required} onChange={v => setItemForm(p => ({ ...p, required: v }))} />
            <span style={{ fontSize: 10, color: T.sub, fontFamily: T.m }}>Required item</span>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Bt onClick={() => setAddItemMd(null)}>Cancel</Bt>
            <Bt v="primary" onClick={addItem} disabled={!itemForm.name.trim()}>Add Item</Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Apply Template Picker Modal */}
      <ModalWrap open={!!applyTplMd} onClose={() => setApplyTplMd(null)} title={'Apply Template to ' + (ROLE_LABELS[applyTplMd] || applyTplMd || 'Role')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.filter(t => !t.isDefault || t.role !== applyTplMd).length === 0 && (
            <div style={{ padding: 20, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>No templates available to apply.</div>
          )}
          {templates.map(tpl => (
            <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 6,
              background: T.card, border: '1px solid ' + T.bd }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{tpl.name}</div>
                <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap' }}>
                  <Bg color={T.mu} bg={T.mu + '18'}>{(tpl.items || []).length} items</Bg>
                  {tpl.role && <Bg color={ROLE_COLORS[tpl.role] || T.mu} bg={(ROLE_COLORS[tpl.role] || T.mu) + '18'}>{ROLE_LABELS[tpl.role] || tpl.role}</Bg>}
                </div>
              </div>
              <Bt v="primary" sm onClick={() => applyTemplate(tpl.id, applyTplMd)}>Apply</Bt>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Bt onClick={() => setApplyTplMd(null)}>Close</Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Template Create/Edit Modal */}
      <ModalWrap open={tplMd} onClose={() => setTplMd(false)} title={editingTplId ? 'Edit Template' : 'New Packing Template'} wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fl label="Template Name"><In value={tplForm.name} onChange={e => setTplForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Specialist Standard, Cold Weather Add-on" /></Fl>
          <div className="slate-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fl label="Role (leave empty for add-on)"><Sl options={[{ v: '', l: '— Add-on (no role) —' }, ...ROLE_OPTIONS]}
              value={tplForm.role} onChange={e => setTplForm(p => ({ ...p, role: e.target.value }))} /></Fl>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 18 }}>
              <Tg checked={tplForm.isDefault} onChange={v => setTplForm(p => ({ ...p, isDefault: v }))} />
              <span style={{ fontSize: 10, color: T.sub, fontFamily: T.m }}>Auto-apply to matching role</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.tx, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Items ({tplForm.items.filter(i => i.name.trim()).length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
              {tplForm.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '6px 8px', borderRadius: 6, background: T.card, border: '1px solid ' + T.bd }}>
                  <In value={item.name} onChange={e => updateTplItem(i, 'name', e.target.value)} placeholder="Item name..." style={{ flex: 2, fontSize: 9, padding: '3px 6px' }} />
                  <In type="number" min="1" value={item.quantity} onChange={e => updateTplItem(i, 'quantity', parseInt(e.target.value) || 1)} style={{ width: 40, fontSize: 9, padding: '3px 4px' }} />
                  <Sl options={CATEGORIES.map(c => ({ v: c, l: CAT_LABELS[c] }))} value={item.category}
                    onChange={e => updateTplItem(i, 'category', e.target.value)} style={{ fontSize: 8, padding: '3px 4px', minWidth: 70 }} />
                  <button onClick={() => updateTplItem(i, 'required', !item.required)}
                    style={{ all: 'unset', cursor: 'pointer', fontSize: 9, color: item.required ? T.rd : T.dm, fontFamily: T.m, padding: '2px 4px' }}>
                    {item.required ? 'Req' : 'Opt'}
                  </button>
                  <In value={item.notes} onChange={e => updateTplItem(i, 'notes', e.target.value)} placeholder="Notes..." style={{ flex: 1, fontSize: 8, padding: '3px 4px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <button onClick={() => moveTplItem(i, -1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 7, color: T.dm, padding: '0 2px', lineHeight: 1 }}>▲</button>
                    <button onClick={() => moveTplItem(i, 1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 7, color: T.dm, padding: '0 2px', lineHeight: 1 }}>▼</button>
                  </div>
                  {tplForm.items.length > 1 && <button onClick={() => removeTplItem(i)}
                    style={{ all: 'unset', cursor: 'pointer', fontSize: 10, color: T.rd, padding: '2px 4px' }}>×</button>}
                </div>
              ))}
            </div>
            <Bt sm onClick={addTplItem} style={{ marginTop: 6 }}>+ Add Item</Bt>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid ' + T.bd, paddingTop: 12 }}>
            <Bt onClick={() => setTplMd(false)}>Cancel</Bt>
            <Bt v="primary" onClick={saveTpl} disabled={!tplForm.name.trim() || tplForm.items.filter(i => i.name.trim()).length === 0}>
              {editingTplId ? 'Save Changes' : 'Create Template'}
            </Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Delete item confirmation */}
      <ConfirmDialog open={!!confirmDelItem} onClose={() => setConfirmDelItem(null)} onConfirm={deleteItem}
        title="Delete Item?" message="This will permanently delete this packing item."
        confirmLabel="Delete Item" confirmColor={T.rd} />

      {/* Delete template confirmation */}
      <ConfirmDialog open={!!confirmDelTpl} onClose={() => setConfirmDelTpl(null)} onConfirm={deleteTpl}
        title="Delete Template?" message="This will permanently delete this packing template."
        confirmLabel="Delete Template" confirmColor={T.rd} />

      {/* Print views (hidden in screen, shown in print) */}
      <style>{`
        @media screen { .print-only { display: none !important; } }
        @media print {
          .print-only { display: block !important; }
          body > *:not(.print-only) { display: none !important; }
          nav, header, .no-print { display: none !important; }
        }
      `}</style>
      {printMode === 'equipment' && <PrintEquipment />}
      {printMode === 'personal-role' && <PrintPersonalRole />}
      {printMode === 'personal-individual' && <PrintPersonalIndividual />}
    </div>
  );
}

export default TripPacking;
