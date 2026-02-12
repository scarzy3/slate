import { useState, useEffect, useMemo } from 'react';
import { T } from '../theme/theme.js';
import { Bg, Bt, Fl, In, Ta, Sl, SH, ModalWrap, ConfirmDialog, ProgressBar } from '../components/ui/index.js';
import api from '../api.js';

const PHASES = ['pre-deployment', 'deployment', 'post-deployment'];
const PHASE_LABELS = { 'pre-deployment': 'Pre-Deployment', 'deployment': 'Deployment', 'post-deployment': 'Post-Deployment' };
const PHASE_COLORS = { 'pre-deployment': T.bl, 'deployment': T.gn, 'post-deployment': T.am };
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const PRIORITY_COLORS = { low: T.mu, medium: T.bl, high: T.am, critical: T.rd };
const STATUS_LABELS = { todo: 'To Do', 'in-progress': 'In Progress', blocked: 'Blocked', done: 'Done' };
const STATUS_COLORS = { todo: T.mu, 'in-progress': T.bl, blocked: T.rd, done: T.gn };

const emptyTask = () => ({ title: '', description: '', phase: 'pre-deployment', priority: 'medium', assignedToId: '', dueDate: '' });
const emptyTplTask = () => ({ title: '', description: '', phase: 'pre-deployment', priority: 'medium' });

