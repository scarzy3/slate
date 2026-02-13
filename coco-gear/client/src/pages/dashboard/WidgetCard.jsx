import { T } from '../../theme/theme.js';

function WidgetCard({ icon, label, children, id }) {
  // fleet_metrics renders its own card-style (stat grid), no wrapper needed
  if (id === 'fleet_metrics') return <div style={{ marginBottom: 4 }}>{children}</div>;

  return (
    <div style={{ padding: 16, borderRadius: 10, background: T.card, border: "1px solid " + T.bd }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: 13, opacity: 0.7 }}>{icon}</span>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.tx, fontFamily: T.u }}>{label}</div>
      </div>
      {children}
    </div>
  );
}

export default WidgetCard;
