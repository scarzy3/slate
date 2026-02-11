import { useState } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate, daysAgo, SYS_ROLE_LABELS, sysRoleColor } from '../theme/helpers.js';
import { Sw, Bg, Bt, SH, Tabs, ProgressBar } from '../components/ui/index.js';
import BarChart from '../components/charts/BarChart.jsx';
import DonutChart from '../components/charts/DonutChart.jsx';
import SparkLine from '../components/charts/SparkLine.jsx';

function AnalyticsPage({analytics,kits,personnel,depts,comps,types,locs}){
  const[tab,setTab]=useState("overview");
  return(<div>
    <SH title="Analytics" sub="Fleet insights and performance metrics"/>
    <Tabs tabs={[{id:"overview",l:"Overview"},{id:"utilization",l:"Utilization"},{id:"accountability",l:"Accountability"},
      {id:"components",l:"Components"},{id:"departments",l:"Departments"}]} active={tab} onChange={setTab}/>

    {tab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Summary Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        <StatCard label="Total Kits" value={kits.length} color={T.bl}/>
        <StatCard label="Checked Out" value={kits.filter(k=>k.issuedTo).length} color={T.pk}/>
        <StatCard label="Available" value={kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length} color={T.gn}/>
        <StatCard label="In Maintenance" value={analytics.inMaintenance.length} color={T.am}/>
        <StatCard label="Overdue Returns" value={analytics.overdueReturns.length} color={analytics.overdueReturns.length?T.rd:T.gn}/>
        <StatCard label="Needs Inspection" value={analytics.overdueInspection.length} color={analytics.overdueInspection.length?T.am:T.gn}/>
        <StatCard label="Inspection Rate" value={Math.round(analytics.inspectionRate*100)+"%"} color={analytics.inspectionRate>.8?T.gn:T.am}/>
        <StatCard label="Calibration Due" value={analytics.calibrationDue.length} color={analytics.calibrationDue.length?T.or:T.gn}/></div>

      {/* Activity Trend */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>7-Day Activity</div>
        <div style={{display:"flex",gap:20}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Checkouts</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.checkouts}))} height={80} color={T.bl}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Returns</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.returns}))} height={80} color={T.gn}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Inspections</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.inspections}))} height={80} color={T.tl}/></div></div></div>

      {/* Fleet Status Donut */}
      <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Fleet Status</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <DonutChart segments={[
              {value:kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length,color:T.gn},
              {value:kits.filter(k=>k.issuedTo).length,color:T.pk},
              {value:kits.filter(k=>k.maintenanceStatus).length,color:T.am}]} size={90}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.gn}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Available ({kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.pk}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Checked Out ({kits.filter(k=>k.issuedTo).length})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.am}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Maintenance ({kits.filter(k=>k.maintenanceStatus).length})</span></div></div></div></div>

        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>By Storage</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {locs.slice(0,5).map(l=>{const ct=kits.filter(k=>k.locId===l.id).length;const max=Math.max(...locs.map(x=>kits.filter(k=>k.locId===x.id).length),1);
              return(<div key={l.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:9,color:T.mu,fontFamily:T.m,width:60,overflow:"hidden",textOverflow:"ellipsis"}}>{l.sc}</span>
                <ProgressBar value={ct} max={max} color={T.tl} height={8}/>
                <span style={{fontSize:10,color:T.tx,fontFamily:T.m,width:20,textAlign:"right"}}>{ct}</span></div>)})}</div></div></div></div>}

    {tab==="utilization"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Most/Least Used */}
      <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Most Used Kits</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {analytics.mostUsedKits.map((u,i)=><div key={u.kit.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <span style={{fontSize:10,color:T.dm,fontFamily:T.m,width:16}}>{i+1}</span>
              <Sw color={u.kit.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {u.kit.color}</span>
              <Bg color={T.bl} bg="rgba(96,165,250,.1)">{u.checkouts} uses</Bg>
              <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{u.totalDaysOut}d out</span></div>)}</div></div>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Least Used / Idle</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {analytics.idleKits.length>0?analytics.idleKits.slice(0,5).map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <Sw color={k.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {k.color}</span>
              <Bg color={T.dm} bg="rgba(255,255,255,.03)">Never used</Bg></div>)
              :analytics.leastUsedKits.filter(u=>u.checkouts>0).slice(0,5).map(u=><div key={u.kit.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <Sw color={u.kit.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {u.kit.color}</span>
              <Bg color={T.mu}>{u.checkouts} uses</Bg></div>)}</div></div></div>

      {/* Utilization table */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>All Kit Utilization</div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr repeat(3,80px)",gap:"8px 16px",alignItems:"center",fontSize:10,fontFamily:T.m}}>
          <div style={{color:T.dm}}>Kit</div><div style={{color:T.dm}}>Type</div><div style={{color:T.dm,textAlign:"right"}}>Checkouts</div><div style={{color:T.dm,textAlign:"right"}}>Days Out</div><div style={{color:T.dm,textAlign:"right"}}>Avg Duration</div>
          {analytics.kitUtil.map(u=><>
            <div key={u.kit.id+"c"} style={{display:"flex",alignItems:"center",gap:6}}><Sw color={u.kit.color} size={16}/><span style={{color:T.tx}}>{u.kit.color}</span></div>
            <div style={{color:T.mu}}>{types.find(t=>t.id===u.kit.typeId)?.name}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.checkouts}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.totalDaysOut}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.avgDuration}d</div></>)}</div></div></div>}

    {tab==="accountability"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Problem users */}
      {analytics.problemUsers.length>0&&<div style={{padding:18,borderRadius:10,background:"rgba(239,68,68,.03)",border:"1px solid rgba(239,68,68,.1)"}}>
        <div style={{fontSize:12,fontWeight:600,color:T.rd,fontFamily:T.u,marginBottom:12}}>Attention Needed</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {analytics.problemUsers.map(u=><div key={u.person.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
            <div style={{width:32,height:32,borderRadius:16,background:T.rd+"18",border:"1px solid "+T.rd+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.rd,fontFamily:T.m}}>{u.person.title.slice(0,3)}</div>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{u.person.name}</div>
              <div style={{display:"flex",gap:4,marginTop:2}}>
                {u.overdueCount>0&&<Bg color={T.rd} bg="rgba(239,68,68,.1)">{u.overdueCount} overdue</Bg>}
                {u.damageCount>0&&<Bg color={T.am} bg="rgba(251,191,36,.1)">{u.damageCount} damaged</Bg>}
                {u.missingCount>0&&<Bg color={T.or} bg="rgba(251,146,60,.1)">{u.missingCount} missing</Bg>}</div></div></div>)}</div></div>}

      {/* User stats table */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Personnel Statistics</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr repeat(5,70px)",gap:"8px 12px",alignItems:"center",fontSize:10,fontFamily:T.m}}>
          <div style={{color:T.dm}}>Person</div><div style={{color:T.dm,textAlign:"right"}}>Total</div><div style={{color:T.dm,textAlign:"right"}}>Active</div><div style={{color:T.dm,textAlign:"right"}}>Overdue</div><div style={{color:T.dm,textAlign:"right"}}>Damaged</div><div style={{color:T.dm,textAlign:"right"}}>Missing</div>
          {analytics.userStats.map(u=><>
            <div key={u.person.id} style={{color:T.tx}}>{u.person.title} {u.person.name}</div>
            <div style={{textAlign:"right",color:T.tx}}>{u.totalCheckouts}</div>
            <div style={{textAlign:"right",color:u.activeCheckouts?T.pk:T.tx}}>{u.activeCheckouts}</div>
            <div style={{textAlign:"right",color:u.overdueCount?T.rd:T.tx}}>{u.overdueCount}</div>
            <div style={{textAlign:"right",color:u.damageCount?T.am:T.tx}}>{u.damageCount}</div>
            <div style={{textAlign:"right",color:u.missingCount?T.or:T.tx}}>{u.missingCount}</div></>)}</div></div></div>}

    {tab==="components"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Problem components */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Component Failure Rates</div>
        {analytics.problemComps.length>0?<div style={{display:"flex",flexDirection:"column",gap:6}}>
          {analytics.problemComps.map(c=><div key={c.comp.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(255,255,255,.02)"}}>
            <div style={{width:6,height:6,borderRadius:3,background:c.failRate>.1?T.rd:c.failRate>.05?T.am:T.mu}}/>
            <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>{c.comp.label}</span>
            <Bg color={T.am} bg="rgba(251,191,36,.08)">{c.damaged} damaged</Bg>
            <Bg color={T.rd} bg="rgba(239,68,68,.08)">{c.missing} missing</Bg>
            <span style={{fontSize:10,color:c.failRate>.1?T.rd:T.mu,fontFamily:T.m,fontWeight:600}}>{(c.failRate*100).toFixed(1)}%</span></div>)}</div>
          :<div style={{padding:20,textAlign:"center",color:T.gn,fontFamily:T.m,fontSize:11}}>✓ No component failures recorded</div>}</div>

      {/* Component by category */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Issues by Category</div>
        <div style={{display:"flex",gap:12}}>
          {CATS.map(cat=>{const catComps=analytics.compStats.filter(c=>c.comp.cat===cat);const issues=catComps.reduce((a,c)=>a+c.damaged+c.missing,0);
            return(<div key={cat} style={{flex:1,padding:12,borderRadius:8,background:"rgba(255,255,255,.02)",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:700,color:issues?T.am:T.gn,fontFamily:T.u}}>{issues}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{cat}</div></div>)})}</div></div></div>}

    {tab==="departments"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Department performance cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:12}}>
        {analytics.deptStats.map(d=><div key={d.dept.id} style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd,borderLeft:"4px solid "+d.dept.color}}>
          <div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:10}}>{d.dept.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><div style={{fontSize:18,fontWeight:700,color:T.bl,fontFamily:T.u}}>{d.kitCount}</div><div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Kits</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.pk,fontFamily:T.u}}>{d.issuedCount}</div><div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Issued</div></div></div>
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Inspection Compliance</span>
              <span style={{fontSize:10,fontWeight:600,color:d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd,fontFamily:T.m}}>{Math.round(d.compliance*100)}%</span></div>
            <ProgressBar value={d.compliance*100} max={100} color={d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd}/></div>
          <div style={{display:"flex",gap:4}}>
            {d.totalDamage>0&&<Bg color={T.am} bg="rgba(251,191,36,.08)">{d.totalDamage} damaged</Bg>}
            {d.totalMissing>0&&<Bg color={T.rd} bg="rgba(239,68,68,.08)">{d.totalMissing} missing</Bg>}
            {d.totalDamage===0&&d.totalMissing===0&&<Bg color={T.gn} bg="rgba(34,197,94,.08)">All good</Bg>}</div></div>)}</div></div>}</div>);}

export default AnalyticsPage;
