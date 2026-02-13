import { T } from '../../../theme/theme.js';
import { Sw, Bg } from '../../../components/ui/index.js';

function MaintenanceQueueWidget({ analytics, types, onNavigate }) {
  const maintCt = analytics.inMaintenance.length;
  if (maintCt === 0) return <div style={{ fontSize: 10, color: T.dm, fontFamily: T.m, textAlign: "center", padding: 10 }}>No kits in maintenance</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {analytics.inMaintenance.map(k => {
        const ty = types.find(t => t.id === k.typeId);
        return (
          <div key={k.id} onClick={() => onNavigate("maintenance")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,.015)", marginBottom: 4, cursor: "pointer" }}>
            <Sw color={k.color} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.tx, fontFamily: T.m }}>{k.color} <span style={{ color: T.dm }}>({ty?.name})</span></div>
            </div>
            <Bg color={T.am} bg="rgba(251,191,36,.1)">{k.maintenanceStatus}</Bg>
          </div>
        );
      })}
    </div>
  );
}

export default MaintenanceQueueWidget;
