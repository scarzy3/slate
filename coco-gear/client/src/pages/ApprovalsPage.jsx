import { T } from '../theme/theme.js';
import { td } from '../theme/helpers.js';
import { Sw, Bg, Bt, SH, DeptBg } from '../components/ui/index.js';
import api from '../api.js';

function ApprovalsPage({requests,setRequests,kits,setKits,personnel,depts,allC,types,curUserId,userRole,settings,addLog,onRefreshKits}){
  const _rl={user:0,lead:1,manager:2,admin:2,director:3,super:3,developer:3,engineer:3};
  const minRole=settings?.deptApprovalMinRole||"lead";
  const hasMinRole=(_rl[userRole]||0)>=(_rl[minRole]||1);
  const headOf=depts.filter(d=>(d.managerIds||[]).includes(curUserId)||(d.leadIds||[]).includes(curUserId)).map(d=>d.id);
  const visible=requests.filter(r=>hasMinRole||headOf.includes(r.deptId));
  const pending=visible.filter(r=>r.status==="pending");const resolved=visible.filter(r=>r.status!=="pending");
  const approve=async reqId=>{const req=requests.find(r=>r.id===reqId);if(!req)return;
    try{await api.kits.checkout({kitId:req.kitId,personId:req.personId,serials:req.serials,notes:req.notes});
    setRequests(p=>p.map(r=>r.id===reqId?{...r,status:"approved",resolvedBy:curUserId,resolvedDate:td()}:r));
    if(onRefreshKits)await onRefreshKits()}catch(e){alert(e.message)}};
  const deny=reqId=>{setRequests(p=>p.map(r=>r.id===reqId?{...r,status:"denied",resolvedBy:curUserId,resolvedDate:td()}:r))};
  return(<div>
    <SH title="Approvals" sub={pending.length+" pending"}/>
    {!pending.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No pending requests</div>}
    {pending.map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId);const dept=depts.find(d=>d.id===req.deptId);
      return(<div key={req.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,marginBottom:8,borderLeft:"3px solid "+T.or}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>{kit&&<Sw color={kit.color} size={28}/>}
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,fontFamily:T.u,color:T.tx}}>Checkout: Kit {kit?.color}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{person?.name} | {req.date}</div></div>
          <Bg color={T.or} bg="rgba(251,146,60,.1)">PENDING</Bg></div>
        {dept&&<div style={{marginBottom:8}}><DeptBg dept={dept}/></div>}
        {req.notes&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:8,fontStyle:"italic"}}>"{req.notes}"</div>}
        <div style={{display:"flex",gap:6}}><Bt v="success" sm onClick={()=>approve(req.id)}>Approve</Bt><Bt v="danger" sm onClick={()=>deny(req.id)}>Deny</Bt></div></div>)})}
    {resolved.length>0&&<div style={{marginTop:20}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>Resolved</div>
      {resolved.slice().reverse().slice(0,10).map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId);
        return(<div key={req.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
          {kit&&<Sw color={kit.color} size={20}/>}<span style={{flex:1,fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{person?.name}</span>
          <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{req.resolvedDate}</span>
          <Bg color={req.status==="approved"?T.gn:T.rd} bg={req.status==="approved"?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)"}>{req.status}</Bg></div>)})}</div>}</div>);}

export default ApprovalsPage;
