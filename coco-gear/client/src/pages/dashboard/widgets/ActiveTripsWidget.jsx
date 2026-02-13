import { T } from '../../../theme/theme.js';
import { fmtDate } from '../../../theme/helpers.js';
import { Bg, Bt } from '../../../components/ui/index.js';

function ActiveTripsWidget({ trips, onNavigate }) {
  const activeTrips = (trips || []).filter(t => t.status === "active" || t.status === "planning");
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div />
        <Bt v="ghost" sm onClick={() => onNavigate("trips")}>View all →</Bt>
      </div>
      {activeTrips.length === 0 ? <div style={{ fontSize: 10, color: T.dm, fontFamily: T.m, textAlign: "center", padding: 10 }}>No active trips</div> :
        activeTrips.slice(0, 5).map(t => (
          <div key={t.id} onClick={() => onNavigate("trips")} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,.015)", marginBottom: 4, cursor: "pointer" }}>
            <div style={{ width: 4, height: 24, borderRadius: 2, background: t.status === "active" ? T.gn : T.bl }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{t.name}</div>
              <div style={{ fontSize: 9, color: T.mu, fontFamily: T.m }}>{t.kits?.length || 0} kits · {t.personnelCount || t.personnel?.length || 0} personnel · {fmtDate(t.startDate)}</div>
            </div>
            <Bg color={t.status === "active" ? T.gn : T.bl} bg={(t.status === "active" ? T.gn : T.bl) + "18"}>{t.status}</Bg>
          </div>
        ))}
    </div>
  );
}

export default ActiveTripsWidget;
