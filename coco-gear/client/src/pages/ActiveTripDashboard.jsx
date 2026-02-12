import { useMemo } from 'react';
import { T, CM } from '../theme/theme.js';
import { Sw, Bg, Bt, ProgressBar } from '../components/ui/index.js';

/* ──────────────────────────────────────────────
   Active Trip Operational Dashboard
   Shown when trip.status === "active" in the overview tab.
   All data is derived from props — no extra fetching.
   ────────────────────────────────────────────── */

const SEC_HDR={fontSize:12,fontWeight:700,fontFamily:"var(--u)",letterSpacing:.3,marginBottom:12};
const CARD_BASE={borderRadius:10,background:T.card,border:"1px solid "+T.bd};
const SECTION={padding:16,...CARD_BASE};
const COMPACT_CARD={padding:"8px 10px",borderRadius:8,background:T.card};

/* helper: days between two dates */
const daysBetween=(a,b)=>Math.ceil((new Date(b)-new Date(a))/864e5);
/* helper: days since a date */
const daysSince=(d)=>d?Math.floor((Date.now()-new Date(d))/864e5):null;

function ActiveTripDashboard({
  trip,tripKits,tripPers,tripBoats,tripNotes,
  types,personnel,depts,
  taskDone,taskTotal,packDone,packTotal,
  roleColors,roleLabels,noteCatColors,boatRoleColors,boatRoleLabels,
  setDetailTab,fmtDT
}){
  const at=trip;
  const now=new Date();
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());

  /* ── Computed metrics ── */
  const duration=daysBetween(at.startDate,at.endDate);
  const elapsed=daysBetween(at.startDate,now);
  const dayNum=Math.max(1,Math.min(elapsed+1,duration));
  const pctElapsed=duration>0?Math.min(100,Math.max(0,(elapsed/duration)*100)):0;

  const kitsDeployed=tripKits.filter(k=>k.issuedTo).length;
  const kitsTotal=tripKits.length;

  const tasks=at.tasks||[];
  const hasTasks=tasks.length>0;
  const tDone=hasTasks?tasks.filter(t=>t.status==="done").length:taskDone;
  const tTotal=hasTasks?tasks.length:taskTotal;

  const hasPacking=packTotal>0;

  /* ── Kit health analysis (memoized) ── */
  const kitAnalysis=useMemo(()=>{
    return tripKits.map(k=>{
      const ty=types.find(t=>t.id===k.typeId);
      const holder=k.issuedTo?personnel.find(p=>p.id===k.issuedTo):null;
      const comps=k.comps||{};
      const compEntries=Object.entries(comps);
      const hasDamaged=compEntries.some(([,s])=>s==="DAMAGED");
      const hasMissing=compEntries.some(([,s])=>s==="MISSING");
      const allGood=compEntries.length===0||compEntries.every(([,s])=>s==="GOOD");
      const daysSinceInspection=daysSince(k.lastChecked);
      const inMaintenance=!!k.maintenanceStatus;

      let borderColor=T.gn+"33";
      if(inMaintenance||hasMissing)borderColor=T.rd+"33";
      else if(!allGood||daysSinceInspection===null||daysSinceInspection>30)borderColor=T.am+"33";

      let healthDot=T.gn;
      if(hasMissing)healthDot=T.rd;
      else if(hasDamaged)healthDot=T.am;

      let inspBadgeColor=T.gn;
      if(daysSinceInspection===null)inspBadgeColor=T.rd;
      else if(daysSinceInspection>30)inspBadgeColor=T.rd;
      else if(daysSinceInspection>7)inspBadgeColor=T.am;

      return{kit:k,ty,holder,hasDamaged,hasMissing,allGood,daysSinceInspection,inMaintenance,borderColor,healthDot,inspBadgeColor};
    });
  },[tripKits,types,personnel]);

  const openIssues=kitAnalysis.filter(a=>a.hasDamaged||a.hasMissing).length;

  /* ── Alerts computation ── */
  const alerts=useMemo(()=>{
    const list=[];
    const inspThreshold=30;
    const returnThreshold=14;
    const calibWarnDays=30;

    for(const a of kitAnalysis){
      const k=a.kit;
      // Overdue inspections
      if(a.daysSinceInspection===null){
        list.push({severity:"amber",kit:k,text:k.color+" — Never inspected"});
      }else if(a.daysSinceInspection>inspThreshold){
        list.push({severity:"amber",kit:k,text:k.color+" — Last inspected "+a.daysSinceInspection+" days ago"});
      }

      // Calibrations due
      if(k.calibrationDates){
        const ty=a.ty;
        const compMap=ty?._type?.compIds||[];
        for(const[compKey,calDate] of Object.entries(k.calibrationDates)){
          if(!calDate)continue;
          const daysUntil=daysBetween(now,calDate);
          if(daysUntil<0){
            list.push({severity:"red",kit:k,text:k.color+" — Calibration overdue by "+Math.abs(daysUntil)+" days"});
          }else if(daysUntil<=calibWarnDays){
            list.push({severity:"amber",kit:k,text:k.color+" — Calibration due in "+daysUntil+" days"});
          }
        }
      }

      // Damaged/Missing components
      if(k.comps){
        for(const[compKey,status] of Object.entries(k.comps)){
          if(status==="DAMAGED"){
            list.push({severity:"amber",kit:k,text:k.color+" — Component damaged ("+compKey.split("#")[0].slice(-6)+")"});
          }else if(status==="MISSING"){
            list.push({severity:"red",kit:k,text:k.color+" — Component missing ("+compKey.split("#")[0].slice(-6)+")"});
          }
        }
      }

      // Kits in maintenance
      if(a.inMaintenance){
        list.push({severity:"red",kit:k,text:k.color+" — In maintenance ("+k.maintenanceStatus+")"});
      }

      // Overdue returns
      if(k.issuedTo&&k.issueHistory&&k.issueHistory.length>0){
        const lastIssue=k.issueHistory.find(h=>!h.returnedDate);
        if(lastIssue){
          const daysOut=daysSince(lastIssue.issuedDate);
          if(daysOut!==null&&daysOut>returnThreshold){
            const holderName=a.holder?.name||"Unknown";
            list.push({severity:"amber",kit:k,text:k.color+" — "+holderName+" ("+daysOut+" days out)"});
          }
        }
      }
    }
    return list;
  },[kitAnalysis]);

  /* ── Personnel → kits map ── */
  const personnelKitMap=useMemo(()=>{
    const map={};
    for(const k of tripKits){
      if(k.issuedTo){
        if(!map[k.issuedTo])map[k.issuedTo]=[];
        map[k.issuedTo].push(k);
      }
    }
    return map;
  },[tripKits]);

  /* ── Task phase breakdown ── */
  const taskPhases=useMemo(()=>{
    if(!hasTasks)return null;
    const phases=[
      {label:"Pre-deployment",key:"pre-deployment"},
      {label:"Deployment",key:"deployment"},
      {label:"Post-deployment",key:"post-deployment"}
    ];
    return phases.map(p=>{
      const ph=tasks.filter(t=>t.phase===p.key);
      const done=ph.filter(t=>t.status==="done").length;
      return{...p,total:ph.length,done};
    }).filter(p=>p.total>0);
  },[tasks,hasTasks]);

  const blockedTasks=hasTasks?tasks.filter(t=>t.status==="blocked"):[];
  const overdueTasks=hasTasks?tasks.filter(t=>t.dueDate&&t.status!=="done"&&new Date(t.dueDate)<now):[];

  /* ═══════════════ RENDER ═══════════════ */
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>

    {/* ── TOP ROW: Key Metrics ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(130px,1fr))",gap:10}}>
      {/* Day X of Y */}
      <div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Mission Day</div>
        <div style={{fontSize:22,fontWeight:800,color:T.bl,fontFamily:T.u}}>{dayNum}<span style={{fontSize:12,fontWeight:400,color:T.dm}}>/{duration}</span></div>
        <ProgressBar value={pctElapsed} max={100} color={T.bl} height={3}/></div>

      {/* Kits Deployed */}
      <div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Kits Deployed</div>
        <div style={{fontSize:22,fontWeight:800,color:kitsDeployed===kitsTotal&&kitsTotal>0?T.gn:T.am,fontFamily:T.u}}>
          {kitsDeployed}<span style={{fontSize:12,fontWeight:400,color:T.dm}}>/{kitsTotal}</span></div>
        <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>checked out</div></div>

      {/* Personnel */}
      <div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Personnel</div>
        <div style={{fontSize:22,fontWeight:800,color:T.tl,fontFamily:T.u}}>{tripPers.length}</div>
        <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>assigned</div></div>

      {/* Tasks (conditional) */}
      {(hasTasks||tTotal>0)&&<div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Tasks</div>
        <div style={{fontSize:22,fontWeight:800,color:tDone===tTotal&&tTotal>0?T.gn:tDone/Math.max(tTotal,1)>.5?T.bl:T.am,fontFamily:T.u}}>
          {tDone}<span style={{fontSize:12,fontWeight:400,color:T.dm}}>/{tTotal}</span></div>
        <ProgressBar value={tDone} max={Math.max(tTotal,1)} color={tDone===tTotal&&tTotal>0?T.gn:T.bl} height={3}/></div>}

      {/* Open Issues */}
      <div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Open Issues</div>
        <div style={{fontSize:22,fontWeight:800,color:openIssues>0?T.rd:T.gn,fontFamily:T.u}}>{openIssues}</div>
        <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{openIssues===0?"all clear":"kits affected"}</div></div>

      {/* Packing (conditional) */}
      {hasPacking&&<div style={{padding:"12px 14px",borderRadius:9,...CARD_BASE}}>
        <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Packing</div>
        <div style={{fontSize:22,fontWeight:800,color:packDone===packTotal?T.gn:T.or,fontFamily:T.u}}>
          {packDone}<span style={{fontSize:12,fontWeight:400,color:T.dm}}>/{packTotal}</span></div>
        <ProgressBar value={packDone} max={Math.max(packTotal,1)} color={packDone===packTotal?T.gn:T.or} height={3}/></div>}
    </div>

    {/* ── SECTION 1: Equipment Status Grid ── */}
    <div style={SECTION}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{...SEC_HDR,fontFamily:T.u,marginBottom:0,color:T.tx}}>Equipment Status <span style={{fontWeight:400,color:T.dm,fontSize:10}}>({kitsTotal})</span></div>
        <Bt v="ghost" sm onClick={()=>setDetailTab("equipment")}>View all &rarr;</Bt></div>
      {kitsTotal===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No kits assigned</div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(220px,100%),1fr))",gap:8}}>
          {kitAnalysis.map(a=>{const k=a.kit;return(
            <div key={k.id} onClick={()=>setDetailTab("equipment")}
              style={{...COMPACT_CARD,border:"1px solid "+a.borderColor,cursor:"pointer",transition:"all .12s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=a.borderColor.replace("33","66")}
              onMouseLeave={e=>e.currentTarget.style.borderColor=a.borderColor}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Sw color={k.color} size={20}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.m}}>{k.color}</span>
                    {a.inMaintenance&&<span style={{fontSize:8,color:T.rd,fontFamily:T.m,fontWeight:600,background:T.rd+"15",padding:"1px 5px",borderRadius:3}}>&nbsp;maintenance</span>}
                  </div>
                  <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{a.ty?.name||"Unknown type"}</div>
                  <div style={{fontSize:9,color:a.holder?T.sub:T.dm,fontFamily:T.m,marginTop:1}}>
                    {a.holder?a.holder.name:"Available"}</div></div>
                <div style={{display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end",flexShrink:0}}>
                  {/* Inspection badge */}
                  <div style={{fontSize:8,fontWeight:600,color:a.inspBadgeColor,fontFamily:T.m,background:a.inspBadgeColor+"15",
                    padding:"1px 5px",borderRadius:3}}>
                    {a.daysSinceInspection===null?"No insp.":(a.daysSinceInspection+"d")}</div>
                  {/* Health dot */}
                  <div style={{width:8,height:8,borderRadius:4,background:a.healthDot,flexShrink:0}}/></div></div>
            </div>)})}
        </div>}
    </div>

    {/* ── SECTION 2: Personnel Status ── */}
    <div style={SECTION}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{...SEC_HDR,fontFamily:T.u,marginBottom:0,color:T.tx}}>Personnel Status <span style={{fontWeight:400,color:T.dm,fontSize:10}}>({tripPers.length})</span></div>
        <Bt v="ghost" sm onClick={()=>setDetailTab("personnel")}>View all &rarr;</Bt></div>
      {tripPers.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No personnel assigned</div>:
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(240px,100%),1fr))",gap:8}}>
          {tripPers.map(p=>{const rc=roleColors[p.tripRole]||T.mu;const assignedKits=personnelKitMap[p.userId]||[];return(
            <div key={p.id} style={{...COMPACT_CARD,border:"1px solid "+T.bd,display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:14,background:rc+"22",border:"1px solid "+rc+"44",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:rc,fontFamily:T.m,flexShrink:0}}>
                {p.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{p.name}</span>
                  <span style={{fontSize:7,color:rc,fontFamily:T.m,textTransform:"uppercase",letterSpacing:.5,fontWeight:600}}>{roleLabels[p.tripRole]}</span></div>
                {assignedKits.length>0?
                  <div style={{display:"flex",gap:3,marginTop:3,alignItems:"center"}}>
                    {assignedKits.map(k=><Sw key={k.id} color={k.color} size={12}/>)}
                  </div>:
                  <div style={{fontSize:8,color:T.dm,fontFamily:T.m,marginTop:2}}>No gear</div>}
              </div></div>)})}
        </div>}
    </div>

    {/* ── SECTION 3: Today's Activity ── */}
    {/* Audit logs are not passed as props to the trip page. This section is a placeholder
       that can be enabled when audit log data is piped through to the trip detail view. */}
    {(()=>{
      // Attempt to build activity from kit issueHistory + inspections for today
      const activityItems=[];
      for(const k of tripKits){
        if(k.issueHistory){
          for(const h of k.issueHistory){
            if(h.issuedDate&&new Date(h.issuedDate)>=today){
              activityItems.push({time:new Date(h.issuedDate),action:"checkout",desc:k.color+" checked out to "+(h.person?.name||"someone")});}
            if(h.returnedDate&&new Date(h.returnedDate)>=today){
              activityItems.push({time:new Date(h.returnedDate),action:"return",desc:k.color+" returned"+(h.returnNotes?" — "+h.returnNotes:"")});}
          }}
        if(k.inspections){
          for(const ins of k.inspections){
            if(ins.date&&new Date(ins.date)>=today){
              activityItems.push({time:new Date(ins.date),action:"inspect",desc:k.color+" inspection completed"});}
          }}
        if(k.maintenanceHistory){
          for(const m of k.maintenanceHistory){
            if(m.startDate&&new Date(m.startDate)>=today){
              activityItems.push({time:new Date(m.startDate),action:"maintenance",desc:k.color+" entered "+m.type});}
            if(m.endDate&&new Date(m.endDate)>=today){
              activityItems.push({time:new Date(m.endDate),action:"maintenance",desc:k.color+" "+m.type+" completed"});}
          }}
      }
      activityItems.sort((a,b)=>b.time-a.time);

      const actionIcons={checkout:"\u2192",return:"\u2190",inspect:"\u2713",maintenance:"\u2699"};
      const actionColors={checkout:T.bl,return:T.tl,inspect:T.gn,maintenance:T.am};

      return(<div style={SECTION}>
        <div style={{...SEC_HDR,fontFamily:T.u,color:T.tx}}>Today's Activity</div>
        {activityItems.length===0?
          <div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No activity recorded today</div>:
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {activityItems.slice(0,15).map((a,i)=>{
              const hh=a.time.getHours().toString().padStart(2,"0");
              const mm=a.time.getMinutes().toString().padStart(2,"0");
              return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 8px",borderRadius:5,background:"rgba(255,255,255,.015)"}}>
                <span style={{fontSize:9,color:T.dm,fontFamily:T.m,fontWeight:600,width:36,flexShrink:0}}>{hh}:{mm}</span>
                <span style={{fontSize:10,color:actionColors[a.action]||T.mu,fontWeight:700,width:14,textAlign:"center"}}>{actionIcons[a.action]||"\u2022"}</span>
                <span style={{fontSize:10,color:T.sub,fontFamily:T.m}}>{a.desc}</span></div>);})}
            {activityItems.length>15&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center"}}>+{activityItems.length-15} more</div>}
          </div>}
      </div>);
    })()}

    {/* ── SECTION 4: Active Alerts ── */}
    {alerts.length>0&&<div style={{...SECTION,background:T.rd+"06",borderColor:T.rd+"22"}}>
      <div style={{...SEC_HDR,fontFamily:T.u,color:T.am}}>&#x26A0; Attention Required</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {alerts.slice(0,20).map((a,i)=>{
          const isRed=a.severity==="red";
          return(<div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:5,
            background:isRed?"rgba(248,113,113,.04)":"rgba(251,191,36,.04)",cursor:"pointer"}}
            onClick={()=>setDetailTab("equipment")}>
            <span style={{fontSize:10,color:isRed?T.rd:T.am,fontWeight:700,flexShrink:0}}>{isRed?"\u25CF":"\u25CB"}</span>
            <Sw color={a.kit.color} size={14}/>
            <span style={{fontSize:10,color:T.sub,fontFamily:T.m}}>{a.text}</span></div>);})}
        {alerts.length>20&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center"}}>+{alerts.length-20} more alerts</div>}
      </div>
    </div>}

    {/* ── SECTION 5: Quick Summaries (bottom row) ── */}
    <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
      {/* Recent Notes */}
      <div style={SECTION}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{...SEC_HDR,fontFamily:T.u,marginBottom:0,color:T.tx}}>Recent Notes</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("notes")}>View all &rarr;</Bt></div>
        {tripNotes.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No notes yet</div>:
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {tripNotes.slice(0,5).map(n=><div key={n.id} style={{padding:"6px 8px",borderRadius:5,background:"rgba(255,255,255,.02)",border:"1px solid "+T.bd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                <div style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontSize:9,fontWeight:600,color:T.tx,fontFamily:T.m}}>{n.authorName}</span>
                  <Bg color={noteCatColors[n.category]||T.mu} bg={(noteCatColors[n.category]||T.mu)+"18"}>{n.category}</Bg></div>
                <span style={{fontSize:7,color:T.dm,fontFamily:T.m}}>{fmtDT(n.createdAt)}</span></div>
              <div style={{fontSize:10,color:T.sub,fontFamily:T.m,lineHeight:1.4,whiteSpace:"pre-wrap"}}>
                {n.content.length>150?n.content.slice(0,150)+"...":n.content}</div></div>)}
          </div>}
      </div>

      {/* Task Progress OR USV Status */}
      {hasTasks&&taskPhases?
        <div style={SECTION}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{...SEC_HDR,fontFamily:T.u,marginBottom:0,color:T.tx}}>Task Progress</div>
            <Bt v="ghost" sm onClick={()=>setDetailTab("tasks")}>View all &rarr;</Bt></div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {taskPhases.map(p=>{const pct=p.total>0?p.done/p.total:0;return(
              <div key={p.key}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:9,fontWeight:600,color:T.sub,fontFamily:T.m}}>{p.label}</span>
                  <span style={{fontSize:9,fontWeight:700,color:p.done===p.total&&p.total>0?T.gn:T.tx,fontFamily:T.m}}>
                    {p.done}/{p.total}{p.done===p.total&&p.total>0?" \u2713":""}</span></div>
                <ProgressBar value={p.done} max={Math.max(p.total,1)} color={p.done===p.total&&p.total>0?T.gn:T.bl} height={4}/></div>)})}
          </div>
          {(blockedTasks.length>0||overdueTasks.length>0)&&<div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
            {blockedTasks.length>0&&<Bg color={T.rd} bg={T.rd+"18"}>{blockedTasks.length} blocked</Bg>}
            {overdueTasks.length>0&&<Bg color={T.rd} bg={T.rd+"18"}>{overdueTasks.length} overdue</Bg>}</div>}
        </div>:
        <div style={SECTION}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{...SEC_HDR,fontFamily:T.u,marginBottom:0,color:T.tx}}>USV Status</div>
            <Bt v="ghost" sm onClick={()=>setDetailTab("boats")}>View all &rarr;</Bt></div>
          {tripBoats.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No USVs assigned</div>:
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {tripBoats.map(b=><div key={b.tripBoatId} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 8px",borderRadius:5,
                background:(boatRoleColors[b.role]||T.bl)+"06",border:"1px solid "+(boatRoleColors[b.role]||T.bl)+"18"}}>
                <span style={{fontSize:12}}>&#x26F5;</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{b.name}</div>
                  <div style={{fontSize:8,color:boatRoleColors[b.role]||T.bl,fontFamily:T.m,textTransform:"uppercase",letterSpacing:.5}}>
                    {boatRoleLabels[b.role]||b.role}{b.type?" \u00B7 "+b.type:""}</div></div></div>)}
            </div>}
        </div>}
    </div>
  </div>);
}

export default ActiveTripDashboard;
