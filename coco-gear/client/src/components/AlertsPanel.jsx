import { T } from '../theme/theme.js';
import { uid, daysAgo, fmtDate } from '../theme/helpers.js';

function AlertsPanel({analytics,kits,settings,onNavigate,onFilterKits,requests,personnel}){
  const alerts=[];
  const pending=(requests||[]).filter(r=>r.status==="pending");
  pending.forEach(r=>{const kit=kits.find(k=>k.id===r.kitId);const person=(personnel||[]).find(p=>p.id===r.personId);
    alerts.push({id:uid(),type:"request",severity:"high",title:`Kit ${kit?.color||"?"} requested`,sub:`By ${person?.name||"Unknown"} · ${r.notes||"No notes"}`,kitId:r.kitId,
      action:()=>onNavigate&&onNavigate("approvals"),actionLabel:"Review"})});
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
  const typeIcons={overdue:"\u23F0",inspection:"\uD83D\uDD0D",calibration:"\uD83D\uDCD0",maintenance:"\uD83D\uDD27",request:"\uD83D\uDCE5"};
  if(!sorted.length)return <div style={{padding:20,textAlign:"center",color:T.gn,fontFamily:T.m,fontSize:11}}>{"\u2713"} All clear — no issues</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.slice(0,10).map(a=>{const isReq=a.type==="request";const borderColor=isReq?T.or:sevColors[a.severity];const bgHl=isReq?"rgba(251,146,60,.06)":T.card;
      return <div key={a.id} onClick={a.action} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
      borderRadius:7,background:bgHl,border:"1px solid "+(isReq?"rgba(251,146,60,.2)":T.bd),cursor:"pointer",borderLeft:"3px solid "+borderColor,transition:"all .12s"}}
      onMouseEnter={e=>e.currentTarget.style.background=isReq?"rgba(251,146,60,.1)":T.cardH} onMouseLeave={e=>e.currentTarget.style.background=bgHl}>
      <div style={{fontSize:14,opacity:.7}}>{typeIcons[a.type]||"\u2022"}</div>
      <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:isReq?T.or:T.tx,fontFamily:T.u}}>{a.title}</div>
        <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.sub}</div></div>
      <div style={{fontSize:8,color:isReq?T.or:sevColors[a.severity],fontFamily:T.m,opacity:.8}}>{a.actionLabel} {"\u2192"}</div></div>})}
    {sorted.length>10&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center",padding:8}}>+{sorted.length-10} more alerts</div>}</div>);}

export default AlertsPanel;
