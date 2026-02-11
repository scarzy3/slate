import { T } from '../../theme/theme.js';

function In(props){return <input {...props} style={{padding:"7px 11px",borderRadius:6,background:T.card,
  border:"1px solid "+T.bd,color:T.tx,fontSize:12,fontFamily:T.m,outline:"none",width:"100%",...props.style}}/>;}

export default In;
