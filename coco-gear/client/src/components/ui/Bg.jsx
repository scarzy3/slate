import { T } from '../../theme/theme.js';

function Bg({children,color=T.mu,bg=T.card}){
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:bg,color,fontFamily:T.m,letterSpacing:.3,whiteSpace:"nowrap"}}>{children}</span>;}

export default Bg;
