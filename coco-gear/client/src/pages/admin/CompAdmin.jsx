import { useState, useMemo } from 'react';
import { T } from '../../theme/theme.js';
import { CATS } from '../../theme/helpers.js';
import { Bg, Bt, Fl, In, Sl, Tg, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

function CompAdmin({comps,setComps,types,onRefreshComps}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({key:"",label:"",cat:"Comms",ser:false,qrScan:true,calibrationRequired:false,calibrationIntervalDays:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const grouped=useMemo(()=>{const g={};comps.forEach(c=>{(g[c.cat]=g[c.cat]||[]).push(c)});return g},[comps]);
  const save=async()=>{if(!fm.label.trim())return;
    const k=fm.key.trim()||fm.label.trim().replace(/[^a-zA-Z0-9]/g,"").replace(/^./,ch=>ch.toLowerCase());
    try{const payload={key:md==="add"?k:fm.key,label:fm.label.trim(),category:fm.cat,serialized:fm.ser,qrScannable:fm.ser?fm.qrScan:true,calibrationRequired:fm.calibrationRequired,calibrationIntervalDays:fm.calibrationRequired?Number(fm.calibrationIntervalDays):null};
    if(md==="add"){await api.components.create(payload)}
    else{await api.components.update(md,payload)}
    await onRefreshComps()}catch(e){alert(e.message)}
    setMd(null)};
  const confirmDelete=(comp)=>{const inUse=types?.filter(t=>t.compIds.includes(comp.id)).length||0;
    if(inUse>0){alert("Cannot delete: component is used in "+inUse+" kit type(s)");return}
    setDeleteConfirm(comp)};
  const doDelete=async()=>{if(deleteConfirm){try{await api.components.delete(deleteConfirm.id);await onRefreshComps()}catch(e){alert(e.message)}}};
  return(<div>
    <SH title="Components" sub={comps.length+" items | "+comps.filter(c=>c.ser).length+" serialized"}
      action={<Bt v="primary" onClick={()=>{setFm({key:"",label:"",cat:"Comms",ser:false,qrScan:true,calibrationRequired:false,calibrationIntervalDays:""});setMd("add")}}>+ Add</Bt>}/>
    {Object.entries(grouped).map(([cat,items])=><div key={cat} style={{marginBottom:20}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>{cat} ({items.length})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:6}}>
        {items.map(c=>{const inUse=types?.filter(t=>t.compIds.includes(c.id)).length||0;return(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:6,height:6,borderRadius:3,background:c.ser?T.am:T.ind,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{c.label}</span>
              {c.ser&&<Bg color={T.am} bg="rgba(251,191,36,.08)">S/N</Bg>}
              {c.ser&&!c.qrScan&&<Bg color={T.dm} bg="rgba(255,255,255,.04)">No QR</Bg>}
              {c.calibrationRequired&&<Bg color={T.tl} bg="rgba(45,212,191,.08)">CAL</Bg>}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{c.key}{inUse>0&&` • ${inUse} type(s)`}</div></div>
          <Bt v="ghost" sm onClick={()=>{setFm({key:c.key,label:c.label,cat:c.cat,ser:!!c.ser,qrScan:c.qrScan!==false,calibrationRequired:!!c.calibrationRequired,calibrationIntervalDays:c.calibrationIntervalDays||""});setMd(c.id)}}>Edit</Bt>
          <Bt v="ghost" sm onClick={()=>confirmDelete(c)} style={{color:T.rd}} disabled={inUse>0}>Del</Bt></div>)})}</div></div>)}
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Component":"Edit Component"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Label"><In value={fm.label} onChange={e=>setFm(p=>({...p,label:e.target.value}))} placeholder="e.g. Silvus 4200"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Short ID" hint="Auto-generated from label if blank"><In value={fm.key} onChange={e=>setFm(p=>({...p,key:e.target.value}))} placeholder="auto"/></Fl>
          <Fl label="Category"><Sl options={CATS} value={fm.cat} onChange={e=>setFm(p=>({...p,cat:e.target.value}))}/></Fl></div>
        <div style={{display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Tg checked={fm.ser} onChange={v=>setFm(p=>({...p,ser:v}))}/>
            <span style={{fontSize:11,color:fm.ser?T.am:T.mu,fontFamily:T.m}}>Serialized</span></div>
          {fm.ser&&<div style={{display:"flex",alignItems:"center",gap:8}}><Tg checked={fm.qrScan} onChange={v=>setFm(p=>({...p,qrScan:v}))}/>
            <span style={{fontSize:11,color:fm.qrScan?T.bl:T.mu,fontFamily:T.m}}>QR Scannable</span></div>}
          <div style={{display:"flex",alignItems:"center",gap:8}}><Tg checked={fm.calibrationRequired} onChange={v=>setFm(p=>({...p,calibrationRequired:v}))}/>
            <span style={{fontSize:11,color:fm.calibrationRequired?T.tl:T.mu,fontFamily:T.m}}>Requires Calibration</span></div></div>
        {fm.ser&&!fm.qrScan&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,padding:"4px 8px",borderRadius:4,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.08)"}}>
          QR scan disabled — serial number will be entered manually only (e.g. small components like NVGs)</div>}
        {fm.calibrationRequired&&<Fl label="Calibration Interval (days)"><In type="number" value={fm.calibrationIntervalDays} onChange={e=>setFm(p=>({...p,calibrationIntervalDays:e.target.value}))} placeholder="365"/></Fl>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Component?" message={`Are you sure you want to delete "${deleteConfirm?.label}"? This action cannot be undone.`}/></div>);}

export default CompAdmin;
