import { T, CM } from '../../theme/theme.js';

function Sw({color,size=24}){const c=CM[color];const p=c&&(c.includes("gradient")||c.includes("conic"));
  return <div style={{width:size,height:size,borderRadius:4,flexShrink:0,background:p?c:(c||"#444"),border:color==="WHITE"?"1.5px solid #555":"1px solid "+T.bd}}/>;}

export default Sw;
