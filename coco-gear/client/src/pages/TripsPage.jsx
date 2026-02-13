import { useState, useEffect, useMemo } from 'react';
import { T, CM } from '../theme/theme.js';
import { fmtDate, SYS_ROLE_LABELS, sysRoleColor } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Ta, Sl, Tg, SH, Tabs, ModalWrap, ConfirmDialog, DeptBg, ProgressBar } from '../components/ui/index.js';
import api from '../api.js';
import TripTasks from './TripTasks.jsx';
import TripPacking from './TripPacking.jsx';
import TripComms from './TripComms.jsx';
import ReadinessReview from './ReadinessReview.jsx';
import ActiveTripDashboard from './ActiveTripDashboard.jsx';
import TripAAR from './TripAAR.jsx';
import TripTimeline from './TripTimeline.jsx';

function ReadinessCard({tripId,onOpen,readinessData,setReadinessData}){
  const[loading,setLoading]=useState(false);
  useEffect(()=>{if(!tripId)return;setLoading(true);
    api.trips.readiness(tripId).then(d=>{setReadinessData(d);setLoading(false)}).catch(()=>setLoading(false))},[tripId]);
  if(loading)return(<div style={{padding:"12px 16px",borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
    <div style={{fontSize:10,color:T.dm,fontFamily:T.m}}>Checking readiness...</div></div>);
  if(!readinessData)return null;
  const d=readinessData;const reqFails=d.checks.filter(c=>c.required&&!c.passed).length;
  const borderColor=d.ready?T.gn:(reqFails>0?T.rd:T.am);
  return(<div onClick={onOpen} style={{padding:"12px 16px",borderRadius:10,background:borderColor+"08",
    border:"1px solid "+borderColor+"33",cursor:"pointer",transition:"all .15s"}}
    onMouseEnter={e=>e.currentTarget.style.borderColor=borderColor+"66"} onMouseLeave={e=>e.currentTarget.style.borderColor=borderColor+"33"}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:20,height:20,borderRadius:10,background:borderColor+"18",display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:10,fontWeight:700,color:borderColor}}>{d.ready?"\u2713":reqFails>0?"\u2717":"\u26A0"}</div>
        <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>
          {d.ready?"Ready: ":"Readiness: "}{d.score.passed}/{d.score.total}
          {!d.ready&&reqFails>0&&<span style={{color:T.rd}}> \u2014 {reqFails} issue{reqFails!==1?"s":""}</span>}
          {!d.ready&&reqFails===0&&<span style={{color:T.am}}> \u2014 warnings</span>}
          {d.ready&&<span style={{color:T.gn}}> checks passed</span>}</span></div>
      <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>View details \u25B6</span></div></div>);}

