import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';
import { Sw, Bt, Bg } from './ui/index.js';
import ModalWrap from './ui/ModalWrap.jsx';
import QRScanner from './qr/QRScanner.jsx';
import { parseQR } from './qr/qrHelpers.js';
import SerialEntryForm from '../forms/SerialEntryForm.jsx';

function ScanAction({scanMd,setScanMd,kits,types,locs,comps:allC,personnel,depts,settings,curUserId,isAdmin,isSuper,apiCheckout,apiReturn,onRefreshKits,onNavigateToKit,reservations}){
  if(!scanMd)return null;
  const closeScan=()=>setScanMd(null);

  /* Phase: camera scanner */
  if(scanMd==="scan")return(
    <ModalWrap open title="Scan QR Code" onClose={closeScan}>
      <QRScanner onScan={val=>{
        const parsed=parseQR(val);
        if(parsed?.type==="kit"){const k=kits.find(x=>x.id===parsed.id);if(k){setScanMd("kit:"+k.id);return}}
        if(parsed?.type==="serial"){setScanMd("serial:"+val);return}
        /* Fallback: search by color or serial */
        const q=val.toLowerCase();const match=kits.find(k=>k.color.toLowerCase()===q||Object.values(k.serials||{}).some(s=>s?.toLowerCase()===q));
        if(match){setScanMd("kit:"+match.id);return}
        setScanMd("notfound:"+val);
      }} onClose={closeScan}/></ModalWrap>);

  /* Phase: kit scanned — show info + action */
  if(scanMd.startsWith("kit:")){
    const kitId=scanMd.slice(4);const kit=kits.find(k=>k.id===kitId);
    if(!kit)return <ModalWrap open onClose={closeScan} title="Kit Not Found"><div style={{textAlign:"center",padding:20}}>
      <div style={{fontSize:40,marginBottom:12}}>?</div>
      <div style={{fontSize:14,fontWeight:700,color:T.rd,marginBottom:6}}>Kit Not Found</div>
      <div style={{fontSize:11,color:T.mu,fontFamily:T.m,marginBottom:16}}>This kit may have been deleted</div>
      <Bt onClick={()=>setScanMd("scan")}>Scan Again</Bt></div></ModalWrap>;
    const ty=types.find(t=>t.id===kit.typeId);const lo=locs.find(l=>l.id===kit.locId);
    const dept=kit.deptId?depts.find(d=>d.id===kit.deptId):null;
    const person=kit.issuedTo?personnel.find(p=>p.id===kit.issuedTo):null;
    const inMaint=!!kit.maintenanceStatus;const isMine=kit.issuedTo===curUserId;
    const canCheckout=!kit.issuedTo&&!inMaint;
    const canReturn=!!kit.issuedTo;
    const upcoming=(reservations||[]).filter(r=>r.kitId===kit.id&&(r.status==="confirmed"||r.status==="pending")&&new Date(r.endDate)>=new Date());
    return(<ModalWrap open onClose={closeScan} title={"Kit "+kit.color}>
      <div style={{display:"flex",flexDirection:"column",gap:14,padding:4}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <Sw color={kit.color} size={40}/>
          <div style={{flex:1}}><div style={{fontSize:16,fontWeight:800,fontFamily:T.u,color:T.tx}}>{kit.color}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{ty?.name||"Unknown type"}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{lo?.name||"Unknown storage"}{dept?" | "+dept.name:""}</div></div></div>
        {/* Status display */}
        <div style={{padding:"12px 14px",borderRadius:8,background:inMaint?"rgba(251,191,36,.04)":person?"rgba(244,114,182,.04)":"rgba(34,197,94,.04)",
          border:"1px solid "+(inMaint?"rgba(251,191,36,.15)":person?"rgba(244,114,182,.15)":"rgba(34,197,94,.15)")}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:inMaint?T.am:person?T.pk:T.gn}}/>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:700,color:inMaint?T.am:person?T.pk:T.gn}}>
                {inMaint?"In Maintenance ("+kit.maintenanceStatus+")":person?(isMine?"Checked Out to You":"Checked Out to "+person.name):"Available"}</div>
              {person&&!isMine&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginTop:2}}>{person.title||""}</div>}
            </div></div></div>
        {/* Reservation warnings */}
        {upcoming.length>0&&<div style={{padding:"10px 14px",borderRadius:8,background:"rgba(251,146,60,.04)",border:"1px solid rgba(251,146,60,.18)"}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
            <span style={{fontSize:13}}>!</span>
            <span style={{fontSize:11,fontWeight:700,color:T.or,fontFamily:T.u}}>
              {upcoming.length===1?"Upcoming Reservation":upcoming.length+" Upcoming Reservations"}</span></div>
          {upcoming.map(r=>{const who=personnel.find(p=>p.id===r.personId);return(
            <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderTop:"1px solid rgba(251,146,60,.1)",gap:8}}>
              <div style={{fontSize:10,color:T.tx,fontFamily:T.m,fontWeight:600}}>{who?.name||"Unknown"}</div>
              <div style={{fontSize:9,color:T.or,fontFamily:T.m}}>{fmtDate(r.startDate)} - {fmtDate(r.endDate)}</div></div>)})}</div>}
        {/* Action buttons */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {canCheckout&&<Bt v="primary" onClick={()=>setScanMd("checkout:"+kit.id)} style={{flex:1,justifyContent:"center",padding:"10px 0",fontSize:13}}>Checkout Kit</Bt>}
          {canReturn&&<Bt v="warn" onClick={()=>setScanMd("return:"+kit.id)} style={{flex:1,justifyContent:"center",padding:"10px 0",fontSize:13}}>Return Kit</Bt>}
          <Bt onClick={()=>{if(onNavigateToKit)onNavigateToKit(kit.id);closeScan()}} style={{flex:canCheckout||canReturn?0:1,justifyContent:"center",padding:"10px 16px",fontSize:11}}>View Details</Bt>
          <Bt onClick={()=>setScanMd("scan")} style={{padding:"10px 16px",fontSize:11}}>Scan Again</Bt></div>
      </div></ModalWrap>);}

  /* Phase: checkout serial entry */
  if(scanMd.startsWith("checkout:")){
    const kitId=scanMd.slice(9);const kit=kits.find(k=>k.id===kitId);const ty=kit?types.find(t=>t.id===kit.typeId):null;
    if(!kit||!ty)return <ModalWrap open onClose={closeScan} title="Error"><div style={{color:T.mu}}>Kit or type not found</div></ModalWrap>;
    return(<ModalWrap open onClose={closeScan} title="Checkout Kit" wide>
      <SerialEntryForm kit={kit} type={ty} allC={allC} existingSerials={kit.serials} mode="checkout" settings={settings}
        onDone={async data=>{try{await apiCheckout(kit.id,curUserId,data.serials,data.notes);closeScan()}catch(e){}}}
        onCancel={()=>setScanMd("kit:"+kit.id)}/></ModalWrap>);}

  /* Phase: return serial entry */
  if(scanMd.startsWith("return:")){
    const kitId=scanMd.slice(7);const kit=kits.find(k=>k.id===kitId);const ty=kit?types.find(t=>t.id===kit.typeId):null;
    if(!kit||!ty)return <ModalWrap open onClose={closeScan} title="Error"><div style={{color:T.mu}}>Kit or type not found</div></ModalWrap>;
    return(<ModalWrap open onClose={closeScan} title="Return Kit" wide>
      <SerialEntryForm kit={kit} type={ty} allC={allC} existingSerials={kit.serials} mode="return" settings={settings}
        onDone={async data=>{try{await apiReturn(kit.id,data.serials,data.notes);closeScan()}catch(e){}}}
        onCancel={()=>setScanMd("kit:"+kit.id)}/></ModalWrap>);}

  /* Phase: serial verification */
  if(scanMd.startsWith("serial:")){
    const raw=scanMd.slice(7);const parsed=parseQR(raw);
    if(parsed?.type!=="serial"||!parsed.parts)return <ModalWrap open onClose={closeScan} title="Invalid QR">
      <div style={{textAlign:"center",padding:20,color:T.mu,fontFamily:T.m,fontSize:11}}>Not a valid serial QR code</div></ModalWrap>;
    const[kitIdShort,compKey,serial]=parsed.parts;
    const kit=kits.find(k=>k.id.startsWith(kitIdShort));
    if(!kit)return <ModalWrap open onClose={closeScan} title="Serial Verification"><div style={{textAlign:"center",padding:20}}>
      <div style={{width:56,height:56,borderRadius:28,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,
        background:"rgba(239,68,68,.1)",border:"2px solid "+T.rd,margin:"0 auto 12px"}}>?</div>
      <div style={{fontSize:14,fontWeight:700,color:T.rd,marginBottom:4}}>Kit Not Found</div>
      <div style={{fontSize:11,color:T.mu,fontFamily:T.m}}>No kit matches ID prefix "{kitIdShort}"</div></div></ModalWrap>;
    const ty=types.find(t=>t.id===kit.typeId);const recordedSerial=kit.serials?.[compKey];
    const comp=allC.find(c=>{const parts=compKey.split('#');return c.id===parts[0]});
    const match=recordedSerial&&recordedSerial===serial;
    return(<ModalWrap open onClose={closeScan} title="Serial Verification">
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:14,padding:8}}>
        <div style={{width:64,height:64,borderRadius:32,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,
          background:match?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)",border:"2px solid "+(match?T.gn:T.rd)}}>{match?"\u2713":"\u2717"}</div>
        <div style={{textAlign:"center"}}><div style={{fontSize:16,fontWeight:700,color:match?T.gn:T.rd}}>{match?"Serial Verified":"Mismatch"}</div>
          <div style={{fontSize:11,color:T.mu,fontFamily:T.m,marginTop:4}}>Kit: {kit.color} ({ty?.name||"?"})</div>
          {comp&&<div style={{fontSize:10,color:T.sub,fontFamily:T.m,marginTop:2}}>{comp.label}</div>}</div>
        <div style={{width:"100%",display:"flex",flexDirection:"column",gap:6}}>
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Scanned</span>
            <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{serial}</span></div>
          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>On File</span>
            <span style={{fontSize:11,fontWeight:600,color:recordedSerial?T.tx:T.dm,fontFamily:T.m}}>{recordedSerial||"Not recorded"}</span></div></div>
        <div style={{display:"flex",gap:8,width:"100%"}}>
          <Bt v="primary" onClick={()=>{if(onNavigateToKit)onNavigateToKit(kit.id);closeScan()}} style={{flex:1,justifyContent:"center"}}>View Kit</Bt>
          <Bt onClick={()=>setScanMd("scan")} style={{flex:1,justifyContent:"center"}}>Scan Again</Bt></div></div></ModalWrap>);}

  /* Phase: not found */
  if(scanMd.startsWith("notfound:")){
    const val=scanMd.slice(9);
    return(<ModalWrap open onClose={closeScan} title="QR Not Recognized">
      <div style={{textAlign:"center",padding:20}}>
        <div style={{fontSize:40,marginBottom:12}}>?</div>
        <div style={{fontSize:14,fontWeight:700,color:T.am,marginBottom:6}}>Code Not Recognized</div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:4,wordBreak:"break-all"}}>Scanned: {val}</div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:16}}>This QR code doesn't match any kit or serial in the system</div>
        <div style={{display:"flex",gap:8,justifyContent:"center"}}>
          <Bt v="primary" onClick={()=>setScanMd("scan")}>Scan Again</Bt>
          <Bt onClick={closeScan}>Close</Bt></div></div></ModalWrap>);}

  return null;}

export default ScanAction;
