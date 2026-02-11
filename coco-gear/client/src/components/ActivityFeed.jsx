import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';

function ActivityFeed({logs,kits,personnel,limit=10}){
  const sorted=[...logs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,limit);
  const actionIcons={checkout:"\u2197",return:"\u21A9",inspect:"\u2713",maintenance_start:"\uD83D\uDD27",location_change:"\uD83D\uDCCD",approved:"\u2713",denied:"\u2717"};
  const actionColors={checkout:T.bl,return:T.gn,inspect:T.tl,maintenance_start:T.am,location_change:T.ind,approved:T.gn,denied:T.rd};
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.map(l=>{const person=personnel.find(p=>p.id===l.by);return(
      <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{width:24,height:24,borderRadius:12,background:(actionColors[l.action]||T.mu)+"22",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:actionColors[l.action]||T.mu}}>{actionIcons[l.action]||"\u2022"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.tx,fontFamily:T.m}}><span style={{fontWeight:600}}>{person?.name||"System"}</span> {l.action.replace("_"," ")} {l.details?.kitColor&&<span style={{color:T.ind}}>Kit {l.details.kitColor}</span>}</div>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{fmtDate(l.date)}</div></div></div>)})}
    {!sorted.length&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No activity</div>}</div>);}

export default ActivityFeed;
