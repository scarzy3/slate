import { T } from '../../theme/theme.js';

function Sl({options,...props}){return(
  <select {...props} style={{padding:"7px 11px",borderRadius:6,background:T.cardH,
    border:"1px solid "+T.bd,color:T.tx,fontSize:11,fontFamily:T.m,outline:"none",cursor:"pointer",...props.style}}>
    {options.map(o=><option key={typeof o==="string"?o:o.v} value={typeof o==="string"?o:o.v}>{typeof o==="string"?o:o.l}</option>)}</select>);}

export default Sl;
