import { useState } from 'react';
import { T } from '../theme/theme.js';
import { expandComps } from '../theme/helpers.js';
import { Sw, Bt, In } from '../components/ui/index.js';

function SerialManageForm({kit,type,allC,onSave,onCancel}){
  const expanded=expandComps(type.compIds,type.compQtys||{});
  const cs=expanded.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);
  const serComps=cs.filter(c=>c.ser);
  const[serials,setSerials]=useState(()=>{const init={};serComps.forEach(c=>{init[c._key]=(kit.serials&&kit.serials[c._key])||""});return init});
  const[saving,setSaving]=useState(false);
  const hasChanges=serComps.some(c=>(serials[c._key]||"")!==(kit.serials[c._key]||""));
  const filledCount=serComps.filter(c=>serials[c._key]?.trim()).length;

  const genSerial=()=>{const ts=Date.now().toString(36).toUpperCase();const r=Math.random().toString(36).slice(2,6).toUpperCase();return"SN-"+ts+"-"+r};

  const autoGenAll=()=>{const next={};serComps.forEach(c=>{next[c._key]=serials[c._key]?.trim()||genSerial()});setSerials(next)};
  const autoGenEmpty=()=>{setSerials(p=>{const next={...p};serComps.forEach(c=>{if(!next[c._key]?.trim())next[c._key]=genSerial()});return next})};

  const handleSave=async()=>{setSaving(true);try{await onSave(serials)}finally{setSaving(false)}};

  if(!serComps.length)return(<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m}}>
    <div style={{fontSize:13,marginBottom:6}}>No serialized components</div>
    <div style={{fontSize:10}}>Mark components as "Serialized" in the component library to track serial numbers.</div></div>);

  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Sw color={kit.color} size={30}/><div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>Manage Serials - Kit {kit.color}</div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{type.name} | {filledCount}/{serComps.length} assigned</div></div></div>
    <div style={{display:"flex",gap:6}}>
      <Bt sm v="ind" onClick={autoGenEmpty}>Auto-generate empty</Bt>
      <Bt sm v="ghost" onClick={autoGenAll}>Auto-generate all</Bt></div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {serComps.map(c=>{const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;const orig=kit.serials[c._key]||"";const cur=serials[c._key]||"";const changed=cur!==orig;
        return(<div key={c._key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,
          background:changed?"rgba(129,140,248,.04)":"rgba(251,191,36,.02)",border:"1px solid "+(changed?"rgba(129,140,248,.15)":"rgba(251,191,36,.1)")}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:2}}>{lbl}</div>
            {orig&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:3}}>Current: {orig}</div>}
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              <In value={cur} onChange={e=>setSerials(p=>({...p,[c._key]:e.target.value}))} placeholder="Enter serial number" style={{fontSize:11,padding:"5px 9px",flex:1}}/>
              <button onClick={()=>setSerials(p=>({...p,[c._key]:genSerial()}))} title="Generate"
                style={{all:"unset",cursor:"pointer",padding:"4px 8px",borderRadius:5,fontSize:9,fontFamily:T.m,color:T.ind,border:"1px solid rgba(129,140,248,.2)",background:"rgba(129,140,248,.05)"}}>Gen</button>
              {cur&&<button onClick={()=>setSerials(p=>({...p,[c._key]:""}))} title="Clear"
                style={{all:"unset",cursor:"pointer",padding:"4px 8px",borderRadius:5,fontSize:9,fontFamily:T.m,color:T.rd,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.05)"}}>Clear</button>}</div></div>
          <span style={{color:cur?.trim()?changed?T.ind:T.gn:T.dm,fontSize:12,fontWeight:700,flexShrink:0}}>{cur?.trim()?changed?"*":"✓":"--"}</span></div>)})}</div>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end",alignItems:"center"}}>
      {hasChanges&&<span style={{fontSize:9,color:T.ind,fontFamily:T.m}}>Unsaved changes</span>}
      <Bt onClick={onCancel}>Cancel</Bt>
      <Bt v="primary" onClick={handleSave} disabled={!hasChanges||saving}>{saving?"Saving...":"Save Serials"}</Bt></div></div>);}

export default SerialManageForm;
