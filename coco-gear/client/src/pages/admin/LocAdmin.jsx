import { useState } from 'react';
import { T } from '../../theme/theme.js';
import { Bt, Fl, In, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

function LocAdmin({locs,setLocs,kits,onRefreshLocs}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",sc:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const save=async()=>{if(!fm.name.trim())return;
    try{if(md==="add"){await api.locations.create({name:fm.name.trim(),shortCode:fm.sc.trim()||fm.name.trim().slice(0,4).toUpperCase()})}
    else{await api.locations.update(md,{name:fm.name.trim(),shortCode:fm.sc.trim()})}
    await onRefreshLocs()}catch(e){alert(e.message)}setMd(null)};
  const confirmDelete=(loc)=>{const n=kits.filter(k=>k.locId===loc.id).length;
    if(n>0){alert("Cannot delete: storage area has "+n+" kit(s)");return}
    setDeleteConfirm(loc)};
  const doDelete=async()=>{if(deleteConfirm){try{await api.locations.delete(deleteConfirm.id);await onRefreshLocs()}catch(e){alert(e.message)}}};
  return(<div>
    <SH title="Storage" sub={locs.length+" storage area"+(locs.length!==1?"s":"")} action={<Bt v="primary" onClick={()=>{setFm({name:"",sc:""});setMd("add")}}>+ Add</Bt>}/>
    <div style={{padding:10,borderRadius:8,background:"rgba(45,212,191,.03)",border:"1px solid rgba(45,212,191,.1)",marginBottom:14}}>
      <div style={{fontSize:10,color:T.tl,fontFamily:T.m}}>Storage areas are the physical places where kits are kept — cages, rooms, racks, vehicles, etc.</div></div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(240px,100%),1fr))",gap:8}}>
      {locs.map(l=>{const n=kits.filter(k=>k.locId===l.id).length;return(
        <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:32,height:32,borderRadius:6,background:"rgba(45,212,191,.08)",border:"1px solid rgba(45,212,191,.2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.tl,fontFamily:T.m}}>{l.sc.slice(0,3)}</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{l.name}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{n} kit{n!==1?"s":""}</div></div>
          <Bt v="ghost" sm onClick={()=>{setFm({name:l.name,sc:l.sc});setMd(l.id)}}>Edit</Bt>
          <Bt v="ghost" sm onClick={()=>confirmDelete(l)} style={{color:T.rd}} disabled={n>0}>Del</Bt></div>)})}</div>
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Storage Area":"Edit Storage Area"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))} placeholder="e.g. Cage A, Bldg 7 Rack 2, Vehicle Bay"/></Fl>
        <Fl label="Short Code"><In value={fm.sc} onChange={e=>setFm(p=>({...p,sc:e.target.value}))} placeholder="e.g. CGA, B7R2" style={{width:120}}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Storage Area?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}/></div>);}

export default LocAdmin;
