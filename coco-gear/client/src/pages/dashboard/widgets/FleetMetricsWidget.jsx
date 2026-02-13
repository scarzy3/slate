import { T } from '../../../theme/theme.js';
import { StatCard } from '../../../components/ui/index.js';

function FleetMetricsWidget({ kits, analytics, requests, trips, curUserId, userRole, onNavigate, onFilterKits }) {
  const issuedCt = kits.filter(k => k.issuedTo).length;
  const availCt = kits.filter(k => !k.issuedTo && !k.maintenanceStatus && !k.degraded).length;
  const degradedCt = kits.filter(k => k.degraded).length;
  const maintCt = analytics.inMaintenance.length;
  const overdueCt = analytics.overdueReturns.length;
  const inspDueCt = analytics.overdueInspection.length;
  const pendCt = requests.filter(r => r.status === "pending").length;
  const activeTrips = (trips || []).filter(t => t.status === "active" || t.status === "planning");
  const myKits = kits.filter(k => k.issuedTo === curUserId);
  const tier = ["developer", "director", "super", "engineer"].includes(userRole) ? "director" :
    ["manager", "admin"].includes(userRole) ? "manager" : userRole === "lead" ? "lead" : "user";

  if (tier === "user") return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
      <StatCard label="My Kits" value={myKits.length} color={T.bl} />
      <StatCard label="Available" value={availCt} color={T.gn} onClick={() => onFilterKits("available")} />
      <StatCard label="Total Fleet" value={kits.length} color={T.mu} onClick={() => onFilterKits("all")} />
    </div>
  );

  if (tier === "lead") return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
      <StatCard label="Total Kits" value={kits.length} color={T.bl} onClick={() => onFilterKits("all")} />
      <StatCard label="Checked Out" value={issuedCt} color={issuedCt ? T.pk : T.gn} onClick={() => onFilterKits("issued")} />
      <StatCard label="Available" value={availCt} color={T.gn} onClick={() => onFilterKits("available")} />
      <StatCard label="Inspections Due" value={inspDueCt} color={inspDueCt ? T.am : T.gn} onClick={() => onFilterKits("overdue")} />
      <StatCard label="Maintenance" value={maintCt} color={maintCt ? T.am : T.gn} onClick={() => onFilterKits("maintenance")} />
      <StatCard label="Overdue Returns" value={overdueCt} color={overdueCt ? T.rd : T.gn} onClick={() => onFilterKits("overdue")} />
      <StatCard label="Pending" value={pendCt} color={pendCt ? T.or : T.gn} onClick={pendCt ? () => onNavigate("approvals") : undefined} />
    </div>
  );

  // director / manager
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(110px,1fr))", gap: 10 }}>
      <StatCard label="Total Kits" value={kits.length} color={T.bl} onClick={() => onFilterKits("all")} />
      <StatCard label="Checked Out" value={issuedCt} color={issuedCt ? T.pk : T.gn} onClick={() => onFilterKits("issued")} />
      <StatCard label="Available" value={availCt} color={T.gn} onClick={() => onFilterKits("available")} />
      {degradedCt > 0 && <StatCard label="Degraded" value={degradedCt} color={T.or} onClick={() => onFilterKits("degraded")} />}
      <StatCard label="Maintenance" value={maintCt} color={maintCt ? T.am : T.gn} onClick={() => onFilterKits("maintenance")} />
      <StatCard label="Overdue" value={overdueCt} color={overdueCt ? T.rd : T.gn} onClick={() => onFilterKits("overdue")} />
      <StatCard label="Pending" value={pendCt} color={pendCt ? T.or : T.gn} onClick={pendCt ? () => onNavigate("approvals") : undefined} />
      <StatCard label="Active Trips" value={activeTrips.length} color={T.ind} onClick={() => onNavigate("trips")} />
    </div>
  );
}

export default FleetMetricsWidget;
