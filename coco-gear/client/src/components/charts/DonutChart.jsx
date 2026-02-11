import { T } from '../../theme/theme.js';

function DonutChart({segments,size=100,strokeWidth=12}){
  const total=segments.reduce((a,s)=>a+s.value,0)||1;const radius=(size-strokeWidth)/2;const circ=2*Math.PI*radius;
  let offset=0;
  return(<svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={T.card} strokeWidth={strokeWidth}/>
    {segments.map((s,i)=>{const len=s.value/total*circ;const dash=`${len} ${circ-len}`;const el=(
      <circle key={i} cx={size/2} cy={size/2} r={radius} fill="none" stroke={s.color} strokeWidth={strokeWidth}
        strokeDasharray={dash} strokeDashoffset={-offset} style={{transition:"all .3s"}}/>);offset+=len;return el})}</svg>);}

export default DonutChart;
