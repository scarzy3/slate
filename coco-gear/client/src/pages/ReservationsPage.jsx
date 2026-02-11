import { useState, useMemo } from 'react';
import { T, CM } from '../theme/theme.js';
import { fmtDate, daysUntil } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Sl, SH, Tabs, ModalWrap } from '../components/ui/index.js';
import api from '../api.js';

function ReservationsPage({reservations,setReservations,kits,personnel,trips,curUserId,isAdmin,addLog,onRefreshReservations}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({kitId:"",tripId:"",startDate:"",endDate:"",purpose:""});
  const[viewDate,setViewDate]=useState(()=>new Date());const[selectedDay,setSelectedDay]=useState(null);
  const pending=reservations.filter(r=>r.status==="pending");
  const active=reservations.filter(r=>r.status==="confirmed"||r.status==="pending");
  const available=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus);

  const checkConflict=(kitId,start,end,excludeId=null)=>{
    return reservations.some(r=>r.id!==excludeId&&r.kitId===kitId&&r.status!=="cancelled"&&
      new Date(r.startDate)<=new Date(end)&&new Date(r.endDate)>=new Date(start))};

  const activeTrips=(trips||[]).filter(t=>t.status==="planning"||t.status==="active");
  const createRes=async()=>{
    if(checkConflict(fm.kitId,fm.startDate,fm.endDate)){alert("Conflict with existing reservation");return}
    try{await api.reservations.create({kitId:fm.kitId,tripId:fm.tripId||null,startDate:fm.startDate,endDate:fm.endDate,purpose:fm.purpose});
    await onRefreshReservations()}catch(e){alert(e.message)}
    setMd(null);setFm({kitId:"",tripId:"",startDate:"",endDate:"",purpose:""})};

  const approveRes=async(id)=>{try{await api.reservations.approve(id);await onRefreshReservations()}catch(e){alert(e.message)}};
  const deleteRes=async(id)=>{try{await api.reservations.delete(id);await onRefreshReservations()}catch(e){alert(e.message)}};

  /* Calendar helpers */
  const year=viewDate.getFullYear();const month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay();const daysInMonth=new Date(year,month+1,0).getDate();
  const monthName=viewDate.toLocaleString("default",{month:"long",year:"numeric"});
  const prevMonth=()=>setViewDate(new Date(year,month-1,1));
  const nextMonth=()=>setViewDate(new Date(year,month+1,1));
  const today=new Date().toISOString().slice(0,10);

  const getResForDay=(day)=>{
    const d=Date.UTC(year,month,day);
    return active.filter(r=>{const s=new Date(r.startDate+"T00:00:00Z").getTime();const e=new Date(r.endDate+"T00:00:00Z").getTime();return s<=d&&e>=d})};

  const getDayColor=(day)=>{
    const res=getResForDay(day);if(!res.length)return null;
    const k=kits.find(x=>x.id===res[0].kitId);return k?.color||"GRAY"};

  const calDays=[];
  for(let i=0;i<firstDay;i++)calDays.push(null);
  for(let i=1;i<=daysInMonth;i++)calDays.push(i);

  const selectedDateStr=selectedDay?`${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`:null;
  const selectedRes=selectedDay?getResForDay(selectedDay):[];

  return(<div>
    <SH title="Reservations" sub={pending.length+" pending approval | "+active.length+" total"}
      action={<Bt v="primary" onClick={()=>setMd("new")}>+ New Reservation</Bt>}/>

    <div className="slate-grid-side" style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
      {/* Calendar */}
      <div style={{padding:20,borderRadius:12,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button onClick={prevMonth} style={{all:"unset",cursor:"pointer",width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.05)",
            display:"flex",alignItems:"center",justifyContent:"center",color:T.mu,fontSize:14}}>←</button>
          <span style={{fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.u}}>{monthName}</span>
          <button onClick={nextMonth} style={{all:"unset",cursor:"pointer",width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.05)",
            display:"flex",alignItems:"center",justifyContent:"center",color:T.mu,fontSize:14}}>→</button></div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:T.dm,fontFamily:T.m,padding:4}}>{d}</div>)}</div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {calDays.map((day,i)=>{
            if(!day)return <div key={i}/>;
            const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday=dateStr===today;const isSelected=day===selectedDay;
            const dayRes=getResForDay(day);const hasRes=dayRes.length>0;
            const resColors=dayRes.map(r=>{const k=kits.find(x=>x.id===r.kitId);return CM[k?.color]||"#888"});
            return(<button key={i} onClick={()=>setSelectedDay(day===selectedDay?null:day)} style={{all:"unset",cursor:"pointer",
              aspectRatio:"1",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
              background:isSelected?"rgba(96,165,250,.15)":isToday?"rgba(45,212,191,.08)":"rgba(255,255,255,.02)",
              border:isSelected?"1px solid rgba(96,165,250,.4)":isToday?"1px solid rgba(45,212,191,.2)":"1px solid transparent",
              transition:"all .12s"}}>
              <span style={{fontSize:12,fontWeight:isToday||isSelected?700:400,color:isSelected?T.bl:isToday?T.tl:T.tx,fontFamily:T.m}}>{day}</span>
              {hasRes&&<div style={{display:"flex",gap:2}}>{resColors.slice(0,3).map((c,j)=><div key={j} style={{width:6,height:6,borderRadius:3,background:c}}/>)}
                {resColors.length>3&&<span style={{fontSize:7,color:T.dm}}>+{resColors.length-3}</span>}</div>}
            </button>)})}</div></div>

      {/* Side panel */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Selected day details */}
        {selectedDay&&<div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:12}}>
            {new Date(year,month,selectedDay).toLocaleDateString("default",{weekday:"long",month:"short",day:"numeric"})}</div>
          {selectedRes.length>0?<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {selectedRes.map(r=>{const k=kits.find(x=>x.id===r.kitId);const p=personnel.find(x=>x.id===r.personId);const isMine=r.personId===curUserId;
              return(<div key={r.id} style={{padding:12,borderRadius:8,background:isMine?"rgba(96,165,250,.05)":"rgba(255,255,255,.02)",
                border:"1px solid "+(isMine?"rgba(96,165,250,.15)":T.bd),borderLeft:"3px solid "+(CM[k?.color]||"#888")}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  {k&&<Sw color={k.color} size={20}/>}
                  <span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k?.color}</span>
                  {r.status==="pending"&&<Bg color={T.or} bg="rgba(251,146,60,.1)">Pending</Bg>}
                  {isMine&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">Mine</Bg>}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{p?.name}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:4}}>{r.startDate} → {r.endDate}</div>
                {r.tripName&&<div style={{fontSize:9,color:T.pu,fontFamily:T.m,marginTop:3}}>▸ {r.tripName}</div>}
                {r.purpose&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,fontStyle:"italic",marginTop:4}}>{r.purpose}</div>}
                {(isMine||isAdmin)&&<div style={{display:"flex",gap:4,marginTop:8}}>
                  {isAdmin&&r.status==="pending"&&<Bt v="success" sm onClick={()=>approveRes(r.id)}>Approve</Bt>}
                  <Bt v="danger" sm onClick={()=>deleteRes(r.id)}>Delete</Bt></div>}</div>)})}
          </div>:<div style={{padding:16,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No reservations</div>}
          <div style={{marginTop:12}}><Bt v="primary" sm style={{width:"100%"}} onClick={()=>{
            setFm(p=>({...p,startDate:selectedDateStr,endDate:selectedDateStr}));setMd("new")}}>+ Reserve for this day</Bt></div></div>}

        {/* Pending approvals */}
        {pending.length>0&&isAdmin&&<div style={{padding:16,borderRadius:10,background:"rgba(251,146,60,.02)",border:"1px solid rgba(251,146,60,.12)"}}>
          <div style={{fontSize:11,fontWeight:600,color:T.or,fontFamily:T.u,marginBottom:10}}>Pending Approval ({pending.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pending.slice(0,5).map(r=>{const k=kits.find(x=>x.id===r.kitId);const p=personnel.find(x=>x.id===r.personId);return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,background:T.card}}>
                {k&&<Sw color={k.color} size={16}/>}
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p?.name}</div>
                  <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{r.startDate}</div></div>
                <Bt v="success" sm onClick={()=>approveRes(r.id)}>✓</Bt></div>)})}</div></div>}

        {/* Legend */}
        <div style={{padding:14,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:10,fontWeight:600,color:T.mu,fontFamily:T.m,marginBottom:8}}>Kit Colors</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {kits.slice(0,8).map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:5,background:CM[k.color]||"#888"}}/>
              <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{k.color}</span></div>)}</div></div></div></div>

    <ModalWrap open={md==="new"} onClose={()=>setMd(null)} title="New Reservation">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Kit"><Sl options={[{v:"",l:"-- Select Kit --"},...available.map(k=>({v:k.id,l:`Kit ${k.color}`}))]}
          value={fm.kitId} onChange={e=>setFm(p=>({...p,kitId:e.target.value}))}/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={fm.startDate} onChange={e=>setFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={fm.endDate} onChange={e=>setFm(p=>({...p,endDate:e.target.value}))}/></Fl></div>
        {activeTrips.length>0&&<Fl label="Trip (optional)"><Sl options={[{v:"",l:"-- No Trip --"},...activeTrips.map(t=>({v:t.id,l:t.name}))]}
          value={fm.tripId} onChange={e=>setFm(p=>({...p,tripId:e.target.value}))}/></Fl>}
        <Fl label="Purpose"><In value={fm.purpose} onChange={e=>setFm(p=>({...p,purpose:e.target.value}))} placeholder="Project, event, etc."/></Fl>
        {fm.kitId&&fm.startDate&&fm.endDate&&checkConflict(fm.kitId,fm.startDate,fm.endDate)&&
          <div style={{padding:10,borderRadius:6,background:"rgba(239,68,68,.1)",color:T.rd,fontSize:11,fontFamily:T.m}}>⚠ Conflicts with existing reservation</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={createRes} disabled={!fm.kitId||!fm.startDate||!fm.endDate||checkConflict(fm.kitId,fm.startDate,fm.endDate)}>Create</Bt></div></div></ModalWrap></div>);}

export default ReservationsPage;
