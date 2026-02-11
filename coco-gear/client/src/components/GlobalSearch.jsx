import { useState, useMemo } from 'react';
import { T } from '../theme/theme.js';
import In from './ui/In.jsx';

function GlobalSearch({kits,personnel,locs,depts,types,comps,onSelect,onClose}){
  const[q,setQ]=useState("");
  const results=useMemo(()=>{if(!q.trim())return[];const s=q.toLowerCase();const r=[];
    kits.forEach(k=>{if(k.color.toLowerCase().includes(s)||Object.values(k.fields).some(v=>String(v).toLowerCase().includes(s))||Object.values(k.serials).some(v=>v?.toLowerCase().includes(s)))
      r.push({type:"kit",item:k,label:`Kit ${k.color}`,sub:types.find(t=>t.id===k.typeId)?.name})});
    personnel.forEach(p=>{if(p.name.toLowerCase().includes(s)||p.title?.toLowerCase().includes(s))
      r.push({type:"person",item:p,label:`${p.name}`})});
    locs.forEach(l=>{if(l.name.toLowerCase().includes(s)||l.sc.toLowerCase().includes(s))
      r.push({type:"location",item:l,label:l.name,sub:l.sc})});
    depts.forEach(d=>{if(d.name.toLowerCase().includes(s))r.push({type:"dept",item:d,label:d.name,sub:"Department"})});
    return r.slice(0,15)},[q,kits,personnel,locs,depts,types]);
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    <In value={q} onChange={e=>setQ(e.target.value)} placeholder="Search kits, people, storage, serials..." autoFocus style={{fontSize:14,padding:"12px 16px"}}/>
    {results.length>0?<div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:400,overflowY:"auto"}}>
      {results.map((r,i)=><button key={i} onClick={()=>{onSelect(r);onClose()}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
        padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{width:24,height:24,borderRadius:6,background:r.type==="kit"?T.ind+"22":r.type==="person"?T.pk+"22":T.tl+"22",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:r.type==="kit"?T.ind:r.type==="person"?T.pk:T.tl,fontFamily:T.m}}>
          {r.type==="kit"?"K":r.type==="person"?"P":"L"}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{r.label}</div>
          <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{r.sub}</div></div></button>)}</div>
      :q.trim()&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m}}>No results for "{q}"</div>}</div>);}

export default GlobalSearch;
