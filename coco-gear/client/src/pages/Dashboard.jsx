import { T } from '../theme/theme.js';
import { fmtDate, daysAgo } from '../theme/helpers.js';
import { Sw, Bg, Bt, SH, StatCard, ProgressBar } from '../components/ui/index.js';
import AlertsPanel from '../components/AlertsPanel.jsx';
import QuickActions from '../components/QuickActions.jsx';
import ActivityFeed from '../components/ActivityFeed.jsx';

function Dash({kits,types,locs,comps,personnel,depts,trips,requests,analytics,logs,settings,curUserId,userRole,favorites,setFavorites,onNavigate,onAction,onFilterKits}){
  const issuedCt=kits.filter(k=>k.issuedTo).length;const pendCt=requests.filter(r=>r.status==="pending").length;
  const myKits=kits.filter(k=>k.issuedTo===curUserId);
  const availCt=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus&&!k.degraded).length;
  const degradedCt=kits.filter(k=>k.degraded).length;
  const maintCt=analytics.inMaintenance.length;const overdueCt=analytics.overdueReturns.length;
  const inspDueCt=analytics.overdueInspection.length;const calDueCt=analytics.calibrationDue.length;
  const tier=["developer","director","super","engineer"].includes(userRole)?"director":["manager","admin"].includes(userRole)?"manager":userRole==="lead"?"lead":"user";
  const activeTrips=(trips||[]).filter(t=>t.status==="active"||t.status==="planning");
  const myDeptId=personnel.find(p=>p.id===curUserId)?.deptId;
  const myDeptKits=myDeptId?kits.filter(k=>k.deptId===myDeptId):[];

  /* ── DIRECTOR / MANAGER dashboard: analytics + planning ── */
  if(tier==="director"||tier==="manager")return(<div>
    <SH title="Dashboard" sub={tier==="director"?"Director overview":"Manager overview"}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:24}}>
      <StatCard label="Total Kits" value={kits.length} color={T.bl} onClick={()=>onFilterKits("all")}/>
      <StatCard label="Checked Out" value={issuedCt} color={issuedCt?T.pk:T.gn} onClick={()=>onFilterKits("issued")}/>
      <StatCard label="Available" value={availCt} color={T.gn} onClick={()=>onFilterKits("available")}/>
      {degradedCt>0&&<StatCard label="Degraded" value={degradedCt} color={T.or} onClick={()=>onFilterKits("degraded")}/>}
      <StatCard label="Maintenance" value={maintCt} color={maintCt?T.am:T.gn} onClick={()=>onFilterKits("maintenance")}/>
      <StatCard label="Overdue" value={overdueCt} color={overdueCt?T.rd:T.gn} onClick={()=>onFilterKits("overdue")}/>
      <StatCard label="Pending" value={pendCt} color={pendCt?T.or:T.gn} onClick={pendCt?()=>onNavigate("approvals"):undefined}/>
      <StatCard label="Active Trips" value={activeTrips.length} color={T.ind} onClick={()=>onNavigate("trips")}/></div>

    <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:T.rd}}>⚠</span> Needs Attention</div>
        <AlertsPanel analytics={analytics} kits={kits} settings={settings} onNavigate={onNavigate} onFilterKits={onFilterKits} requests={requests} personnel={personnel}/></div>
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Department Health</div>
        {analytics.deptStats.map(d=><div key={d.dept.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4}}>
          <div style={{width:4,height:24,borderRadius:2,background:d.dept.color}}/>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{d.dept.name}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{d.kitCount} kits | {d.issuedCount} out | {Math.round(d.compliance*100)}% inspected</div></div>
          <ProgressBar value={d.compliance*100} max={100} color={d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd} height={6}/></div>)}</div>
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Recent Activity</div>
        <ActivityFeed logs={logs} kits={kits} personnel={personnel} limit={8}/></div></div>

    <div className="slate-resp" style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {/* Active Trips */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Active Trips</div>
          <Bt v="ghost" sm onClick={()=>onNavigate("trips")}>View all →</Bt></div>
        {activeTrips.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No active trips</div>:
          activeTrips.slice(0,5).map(t=><div key={t.id} onClick={()=>onNavigate("trips")} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,
            background:"rgba(255,255,255,.015)",marginBottom:4,cursor:"pointer"}}>
            <div style={{width:4,height:24,borderRadius:2,background:t.status==="active"?T.gn:T.bl}}/>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{t.name}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{t.kits?.length||0} kits · {t.personnelCount||t.personnel?.length||0} personnel · {fmtDate(t.startDate)}</div></div>
            <Bg color={t.status==="active"?T.gn:T.bl} bg={(t.status==="active"?T.gn:T.bl)+"18"}>{t.status}</Bg></div>)}</div>
      {/* By Location */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>By Storage</div>
        {locs.map(l=>{const lk=kits.filter(k=>k.locId===l.id);if(!lk.length)return null;return(
          <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4}}>
            <div style={{width:26,height:26,borderRadius:5,background:"rgba(45,212,191,.06)",border:"1px solid rgba(45,212,191,.15)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:T.tl,fontFamily:T.m}}>{l.sc.slice(0,3)}</div>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{l.name}</div></div>
            <Bg color={T.bl} bg="rgba(96,165,250,.1)">{lk.length}</Bg>
            {lk.filter(k=>k.issuedTo).length>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{lk.filter(k=>k.issuedTo).length} out</Bg>}</div>)})}</div></div></div>);

  /* ── LEAD dashboard: operations + inventory focus ── */
  if(tier==="lead")return(<div>
    <SH title="Dashboard" sub="Operations overview"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:24}}>
      <StatCard label="Total Kits" value={kits.length} color={T.bl} onClick={()=>onFilterKits("all")}/>
      <StatCard label="Checked Out" value={issuedCt} color={issuedCt?T.pk:T.gn} onClick={()=>onFilterKits("issued")}/>
      <StatCard label="Available" value={availCt} color={T.gn} onClick={()=>onFilterKits("available")}/>
      <StatCard label="Inspections Due" value={inspDueCt} color={inspDueCt?T.am:T.gn} onClick={()=>onFilterKits("overdue")}/>
      <StatCard label="Maintenance" value={maintCt} color={maintCt?T.am:T.gn} onClick={()=>onFilterKits("maintenance")}/>
      <StatCard label="Overdue Returns" value={overdueCt} color={overdueCt?T.rd:T.gn} onClick={()=>onFilterKits("overdue")}/>
      <StatCard label="Pending" value={pendCt} color={pendCt?T.or:T.gn} onClick={pendCt?()=>onNavigate("approvals"):undefined}/></div>

    <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      {/* Alerts */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:T.rd}}>⚠</span> Needs Attention</div>
        <AlertsPanel analytics={analytics} kits={kits} settings={settings} onNavigate={onNavigate} onFilterKits={onFilterKits} requests={requests} personnel={personnel}/></div>
      {/* Quick Actions */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Quick Actions</div>
        <QuickActions kits={kits} curUserId={curUserId} personnel={personnel} onAction={onAction} favorites={favorites} onToggleFav={id=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}/></div>
      {/* Recent Activity */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Recent Activity</div>
        <ActivityFeed logs={logs} kits={kits} personnel={personnel} limit={8}/></div></div>

    <div className="slate-resp" style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {/* Inspection queue */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Inspections Due ({inspDueCt})</div>
        {analytics.overdueInspection.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>All kits inspected</div>:
          analytics.overdueInspection.slice(0,8).map(k=>{const ty=types.find(t=>t.id===k.typeId);const d=daysAgo(k.lastChecked);return(
            <div key={k.id} onClick={()=>onNavigate("kits",k.id,"inspect")} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4,cursor:"pointer"}}>
              <Sw color={k.color} size={16}/><div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color} <span style={{color:T.dm}}>({ty?.name})</span></div></div>
              <Bg color={d===null?T.rd:d>60?T.rd:T.am} bg={(d===null?T.rd:d>60?T.rd:T.am)+"18"}>{d===null?"Never":d+"d ago"}</Bg></div>)})}</div>
      {/* Maintenance queue */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>In Maintenance ({maintCt})</div>
        {analytics.inMaintenance.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No kits in maintenance</div>:
          analytics.inMaintenance.map(k=>{const ty=types.find(t=>t.id===k.typeId);return(
            <div key={k.id} onClick={()=>onNavigate("maintenance")} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4,cursor:"pointer"}}>
              <Sw color={k.color} size={16}/><div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color} <span style={{color:T.dm}}>({ty?.name})</span></div></div>
              <Bg color={T.am} bg="rgba(251,191,36,.1)">{k.maintenanceStatus}</Bg></div>)})}</div></div></div>);

  /* ── USER (Operator) dashboard: personal focus ── */
  return(<div>
    <SH title="Dashboard" sub="Your equipment"/>

    {/* My Kits */}
    <div style={{marginBottom:20}}>
      <div style={{fontSize:13,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:12}}>My Checked Out Kits ({myKits.length})</div>
      {myKits.length===0?<div style={{padding:20,borderRadius:10,background:T.card,border:"1px solid "+T.bd,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No kits checked out to you</div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(260px,100%),1fr))",gap:10}}>
          {myKits.map(k=>{const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);const h=k.issueHistory[k.issueHistory.length-1];
            const dOut=h?daysAgo(h.issuedDate):0;return(
            <div key={k.id} style={{padding:14,borderRadius:10,background:T.card,border:"1px solid "+T.bd,cursor:"pointer"}} onClick={()=>onFilterKits("issued")}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                <Sw color={k.color} size={24}/>
                <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:T.tx,fontFamily:T.u}}>{k.color}</div>
                  <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty?.name} · {lo?.name}</div></div>
                <Bg color={dOut>14?T.rd:dOut>7?T.am:T.gn} bg={(dOut>14?T.rd:dOut>7?T.am:T.gn)+"18"}>{dOut}d</Bg></div>
              {k._trip&&<div style={{fontSize:9,color:T.ind,fontFamily:T.m}}>▸ Trip: {k._trip.name}</div>}</div>)})}</div>}</div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:20}}>
      <StatCard label="My Kits" value={myKits.length} color={T.bl}/>
      <StatCard label="Available" value={availCt} color={T.gn} onClick={()=>onFilterKits("available")}/>
      <StatCard label="Total Fleet" value={kits.length} color={T.mu} onClick={()=>onFilterKits("all")}/></div>

    <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      {/* Quick Actions */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Quick Actions</div>
        <QuickActions kits={kits} curUserId={curUserId} personnel={personnel} onAction={onAction} favorites={favorites} onToggleFav={id=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}/></div>
      {/* Recent Activity */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Recent Activity</div>
        <ActivityFeed logs={logs} kits={kits} personnel={personnel} limit={6}/></div></div></div>);}

export default Dash;