function TripsPage({trips,kits,types,depts,personnel,reservations,boats,isAdmin,isSuper,curUserId,settings,onRefreshTrips,onRefreshKits,onRefreshPersonnel,onRefreshBoats,onRefreshReservations}){
  const[md,setMd]=useState(null);
  const[fm,setFm]=useState({name:"",description:"",location:"",objectives:"",leadId:"",startDate:"",endDate:"",status:"planning",restricted:false,classification:""});
  const[selTrip,setSelTrip]=useState(null);const[assignMd,setAssignMd]=useState(false);const[assignKits,setAssignKits]=useState([]);
  const[addPersonMd,setAddPersonMd]=useState(false);const[addPersonIds,setAddPersonIds]=useState([]);const[addPersonRole,setAddPersonRole]=useState("member");
  const[tab,setTab]=useState("active");const[detailTab,setDetailTab]=useState("overview");
  const[noteText,setNoteText]=useState("");const[noteCat,setNoteCat]=useState("general");
  const[editRole,setEditRole]=useState(null);const[confirmDel,setConfirmDel]=useState(null);
  const[search,setSearch]=useState("");
  const[addBoatMd,setAddBoatMd]=useState(false);const[addBoatIds,setAddBoatIds]=useState([]);const[addBoatRole,setAddBoatRole]=useState("primary");
  const[showReadiness,setShowReadiness]=useState(false);const[readinessData,setReadinessData]=useState(null);
  const[showAAR,setShowAAR]=useState(false);
  const[taskDone,setTaskDone]=useState(0);const[taskTotal,setTaskTotal]=useState(0);
  const[packDone,setPackDone]=useState(0);const[packTotal,setPackTotal]=useState(0);
  const[commsCount,setCommsCount]=useState(0);
  // Clone & template state
  const[cloneMd,setCloneMd]=useState(false);const[cloneFm,setCloneFm]=useState({name:"",startDate:"",endDate:"",location:""});const[cloning,setCloning]=useState(false);
  const[saveTplMd,setSaveTplMd]=useState(false);const[tplName,setTplName]=useState("");const[savingTpl,setSavingTpl]=useState(false);
  const[templates,setTemplates]=useState([]);const[listTab,setListTab]=useState("trips");const[tplLoaded,setTplLoaded]=useState(false);
  const[fromTplMd,setFromTplMd]=useState(null);const[fromTplFm,setFromTplFm]=useState({name:"",startDate:"",endDate:"",location:"",leadId:""});const[applyingTpl,setApplyingTpl]=useState(false);
  const[editTplMd,setEditTplMd]=useState(null);const[editTplFm,setEditTplFm]=useState({name:"",description:"",location:"",objectives:""});
  const[confirmDelTpl,setConfirmDelTpl]=useState(null);
  // Conflict detection state
  const[conflictData,setConflictData]=useState(null);const[conflictLoading,setConflictLoading]=useState(false);
  const[conflictExpanded,setConflictExpanded]=useState(false);const[conflictSection,setConflictSection]=useState("personnel");
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

  const emptyFm=()=>({name:"",description:"",location:"",objectives:"",leadId:"",startDate:"",endDate:"",status:"planning",restricted:false,classification:""});
  const saveTrip=async()=>{if(!fm.name.trim()||!fm.startDate||!fm.endDate)return;
    try{const payload={name:fm.name.trim(),description:fm.description.trim(),location:fm.location.trim(),objectives:fm.objectives.trim(),
      leadId:fm.leadId||null,startDate:fm.startDate,endDate:fm.endDate,status:fm.status,
      restricted:fm.restricted||false,classification:fm.restricted?(fm.classification||null):null};
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

  // Load templates when switching to templates tab
  useEffect(()=>{if(listTab==="templates"&&!tplLoaded){api.tripTemplates.list().then(d=>{setTemplates(d);setTplLoaded(true)}).catch(()=>{})}},[listTab,tplLoaded]);
  const refreshTemplates=()=>{api.tripTemplates.list().then(d=>{setTemplates(d);setTplLoaded(true)}).catch(()=>{})};
  const doClone=async()=>{if(!activeTrip||!cloneFm.startDate||!cloneFm.endDate)return;setCloning(true);
    try{const result=await api.trips.clone(activeTrip.id,{name:cloneFm.name||undefined,startDate:cloneFm.startDate,endDate:cloneFm.endDate,location:cloneFm.location||undefined});
      await onRefreshTrips();setCloneMd(false);setSelTrip(result.id);setDetailTab("overview")}catch(e){alert(e.message)}setCloning(false)};
  const doSaveAsTemplate=async()=>{if(!activeTrip||!tplName.trim())return;setSavingTpl(true);
    try{await api.tripTemplates.fromTrip(activeTrip.id,{name:tplName.trim()});setSaveTplMd(false);setTplName("");setTplLoaded(false)}catch(e){alert(e.message)}setSavingTpl(false)};
  const doApplyTemplate=async()=>{if(!fromTplMd||!fromTplFm.name.trim()||!fromTplFm.startDate||!fromTplFm.endDate)return;setApplyingTpl(true);
    try{const result=await api.tripTemplates.apply(fromTplMd.id,{name:fromTplFm.name.trim(),startDate:fromTplFm.startDate,endDate:fromTplFm.endDate,
      location:fromTplFm.location||undefined,leadId:fromTplFm.leadId||undefined});
      await onRefreshTrips();setFromTplMd(null);setListTab("trips");setSelTrip(result.id);setDetailTab("overview")}catch(e){alert(e.message)}setApplyingTpl(false)};
  const doUpdateTemplate=async()=>{if(!editTplMd||!editTplFm.name.trim())return;
    try{await api.tripTemplates.update(editTplMd,{name:editTplFm.name.trim(),description:editTplFm.description.trim()||null,location:editTplFm.location.trim()||null,objectives:editTplFm.objectives.trim()||null});
      setEditTplMd(null);refreshTemplates()}catch(e){alert(e.message)}};
  const doDeleteTemplate=async()=>{if(!confirmDelTpl)return;try{await api.tripTemplates.delete(confirmDelTpl);refreshTemplates()}catch(e){alert(e.message)}setConfirmDelTpl(null)};

  // Fetch conflict data when viewing a planning/active trip
  useEffect(()=>{if(!selTrip)return;const trip=trips.find(t=>t.id===selTrip);
    if(!trip||!['planning','active'].includes(trip.status)){setConflictData(null);return}
    setConflictLoading(true);api.trips.conflicts(selTrip).then(d=>{setConflictData(d);setConflictLoading(false)}).catch(()=>{setConflictData(null);setConflictLoading(false)})},[selTrip,trips]);

  const daysUntilStart=activeTrip?Math.ceil((new Date(activeTrip.startDate)-Date.now())/864e5):0;
  const daysUntilEnd=activeTrip?Math.ceil((new Date(activeTrip.endDate)-Date.now())/864e5):0;
  const duration=activeTrip?Math.ceil((new Date(activeTrip.endDate)-new Date(activeTrip.startDate))/864e5):0;

  /* ── List View (no trip selected) ── */
  if(!selTrip)return(<div>
    <SH title="Trips" sub={trips.filter(t=>t.status==="active").length+" active · "+trips.filter(t=>t.status==="planning").length+" planning · "+trips.length+" total"}
      action={isAdmin&&<div style={{display:"flex",gap:6}}>{templates.length>0&&<Bt onClick={()=>setListTab(listTab==="templates"?"trips":"templates")}>{listTab==="templates"?"View Trips":"Templates"}</Bt>}
        <Bt v="primary" onClick={()=>{setFm(emptyFm());setMd("add")}}>+ New Trip</Bt></div>}/>

    {/* Trips / Templates toggle tabs */}
    {isAdmin&&<div style={{display:"flex",gap:4,marginBottom:12}}>
      {[{id:"trips",l:"Trips"},{id:"templates",l:"Templates"+(templates.length>0?" ("+templates.length+")":"")}].map(t=>
        <button key={t.id} onClick={()=>setListTab(t.id)} style={{all:"unset",cursor:"pointer",padding:"5px 14px",borderRadius:5,fontSize:10,fontFamily:T.m,fontWeight:600,
          background:listTab===t.id?"rgba(129,140,248,.12)":"rgba(255,255,255,.03)",border:"1px solid "+(listTab===t.id?"rgba(129,140,248,.3)":T.bd),
          color:listTab===t.id?T.ind:T.mu}}>{t.l}</button>)}</div>}

    {/* ── TRIPS LIST ── */}
    {listTab==="trips"&&<div>
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
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{t.restricted&&<span title="Restricted">&#128274; </span>}{t.name}</div>
                {t.restricted&&t.classification&&<Bg color={T.rd} bg={T.rd+"18"}>{t.classification}</Bg>}</div>
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
            {(t._count?.phases||t.phases?.length||0)>0&&<Bg color={T.pu} bg={T.pu+"10"}>{t._count?.phases||t.phases?.length} phases</Bg>}
            {t.conflictCount>0&&<Bg color={T.am} bg={T.am+"18"}>&#9888; {t.conflictCount} conflict{t.conflictCount!==1?"s":""}</Bg>}
            {t.kits.length>0&&<div style={{display:"flex",gap:2,alignItems:"center",marginLeft:4}}>
              {t.kits.slice(0,5).map(k=><div key={k.id} style={{width:14,height:14,borderRadius:7,background:CM[k.color]||"#888",border:"1px solid rgba(0,0,0,.2)"}} title={k.color}/>)}
              {t.kits.length>5&&<span style={{fontSize:8,color:T.dm}}>+{t.kits.length-5}</span>}</div>}</div></div>)})}</div></div>}

    {/* ── TEMPLATES LIST ── */}
    {listTab==="templates"&&<div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(340px,100%),1fr))",gap:12}}>
        {templates.length===0&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11,gridColumn:"1/-1"}}>No trip templates yet. Save a template from an existing trip's detail view.</div>}
        {templates.map(tpl=>{const taskCount=(tpl.tasks||[]).length;const commsCount=(tpl.commsEntries||[]).length;
          const packCount=(tpl.packingItems||[]).length;const roleCount=(tpl.personnelRoles||[]).length;const kitCount=(tpl.kitTypeRequirements||[]).length;
          return(<div key={tpl.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.ind+"22",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor=T.ind+"44"} onMouseLeave={e=>e.currentTarget.style.borderColor=T.ind+"22"}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{tpl.name}</div>
                {tpl.description&&<div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:2,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tpl.description}</div>}
                {tpl.location&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m,marginTop:1}}>⌖ {tpl.location}</div>}</div>
              <Bg color={T.ind} bg={T.ind+"18"}>Template</Bg></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
              {roleCount>0&&<Bg color={T.tl} bg="rgba(45,212,191,.1)">{(tpl.personnelRoles||[]).reduce((s,r)=>s+r.count,0)} roles</Bg>}
              {taskCount>0&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">{taskCount} tasks</Bg>}
              {commsCount>0&&<Bg color={T.ind} bg="rgba(129,140,248,.1)">{commsCount} comms</Bg>}
              {packCount>0&&<Bg color={T.am} bg="rgba(251,191,36,.1)">{packCount} packing</Bg>}
              {kitCount>0&&<Bg color={T.pu} bg="rgba(168,85,247,.1)">{kitCount} kit types</Bg>}</div>
            {tpl.createdBy&&<div style={{fontSize:8,color:T.dm,fontFamily:T.m,marginBottom:8}}>Created by {tpl.createdBy.name} · {fmtD(tpl.createdAt)}</div>}
            <div style={{display:"flex",gap:6}}>
              <Bt v="primary" sm onClick={()=>{setFromTplFm({name:"",startDate:"",endDate:"",location:tpl.location||"",leadId:""});setFromTplMd(tpl)}}>New Trip from Template</Bt>
              <Bt sm onClick={()=>{setEditTplFm({name:tpl.name,description:tpl.description||"",location:tpl.location||"",objectives:tpl.objectives||""});setEditTplMd(tpl.id)}}>Edit</Bt>
              <Bt v="danger" sm onClick={()=>setConfirmDelTpl(tpl.id)}>Delete</Bt></div></div>)})}</div></div>}

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
        {/* Restricted access toggle */}
        <div style={{padding:"12px 14px",borderRadius:8,background:fm.restricted?"rgba(239,68,68,.04)":"rgba(255,255,255,.02)",border:"1px solid "+(fm.restricted?"rgba(239,68,68,.15)":T.bd),transition:"all .15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Tg checked={fm.restricted} onChange={v=>setFm(p=>({...p,restricted:v}))}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:fm.restricted?T.rd:T.tx,fontFamily:T.m}}>Restricted Access</div>
              <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:1}}>When enabled, only assigned personnel and administrators can view this trip. Other users will not see the trip in their trip list.</div></div></div>
          {fm.restricted&&<div style={{marginTop:10}}>
            <Fl label="Classification Label (optional)">
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                {["OPSEC","Restricted","Need-to-Know"].map(c=>
                  <button key={c} onClick={()=>setFm(p=>({...p,classification:p.classification===c?"":c}))}
                    style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:4,fontSize:9,fontFamily:T.m,fontWeight:600,
                      background:fm.classification===c?T.rd+"18":"transparent",border:"1px solid "+(fm.classification===c?T.rd+"44":T.bd),
                      color:fm.classification===c?T.rd:T.dm}}>{c}</button>)}</div>
              <In value={fm.classification} onChange={e=>setFm(p=>({...p,classification:e.target.value}))} placeholder="Custom label or select above..."/></Fl></div>}</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={saveTrip} disabled={!fm.name.trim()||!fm.startDate||!fm.endDate}>{md==="add"?"Create Trip":"Save Changes"}</Bt></div></div></ModalWrap>

    {/* New Trip from Template modal */}
    <ModalWrap open={!!fromTplMd} onClose={()=>setFromTplMd(null)} title={"New Trip from Template"+(fromTplMd?" — "+fromTplMd.name:"")} wide>
      {fromTplMd&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Trip Name"><In value={fromTplFm.name} onChange={e=>setFromTplFm(p=>({...p,name:e.target.value}))} placeholder="e.g. Operation Sunrise Q2"/></Fl>
          <Fl label="Location"><In value={fromTplFm.location} onChange={e=>setFromTplFm(p=>({...p,location:e.target.value}))} placeholder={fromTplMd.location||"Location..."}/></Fl></div>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={fromTplFm.startDate} onChange={e=>setFromTplFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={fromTplFm.endDate} onChange={e=>setFromTplFm(p=>({...p,endDate:e.target.value}))}/></Fl>
          <Fl label="Trip Lead"><Sl options={[{v:"",l:"— Select Lead —"},...personnel.filter(p=>["developer","director","super","engineer","manager","admin","lead"].includes(p.role)).map(p=>({v:p.id,l:p.name+(p.title?" — "+p.title:"")}))]
            } value={fromTplFm.leadId} onChange={e=>setFromTplFm(p=>({...p,leadId:e.target.value}))}/></Fl></div>
        <div style={{padding:12,borderRadius:8,background:T.ind+"08",border:"1px solid "+T.ind+"22"}}>
          <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,marginBottom:6}}>Template will create:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {(fromTplMd.tasks||[]).length>0&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">{(fromTplMd.tasks||[]).length} tasks</Bg>}
            {(fromTplMd.commsEntries||[]).length>0&&<Bg color={T.ind} bg="rgba(129,140,248,.1)">{(fromTplMd.commsEntries||[]).length} comms entries</Bg>}
            {(fromTplMd.packingItems||[]).length>0&&<Bg color={T.am} bg="rgba(251,191,36,.1)">{(fromTplMd.packingItems||[]).length} packing items</Bg>}</div>
          {(fromTplMd.personnelRoles||[]).length>0&&<div style={{marginTop:6,fontSize:9,color:T.sub,fontFamily:T.m}}>
            Recommended: {(fromTplMd.personnelRoles||[]).map(r=>r.count+"x "+roleLabels[r.role]||r.role).join(", ")}</div>}
          {(fromTplMd.kitTypeRequirements||[]).length>0&&<div style={{fontSize:9,color:T.sub,fontFamily:T.m,marginTop:2}}>
            Kit types: {(fromTplMd.kitTypeRequirements||[]).map(k=>k.quantity+"x "+k.typeName).join(", ")}</div>}
          <div style={{fontSize:8,color:T.dm,fontFamily:T.m,marginTop:6}}>Personnel and equipment are not auto-assigned — add them during planning</div></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setFromTplMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={doApplyTemplate} disabled={!fromTplFm.name.trim()||!fromTplFm.startDate||!fromTplFm.endDate||applyingTpl}>{applyingTpl?"Creating...":"Create Trip"}</Bt></div></div>}</ModalWrap>

    {/* Edit template modal */}
    <ModalWrap open={!!editTplMd} onClose={()=>setEditTplMd(null)} title="Edit Template">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Template Name"><In value={editTplFm.name} onChange={e=>setEditTplFm(p=>({...p,name:e.target.value}))} placeholder="Template name"/></Fl>
        <Fl label="Description"><In value={editTplFm.description} onChange={e=>setEditTplFm(p=>({...p,description:e.target.value}))} placeholder="Brief description..."/></Fl>
        <Fl label="Default Location"><In value={editTplFm.location} onChange={e=>setEditTplFm(p=>({...p,location:e.target.value}))} placeholder="Location..."/></Fl>
        <Fl label="Objectives"><Ta value={editTplFm.objectives} onChange={e=>setEditTplFm(p=>({...p,objectives:e.target.value}))} placeholder="Default objectives..." rows={3}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setEditTplMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={doUpdateTemplate} disabled={!editTplFm.name.trim()}>Save Changes</Bt></div></div></ModalWrap>

    {/* Delete template confirmation */}
    <ConfirmDialog open={!!confirmDelTpl} onClose={()=>setConfirmDelTpl(null)} onConfirm={doDeleteTemplate}
      title="Delete Template?" message="This will permanently delete this trip template. This cannot be undone."
      confirmLabel="Delete Template" confirmColor={T.rd}/></div>);

  /* ── Detail View (trip selected) ── */
  const at=activeTrip;if(!at)return null;

  return(<div>
    {/* Back button + trip header */}
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
      <Bt onClick={()=>setSelTrip(null)} style={{fontSize:13}}>← Back</Bt>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <h2 style={{margin:0,fontSize:20,fontWeight:800,fontFamily:T.u,color:T.tx}}>{at.restricted&&<span title="Restricted">&#128274; </span>}{at.name}</h2>
          <Bg color={statusColors[at.status]} bg={statusColors[at.status]+"18"}>{statusLabels[at.status]}</Bg>
          {at.restricted&&at.classification&&<Bg color={T.rd} bg={T.rd+"18"}>{at.classification}</Bg>}</div>
        <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:2}}>
          {fmtD(at.startDate)} → {fmtD(at.endDate)} · {duration} days
          {at.location&&<span style={{marginLeft:8}}>⌖ {at.location}</span>}
          {at.leadName&&<span style={{marginLeft:8}}>Lead: {at.leadName}</span>}</div>
        {at.restricted&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,fontStyle:"italic",marginTop:2}}>This trip is restricted. Only assigned personnel and administrators can view it.</div>}</div>
      {isAdmin&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        {at.status==="planning"&&<Bt v="success" sm onClick={()=>setShowReadiness(true)}>▸ Activate</Bt>}
        {at.status==="active"&&<Bt v="primary" sm onClick={()=>changeStatus("completed")}>✓ Complete</Bt>}
        {(at.status==="active"||at.status==="completed")&&<Bt sm onClick={()=>{setCloneFm({name:at.name+" (Copy)",startDate:"",endDate:"",location:at.location||""});setCloneMd(true)}}>Clone</Bt>}
        <Bt sm onClick={()=>{setTplName(at.name);setSaveTplMd(true)}}>Save as Template</Bt>
        <Bt sm onClick={()=>{setFm({name:at.name,description:at.description,location:at.location,objectives:at.objectives,
          leadId:at.leadId||"",startDate:at.startDate?new Date(at.startDate).toISOString().slice(0,10):"",endDate:at.endDate?new Date(at.endDate).toISOString().slice(0,10):"",status:at.status,
          restricted:at.restricted||false,classification:at.classification||""});setMd(at.id)}}>Edit</Bt>
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
      {id:"tasks",l:"Tasks"+(taskTotal>0?" ("+taskDone+"/"+taskTotal+")":"")},{id:"packing",l:"Packing"+(packTotal>0?" ("+packDone+"/"+packTotal+")":"")},
      {id:"comms",l:"Comms"+(commsCount>0?" ("+commsCount+")":"")},{id:"timeline",l:"Timeline"+((at.phases?.length||0)+(at.milestones?.length||0)>0?" ("+(at.phases?.length||0)+"/"+(at.milestones?.length||0)+")":"")},{id:"boats",l:"USVs ("+tripBoats.length+")"},{id:"notes",l:"Notes ("+tripNotes.length+")"}]} active={detailTab} onChange={setDetailTab}/>

    {/* ── OVERVIEW TAB ── */}
    {detailTab==="overview"&&(at.status==="active"?
      <ActiveTripDashboard trip={at} tripKits={tripKits} tripPers={tripPers} tripBoats={tripBoats} tripNotes={tripNotes}
        types={types} personnel={personnel} depts={depts}
        taskDone={taskDone} taskTotal={taskTotal} packDone={packDone} packTotal={packTotal}
        roleColors={roleColors} roleLabels={roleLabels} noteCatColors={noteCatColors}
        boatRoleColors={boatRoleColors} boatRoleLabels={boatRoleLabels}
        setDetailTab={setDetailTab} fmtDT={fmtDT}/>:
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {at.status==="planning"&&<ReadinessCard tripId={at.id} onOpen={()=>setShowReadiness(true)} readinessData={readinessData} setReadinessData={setReadinessData}/>}

      {/* Conflicts card for planning/active trips */}
      {conflictData&&conflictData.hasConflicts&&<div style={{padding:"14px 18px",borderRadius:10,
        background:T.am+"08",border:"1px solid "+T.am+"28",borderLeft:"3px solid "+T.am}}>
        <div onClick={()=>setConflictExpanded(!conflictExpanded)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:22,height:22,borderRadius:11,background:T.am+"22",display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:700,color:T.am}}>&#9888;</div>
            <span style={{fontSize:12,fontWeight:700,color:T.tx,fontFamily:T.u}}>Scheduling Conflicts</span>
            <span style={{fontSize:10,color:T.am,fontFamily:T.m}}>
              {conflictData.summary.affectedPersonnel>0&&conflictData.summary.totalPersonnelConflicts+" personnel conflict"+(conflictData.summary.totalPersonnelConflicts!==1?"s":"")}
              {conflictData.summary.affectedPersonnel>0&&conflictData.summary.affectedKits>0&&" · "}
              {conflictData.summary.affectedKits>0&&conflictData.summary.totalEquipmentConflicts+" equipment conflict"+(conflictData.summary.totalEquipmentConflicts!==1?"s":"")}</span></div>
          <span style={{fontSize:9,color:T.dm,fontFamily:T.m,transition:"transform .15s",transform:conflictExpanded?"rotate(90deg)":"none"}}>&#9654;</span></div>

        {conflictExpanded&&<div style={{marginTop:12}}>
          {/* Section toggle */}
          <div style={{display:"flex",gap:4,marginBottom:10}}>
            {conflictData.summary.affectedPersonnel>0&&<button onClick={()=>setConflictSection("personnel")}
              style={{all:"unset",cursor:"pointer",padding:"4px 12px",borderRadius:5,fontSize:9,fontFamily:T.m,fontWeight:600,
                background:conflictSection==="personnel"?T.am+"18":"transparent",border:"1px solid "+(conflictSection==="personnel"?T.am+"44":T.bd),
                color:conflictSection==="personnel"?T.am:T.mu}}>Personnel ({conflictData.summary.affectedPersonnel})</button>}
            {conflictData.summary.affectedKits>0&&<button onClick={()=>setConflictSection("equipment")}
              style={{all:"unset",cursor:"pointer",padding:"4px 12px",borderRadius:5,fontSize:9,fontFamily:T.m,fontWeight:600,
                background:conflictSection==="equipment"?T.am+"18":"transparent",border:"1px solid "+(conflictSection==="equipment"?T.am+"44":T.bd),
                color:conflictSection==="equipment"?T.am:T.mu}}>Equipment ({conflictData.summary.affectedKits})</button>}</div>

          {/* Personnel conflicts */}
          {conflictSection==="personnel"&&conflictData.personnelConflicts.map(pc=>
            <div key={pc.userId} style={{marginBottom:8,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)",border:"1px solid "+T.bd}}>
              <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m,marginBottom:4}}>{pc.userName}
                <span style={{fontSize:9,color:T.mu,fontWeight:400,marginLeft:6}}>({roleLabels[pc.tripRole]||pc.tripRole})</span></div>
              {pc.conflictingTrips.map(ct=>
                <div key={ct.tripId} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",flexWrap:"wrap"}}>
                  <span onClick={()=>{setSelTrip(ct.tripId);setDetailTab("overview")}} style={{fontSize:10,color:T.bl,fontFamily:T.m,cursor:"pointer",textDecoration:"underline"}}>{ct.tripName}</span>
                  <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{fmtD(ct.startDate)} → {fmtD(ct.endDate)}</span>
                  <Bg color={T.am} bg={T.am+"18"}>{ct.overlapDays}d overlap</Bg>
                  <Bg color={statusColors[ct.tripStatus]} bg={statusColors[ct.tripStatus]+"18"}>{statusLabels[ct.tripStatus]}</Bg>
                  {isAdmin&&editable&&<button onClick={async()=>{const tp=tripPers.find(p=>p.userId===pc.userId);if(!tp)return;
                    try{await api.trips.removePersonnel(at.id,tp.id);await onRefreshTrips()}catch(e){alert(e.message)}}}
                    style={{all:"unset",cursor:"pointer",fontSize:8,color:T.rd,fontFamily:T.m,padding:"2px 6px",borderRadius:3,border:"1px solid "+T.rd+"33",background:T.rd+"08"}}>Remove from this trip</button>}</div>)}</div>)}

          {/* Equipment conflicts */}
          {conflictSection==="equipment"&&conflictData.equipmentConflicts.map(ec=>
            <div key={ec.kitId} style={{marginBottom:8,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)",border:"1px solid "+T.bd}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                <Sw color={ec.kitColor} size={14}/>
                <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{ec.kitColor}</span>
                <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>({ec.kitType})</span></div>
              {ec.conflicts.map((c,i)=>
                <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 0",flexWrap:"wrap"}}>
                  {c.type==="trip"?<span onClick={()=>{setSelTrip(c.id);setDetailTab("overview")}} style={{fontSize:10,color:T.bl,fontFamily:T.m,cursor:"pointer",textDecoration:"underline"}}>{c.name}</span>
                    :<span style={{fontSize:10,color:T.sub,fontFamily:T.m}}>{c.name}</span>}
                  <Bg color={c.type==="trip"?T.ind:T.pu} bg={(c.type==="trip"?T.ind:T.pu)+"18"}>{c.type}</Bg>
                  <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{fmtD(c.startDate)} → {fmtD(c.endDate)}</span>
                  <Bg color={T.am} bg={T.am+"18"}>{c.overlapDays}d overlap</Bg>
                  {isAdmin&&editable&&<button onClick={async()=>{try{await api.trips.removeKit(at.id,ec.kitId);await onRefreshTrips();await onRefreshKits()}catch(e){alert(e.message)}}}
                    style={{all:"unset",cursor:"pointer",fontSize:8,color:T.rd,fontFamily:T.m,padding:"2px 6px",borderRadius:3,border:"1px solid "+T.rd+"33",background:T.rd+"08"}}>Unassign from this trip</button>}</div>)}</div>)}
        </div>}</div>}

      {/* AAR card for completed trips */}
      {at.status==="completed"&&<div onClick={()=>setShowAAR(true)} style={{padding:"16px 20px",borderRadius:10,
        background:"rgba(37,99,235,.04)",border:"1px solid rgba(37,99,235,.18)",cursor:"pointer",transition:"all .15s"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor="rgba(37,99,235,.35)";e.currentTarget.style.background="rgba(37,99,235,.07)"}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor="rgba(37,99,235,.18)";e.currentTarget.style.background="rgba(37,99,235,.04)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <div style={{width:24,height:24,borderRadius:12,background:"rgba(37,99,235,.12)",display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:700,color:T.bl}}>&#9776;</div>
              <span style={{fontSize:13,fontWeight:700,color:T.tx,fontFamily:T.u}}>After-Action Report</span></div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <Bg color={T.tl} bg="rgba(45,212,191,.1)">{tripPers.length} personnel</Bg>
              <Bg color={T.ind} bg="rgba(129,140,248,.1)">{tripKits.length} kits</Bg>
              {(()=>{const tasks=at.tasks||[];const total=tasks.length;const done=tasks.filter(t=>t.status==="done").length;
                return total>0?<Bg color={done===total?T.gn:T.or} bg={(done===total?T.gn:T.or)+"10"}>{done}/{total} tasks</Bg>:null})()}
              {tripNotes.filter(n=>n.category==="after-action").length>0&&
                <Bg color={T.am} bg="rgba(251,191,36,.1)">{tripNotes.filter(n=>n.category==="after-action").length} lessons learned</Bg>}</div></div>
          <span style={{fontSize:11,fontWeight:600,color:T.bl,fontFamily:T.m,whiteSpace:"nowrap"}}>Generate Report &#8594;</span></div></div>}

      {/* AAR link for active trips */}
      {at.status==="active"&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:-8}}>
        <button onClick={()=>setShowAAR(true)} style={{all:"unset",cursor:"pointer",fontSize:10,color:T.bl,fontFamily:T.m,fontWeight:600,
          padding:"4px 10px",borderRadius:5,background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.12)",transition:"all .12s"}}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(96,165,250,.12)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(96,165,250,.06)"}>
          Generate interim report &#8594;</button></div>}

      {/* Timeline summary card */}
      {((at.phases?.length||0)>0||(at.milestones?.length||0)>0)&&<div style={{padding:"14px 18px",borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Timeline</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("timeline")}>View Timeline →</Bt></div>
        {(at.phases?.length||0)>0&&<div style={{height:20,display:"flex",borderRadius:4,overflow:"hidden",marginBottom:8}}>
          {at.phases.map((p,i)=>{const dur=Math.max(1,Math.ceil((new Date(p.endDate)-new Date(p.startDate))/864e5));
            const totalDur=Math.max(1,Math.ceil((new Date(at.endDate)-new Date(at.startDate))/864e5));
            const w=Math.max(2,(dur/totalDur)*100);
            const c=p.color||[T.bl,T.gn,T.am,T.pu,T.tl,T.ind,T.or,T.rd][i%8];
            return(<div key={p.id} style={{flex:w,background:c+"33",borderRight:i<at.phases.length-1?"1px solid "+T.bg:"none"}} title={p.name+" ("+dur+"d)"}/>)})}</div>}
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{at.phases?.length||0} phases, {at.milestones?.length||0} milestones</span>
          {(()=>{const now=Date.now();const next=(at.milestones||[]).filter(m=>!m.completed).sort((a,b)=>new Date(a.date)-new Date(b.date))[0];
            if(!next)return null;const daysTo=Math.ceil((new Date(next.date)-now)/864e5);
            return daysTo>0?<span style={{fontSize:9,color:T.am,fontFamily:T.m}}>Next: {next.name} in {daysTo}d</span>
              :<span style={{fontSize:9,color:T.gn,fontFamily:T.m}}>{next.name} - completed</span>})()}</div></div>}

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

      {/* Packing summary */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Packing</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("packing")}>View all →</Bt></div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Bg color={T.ind} bg="rgba(129,140,248,.1)">{tripKits.length} kits</Bg>
          <Bg color={T.tl} bg="rgba(45,212,191,.1)">{Object.keys(roleLabels).filter(r=>tripPers.some(p=>p.tripRole===r)).length} roles</Bg>
          {packTotal>0&&<Bg color={packDone===packTotal?T.gn:T.or} bg={(packDone===packTotal?T.gn:T.or)+"10"}>My progress: {packDone}/{packTotal}</Bg>}
        </div></div>

      {/* Comms preview */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:11,fontWeight:700,color:T.tx,fontFamily:T.u}}>Comms</div>
          <Bt v="ghost" sm onClick={()=>setDetailTab("comms")}>View all →</Bt></div>
        {commsCount===0?<div style={{fontSize:10,color:T.dm,fontFamily:T.m,textAlign:"center",padding:10}}>No comms plan</div>:
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Bg color={T.ind} bg="rgba(129,140,248,.1)">{commsCount} {commsCount===1?"entry":"entries"}</Bg>
          </div>}</div>

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
    </div>)}

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
    {detailTab==="tasks"&&<TripTasks tripId={at.id} tripPersonnel={tripPers} isAdmin={isAdmin} isSuper={isSuper} editable={editable}
      onTaskCountChange={(done,total)=>{setTaskDone(done);setTaskTotal(total)}}/>}

    {/* ── PACKING TAB ── */}
    {detailTab==="packing"&&<TripPacking tripId={at.id} tripPersonnel={tripPers} isAdmin={isAdmin} isSuper={isSuper} editable={editable}
      curUserId={curUserId} onPackingCountChange={(done,total)=>{setPackDone(done);setPackTotal(total)}}/>}

    {/* ── COMMS TAB ── */}
    {detailTab==="comms"&&<TripComms tripId={at.id} tripName={at.name} tripLocation={at.location} tripStart={at.startDate} tripEnd={at.endDate}
      tripPersonnel={tripPers} isAdmin={isAdmin} editable={editable}
      onCommsCountChange={(count)=>{setCommsCount(count)}}/>}

    {/* ── TIMELINE TAB ── */}
    {detailTab==="timeline"&&<TripTimeline trip={at} isAdmin={isAdmin} editable={editable} onRefresh={onRefreshTrips}/>}

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
        {/* Restricted access toggle */}
        <div style={{padding:"12px 14px",borderRadius:8,background:fm.restricted?"rgba(239,68,68,.04)":"rgba(255,255,255,.02)",border:"1px solid "+(fm.restricted?"rgba(239,68,68,.15)":T.bd),transition:"all .15s"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Tg checked={fm.restricted} onChange={v=>setFm(p=>({...p,restricted:v}))}/>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:fm.restricted?T.rd:T.tx,fontFamily:T.m}}>Restricted Access</div>
              <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:1}}>When enabled, only assigned personnel and administrators can view this trip. Other users will not see the trip in their trip list.</div></div></div>
          {fm.restricted&&<div style={{marginTop:10}}>
            <Fl label="Classification Label (optional)">
              <div style={{display:"flex",gap:6,marginBottom:6}}>
                {["OPSEC","Restricted","Need-to-Know"].map(c=>
                  <button key={c} onClick={()=>setFm(p=>({...p,classification:p.classification===c?"":c}))}
                    style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:4,fontSize:9,fontFamily:T.m,fontWeight:600,
                      background:fm.classification===c?T.rd+"18":"transparent",border:"1px solid "+(fm.classification===c?T.rd+"44":T.bd),
                      color:fm.classification===c?T.rd:T.dm}}>{c}</button>)}</div>
              <In value={fm.classification} onChange={e=>setFm(p=>({...p,classification:e.target.value}))} placeholder="Custom label or select above..."/></Fl></div>}</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={saveTrip} disabled={!fm.name.trim()||!fm.startDate||!fm.endDate}>{md==="add"?"Create Trip":"Save Changes"}</Bt></div></div></ModalWrap>

    {/* Assign kits modal */}
    <ModalWrap open={assignMd} onClose={()=>setAssignMd(false)} title="Assign Equipment" wide>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Select kits to assign to <b>{at.name}</b></div>
        <div style={{maxHeight:400,overflowY:"auto",display:"flex",flexDirection:"column",gap:4}}>
          {(()=>{
            // Check each kit for conflicts: on other overlapping trips or has overlapping reservations
            return availableForAssign.map(k=>{const ty=types.find(t=>t.id===k.typeId);const isChecked=assignKits.includes(k.id);
              // Check for trip conflicts: kit assigned to another overlapping trip
              const kitTripConflict=k.tripId&&k.tripId!==at.id?trips.find(t=>t.id===k.tripId&&['planning','active'].includes(t.status)
                &&new Date(t.startDate)<new Date(at.endDate)&&new Date(t.endDate)>new Date(at.startDate)):null;
              // Check for reservation conflicts from global reservations
              const kitResConflicts=reservations.filter(r=>r.kitId===k.id&&['pending','confirmed'].includes(r.status)
                &&(!r.tripId||r.tripId!==at.id)
                &&new Date(r.startDate)<new Date(at.endDate)&&new Date(r.endDate)>new Date(at.startDate));
              const hasConflict=!!kitTripConflict||kitResConflicts.length>0;
              return(
            <div key={k.id} onClick={()=>setAssignKits(p=>isChecked?p.filter(x=>x!==k.id):[...p,k.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,cursor:"pointer",
                background:isChecked?"rgba(129,140,248,.06)":hasConflict?"rgba(251,191,36,.04)":"rgba(255,255,255,.02)",
                border:"1px solid "+(isChecked?"rgba(129,140,248,.25)":hasConflict?T.am+"22":T.bd)}}>
              <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isChecked?T.ind:T.bd),background:isChecked?T.ind:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700}}>{isChecked?"✓":""}</div>
              <Sw color={k.color} size={18}/><div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k.color}</span>
                  {kitTripConflict&&<span style={{fontSize:8,fontWeight:600,color:T.am,fontFamily:T.m,padding:"1px 5px",borderRadius:3,
                    background:T.am+"18",border:"1px solid "+T.am+"33"}}>&#9888; On trip: {kitTripConflict.name} ({fmtD(kitTripConflict.startDate)} → {fmtD(kitTripConflict.endDate)})</span>}
                  {kitResConflicts.length>0&&!kitTripConflict&&<span style={{fontSize:8,fontWeight:600,color:T.am,fontFamily:T.m,padding:"1px 5px",borderRadius:3,
                    background:T.am+"18",border:"1px solid "+T.am+"33"}}>&#9888; Reserved: {fmtD(kitResConflicts[0].startDate)} → {fmtD(kitResConflicts[0].endDate)}{kitResConflicts[0].person?" by "+kitResConflicts[0].person.name:""}</span>}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty?.name}</div></div>
              {k.tripId&&k.tripId!==at.id&&!kitTripConflict&&<Bg color={T.am} bg="rgba(251,191,36,.1)">On other trip</Bg>}
              {k.issuedTo&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">Issued</Bg>}</div>)})})()}</div>
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
          {(()=>{
            // Sort personnel: those without conflicts first
            const pConflicts=conflictData?.personnelConflicts||[];
            const conflictUserIds=new Set(pConflicts.map(pc=>pc.userId));
            const sorted=[...availablePersonnel].sort((a,b)=>{
              const aConf=conflictUserIds.has(a.id)?1:0;const bConf=conflictUserIds.has(b.id)?1:0;return aConf-bConf});
            return sorted.map(p=>{const isChecked=addPersonIds.includes(p.id);const dept=depts.find(d=>d.id===p.deptId);
              // Check if this person has conflicts with the current trip dates
              const personConflicts=conflictData?[]:[];
              // Use the trip's date range to find if this person is on other overlapping trips
              // Cross-reference from all trip personnel data - check conflictData for people already on the trip
              // For people NOT yet on this trip, we check if they appear on other overlapping trips via a simple lookup
              // We batch-fetch conflicts for the trip, so we need to check broader data
              // Since conflictData only covers people already on THIS trip, we check available personnel differently
              // Use the allTrips data to find overlaps for available personnel
              const personTrips=trips.filter(t=>t.id!==at.id&&['planning','active'].includes(t.status)
                &&new Date(t.startDate)<new Date(at.endDate)&&new Date(t.endDate)>new Date(at.startDate)
                &&t.personnel?.some(tp=>tp.userId===p.id));
              return(
            <div key={p.id} onClick={()=>setAddPersonIds(prev=>isChecked?prev.filter(x=>x!==p.id):[...prev,p.id])}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,cursor:"pointer",
                background:isChecked?"rgba(45,212,191,.06)":personTrips.length>0?"rgba(251,191,36,.04)":"rgba(255,255,255,.02)",
                border:"1px solid "+(isChecked?"rgba(45,212,191,.25)":personTrips.length>0?T.am+"22":T.bd)}}>
              <div style={{width:18,height:18,borderRadius:4,border:"1.5px solid "+(isChecked?T.tl:T.bd),background:isChecked?T.tl:"transparent",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:700}}>{isChecked?"✓":""}</div>
              <div style={{flex:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{p.name}</span>
                  {personTrips.length>0&&<span style={{fontSize:8,fontWeight:600,color:T.am,fontFamily:T.m,padding:"1px 5px",borderRadius:3,
                    background:T.am+"18",border:"1px solid "+T.am+"33"}}>
                    {personTrips.length===1?"&#9888; On trip: "+personTrips[0].name:"&#9888; "+personTrips.length+" trip conflicts"}</span>}</div>
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  {p.title&&<span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{p.title}</span>}
                  {dept&&<Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>}</div>
                {personTrips.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:2}}>
                  {personTrips.slice(0,2).map(ct=><span key={ct.id} style={{fontSize:8,color:T.am,fontFamily:T.m}}>{ct.name} ({fmtD(ct.startDate)} → {fmtD(ct.endDate)})</span>)}</div>}</div>
              <Bg color={sysRoleColor(p.role)} bg={sysRoleColor(p.role)+"18"}>{SYS_ROLE_LABELS[p.role]||p.role}</Bg></div>)})})()}</div>
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

    {/* Readiness review modal */}
    <ReadinessReview tripId={at.id} tripName={at.name} tripStart={at.startDate} tripEnd={at.endDate}
      open={showReadiness} onClose={()=>setShowReadiness(false)} onActivate={()=>changeStatus("active")}/>

    {/* Delete confirmation */}
    <ConfirmDialog open={!!confirmDel} onClose={()=>setConfirmDel(null)} onConfirm={deleteTrip}
      title="Delete Trip?" message={"This will permanently delete this trip and remove all kit/personnel/USV assignments. This cannot be undone."}
      confirmLabel="Delete Trip" confirmColor={T.rd}/>

    {/* After-Action Report */}
    {showAAR&&<TripAAR tripId={at.id} tripName={at.name} onClose={()=>setShowAAR(false)}
      onAddNote={async(data)=>{await api.trips.addNote(at.id,data);await onRefreshTrips()}}/>}

    {/* Clone Trip modal */}
    <ModalWrap open={cloneMd} onClose={()=>setCloneMd(false)} title={"Clone Trip — "+at.name} wide>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="New Trip Name"><In value={cloneFm.name} onChange={e=>setCloneFm(p=>({...p,name:e.target.value}))} placeholder={at.name+" (Copy)"}/></Fl>
          <Fl label="Location"><In value={cloneFm.location} onChange={e=>setCloneFm(p=>({...p,location:e.target.value}))} placeholder={at.location||""}/></Fl></div>
        <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={cloneFm.startDate} onChange={e=>setCloneFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={cloneFm.endDate} onChange={e=>setCloneFm(p=>({...p,endDate:e.target.value}))}/></Fl></div>
        <div style={{padding:12,borderRadius:8,background:T.gn+"08",border:"1px solid "+T.gn+"22"}}>
          <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,marginBottom:6}}>What will be cloned:</div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {tripPers.length>0&&<div style={{fontSize:10,color:T.gn,fontFamily:T.m}}>&#10003; {tripPers.length} personnel assignments</div>}
            {(at.tasks||[]).length>0&&<div style={{fontSize:10,color:T.gn,fontFamily:T.m}}>&#10003; {(at.tasks||[]).length} tasks (reset to todo)</div>}
            {at._count?.commsEntries>0&&<div style={{fontSize:10,color:T.gn,fontFamily:T.m}}>&#10003; {at._count.commsEntries} comms entries</div>}
            <div style={{fontSize:10,color:T.gn,fontFamily:T.m}}>&#10003; Packing items</div>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:4}}>&#10007; Kit assignments (assign new equipment during planning)</div>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m}}>&#10007; Notes (operational records are not copied)</div>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m}}>&#10007; Reservations</div></div></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setCloneMd(false)}>Cancel</Bt>
          <Bt v="primary" onClick={doClone} disabled={!cloneFm.startDate||!cloneFm.endDate||cloning}>{cloning?"Cloning...":"Clone Trip"}</Bt></div></div></ModalWrap>

    {/* Save as Template modal */}
    <ModalWrap open={saveTplMd} onClose={()=>setSaveTplMd(false)} title="Save Trip as Template">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Template Name"><In value={tplName} onChange={e=>setTplName(e.target.value)} placeholder="Template name..."/></Fl>
        <div style={{padding:12,borderRadius:8,background:T.ind+"08",border:"1px solid "+T.ind+"22"}}>
          <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,marginBottom:6}}>What will be saved:</div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {tripPers.length>0&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m}}>Personnel requirements: {Object.entries(tripPers.reduce((a,p)=>{a[p.tripRole]=(a[p.tripRole]||0)+1;return a},{}))
              .map(([r,c])=>c+"x "+(roleLabels[r]||r)).join(", ")}</div>}
            {tripKits.length>0&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m}}>Kit requirements: {Object.entries(tripKits.reduce((a,k)=>{const tn=types.find(t=>t.id===k.typeId)?.name||"Unknown";a[tn]=(a[tn]||0)+1;return a},{}))
              .map(([n,c])=>c+"x "+n).join(", ")}</div>}
            {(at.tasks||[]).length>0&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m}}>Tasks: {(at.tasks||[]).length} tasks across {new Set((at.tasks||[]).map(t=>t.phase)).size} phases</div>}
            {at._count?.commsEntries>0&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m}}>Comms: {at._count.commsEntries} entries</div>}
            <div style={{fontSize:10,color:T.sub,fontFamily:T.m}}>Packing items: trip-specific items</div></div></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setSaveTplMd(false)}>Cancel</Bt>
          <Bt v="primary" onClick={doSaveAsTemplate} disabled={!tplName.trim()||savingTpl}>{savingTpl?"Saving...":"Save Template"}</Bt></div></div></ModalWrap>
  </div>);}

export default TripsPage;
