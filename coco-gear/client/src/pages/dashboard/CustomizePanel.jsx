import { useState } from 'react';
import { T } from '../../theme/theme.js';
import { Bt, Tg, ModalWrap } from '../../components/ui/index.js';
import WIDGET_REGISTRY, { getDefaultConfig, getVisibleWidgets } from './widgetRegistry.js';

function CustomizePanel({ open, onClose, config, onSave, userRole }) {
  const [draft, setDraft] = useState(null);

  // Initialize draft from config when opening
  const widgets = (draft || config)?.widgets || [];
  const available = getVisibleWidgets(userRole);
  const regMap = {};
  WIDGET_REGISTRY.forEach(w => { regMap[w.id] = w; });

  // Sort by order for display
  const sorted = [...widgets].filter(w => regMap[w.id]).sort((a, b) => a.order - b.order);

  function setW(newWidgets) {
    setDraft({ ...(draft || config), widgets: newWidgets });
  }

  function toggleVisible(id) {
    const next = widgets.map(w => w.id === id ? { ...w, visible: !w.visible } : w);
    setW(next);
  }

  function moveUp(idx) {
    if (idx <= 0) return;
    const ids = sorted.map(w => w.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    const reordered = widgets.map(w => {
      const newOrder = ids.indexOf(w.id);
      return newOrder >= 0 ? { ...w, order: newOrder } : w;
    });
    setW(reordered);
  }

  function moveDown(idx) {
    if (idx >= sorted.length - 1) return;
    const ids = sorted.map(w => w.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    const reordered = widgets.map(w => {
      const newOrder = ids.indexOf(w.id);
      return newOrder >= 0 ? { ...w, order: newOrder } : w;
    });
    setW(reordered);
  }

  function handleReset() {
    setDraft(getDefaultConfig(userRole));
  }

  function handleSave() {
    onSave(draft || config);
    setDraft(null);
  }

  function handleCancel() {
    setDraft(null);
    onClose();
  }

  return (
    <ModalWrap open={open} onClose={handleCancel} title="Customize Dashboard">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: T.mu, fontFamily: T.m, marginBottom: 16 }}>Toggle widgets on/off and reorder using arrows. Changes preview live.</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {sorted.map((w, idx) => {
            const reg = regMap[w.id];
            if (!reg) return null;
            return (
              <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, background: w.visible ? T.card : "transparent", border: "1px solid " + (w.visible ? T.bd : "transparent"), opacity: w.visible ? 1 : 0.5, transition: "all .15s" }}>
                {/* Reorder arrows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <button onClick={() => moveUp(idx)} disabled={idx === 0} style={{ all: "unset", cursor: idx === 0 ? "default" : "pointer", fontSize: 10, color: idx === 0 ? T.dm : T.mu, lineHeight: 1, padding: "1px 3px", borderRadius: 3 }}
                    onMouseEnter={e => { if (idx > 0) e.currentTarget.style.color = T.tx; }} onMouseLeave={e => { e.currentTarget.style.color = idx === 0 ? T.dm : T.mu; }}>{"\u25B2"}</button>
                  <button onClick={() => moveDown(idx)} disabled={idx === sorted.length - 1} style={{ all: "unset", cursor: idx === sorted.length - 1 ? "default" : "pointer", fontSize: 10, color: idx === sorted.length - 1 ? T.dm : T.mu, lineHeight: 1, padding: "1px 3px", borderRadius: 3 }}
                    onMouseEnter={e => { if (idx < sorted.length - 1) e.currentTarget.style.color = T.tx; }} onMouseLeave={e => { e.currentTarget.style.color = idx === sorted.length - 1 ? T.dm : T.mu; }}>{"\u25BC"}</button>
                </div>

                {/* Icon */}
                <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{reg.icon}</span>

                {/* Label + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{reg.label}</div>
                  <div style={{ fontSize: 9, color: T.mu, fontFamily: T.m }}>{reg.description}</div>
                </div>

                {/* Toggle */}
                <Tg checked={w.visible} onChange={() => toggleVisible(w.id)} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid " + T.bd }}>
        <Bt v="ghost" sm onClick={handleReset}>Reset to Default</Bt>
        <div style={{ display: "flex", gap: 8 }}>
          <Bt v="ghost" sm onClick={handleCancel}>Cancel</Bt>
          <Bt v="primary" sm onClick={handleSave}>Save</Bt>
        </div>
      </div>
    </ModalWrap>
  );
}

export default CustomizePanel;
