import { useState, useMemo } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';
import { Bg, Bt, In, SH } from '../components/ui/index.js';

function AuditLogPage({logs,kits,personnel}){
  const[filter,setFilter]=useState("");const[actionFilter,setActionFilter]=useState("all");
  const actions=[...new Set(logs.map(l=>l.action))];
  const filtered=useMemo(()=>{
    let list=logs;
    if(actionFilter!=="all")list=list.filter(l=>l.action===actionFilter);
    if(filter){const q=filter.toLowerCase();list=list.filter(l=>{
      const p=personnel.find(x=>x.id===l.by);const k=kits.find(x=>x.id===l.targetId);
      return l.action.toLowerCase().includes(q)||(p?.name.toLowerCase().includes(q))||(l.details?.kitColor?.toLowerCase().includes(q))});}
    return[...list].sort((a,b)=>new Date(b.date)-new Date(a.date))},[logs,filter,actionFilter,personnel,kits]);
  const actionColors={checkout:T.bl,return:T.gn,inspect:T.tl,maintenance_start:T.am,maintenance_end:T.gn,location_change:T.ind,
    approved:T.gn,denied:T.rd,reservation_create:T.pu,consumable_adjust:T.or};

  return(<div>
    <SH title="Audit Log" sub={logs.length+" events recorded"}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <In value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search..." style={{width:200,maxWidth:"100%"}}/>
      <Sl options={[{v:"all",l:"All Actions"},...actions.map(a=>({v:a,l:a.replace("_"," ")}))]} value={actionFilter} onChange={e=>setActionFilter(e.target.value)}/></div>
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {filtered.slice(0,100).map(l=>{const p=personnel.find(x=>x.id===l.by);return(
        <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:28,height:28,borderRadius:14,background:(actionColors[l.action]||T.mu)+"22",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:actionColors[l.action]||T.mu,fontFamily:T.m}}>
            {l.action.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.tx,fontFamily:T.m}}>
              <span style={{fontWeight:600}}>{p?.name||"System"}</span>
              <span style={{color:T.mu}}> {l.action.replace("_"," ")} </span>
              {l.details?.kitColor&&<span style={{color:T.ind}}>Kit {l.details.kitColor}</span>}
              {l.details?.reason&&<span style={{color:T.dm}}> ({l.details.reason})</span>}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{new Date(l.date).toLocaleString()}</div></div>
          <Bg color={actionColors[l.action]||T.mu} bg={(actionColors[l.action]||T.mu)+"18"}>{l.action.replace("_"," ")}</Bg></div>)})}
      {filtered.length>100&&<div style={{padding:12,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:10}}>Showing 100 of {filtered.length}</div>}
      {!filtered.length&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No matching events</div>}</div></div>);}

export default AuditLogPage;
