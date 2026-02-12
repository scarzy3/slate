import { useState, useMemo, useEffect } from 'react';
import { T, CM } from '../theme/theme.js';
import { stMeta, cSty, expandComps, fmtDate, daysAgo, now } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Sl, Tg, SH, Tabs, ModalWrap, DeptBg } from '../components/ui/index.js';
import QRSvg from '../components/qr/QRSvg.jsx';
import QRPrintSheet from '../components/qr/QRPrintSheet.jsx';
import QRDetailView from '../components/qr/QRDetailView.jsx';
import { qrKitData } from '../components/qr/qrHelpers.js';
import SerialManageForm from '../forms/SerialManageForm.jsx';
import InspWF from '../forms/InspWF.jsx';
import api from '../api.js';

function KitInv({kits,setKits,types,locs,comps:allC,personnel,depts,isAdmin,isSuper,settings,favorites,setFavorites,addLog,curUserId,initialFilter="all",onFilterChange,analytics,onRefreshKits,initialSelectedKit,onClearSelectedKit,initialAction,onClearAction,apiInspect,isMobile,apiSendMaint,apiResolveDegraded}){
  const userPerson=personnel.find(p=>p.id===curUserId);const userDeptId=userPerson?.deptId;
  const[selId,setSelId]=useState(initialSelectedKit||null);const[md,setMd]=useState(null);const[histExp,setHistExp]=useState(null);const[search,setSearch]=useState("");const[lf,setLf]=useState("ALL");
  const[df,setDf]=useState(()=>userDeptId&&!isSuper?userDeptId:"ALL");
  const[statusFilter,setStatusFilter]=useState(initialFilter);
  const[kf,setKf]=useState(null);const sel=kits.find(k=>k.id===selId);

  /* Sync with external filter */
  useEffect(()=>{setStatusFilter(initialFilter)},[initialFilter]);
  /* Navigate to specific kit from external source (QR scan etc) */
  useEffect(()=>{if(initialSelectedKit){setSelId(initialSelectedKit);if(onClearSelectedKit)onClearSelectedKit()}},[initialSelectedKit]);
  /* Auto-open action modal (e.g. inspect) when navigated from alerts */
  useEffect(()=>{if(initialAction&&initialSelectedKit){
    if(initialAction==="inspect"){setMd("insp:"+initialSelectedKit)}
    if(onClearAction)onClearAction()}},[initialAction,initialSelectedKit]);
  const changeStatusFilter=(f)=>{setStatusFilter(f);if(onFilterChange)onFilterChange(f)};

  const openAdd=()=>{const ft=types[0];setKf({typeId:ft?.id||"",color:"BLACK",locId:locs[0]?.id||"",fields:{},deptId:""});setMd("addK")};
  const saveK=async()=>{if(!kf)return;
    try{if(md==="addK"){await api.kits.create({typeId:kf.typeId,color:kf.color,locId:kf.locId,deptId:kf.deptId||null,fields:kf.fields})}
    else{await api.kits.update(md,{typeId:kf.typeId,color:kf.color,locId:kf.locId,deptId:kf.deptId||null,fields:kf.fields})}
    if(onRefreshKits)await onRefreshKits()}catch(e){alert(e.message)}
    setMd(null);setKf(null)};
  const doneInsp=async data=>{const kid=String(md).split(":")[1];
    try{await apiInspect(kid,"",data.notes,data.results)}catch(e){/* apiInspect logs error */}
    setMd(null)};

  const getDegradedComps=kit=>{const ty=types.find(t=>t.id===kit.typeId);const critIds=ty?.criticalCompIds||[];
    return Object.entries(kit.comps||{}).filter(([k,s])=>s!=="GOOD"&&critIds.includes(k.split("#")[0])).map(([k,s])=>{const c=allC.find(x=>x.id===k.split("#")[0]);return{key:k,status:s,label:c?.label||"?"}})};
  const doResolveDegraded=async(kitId)=>{try{await apiResolveDegraded(kitId)}catch(e){}};
  const doSendDegradedMaint=async(kitId)=>{try{await apiSendMaint(kitId,"repair","Critical component degraded","")}catch(e){}};

  /* Get overdue kit IDs from analytics if available */
  const overdueIds=useMemo(()=>new Set((analytics?.overdueReturns||[]).map(k=>k.id)),[analytics]);
  const maintIds=useMemo(()=>new Set((analytics?.inMaintenance||[]).map(k=>k.id)),[analytics]);

  const filt=useMemo(()=>kits.filter(k=>{
    /* Status filter */
    if(statusFilter==="issued"&&!k.issuedTo)return false;
    if(statusFilter==="available"&&(k.issuedTo||k.maintenanceStatus||k.degraded))return false;
    if(statusFilter==="degraded"&&!k.degraded)return false;
    if(statusFilter==="maintenance"&&!k.maintenanceStatus)return false;
    if(statusFilter==="overdue"&&!overdueIds.has(k.id))return false;
    /* Department filter */
    if(df!=="ALL"&&k.deptId!==df)return false;
    /* Location filter */
    if(lf!=="ALL"&&k.locId!==lf)return false;
    /* Search filter */
    if(!search)return true;const q=search.toLowerCase();const lo=locs.find(l=>l.id===k.locId);
    return k.color.toLowerCase().includes(q)||(lo?.name||"").toLowerCase().includes(q)||Object.values(k.fields).some(v=>String(v).toLowerCase().includes(q))||Object.values(k.serials).some(v=>v?.toLowerCase().includes(q))}),[kits,lf,df,search,locs,statusFilter,overdueIds]);
  const lc=useMemo(()=>{const c={};kits.forEach(k=>{c[k.locId]=(c[k.locId]||0)+1});return c},[kits]);
  const cType=kf?types.find(t=>t.id===kf.typeId):null;const canInspect=true;
  const toggleFav=id=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);

  /* Status filter counts */
  const issuedCt=kits.filter(k=>k.issuedTo).length;
  const degradedCt=kits.filter(k=>k.degraded).length;
  const availCt=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus&&!k.degraded).length;
  const maintCt=kits.filter(k=>k.maintenanceStatus).length;
  const overdueCt=overdueIds.size;

  return(<div>
    <SH title="Kit Inventory" sub={kits.length+" kits"} action={<div style={{display:"flex",gap:6}}>
      {settings.enableQR!==false&&<Bt sm v="ind" onClick={()=>setMd("qr-bulk")}>Print QR Codes</Bt>}
      {(isAdmin||isSuper)&&<Bt v="primary" onClick={openAdd} disabled={!types.length}>+ Add Kit</Bt>}</div>}/>

    {/* Status filter tabs */}
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {[{id:"all",l:"All",ct:kits.length,c:T.bl},{id:"available",l:"Available",ct:availCt,c:T.gn},{id:"degraded",l:"Degraded",ct:degradedCt,c:T.or},{id:"issued",l:"Checked Out",ct:issuedCt,c:T.pk},
        {id:"maintenance",l:"Maintenance",ct:maintCt,c:T.am},{id:"overdue",l:"Overdue",ct:overdueCt,c:T.rd}].map(s=>
        <button key={s.id} onClick={()=>changeStatusFilter(s.id)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:6,fontSize:10,fontFamily:T.m,
          background:statusFilter===s.id?s.c+"22":"transparent",color:statusFilter===s.id?s.c:T.mu,border:"1px solid "+(statusFilter===s.id?s.c+"44":T.bd),
          fontWeight:statusFilter===s.id?600:400,transition:"all .12s"}}>{s.l} ({s.ct})</button>)}</div>

    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search kits, serials..." style={{width:200,maxWidth:"100%"}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        <button onClick={()=>setLf("ALL")} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,fontWeight:600,
          background:lf==="ALL"?"rgba(255,255,255,.08)":"transparent",color:lf==="ALL"?T.tx:T.mu,border:"1px solid "+(lf==="ALL"?T.bdH:T.bd)}}>ALL ({kits.length})</button>
        {locs.map(l=><button key={l.id} onClick={()=>setLf(lf===l.id?"ALL":l.id)} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,
          background:lf===l.id?"rgba(255,255,255,.08)":"transparent",color:lf===l.id?T.tx:T.mu,border:"1px solid "+(lf===l.id?T.bdH:T.bd)}}>{l.sc} ({lc[l.id]||0})</button>)}</div>
      {depts.length>1&&<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        <button onClick={()=>setDf("ALL")} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,fontWeight:600,
          background:df==="ALL"?"rgba(255,255,255,.08)":"transparent",color:df==="ALL"?T.tx:T.mu,border:"1px solid "+(df==="ALL"?T.bdH:T.bd)}}>All Depts</button>
        {depts.map(d=>{const ct=kits.filter(k=>k.deptId===d.id).length;return <button key={d.id} onClick={()=>setDf(df===d.id?"ALL":d.id)} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,
          background:df===d.id?d.color+"22":"transparent",color:df===d.id?d.color:T.mu,border:"1px solid "+(df===d.id?d.color+"55":T.bd)}}>{d.name} ({ct})</button>})}</div>}</div>
    <div className="slate-grid-side" style={{display:"grid",gridTemplateColumns:sel&&!isMobile?"1fr 360px":"1fr",gap:0}}>
      <div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(240px,100%),1fr))",gap:8}}>
        {filt.map(kit=>{const st=stMeta(kit.lastChecked);const ty=types.find(t=>t.id===kit.typeId);const lo=locs.find(l=>l.id===kit.locId);
          const cEx=ty?expandComps(ty.compIds,ty.compQtys||{}):[];const iss=cEx.filter(e=>kit.comps[e.key]&&kit.comps[e.key]!=="GOOD");const isSel=selId===kit.id;
          const person=kit.issuedTo?personnel.find(p=>p.id===kit.issuedTo):null;const dept=kit.deptId?depts.find(d=>d.id===kit.deptId):null;const isFav=favorites.includes(kit.id);
          return(<button key={kit.id} onClick={()=>setSelId(isSel?null:kit.id)} style={{all:"unset",cursor:"pointer",display:"flex",flexDirection:"column",gap:8,
            padding:12,borderRadius:8,background:isSel?"rgba(255,255,255,.06)":T.card,border:"1px solid "+(isSel?T.bdH:T.bd),transition:"all .12s"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Sw color={kit.color}/><div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13,fontWeight:700,color:T.tx,fontFamily:T.u}}>{kit.color}</span>
                  {isFav&&<span style={{color:T.am,fontSize:12}}>★</span>}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{lo?.name||"?"}</div></div>
              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><Bg color={st.fg} bg={st.bg}>{st.tag}</Bg>
                {iss.length>0&&<Bg color={T.am} bg="rgba(251,191,36,.08)">!{iss.length}</Bg>}</div></div>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {ty&&<Bg color={T.ind} bg="rgba(129,140,248,.08)">{ty.name}</Bg>}
              {kit.maintenanceStatus?<Bg color={T.am} bg="rgba(251,191,36,.08)">Maint</Bg>:kit.degraded?<Bg color={T.or} bg="rgba(249,115,22,.08)">Degraded</Bg>:person?<Bg color={T.pk} bg="rgba(244,114,182,.06)">{person.title}</Bg>:<Bg color={T.gn} bg="rgba(34,197,94,.05)">Avail</Bg>}
              {dept&&<DeptBg dept={dept}/>}{kit._trip&&<Bg color={T.pu} bg="rgba(168,85,247,.08)">▸ {kit._trip.name}</Bg>}</div>
            {cEx.length>0&&<div style={{display:"flex",gap:1}}>{cEx.map(e=>{const s=cSty[kit.comps[e.key]||"GOOD"];return <div key={e.key} style={{flex:1,height:2.5,borderRadius:1,background:s.fg,opacity:.55}}/>})}</div>}</button>)})}</div>
        {!filt.length&&<div style={{padding:40,textAlign:"center",color:T.dm,fontFamily:T.m}}>No kits</div>}</div>
      {sel&&!isMobile&&(()=>{const ty=types.find(t=>t.id===sel.typeId);const lo=locs.find(l=>l.id===sel.locId);const st=stMeta(sel.lastChecked);
        const cEx=ty?expandComps(ty.compIds,ty.compQtys||{}):[];
        const cs=cEx.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);
        const person=sel.issuedTo?personnel.find(p=>p.id===sel.issuedTo):null;
        const serComps=cs.filter(c=>c.ser);const dept=sel.deptId?depts.find(d=>d.id===sel.deptId):null;const isFav=favorites.includes(sel.id);
        return(<div style={{borderLeft:"1px solid "+T.bd,padding:"18px 20px",overflowY:"auto",background:"rgba(255,255,255,.008)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><Sw color={sel.color} size={34}/>
              <div><div style={{fontSize:18,fontWeight:700,fontFamily:T.u,color:T.tx}}>Kit {sel.color}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{ty?.name} | {lo?.name}</div></div></div>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>toggleFav(sel.id)} style={{all:"unset",cursor:"pointer",fontSize:16,color:isFav?T.am:T.dm}}>{isFav?"★":"☆"}</button>
              <button onClick={()=>setSelId(null)} style={{all:"unset",cursor:"pointer",color:T.mu,fontSize:14,width:24,height:24,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,background:T.card}}>×</button></div></div>
          {dept&&<div style={{marginBottom:10}}><DeptBg dept={dept}/></div>}
          {(settings.allowUserLocationUpdate||isAdmin||isSuper)&&!sel.maintenanceStatus&&<div style={{marginBottom:14}}><Fl label="Storage">
            <Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={sel.locId} onChange={e=>{setKits(p=>p.map(k=>k.id===sel.id?{...k,locId:e.target.value}:k));
              addLog("location_change","kit",sel.id,curUserId,now(),{kitColor:sel.color,to:locs.find(l=>l.id===e.target.value)?.name})}}/></Fl></div>}
          {sel.degraded&&(()=>{const badC=getDegradedComps(sel);return <div style={{marginBottom:14,borderRadius:7,background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.15)",overflow:"hidden"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
              <span style={{fontSize:10,color:T.or,fontFamily:T.m,fontWeight:600,flex:1}}>Degraded — {badC.length} critical issue{badC.length!==1?"s":""}</span>
              <div style={{display:"flex",gap:4}}>
                {(isAdmin||isSuper)&&!sel.issuedTo&&<Bt v="ghost" sm onClick={()=>doSendDegradedMaint(sel.id)} style={{fontSize:8,color:T.am}}>Maintenance</Bt>}
                {(isAdmin||isSuper)&&<Bt v="ghost" sm onClick={()=>doResolveDegraded(sel.id)} style={{fontSize:8,color:T.gn}}>Mark Fixed</Bt>}</div></div>
            {badC.map(c=><div key={c.key} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 12px",borderTop:"1px solid rgba(249,115,22,.08)"}}>
              <Bg color={c.status==="DAMAGED"?T.rd:T.am} bg={c.status==="DAMAGED"?"rgba(239,68,68,.08)":"rgba(251,191,36,.08)"}>{c.status}</Bg>
              <span style={{fontSize:9,color:T.tx,fontFamily:T.m}}>{c.label}</span></div>)}</div>})()}
          {sel.maintenanceStatus&&<div style={{padding:"8px 12px",marginBottom:14,borderRadius:7,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.12)"}}>
            <span style={{fontSize:10,color:T.am,fontFamily:T.m}}>In Maintenance: {sel.maintenanceStatus}</span></div>}
          {person&&<div style={{padding:"8px 12px",marginBottom:14,borderRadius:7,background:"rgba(244,114,182,.04)",border:"1px solid rgba(244,114,182,.15)"}}>
            <span style={{fontSize:10,color:T.pk,fontFamily:T.m}}>Issued to {person.title} {person.name}</span></div>}
          {ty&&ty.fields.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            {ty.fields.map(f=><div key={f.key} style={{padding:"8px 12px",borderRadius:7,background:"rgba(129,140,248,.05)",border:"1px solid rgba(129,140,248,.1)"}}>
              <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.ind,fontFamily:T.m,marginBottom:2}}>{f.label}</div>
              <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.m}}>{f.type==="toggle"?(sel.fields[f.key]?"Yes":"No"):(sel.fields[f.key]||"--")}</div></div>)}</div>}
          {serComps.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:6}}>Serials</div>
            {serComps.map(c=>{const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;return <div key={c._key} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:4,background:"rgba(251,191,36,.02)",marginBottom:2}}>
              <span style={{fontSize:9,color:T.mu,fontFamily:T.m,flex:1}}>{lbl}</span><span style={{fontSize:10,color:sel.serials[c._key]?T.am:T.dm,fontFamily:T.m,fontWeight:600}}>{sel.serials[c._key]||"--"}</span></div>})}</div>}
          {cs.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:6}}>Components</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>{cs.map(c=>{const s=cSty[sel.comps[c._key]||"GOOD"];const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;const isCrit=(ty?.criticalCompIds||[]).includes(c.id);return(
              <div key={c._key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 7px",borderRadius:4,background:isCrit&&(sel.comps[c._key]||"GOOD")!=="GOOD"?"rgba(249,115,22,.06)":"rgba(255,255,255,.012)"}}>
                <span style={{color:s.fg,fontSize:9,fontWeight:700,width:16}}>{s.ic}</span><span style={{fontSize:8,color:(sel.comps[c._key]||"GOOD")==="GOOD"?T.mu:T.tx,fontFamily:T.m}}>{lbl}</span>{isCrit&&<span style={{fontSize:7,color:T.or,fontFamily:T.m,fontWeight:700}}>CRIT</span>}</div>)})}</div></div>}
          {/* Inline QR Code */}
          {settings.enableQR!==false&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,background:"rgba(129,140,248,.03)",border:"1px solid rgba(129,140,248,.1)",marginBottom:8,cursor:"pointer"}}
            onClick={()=>setMd("qr:"+sel.id)}>
            <QRSvg data={qrKitData(sel.id)} size={56} padding={1}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:600,color:T.ind,fontFamily:T.m}}>QR Code</div>
              <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>Click to view full size, print, or see serialized items</div></div></div>}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {canInspect&&!sel.maintenanceStatus&&<Bt v="success" sm onClick={()=>setMd("insp:"+sel.id)}>Inspect</Bt>}
            {(isAdmin||isSuper)&&serComps.length>0&&<Bt v="warn" sm onClick={()=>setMd("serials:"+sel.id)}>Manage Serials</Bt>}
            {(isAdmin||isSuper)&&<Bt v="primary" sm onClick={()=>{setKf({typeId:sel.typeId,color:sel.color,locId:sel.locId,fields:{...sel.fields},deptId:sel.deptId||""});setMd(sel.id)}}>Edit</Bt>}
            {settings.enableQR!==false&&<Bt sm v="ind" onClick={()=>setMd("qr:"+sel.id)}>QR Code</Bt>}
            <Bt sm onClick={()=>{setHistExp(null);setMd("hist:"+sel.id)}}>History</Bt>
            {(isAdmin||isSuper)&&<Bt v="danger" sm onClick={async()=>{try{await api.kits.delete(sel.id);if(onRefreshKits)await onRefreshKits();setSelId(null)}catch(e){alert(e.message)}}} style={{marginLeft:"auto"}}>Delete</Bt>}</div></div>)})()}</div>
    {/* Mobile kit detail overlay */}
    {sel&&isMobile&&(()=>{const ty=types.find(t=>t.id===sel.typeId);const lo=locs.find(l=>l.id===sel.locId);const st=stMeta(sel.lastChecked);
        const cEx=ty?expandComps(ty.compIds,ty.compQtys||{}):[];
        const cs=cEx.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);
        const person=sel.issuedTo?personnel.find(p=>p.id===sel.issuedTo):null;
        const serComps=cs.filter(c=>c.ser);const dept=sel.deptId?depts.find(d=>d.id===sel.deptId):null;const isFav=favorites.includes(sel.id);
        return(<div style={{position:"fixed",inset:0,zIndex:999,display:"flex",flexDirection:"column"}} onClick={()=>setSelId(null)}>
          <div style={{position:"absolute",inset:0,background:T._isDark?"rgba(0,0,0,.72)":"rgba(0,0,0,.35)",backdropFilter:"blur(6px)"}}/>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",marginTop:"auto",width:"100%",maxHeight:"92vh",
            background:T.panel,border:"1px solid "+T.bdH,borderRadius:"14px 14px 0 0",display:"flex",flexDirection:"column",animation:"mdIn .18s ease-out",overflow:"hidden"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid "+T.bd,flexShrink:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}><Sw color={sel.color} size={34}/>
                <div><div style={{fontSize:18,fontWeight:700,fontFamily:T.u,color:T.tx}}>Kit {sel.color}</div>
                  <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{ty?.name} | {lo?.name}</div></div></div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={()=>toggleFav(sel.id)} style={{all:"unset",cursor:"pointer",fontSize:16,color:isFav?T.am:T.dm}}>{isFav?"★":"☆"}</button>
                <button onClick={()=>setSelId(null)} style={{all:"unset",cursor:"pointer",color:T.mu,fontSize:16,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,background:T.card}}>×</button></div></div>
            <div style={{padding:"16px",overflowY:"auto",flex:1,WebkitOverflowScrolling:"touch"}}>
              {dept&&<div style={{marginBottom:10}}><DeptBg dept={dept}/></div>}
              {(settings.allowUserLocationUpdate||isAdmin||isSuper)&&!sel.maintenanceStatus&&<div style={{marginBottom:14}}><Fl label="Storage">
                <Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={sel.locId} onChange={e=>{setKits(p=>p.map(k=>k.id===sel.id?{...k,locId:e.target.value}:k));
                  addLog("location_change","kit",sel.id,curUserId,now(),{kitColor:sel.color,to:locs.find(l=>l.id===e.target.value)?.name})}}/></Fl></div>}
              {sel.degraded&&(()=>{const badC=getDegradedComps(sel);return <div style={{marginBottom:14,borderRadius:7,background:"rgba(249,115,22,.04)",border:"1px solid rgba(249,115,22,.15)",overflow:"hidden"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px"}}>
                  <span style={{fontSize:10,color:T.or,fontFamily:T.m,fontWeight:600,flex:1}}>Degraded — {badC.length} critical issue{badC.length!==1?"s":""}</span>
                  <div style={{display:"flex",gap:4}}>
                    {(isAdmin||isSuper)&&!sel.issuedTo&&<Bt v="ghost" sm onClick={()=>doSendDegradedMaint(sel.id)} style={{fontSize:8,color:T.am}}>Maint</Bt>}
                    {(isAdmin||isSuper)&&<Bt v="ghost" sm onClick={()=>doResolveDegraded(sel.id)} style={{fontSize:8,color:T.gn}}>Fix</Bt>}</div></div>
                {badC.map(c=><div key={c.key} style={{display:"flex",alignItems:"center",gap:8,padding:"4px 12px",borderTop:"1px solid rgba(249,115,22,.08)"}}>
                  <Bg color={c.status==="DAMAGED"?T.rd:T.am} bg={c.status==="DAMAGED"?"rgba(239,68,68,.08)":"rgba(251,191,36,.08)"}>{c.status}</Bg>
                  <span style={{fontSize:9,color:T.tx,fontFamily:T.m}}>{c.label}</span></div>)}</div>})()}
              {sel.maintenanceStatus&&<div style={{padding:"8px 12px",marginBottom:14,borderRadius:7,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.12)"}}>
                <span style={{fontSize:10,color:T.am,fontFamily:T.m}}>In Maintenance: {sel.maintenanceStatus}</span></div>}
              {person&&<div style={{padding:"8px 12px",marginBottom:14,borderRadius:7,background:"rgba(244,114,182,.04)",border:"1px solid rgba(244,114,182,.15)"}}>
                <span style={{fontSize:10,color:T.pk,fontFamily:T.m}}>Issued to {person.title} {person.name}</span></div>}
              {ty&&ty.fields.length>0&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
                {ty.fields.map(f=><div key={f.key} style={{padding:"8px 12px",borderRadius:7,background:"rgba(129,140,248,.05)",border:"1px solid rgba(129,140,248,.1)"}}>
                  <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.ind,fontFamily:T.m,marginBottom:2}}>{f.label}</div>
                  <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.m}}>{f.type==="toggle"?(sel.fields[f.key]?"Yes":"No"):(sel.fields[f.key]||"--")}</div></div>)}</div>}
              {serComps.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:6}}>Serials</div>
                {serComps.map(c=>{const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;return <div key={c._key} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:4,background:"rgba(251,191,36,.02)",marginBottom:2}}>
                  <span style={{fontSize:9,color:T.mu,fontFamily:T.m,flex:1}}>{lbl}</span><span style={{fontSize:10,color:sel.serials[c._key]?T.am:T.dm,fontFamily:T.m,fontWeight:600}}>{sel.serials[c._key]||"--"}</span></div>})}</div>}
              {cs.length>0&&<div style={{marginBottom:14}}><div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:6}}>Components</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>{cs.map(c=>{const s=cSty[sel.comps[c._key]||"GOOD"];const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;const isCrit=(ty?.criticalCompIds||[]).includes(c.id);return(
                  <div key={c._key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 7px",borderRadius:4,background:isCrit&&(sel.comps[c._key]||"GOOD")!=="GOOD"?"rgba(249,115,22,.06)":"rgba(255,255,255,.012)"}}>
                    <span style={{color:s.fg,fontSize:9,fontWeight:700,width:16}}>{s.ic}</span><span style={{fontSize:8,color:(sel.comps[c._key]||"GOOD")==="GOOD"?T.mu:T.tx,fontFamily:T.m}}>{lbl}</span>{isCrit&&<span style={{fontSize:7,color:T.or,fontFamily:T.m,fontWeight:700}}>CRIT</span>}</div>)})}</div></div>}
              {settings.enableQR!==false&&<div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,background:"rgba(129,140,248,.03)",border:"1px solid rgba(129,140,248,.1)",marginBottom:8,cursor:"pointer"}}
                onClick={()=>setMd("qr:"+sel.id)}>
                <QRSvg data={qrKitData(sel.id)} size={56} padding={1}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.ind,fontFamily:T.m}}>QR Code</div>
                  <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>Click to view full size, print, or see serialized items</div></div></div>}
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {canInspect&&!sel.maintenanceStatus&&<Bt v="success" sm onClick={()=>setMd("insp:"+sel.id)}>Inspect</Bt>}
                {(isAdmin||isSuper)&&serComps.length>0&&<Bt v="warn" sm onClick={()=>setMd("serials:"+sel.id)}>Manage Serials</Bt>}
                {(isAdmin||isSuper)&&<Bt v="primary" sm onClick={()=>{setKf({typeId:sel.typeId,color:sel.color,locId:sel.locId,fields:{...sel.fields},deptId:sel.deptId||""});setMd(sel.id)}}>Edit</Bt>}
                {settings.enableQR!==false&&<Bt sm v="ind" onClick={()=>setMd("qr:"+sel.id)}>QR Code</Bt>}
                <Bt sm onClick={()=>{setHistExp(null);setMd("hist:"+sel.id)}}>History</Bt>
                {(isAdmin||isSuper)&&<Bt v="danger" sm onClick={async()=>{try{await api.kits.delete(sel.id);if(onRefreshKits)await onRefreshKits();setSelId(null)}catch(e){alert(e.message)}}} style={{marginLeft:"auto"}}>Delete</Bt>}</div>
            </div></div></div>)})()}
    <ModalWrap open={String(md).startsWith("serials:")} onClose={()=>setMd(null)} title="Manage Serial Numbers" wide>
      {String(md).startsWith("serials:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <SerialManageForm kit={k} type={ty} allC={allC} onCancel={()=>setMd(null)}
          onSave={async(serials)=>{try{await api.kits.updateSerials(k.id,serials);if(onRefreshKits)await onRefreshKits();setMd(null)}catch(e){alert(e.message)}}}/>})()}</ModalWrap>
    <ModalWrap open={md==="addK"||kf&&md&&md!=="addK"&&!String(md).startsWith("insp")&&!String(md).startsWith("hist")&&!String(md).startsWith("qr")&&!String(md).startsWith("serials")} onClose={()=>{setMd(null);setKf(null)}} title={md==="addK"?"Add Kit":"Edit Kit"}>
      {kf&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Type"><Sl options={types.map(t=>({v:t.id,l:t.name}))} value={kf.typeId} onChange={e=>setKf(p=>({...p,typeId:e.target.value,fields:{}}))}/></Fl>
        <Fl label="Color"><div>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <Sw color={kf.color} size={28}/>
            <span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.m}}>{kf.color}</span></div>
          {[{label:null,keys:Object.keys(CM).filter(c=>!/^\d/.test(c)&&!["CHECKER","RWB","STRIPES"].includes(c))},
            {label:"Numbered",keys:Object.keys(CM).filter(c=>/^\d/.test(c))},
            {label:"Patterns",keys:["CHECKER","RWB","STRIPES"]}].map((grp,gi)=><div key={gi}>
            {grp.label&&<div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.dm,fontFamily:T.m,margin:"6px 0 4px"}}>{grp.label}</div>}
            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
              {grp.keys.map(c=>{const v=CM[c];const isSel=kf.color===c;const isPat=v&&(v.includes("gradient")||v.includes("conic"));
                return <button key={c} title={c} onClick={()=>setKf(p=>({...p,color:c}))} style={{all:"unset",cursor:"pointer",width:24,height:24,borderRadius:4,
                  background:isPat?v:(v||"#444"),border:isSel?"2px solid "+T.tx:c==="WHITE"?"1.5px solid #555":"1.5px solid transparent",
                  outline:isSel?"2px solid "+T.bl:"none",outlineOffset:1,transition:"outline .1s, border .1s",flexShrink:0}}/>})}</div></div>)}</div></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Storage">{locs.length?<Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={kf.locId} onChange={e=>setKf(p=>({...p,locId:e.target.value}))}/>
            :<span style={{fontSize:10,color:T.rd,fontFamily:T.m}}>No storage locations — add one first</span>}</Fl>
          <Fl label="Department"><Sl options={[{v:"",l:"-- None --"},...depts.map(d=>({v:d.id,l:d.name}))]} value={kf.deptId||""} onChange={e=>setKf(p=>({...p,deptId:e.target.value}))}/></Fl></div>
        {cType&&cType.fields.map(f=><Fl key={f.key} label={f.label}>{f.type==="toggle"?<Tg checked={!!kf.fields[f.key]} onChange={v=>setKf(p=>({...p,fields:{...p.fields,[f.key]:v}}))}/>
          :<In value={kf.fields[f.key]||""} onChange={e=>setKf(p=>({...p,fields:{...p.fields,[f.key]:e.target.value}}))}/>}</Fl>)}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>{setMd(null);setKf(null)}}>Cancel</Bt><Bt v="primary" onClick={saveK} disabled={!kf.locId}>{md==="addK"?"Add":"Save"}</Bt></div></div>}</ModalWrap>
    <ModalWrap open={String(md).startsWith("insp:")} onClose={()=>setMd(null)} title="Inspection" wide>
      {String(md).startsWith("insp:")&&(()=>{const kid=String(md).split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} onDone={doneInsp} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={String(md).startsWith("hist:")} onClose={()=>{setMd(null);setHistExp(null)}} title="Kit History" wide>
      {String(md).startsWith("hist:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);if(!k)return null;
        const ty=types.find(t=>t.id===k.typeId);const cEx=ty?expandComps(ty.compIds,ty.compQtys||{}):[];
        const all=[...k.inspections.map(i=>({_et:"inspection",...i})),...k.issueHistory.map(h=>({_et:"checkout",...h})),...k.maintenanceHistory.map(m=>({_et:"maintenance",...m}))]
          .sort((a,b)=>new Date(b.date||b.issuedDate||b.startDate)-new Date(a.date||a.issuedDate||a.startDate));
        return(<div style={{maxHeight:500,overflowY:"auto"}}>{all.length?all.map((e,i)=>{const isExp=histExp===i;const tc=e._et==="inspection"?T.tl:e._et==="checkout"?T.bl:T.am;
          return(<div key={i} style={{borderRadius:7,background:T.card,border:"1px solid "+(isExp?tc+"44":T.bd),marginBottom:4,transition:"border .15s"}}>
            <div onClick={()=>setHistExp(isExp?null:i)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 14px",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <Bg color={tc} bg={tc+"18"}>{e._et==="checkout"?(e.returnedDate?"checkout → return":"checkout"):e._et}</Bg>
                {e._et==="inspection"&&<span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{e.inspector||"--"}</span>}
                {e._et==="checkout"&&<span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{e.person?.name||personnel.find(p=>p.id===e.personId)?.name||"--"}</span>}
                {e._et==="maintenance"&&<span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{e.reason||"--"}</span>}
                {e._et==="inspection"&&e.results&&(()=>{const vals=Object.values(e.results);const bad=vals.filter(s=>s!=="GOOD").length;
                  return bad>0?<Bg color={T.rd} bg="rgba(239,68,68,.08)">{bad} issue{bad>1?"s":""}</Bg>:<Bg color={T.gn} bg="rgba(34,197,94,.08)">All good</Bg>})()}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{fmtDate(e.date||e.issuedDate||e.startDate)}</span>
                <span style={{fontSize:10,color:T.dm,transition:"transform .15s",transform:isExp?"rotate(90deg)":"rotate(0deg)"}}>▸</span></div></div>
            {isExp&&<div style={{padding:"0 14px 12px",borderTop:"1px solid "+T.bd}}>
              {e._et==="inspection"&&<div style={{paddingTop:10}}>
                {e.notes&&<div style={{fontSize:10,color:T.tx,fontFamily:T.m,marginBottom:10,padding:"6px 10px",borderRadius:5,background:"rgba(255,255,255,.02)",fontStyle:"italic"}}>"{e.notes}"</div>}
                {e.results&&Object.keys(e.results).length>0&&<div>
                  <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.dm,fontFamily:T.m,marginBottom:6}}>Component Results</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>
                    {cEx.map(ce=>{const c=allC.find(x=>x.id===ce.compId);const st=e.results[ce.key]||"GOOD";const s=cSty[st];
                      const lbl=c?(ce.qty>1?c.label+" ("+(ce.idx+1)+"/"+ce.qty+")":c.label):ce.key;
                      return <div key={ce.key} style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",borderRadius:4,background:s?s.bg:"transparent"}}>
                        <span style={{fontSize:9,fontWeight:700,color:s?s.fg:T.dm,width:16}}>{s?s.ic:"--"}</span>
                        <span style={{fontSize:9,color:st!=="GOOD"?T.tx:T.mu,fontFamily:T.m,flex:1}}>{lbl}</span>
                        {e.serials&&e.serials[ce.key]&&<span style={{fontSize:8,color:T.am,fontFamily:T.m}}>SN: {e.serials[ce.key]}</span>}</div>})}</div></div>}
                {e.photos&&e.photos.length>0&&<div style={{marginTop:8,fontSize:9,color:T.ind,fontFamily:T.m}}>{e.photos.length} photo{e.photos.length>1?"s":""} attached</div>}</div>}
              {e._et==="checkout"&&<div style={{paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
                <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{padding:"8px 10px",borderRadius:6,background:"rgba(96,165,250,.04)",border:"1px solid rgba(96,165,250,.08)"}}>
                    <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.bl,fontFamily:T.m,marginBottom:3}}>Checked Out</div>
                    <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{fmtDate(e.issuedDate)}</div>
                    <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginTop:2}}>To: {e.person?.name||personnel.find(p=>p.id===e.personId)?.name||"--"}{e.person?.title?" ("+e.person.title+")":""}</div>
                    {e.issuedByUser&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>By: {e.issuedByUser.name}</div>}
                    {e.checkoutLoc&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>From: {locs.find(l=>l.id===e.checkoutLoc)?.name||"--"}</div>}</div>
                  <div style={{padding:"8px 10px",borderRadius:6,background:e.returnedDate?"rgba(34,197,94,.04)":"rgba(244,114,182,.04)",border:"1px solid "+(e.returnedDate?"rgba(34,197,94,.08)":"rgba(244,114,182,.08)")}}>
                    <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:e.returnedDate?T.gn:T.pk,fontFamily:T.m,marginBottom:3}}>{e.returnedDate?"Returned":"Outstanding"}</div>
                    {e.returnedDate?<><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{fmtDate(e.returnedDate)}</div>
                      {e.returnLoc&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>To: {locs.find(l=>l.id===e.returnLoc)?.name||"--"}</div>}</>
                      :<div style={{fontSize:11,fontWeight:600,color:T.pk,fontFamily:T.m}}>Still out</div>}</div></div>
                {e.returnNotes&&<div style={{fontSize:10,color:T.tx,fontFamily:T.m,padding:"6px 10px",borderRadius:5,background:"rgba(255,255,255,.02)"}}>Return note: {e.returnNotes}</div>}
                {e.checkoutSerials&&Object.keys(e.checkoutSerials).length>0&&<div>
                  <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.dm,fontFamily:T.m,marginBottom:4}}>Checkout Serials</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.entries(e.checkoutSerials).map(([key,sn])=>{
                    const ce=cEx.find(x=>x.key===key);const c=ce?allC.find(x=>x.id===ce.compId):null;
                    return <Bg key={key} color={T.am} bg="rgba(251,191,36,.06)">{c?c.label:key}: {sn}</Bg>})}</div></div>}
                {e.returnSerials&&Object.keys(e.returnSerials).length>0&&<div>
                  <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.dm,fontFamily:T.m,marginBottom:4}}>Return Serials</div>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>{Object.entries(e.returnSerials).map(([key,sn])=>{
                    const ce=cEx.find(x=>x.key===key);const c=ce?allC.find(x=>x.id===ce.compId):null;
                    return <Bg key={key} color={T.gn} bg="rgba(34,197,94,.06)">{c?c.label:key}: {sn}</Bg>})}</div></div>}</div>}
              {e._et==="maintenance"&&<div style={{paddingTop:10,display:"flex",flexDirection:"column",gap:8}}>
                <div className="slate-resp" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  <div style={{padding:"8px 10px",borderRadius:6,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.08)"}}>
                    <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:T.am,fontFamily:T.m,marginBottom:3}}>Started</div>
                    <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{fmtDate(e.startDate)}</div>
                    {e.startedByUser&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>By: {e.startedByUser.name}</div>}</div>
                  <div style={{padding:"8px 10px",borderRadius:6,background:e.endDate?"rgba(34,197,94,.04)":"rgba(251,191,36,.04)",border:"1px solid "+(e.endDate?"rgba(34,197,94,.08)":"rgba(251,191,36,.08)")}}>
                    <div style={{fontSize:8,textTransform:"uppercase",letterSpacing:1,color:e.endDate?T.gn:T.am,fontFamily:T.m,marginBottom:3}}>{e.endDate?"Completed":"In Progress"}</div>
                    {e.endDate?<><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{fmtDate(e.endDate)}</div>
                      {e.completedByUser&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>By: {e.completedByUser.name}</div>}</>
                      :<div style={{fontSize:11,fontWeight:600,color:T.am,fontFamily:T.m}}>Ongoing</div>}</div></div>
                {e.type&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Type: {e.type}</div>}
                {e.notes&&<div style={{fontSize:10,color:T.tx,fontFamily:T.m,padding:"6px 10px",borderRadius:5,background:"rgba(255,255,255,.02)"}}>Note: {e.notes}</div>}</div>}</div>}</div>)})
          :<div style={{padding:20,textAlign:"center",color:T.dm}}>No history</div>}</div>)})()}</ModalWrap>
    {/* QR Code detail modal */}
    <ModalWrap open={String(md).startsWith("qr:")&&md!=="qr-bulk"} onClose={()=>setMd(null)} title="Kit QR Code">
      {String(md).startsWith("qr:")&&md!=="qr-bulk"&&(()=>{const kid=md.slice(3);const k=kits.find(x=>x.id===kid);
        if(!k)return null;const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
        const serComps=ty?expandComps(ty.compIds,ty.compQtys||{}).map(e=>{const c=allC.find(x=>x.id===e.compId);
          return c&&c.ser&&c.qrScan!==false&&k.serials[e.key]?{key:e.key,label:e.qty>1?c.label+" ("+(e.idx+1)+" of "+e.qty+")":c.label,serial:k.serials[e.key]}:null}).filter(Boolean):[];
        return <QRDetailView qrData={qrKitData(k.id)} label={"Kit "+k.color} sub={(ty?.name||"")+" | "+(lo?.name||"")}
          serials={serComps} kitId={k.id} onClose={()=>setMd(null)}/>})()}</ModalWrap>
    {/* Bulk QR Print modal */}
    <ModalWrap open={md==="qr-bulk"} onClose={()=>setMd(null)} title="Print QR Codes" wide>
      {md==="qr-bulk"&&<QRPrintSheet items={filt.map(k=>{const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
        return{id:k.id,qrData:qrKitData(k.id),label:"Kit "+k.color,sub:(ty?.name||"")+" | "+(lo?.name||"")}})}
        onClose={()=>setMd(null)}/>}</ModalWrap></div>);}

export default KitInv;
