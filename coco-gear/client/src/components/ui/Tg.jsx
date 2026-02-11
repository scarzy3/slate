import { T } from '../../theme/theme.js';

function Tg({checked,onChange}){return(
  <button onClick={()=>onChange(!checked)} style={{all:"unset",cursor:"pointer",width:36,height:20,
    borderRadius:10,background:checked?"rgba(34,197,94,.3)":T.cardH,
    border:"1px solid "+(checked?"rgba(34,197,94,.4)":T.bd),position:"relative",transition:"all .2s"}}>
    <div style={{width:14,height:14,borderRadius:7,background:checked?T.gn:T.mu,position:"absolute",top:2,left:checked?19:2,transition:"all .2s"}}/></button>);}

export default Tg;
