import { useState } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';
import { Sw, Bg, Bt, Fl, In, Ta, Sl, SH, Tabs, ModalWrap } from '../components/ui/index.js';

function MaintenancePage({kits,setKits,types,locs,personnel,addLog,curUserId,onSendMaint,onReturnMaint}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({reason:"",notes:"",type:"repair"});
  const inMaint=kits.filter(k=>k.maintenanceStatus);const available=kits.filter(k=>!k.maintenanceStatus&&!k.issuedTo);

  const sendToMaint=async(kitId)=>{
    try{await onSendMaint(kitId,fm.type,fm.reason,fm.notes)}catch(e){/* handled in parent */}
    setMd(null);setFm({reason:"",notes:"",type:"repair"})};

  const returnFromMaint=async(kitId)=>{
    try{await onReturnMaint(kitId,"")}catch(e){/* handled in parent */}};

  return(<div>
    <SH title="Maintenance" sub={inMaint.length+" in maintenance | "+available.length+" available"}
      action={<Bt v="primary" onClick={()=>setMd("send")}>Send to Maintenance</Bt>}/>

    {inMaint.length>0&&<div style={{marginBottom:24}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:10}}>Currently in Maintenance</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:10}}>
        {inMaint.map(k=>{const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
          const cur=k.maintenanceHistory[k.maintenanceHistory.length-1];const startedBy=cur?personnel.find(p=>p.id===cur.startedBy):null;
          return(<div key={k.id} style={{padding:16,borderRadius:10,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.15)"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
              <Sw color={k.color} size={28}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>Kit {k.color}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{ty?.name} | {lo?.name}</div></div>
              <Bg color={T.am} bg="rgba(251,191,36,.1)">{k.maintenanceStatus}</Bg></div>
            {cur&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:8}}>
              <div>Started: {cur.startDate} by {startedBy?.name||"?"}</div>
              {cur.reason&&<div>Reason: {cur.reason}</div>}</div>}
            <Bt v="success" sm onClick={()=>returnFromMaint(k.id)}>Return to Service</Bt></div>)})}</div></div>}

    {/* Maintenance History */}
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:10}}>Recent History</div>
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {kits.flatMap(k=>k.maintenanceHistory.map(h=>({...h,kit:k}))).sort((a,b)=>new Date(b.startDate)-new Date(a.startDate)).slice(0,20).map(h=>{
        const by=personnel.find(p=>p.id===h.startedBy);
        return(<div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
          <Sw color={h.kit.color} size={20}/>
          <div style={{flex:1}}><div style={{fontSize:11,color:T.tx,fontFamily:T.m}}><span style={{fontWeight:600}}>Kit {h.kit.color}</span> - {h.type}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{h.reason}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:T.tx,fontFamily:T.m}}>{h.startDate}{h.endDate?" → "+h.endDate:""}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{by?.name}</div></div>
          <Bg color={h.endDate?T.gn:T.am} bg={h.endDate?"rgba(34,197,94,.1)":"rgba(251,191,36,.1)"}>{h.endDate?"Complete":"Active"}</Bg></div>)})}
      {kits.every(k=>!k.maintenanceHistory.length)&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No maintenance history</div>}</div>

    <ModalWrap open={md==="send"} onClose={()=>setMd(null)} title="Send to Maintenance">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Select Kit"><Sl options={[{v:"",l:"-- Select --"},...available.map(k=>({v:k.id,l:`Kit ${k.color}`}))]}
          value={fm.kitId||""} onChange={e=>setFm(p=>({...p,kitId:e.target.value}))}/></Fl>
        <Fl label="Type"><Sl options={[{v:"repair",l:"Repair"},{v:"calibration",l:"Calibration"},{v:"upgrade",l:"Upgrade"},{v:"cleaning",l:"Cleaning"}]}
          value={fm.type} onChange={e=>setFm(p=>({...p,type:e.target.value}))}/></Fl>
        <Fl label="Reason"><In value={fm.reason} onChange={e=>setFm(p=>({...p,reason:e.target.value}))} placeholder="What needs to be done?"/></Fl>
        <Fl label="Notes"><Ta value={fm.notes} onChange={e=>setFm(p=>({...p,notes:e.target.value}))} rows={2}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="warn" onClick={()=>sendToMaint(fm.kitId)} disabled={!fm.kitId}>Send to Maintenance</Bt></div></div></ModalWrap></div>);}

export default MaintenancePage;
