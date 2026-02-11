import { T } from '../../theme/theme.js';

function StatCard({label,value,color,sub,icon,onClick}){return(
  <div onClick={onClick} style={{padding:"14px 16px",borderRadius:9,background:T.card,border:"1px solid "+T.bd,minWidth:100,
    cursor:onClick?"pointer":"default",transition:"all .12s",...(onClick?{":hover":{background:T.cardH}}:{})}}
    onMouseEnter={e=>{if(onClick)e.currentTarget.style.background=T.cardH}}
    onMouseLeave={e=>{if(onClick)e.currentTarget.style.background=T.card}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:5}}>{label}</div>
      {icon&&<span style={{fontSize:14,opacity:.5}}>{icon}</span>}</div>
    <div style={{fontSize:24,fontWeight:800,color:color||T.bl,fontFamily:T.u}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>{sub}</div>}
    {onClick&&<div style={{fontSize:8,color:T.mu,fontFamily:T.m,marginTop:4,opacity:.6}}>Click to view →</div>}</div>);}

export default StatCard;
