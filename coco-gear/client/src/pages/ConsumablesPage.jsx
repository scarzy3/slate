import { useState } from 'react';
import { T } from '../theme/theme.js';
import { CATS } from '../theme/helpers.js';
import { Bg, Bt, Fl, In, Ta, Sl, SH, Tabs, ModalWrap, ProgressBar } from '../components/ui/index.js';
import QRDetailView from '../components/qr/QRDetailView.jsx';
import QRPrintSheet from '../components/qr/QRPrintSheet.jsx';
import { qrAssetData } from '../components/qr/qrHelpers.js';
import api from '../api.js';

function ConsumablesPage({consumables,setConsumables,assets,setAssets,personnel,locs,addLog,curUserId,isAdmin,onRefreshConsumables,onRefreshAssets}){
  const[tab,setTab]=useState("consumables");
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",sku:"",category:"Other",qty:0,minQty:0,unit:"ea"});
  const[afm,setAfm]=useState({name:"",serial:"",category:"Optics",locId:"",notes:""});
  const[adj,setAdj]=useState({id:"",delta:0,reason:""});
  const lowStock=consumables.filter(c=>c.qty<=c.minQty);
  const issuedAssets=assets.filter(a=>a.issuedTo);const availAssets=assets.filter(a=>!a.issuedTo);

  const saveCon=async()=>{if(!fm.name.trim())return;
    try{if(md==="addCon"){await api.consumables.create({name:fm.name,sku:fm.sku,category:fm.category,qty:Number(fm.qty),minQty:Number(fm.minQty),unit:fm.unit})}
    else{await api.consumables.update(md,{name:fm.name,sku:fm.sku,category:fm.category,minQty:Number(fm.minQty),unit:fm.unit})}
    await onRefreshConsumables()}catch(e){alert(e.message)}
    setMd(null)};

  const saveAsset=async()=>{if(!afm.name.trim()||!afm.serial.trim())return;
    try{if(md==="addAsset"){await api.assets.create({name:afm.name,serial:afm.serial,category:afm.category,locId:afm.locId||null,notes:afm.notes})}
    else{await api.assets.update(md,{name:afm.name,serial:afm.serial,category:afm.category,locId:afm.locId||null,notes:afm.notes})}
    await onRefreshAssets()}catch(e){alert(e.message)}
    setMd(null)};

  const adjust=async()=>{
    try{await api.consumables.adjust(adj.id,Number(adj.delta),adj.reason);await onRefreshConsumables()}catch(e){alert(e.message)}
    setAdj({id:"",delta:0,reason:""})};

  const checkoutAsset=async(assetId,personId)=>{
    try{await api.assets.checkout(assetId,personId);await onRefreshAssets()}catch(e){alert(e.message)}
    setMd(null)};

  const returnAsset=async(assetId)=>{
    try{await api.assets.return(assetId);await onRefreshAssets()}catch(e){alert(e.message)}};

  const[checkoutPerson,setCheckoutPerson]=useState("");

  return(<div>
    <SH title="Inventory & Assets" sub={consumables.length+" consumables | "+assets.length+" assets"}/>
    <Tabs tabs={[
      {id:"consumables",l:"Consumables",badge:lowStock.length,badgeColor:"rgba(239,68,68,.15)"},
      {id:"assets",l:"Standalone Assets",badge:issuedAssets.length,badgeColor:"rgba(244,114,182,.15)"}
    ]} active={tab} onChange={setTab}/>

    {tab==="consumables"&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <Bt v="primary" onClick={()=>{setFm({name:"",sku:"",category:"Other",qty:0,minQty:0,unit:"ea"});setMd("addCon")}}>+ Add Consumable</Bt></div>

      {lowStock.length>0&&<div style={{padding:14,borderRadius:8,background:"rgba(239,68,68,.03)",border:"1px solid rgba(239,68,68,.12)",marginBottom:16}}>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.rd,fontFamily:T.m,marginBottom:8}}>Low Stock Alert</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {lowStock.map(c=><Bg key={c.id} color={T.rd} bg="rgba(239,68,68,.1)">{c.name}: {c.qty}/{c.minQty}</Bg>)}</div></div>}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:8}}>
        {consumables.map(c=>{const low=c.qty<=c.minQty;return(
          <div key={c.id} style={{padding:14,borderRadius:8,background:T.card,border:"1px solid "+(low?"rgba(239,68,68,.2)":T.bd)}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{c.name}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{c.sku} | {c.category}</div></div>
              {isAdmin&&<Bt v="ghost" sm onClick={()=>{setFm({...c});setMd(c.id)}}>Edit</Bt>}</div>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <div style={{fontSize:22,fontWeight:700,color:low?T.rd:T.tx,fontFamily:T.u}}>{c.qty}</div>
              <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{c.unit}</span>
              {low&&<Bg color={T.rd} bg="rgba(239,68,68,.1)">LOW</Bg>}</div>
            <ProgressBar value={c.qty} max={Math.max(c.minQty*2,c.qty)} color={low?T.rd:T.gn} height={4}/>
            <div style={{display:"flex",gap:4,marginTop:8}}>
              <Bt sm v="success" onClick={()=>setAdj({id:c.id,delta:1,reason:"Restock"})}>+</Bt>
              <Bt sm v="danger" onClick={()=>setAdj({id:c.id,delta:-1,reason:"Used"})}>−</Bt>
              <Bt sm onClick={()=>setAdj({id:c.id,delta:0,reason:""})}>Adjust</Bt></div></div>)})}</div></div>}

    {tab==="assets"&&<div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:6,marginBottom:12}}>
        <Bt sm v="ind" onClick={()=>setMd("qr-assets")}>Print QR Codes</Bt>
        {isAdmin&&<Bt v="primary" onClick={()=>{setAfm({name:"",serial:"",category:"Optics",locId:"",notes:""});setMd("addAsset")}}>+ Add Asset</Bt>}</div>

      {issuedAssets.length>0&&<div style={{marginBottom:20}}>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.pk,fontFamily:T.m,marginBottom:10}}>Checked Out ({issuedAssets.length})</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:8}}>
          {issuedAssets.map(a=>{const person=personnel.find(p=>p.id===a.issuedTo);const isMine=a.issuedTo===curUserId;
            const lastIssue=a.issueHistory[a.issueHistory.length-1];
            return(<div key={a.id} style={{padding:14,borderRadius:8,background:isMine?"rgba(244,114,182,.03)":T.card,border:isMine?"1px solid rgba(244,114,182,.15)":"1px solid "+T.bd}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div><div style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{a.name}</div>
                  <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.serial} | {a.category}</div></div>
                <Bg color={a.condition==="GOOD"?T.gn:T.am} bg={a.condition==="GOOD"?"rgba(34,197,94,.1)":"rgba(251,191,36,.1)"}>{a.condition}</Bg></div>
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(244,114,182,.04)",border:"1px solid rgba(244,114,182,.12)"}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:T.pk}}/>
                <span style={{fontSize:10,fontWeight:600,color:T.pk,fontFamily:T.m,flex:1}}>{isMine?"YOU":person?.name}</span>
                {lastIssue&&<span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>since {lastIssue.issuedDate}</span>}</div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                {(isMine||isAdmin)&&<Bt v="warn" sm onClick={()=>returnAsset(a.id)}>Return</Bt>}
                <Bt sm v="ind" onClick={()=>setMd("qr-asset:"+a.id)}>QR</Bt></div></div>)})}</div></div>}

      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.gn,fontFamily:T.m,marginBottom:10}}>Available ({availAssets.length})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(280px,100%),1fr))",gap:8}}>
        {availAssets.map(a=>{const loc=a.locId?locs.find(l=>l.id===a.locId):null;return(
          <div key={a.id} style={{padding:14,borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <div><div style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{a.name}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.serial} | {a.category}{loc?" | "+loc.name:""}</div></div>
              <div style={{display:"flex",gap:4}}>
                <Bg color={a.condition==="GOOD"?T.gn:T.am} bg={a.condition==="GOOD"?"rgba(34,197,94,.1)":"rgba(251,191,36,.1)"}>{a.condition}</Bg>
                {isAdmin&&<Bt v="ghost" sm onClick={()=>{setAfm({name:a.name,serial:a.serial,category:a.category,locId:a.locId||"",notes:a.notes||""});setMd(a.id)}}>Edit</Bt>}</div></div>
            <div style={{display:"flex",gap:6,marginTop:8}}>
              <Bt v="primary" sm onClick={()=>{setCheckoutPerson("");setMd("checkout:"+a.id)}}>Checkout</Bt>
              <Bt sm v="ind" onClick={()=>setMd("qr-asset:"+a.id)}>QR</Bt>
              {a.issueHistory.length>0&&<Bt sm onClick={()=>setMd("history:"+a.id)}>History</Bt>}</div></div>)})}</div></div>}

    {/* Consumable edit modal */}
    <ModalWrap open={md==="addCon"||(typeof md==="string"&&md.length>10&&!md.startsWith("checkout")&&!md.startsWith("history")&&!md.startsWith("addAsset")&&!md.startsWith("qr")&&tab==="consumables")} onClose={()=>setMd(null)} title={md==="addCon"?"Add Consumable":"Edit Consumable"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="SKU"><In value={fm.sku} onChange={e=>setFm(p=>({...p,sku:e.target.value}))}/></Fl>
          <Fl label="Category"><Sl options={CATS} value={fm.category} onChange={e=>setFm(p=>({...p,category:e.target.value}))}/></Fl></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          {md==="addCon"&&<Fl label="Qty"><In type="number" value={fm.qty} onChange={e=>setFm(p=>({...p,qty:e.target.value}))}/></Fl>}
          <Fl label="Min Qty"><In type="number" value={fm.minQty} onChange={e=>setFm(p=>({...p,minQty:e.target.value}))}/></Fl>
          <Fl label="Unit"><Sl options={["ea","pk","box","roll"]} value={fm.unit} onChange={e=>setFm(p=>({...p,unit:e.target.value}))}/></Fl></div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          {isAdmin&&md!=="addCon"&&<Bt v="danger" onClick={async()=>{if(!confirm("Delete this consumable?"))return;try{await api.consumables.delete(md);await onRefreshConsumables()}catch(e){alert(e.message)}setMd(null)}} style={{marginRight:"auto"}}>Delete</Bt>}
          <Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={saveCon}>Save</Bt></div></div></ModalWrap>

    {/* Asset edit modal */}
    <ModalWrap open={md==="addAsset"||(typeof md==="string"&&md.length>10&&!md.startsWith("checkout")&&!md.startsWith("history")&&!md.startsWith("qr")&&tab==="assets"&&md!=="addCon")} onClose={()=>setMd(null)} title={md==="addAsset"?"Add Asset":"Edit Asset"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={afm.name} onChange={e=>setAfm(p=>({...p,name:e.target.value}))} placeholder="e.g. PVS-14 Night Vision"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Serial Number"><In value={afm.serial} onChange={e=>setAfm(p=>({...p,serial:e.target.value}))}/></Fl>
          <Fl label="Category"><Sl options={CATS} value={afm.category} onChange={e=>setAfm(p=>({...p,category:e.target.value}))}/></Fl></div>
        <Fl label="Storage"><Sl options={[{v:"",l:"-- None --"},...locs.map(l=>({v:l.id,l:l.name}))]} value={afm.locId} onChange={e=>setAfm(p=>({...p,locId:e.target.value}))}/></Fl>
        <Fl label="Notes"><Ta value={afm.notes} onChange={e=>setAfm(p=>({...p,notes:e.target.value}))} rows={2}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          {isAdmin&&md!=="addAsset"&&<Bt v="danger" onClick={async()=>{if(!confirm("Delete this asset and all its history?"))return;try{await api.assets.delete(md);await onRefreshAssets()}catch(e){alert(e.message)}setMd(null)}} style={{marginRight:"auto"}}>Delete</Bt>}
          <Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={saveAsset}>Save</Bt></div></div></ModalWrap>

    {/* Adjust quantity modal */}
    <ModalWrap open={!!adj.id} onClose={()=>setAdj({id:"",delta:0,reason:""})} title="Adjust Quantity">
      {adj.id&&(()=>{const c=consumables.find(x=>x.id===adj.id);return(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u}}>{c?.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Current: {c?.qty}</span>
            <In type="number" value={adj.delta} onChange={e=>setAdj(p=>({...p,delta:Number(e.target.value)}))} style={{width:80}}/>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>New: {c?.qty+adj.delta}</span></div>
          <Fl label="Reason"><In value={adj.reason} onChange={e=>setAdj(p=>({...p,reason:e.target.value}))} placeholder="Restock, used, damaged..."/></Fl>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setAdj({id:"",delta:0,reason:""})}>Cancel</Bt>
            <Bt v="primary" onClick={adjust}>Apply</Bt></div></div>)})()}</ModalWrap>

    {/* Checkout modal */}
    <ModalWrap open={String(md).startsWith("checkout:")} onClose={()=>setMd(null)} title="Checkout Asset">
      {String(md).startsWith("checkout:")&&(()=>{const aid=md.split(":")[1];const a=assets.find(x=>x.id===aid);return(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u}}>{a?.name}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Serial: {a?.serial}</div>
          <Fl label="Checkout To"><Sl options={[{v:"",l:"-- Select Person --"},...personnel.map(p=>({v:p.id,l:p.name}))]}
            value={checkoutPerson} onChange={e=>setCheckoutPerson(e.target.value)}/></Fl>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
            <Bt v="primary" onClick={()=>checkoutAsset(aid,checkoutPerson)} disabled={!checkoutPerson}>Checkout</Bt></div></div>)})()}</ModalWrap>

    {/* History modal */}
    <ModalWrap open={String(md).startsWith("history:")} onClose={()=>setMd(null)} title="Asset History">
      {String(md).startsWith("history:")&&(()=>{const aid=md.split(":")[1];const a=assets.find(x=>x.id===aid);return(
        <div>
          <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>{a?.name} ({a?.serial})</div>
          {a?.issueHistory.length>0?<div style={{display:"flex",flexDirection:"column",gap:4}}>
            {[...a.issueHistory].reverse().map((h,i)=>{const p=personnel.find(x=>x.id===h.personId);const ib=personnel.find(x=>x.id===h.issuedBy);return(
              <div key={i} style={{padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{p?.name||"Unknown"}</span>
                  <Bg color={h.returnedDate?T.gn:T.pk} bg={h.returnedDate?"rgba(34,197,94,.1)":"rgba(244,114,182,.1)"}>{h.returnedDate?"Returned":"Active"}</Bg></div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:4}}>{h.issuedDate}{h.returnedDate?" → "+h.returnedDate:""} | By: {ib?.name||"System"}</div></div>)})}
          </div>:<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No history</div>}</div>)})()}</ModalWrap>
    {/* Asset QR Code modal */}
    <ModalWrap open={String(md).startsWith("qr-asset:")} onClose={()=>setMd(null)} title="Asset QR Code">
      {String(md).startsWith("qr-asset:")&&(()=>{const aid=md.slice(9);const a=assets.find(x=>x.id===aid);
        if(!a)return null;const loc=a.locId?locs.find(l=>l.id===a.locId):null;
        return <QRDetailView qrData={qrAssetData(a.id)} label={a.name} sub={a.serial+" | "+a.category+(loc?" | "+loc.name:"")}
          serials={[]} kitId="" onClose={()=>setMd(null)}/>})()}</ModalWrap>
    {/* Bulk Asset QR Print */}
    <ModalWrap open={md==="qr-assets"} onClose={()=>setMd(null)} title="Print Asset QR Codes" wide>
      {md==="qr-assets"&&<QRPrintSheet items={assets.map(a=>({id:a.id,qrData:qrAssetData(a.id),label:a.name,sub:a.serial}))}
        onClose={()=>setMd(null)}/>}</ModalWrap></div>);}

export default ConsumablesPage;
