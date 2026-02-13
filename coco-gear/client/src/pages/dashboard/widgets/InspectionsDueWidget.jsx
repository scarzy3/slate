import { T } from '../../../theme/theme.js';
import { daysAgo } from '../../../theme/helpers.js';
import { Sw, Bg } from '../../../components/ui/index.js';

function InspectionsDueWidget({ analytics, types, onNavigate }) {
  const inspDueCt = analytics.overdueInspection.length;
  if (inspDueCt === 0) return <div style={{ fontSize: 10, color: T.dm, fontFamily: T.m, textAlign: "center", padding: 10 }}>All kits inspected</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {analytics.overdueInspection.slice(0, 8).map(k => {
        const ty = types.find(t => t.id === k.typeId);
        const d = daysAgo(k.lastChecked);
        return (
          <div key={k.id} onClick={() => onNavigate("kits", k.id, "inspect")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(255,255,255,.015)", marginBottom: 4, cursor: "pointer" }}>
            <Sw color={k.color} size={16} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.tx, fontFamily: T.m }}>{k.color} <span style={{ color: T.dm }}>({ty?.name})</span></div>
            </div>
            <Bg color={d === null ? T.rd : d > 60 ? T.rd : T.am} bg={(d === null ? T.rd : d > 60 ? T.rd : T.am) + "18"}>{d === null ? "Never" : d + "d ago"}</Bg>
          </div>
        );
      })}
    </div>
  );
}

export default InspectionsDueWidget;
