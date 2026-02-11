import { T } from '../../theme/theme.js';

function Bt({children,onClick,v="default",disabled,sm,style:sx}){
  const base={all:"unset",cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,
    padding:sm?"5px 10px":"8px 15px",borderRadius:7,fontSize:sm?10:12,fontWeight:600,fontFamily:T.m,
    transition:"all .15s",opacity:disabled?.4:1,letterSpacing:.3};
  const vs={default:{background:T.card,border:"1px solid "+T.bd,color:T.tx},
    primary:{background:"rgba(96,165,250,.14)",border:"1px solid rgba(96,165,250,.3)",color:T.bl},
    danger:{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",color:T.rd},
    success:{background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",color:T.gn},
    ghost:{background:"transparent",border:"1px solid transparent",color:T.mu},
    ind:{background:"rgba(129,140,248,.12)",border:"1px solid rgba(129,140,248,.3)",color:T.ind},
    warn:{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.25)",color:T.am},
    pink:{background:"rgba(244,114,182,.1)",border:"1px solid rgba(244,114,182,.25)",color:T.pk},
    orange:{background:"rgba(251,146,60,.1)",border:"1px solid rgba(251,146,60,.25)",color:T.or}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...vs[v],...sx}}>{children}</button>;}

export default Bt;
