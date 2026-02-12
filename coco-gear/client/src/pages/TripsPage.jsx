import { useState, useMemo } from 'react';
import { T, CM } from '../theme/theme.js';
import { fmtDate, SYS_ROLE_LABELS, sysRoleColor } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Ta, Sl, SH, Tabs, ModalWrap, ConfirmDialog, DeptBg, ProgressBar } from '../components/ui/index.js';
import api from '../api.js';
import TripTasks from './TripTasks.jsx';

function TripsPage({trips,kits,types,depts,personnel,reservations,boats,isAdmin,isSuper,curUserId,settings,onRefreshTrips,onRefreshKits,onRefreshPersonnel,onRefreshBoats,onRefreshReservations}){
  const[md,setMd]=useState(null);
  const[fm,setFm]=useState({name:"",description:"",location:"",objectives:"",leadId:"",startDate:"",endDate:"",status:"planning"});
  const[selTrip,setSelTrip]=useState(null);const[assignMd,setAssignMd]=useState(false);const[assignKits,setAssignKits]=useState([]);
  const[addPersonMd,setAddPersonMd]=useState(false);const[addPersonIds,setAddPersonIds]=useState([]);const[addPersonRole,setAddPersonRole]=useState("member");
  const[tab,setTab]=useState("active");const[detailTab,setDetailTab]=useState("overview");
  const[noteText,setNoteText]=useState("");const[noteCat,setNoteCat]=useState("general");
  const[editRole,setEditRole]=useState(null);const[confirmDel,setConfirmDel]=useState(null);
  const[search,setSearch]=useState("");
  const[addBoatMd,setAddBoatMd]=useState(false);const[addBoatIds,setAddBoatIds]=useState([]);const[addBoatRole,setAddBoatRole]=useState("primary");
  const[taskDone,setTaskDone]=useState(0);const[taskTotal,setTaskTotal]=useState(0);
  const fmtD=d=>d?new Date(d).toLocaleDateString("default",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):"";
  const fmtDT=d=>d?new Date(d).toLocaleString("default",{month:"short",day:"numeric",year:"numeric",hour:"2-digit",minute:"2-digit"}):"";
  const statusColors={planning:T.bl,active:T.gn,completed:T.mu,cancelled:T.rd};
  const statusLabels={planning:"Planning",active:"Active",completed:"Completed",cancelled:"Cancelled"};
  const roleColors={director:T.rd,manager:T.am,"senior-spec":T.or,specialist:T.bl,engineer:T.tl,other:T.pu};
  const roleLabels={director:"Director",manager:"Manager","senior-spec":"Senior Specialist",specialist:"Specialist",engineer:"Engineer",other:"Other"};
  const noteCatColors={general:T.mu,logistics:T.bl,safety:T.rd,comms:T.ind,["after-action"]:T.am};
  const filtered=tab==="all"?trips:tab==="active"?trips.filter(t=>t.status==="planning"||t.status==="active"):trips.filter(t=>t.status===tab);
  const searchFiltered=search.trim()?filtered.filter(t=>t.name.toLowerCase().includes(search.toLowerCase())||t.location?.toLowerCase().includes(search.toLowerCase())):filtered;
  const activeTrip=selTrip?trips.find(t=>t.id===selTrip):null;
  const tripKits=activeTrip?kits.filter(k=>k.tripId===activeTrip.id):[];
  const availableForAssign=kits.filter(k=>!k.tripId||k.tripId===activeTrip?.id);
  const tripRes=activeTrip?reservations.filter(r=>r.tripId===activeTrip.id):[];
  const tripPers=activeTrip?.personnel||[];
  const tripNotes=activeTrip?.notes||[];
  const assignedUserIds=new Set(tripPers.map(p=>p.userId));
  const availablePersonnel=personnel.filter(p=>!assignedUserIds.has(p.id));
  const editable=activeTrip&&(activeTrip.status==="planning"||activeTrip.status==="active");

  const emptyFm=()=>({name:"",description:"",location:"",objectives:"",leadId:"",startDate:"",endDate:"",status:"planning"});
  const saveTrip=async()=>{if(!fm.name.trim()||!fm.startDate||!fm.endDate)return;
    try{const payload={name:fm.name.trim(),description:fm.description.trim(),location:fm.location.trim(),objectives:fm.objectives.trim(),
      leadId:fm.leadId||null,startDate:fm.startDate,endDate:fm.endDate,status:fm.status};
      if(md==="add"){const created=await api.trips.create(payload);setSelTrip(created.id)}
      else{await api.trips.update(md,payload)}
      await onRefreshTrips();await onRefreshKits()}catch(e){alert(e.message)}setMd(null)};
  const deleteTrip=async()=>{if(!confirmDel)return;try{await api.trips.delete(confirmDel);setSelTrip(null);await onRefreshTrips();await onRefreshKits()}catch(e){alert(e.message)}setConfirmDel(null)};
  const doAssign=async()=>{if(!activeTrip||!assignKits.length)return;
    try{const autoReserve=settings?.autoReserveOnTrip!==false;await api.trips.assignKits(activeTrip.id,assignKits,autoReserve);await onRefreshTrips();await onRefreshKits();if(autoReserve&&onRefreshReservations)await onRefreshReservations()}catch(e){alert(e.message)}setAssignMd(false);setAssignKits([])};
  const removeFromTrip=async(kitId)=>{if(!activeTrip)return;
    try{await api.trips.removeKit(activeTrip.id,kitId);await onRefreshTrips();await onRefreshKits()}catch(e){alert(e.message)}};
  const doAddPersonnel=async()=>{if(!activeTrip||!addPersonIds.length)return;
    try{await api.trips.addPersonnelBulk(activeTrip.id,addPersonIds,addPersonRole);await onRefreshTrips();await onRefreshPersonnel()}catch(e){alert(e.message)}setAddPersonMd(false);setAddPersonIds([]);setAddPersonRole("specialist")};
  const removePerson=async(pId)=>{if(!activeTrip)return;
    try{await api.trips.removePersonnel(activeTrip.id,pId);await onRefreshTrips()}catch(e){alert(e.message)}};
  const updatePersonRole=async(pId,role)=>{if(!activeTrip)return;
    try{await api.trips.updatePersonnel(activeTrip.id,pId,{role});await onRefreshTrips()}catch(e){alert(e.message)}setEditRole(null)};
  const addNote=async()=>{if(!activeTrip||!noteText.trim())return;
    try{await api.trips.addNote(activeTrip.id,{content:noteText.trim(),category:noteCat});setNoteText("");await onRefreshTrips()}catch(e){alert(e.message)}};
  const deleteNote=async(noteId)=>{if(!activeTrip)return;
    try{await api.trips.deleteNote(activeTrip.id,noteId);await onRefreshTrips()}catch(e){alert(e.message)}};
  const changeStatus=async(newStatus)=>{if(!activeTrip)return;
    try{await api.trips.update(activeTrip.id,{status:newStatus});await onRefreshTrips();await onRefreshKits()}catch(e){alert(e.message)}};
  const tripBoats=activeTrip?.boats||[];
  const assignedBoatIds=new Set(tripBoats.map(b=>b.boatId));
  const availableBoats=(boats||[]).filter(b=>b.status==="available"&&!assignedBoatIds.has(b.id));
  const boatRoleColors={primary:T.bl,support:T.tl,tender:T.am,rescue:T.rd};
  const boatRoleLabels={primary:"Primary",support:"Support",tender:"Tender",rescue:"Rescue"};
  const doAssignBoats=async()=>{if(!activeTrip||!addBoatIds.length)return;
    try{const autoReserve=settings?.autoReserveOnTrip!==false;await api.trips.assignBoats(activeTrip.id,addBoatIds,addBoatRole,autoReserve);await onRefreshTrips();await onRefreshBoats()}catch(e){alert(e.message)}setAddBoatMd(false);setAddBoatIds([])};
  const removeBoat=async(tripBoatId)=>{if(!activeTrip)return;
    try{await api.trips.removeBoat(activeTrip.id,tripBoatId);await onRefreshTrips();await onRefreshBoats()}catch(e){alert(e.message)}};

  const daysUntilStart=activeTrip?Math.ceil((new Date(activeTrip.startDate)-Date.now())/864e5):0;
  const daysUntilEnd=activeTrip?Math.ceil((new Date(activeTrip.endDate)-Date.now())/864e5):0;
  const duration=activeTrip?Math.ceil((new Date(activeTrip.endDate)-new Date(activeTrip.startDate))/864e5):0;

  /* ── List View (no trip selected) ── */
  if(!selTrip)return(<div>
    <SH title="Trips" sub={trips.filter(t=>t.status==="active").length+" active · "+trips.filter(t=>t.status==="planning").length+" planning · "+trips.length+" total"}
      action={isAdmin&&<Bt v="primary" onClick={()=>{setFm(emptyFm());setMd("add")}}>+ New Trip</Bt>}/>

    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {["active","planning","completed","cancelled","all"].map(t=>
          <button key={t} onClick={()=>setTab(t)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:T.m,fontWeight:600,
            background:tab===t?"rgba(96,165,250,.12)":"rgba(255,255,255,.03)",border:"1px solid "+(tab===t?"rgba(96,165,250,.3)":T.bd),
            color:tab===t?T.bl:T.mu,textTransform:"capitalize"}}>{t}</button>)}</div>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trips..." style={{maxWidth:200,padding:"5px 10px"}}/></div>

    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(340px,100%),1fr))",gap:12}}>
      {searchFiltered.length===0&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11,gridColumn:"1/-1"}}>No trips found</div>}
      {searchFiltered.map(t=>{return(
        <div key={t.id} onClick={()=>{setSelTrip(t.id);setDetailTab("overview")}} style={{padding:16,borderRadius:10,background:T.card,
          border:"1px solid "+T.bd,cursor:"pointer",transition:"all .15s"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=T.bdH} onMouseLeave={e=>e.currentTarget.style.borderColor=T.bd}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{t.name}</div>
              {t.location&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m,marginTop:1}}>⌖ {t.location}</div>}
              {t.description&&<div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.description}</div>}</div>
            <Bg color={statusColors[t.status]} bg={statusColors[t.status]+"18"}>{statusLabels[t.status]}</Bg></div>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginBottom:8}}>{fmtD(t.startDate)} → {fmtD(t.endDate)}{t.leadName&&<span style={{marginLeft:8,color:T.sub}}>Lead: {t.leadName}</span>}</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
            <Bg color={T.ind} bg="rgba(129,140,248,.1)">{t.kits.length} kits</Bg>
            <Bg color={T.tl} bg="rgba(45,212,191,.1)">{t.personnelCount||t.personnel?.length||0} personnel</Bg>
            {t.boatCount>0&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">{t.boatCount} USV{t.boatCount!==1?"s":""}</Bg>}
            {t.reservationCount>0&&<Bg color={T.pu} bg="rgba(168,85,247,.1)">{t.reservationCount} reservations</Bg>}
            {t.taskCount>0&&<Bg color={t.taskDone===t.taskCount?T.gn:T.or} bg={(t.taskDone===t.taskCount?T.gn:T.or)+"10"}>{t.taskDone}/{t.taskCount} tasks</Bg>}
            {t.kits.length>0&&<div style={{display:"flex",gap:2,alignItems:"center",marginLeft:4}}>
              {t.kits.slice(0,5).map(k=><div key={k.id} style={{width:14,height:14,borderRadius:7,background:CM[k.color]||"#888",border:"1px solid rgba(0,0,0,.2)"}} title={k.color}/>)}
              {t.kits.length>5&&<span style={{fontSize:8,color:T.dm}}>+{t.kits.length-5}</span>}</div>}</div></div>)})}</div>

    {/* Create/Edit trip modal */}
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"New Trip":"Edit Trip"} wide>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Trip Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))} placeholder="e.g. Operation Sunrise"/></Fl>
          <Fl label="Destination"><In value={fm.location} onChange={e=>setFm(p=>({...p,location:e.target.value}))} placeholder="e.g. Camp Pendleton, Pearl Harbor"/></Fl></div>
        <Fl label="Description"><In value={fm.description} onChange={e=>setFm(p=>({...p,description:e.target.value}))} placeholder="Brief description..."/></Fl>
        <Fl label="Objectives / Mission"><Ta value={fm.objectives} onChange={e=>setFm(p=>({...p,objectives:e.target.value}))} placeholder="Mission objectives, goals, tasks..." rows={3}/></Fl>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={fm.startDate} onChange={e=>setFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={fm.endDate} onChange={e=>setFm(p=>({...p,endDate:e.target.value}))}/></Fl>
          <Fl label="Status"><Sl options={[{v:"planning",l:"Planning"},{v:"active",l:"Active"},{v:"completed",l:"Completed"},{v:"cancelled",l:"Cancelled"}]}
            value={fm.status} onChange={e=>setFm(p=>({...p,status:e.target.value}))}/></Fl></div>
        <Fl label="Trip Lead"><Sl options={[{v:"",l:"— Select Lead —"},...personnel.filter(p=>["developer","director","super","engineer","manager","admin","lead"].includes(p.role)).map(p=>({v:p.id,l:p.name+(p.title?" — "+p.title:"")}))]
          } value={fm.leadId} onChange={e=>setFm(p=>({...p,leadId:e.target.value}))}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={saveTrip} disabled={!fm.name.trim()||!fm.startDate||!fm.endDate}>{md==="add"?"Create Trip":"Save Changes"}</Bt></div></div></ModalWrap></div>);

  /* ── Detail View (trip selected) ── */
  const at=activeTrip;if(!at)return null;

  return(<div>
    {/* Back button + trip header */}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <Bt onClick={()=>setSelTrip(null)} style={{fontSize:13}}>← Back</Bt>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,fontFamily:T.u,color:T.tx}}>{at.name}</h2>
          <Bg color={statusColors[at.status]} bg={statusColors[at.status]+"18"}>{statusLabels[at.status]}</Bg></div>
        <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:2}}>
          {fmtD(at.startDate)} → {fmtD(at.endDate)} · {duration} days
          {at.location&&<span style={{marginLeft:8}}>⌖ {at.location}</span>}
          {at.leadName&&<span style={{marginLeft:8}}>Lead: {at.leadName}</span>}</div></div>
      {isAdmin&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {at.status==="planning"&&<Bt v="success" sm onClick={()=>changeStatus("active")}>▸ Activate</Bt>}
        {at.status==="active"&&<Bt v="primary" sm onClick={()=>changeStatus("completed")}>✓ Complete</Bt>}
        <Bt sm onClick={()=>{setFm({name:at.name,description:at.description,location:at.location,objectives:at.objectives,
          leadId:at.leadId||"",startDate:at.startDate?new Date(at.startDate).toISOString().slice(0,10):"",endDate:at.endDate?new Date(at.endDate).toISOString().slice(0,10):"",status:at.status});setMd(at.id)}}>Edit</Bt>
        <Bt v="danger" sm onClick={()=>setConfirmDel(at.id)}>Delete</Bt></div>}</div>

    {/* Status timeline indicator */}
    <div style={{display:"flex",gap:12,marginBottom:16,overflowX:"auto",padding:"2px 0"}}>
      {[{l:"Kits",v:tripKits.length,c:T.ind,i:"▤"},{l:"USVs",v:tripBoats.length,c:T.bl,i:"⛵"},{l:"Personnel",v:tripPers.length,c:T.tl,i:"◎"},
        {l:"Reservations",v:tripRes.length,c:T.pu,i:"◷"},
        {l:daysUntilStart>0?"Starts in":"Started",v:daysUntilStart>0?daysUntilStart+"d":Math.abs(daysUntilStart)+"d ago",c:daysUntilStart>0?T.bl:T.gn,i:"◷"},
        {l:daysUntilEnd>0?"Ends in":"Ended",v:daysUntilEnd>0?daysUntilEnd+"d":Math.abs(daysUntilEnd)+"d ago",c:daysUntilEnd>0?T.am:T.rd,i:"◷"},
      ].map((s,i)=><div key={i} style={{padding:"10px 16px",borderRadius:8,background:s.c+"0a",border:"1px solid "+s.c+"22",minWidth:80,textAlign:"center"}}>
        <div style={{fontSize:18,fontWeight:800,color:s.c,fontFamily:T.u}}>{s.v}</div>
        <div style={{fontSize:8,color:T.dm,fontFamily:T.m,textTransform:"uppercase",letterSpacing:1}}>{s.l}</div></div>)}</div>

    {/* Tabs */}
    <Tabs tabs={[{id:"overview",l:"Overview"},{id:"personnel",l:"Personnel ("+tripPers.length+")"},{id:"equipment",l:"Equipment ("+tripKits.length+")"},
      {id:"tasks",l:"Tasks"+(taskTotal>0?" ("+taskDone+"/"+taskTotal+")":"")},{id:"boats",l:"USVs ("+tripBoats.length+")"},{id:"notes",l:"Notes ("+tripNotes.length+")"}]} active={detailTab} onChange={setDetailTab}/>

    {/* ── OVERVIEW TAB ── */}
    {detailTab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      {(at.description||at.objectives)&&<div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        {at.description&&<div style={{marginBottom:at.objectives?12:0}}>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Description</div>
          <div style={{fontSize:12,color:T.sub,fontFamily:T.m,lineHeight:1.6}}>{at.description}</div></div>}
        {at.objectives&&<div>
          <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:4}}>Objectives / Mission</div>
          <div style={{fontSize:12,color:T.sub,fontFamily:T.m,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{at.objectives}</div></div>}</div>}

      {/* Quick roster preview */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Personnel Roster</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("personnel")}>View all →</Bt></div>
        {tripPers.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No personnel assigned</div>:
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {tripPers.slice(0,12).map(p=><div key={p.id} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:6,
              background:roleColors[p.tripRole]+"0a",border:"1px solid "+roleColors[p.tripRole]+"22"}}>
              <div style={{width:22,height:22,borderRadius:11,background:roleColors[p.tripRole]+"22",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,fontWeight:700,color:roleColors[p.tripRole],fontFamily:T.m}}>{p.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
              <div><div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{p.name}</div>
                <div style={{fontSize:7,color:roleColors[p.tripRole],fontFamily:T.m,textTransform:"uppercase",letterSpacing:.5}}>{roleLabels[p.tripRole]}</div></div></div>)}
            {tripPers.length>12&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,padding:"5px 8px"}}>+{tripPers.length-12} more</div>}</div>}</div>

      {/* Quick equipment preview */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Equipment</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("equipment")}>View all →</Bt></div>
        {tripKits.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No kits assigned</div>:
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {tripKits.slice(0,6).map(k=>{const ty=types.find(t=>t.id===k.typeId);const holder=k.issuedTo?personnel.find(p=>p.id===k.issuedTo):null;return(
              <div key={k.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:"rgba(255,255,255,.02)",border:"1px solid "+T.bd}}>
                <Sw color={k.color} size={18}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color} <span style={{color:T.dm}}>({ty?.name})</span></div>
                  {holder&&<div style={{fontSize:8,color:T.am,fontFamily:T.m}}>→ {holder.name}</div>}</div></div>)})}
            {tripKits.length>6&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center"}}>+{tripKits.length-6} more kits</div>}</div>}</div>

      {/* Tasks summary */}
      {(()=>{const tasks=at.tasks||[];const total=tasks.length;const done=tasks.filter(t=>t.status==="done").length;
        const blocked=tasks.filter(t=>t.status==="blocked").length;
        const overdue=tasks.filter(t=>t.dueDate&&t.status!=="done"&&new Date(t.dueDate)<new Date()).length;
        const prePh=tasks.filter(t=>t.phase==="pre-deployment");const depPh=tasks.filter(t=>t.phase==="deployment");const postPh=tasks.filter(t=>t.phase==="post-deployment");
        return(<div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Tasks</div>
            <Bt v="ghost" sm onClick={()=>setDetailTab("tasks")}>View all →</Bt></div>
          {total===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No tasks defined</div>:
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <div style={{flex:1}}><ProgressBar value={done} max={Math.max(total,1)} color={done===total?T.gn:T.bl} height={4}/></div>
                <span style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{done}/{total}</span></div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {[["Pre",prePh,T.bl],["Deploy",depPh,T.gn],["Post",postPh,T.am]].map(([l,ph,c])=>ph.length>0&&
                  <Bg key={l} color={c} bg={c+"18"}>{l}: {ph.filter(t=>t.status==="done").length}/{ph.length}</Bg>)}
                {blocked>0&&<Bg color={T.rd} bg={T.rd+"18"}>{blocked} blocked</Bg>}
                {overdue>0&&<Bg color={T.rd} bg={T.rd+"18"}>{overdue} overdue</Bg>}</div></div>}</div>)})()}

      {/* USVs preview */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>USVs</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("boats")}>View all →</Bt></div>
        {tripBoats.length===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No USVs assigned</div>:
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {tripBoats.slice(0,6).map(b=><div key={b.tripBoatId} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:6,
              background:(boatRoleColors[b.role]||T.bl)+"0a",border:"1px solid "+(boatRoleColors[b.role]||T.bl)+"22"}}>
              <span style={{fontSize:12}}>⛵</span>
              <div><div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m}}>{b.name}</div>
                <div style={{fontSize:7,color:boatRoleColors[b.role]||T.bl,fontFamily:T.m,textTransform:"uppercase",letterSpacing:.5}}>{boatRoleLabels[b.role]||b.role}{b.type?" · "+b.type:""}</div></div></div>)}</div>}</div>

      {/* Recent notes preview */}
      {tripNotes.length>0&&<div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Recent Notes</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("notes")}>View all →</Bt></div>
        {tripNotes.slice(0,3).map(n=><div key={n.id} style={{padding:"8px 10px",borderRadius:6,background:"rgba(255,255,255,.02)",border:"1px solid "+T.bd,marginBottom:4}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <span style={{fontSize:9,fontWeight:600,color:T.tx,fontFamily:T.m}}>{n.authorName}</span>
              <Bg color={noteCatColors[n.category]||T.mu} bg={(noteCatColors[n.category]||T.mu)+"18"}>{n.category}</Bg></div>
            <span style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{fmtDT(n.createdAt)}</span></div>
          <div style={{fontSize:11,color:T.sub,fontFamily:T.m,lineHeight:1.5,whiteSpace:"pre-wrap"}}>{n.content.length>200?n.content.slice(0,200)+"...":n.content}</div></div>)}</div>}
    </div>}

    {/* ── PERSONNEL TAB ── */}
    {detailTab==="personnel"&&<div>
      {isAdmin&&editable&&<div style={{display:"flex",gap:8,marginBottom:16}}>
        <Bt v="primary" onClick={()=>{setAddPersonIds([]);setAddPersonRole("specialist");setAddPersonMd(true)}}>+ Add Personnel</Bt></div>}

      {tripPers.length===0?<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No personnel assigned to this trip yet</div>:
        <div>
          {/* Group by role */}
          {Object.entries(roleLabels).filter(([r])=>tripPers.some(p=>p.tripRole===r)).map(([role,label])=><div key={role} style={{marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:roleColors[role],fontFamily:T.m,textTransform:"uppercase",letterSpacing:1.2,marginBottom:8,
              paddingBottom:4,borderBottom:"1px solid "+roleColors[role]+"22"}}>{label}s ({tripPers.filter(p=>p.tripRole===role).length})</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(260px,100%),1fr))",gap:8}}>
              {tripPers.filter(p=>p.tripRole===role).map(p=>{const dept=depts.find(d=>d.id===p.deptId);return(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,
                  background:T.card,border:"1px solid "+T.bd}}>
                  <div style={{width:32,height:32,borderRadius:16,background:roleColors[p.tripRole]+"22",border:"1px solid "+roleColors[p.tripRole]+"44",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:roleColors[p.tripRole],fontFamily:T.m,flexShrink:0}}>
                    {p.name?.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{p.name}</div>
                    <div style={{display:"flex",gap:4,alignItems:"center",flexWrap:"wrap",marginTop:1}}>
                      {p.title&&<span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{p.title}</span>}
                      {dept&&<Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>}</div>
                    {p.notes&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>{p.notes}</div>}</div>
                  {isAdmin&&editable&&<div style={{display:"flex",gap:2,flexShrink:0}}>
                    {editRole===p.id?<div style={{display:"flex",flexDirection:"column",gap:2}}>
                      <Sl options={Object.entries(roleLabels).map(([v,l])=>({v,l}))} value={p.tripRole}
                        onChange={e=>{updatePersonRole(p.id,e.target.value)}} style={{fontSize:9,padding:"3px 6px"}}/>
                      <Bt v="ghost" sm onClick={()=>setEditRole(null)} style={{fontSize:8}}>Cancel</Bt></div>:
                      <Bt v="ghost" sm onClick={()=>setEditRole(p.id)} style={{fontSize:9}}>Role</Bt>}
                    <Bt v="ghost" sm onClick={()=>removePerson(p.id)} style={{color:T.rd,fontSize:9}}>×</Bt></div>}</div>)})}</div></div>)}</div>}</div>}

    {/* ── EQUIPMENT TAB ── */}
    {detailTab==="equipment"&&<div>
      {isAdmin&&editable&&<div style={{display:"flex",gap:8,marginBottom:16}}>
        <Bt v="primary" onClick={()=>{setAssignKits(tripKits.map(k=>k.id));setAssignMd(true)}}>+ Assign Kits</Bt></div>}

      {tripKits.length===0?<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No equipment assigned to this trip</div>:
        <div>
          {/* Equipment summary */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {Object.entries(tripKits.reduce((a,k)=>{const tn=types.find(t=>t.id===k.typeId)?.name||"Unknown";a[tn]=(a[tn]||0)+1;return a},{}))
              .map(([name,count])=><Bg key={name} color={T.ind} bg="rgba(129,140,248,.1)">{count}× {name}</Bg>)}</div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:8}}>
            {tripKits.map(k=>{const ty=types.find(t=>t.id===k.typeId);const holder=k.issuedTo?personnel.find(p=>p.id===k.issuedTo):null;
              const dept=k.deptId?depts.find(d=>d.id===k.deptId):null;return(
              <div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,
                background:T.card,border:"1px solid "+T.bd}}>
                <Sw color={k.color} size={24}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color}</div>
                  <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty?.name}</div>
                  <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                    {holder&&<Bg color={T.am} bg="rgba(251,191,36,.1)">→ {holder.name}</Bg>}
                    {dept&&<Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>}
                    {k.maintenanceStatus&&<Bg color={T.rd} bg="rgba(239,68,68,.1)">⚙ {k.maintenanceStatus}</Bg>}</div></div>
                {isAdmin&&editable&&<Bt v="ghost" sm onClick={()=>removeFromTrip(k.id)} style={{color:T.rd,fontSize:9}}>×</Bt>}</div>)})}
          </div>

          {/* Reservations for this trip */}
          {tripRes.length>0&&<div style={{marginTop:20}}>
            <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:10}}>Trip Reservations ({tripRes.length})</div>
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {tripRes.map(r=>{const k=kits.find(x=>x.id===r.kitId);const p=personnel.find(x=>x.id===r.personId);return(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:T.card,border:"1px solid "+T.bd}}>
                  {k&&<Sw color={k.color} size={14}/>}<div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:10,color:T.tx,fontFamily:T.m}}>{p?.name} — {k?.color}</div>
                    <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{fmtD(r.startDate)} → {fmtD(r.endDate)}</div></div>
                  <Bg color={r.status==="confirmed"?T.gn:r.status==="pending"?T.or:T.rd} bg={(r.status==="confirmed"?T.gn:r.status==="pending"?T.or:T.rd)+"18"}>{r.status}</Bg></div>)})}</div></div>}
        </div>}</div>}

    {/* ── TASKS TAB ── */}
    {detailTab==="tasks"&&<TripTasks tripId={at.id} tripPersonnel={tripPers} isAdmin={isAdmin} editable={editable}
      onTaskCountChange={(done,total)=>{setTaskDone(done);setTaskTotal(total)}}/>}

    {/* ── USVs TAB ── */}
    {detailTab==="boats"&&<div>
      {isAdmin&&editable&&<div style={{display:"flex",gap:8,marginBottom:16}}>
        <Bt v="primary" onClick={()=>{setAddBoatIds([]);setAddBoatRole("primary");setAddBoatMd(true)}}>+ Assign USVs</Bt></div>}

      {tripBoats.length===0?<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No USVs assigned to this trip yet</div>:
        <div>
          {/* Summary by role */}
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {Object.entries(boatRoleLabels).filter(([r])=>tripBoats.some(b=>b.role===r)).map(([r,l])=>
              <Bg key={r} color={boatRoleColors[r]} bg={(boatRoleColors[r])+"18"}>{tripBoats.filter(b=>b.role===r).length}× {l}</Bg>)}</div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:8}}>
            {tripBoats.map(b=><div key={b.tripBoatId} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,
              background:T.card,border:"1px solid "+T.bd}}>
              <div style={{width:36,height:36,borderRadius:8,background:(boatRoleColors[b.role]||T.bl)+"15",border:"1px solid "+(boatRoleColors[b.role]||T.bl)+"33",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⛵</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{b.name}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{b.type}{b.hullId?" · "+b.hullId:""}</div>
                <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                  <Bg color={boatRoleColors[b.role]||T.bl} bg={(boatRoleColors[b.role]||T.bl)+"18"}>{boatRoleLabels[b.role]||b.role}</Bg>
                  {b.length&&<Bg color={T.mu} bg="rgba(148,163,184,.1)">{b.length} m</Bg>}</div>
                {b.notes&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>{b.notes}</div>}</div>
              {isAdmin&&editable&&<Bt v="ghost" sm onClick={()=>removeBoat(b.tripBoatId)} style={{color:T.rd,fontSize:9}}>×</Bt>}</div>)}</div></div>}</div>}

    {/* ── NOTES TAB ── */}
    {detailTab==="notes"&&<div>
      {/* Add note form */}
      <div style={{padding:14,borderRadius:10,background:T.card,border:"1px solid "+T.bd,marginBottom:16}}>
        <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
          {["general","logistics","safety","comms","after-action"].map(c=><button key={c} onClick={()=>setNoteCat(c)}
            style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:4,fontSize:9,fontFamily:T.m,fontWeight:600,
              background:noteCat===c?(noteCatColors[c]||T.mu)+"18":"transparent",border:"1px solid "+(noteCat===c?(noteCatColors[c]||T.mu)+"44":T.bd),
              color:noteCat===c?(noteCatColors[c]||T.mu):T.dm,textTransform:"capitalize"}}>{c}</button>)}</div>
        <div style={{display:"flex",gap:8}}>
          <Ta value={noteText} onChange={e=>setNoteText(e.target.value)} placeholder="Add a note, update, or observation..." rows={2} style={{flex:1}}/>
          <Bt v="primary" onClick={addNote} disabled={!noteText.trim()} style={{alignSelf:"flex-end"}}>Post</Bt></div></div>

      {tripNotes.length===0?<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No notes yet. Add updates, observations, or after-action items above.</div>:
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {tripNotes.map(n=><div key={n.id} style={{padding:"12px 14px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{n.authorName}</span>
                <Bg color={noteCatColors[n.category]||T.mu} bg={(noteCatColors[n.category]||T.mu)+"18"}>{n.category}</Bg></div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{fmtDT(n.createdAt)}</span>
                {(n.authorId===curUserId||isAdmin)&&<button onClick={()=>deleteNote(n.id)} style={{all:"unset",cursor:"pointer",fontSize:10,color:T.rd,opacity:.5,padding:"2px 4px"}}>×</button>}</div></div>
            <div style={{fontSize:11,color:T.sub,fontFamily:T.m,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{n.content}</div></div>)}</div>}</div>}

    {/* ── MODALS ── */}
    {/* Create/Edit trip modal */}
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"New Trip":"Edit Trip"} wide>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Trip Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))} placeholder="e.g. Operation Sunrise"/></Fl>
          <Fl label="Destination"><In value={fm.location} onChange={e=>setFm(p=>({...p,location:e.target.value}))} placeholder="e.g. Camp Pendleton, Pearl Harbor"/></Fl></div>
        <Fl label="Description"><In value={fm.description} onChange={e=>setFm(p=>({...p,description:e.target.value}))} placeholder="Brief description..."/></Fl>
        <Fl label="Objectives / Mission"><Ta value={fm.objectives} onChange={e=>setFm(p=>({...p,objectives:e.target.value}))} placeholder="Mission objectives, goals, tasks..." rows={3}/></Fl>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={fm.startDate} onChange={e=>setFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={fm.endDate} onChange={e=>setFm(p=>({...p,endDate:e.target.value}))}/></Fl>
          <Fl label="Status"><Sl options={[{v:"planning",l:"Planning"},{v:"active",l:"Active"},{v:"completed",l:"Completed"},{v:"cancelled",l:"Cancelled"}]}
            value={fm.status} onChange={e=>setFm(p=>({...p,status:e.target.value}))}/></Fl></div>
        <Fl label="Trip Lead"><Sl options={[{v:"",l:"— Select Lead —"},...personnel.filter(p=>["developer","director","super","engineer","manager","admin","lead"].includes(p.role)).map(p=>({v:p.id,l:p.name+(p.title?" — "+p.title:"")}))]
          } value={fm.leadId} onChange={e=>setFm(p=>({...p,leadId:e.target.value}))}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={saveTrip} disabled={!fm.name.trim()||!fm.startDate||!fm.endDate}>{md==="add"?"Create Trip":"Save Changes"}</Bt></div></div></ModalWrap>

    {/* Assign kits modal */}
    <ModalWrap open={assignMd} onClose={()=>setAssignMd(false)} title="Assign Equipment" wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Select kits to assign to <b>{at.name}</b></div>
        <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {availableForAssign.map(k=>{const ty=types.find(t=>t.id===k.typeId);const isChecked=assignKits.includes(k.id);return(
            <div key={k.id} onClick={()=>setAssignKits(p=>isChecked?p.filter(x=>x!==k.id):[...p,k.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,cursor:"pointer",
                background:isChecked?"rgba(129,140,248,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isChecked?"rgba(129,140,248,.25)":T.bd)}}>
              <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isChecked?T.ind:T.bd),background:isChecked?T.ind:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700}}>{isChecked?"✓":""}</div>
              <Sw color={k.color} size={18}/><div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty?.name}</div></div>
              {k.tripId&&k.tripId!==at.id&&<Bg color={T.am} bg="rgba(251,191,36,.1)">On other trip</Bg>}
              {k.issuedTo&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">Issued</Bg>}</div>)})}</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Bt onClick={()=>setAssignMd(false)}>Cancel</Bt>
          <Bt v="primary" onClick={doAssign}>{assignKits.length} kits — Assign</Bt></div></div></ModalWrap>

    {/* Add personnel modal */}
    <ModalWrap open={addPersonMd} onClose={()=>setAddPersonMd(false)} title="Add Personnel to Trip" wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <Fl label="Trip Role"><Sl options={Object.entries(roleLabels).map(([v,l])=>({v,l}))} value={addPersonRole}
            onChange={e=>setAddPersonRole(e.target.value)} style={{minWidth:120}}/></Fl></div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Select people to add ({addPersonIds.length} selected)</div>
        <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {availablePersonnel.map(p=>{const isChecked=addPersonIds.includes(p.id);const dept=depts.find(d=>d.id===p.deptId);return(
            <div key={p.id} onClick={()=>setAddPersonIds(prev=>isChecked?prev.filter(x=>x!==p.id):[...prev,p.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,cursor:"pointer",
                background:isChecked?"rgba(45,212,191,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isChecked?"rgba(45,212,191,.25)":T.bd)}}>
              <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isChecked?T.tl:T.bd),background:isChecked?T.tl:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700}}>{isChecked?"✓":""}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{p.name}</div>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {p.title&&<span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{p.title}</span>}
                  {dept&&<Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>}</div></div>
              <Bg color={sysRoleColor(p.role)} bg={sysRoleColor(p.role)+"18"}>{SYS_ROLE_LABELS[p.role]||p.role}</Bg></div>)})}</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Bt onClick={()=>setAddPersonMd(false)}>Cancel</Bt>
          <Bt v="primary" onClick={doAddPersonnel} disabled={!addPersonIds.length}>{addPersonIds.length} people — Add to Trip</Bt></div></div></ModalWrap>

    {/* Assign USVs modal */}
    <ModalWrap open={addBoatMd} onClose={()=>setAddBoatMd(false)} title="Assign USVs to Trip" wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"flex-end"}}>
          <Fl label="USV Role"><Sl options={Object.entries(boatRoleLabels).map(([v,l])=>({v,l}))} value={addBoatRole}
            onChange={e=>setAddBoatRole(e.target.value)} style={{minWidth:120}}/></Fl></div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Select USVs to assign ({addBoatIds.length} selected)</div>
        <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {availableBoats.length===0&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No available USVs. Add USVs in Configuration → USVs first.</div>}
          {availableBoats.map(b=>{const isChecked=addBoatIds.includes(b.id);return(
            <div key={b.id} onClick={()=>setAddBoatIds(p=>isChecked?p.filter(x=>x!==b.id):[...p,b.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,cursor:"pointer",
                background:isChecked?"rgba(96,165,250,.06)":"rgba(255,255,255,.02)",border:"1px solid "+(isChecked?"rgba(96,165,250,.25)":T.bd)}}>
              <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isChecked?T.bl:T.bd),background:isChecked?T.bl:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700}}>{isChecked?"✓":""}</div>
              <span style={{fontSize:14}}>⛵</span>
              <div style={{flex:1}}>
                <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{b.name}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{b.type}{b.hullId?" · "+b.hullId:""}{b.length?" · "+b.length+" m":""}</div></div></div>)})}</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Bt onClick={()=>setAddBoatMd(false)}>Cancel</Bt>
          <Bt v="primary" onClick={doAssignBoats} disabled={!addBoatIds.length}>{addBoatIds.length} USVs — Assign</Bt></div></div></ModalWrap>

    {/* Delete confirmation */}
    <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={deleteTrip}
      title="Delete Trip?" message={"This will permanently delete this trip and remove all kit/personnel/USV assignments. This cannot be undone."}
      confirmLabel="Delete Trip" confirmColor={T.rd}/>
  </div>);}

export default TripsPage;
