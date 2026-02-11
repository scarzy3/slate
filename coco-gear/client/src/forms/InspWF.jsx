import { useState, useMemo } from 'react';
import { T } from '../theme/theme.js';
import { expandComps, cSty, td, uid } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Ta } from '../components/ui/index.js';
import SerialScanBtn from './SerialScanBtn.jsx';

function InspWF({kit,type,allC,onDone,onCancel,settings,onPhotoAdd}){
  const expanded=expandComps(type.compIds,type.compQtys||{});
  const cs=expanded.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);const tot=cs.length;
  const[step,setStep]=useState(0);const[res,setRes]=useState(()=>{const init={};cs.forEach(c=>{init[c._key]=kit.comps[c._key]||"GOOD"});return init});
  const needSer=settings.requireSerialsOnInspect;const serComps=cs.filter(c=>c.ser);
  const[serials,setSerials]=useState(()=>{const init={};serComps.forEach(c=>{init[c._key]=(kit.serials&&kit.serials[c._key])||""});return init});
  const[notes,setNotes]=useState("");const[insp,setInsp]=useState("");const[photos,setPhotos]=useState([]);
  const isRev=step>=tot;const cur=cs[step];
  const mark=s=>{setRes(p=>({...p,[cur._key]:s}));if(step<tot-1)setTimeout(()=>setStep(p=>p+1),150);else setTimeout(()=>setStep(tot),150)};
  const counts=useMemo(()=>{const c={GOOD:0,MISSING:0,DAMAGED:0};cs.forEach(comp=>{c[res[comp._key]||"GOOD"]++});return c},[res,cs]);
  const allSerFilled=!needSer||serComps.every(c=>serials[c._key]?.trim());
  const handlePhoto=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();
    reader.onload=ev=>{setPhotos(p=>[...p,{id:uid(),data:ev.target.result,name:file.name,date:td()}])};reader.readAsDataURL(file)};
  const instLabel=c=>c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;
  if(tot===0)return <div style={{padding:20,textAlign:"center",color:T.mu}}>No components.</div>;
  if(isRev){const iss=cs.filter(c=>res[c._key]!=="GOOD");return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><Sw color={kit.color} size={30}/>
        <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>Review - Kit {kit.color}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{td()}</div></div></div>
      <div style={{display:"flex",gap:8}}>{Object.entries(counts).map(([k,v])=>{const s=cSty[k];return(
        <div key={k} style={{flex:1,padding:"10px 14px",borderRadius:8,background:s.bg,border:"1px solid "+s.bd,textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:s.fg,fontFamily:T.u}}>{v}</div>
          <div style={{fontSize:9,color:s.fg,fontFamily:T.m}}>{k}</div></div>)})}</div>
      {iss.length>0&&<div style={{display:"flex",flexDirection:"column",gap:3}}>
        {iss.map(c=>{const s=cSty[res[c._key]];return(
          <div key={c._key} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",borderRadius:6,background:s.bg,border:"1px solid "+s.bd}}>
            <span style={{color:s.fg,fontSize:11,fontWeight:700,width:20}}>{s.ic}</span>
            <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.m}}>{instLabel(c)}</span>
            <Bg color={s.fg} bg="transparent">{res[c._key]}</Bg></div>)})}</div>}
      {needSer&&serComps.length>0&&<div>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:8}}>Serials</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {serComps.map(c=>{const expected=kit.serials[c._key];const entered=serials[c._key];const match=entered&&expected&&entered===expected;const mismatch=entered&&expected&&entered!==expected;
            return(<div key={c._key} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,
              background:match?"rgba(34,197,94,.04)":mismatch?"rgba(239,68,68,.04)":"rgba(251,191,36,.02)",
              border:"1px solid "+(match?"rgba(34,197,94,.15)":mismatch?"rgba(239,68,68,.15)":"rgba(251,191,36,.08)")}}>
            <span style={{fontSize:9,color:T.mu,fontFamily:T.m,flex:1,minWidth:0}}>{instLabel(c)}</span>
            <In value={entered} onChange={e=>setSerials(p=>({...p,[c._key]:e.target.value}))} placeholder="S/N" style={{width:90,fontSize:9,padding:"3px 6px"}}/>
            {c.qrScan!==false&&<SerialScanBtn onSerial={val=>setSerials(p=>({...p,[c._key]:val}))}/>}
            {match&&<span style={{fontSize:10,color:T.gn,fontWeight:700,flexShrink:0}}>✓</span>}
            {mismatch&&<span style={{fontSize:10,color:T.rd,fontWeight:700,flexShrink:0}}>✗</span>}</div>)})}</div></div>}
      <div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:6}}>Photos ({photos.length})</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {photos.map(ph=><div key={ph.id} style={{width:60,height:60,borderRadius:6,background:`url(${ph.data}) center/cover`,border:"1px solid "+T.bd}}/>)}
          <label style={{width:60,height:60,borderRadius:6,background:T.card,border:"1px dashed "+T.bd,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,color:T.dm}}>
            +<input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/></label></div></div>
      <Fl label="Inspector"><In value={insp} onChange={e=>setInsp(e.target.value)} placeholder="Your name"/></Fl>
      <Fl label="Notes"><Ta value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></Fl>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt>
        <Bt v="success" onClick={()=>onDone({results:res,serials,notes,inspector:insp,date:td(),photos})} disabled={!allSerFilled}>
          {allSerFilled?"Complete":"Fill S/N first"}</Bt></div></div>)}
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1,height:3,borderRadius:2,background:T.card,overflow:"hidden"}}>
        <div style={{width:(step/tot*100)+"%",height:"100%",borderRadius:2,background:`linear-gradient(90deg,${T.bl},${T.ind})`,transition:"width .3s"}}/></div>
      <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{step+1}/{tot}</span></div>
    <div style={{textAlign:"center",padding:"10px 0"}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:4}}>{cur.cat}</div>
      <div style={{fontSize:20,fontWeight:700,fontFamily:T.u,color:T.tx}}>{instLabel(cur)}</div>
      {cur.ser&&needSer&&<div style={{marginTop:6}}><Bg color={T.am} bg="rgba(251,191,36,.08)">S/N Required</Bg></div>}</div>
    {cur.ser&&needSer&&<div style={{padding:"10px 16px",borderRadius:8,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.12)"}}>
      {kit.serials[cur._key]&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:6}}>Expected: <b style={{color:T.am}}>{kit.serials[cur._key]}</b></div>}
      <div style={{display:"flex",gap:6,alignItems:"center"}}><In value={serials[cur._key]||""} onChange={e=>setSerials(p=>({...p,[cur._key]:e.target.value}))} placeholder={"S/N for "+instLabel(cur)} style={{flex:1}}/>
        {cur.qrScan!==false&&<SerialScanBtn onSerial={val=>setSerials(p=>({...p,[cur._key]:val}))}/>}
        <Bt sm v={serials[cur._key]&&kit.serials[cur._key]&&serials[cur._key]===kit.serials[cur._key]?"success":serials[cur._key]&&kit.serials[cur._key]&&serials[cur._key]!==kit.serials[cur._key]?"danger":"ghost"}
          style={{padding:"6px 10px",fontSize:10,flexShrink:0}}>{serials[cur._key]?serials[cur._key]===kit.serials[cur._key]?"✓ Match":"✗ Mismatch":"Verify"}</Bt></div></div>}
    <div style={{display:"flex",gap:10,justifyContent:"center"}}>{Object.entries(cSty).map(([key,s])=>{const a=res[cur._key]===key;return(
      <button key={key} onClick={()=>mark(key)} style={{all:"unset",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,
        padding:"18px 24px",borderRadius:10,minWidth:90,background:a?s.bg:"rgba(255,255,255,.02)",border:a?"2px solid "+s.fg:"1px solid "+T.bd,transition:"all .15s"}}>
        <span style={{fontSize:20,fontWeight:700}}>{s.ic}</span>
        <span style={{fontSize:10,fontWeight:700,fontFamily:T.m,color:s.fg}}>{key}</span></button>)})}</div>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <Bt v="ghost" onClick={()=>step>0&&setStep(step-1)} disabled={step===0}>Back</Bt>
      <div style={{display:"flex",gap:6}}><Bt v="ghost" onClick={onCancel}>Cancel</Bt>
        <Bt v="primary" onClick={()=>setStep(step+1)}>{step===tot-1?"Review":"Skip"}</Bt></div></div></div>);}

export default InspWF;
