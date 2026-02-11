import { useState } from 'react';
import { T } from '../theme/theme.js';
import { expandComps, td } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Ta } from '../components/ui/index.js';
import SerialScanBtn from './SerialScanBtn.jsx';

function SerialEntryForm({kit,type,allC,existingSerials,mode,onDone,onCancel,settings}){
  const expanded=expandComps(type.compIds,type.compQtys||{});
  const cs=expanded.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);
  const needSer=(mode==="checkout"&&settings.requireSerialsOnCheckout)||(mode==="return"&&settings.requireSerialsOnReturn)||(mode==="inspect"&&settings.requireSerialsOnInspect);
  const serComps=needSer?cs.filter(c=>c.ser):[];
  const[serials,setSerials]=useState(()=>{const init={};serComps.forEach(c=>{init[c._key]=(existingSerials&&existingSerials[c._key])||""});return init});
  const[notes,setNotes]=useState("");
  const filled=serComps.every(c=>serials[c._key]&&serials[c._key].trim());
  const ml=mode==="checkout"?"Checkout":mode==="return"?"Return":"Inspection";
  const mc=mode==="checkout"?T.bl:mode==="return"?T.am:T.gn;
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Sw color={kit.color} size={30}/><div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{ml} - Kit {kit.color}</div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{type.name} | {td()}</div></div></div>
    {serComps.length>0&&<div>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:mc,fontFamily:T.m,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:mc}}/>Serialized Items ({serComps.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {serComps.map(c=>{const ex=existingSerials&&existingSerials[c._key];const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;return(
          <div key={c._key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:"rgba(251,191,36,.02)",border:"1px solid rgba(251,191,36,.1)"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:2}}>{lbl}</div>
              {ex&&mode!=="checkout"&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:3}}>Last: {ex}</div>}
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <In value={serials[c._key]} onChange={e=>setSerials(p=>({...p,[c._key]:e.target.value}))} placeholder="S/N" style={{fontSize:11,padding:"5px 9px",flex:1}}/>
                {c.qrScan!==false&&<SerialScanBtn onSerial={val=>setSerials(p=>({...p,[c._key]:val}))}/>}</div></div>
            <span style={{color:serials[c._key]?.trim()?T.gn:T.rd,fontSize:12,fontWeight:700}}>{serials[c._key]?.trim()?"✓":"--"}</span></div>)})}</div></div>}
    <Fl label="Notes"><Ta value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any notes..."/></Fl>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt>
      <Bt v={mode==="checkout"?"primary":mode==="return"?"warn":"success"} onClick={()=>onDone({serials,notes})} disabled={needSer&&!filled}>
        {needSer&&!filled?"Enter all S/N":"Confirm "+ml}</Bt></div></div>);}

export default SerialEntryForm;
