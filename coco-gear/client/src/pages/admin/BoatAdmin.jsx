import { useState } from 'react';
import { T } from '../../theme/theme.js';
import { Bg, Bt, Fl, In, Sl, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

/* ═══════════ USV ADMIN ═══════════ */
function BoatAdmin({boats,onRefreshBoats,settings}){
  const bf=settings?.boatFields||{type:true,hullId:true,length:true,homePort:true,notes:true};
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",type:"",hullId:"",length:"",homePort:"",status:"available",notes:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const statusColors={available:T.gn,maintenance:T.am,decommissioned:T.rd};
  const statusLabels={available:"Available",maintenance:"Maintenance",decommissioned:"Decommissioned"};
  const save=async()=>{if(!fm.name.trim())return;
    try{const payload={name:fm.name.trim(),type:fm.type.trim(),hullId:fm.hullId.trim(),
      length:fm.length?parseFloat(fm.length):null,homePort:fm.homePort.trim(),status:fm.status,notes:fm.notes.trim()};
      if(md==="add"){await api.boats.create(payload)}
      else{await api.boats.update(md,payload)}
      await onRefreshBoats()}catch(e){alert(e.message)}setMd(null)};
  const confirmDelete=(boat)=>{
    const activeTrips=boat.trips?.filter(t=>t.tripStatus==="active"||t.tripStatus==="planning")||[];
    if(activeTrips.length>0){alert("Cannot delete: USV is assigned to "+activeTrips.length+" active trip(s)");return}
    setDeleteConfirm(boat)};
  const doDelete=async()=>{if(deleteConfirm){try{await api.boats.delete(deleteConfirm.id);await onRefreshBoats()}catch(e){alert(e.message)}}};
  const emptyFm=()=>({name:"",type:"",hullId:"",length:"",homePort:"",status:"available",notes:""});
  const detailParts=b=>[bf.type&&b.type,bf.hullId&&b.hullId,bf.length&&b.length&&b.length+" m"].filter(Boolean).join(" · ");
  return(<div>
    <SH title="USVs" sub={boats.length+" vessel"+(boats.length!==1?"s":"")} action={<Bt v="primary" onClick={()=>{setFm(emptyFm());setMd("add")}}>+ Add USV</Bt>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:8}}>
      {boats.map(b=>{const activeTrips=b.trips?.filter(t=>t.tripStatus==="active"||t.tripStatus==="planning")||[];return(
        <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:36,height:36,borderRadius:8,background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>⛵</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{b.name}</div>
            {detailParts(b)&&<div style={{fontSize:10,color:T.dm,fontFamily:T.m}}>{detailParts(b)}</div>}
            <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
              <Bg color={statusColors[b.status]} bg={(statusColors[b.status])+"18"}>{statusLabels[b.status]}</Bg>
              {bf.homePort&&b.homePort&&<Bg color={T.mu} bg="rgba(148,163,184,.1)">{b.homePort}</Bg>}
              {activeTrips.length>0&&<Bg color={T.ind} bg="rgba(129,140,248,.1)">{activeTrips.length} trip{activeTrips.length!==1?"s":""}</Bg>}</div></div>
          <Bt v="ghost" sm onClick={()=>{setFm({name:b.name,type:b.type,hullId:b.hullId,length:b.length||"",homePort:b.homePort,status:b.status,notes:b.notes});setMd(b.id)}}>Edit</Bt>
          <Bt v="ghost" sm onClick={()=>confirmDelete(b)} style={{color:T.rd}}>Del</Bt></div>)})}</div>
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add USV":"Edit USV"} wide>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="USV Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))} placeholder="e.g. WAM-V 16"/></Fl>
        {(bf.type||bf.hullId)&&<div className="slate-resp" style={{display:"grid",gridTemplateColumns:bf.type&&bf.hullId?"1fr 1fr":"1fr",gap:12}}>
          {bf.type&&<Fl label="Type"><In value={fm.type} onChange={e=>setFm(p=>({...p,type:e.target.value}))} placeholder="e.g. WAM-V, Heron, Sailbuoy"/></Fl>}
          {bf.hullId&&<Fl label="Hull / Serial #"><In value={fm.hullId} onChange={e=>setFm(p=>({...p,hullId:e.target.value}))}/></Fl>}</div>}
        {(bf.length||bf.homePort)&&<div className="slate-resp" style={{display:"grid",gridTemplateColumns:bf.length&&bf.homePort?"1fr 1fr":"1fr",gap:12}}>
          {bf.length&&<Fl label="Length (m)"><In type="number" step="0.1" value={fm.length} onChange={e=>setFm(p=>({...p,length:e.target.value}))}/></Fl>}
          {bf.homePort&&<Fl label="Home Port"><In value={fm.homePort} onChange={e=>setFm(p=>({...p,homePort:e.target.value}))}/></Fl>}</div>}
        <Fl label="Status"><Sl options={[{v:"available",l:"Available"},{v:"maintenance",l:"Maintenance"},{v:"decommissioned",l:"Decommissioned"}]}
          value={fm.status} onChange={e=>setFm(p=>({...p,status:e.target.value}))}/></Fl>
        {bf.notes&&<Fl label="Notes"><In value={fm.notes} onChange={e=>setFm(p=>({...p,notes:e.target.value}))} placeholder="Any notes about this USV..."/></Fl>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add USV":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete USV?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}/></div>);}

export default BoatAdmin;
