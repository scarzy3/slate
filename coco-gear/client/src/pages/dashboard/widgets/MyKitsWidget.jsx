import { T } from '../../../theme/theme.js';
import { daysAgo } from '../../../theme/helpers.js';
import { Sw, Bg } from '../../../components/ui/index.js';

function MyKitsWidget({ kits, types, locs, curUserId, onFilterKits }) {
  const myKits = kits.filter(k => k.issuedTo === curUserId);
  if (myKits.length === 0) return (
    <div style={{ padding: 20, textAlign: "center", color: T.dm, fontFamily: T.m, fontSize: 11 }}>No kits checked out to you</div>
  );
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(260px,100%),1fr))", gap: 10 }}>
      {myKits.map(k => {
        const ty = types.find(t => t.id === k.typeId);
        const lo = locs.find(l => l.id === k.locId);
        const h = k.issueHistory[k.issueHistory.length - 1];
        const dOut = h ? daysAgo(h.issuedDate) : 0;
        return (
          <div key={k.id} style={{ padding: 14, borderRadius: 10, background: T.card, border: "1px solid " + T.bd, cursor: "pointer" }} onClick={() => onFilterKits("issued")}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <Sw color={k.color} size={24} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.tx, fontFamily: T.u }}>{k.color}</div>
                <div style={{ fontSize: 9, color: T.dm, fontFamily: T.m }}>{ty?.name} · {lo?.name}</div>
              </div>
              <Bg color={dOut > 14 ? T.rd : dOut > 7 ? T.am : T.gn} bg={(dOut > 14 ? T.rd : dOut > 7 ? T.am : T.gn) + "18"}>{dOut}d</Bg>
            </div>
            {k._trip && <div style={{ fontSize: 9, color: k._tripRestricted ? T.dm : T.ind, fontFamily: T.m, fontStyle: k._tripRestricted ? "italic" : "normal" }}>{k._tripRestricted ? "\u{1F512} Restricted" : "\u25B8 Trip: " + k._trip.name}</div>}
          </div>
        );
      })}
    </div>
  );
}

export default MyKitsWidget;
