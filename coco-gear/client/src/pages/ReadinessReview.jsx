import { useState, useEffect } from 'react';
import { T, CM } from '../theme/theme.js';
import { Sw, Bg, Bt, ModalWrap, ProgressBar } from '../components/ui/index.js';
import api from '../api.js';

function ReadinessReview({tripId,tripName,tripStart,tripEnd,open,onClose,onActivate}){
  const[data,setData]=useState(null);const[loading,setLoading]=useState(true);const[error,setError]=useState(null);
  const[expanded,setExpanded]=useState({});const[confirmForce,setConfirmForce]=useState(false);
  const fmtD=d=>d?new Date(d).toLocaleDateString("default",{month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}):"";

  useEffect(()=>{if(!open||!tripId)return;setLoading(true);setError(null);setConfirmForce(false);setExpanded({});
    api.trips.readiness(tripId).then(d=>{setData(d);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})},[open,tripId]);

  const toggle=(id)=>setExpanded(p=>({...p,[id]:!p[id]}));

  const requiredFails=data?data.checks.filter(c=>c.required&&!c.passed).length:0;
  const warningFails=data?data.checks.filter(c=>!c.required&&!c.passed).length:0;

  if(!open)return null;

  return(<ModalWrap open={open} onClose={onClose} title="Deployment Readiness Review" wide>
    {loading&&<div style={{padding:40,textAlign:"center"}}>
      <div style={{fontSize:12,color:T.mu,fontFamily:T.m}}>Checking readiness...</div>
      <div style={{marginTop:12,height:4,borderRadius:2,background:T.card,overflow:"hidden",maxWidth:200,margin:"12px auto 0"}}>
        <div style={{width:"60%",height:"100%",background:T.bl,borderRadius:2,animation:"pulse 1.2s infinite"}}/></div></div>}

    {error&&<div style={{padding:30,textAlign:"center"}}>
      <div style={{fontSize:12,color:T.rd,fontFamily:T.m,marginBottom:12}}>Failed to load readiness data</div>
      <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginBottom:16}}>{error}</div>
      <Bt v="primary" onClick={()=>{setLoading(true);setError(null);api.trips.readiness(tripId).then(d=>{setData(d);setLoading(false)}).catch(e=>{setError(e.message);setLoading(false)})}}>Retry</Bt></div>}

    {data&&!loading&&!error&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{tripName}</div>
          <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginTop:2}}>{fmtD(tripStart)} → {fmtD(tripEnd)}</div></div>
        <div style={{padding:"8px 16px",borderRadius:8,fontFamily:T.m,fontWeight:700,fontSize:11,letterSpacing:.5,
          background:data.ready?"rgba(34,197,94,.12)":"rgba(239,68,68,.12)",
          border:"1px solid "+(data.ready?"rgba(34,197,94,.3)":"rgba(239,68,68,.3)"),
          color:data.ready?T.gn:T.rd}}>
          {data.ready?"READY TO DEPLOY":"NOT READY \u2014 "+requiredFails+" issue"+(requiredFails!==1?"s":"")+" found"}</div></div>

      {/* Score */}
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{flex:1}}><ProgressBar value={data.score.passed} max={Math.max(data.score.total,1)} color={data.ready?T.gn:requiredFails>0?T.rd:T.am} height={6}/></div>
        <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m,whiteSpace:"nowrap"}}>{data.score.passed}/{data.score.total} checks passed</span></div>

      {/* Checklist */}
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {data.checks.map(c=>{const hasFailures=c.failures&&c.failures.length>0;const isExpanded=expanded[c.id];
          const iconColor=c.passed?T.gn:(c.required?T.rd:T.am);
          const icon=c.passed?"\u2713":(c.required?"\u2717":"\u26A0");
          return(<div key={c.id} style={{borderRadius:8,border:"1px solid "+T.bd,overflow:"hidden"}}>
            <div onClick={hasFailures?()=>toggle(c.id):undefined}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:hasFailures?"pointer":"default",
                background:c.passed?"rgba(34,197,94,.03)":(c.required?"rgba(239,68,68,.03)":"rgba(251,191,36,.03)")}}>
              <div style={{width:22,height:22,borderRadius:11,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,fontWeight:700,background:iconColor+"18",color:iconColor,border:"1px solid "+iconColor+"33"}}>{icon}</div>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{c.label}</span>
                {c.details&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:1}}>{c.details}</div>}</div>
              <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
                {c.required?<Bg color={T.rd} bg="rgba(239,68,68,.1)">Required</Bg>:<Bg color={T.am} bg="rgba(251,191,36,.1)">Warning</Bg>}
                {hasFailures&&<span style={{fontSize:10,color:T.dm,transition:"transform .15s",transform:isExpanded?"rotate(90deg)":"rotate(0deg)"}}>\u25B6</span>}</div></div>

            {/* Expandable failure details */}
            {hasFailures&&isExpanded&&<div style={{padding:"8px 14px 10px",borderTop:"1px solid "+T.bd,background:"rgba(0,0,0,.15)"}}>
              <div style={{display:"flex",flexDirection:"column",gap:3}}>
                {c.id==="kits_inspected"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <Sw color={f.kitColor} size={12}/><span style={{fontWeight:600}}>{f.kitColor}</span><span style={{color:T.dm}}>{f.kitType}</span>
                  <span style={{marginLeft:"auto",color:T.rd}}>{f.daysAgo===null?"Never inspected":"Last inspected "+f.daysAgo+"d ago"}</span></div>)}

                {c.id==="kits_no_maintenance"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <Sw color={f.kitColor} size={12}/><span style={{fontWeight:600}}>{f.kitColor}</span><span style={{color:T.dm}}>{f.kitType}</span>
                  <span style={{marginLeft:"auto",color:T.rd}}>In maintenance: {f.maintenanceStatus}</span></div>)}

                {c.id==="kits_no_damage"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <Sw color={f.kitColor} size={12}/><span style={{fontWeight:600}}>{f.kitColor}</span>
                  <span style={{color:T.am}}>{f.status}: {f.componentLabel}{f.slotIndex>0?" #"+f.slotIndex:""}</span></div>)}

                {c.id==="calibrations_current"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <Sw color={f.kitColor} size={12}/><span style={{fontWeight:600}}>{f.kitColor}</span>
                  <span style={{color:T.am}}>{f.componentLabel}</span>
                  <span style={{marginLeft:"auto",color:T.rd}}>{f.lastCalibration?("Overdue by "+Math.abs(f.dueIn)+"d"):"Never calibrated"}</span></div>)}

                {c.id==="usvs_available"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <span style={{fontSize:11}}>⛵</span><span style={{fontWeight:600}}>{f.boatName}</span>
                  <span style={{marginLeft:"auto",color:T.rd}}>Status: {f.status}</span></div>)}

                {c.id==="critical_tasks_done"&&c.failures.map((f,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:9,fontFamily:T.m,color:T.sub}}>
                  <span style={{color:T.am,fontWeight:600}}>{f.taskTitle}</span><span style={{color:T.dm}}>{f.phase}</span>
                  {f.assignedTo&&<span style={{marginLeft:"auto",color:T.dm}}>{f.assignedTo}</span>}</div>)}
              </div></div>}</div>)})}</div>

      {/* Actions */}
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,alignItems:"center",flexWrap:"wrap",paddingTop:8,borderTop:"1px solid "+T.bd}}>
        {warningFails>0&&requiredFails===0&&<div style={{flex:1,fontSize:9,color:T.am,fontFamily:T.m}}>
          {warningFails} warning{warningFails!==1?"s":""} \u2014 review recommended but not required</div>}

        {requiredFails>0&&!confirmForce&&<>
          <Bt onClick={onClose}>Go Back</Bt>
          <Bt v="danger" sm onClick={()=>setConfirmForce(true)}>Activate Anyway</Bt></>}

        {requiredFails>0&&confirmForce&&<>
          <div style={{flex:1,fontSize:10,color:T.rd,fontFamily:T.m,fontWeight:600}}>
            Are you sure? {requiredFails} required check{requiredFails!==1?"s have":" has"} not passed.</div>
          <Bt onClick={()=>setConfirmForce(false)}>Cancel</Bt>
          <Bt v="danger" onClick={()=>{onActivate();onClose()}}>Confirm Activate</Bt></>}

        {requiredFails===0&&<>
          <Bt onClick={onClose}>Go Back</Bt>
          <Bt v="success" onClick={()=>{onActivate();onClose()}}>Activate Trip</Bt></>}
      </div>
    </div>}
  </ModalWrap>);}

export default ReadinessReview;
