import { T } from '../../../theme/theme.js';
import { ProgressBar } from '../../../components/ui/index.js';

function DeptHealthWidget({ analytics }) {
  if (!analytics.deptStats.length) return <div style={{ padding: 20, textAlign: "center", color: T.dm, fontFamily: T.m, fontSize: 11 }}>No departments</div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {analytics.deptStats.map(d => (
        <div key={d.dept.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6, background: "rgba(255,255,255,.015)", marginBottom: 4 }}>
          <div style={{ width: 4, height: 24, borderRadius: 2, background: d.dept.color }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{d.dept.name}</div>
            <div style={{ fontSize: 9, color: T.mu, fontFamily: T.m }}>{d.kitCount} kits | {d.issuedCount} out | {Math.round(d.compliance * 100)}% inspected</div>
          </div>
          <ProgressBar value={d.compliance * 100} max={100} color={d.compliance > .8 ? T.gn : d.compliance > .5 ? T.am : T.rd} height={6} />
        </div>
      ))}
    </div>
  );
}

export default DeptHealthWidget;
