import { useState, useEffect, useCallback } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate, SYS_ROLE_LABELS, sysRoleColor } from '../theme/helpers.js';
import { Sw, Bg, Bt, SH, DeptBg, Tabs } from '../components/ui/index.js';
import api from '../api.js';

function ApprovalsPage({requests,setRequests,accessRequests,setAccessRequests,kits,setKits,personnel,depts,allC,types,curUserId,userRole,settings,addLog,onRefreshKits,onRefreshRequests,onRefreshPersonnel}){
  const[tab,setTab]=useState("checkout");
  const[resolveId,setResolveId]=useState(null);const[resolveAction,setResolveAction]=useState(null);const[resolverNotes,setResolverNotes]=useState("");const[resolving,setResolving]=useState(false);
  const _rl={user:0,lead:1,manager:2,admin:2,director:3,super:3,developer:3,engineer:3};
  const minRole=settings?.deptApprovalMinRole||"lead";
  const hasMinRole=(_rl[userRole]||0)>=(_rl[minRole]||1);
  const headOf=depts.filter(d=>(d.managerIds||[]).includes(curUserId)||(d.leadIds||[]).includes(curUserId)).map(d=>d.id);
  const canManageUsers=(_rl[userRole]||0)>=_rl.manager; // manager, engineer, director

  // ─── User Approval State ───
  const[pendingUsers,setPendingUsers]=useState([]);const[resolvedUsers,setResolvedUsers]=useState([]);
  const[userApprovalId,setUserApprovalId]=useState(null);const[userApprovalAction,setUserApprovalAction]=useState(null);
  const[assignRole,setAssignRole]=useState("user");const[assignDept,setAssignDept]=useState("");const[denyReason,setDenyReason]=useState("");
  const[userResolving,setUserResolving]=useState(false);
  const[userTab,setUserTab]=useState("pending");

  const loadPendingUsers=useCallback(async()=>{
    if(!canManageUsers)return;
    try{
      const [p,r]=await Promise.all([api.approval.list("pending"),api.approval.list("denied")]);
      setPendingUsers(p||[]);setResolvedUsers(r||[]);
    }catch(e){console.error("Load pending users error:",e)}
  },[canManageUsers]);

  useEffect(()=>{loadPendingUsers()},[loadPendingUsers]);

  const startUserApproval=(userId,action)=>{setUserApprovalId(userId);setUserApprovalAction(action);setAssignRole("user");setAssignDept("");setDenyReason("")};
  const cancelUserApproval=()=>{setUserApprovalId(null);setUserApprovalAction(null);setAssignRole("user");setAssignDept("");setDenyReason("")};

  const doUserApprove=async()=>{
    setUserResolving(true);
    try{
      await api.approval.approve(userApprovalId,{role:assignRole,deptId:assignDept||null});
      cancelUserApproval();
      loadPendingUsers();
      if(onRefreshPersonnel)onRefreshPersonnel();
    }catch(e){alert(e.message)}
    finally{setUserResolving(false)}
  };

  const doUserDeny=async()=>{
    setUserResolving(true);
    try{
      await api.approval.deny(userApprovalId,{reason:denyReason});
      cancelUserApproval();
      loadPendingUsers();
    }catch(e){alert(e.message)}
    finally{setUserResolving(false)}
  };

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

  const totalPending=pending.length+pendingAccess.length+pendingUsers.length;

  // Determine which tabs to show
  const tabList=[
    {id:"checkout",l:"Checkout",badge:pending.length||undefined,badgeColor:pending.length?"rgba(251,146,60,.15)":undefined},
  ];
  if(settings?.requireAccessRequest)tabList.push({id:"access",l:"Access",badge:pendingAccess.length||undefined,badgeColor:pendingAccess.length?"rgba(168,85,247,.15)":undefined});
  if(canManageUsers)tabList.push({id:"users",l:"Users",badge:pendingUsers.length||undefined,badgeColor:pendingUsers.length?"rgba(34,197,94,.15)":undefined});

  return(<div>
    <SH title="Approvals" sub={totalPending+" pending"}/>
    <Tabs tabs={tabList} active={tab} onChange={setTab} style={{marginBottom:12}}/>

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
    {tab==="access"&&<div>
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

    {/* ─── User Approvals Tab ─── */}
    {tab==="users"&&canManageUsers&&<div>
      <div style={{display:"flex",gap:6,marginBottom:14}}>
        <button onClick={()=>setUserTab("pending")} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,
          fontSize:10,fontWeight:userTab==="pending"?600:400,fontFamily:T.m,
          background:userTab==="pending"?"rgba(34,197,94,.08)":"transparent",
          color:userTab==="pending"?T.gn:T.mu,border:"1px solid "+(userTab==="pending"?"rgba(34,197,94,.2)":"transparent")}}>
          Pending ({pendingUsers.length})</button>
        <button onClick={()=>setUserTab("denied")} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,
          fontSize:10,fontWeight:userTab==="denied"?600:400,fontFamily:T.m,
          background:userTab==="denied"?"rgba(239,68,68,.08)":"transparent",
          color:userTab==="denied"?T.rd:T.mu,border:"1px solid "+(userTab==="denied"?"rgba(239,68,68,.2)":"transparent")}}>
          Denied ({resolvedUsers.length})</button>
      </div>

      {/* Security notice */}
      <div style={{padding:"10px 14px",borderRadius:8,background:"rgba(96,165,250,.04)",border:"1px solid rgba(96,165,250,.12)",
        marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:14}}>&#x1F6E1;</span>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:600,fontFamily:T.m,color:T.bl}}>User Approval Required</div>
          <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>New signups require approval from a director, manager, or engineer before they can access the system.</div>
        </div>
      </div>

      {userTab==="pending"&&<div>
        {!pendingUsers.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No pending user signups</div>}
        {pendingUsers.map(u=>{
          const isResolving=userApprovalId===u.id;
          const rc=sysRoleColor("user");
          return(<div key={u.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,
            marginBottom:8,borderLeft:"3px solid "+T.gn}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              {/* Avatar */}
              <div style={{width:40,height:40,borderRadius:20,background:rc+"22",border:"1px solid "+rc+"44",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,
                color:rc,fontFamily:T.m,flexShrink:0}}>
                {u.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:700,fontFamily:T.u,color:T.tx}}>{u.name}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>
                  {u.email||"No email"}{u.title?" | "+u.title:""}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>
                  Signed up {fmtDate(u.createdAt)}</div>
              </div>
              <Bg color={T.am} bg="rgba(251,191,36,.1)">PENDING</Bg>
            </div>

            {/* Approve/Deny form */}
            {isResolving?<div style={{padding:"12px 14px",borderRadius:8,
              background:userApprovalAction==="approve"?"rgba(34,197,94,.04)":"rgba(239,68,68,.04)",
              border:"1px solid "+(userApprovalAction==="approve"?"rgba(34,197,94,.15)":"rgba(239,68,68,.15)")}}>

              {userApprovalAction==="approve"?<>
                <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,color:T.gn,fontFamily:T.m,
                  fontWeight:600,marginBottom:10}}>Approve User & Set Permissions</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
                  <div>
                    <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4,fontWeight:600}}>Role</div>
                    <select value={assignRole} onChange={e=>setAssignRole(e.target.value)}
                      style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+T.bd,
                        background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,cursor:"pointer"}}>
                      <option value="user">Operator</option>
                      <option value="lead">Lead</option>
                      {(_rl[userRole]||0)>=_rl.manager&&<option value="manager">Manager</option>}
                      {(_rl[userRole]||0)>=_rl.director&&<option value="engineer">Engineer (MOE)</option>}
                      {(_rl[userRole]||0)>=_rl.director&&<option value="director">Director</option>}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4,fontWeight:600}}>Department</div>
                    <select value={assignDept} onChange={e=>setAssignDept(e.target.value)}
                      style={{width:"100%",padding:"7px 10px",borderRadius:6,border:"1px solid "+T.bd,
                        background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,cursor:"pointer"}}>
                      <option value="">No Department</option>
                      {depts.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                  <Bt sm onClick={cancelUserApproval} disabled={userResolving}>Cancel</Bt>
                  <Bt v="success" sm onClick={doUserApprove} disabled={userResolving}>
                    {userResolving?"Approving...":"Approve User"}</Bt>
                </div>
              </>:<>
                <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1,color:T.rd,fontFamily:T.m,
                  fontWeight:600,marginBottom:8}}>Deny User Access</div>
                <textarea value={denyReason} onChange={e=>setDenyReason(e.target.value)}
                  placeholder="Reason for denying access (optional)"
                  style={{width:"100%",minHeight:60,padding:8,borderRadius:6,border:"1px solid "+T.bd,
                    background:T.card,color:T.tx,fontFamily:T.m,fontSize:11,resize:"vertical",marginBottom:8}}/>
                <div style={{display:"flex",gap:6,justifyContent:"flex-end"}}>
                  <Bt sm onClick={cancelUserApproval} disabled={userResolving}>Cancel</Bt>
                  <Bt v="danger" sm onClick={doUserDeny} disabled={userResolving}>
                    {userResolving?"Denying...":"Deny Access"}</Bt>
                </div>
              </>}
            </div>
            :<div style={{display:"flex",gap:6}}>
              <Bt v="success" sm onClick={()=>startUserApproval(u.id,"approve")}>Approve</Bt>
              <Bt v="danger" sm onClick={()=>startUserApproval(u.id,"deny")}>Deny</Bt>
            </div>}
          </div>)})}
      </div>}

      {userTab==="denied"&&<div>
        {!resolvedUsers.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No denied users</div>}
        {resolvedUsers.map(u=>{
          const reviewer=u.approvedBy;
          return(<div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,
            background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
            <div style={{width:28,height:28,borderRadius:14,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.rd,fontFamily:T.m,flexShrink:0}}>
              {u.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{u.name}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>
                {u.email||""}{u.denialReason?" | Reason: "+u.denialReason:""}</div>
            </div>
            <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{u.approvedAt?fmtDate(u.approvedAt):""}{reviewer?" by "+reviewer.name:""}</span>
            <Bg color={T.rd} bg="rgba(239,68,68,.1)">DENIED</Bg>
          </div>)})}
      </div>}
    </div>}
  </div>);}

export default ApprovalsPage;
