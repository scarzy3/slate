import { useState, useMemo } from 'react';
import { T } from '../../theme/theme.js';
import { Bg, Bt, Fl, In, Sl, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

function TypeAdmin({types,setTypes,comps,kits,depts,onRefreshTypes}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",desc:"",compIds:[],compQtys:{},fields:[],deptIds:[]});const[fd,setFd]=useState({key:"",label:"",type:"text"});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const grouped=useMemo(()=>{const g={};comps.forEach(c=>{(g[c.cat]=g[c.cat]||[]).push(c)});return g},[comps]);
  const togC=cid=>{setFm(p=>{if(p.compIds.includes(cid)){const nq={...p.compQtys};delete nq[cid];return{...p,compIds:p.compIds.filter(x=>x!==cid),compQtys:nq}}return{...p,compIds:[...p.compIds,cid]}})};
  const setCompQty=(cid,val)=>{const n=Math.max(1,parseInt(val)||1);setFm(p=>({...p,compQtys:n>1?{...p.compQtys,[cid]:n}:Object.fromEntries(Object.entries(p.compQtys).filter(([k])=>k!==cid))}))};
  const addField=()=>{if(!fd.label.trim())return;const k=fd.key.trim()||fd.label.trim().replace(/[^a-zA-Z0-9]/g,"").replace(/^./,ch=>ch.toLowerCase());
    setFm(p=>({...p,fields:[...p.fields,{key:k,label:fd.label.trim(),type:fd.type}]}));setFd({key:"",label:"",type:"text"})};
  const totalExpanded=(ids,qtys)=>ids.reduce((s,id)=>s+(qtys[id]||1),0);
  const save=async()=>{if(!fm.name.trim())return;
    const components=fm.compIds.map(id=>({componentId:id,quantity:fm.compQtys[id]||1}));
    try{if(md==="add"){await api.types.create({name:fm.name.trim(),desc:fm.desc.trim(),components,fields:fm.fields,deptIds:fm.deptIds||[]})}
    else{await api.types.update(md,{name:fm.name.trim(),desc:fm.desc.trim(),components,fields:fm.fields,deptIds:fm.deptIds||[]})}
    await onRefreshTypes()}catch(e){alert(e.message)}setMd(null)};
  const confirmDelete=(type)=>{const n=kits?.filter(k=>k.typeId===type.id).length||0;
    if(n>0){alert("Cannot delete: "+n+" kit(s) use this type");return}
    setDeleteConfirm(type)};
  const doDelete=async()=>{if(deleteConfirm){try{await api.types.delete(deleteConfirm.id);await onRefreshTypes()}catch(e){alert(e.message)}}};
  return(<div>
    <SH title="Kit Types" sub={types.length+" templates"} action={<Bt v="primary" onClick={()=>{setFm({name:"",desc:"",compIds:[],compQtys:{},fields:[],deptIds:[]});setMd("add")}}>+ Add</Bt>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:12}}>
      {types.map(t=>{const sc=t.compIds.filter(id=>comps.find(c=>c.id===id&&c.ser)).length;const inUse=kits?.filter(k=>k.typeId===t.id).length||0;const tc=totalExpanded(t.compIds,t.compQtys||{});return(
        <div key={t.id} style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{t.name}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:2}}>{t.desc||"No description"}</div></div>
            <div style={{display:"flex",gap:4}}><Bt v="ghost" sm onClick={()=>{setFm({name:t.name,desc:t.desc,compIds:[...t.compIds],compQtys:{...(t.compQtys||{})},fields:t.fields.map(f=>({...f})),deptIds:[...(t.deptIds||[])]});setMd(t.id)}}>Edit</Bt>
              <Bt v="ghost" sm onClick={()=>confirmDelete(t)} style={{color:T.rd}} disabled={inUse>0}>Del</Bt></div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Bg color={T.ind} bg="rgba(129,140,248,.1)">{tc} items ({t.compIds.length} types)</Bg>
            {sc>0&&<Bg color={T.am} bg="rgba(251,191,36,.08)">{sc} serialized</Bg>}
            <Bg color={T.tl} bg="rgba(45,212,191,.1)">{t.fields.length} fields</Bg>
            {inUse>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{inUse} kits</Bg>}
            {(t.deptIds||[]).map(did=>{const dept=depts.find(d=>d.id===did);return dept?<Bg key={did} color={dept.color} bg={dept.color+"18"}>{dept.name}</Bg>:null})}</div></div>)})}</div>
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Create Kit Type":"Edit Kit Type"} wide>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
          <Fl label="Description"><In value={fm.desc} onChange={e=>setFm(p=>({...p,desc:e.target.value}))}/></Fl></div>
        <div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:8}}>Components ({totalExpanded(fm.compIds,fm.compQtys)} items, {fm.compIds.length} types)</div>
          {Object.entries(grouped).map(([cat,items])=><div key={cat} style={{marginBottom:10}}>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginBottom:4,textTransform:"uppercase"}}>{cat}</div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
              {items.map(c=>{const s=fm.compIds.includes(c.id);const q=fm.compQtys[c.id]||1;return(
                <div key={c.id} style={{display:"flex",alignItems:"center",gap:2}}>
                  <button onClick={()=>togC(c.id)} style={{all:"unset",cursor:"pointer",padding:"4px 10px",borderRadius:s&&q>1?"5px 0 0 5px":5,fontSize:10,fontFamily:T.m,
                    background:s?"rgba(129,140,248,.15)":"rgba(255,255,255,.02)",border:s?"1px solid rgba(129,140,248,.35)":"1px solid "+T.bd,color:s?T.ind:T.mu}}>
                    {s?"✓ ":""}{c.label}{s&&q>1?" x"+q:""}</button>
                  {s&&<div style={{display:"flex",alignItems:"center",background:"rgba(129,140,248,.08)",border:"1px solid rgba(129,140,248,.35)",borderLeft:"none",borderRadius:"0 5px 5px 0",overflow:"hidden"}}>
                    <button onClick={()=>setCompQty(c.id,q-1)} style={{all:"unset",cursor:"pointer",padding:"4px 6px",fontSize:10,color:q>1?T.ind:T.dm,fontFamily:T.m}}>-</button>
                    <span style={{fontSize:10,fontFamily:T.m,color:T.ind,minWidth:14,textAlign:"center"}}>{q}</span>
                    <button onClick={()=>setCompQty(c.id,q+1)} style={{all:"unset",cursor:"pointer",padding:"4px 6px",fontSize:10,color:T.ind,fontFamily:T.m}}>+</button></div>}
                </div>)})}</div></div>)}</div>
        <div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:8}}>Custom Fields ({fm.fields.length})</div>
          {fm.fields.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",borderRadius:6,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
            <span style={{fontSize:11,color:T.tx,fontFamily:T.m,flex:1}}>{f.label}</span><Bg>{f.type}</Bg>
            <Bt v="ghost" sm onClick={()=>setFm(p=>({...p,fields:p.fields.filter((_,j)=>j!==i)}))} style={{color:T.rd}}>×</Bt></div>)}
          <div style={{display:"flex",gap:6,marginTop:6,alignItems:"flex-end"}}>
            <Fl label="Label"><In value={fd.label} onChange={e=>setFd(p=>({...p,label:e.target.value}))} style={{width:180}}/></Fl>
            <Fl label="Type"><Sl options={["text","number","toggle"]} value={fd.type} onChange={e=>setFd(p=>({...p,type:e.target.value}))}/></Fl>
            <Bt v="ind" sm onClick={addField}>+ Add</Bt></div></div>
        {depts.length>0&&<div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:8}}>Departments ({(fm.deptIds||[]).length} assigned)</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {depts.map(d=>{const s=(fm.deptIds||[]).includes(d.id);return(
              <button key={d.id} onClick={()=>setFm(p=>({...p,deptIds:s?(p.deptIds||[]).filter(x=>x!==d.id):[...(p.deptIds||[]),d.id]}))}
                style={{all:"unset",cursor:"pointer",padding:"4px 12px",borderRadius:5,fontSize:10,fontFamily:T.m,
                  background:s?d.color+"22":"rgba(255,255,255,.02)",border:"1px solid "+(s?d.color+"55":T.bd),color:s?d.color:T.mu}}>
                {s?"✓ ":""}{d.name}</button>)})}</div></div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Create":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Kit Type?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This template will no longer be available for new kits.`}/></div>);}

export default TypeAdmin;
