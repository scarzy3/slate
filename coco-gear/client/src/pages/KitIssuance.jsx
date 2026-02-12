import { useState, useMemo } from 'react';
import { T } from '../theme/theme.js';
import { stMeta, fmtDate } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Sl, SH, ModalWrap, DeptBg } from '../components/ui/index.js';
import InspWF from '../forms/InspWF.jsx';
import IssueToPicker from '../forms/IssueToPicker.jsx';
import api from '../api.js';

function KitIssuance({kits,setKits,types,locs,personnel,allC,depts,isAdmin,isSuper,userRole,curUserId,settings,requests,setRequests,addLog,onNavigateToKit,reservations,apiCheckout,apiReturn,onRefreshKits}){
  const userPerson=personnel.find(p=>p.id===curUserId);const userDeptId=userPerson?.deptId;
  const hasDept=!!userDeptId;const defaultView=hasDept&&!isSuper?"dept":"all";
  const[md,setMd]=useState(null);const[search,setSearch]=useState("");const[view,setView]=useState(defaultView);
  const filt=useMemo(()=>{let list=kits;
    if(view==="dept"&&userDeptId)list=list.filter(k=>k.deptId===userDeptId);
    if(view==="issued")list=list.filter(k=>k.issuedTo);if(view==="available")list=list.filter(k=>!k.issuedTo&&!k.maintenanceStatus);
    if(view==="mine")list=list.filter(k=>k.issuedTo===curUserId);
    if(search){const q=search.toLowerCase();list=list.filter(k=>{const p=k.issuedTo?personnel.find(x=>x.id===k.issuedTo):null;const lo=locs.find(l=>l.id===k.locId);
      return k.color.toLowerCase().includes(q)||(p&&p.name.toLowerCase().includes(q))||(lo&&lo.name.toLowerCase().includes(q))});}
    return list},[kits,view,search,personnel,locs,curUserId,userDeptId]);
  const deptName=userDeptId?depts.find(d=>d.id===userDeptId)?.name:"";
  const issuedCt=kits.filter(k=>k.issuedTo).length;const myCt=kits.filter(k=>k.issuedTo===curUserId).length;const deptCt=userDeptId?kits.filter(k=>k.deptId===userDeptId).length:0;
  const rl={user:0,lead:1,manager:2,admin:2,director:3,super:3,developer:3,engineer:3};
  const needsApproval=kit=>{if(!settings.requireDeptApproval||!kit.deptId)return false;
    const directorRoles=["developer","director","super","engineer"];
    if(settings.directorBypassApproval&&directorRoles.includes(userRole))return false;
    const dept=depts.find(d=>d.id===kit.deptId);
    if(dept&&dept.headId===curUserId)return false;
    if(userDeptId===kit.deptId)return false;
    const minRole=settings.deptApprovalMinRole||"lead";
    if((rl[userRole]||0)>=(rl[minRole]||1))return false;
    return true};
  const doCheckout=async(kitId,data)=>{const kit=kits.find(k=>k.id===kitId);
    try{await apiCheckout(kitId,curUserId,data.serials,data.notes)}catch(e){/* apiCheckout shows alert */}
    setMd(null)};
  const doIssueTo=async(kitId,personId,data)=>{
    try{await apiCheckout(kitId,personId,data.serials,data.notes)}catch(e){/* apiCheckout shows alert */}
    setMd(null)};
  const doReturn=async(kitId,data)=>{
    try{await apiReturn(kitId,data.serials,data.notes)}catch(e){/* apiReturn shows alert */}
    setMd(null)};
  return(<div>
    <SH title="Checkout / Return" sub={issuedCt+" out | "+(kits.length-issuedCt)+" available | "+myCt+" mine"}
      action={<div style={{display:"flex",gap:6}}>
        <Bt v="primary" onClick={()=>setMd("issueTo")}>Issue To...</Bt></div>}/>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:200,maxWidth:"100%"}}/>
      {[...(hasDept?["dept"]:[]),"all","mine","issued","available"].map(v=>{const ct=v==="all"?kits.length:v==="mine"?myCt:v==="dept"?deptCt:v==="issued"?issuedCt:kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length;
        const label=v==="dept"?deptName||"My Dept":v;
        return <button key={v} onClick={()=>setView(v)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:T.m,fontWeight:600,
          background:view===v?"rgba(255,255,255,.08)":"transparent",color:view===v?T.tx:T.mu,border:"1px solid "+(view===v?T.bdH:T.bd)}}>{label} ({ct})</button>})}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(320px,100%),1fr))",gap:8}}>
      {filt.map(kit=>{const person=kit.issuedTo?personnel.find(p=>p.id===kit.issuedTo):null;const lo=locs.find(l=>l.id===kit.locId);const ty=types.find(t=>t.id===kit.typeId);
        const st=stMeta(kit.lastChecked);const isMine=kit.issuedTo===curUserId;const dept=kit.deptId?depts.find(d=>d.id===kit.deptId):null;const na=needsApproval(kit);const inMaint=kit.maintenanceStatus;
        const upcoming=(reservations||[]).filter(r=>r.kitId===kit.id&&(r.status==="confirmed"||r.status==="pending")&&new Date(r.endDate)>=new Date());
        return(<div key={kit.id} style={{padding:14,borderRadius:8,background:isMine?"rgba(244,114,182,.02)":T.card,border:isMine?"1px solid rgba(244,114,182,.15)":"1px solid "+T.bd}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <Sw color={kit.color} size={28}/>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{kit.color}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name} | {lo?.name}</div></div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><Bg color={st.fg} bg={st.bg}>{st.tag}</Bg>{dept&&<DeptBg dept={dept}/>}</div></div>
          {(settings.allowUserLocationUpdate||isAdmin||isSuper)&&!inMaint&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={kit.locId} onChange={e=>{const newLocId=e.target.value;setKits(p=>p.map(k=>k.id===kit.id?{...k,locId:newLocId}:k));
              api.kits.updateLocation(kit.id,newLocId).then(()=>{if(onRefreshKits)onRefreshKits()}).catch(err=>console.error("Location update error:",err))}} style={{flex:1,fontSize:9,padding:"4px 8px"}}/></div>}
          {inMaint?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.am}}/><span style={{fontSize:10,color:T.am,fontFamily:T.m}}>In Maintenance ({kit.maintenanceStatus})</span></div>
          :person?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:isMine?"rgba(244,114,182,.06)":"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.pk}}/><span style={{fontSize:10,fontWeight:600,color:T.pk,fontFamily:T.m,flex:1}}>{isMine?"YOU":person.name}</span>
            <Bt v="warn" sm onClick={()=>setMd("return:"+kit.id)}>Return</Bt></div>
          :<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(34,197,94,.03)",border:"1px solid rgba(34,197,94,.1)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.gn}}/><span style={{fontSize:10,color:T.gn,fontFamily:T.m,flex:1}}>Available</span>
            <Bt v={na?"orange":"primary"} sm onClick={()=>setMd("checkout:"+kit.id)}>{na?"Request":"Checkout"}</Bt></div>}
          {kit._trip&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",marginTop:6}}>
            <span style={{fontSize:10,color:T.pu,fontFamily:T.m,fontWeight:600}}>▸</span>
            <span style={{fontSize:9,color:T.pu,fontFamily:T.m,flex:1}}>Trip: {kit._trip.name}</span></div>}
          {upcoming.length>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(251,146,60,.04)",border:"1px solid rgba(251,146,60,.12)",marginTop:6}}>
            <span style={{fontSize:10,color:T.or,fontFamily:T.m,fontWeight:600}}>!</span>
            <span style={{fontSize:9,color:T.or,fontFamily:T.m,flex:1}}>Reserved: {upcoming.map(r=>{const who=personnel.find(p=>p.id===r.personId);return(who?.name||"?")+" "+fmtDate(r.startDate)}).join(", ")}</span></div>}
        </div>)})}</div>
    {!filt.length&&<div style={{padding:40,textAlign:"center",color:T.dm,fontFamily:T.m}}>No kits match</div>}
    <ModalWrap open={String(md).startsWith("checkout:")} onClose={()=>setMd(null)} title="Checkout Kit" wide>
      {String(md).startsWith("checkout:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} mode="checkout" onDone={data=>doCheckout(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={String(md).startsWith("return:")} onClose={()=>setMd(null)} title="Return Kit" wide>
      {String(md).startsWith("return:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} mode="return" onDone={data=>doReturn(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={md==="issueTo"} onClose={()=>setMd(null)} title="Issue Kit To..." wide>
      {md==="issueTo"&&<IssueToPicker kits={kits} types={types} locs={locs} personnel={personnel} allC={allC} settings={settings} onIssue={(kid,pid,data)=>doIssueTo(kid,pid,data)} onCancel={()=>setMd(null)}/>}</ModalWrap>
    </div>);}

export default KitIssuance;
