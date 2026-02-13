import { T } from '../theme/theme.js';
import { uid, daysAgo, fmtDate } from '../theme/helpers.js';

function AlertsPanel({analytics,kits,settings,onNavigate,onFilterKits,requests,personnel,curUserId}){
  const alerts=[];

  // Show pending checkout requests to approvers (exclude the user's own requests)
  const pending=(requests||[]).filter(r=>r.status==="pending"&&r.personId!==curUserId);
  pending.forEach(r=>{const kit=kits.find(k=>k.id===r.kitId);const person=(personnel||[]).find(p=>p.id===r.personId);
    alerts.push({id:uid(),type:"request",severity:"high",title:`Kit ${kit?.color||"?"} requested`,sub:`By ${person?.name||"Unknown"} · ${r.purpose||r.notes||"No details"}`,kitId:r.kitId,
      action:()=>onNavigate&&onNavigate("approvals"),actionLabel:"Review"})});

  // Show the user's own request status notifications (approved/denied/pending)
  if(curUserId){
    const myApproved=(requests||[]).filter(r=>r.personId===curUserId&&r.status==="approved");
    myApproved.forEach(r=>{const kit=kits.find(k=>k.id===r.kitId);
      alerts.push({id:uid(),type:"request_approved",severity:"high",
        title:`Kit ${kit?.color||"?"} request approved`,
        sub:r.resolverNotes?`Conditions: ${r.resolverNotes}`:"You can now check out this kit",
        kitId:r.kitId,action:()=>onNavigate&&onNavigate("issuance"),actionLabel:"Checkout"})});

    const myDenied=(requests||[]).filter(r=>r.personId===curUserId&&r.status==="denied");
    myDenied.forEach(r=>{const kit=kits.find(k=>k.id===r.kitId);
      alerts.push({id:uid(),type:"request_denied",severity:"medium",
        title:`Kit ${kit?.color||"?"} request denied`,
        sub:r.resolverNotes?`Reason: ${r.resolverNotes}`:"Your request was not approved",
        kitId:r.kitId,action:()=>onNavigate&&onNavigate("issuance"),actionLabel:"View"})});

    const myPending=(requests||[]).filter(r=>r.personId===curUserId&&r.status==="pending");
    myPending.forEach(r=>{const kit=kits.find(k=>k.id===r.kitId);
      alerts.push({id:uid(),type:"request_pending",severity:"low",
        title:`Kit ${kit?.color||"?"} request pending`,
        sub:`Submitted ${fmtDate(r.createdAt)} · Awaiting department approval`,
        kitId:r.kitId,action:()=>onNavigate&&onNavigate("issuance"),actionLabel:"View"})});
  }

  analytics.overdueReturns.forEach(k=>{const h=k.issueHistory[k.issueHistory.length-1];
    alerts.push({id:uid(),type:"overdue",severity:"high",title:`Kit ${k.color} overdue`,sub:`Out ${daysAgo(h.issuedDate)} days`,kitId:k.id,
      action:()=>onFilterKits&&onFilterKits("overdue"),actionLabel:"View overdue"})});
  analytics.overdueInspection.forEach(k=>alerts.push({id:uid(),type:"inspection",severity:daysAgo(k.lastChecked)>60?"high":"medium",
    title:`Kit ${k.color} needs inspection`,sub:k.lastChecked?`Last: ${fmtDate(k.lastChecked)}`:"Never inspected",kitId:k.id,
    action:()=>onNavigate&&onNavigate("kits",k.id,"inspect"),actionLabel:"Inspect"}));
  analytics.calibrationDue.forEach(c=>alerts.push({id:uid(),type:"calibration",severity:c.dueIn<0?"high":"medium",
    title:`${c.comp.label} calibration ${c.dueIn<0?"overdue":"due"}`,sub:`Kit ${c.kit.color} - ${c.dueIn<0?Math.abs(c.dueIn)+" days overdue":"in "+c.dueIn+" days"}`,kitId:c.kit.id,
    action:()=>onNavigate&&onNavigate("maintenance",c.kit.id),actionLabel:"Maintenance"}));
  analytics.inMaintenance.forEach(k=>alerts.push({id:uid(),type:"maintenance",severity:"low",
    title:`Kit ${k.color} in maintenance`,sub:k.maintenanceStatus,kitId:k.id,
    action:()=>onNavigate&&onNavigate("maintenance",k.id),actionLabel:"View maintenance"}));
  const sevOrder={high:0,medium:1,low:2};const sorted=[...alerts].sort((a,b)=>sevOrder[a.severity]-sevOrder[b.severity]);
  const sevColors={high:T.rd,medium:T.am,low:T.mu};
  const typeIcons={overdue:"\u23F0",inspection:"\uD83D\uDD0D",calibration:"\uD83D\uDCD0",maintenance:"\uD83D\uDD27",request:"\uD83D\uDCE5",
    request_approved:"\u2705",request_denied:"\u274C",request_pending:"\u23F3"};
  if(!sorted.length)return <div style={{padding:20,textAlign:"center",color:T.gn,fontFamily:T.m,fontSize:11}}>{"\u2713"} All clear — no issues</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.slice(0,10).map(a=>{
      const isReq=a.type==="request";
      const isApproved=a.type==="request_approved";
      const isDenied=a.type==="request_denied";
      const isPendingReq=a.type==="request_pending";
      const isReqType=isReq||isApproved||isDenied||isPendingReq;
      const borderColor=isReq?T.or:isApproved?T.gn:isDenied?T.rd:isPendingReq?T.am:sevColors[a.severity];
      const bgHl=isReq?"rgba(251,146,60,.06)":isApproved?"rgba(34,197,94,.04)":isDenied?"rgba(239,68,68,.04)":isPendingReq?"rgba(251,191,36,.04)":T.card;
      const textColor=isReq?T.or:isApproved?T.gn:isDenied?T.rd:isPendingReq?T.am:T.tx;
      return <div key={a.id} onClick={a.action} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
      borderRadius:7,background:bgHl,border:"1px solid "+(isReqType?borderColor+"33":T.bd),cursor:"pointer",borderLeft:"3px solid "+borderColor,transition:"all .12s"}}
      onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
      <div style={{fontSize:14,opacity:.7}}>{typeIcons[a.type]||"\u2022"}</div>
      <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:textColor,fontFamily:T.u}}>{a.title}</div>
        <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.sub}</div></div>
      <div style={{fontSize:8,color:textColor,fontFamily:T.m,opacity:.8}}>{a.actionLabel} {"\u2192"}</div></div>})}
    {sorted.length>10&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center",padding:8}}>+{sorted.length-10} more alerts</div>}</div>);}

export default AlertsPanel;
