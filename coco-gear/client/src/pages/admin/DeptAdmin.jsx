import { useState, useMemo } from 'react';
import { T } from '../../theme/theme.js';
import { Bg, Bt, Fl, In, Sl, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

function DeptAdmin({depts,setDepts,personnel,kits,locs,onRefreshDepts}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",color:T.bl,site:"",headId:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const save=async()=>{if(!fm.name.trim())return;
    try{if(md==="add"){await api.departments.create({name:fm.name.trim(),color:fm.color,site:fm.site.trim()||null,headId:fm.headId||null})}
    else{await api.departments.update(md,{name:fm.name.trim(),color:fm.color,site:fm.site.trim()||null,headId:fm.headId||null})}
    await onRefreshDepts()}catch(e){alert(e.message)}setMd(null)};
  const confirmDelete=(dept)=>{const dKits=kits.filter(k=>k.deptId===dept.id);
    if(dKits.length>0){alert("Cannot delete: department has "+dKits.length+" kit(s) assigned");return}
    setDeleteConfirm(dept)};
  const doDelete=async()=>{if(deleteConfirm){try{await api.departments.delete(deleteConfirm.id);await onRefreshDepts()}catch(e){alert(e.message)}}};
  const dColors=["#60a5fa","#818cf8","#a78bfa","#f472b6","#fb923c","#4ade80","#2dd4bf","#fbbf24","#f87171","#22d3ee"];
  /* Group departments by site */
  const grouped=useMemo(()=>{const g={};depts.forEach(d=>{const s=d.site||"Unassigned Site";(g[s]=g[s]||[]).push(d)});
    return Object.entries(g).sort(([a],[b])=>a==="Unassigned Site"?1:b==="Unassigned Site"?-1:a.localeCompare(b))},[depts]);
  const siteNames=useMemo(()=>[...new Set(depts.map(d=>d.site).filter(Boolean))].sort(),[depts]);
  return(<div>
    <SH title="Departments" sub={depts.length+" departments"+(siteNames.length>0?" across "+siteNames.length+" site"+(siteNames.length>1?"s":""):"")} action={<Bt v="primary" onClick={()=>{setFm({name:"",color:T.bl,site:"",headId:""});setMd("add")}}>+ Add</Bt>}/>
    {grouped.map(([siteName,siteDepts])=><div key={siteName} style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <div style={{width:4,height:16,borderRadius:2,background:siteName==="Unassigned Site"?T.dm:T.bl}}/>
        <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:siteName==="Unassigned Site"?T.dm:T.bl,fontFamily:T.m,fontWeight:700}}>{siteName} ({siteDepts.length})</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:10}}>
      {siteDepts.map(d=>{const head=d.headId?personnel.find(p=>p.id===d.headId):null;const dKits=kits.filter(k=>k.deptId===d.id);const dPers=personnel.filter(p=>p.deptId===d.id);
        return(<div key={d.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,borderLeft:"3px solid "+d.color}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{d.name}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Head: {head?head.name:"Unassigned"}</div>
              {d.site&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>⌖ {d.site}</div>}</div>
            <div style={{display:"flex",gap:4}}><Bt v="ghost" sm onClick={()=>{setFm({name:d.name,color:d.color,site:d.site||"",headId:d.headId||""});setMd(d.id)}}>Edit</Bt>
              <Bt v="ghost" sm onClick={()=>confirmDelete(d)} style={{color:T.rd}} disabled={dKits.length>0}>Del</Bt></div></div>
          <div style={{display:"flex",gap:6}}><Bg color={d.color} bg={d.color+"18"}>{dKits.length} kits</Bg><Bg color={d.color} bg={d.color+"18"}>{dPers.length} members</Bg></div></div>)})}</div></div>)}
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Department":"Edit Department"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <Fl label="Site"><div style={{display:"flex",gap:8,alignItems:"center"}}>
          <In value={fm.site} onChange={e=>setFm(p=>({...p,site:e.target.value}))} placeholder="e.g. CA - San Diego, VA - Norfolk" style={{flex:1}}/>
          {siteNames.length>0&&<Sl options={[{v:"",l:"— Pick existing —"},...siteNames.map(s=>({v:s,l:s}))]} value="" onChange={e=>{if(e.target.value)setFm(p=>({...p,site:e.target.value}))}} style={{maxWidth:180}}/>}</div></Fl>
        <Fl label="Color"><div style={{display:"flex",gap:5}}>{dColors.map(c=><button key={c} onClick={()=>setFm(p=>({...p,color:c}))} style={{all:"unset",cursor:"pointer",width:24,height:24,borderRadius:5,background:c,border:fm.color===c?"2px solid #fff":"2px solid transparent"}}/>)}</div></Fl>
        <Fl label="Head"><Sl options={[{v:"",l:"-- Unassigned --"},...personnel.filter(p=>p.role!=="user").map(p=>({v:p.id,l:p.name}))]} value={fm.headId} onChange={e=>setFm(p=>({...p,headId:e.target.value}))}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Department?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? Personnel in this department will become unassigned.`}/></div>);}

export default DeptAdmin;
