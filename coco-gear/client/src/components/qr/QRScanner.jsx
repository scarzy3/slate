import { useState, useEffect, useRef } from 'react';
import { T } from '../../theme/theme.js';
import jsQR from 'jsqr';
import In from '../ui/In.jsx';
import Bt from '../ui/Bt.jsx';

function QRScanner({onScan,onClose}){
  const vidRef=useRef(null);const canvasRef=useRef(null);const streamRef=useRef(null);
  const[err,setErr]=useState("");const[manual,setManual]=useState("");const[active,setActive]=useState(true);
  useEffect(()=>{
    if(!active)return;let animId=null;let stopped=false;
    const start=async()=>{
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{
          facingMode:'environment',width:{ideal:1920},height:{ideal:1080},
          focusMode:{ideal:'continuous'},focusDistance:{ideal:0}
        }});
        streamRef.current=stream;
        if(vidRef.current){vidRef.current.srcObject=stream;await vidRef.current.play()}
        const useNative='BarcodeDetector' in window;
        const detector=useNative?new BarcodeDetector({formats:['qr_code']}):null;
        const canvas=canvasRef.current;const ctx=canvas?canvas.getContext('2d',{willReadFrequently:true}):null;
        const scan=async()=>{
          if(stopped||!vidRef.current)return;
          try{
            if(detector){
              const codes=await detector.detect(vidRef.current);
              if(codes.length>0){onScan(codes[0].rawValue);return}
            }
            if(ctx&&vidRef.current.videoWidth){
              const vw=vidRef.current.videoWidth,vh=vidRef.current.videoHeight;
              const cw=Math.round(vw*0.6),ch=Math.round(vh*0.6);
              const cx=Math.round((vw-cw)/2),cy=Math.round((vh-ch)/2);
              const scale=Math.min(1,640/cw);const sw=Math.round(cw*scale),sh=Math.round(ch*scale);
              canvas.width=sw;canvas.height=sh;
              ctx.drawImage(vidRef.current,cx,cy,cw,ch,0,0,sw,sh);
              const imgData=ctx.getImageData(0,0,sw,sh);
              const code=jsQR(imgData.data,imgData.width,imgData.height,{inversionAttempts:"dontInvert"});
              if(code){onScan(code.data);return}
            }
          }catch(e){}
          animId=setTimeout(scan,150)};
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
        <div style={{width:"55%",height:"55%",border:"2px solid rgba(96,165,250,.6)",borderRadius:12}}/></div>
      <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",fontSize:10,color:"rgba(255,255,255,.7)",fontFamily:T.m}}>
        Point camera at QR code</div></div>}
    {err&&<div style={{padding:12,borderRadius:8,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.15)",
      fontSize:11,color:T.am,fontFamily:T.m}}>{err}</div>}
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m}}>Or enter kit color / ID manually</div>
    <div style={{display:"flex",gap:8}}>
      <In value={manual} onChange={e=>setManual(e.target.value)} placeholder="Kit color, serial, or ID..."
        onKeyDown={e=>{if(e.key==="Enter")go()}} style={{flex:1}}/>
      <Bt v="primary" onClick={go} disabled={!manual.trim()}>Go</Bt></div>
    <div style={{display:"flex",justifyContent:"flex-end"}}><Bt onClick={onClose}>Cancel</Bt></div></div>);}

export default QRScanner;
