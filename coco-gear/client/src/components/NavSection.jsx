import { T } from '../theme/theme.js';

function NavSection({section,pg,setPg,collapsed,onToggle,canAccess,getBadge}){
  const visibleItems=section.items.filter(canAccess);
  if(!visibleItems.length)return null;
  const hasLabel=!!section.label;
  return(<div style={{marginBottom:hasLabel?8:0}}>
    {hasLabel&&<button onClick={onToggle} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:6,
      padding:"6px 16px",width:"100%",boxSizing:"border-box",overflow:"hidden"}}>
      <span style={{fontSize:8,color:T.dm,transition:"transform .15s",transform:collapsed?"rotate(-90deg)":"rotate(0)"}}>{"\u25BC"}</span>
      <span style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.5,color:T.dm,fontFamily:T.m,fontWeight:600}}>{section.label}</span></button>}
    {!collapsed&&<div style={{display:"flex",flexDirection:"column",gap:1}}>
      {visibleItems.map(n=>{const badge=getBadge(n.id);return(
        <button key={n.id} onClick={()=>setPg(n.id)} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          padding:"6px 16px",margin:"0 8px",borderRadius:6,fontSize:11,fontWeight:pg===n.id?600:400,fontFamily:T.u,
          background:pg===n.id?T.cardH:"transparent",color:pg===n.id?T.tx:T.mu,transition:"all .12s",boxSizing:"border-box",
          borderLeft:pg===n.id?"2px solid "+T.bl:"2px solid transparent",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          <span style={{fontSize:9,opacity:.5,fontFamily:T.m,width:12,flexShrink:0}}>{n.i}</span><span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{n.l}</span>
          {badge>0&&<span style={{marginLeft:"auto",fontSize:8,fontWeight:700,color:n.id==="approvals"?T.or:T.rd,
            background:n.id==="approvals"?"rgba(251,146,60,.12)":"rgba(239,68,68,.12)",padding:"1px 5px",borderRadius:8,fontFamily:T.m}}>{badge}</span>}
        </button>)})}</div>}</div>);}

export default NavSection;
