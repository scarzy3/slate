import { useState, useEffect, useRef } from 'react';
import { T } from '../../theme/theme.js';
import { BrowserQRCodeReader } from '@zxing/browser';
import In from '../ui/In.jsx';
import Bt from '../ui/Bt.jsx';

function QRScanner({onScan,onClose}){
  const vidRef=useRef(null);const canvasRef=useRef(null);const streamRef=useRef(null);
  const[err,setErr]=useState("");const[manual,setManual]=useState("");const[active,setActive]=useState(true);
  const[torch,setTorch]=useState(false);const[hasTorch,setHasTorch]=useState(false);
  const toggleTorch=()=>{const track=streamRef.current?.getVideoTracks()[0];
    if(track){const next=!torch;track.applyConstraints({advanced:[{torch:next}]}).catch(()=>{});setTorch(next)}};
  useEffect(()=>{
    if(!active)return;let animId=null;let stopped=false;
    const reader=new BrowserQRCodeReader();
    const start=async()=>{
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{
          facingMode:'environment',width:{ideal:1920},height:{ideal:1080},
          focusMode:{ideal:'continuous'},focusDistance:{ideal:0},
          zoom:{ideal:2},exposureCompensation:{ideal:-1}
        }});
        streamRef.current=stream;
        const track=stream.getVideoTracks()[0];
        const caps=track?.getCapabilities?.();
        if(caps?.torch)setHasTorch(true);
        if(caps?.zoom){const z=Math.min(caps.zoom.max,2);track.applyConstraints({advanced:[{zoom:z}]}).catch(()=>{})}
        if(caps?.exposureCompensation){const ec=Math.max(caps.exposureCompensation.min,-1);
          track.applyConstraints({advanced:[{exposureCompensation:ec}]}).catch(()=>{})}
        if(vidRef.current){vidRef.current.srcObject=stream;await vidRef.current.play()}
        const canvas=canvasRef.current;const ctx=canvas?canvas.getContext('2d',{willReadFrequently:true}):null;
        const scan=()=>{
          if(stopped||!vidRef.current)return;
          try{
            if(ctx&&vidRef.current.videoWidth){
              const vw=vidRef.current.videoWidth,vh=vidRef.current.videoHeight;
              /* Try two crop levels: tight (35%) then normal (55%) */
              for(const pct of[0.35,0.55]){
                const cw=Math.round(vw*pct),ch=Math.round(vh*pct);
                const cx=Math.round((vw-cw)/2),cy=Math.round((vh-ch)/2);
                const scale=Math.min(1,640/cw);const sw=Math.round(cw*scale),sh=Math.round(ch*scale);
                canvas.width=sw;canvas.height=sh;
                /* Raw pass — let zxing HybridBinarizer handle it */
                ctx.drawImage(vidRef.current,cx,cy,cw,ch,0,0,sw,sh);
                try{const r=reader.decodeFromCanvas(canvas);if(r){onScan(r.getText());return}}catch(e){}
                /* Histogram-normalized pass — stretches whatever contrast exists */
                const imgData=ctx.getImageData(0,0,sw,sh);const d=imgData.data;
                let mn=255,mx=0;
                for(let i=0;i<d.length;i+=4){const v=(d[i]*77+d[i+1]*150+d[i+2]*29)>>8;if(v<mn)mn=v;if(v>mx)mx=v}
                if(mx-mn>20&&mx-mn<240){const s=255/(mx-mn);
                  for(let i=0;i<d.length;i+=4){d[i]=Math.min(255,(d[i]-mn)*s)|0;d[i+1]=Math.min(255,(d[i+1]-mn)*s)|0;d[i+2]=Math.min(255,(d[i+2]-mn)*s)|0}}
                ctx.putImageData(imgData,0,0);
                try{const r=reader.decodeFromCanvas(canvas);if(r){onScan(r.getText());return}}catch(e){}
              }
            }
          }catch(e){}
          animId=setTimeout(scan,120)};
        scan();
      }catch(e){setErr("Camera access denied. Use manual entry.");setActive(false)}};
    start();
    return()=>{stopped=true;if(animId)clearTimeout(animId);
      if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop())};
  },[active]);
  const go=()=>{if(manual.trim())onScan(manual.trim())};
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    {active&&<div style={{position:"relative",borderRadius:10,overflow:"hidden",background:"#000",aspectRatio:"4/3"}}>
      <video ref={vidRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
      <canvas ref={canvasRef} style={{display:"none"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{width:"40%",height:"40%",border:"2px solid rgba(96,165,250,.6)",borderRadius:12}}/></div>
      {hasTorch&&<button onClick={toggleTorch} style={{position:"absolute",top:10,right:10,width:36,height:36,
        borderRadius:"50%",border:"none",background:torch?"rgba(251,191,36,.9)":"rgba(255,255,255,.2)",
        color:torch?"#000":"#fff",fontSize:18,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
        aria-label="Toggle flashlight">{torch?"☀":"☀"}</button>}
      <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",fontSize:10,color:"rgba(255,255,255,.7)",fontFamily:T.m}}>
        Fill the box with the QR sticker</div></div>}
    {err&&<div style={{padding:12,borderRadius:8,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.15)",
      fontSize:11,color:T.am,fontFamily:T.m}}>{err}</div>}
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m}}>Or enter kit color / ID manually</div>
    <div style={{display:"flex",gap:8}}>
      <In value={manual} onChange={e=>setManual(e.target.value)} placeholder="Kit color, serial, or ID..."
        onKeyDown={e=>{if(e.key==="Enter")go()}} style={{flex:1}}/>
      <Bt v="primary" onClick={go} disabled={!manual.trim()}>Go</Bt></div>
    <div style={{display:"flex",justifyContent:"flex-end"}}><Bt onClick={onClose}>Cancel</Bt></div></div>);}

export default QRScanner;
