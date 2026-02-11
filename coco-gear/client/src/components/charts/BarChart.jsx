import { T } from '../../theme/theme.js';

function BarChart({data,height=120,color=T.bl}){
  const max=Math.max(...data.map(d=>d.value),1);
  return(<div style={{display:"flex",alignItems:"flex-end",gap:4,height,padding:"0 4px"}}>
    {data.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <div style={{width:"100%",maxWidth:40,background:color,borderRadius:3,height:Math.max(4,d.value/max*(height-24)),transition:"height .3s"}}/>
      <span style={{fontSize:8,color:T.dm,fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:40}}>{d.label}</span>
    </div>)}</div>);}

export default BarChart;
