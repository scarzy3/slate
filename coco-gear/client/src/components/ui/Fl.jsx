import { T } from '../../theme/theme.js';

function Fl({label,children,sub,hint}){return <div style={{display:"flex",flexDirection:"column",gap:4}}>
  <label style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,whiteSpace:"nowrap"}}>
    {label}{sub&&<span style={{color:T.dm,fontWeight:400,textTransform:"none",letterSpacing:0}}> {sub}</span>}</label>{children}
  {hint&&<span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{hint}</span>}</div>;}

export default Fl;
