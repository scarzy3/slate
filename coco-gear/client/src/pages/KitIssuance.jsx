import { useState, useMemo } from 'react';
import { T } from '../theme/theme.js';
import { stMeta, fmtDate } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Sl, SH, ModalWrap, ConfirmDialog, DeptBg } from '../components/ui/index.js';
import InspWF from '../forms/InspWF.jsx';
import IssueToPicker from '../forms/IssueToPicker.jsx';
import api from '../api.js';

function KitIssuance({kits,setKits,types,locs,personnel,allC,depts,isAdmin,isSuper,userRole,curUserId,settings,requests,setRequests,accessRequests,setAccessRequests,addLog,onNavigateToKit,reservations,apiCheckout,apiReturn,onRefreshKits,onRefreshRequests,apiSendMaint,apiResolveDegraded,trips}){
  const userPerson=personnel.find(p=>p.id===curUserId);const userDeptId=userPerson?.deptId;
  const hasDept=!!userDeptId;const defaultView=hasDept&&!isSuper?"dept":"all";
  const[md,setMd]=useState(null);const[search,setSearch]=useState("");const[view,setView]=useState(defaultView);
  const[accessNotes,setAccessNotes]=useState("");
  // Request form state
  const[reqPurpose,setReqPurpose]=useState("");const[reqNotes,setReqNotes]=useState("");const[reqSubmitting,setReqSubmitting]=useState(false);
  const filt=useMemo(()=>{let list=kits;
    if(view==="dept"&&userDeptId)list=list.filter(k=>k.deptId===userDeptId);
    if(view==="issued")list=list.filter(k=>k.issuedTo);if(view==="available")list=list.filter(k=>!k.issuedTo&&!k.maintenanceStatus&&!k.degraded);
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
    if(dept&&((dept.managerIds||[]).includes(curUserId)||(dept.leadIds||[]).includes(curUserId)))return false;
    if(userDeptId===kit.deptId)return false;
    const minRole=settings.deptApprovalMinRole||"lead";
    if((rl[userRole]||0)>=(rl[minRole]||1))return false;
    // Trip personnel bypass: if kit is assigned to a trip the user is on
    if(kit.tripId&&trips){const trip=trips.find(t=>t.id===kit.tripId);
      if(trip&&(trip.personnel||[]).some(p=>p.userId===curUserId))return false;}
    return true};

  // Checkout request status helpers
  const getRequestStatus=(kitId)=>{
    const reqs=(requests||[]).filter(r=>r.kitId===kitId&&r.personId===curUserId);
    const approved=reqs.find(r=>r.status==="approved");
    if(approved)return {status:"approved",request:approved};
    const pending=reqs.find(r=>r.status==="pending");
    if(pending)return {status:"pending",request:pending};
    const denied=reqs.filter(r=>r.status==="denied").sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    if(denied.length>0)return {status:"denied",request:denied[0]};
    return {status:"none",request:null};
  };

  // Access request helpers
  const directorRoles=["developer","director","super","engineer"];
  const isDirectorUser=directorRoles.includes(userRole);
  const getAccessStatus=(kitId)=>{
    if(!settings.requireAccessRequest||isDirectorUser)return "granted";
    const reqs=(accessRequests||[]).filter(r=>r.kitId===kitId&&r.personId===curUserId);
    const approved=reqs.find(r=>r.status==="approved");
    if(approved)return "approved";
    const pending=reqs.find(r=>r.status==="pending");
    if(pending)return "pending";
    return "none";
  };

  const doRequestAccess=async(kitId)=>{
    try{
      const result=await api.kits.requestAccess({kitId,notes:accessNotes});
      if(setAccessRequests)setAccessRequests(p=>[result,...p]);
      setMd(null);setAccessNotes("");
    }catch(e){alert(e.message)}
  };

  const doSubmitRequest=async(kitId)=>{
    if(!reqPurpose.trim()){alert("Please describe the purpose for your request.");return;}
    setReqSubmitting(true);
    try{
      const result=await api.kits.submitCheckoutRequest({kitId,purpose:reqPurpose,notes:reqNotes});
      if(setRequests)setRequests(p=>[result,...p]);
      setMd(null);setReqPurpose("");setReqNotes("");
    }catch(e){alert(e.message)}
    finally{setReqSubmitting(false)}
  };

  const doCheckout=async(kitId,data)=>{
    try{await apiCheckout(kitId,curUserId,data.serials,data.notes);
    // After successful checkout, refresh requests so the approved request gets marked used on return
    if(onRefreshRequests)onRefreshRequests();
    }catch(e){/* apiCheckout shows alert */}
    setMd(null)};
  const doIssueTo=async(kitId,personId,data)=>{
    try{await apiCheckout(kitId,personId,data.serials,data.notes)}catch(e){/* apiCheckout shows alert */}
    setMd(null)};
  const doReturn=async(kitId,data)=>{
    try{await apiReturn(kitId,data.serials,data.notes);
    // After return, remove approved access for this user/kit so UI reflects revocation
    if(setAccessRequests)setAccessRequests(p=>p.map(r=>r.kitId===kitId&&r.personId===curUserId&&r.status==="approved"?{...r,status:"used"}:r));
    // After return, revoke approved checkout requests so user must re-request
    if(setRequests)setRequests(p=>p.map(r=>r.kitId===kitId&&r.personId===curUserId&&r.status==="approved"?{...r,status:"used"}:r));
    }catch(e){/* apiReturn shows alert */}
    setMd(null)};
  const canFix=(rl[userRole]||0)>=(rl["lead"]||1);
  const getDegradedComps=kit=>{const ty=types.find(t=>t.id===kit.typeId);const critIds=ty?.criticalCompIds||[];
    return Object.entries(kit.comps||{}).filter(([k,s])=>s!=="GOOD"&&critIds.includes(k.split("#")[0])).map(([k,s])=>{const c=allC.find(x=>x.id===k.split("#")[0]);return{key:k,status:s,label:c?.label||"?"}})};
  const[confirmFix,setConfirmFix]=useState(null);
  const doFix=async(kitId)=>{try{await apiResolveDegraded(kitId)}catch(e){}setConfirmFix(null);setMd(null)};
  const doMaint=async(kitId)=>{try{await apiSendMaint(kitId,"repair","Critical component degraded","")}catch(e){}setMd(null)};
  return(<div>
    <SH title="Checkout / Return" sub={issuedCt+" out | "+(kits.length-issuedCt)+" available | "+myCt+" mine"}
      action={<div style={{display:"flex",gap:6}}>
        <Bt v="primary" onClick={()=>setMd("issueTo")}>Issue To...</Bt></div>}/>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:200,maxWidth:"100%"}}/>
      {[...(hasDept?["dept"]:[]),"all","mine","issued","available"].map(v=>{const ct=v==="all"?kits.length:v==="mine"?myCt:v==="dept"?deptCt:v==="issued"?issuedCt:kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus&&!k.degraded).length;
        const label=v==="dept"?deptName||"My Dept":v;
        return <button key={v} onClick={()=>setView(v)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:T.m,fontWeight:600,
          background:view===v?"rgba(255,255,255,.08)":"transparent",color:view===v?T.tx:T.mu,border:"1px solid "+(view===v?T.bdH:T.bd)}}>{label} ({ct})</button>})}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(320px,100%),1fr))",gap:8}}>
      {filt.map(kit=>{const person=kit.issuedTo?personnel.find(p=>p.id===kit.issuedTo):null;const lo=locs.find(l=>l.id===kit.locId);const ty=types.find(t=>t.id===kit.typeId);
        const st=stMeta(kit.lastChecked);const isMine=kit.issuedTo===curUserId;const dept=kit.deptId?depts.find(d=>d.id===kit.deptId):null;const na=needsApproval(kit);const inMaint=kit.maintenanceStatus;
        const upcoming=(reservations||[]).filter(r=>r.kitId===kit.id&&(r.status==="confirmed"||r.status==="pending")&&new Date(r.endDate)>=new Date());
        const accessSt=getAccessStatus(kit.id);
        const needsAccess=settings.requireAccessRequest&&accessSt==="none"&&!isDirectorUser;
        const pendingAccess=settings.requireAccessRequest&&accessSt==="pending"&&!isDirectorUser;
        // Checkout request status for this kit
        const reqSt=na?getRequestStatus(kit.id):{status:"none",request:null};
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
          :kit.degraded&&!person?<div style={{borderRadius:7,background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.12)",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.or}}/><span style={{fontSize:10,color:T.or,fontFamily:T.m,fontWeight:600,flex:1}}>Degraded</span>
              <div style={{display:"flex",gap:4}}>
                <Bt v="ghost" sm onClick={()=>setMd("degraded:"+kit.id)} style={{fontSize:8,color:T.or}}>Details</Bt>
                {canFix&&<Bt v="ghost" sm onClick={()=>setConfirmFix(kit.id)} style={{fontSize:8,color:T.gn}}>Fix</Bt>}
                {(isAdmin||isSuper)&&<Bt v="ghost" sm onClick={()=>doMaint(kit.id)} style={{fontSize:8,color:T.am}}>Maint</Bt>}</div></div>
            {getDegradedComps(kit).map(c=><div key={c.key} style={{display:"flex",alignItems:"center",gap:6,padding:"3px 12px 3px 25px",borderTop:"1px solid rgba(249,115,22,.08)"}}>
              <span style={{fontSize:8,color:T.or,fontFamily:T.m,fontWeight:700,width:52}}>{c.status}</span>
              <span style={{fontSize:8,color:T.mu,fontFamily:T.m}}>{c.label}</span></div>)}</div>
          :person?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:isMine?"rgba(244,114,182,.06)":"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.pk}}/><span style={{fontSize:10,fontWeight:600,color:T.pk,fontFamily:T.m,flex:1}}>{isMine?"YOU":person.name}</span>
            <Bt v="warn" sm onClick={()=>setMd("return:"+kit.id)}>Return</Bt></div>
          :pendingAccess?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.am}}/><span style={{fontSize:10,color:T.am,fontFamily:T.m,flex:1}}>Access Pending</span>
            <Bg color={T.am} bg="rgba(251,191,36,.1)">AWAITING APPROVAL</Bg></div>
          :needsAccess?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(168,85,247,.03)",border:"1px solid rgba(168,85,247,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.pu||"#a855f7"}}/><span style={{fontSize:10,color:T.pu||"#a855f7",fontFamily:T.m,flex:1}}>Access Required</span>
            <Bt v="orange" sm onClick={()=>{setAccessNotes("");setMd("requestAccess:"+kit.id)}}>Request Access</Bt></div>
          // Kit needs approval and has a pending request
          :na&&reqSt.status==="pending"?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.am}}/><span style={{fontSize:10,color:T.am,fontFamily:T.m,flex:1}}>Request Pending</span>
            <Bg color={T.am} bg="rgba(251,191,36,.1)">AWAITING APPROVAL</Bg></div>
          // Kit needs approval and request was approved — user can now checkout
          :na&&reqSt.status==="approved"?<div style={{display:"flex",flexDirection:"column",gap:6}}>
            {reqSt.request.resolverNotes&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(34,197,94,.04)",border:"1px solid rgba(34,197,94,.12)"}}>
              <span style={{fontSize:9,color:T.gn,fontFamily:T.m,fontWeight:600}}>Conditions:</span>
              <span style={{fontSize:9,color:T.mu,fontFamily:T.m,fontStyle:"italic"}}>{reqSt.request.resolverNotes}</span></div>}
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(34,197,94,.04)",border:"1px solid rgba(34,197,94,.12)"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.gn}}/><span style={{fontSize:10,color:T.gn,fontFamily:T.m,flex:1,fontWeight:600}}>Approved</span>
              <Bt v="primary" sm onClick={()=>setMd("checkout:"+kit.id)}>Checkout</Bt></div></div>
          // Kit needs approval and last request was denied — show reason + allow re-request
          :na&&reqSt.status==="denied"?<div style={{display:"flex",flexDirection:"column",gap:6}}>
            <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(239,68,68,.04)",border:"1px solid rgba(239,68,68,.12)"}}>
              <span style={{fontSize:9,color:T.rd,fontFamily:T.m,fontWeight:600}}>Denied{reqSt.request.resolverNotes?":":""}</span>
              {reqSt.request.resolverNotes&&<span style={{fontSize:9,color:T.mu,fontFamily:T.m,fontStyle:"italic"}}>{reqSt.request.resolverNotes}</span>}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(239,68,68,.03)",border:"1px solid rgba(239,68,68,.1)"}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.rd}}/><span style={{fontSize:10,color:T.rd,fontFamily:T.m,flex:1}}>Request Denied</span>
              <Bt v="orange" sm onClick={()=>{setReqPurpose("");setReqNotes("");setMd("request:"+kit.id)}}>Request Again</Bt></div></div>
          // Kit needs approval but no request yet — show Request button
          :na?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(251,146,60,.03)",border:"1px solid rgba(251,146,60,.1)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.or}}/><span style={{fontSize:10,color:T.or,fontFamily:T.m,flex:1}}>Approval Required</span>
            <Bt v="orange" sm onClick={()=>{setReqPurpose("");setReqNotes("");setMd("request:"+kit.id)}}>Request</Bt></div>
          // No approval needed — direct checkout
          :<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(34,197,94,.03)",border:"1px solid rgba(34,197,94,.1)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.gn}}/><span style={{fontSize:10,color:T.gn,fontFamily:T.m,flex:1}}>Available</span>
            <Bt v="primary" sm onClick={()=>setMd("checkout:"+kit.id)}>Checkout</Bt></div>}
          {kit._trip&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)",marginTop:6}}>
            <span style={{fontSize:10,color:T.pu,fontFamily:T.m,fontWeight:600}}>▸</span>
            <span style={{fontSize:9,color:T.pu,fontFamily:T.m,flex:1}}>Trip: {kit._trip.name}</span></div>}
          {upcoming.length>0&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(251,146,60,.04)",border:"1px solid rgba(251,146,60,.12)",marginTop:6}}>
            <span style={{fontSize:10,color:T.or,fontFamily:T.m,fontWeight:600}}>!</span>
            <span style={{fontSize:9,color:T.or,fontFamily:T.m,flex:1}}>Reserved: {upcoming.map(r=>{const who=personnel.find(p=>p.id===r.personId);return(who?.name||"?")+" "+fmtDate(r.startDate)}).join(", ")}</span></div>}
        </div>)})}</div>
    {!filt.length&&<div style={{padding:40,textAlign:"center",color:T.dm,fontFamily:T.m}}>No kits match</div>}

    {/* Checkout modal (inspection workflow) */}
    <ModalWrap open={String(md).startsWith("checkout:")} onClose={()=>setMd(null)} title="Checkout Kit" wide>
      {String(md).startsWith("checkout:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} mode="checkout" onDone={data=>doCheckout(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>

    {/* Return modal (inspection workflow) */}
    <ModalWrap open={String(md).startsWith("return:")} onClose={()=>setMd(null)} title="Return Kit" wide>
      {String(md).startsWith("return:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} mode="return" onDone={data=>doReturn(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>

    {/* Issue To picker */}
    <ModalWrap open={md==="issueTo"} onClose={()=>setMd(null)} title="Issue Kit To..." wide>
      {md==="issueTo"&&<IssueToPicker kits={kits} types={types} locs={locs} personnel={personnel} allC={allC} settings={settings} onIssue={(kid,pid,data)=>doIssueTo(kid,pid,data)} onCancel={()=>setMd(null)}/>}</ModalWrap>

    {/* Request form modal (department approval) */}
    <ModalWrap open={String(md).startsWith("request:")} onClose={()=>setMd(null)} title="Request Kit Checkout">
      {String(md).startsWith("request:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        const dept=k?.deptId?depts.find(d=>d.id===k.deptId):null;
        if(!k)return null;
        return <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Sw color={k.color} size={28}/>
            <div><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{k.color}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name}</div></div>
            {dept&&<DeptBg dept={dept}/>}</div>
          <div style={{padding:"10px 14px",borderRadius:7,background:"rgba(251,146,60,.04)",border:"1px solid rgba(251,146,60,.12)"}}>
            <div style={{fontSize:10,color:T.or,fontFamily:T.m}}>This kit belongs to <b>{dept?.name||"another department"}</b>. Submit a request and the department will review it. You will be notified when a decision is made.</div></div>
          <div>
            <label style={{fontSize:9,color:T.mu,fontFamily:T.m,display:"block",marginBottom:4}}>Purpose <span style={{color:T.rd}}>*</span></label>
            <textarea value={reqPurpose} onChange={e=>setReqPurpose(e.target.value)} placeholder="What do you need this kit for? (e.g., field operation, testing, project name)"
              style={{width:"100%",minHeight:70,padding:8,borderRadius:6,border:"1px solid "+T.bd,background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,resize:"vertical"}}/></div>
          <div>
            <label style={{fontSize:9,color:T.mu,fontFamily:T.m,display:"block",marginBottom:4}}>Additional Notes (optional)</label>
            <textarea value={reqNotes} onChange={e=>setReqNotes(e.target.value)} placeholder="Any additional details, timeline, or special requirements"
              style={{width:"100%",minHeight:50,padding:8,borderRadius:6,border:"1px solid "+T.bd,background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,resize:"vertical"}}/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Bt sm onClick={()=>setMd(null)}>Cancel</Bt>
            <Bt v="primary" sm onClick={()=>doSubmitRequest(kid)} disabled={reqSubmitting||!reqPurpose.trim()}>{reqSubmitting?"Submitting...":"Submit Request"}</Bt></div></div>})()}</ModalWrap>

    {/* Access request modal */}
    <ModalWrap open={String(md).startsWith("requestAccess:")} onClose={()=>setMd(null)} title="Request Kit Access">
      {String(md).startsWith("requestAccess:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k)return null;
        return <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Sw color={k.color} size={28}/>
            <div><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{k.color}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name}</div></div></div>
          <div style={{padding:"10px 14px",borderRadius:7,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)"}}>
            <div style={{fontSize:10,color:T.pu||"#a855f7",fontFamily:T.m}}>You need approval before you can check out this kit. Submit a request and an approver will review it.</div></div>
          <div>
            <label style={{fontSize:9,color:T.mu,fontFamily:T.m,display:"block",marginBottom:4}}>Notes (optional)</label>
            <textarea value={accessNotes} onChange={e=>setAccessNotes(e.target.value)} placeholder="Why do you need access to this kit?"
              style={{width:"100%",minHeight:60,padding:8,borderRadius:6,border:"1px solid "+T.bd,background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,resize:"vertical"}}/></div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Bt sm onClick={()=>setMd(null)}>Cancel</Bt>
            <Bt v="primary" sm onClick={()=>doRequestAccess(kid)}>Submit Request</Bt></div></div>})()}</ModalWrap>

    {/* Degraded kit details modal */}
    <ModalWrap open={String(md).startsWith("degraded:")} onClose={()=>setMd(null)} title="Degraded Kit Details">
      {String(md).startsWith("degraded:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);if(!k)return null;const badComps=getDegradedComps(k);const ty=types.find(t=>t.id===k.typeId);
        return <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}><Sw color={k.color} size={28}/><div><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{k.color}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name}</div></div></div>
          <div style={{padding:"10px 14px",borderRadius:7,background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.12)"}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,color:T.or,fontFamily:T.m,fontWeight:600,marginBottom:8}}>Critical Issues ({badComps.length})</div>
            {badComps.map(c=><div key={c.key} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderTop:"1px solid rgba(249,115,22,.08)"}}>
              <Bg color={c.status==="DAMAGED"?T.rd:T.am} bg={c.status==="DAMAGED"?"rgba(239,68,68,.08)":"rgba(251,191,36,.08)"}>{c.status}</Bg>
              <span style={{fontSize:11,color:T.tx,fontFamily:T.m}}>{c.label}</span></div>)}</div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            {(isAdmin||isSuper)&&<Bt v="warn" sm onClick={()=>{setMd(null);doMaint(kid)}}>Send to Maintenance</Bt>}
            {canFix&&<Bt v="success" sm onClick={()=>{setMd(null);setConfirmFix(kid)}}>Mark All Fixed</Bt>}
            <Bt sm onClick={()=>setMd(null)}>Close</Bt></div></div>})()}</ModalWrap>
    <ConfirmDialog open={!!confirmFix} onClose={()=>setConfirmFix(null)} onConfirm={()=>doFix(confirmFix)}
      title="Mark Kit Fixed?" message="This will set all degraded critical components back to GOOD status. Are you sure?"/>
    </div>);}

export default KitIssuance;
