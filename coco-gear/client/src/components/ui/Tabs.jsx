import { T } from '../../theme/theme.js';

function Tabs({tabs,active,onChange}){return(
  <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid "+T.bd,paddingBottom:8}}>
    {tabs.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{all:"unset",cursor:"pointer",padding:"6px 14px",borderRadius:6,
      fontSize:11,fontWeight:active===t.id?600:400,fontFamily:T.m,background:active===t.id?T.cardH:"transparent",
      color:active===t.id?T.tx:T.mu,transition:"all .12s"}}>{t.l}{t.badge!==undefined&&<span style={{marginLeft:6,fontSize:9,
        padding:"1px 5px",borderRadius:8,background:t.badgeColor||"rgba(251,146,60,.15)",color:t.badgeColor?T.tx:T.or}}>{t.badge}</span>}</button>)}</div>);}

export default Tabs;
