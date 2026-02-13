import { T } from '../../../theme/theme.js';
import { Bg } from '../../../components/ui/index.js';

function StorageOverviewWidget({ kits, locs }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {locs.map(l => {
        const lk = kits.filter(k => k.locId === l.id);
        if (!lk.length) return null;
        return (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,.015)", marginBottom: 4 }}>
            <div style={{ width: 26, height: 26, borderRadius: 5, background: "rgba(45,212,191,.06)", border: "1px solid rgba(45,212,191,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: T.tl, fontFamily: T.m }}>{l.sc.slice(0, 3)}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{l.name}</div>
            </div>
            <Bg color={T.bl} bg="rgba(96,165,250,.1)">{lk.length}</Bg>
            {lk.filter(k => k.issuedTo).length > 0 && <Bg color={T.pk} bg="rgba(244,114,182,.08)">{lk.filter(k => k.issuedTo).length} out</Bg>}
          </div>
        );
      })}
    </div>
  );
}

export default StorageOverviewWidget;