function TripTasks({ tripId, tripPersonnel, isAdmin, isSuper, editable, onTaskCountChange }) {
  const [tasksByPhase, setTasksByPhase] = useState({ 'pre-deployment': [], 'deployment': [], 'post-deployment': [] });
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState([]);
  const [addMd, setAddMd] = useState(false);
  const [tplMd, setTplMd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [taskForm, setTaskForm] = useState(emptyTask());
  const [quickAdd, setQuickAdd] = useState({ 'pre-deployment': '', 'deployment': '', 'post-deployment': '' });
  const [confirmDel, setConfirmDel] = useState(null);
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  // Template management state
  const [tplCreateMd, setTplCreateMd] = useState(false);
  const [tplForm, setTplForm] = useState({ name: '', description: '', tasks: [emptyTplTask()] });
  const [editingTplId, setEditingTplId] = useState(null);
  const [confirmDelTpl, setConfirmDelTpl] = useState(null);

  const allTasks = useMemo(() => PHASES.flatMap(p => tasksByPhase[p] || []), [tasksByPhase]);
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'done').length;
  const pct = totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0;

  useEffect(() => { if (onTaskCountChange) onTaskCountChange(doneTasks, totalTasks); }, [doneTasks, totalTasks]);

  const loadTasks = async () => {
    try {
      const data = await api.tasks.list(tripId);
      setTasksByPhase(data);
    } catch (e) { console.error('Load tasks error:', e); }
    setLoading(false);
  };

  const loadTemplates = async () => {
    try { const data = await api.taskTemplates.list(); setTemplates(data); } catch (e) {}
  };

  useEffect(() => { loadTasks(); }, [tripId]);

  const filterTask = (t) => {
    if (filterAssignee && t.assignedToId !== filterAssignee) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  };

  const createTask = async () => {
    if (!taskForm.title.trim()) return;
    try {
      await api.tasks.create(tripId, {
        title: taskForm.title.trim(),
        description: taskForm.description.trim() || undefined,
        phase: taskForm.phase,
        priority: taskForm.priority,
        assignedToId: taskForm.assignedToId || undefined,
        dueDate: taskForm.dueDate || undefined,
      });
      await loadTasks();
      setTaskForm(emptyTask());
      setAddMd(false);
    } catch (e) { alert(e.message); }
  };

  const quickAddTask = async (phase) => {
    const title = quickAdd[phase]?.trim();
    if (!title) return;
    try {
      await api.tasks.create(tripId, { title, phase });
      setQuickAdd(p => ({ ...p, [phase]: '' }));
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const toggleDone = async (task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    try {
      await api.tasks.update(tripId, task.id, { status: newStatus });
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.title?.trim()) return;
    try {
      await api.tasks.update(tripId, editingId, {
        title: editForm.title.trim(),
        description: editForm.description?.trim() || null,
        assignedToId: editForm.assignedToId || null,
        phase: editForm.phase,
        priority: editForm.priority,
        status: editForm.status,
        dueDate: editForm.dueDate || null,
      });
      setEditingId(null);
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const deleteTask = async () => {
    if (!confirmDel) return;
    try {
      await api.tasks.delete(tripId, confirmDel);
      setConfirmDel(null);
      setEditingId(null);
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const moveTask = async (phase, idx, dir) => {
    const list = [...(tasksByPhase[phase] || [])];
    const ni = idx + dir;
    if (ni < 0 || ni >= list.length) return;
    [list[idx], list[ni]] = [list[ni], list[idx]];
    try {
      await api.tasks.reorder(tripId, list.map(t => t.id));
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const applyTemplate = async (templateId) => {
    try {
      await api.tasks.fromTemplate(tripId, templateId);
      setTplMd(false);
      await loadTasks();
    } catch (e) { alert(e.message); }
  };

  const startEdit = (task) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || '',
      assignedToId: task.assignedToId || '',
      phase: task.phase,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : '',
    });
  };

  const getDueDateStyle = (dueDate) => {
    if (!dueDate) return null;
    const d = new Date(dueDate);
    const now = new Date();
    const diff = Math.ceil((d - now) / 864e5);
    if (diff < 0) return { color: T.rd, label: Math.abs(diff) + 'd overdue' };
    if (diff <= 3) return { color: T.am, label: diff + 'd left' };
    return { color: T.mu, label: new Date(dueDate).toLocaleDateString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' }) };
  };

  const initials = (name) => name ? name.split(' ').map(n => n[0]).join('').slice(0, 2) : '?';

  // ─── Template CRUD ───
  const openCreateTemplate = () => {
    setEditingTplId(null);
    setTplForm({ name: '', description: '', tasks: [emptyTplTask()] });
    setTplCreateMd(true);
  };

  const openEditTemplate = (tpl) => {
    setEditingTplId(tpl.id);
    setTplForm({
      name: tpl.name,
      description: tpl.description || '',
      tasks: (tpl.tasks || []).length > 0
        ? tpl.tasks.map(t => ({ title: t.title || '', description: t.description || '', phase: t.phase || 'pre-deployment', priority: t.priority || 'medium' }))
        : [emptyTplTask()],
    });
    setTplCreateMd(true);
  };

  const saveTemplate = async () => {
    if (!tplForm.name.trim()) return;
    const validTasks = tplForm.tasks.filter(t => t.title.trim());
    if (validTasks.length === 0) { alert('Add at least one task with a title'); return; }
    const payload = {
      name: tplForm.name.trim(),
      description: tplForm.description.trim() || undefined,
      tasks: validTasks.map((t, i) => ({ title: t.title.trim(), description: t.description?.trim() || undefined, phase: t.phase, priority: t.priority, sortOrder: i })),
    };
    try {
      if (editingTplId) { await api.taskTemplates.update(editingTplId, payload); }
      else { await api.taskTemplates.create(payload); }
      setTplCreateMd(false);
      await loadTemplates();
    } catch (e) { alert(e.message); }
  };

  const deleteTemplate = async () => {
    if (!confirmDelTpl) return;
    try {
      await api.taskTemplates.delete(confirmDelTpl);
      setConfirmDelTpl(null);
      await loadTemplates();
    } catch (e) { alert(e.message); }
  };

  const addTplTask = () => setTplForm(p => ({ ...p, tasks: [...p.tasks, emptyTplTask()] }));
  const removeTplTask = (i) => setTplForm(p => ({ ...p, tasks: p.tasks.filter((_, j) => j !== i) }));
  const updateTplTask = (i, field, val) => setTplForm(p => ({ ...p, tasks: p.tasks.map((t, j) => j === i ? { ...t, [field]: val } : t) }));

  if (loading) return <div style={{ padding: 30, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>Loading tasks...</div>;

  return (
    <div>
      {/* Header: progress + controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14 }}>
        <div style={{ flex: '1 1 200px', minWidth: 180 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.m, marginBottom: 4 }}>
            {doneTasks}/{totalTasks} tasks complete ({pct}%)
          </div>
          <ProgressBar value={doneTasks} max={Math.max(totalTasks, 1)} color={pct === 100 ? T.gn : T.bl} height={5} />
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <Sl options={[{ v: '', l: 'All assignees' }, ...tripPersonnel.map(p => ({ v: p.userId, l: p.name }))]}
            value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ fontSize: 9, padding: '4px 6px', minWidth: 100 }} />
          <Sl options={[{ v: '', l: 'All statuses' }, ...Object.entries(STATUS_LABELS).map(([v, l]) => ({ v, l }))]}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ fontSize: 9, padding: '4px 6px', minWidth: 90 }} />
          <Sl options={[{ v: '', l: 'All priorities' }, ...Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ v, l }))]}
            value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ fontSize: 9, padding: '4px 6px', minWidth: 90 }} />
        </div>
        {isAdmin && editable && <div style={{ display: 'flex', gap: 4 }}>
          <Bt v="primary" sm onClick={() => { setTaskForm(emptyTask()); setAddMd(true); }}>+ Add Task</Bt>
          <Bt sm onClick={() => { loadTemplates(); setTplMd(true); }}>From Template</Bt>
        </div>}
      </div>

      {/* Phase columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(280px,100%),1fr))', gap: 12 }}>
        {PHASES.map(phase => {
          const phaseTasks = (tasksByPhase[phase] || []).filter(filterTask);
          const phaseAll = tasksByPhase[phase] || [];
          const phaseDone = phaseAll.filter(t => t.status === 'done').length;
          const pc = PHASE_COLORS[phase];
          return (
            <div key={phase} style={{ background: T.card, border: '1px solid ' + T.bd, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column' }}>
              {/* Phase header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid ' + pc + '22' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 4, background: pc }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: pc, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1 }}>{PHASE_LABELS[phase]}</span>
                </div>
                <Bg color={pc} bg={pc + '18'}>{phaseDone}/{phaseAll.length}</Bg>
              </div>

              {/* Task list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                {phaseTasks.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 9 }}>No tasks</div>}
                {phaseTasks.map((task, idx) => {
                  const isEditing = editingId === task.id;
                  const due = getDueDateStyle(task.dueDate);
                  const isDone = task.status === 'done';

                  if (isEditing) return (
                    <div key={task.id} style={{ padding: 10, borderRadius: 8, background: T.cardH, border: '1px solid ' + T.bdH }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <In value={editForm.title} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title" style={{ fontSize: 11 }} />
                        <Ta value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} placeholder="Description..." rows={2} style={{ fontSize: 10 }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <Fl label="Assignee" style={{ fontSize: 8 }}>
                            <Sl options={[{ v: '', l: 'Unassigned' }, ...tripPersonnel.map(p => ({ v: p.userId, l: p.name }))]}
                              value={editForm.assignedToId} onChange={e => setEditForm(p => ({ ...p, assignedToId: e.target.value }))} style={{ fontSize: 9, padding: '3px 5px' }} /></Fl>
                          <Fl label="Phase" style={{ fontSize: 8 }}>
                            <Sl options={PHASES.map(p => ({ v: p, l: PHASE_LABELS[p] }))}
                              value={editForm.phase} onChange={e => setEditForm(p => ({ ...p, phase: e.target.value }))} style={{ fontSize: 9, padding: '3px 5px' }} /></Fl>
                          <Fl label="Priority" style={{ fontSize: 8 }}>
                            <Sl options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ v, l }))}
                              value={editForm.priority} onChange={e => setEditForm(p => ({ ...p, priority: e.target.value }))} style={{ fontSize: 9, padding: '3px 5px' }} /></Fl>
                          <Fl label="Status" style={{ fontSize: 8 }}>
                            <Sl options={Object.entries(STATUS_LABELS).map(([v, l]) => ({ v, l }))}
                              value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))} style={{ fontSize: 9, padding: '3px 5px' }} /></Fl>
                        </div>
                        <Fl label="Due Date" style={{ fontSize: 8 }}>
                          <In type="date" value={editForm.dueDate} onChange={e => setEditForm(p => ({ ...p, dueDate: e.target.value }))} style={{ fontSize: 9, padding: '3px 5px' }} /></Fl>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'space-between' }}>
                          {isAdmin && <Bt v="danger" sm onClick={() => setConfirmDel(task.id)}>Delete</Bt>}
                          <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                            <Bt sm onClick={() => setEditingId(null)}>Cancel</Bt>
                            <Bt v="primary" sm onClick={saveEdit} disabled={!editForm.title?.trim()}>Save</Bt>
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', borderRadius: 6,
                      background: isDone ? T.gn + '06' : 'rgba(255,255,255,.02)', border: '1px solid ' + (isDone ? T.gn + '15' : T.bd),
                      cursor: 'default', transition: 'all .12s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = T.bdH; }} onMouseLeave={e => { e.currentTarget.style.borderColor = isDone ? T.gn + '15' : T.bd; }}>

                      {/* Checkbox */}
                      <button onClick={() => toggleDone(task)} style={{ all: 'unset', cursor: 'pointer', width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                        border: '1.5px solid ' + (isDone ? T.gn : T.bd), background: isDone ? T.gn : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#fff', fontWeight: 700 }}>
                        {isDone ? '✓' : ''}
                      </button>

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0, cursor: editable ? 'pointer' : 'default' }} onClick={() => { if (editable) startEdit(task); }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isDone ? T.dm : T.tx, fontFamily: T.m,
                            textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3 }}>{task.title}</span>
                          <Bg color={PRIORITY_COLORS[task.priority]} bg={PRIORITY_COLORS[task.priority] + '18'} style={{ fontSize: 7 }}>
                            {PRIORITY_LABELS[task.priority]}
                          </Bg>
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 2 }}>
                          {task.status !== 'todo' && task.status !== 'done' &&
                            <Bg color={STATUS_COLORS[task.status]} bg={STATUS_COLORS[task.status] + '18'} style={{ fontSize: 7 }}>
                              {STATUS_LABELS[task.status]}
                            </Bg>}
                          {due && <span style={{ fontSize: 8, color: due.color, fontFamily: T.m, fontWeight: 600 }}>{due.label}</span>}
                          {task.assignedTo && <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <div style={{ width: 14, height: 14, borderRadius: 7, background: T.bl + '22', border: '1px solid ' + T.bl + '33',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 700, color: T.bl, fontFamily: T.m }}>
                              {initials(task.assignedTo.name)}</div>
                            <span style={{ fontSize: 8, color: T.sub, fontFamily: T.m }}>{task.assignedTo.name.split(' ')[0]}</span>
                          </div>}
                        </div>
                      </div>

                      {/* Reorder buttons */}
                      {isAdmin && editable && <div style={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                        <button onClick={() => moveTask(phase, idx, -1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 8, color: T.dm, padding: '0 2px', lineHeight: 1 }}
                          title="Move up">▲</button>
                        <button onClick={() => moveTask(phase, idx, 1)} style={{ all: 'unset', cursor: 'pointer', fontSize: 8, color: T.dm, padding: '0 2px', lineHeight: 1 }}
                          title="Move down">▼</button>
                      </div>}
                    </div>
                  );
                })}
              </div>

              {/* Quick add */}
              {isAdmin && editable && <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <In value={quickAdd[phase]} onChange={e => setQuickAdd(p => ({ ...p, [phase]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') quickAddTask(phase); }}
                  placeholder="Quick add task..." style={{ flex: 1, fontSize: 9, padding: '4px 8px' }} />
                <Bt sm onClick={() => quickAddTask(phase)} disabled={!quickAdd[phase]?.trim()} style={{ fontSize: 9, padding: '4px 8px' }}>+</Bt>
              </div>}
            </div>
          );
        })}
      </div>

      {/* Add Task Modal */}
      <ModalWrap open={addMd} onClose={() => setAddMd(false)} title="Add Task">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fl label="Title"><In value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." /></Fl>
          <Fl label="Description"><Ta value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." rows={2} /></Fl>
          <div className="slate-resp" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Fl label="Phase"><Sl options={PHASES.map(p => ({ v: p, l: PHASE_LABELS[p] }))}
              value={taskForm.phase} onChange={e => setTaskForm(p => ({ ...p, phase: e.target.value }))} /></Fl>
            <Fl label="Priority"><Sl options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ v, l }))}
              value={taskForm.priority} onChange={e => setTaskForm(p => ({ ...p, priority: e.target.value }))} /></Fl>
          </div>
          <Fl label="Assignee"><Sl options={[{ v: '', l: '— Unassigned —' }, ...tripPersonnel.map(p => ({ v: p.userId, l: p.name }))]}
            value={taskForm.assignedToId} onChange={e => setTaskForm(p => ({ ...p, assignedToId: e.target.value }))} /></Fl>
          <Fl label="Due Date"><In type="date" value={taskForm.dueDate} onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))} /></Fl>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Bt onClick={() => setAddMd(false)}>Cancel</Bt>
            <Bt v="primary" onClick={createTask} disabled={!taskForm.title.trim()}>Create Task</Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Template Picker Modal */}
      <ModalWrap open={tplMd} onClose={() => setTplMd(false)} title="Task Templates" wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {templates.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: T.dm, fontFamily: T.m, fontSize: 11 }}>
            No templates yet.{isAdmin ? ' Create one below to get started.' : ' Ask a manager or director to create templates.'}</div>}
          {templates.map(tpl => {
            const tplTasks = tpl.tasks || [];
            const byPhase = PHASES.reduce((a, p) => { a[p] = tplTasks.filter(t => t.phase === p).length; return a; }, {});
            return (
              <div key={tpl.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8,
                background: T.card, border: '1px solid ' + T.bd }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{tpl.name}</div>
                  {tpl.description && <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m, marginTop: 1 }}>{tpl.description}</div>}
                  <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                    <Bg color={T.bl} bg={T.bl + '18'}>{tplTasks.length} tasks</Bg>
                    {PHASES.filter(p => byPhase[p] > 0).map(p =>
                      <Bg key={p} color={PHASE_COLORS[p]} bg={PHASE_COLORS[p] + '18'}>{byPhase[p]} {PHASE_LABELS[p].toLowerCase()}</Bg>)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {isAdmin && <>
                    <Bt sm onClick={() => openEditTemplate(tpl)}>Edit</Bt>
                    <Bt v="danger" sm onClick={() => setConfirmDelTpl(tpl.id)}>Delete</Bt>
                  </>}
                  {editable && <Bt v="primary" sm onClick={() => applyTemplate(tpl.id)}>Apply to Trip</Bt>}
                </div>
              </div>
            );
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, borderTop: '1px solid ' + T.bd, paddingTop: 10 }}>
            {isAdmin ? <Bt v="success" sm onClick={openCreateTemplate}>+ New Template</Bt> : <div />}
            <Bt onClick={() => setTplMd(false)}>Close</Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Create/Edit Template Modal */}
      <ModalWrap open={tplCreateMd} onClose={() => setTplCreateMd(false)} title={editingTplId ? 'Edit Template' : 'Create Template'} wide>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Fl label="Template Name"><In value={tplForm.name} onChange={e => setTplForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Standard Deployment Checklist" /></Fl>
          <Fl label="Description"><Ta value={tplForm.description} onChange={e => setTplForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description..." rows={2} /></Fl>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.tx, fontFamily: T.m, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
              Template Tasks ({tplForm.tasks.filter(t => t.title.trim()).length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tplForm.tasks.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '8px 10px', borderRadius: 8,
                  background: T.card, border: '1px solid ' + T.bd }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <In value={t.title} onChange={e => updateTplTask(i, 'title', e.target.value)} placeholder="Task title..."
                      style={{ fontSize: 10, padding: '4px 6px' }} />
                    <div style={{ display: 'flex', gap: 4 }}>
                      <Sl options={PHASES.map(p => ({ v: p, l: PHASE_LABELS[p] }))} value={t.phase}
                        onChange={e => updateTplTask(i, 'phase', e.target.value)} style={{ fontSize: 9, padding: '3px 5px', flex: 1 }} />
                      <Sl options={Object.entries(PRIORITY_LABELS).map(([v, l]) => ({ v, l }))} value={t.priority}
                        onChange={e => updateTplTask(i, 'priority', e.target.value)} style={{ fontSize: 9, padding: '3px 5px', flex: 1 }} />
                    </div>
                    <In value={t.description} onChange={e => updateTplTask(i, 'description', e.target.value)} placeholder="Description (optional)..."
                      style={{ fontSize: 9, padding: '3px 6px' }} />
                  </div>
                  {tplForm.tasks.length > 1 && <button onClick={() => removeTplTask(i)}
                    style={{ all: 'unset', cursor: 'pointer', fontSize: 12, color: T.rd, padding: '2px 4px', lineHeight: 1, marginTop: 2 }}
                    title="Remove task">×</button>}
                </div>
              ))}
            </div>
            <Bt sm onClick={addTplTask} style={{ marginTop: 6 }}>+ Add Task</Bt>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid ' + T.bd, paddingTop: 12 }}>
            <Bt onClick={() => setTplCreateMd(false)}>Cancel</Bt>
            <Bt v="primary" onClick={saveTemplate} disabled={!tplForm.name.trim() || tplForm.tasks.filter(t => t.title.trim()).length === 0}>
              {editingTplId ? 'Save Changes' : 'Create Template'}
            </Bt>
          </div>
        </div>
      </ModalWrap>

      {/* Delete task confirmation */}
      <ConfirmDialog open={!!confirmDel} onClose={() => setConfirmDel(null)} onConfirm={deleteTask}
        title="Delete Task?" message="This will permanently delete this task. This cannot be undone."
        confirmLabel="Delete Task" confirmColor={T.rd} />

      {/* Delete template confirmation */}
      <ConfirmDialog open={!!confirmDelTpl} onClose={() => setConfirmDelTpl(null)} onConfirm={deleteTemplate}
        title="Delete Template?" message="This will permanently delete this template. Existing tasks created from it will not be affected."
        confirmLabel="Delete Template" confirmColor={T.rd} />
    </div>
  );
}

export default TripTasks;
