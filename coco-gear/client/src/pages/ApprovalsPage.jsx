import { useState } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';
import { Sw, Bg, Bt, SH, DeptBg, Tabs } from '../components/ui/index.js';
import api from '../api.js';

function ApprovalsPage({requests,setRequests,accessRequests,setAccessRequests,kits,setKits,personnel,depts,allC,types,curUserId,userRole,settings,addLog,onRefreshKits,onRefreshRequests}){
  const[tab,setTab]=useState("checkout");
  const[resolveId,setResolveId]=useState(null);const[resolveAction,setResolveAction]=useState(null);const[resolverNotes,setResolverNotes]=useState("");const[resolving,setResolving]=useState(false);
  const _rl={user:0,lead:1,manager:2,admin:2,director:3,super:3,developer:3,engineer:3};
  const minRole=settings?.deptApprovalMinRole||"lead";
  const hasMinRole=(_rl[userRole]||0)>=(_rl[minRole]||1);
  const headOf=depts.filter(d=>(d.managerIds||[]).includes(curUserId)||(d.leadIds||[]).includes(curUserId)).map(d=>d.id);

  // Checkout requests
  const visible=requests.filter(r=>hasMinRole||headOf.includes(r.deptId));
  const pending=visible.filter(r=>r.status==="pending");const resolved=visible.filter(r=>r.status!=="pending");

  const startResolve=(reqId,action)=>{setResolveId(reqId);setResolveAction(action);setResolverNotes("")};
  const cancelResolve=()=>{setResolveId(null);setResolveAction(null);setResolverNotes("")};

  const doApprove=async()=>{
    setResolving(true);
    try{
      const result=await api.kits.approveCheckoutRequest(resolveId,{resolverNotes});
      if(setRequests)setRequests(p=>p.map(r=>r.id===resolveId?{...r,...result}:r));
      cancelResolve();
      if(onRefreshRequests)onRefreshRequests();
    }catch(e){alert(e.message)}
    finally{setResolving(false)}
  };

  const doDeny=async()=>{
    setResolving(true);
    try{
      const result=await api.kits.denyCheckoutRequest(resolveId,{resolverNotes});
      if(setRequests)setRequests(p=>p.map(r=>r.id===resolveId?{...r,...result}:r));
      cancelResolve();
      if(onRefreshRequests)onRefreshRequests();
    }catch(e){alert(e.message)}
    finally{setResolving(false)}
  };

  // Access requests
  const accessMinRole=settings?.accessRequestMinApprovalRole||"lead";
  const hasAccessMinRole=(_rl[userRole]||0)>=(_rl[accessMinRole]||1);
  const visibleAccess=(accessRequests||[]).filter(r=>hasAccessMinRole||headOf.length>0);
  const pendingAccess=visibleAccess.filter(r=>r.status==="pending");
  const resolvedAccess=visibleAccess.filter(r=>r.status!=="pending");
  const approveAccess=async reqId=>{
    try{const result=await api.kits.approveAccess(reqId);
    if(setAccessRequests)setAccessRequests(p=>p.map(r=>r.id===reqId?{...r,...result}:r));
    }catch(e){alert(e.message)}};
  const denyAccess=async reqId=>{
    try{const result=await api.kits.denyAccess(reqId);
    if(setAccessRequests)setAccessRequests(p=>p.map(r=>r.id===reqId?{...r,...result}:r));
    }catch(e){alert(e.message)}};

  const totalPending=pending.length+pendingAccess.length;
  const showTabs=settings?.requireAccessRequest;

  return(<div>
    <SH title="Approvals" sub={totalPending+" pending"}/>
    {showTabs&&<Tabs tabs={[
      {id:"checkout",l:"Checkout ("+pending.length+")"},
      {id:"access",l:"Access ("+pendingAccess.length+")"},
    ]} active={tab} onChange={setTab} style={{marginBottom:12}}/>}

    {/* Checkout Requests Tab */}
    {(tab==="checkout"||!showTabs)&&<div>
      {!pending.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No pending checkout requests</div>}
      {pending.map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId)||req._person;const dept=depts.find(d=>d.id===req.deptId)||req._kit?.department;
        const ty=kit?types.find(t=>t.id===kit.typeId):null;
        const isResolving=resolveId===req.id;
        return(<div key={req.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,marginBottom:8,borderLeft:"3px solid "+T.or}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>{kit&&<Sw color={kit.color} size={28}/>}
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,fontFamily:T.u,color:T.tx}}>Checkout Request: Kit {kit?.color||req._kit?.color||"?"}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{person?.name||req._person?.name||"?"} | {fmtDate(req.createdAt)}</div>
              {ty&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty.name}</div>}</div>
            <Bg color={T.or} bg="rgba(251,146,60,.1)">PENDING</Bg></div>
          {dept&&<div style={{marginBottom:8}}><DeptBg dept={dept}/></div>}
          {req.purpose&&<div style={{padding:"8px 12px",borderRadius:6,background:"rgba(96,165,250,.04)",border:"1px solid rgba(96,165,250,.12)",marginBottom:8}}>
            <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.bl,fontFamily:T.m,fontWeight:600,marginBottom:3}}>Purpose</div>
            <div style={{fontSize:11,color:T.tx,fontFamily:T.m}}>{req.purpose}</div></div>}
          {req.notes&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:8,fontStyle:"italic"}}>"{req.notes}"</div>}

          {/* Resolve form (inline) */}
          {isResolving?<div style={{padding:"10px 14px",borderRadius:7,background:resolveAction==="approve"?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)",
            border:"1px solid "+(resolveAction==="approve"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)"),marginTop:6}}>
            <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,color:resolveAction==="approve"?T.gn:T.rd,fontFamily:T.m,fontWeight:600,marginBottom:6}}>
              {resolveAction==="approve"?"Approve with Conditions":"Deny with Reason"}</div>
            <textarea value={resolverNotes} onChange={e=>setResolverNotes(e.target.value)}
              placeholder={resolveAction==="approve"?"Any conditions for this approval? (optional)":"Why is this request being denied? (optional)"}
              style={{width:"100%",minHeight:60,padding:8,borderRadius:6,border:"1px solid "+T.bd,background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,resize:"vertical",marginBottom:8}}/>
            <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
              <Bt sm onClick={cancelResolve} disabled={resolving}>Cancel</Bt>
              <Bt v={resolveAction==="approve"?"success":"danger"} sm onClick={resolveAction==="approve"?doApprove:doDeny} disabled={resolving}>
                {resolving?"Processing...":(resolveAction==="approve"?"Confirm Approve":"Confirm Deny")}</Bt></div></div>
          :<div style={{display:"flex",gap:6}}>
            <Bt v="success" sm onClick={()=>startResolve(req.id,"approve")}>Approve</Bt>
            <Bt v="danger" sm onClick={()=>startResolve(req.id,"deny")}>Deny</Bt></div>}
        </div>)})}

      {resolved.length>0&&<div style={{marginTop:20}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>Resolved</div>
        {resolved.slice().sort((a,b)=>new Date(b.resolvedDate||b.createdAt)-new Date(a.resolvedDate||a.createdAt)).slice(0,10).map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId)||req._person;
          const resolver=req.resolvedById?personnel.find(p=>p.id===req.resolvedById)||req._resolvedBy:null;
          const statusColor=req.status==="approved"?T.gn:req.status==="denied"?T.rd:T.mu;
          return(<div key={req.id} style={{padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              {kit&&<Sw color={kit.color} size={20}/>}
              <div style={{flex:1}}>
                <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{person?.name||"?"} — Kit {kit?.color||req._kit?.color||"?"}</span>
                {req.purpose&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>Purpose: {req.purpose}</div>}</div>
              <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{req.resolvedDate?fmtDate(req.resolvedDate):""}</span>
              <Bg color={statusColor} bg={statusColor+"18"}>{req.status}</Bg></div>
            {req.resolverNotes&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginTop:4,fontStyle:"italic",paddingLeft:30}}>
              {req.status==="approved"?"Conditions":"Reason"}: {req.resolverNotes}
              {resolver&&<span> — {resolver.name||resolver}</span>}</div>}
          </div>)})}</div>}
    </div>}

    {/* Access Requests Tab */}
    {tab==="access"&&showTabs&&<div>
      {!pendingAccess.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No pending access requests</div>}
      {pendingAccess.map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId)||req._person;
        const ty=kit?types.find(t=>t.id===kit.typeId):null;
        return(<div key={req.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,marginBottom:8,borderLeft:"3px solid "+(T.pu||"#a855f7")}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            {kit&&<Sw color={kit.color} size={28}/>}
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,fontFamily:T.u,color:T.tx}}>Access: Kit {kit?.color||"?"}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{person?.name||"?"} | {fmtDate(req.createdAt)}</div>
              {ty&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{ty.name}</div>}</div>
            <Bg color={T.pu||"#a855f7"} bg="rgba(168,85,247,.1)">ACCESS REQUEST</Bg></div>
          {req.notes&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:8,fontStyle:"italic"}}>"{req.notes}"</div>}
          <div style={{display:"flex",gap:6}}>
            <Bt v="success" sm onClick={()=>approveAccess(req.id)}>Approve</Bt>
            <Bt v="danger" sm onClick={()=>denyAccess(req.id)}>Deny</Bt></div></div>)})}
      {resolvedAccess.length>0&&<div style={{marginTop:20}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>Resolved</div>
        {resolvedAccess.slice().reverse().slice(0,10).map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId)||req._person;
          const statusColor=req.status==="approved"?T.gn:req.status==="denied"?T.rd:T.mu;
          return(<div key={req.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
            {kit&&<Sw color={kit.color} size={20}/>}
            <span style={{flex:1,fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{person?.name||"?"} — Kit {kit?.color||"?"}</span>
            <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{req.resolvedDate?fmtDate(req.resolvedDate):""}</span>
            <Bg color={statusColor} bg={statusColor+"18"}>{req.status}</Bg></div>)})}</div>}
    </div>}
  </div>);}

export default ApprovalsPage;
