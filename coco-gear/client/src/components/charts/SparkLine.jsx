import { T } from '../../theme/theme.js';

function SparkLine({data,width=100,height=30,color=T.bl}){
  if(!data.length)return null;const max=Math.max(...data);const min=Math.min(...data);const range=max-min||1;
  const pts=data.map((v,i)=>`${i/(data.length-1)*width},${height-(v-min)/range*height}`).join(" ");
  return(<svg width={width} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>);}

export default SparkLine;
