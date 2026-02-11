import { useMemo } from 'react';
import { T } from '../../theme/theme.js';
import { QR } from './qrHelpers.js';

function QRSvg({data,size=160,padding=2}){
  const matrix=useMemo(()=>QR.generate(data),[data]);
  if(!matrix)return <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",
    background:"#fff",borderRadius:8,fontSize:10,color:"#999",fontFamily:T.m}}>Too long</div>;
  const n=matrix.length;const total=n+padding*2;const cs=size/total;
  return(<svg width={size} height={size} viewBox={"0 0 "+size+" "+size} style={{borderRadius:4}}>
    <rect width={size} height={size} fill="#fff"/>
    {matrix.map((row,r)=>row.map((cell,c)=>cell?
      <rect key={r*n+c} x={(c+padding)*cs} y={(r+padding)*cs} width={cs+.5} height={cs+.5} fill="#000"/>:null))}</svg>);}

export default QRSvg;
