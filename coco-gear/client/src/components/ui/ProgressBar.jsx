import { T } from '../../theme/theme.js';

function ProgressBar({value,max,color=T.bl,height=6}){return(
  <div style={{width:"100%",height,borderRadius:height/2,background:T.card,overflow:"hidden"}}>
    <div style={{width:Math.min(100,value/max*100)+"%",height:"100%",borderRadius:height/2,background:color,transition:"width .3s"}}/></div>);}

export default ProgressBar;
