import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';

const actionIcons={checkout:"\u2197",return:"\u21A9",inspect:"\u2713",maintenance_start:"\u2699",maintenance_return:"\u2713",
  location_change:"\u2316",kit_create:"+",kit_update:"\u270E",kit_delete:"\u2717",
  asset_checkout:"\u2197",asset_return:"\u21A9",consumable_adjust:"\u0394",
  reservation_create:"+",reservation_approve:"\u2713",reservation_cancel:"\u2717",
  trip_create:"+",trip_update:"\u270E",personnel_create:"+",approved:"\u2713",denied:"\u2717"};
const actionColors={checkout:T.bl,return:T.gn,inspect:T.tl,maintenance_start:T.am,maintenance_return:T.gn,
  location_change:T.ind,kit_create:T.bl,kit_delete:T.rd,
  asset_checkout:T.bl,asset_return:T.gn,consumable_adjust:T.or,
  reservation_create:T.pu,reservation_approve:T.gn,reservation_cancel:T.rd,
  trip_create:T.bl,personnel_create:T.bl,approved:T.gn,denied:T.rd};

function ActivityFeed({logs,kits,personnel,limit=10}){
  const sorted=[...logs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,limit);

  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.map(l=>{
      const person=personnel.find(p=>p.id===l.by);
      const color=actionColors[l.action]||T.mu;
      const icon=actionIcons[l.action]||"\u2022";
      const details=l.details||{};

      // Build richer summary
      const parts=[];
      if(details.kitColor)parts.push('Kit '+details.kitColor);
      else if(l.target==='kit'&&l.targetId){const k=kits.find(x=>x.id===l.targetId);if(k)parts.push('Kit '+k.color)}
      if(details.name)parts.push(details.name);
      if(details.reason)parts.push(details.reason);
      if(details.previousQty!==undefined&&details.newQty!==undefined)parts.push(details.previousQty+' \u2192 '+details.newQty);
      if(details.status)parts.push(details.status);

      return(
      <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{width:24,height:24,borderRadius:12,background:color+"22",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:color}}>{icon}</div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:11,color:T.tx,fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            <span style={{fontWeight:600}}>{person?.name||"System"}</span>
            <span style={{color:T.mu}}> {(l.action||'').replace(/_/g," ")} </span>
            {parts.length>0&&<span style={{color:T.sub}}>{parts[0]}</span>}
            {parts.length>1&&<span style={{color:T.dm}}>{' \u2014 '+parts.slice(1).join(', ')}</span>}
          </div>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{fmtDate(l.date)}</div>
        </div>
      </div>)})}
    {!sorted.length&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No activity</div>}</div>);}

export default ActivityFeed;
