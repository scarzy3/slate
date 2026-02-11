import { T } from '../../theme/theme.js';

function SH({title,sub,action}){return(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,gap:12,flexWrap:"wrap"}}>
    <div><h2 style={{margin:0,fontSize:18,fontWeight:700,fontFamily:T.u,color:T.tx}}>{title}</h2>
      {sub&&<p style={{margin:"3px 0 0",fontSize:11,color:T.mu,fontFamily:T.m}}>{sub}</p>}</div>{action}</div>);}

export default SH;
