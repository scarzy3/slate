import { useMemo } from 'react';
import { daysAgo, daysUntil, expandComps } from '../theme/helpers.js';

function useAnalytics(kits,personnel,depts,comps,types,logs,reservations){
  return useMemo(()=>{
    const now=Date.now();const day=864e5;
    /* Kit utilization */
    const kitUtil=kits.map(k=>{
      const checkouts=k.issueHistory.length;
      const totalDaysOut=k.issueHistory.reduce((a,h)=>{
        const start=new Date(h.issuedDate).getTime();const end=h.returnedDate?new Date(h.returnedDate).getTime():now;
        return a+(end-start)/day},0);
      return{kit:k,checkouts,totalDaysOut:Math.round(totalDaysOut),avgDuration:checkouts?Math.round(totalDaysOut/checkouts):0}});
    const mostUsedKits=[...kitUtil].sort((a,b)=>b.checkouts-a.checkouts).slice(0,5);
    const leastUsedKits=[...kitUtil].sort((a,b)=>a.checkouts-b.checkouts).slice(0,5);
    const idleKits=kits.filter(k=>k.issueHistory.length===0&&!k.issuedTo);

    /* Personnel accountability */
    const userStats=personnel.map(p=>{
      const checkouts=kits.flatMap(k=>k.issueHistory.filter(h=>h.personId===p.id));
      const returns=checkouts.filter(h=>h.returnedDate);
      const active=checkouts.filter(h=>!h.returnedDate);
      const overdueCount=active.filter(h=>(now-new Date(h.issuedDate).getTime())/day>14).length;
      /* Count damage/missing from inspections where user had kit */
      let damageCount=0,missingCount=0;
      kits.forEach(k=>{k.inspections.forEach(ins=>{
        const wasHolder=k.issueHistory.some(h=>h.personId===p.id&&new Date(h.issuedDate)<=new Date(ins.date)&&(!h.returnedDate||new Date(h.returnedDate)>=new Date(ins.date)));
        if(wasHolder){Object.values(ins.results).forEach(r=>{if(r==="DAMAGED")damageCount++;if(r==="MISSING")missingCount++})}})});
      return{person:p,totalCheckouts:checkouts.length,activeCheckouts:active.length,overdueCount,damageCount,missingCount}});
    const problemUsers=userStats.filter(u=>u.overdueCount>0||u.damageCount>0||u.missingCount>0);

    /* Component reliability */
    const compStats=comps.map(c=>{
      let damaged=0,missing=0,total=0;
      kits.forEach(k=>{const ty=types.find(t=>t.id===k.typeId);const q=(ty?.compQtys||{})[c.id]||1;
        k.inspections.forEach(ins=>{for(let i=0;i<q;i++){const key=q>1?c.id+"#"+i:c.id;if(ins.results[key]){total++;if(ins.results[key]==="DAMAGED")damaged++;if(ins.results[key]==="MISSING")missing++}}})});
      return{comp:c,damaged,missing,total,failRate:total?(damaged+missing)/total:0}});
    const problemComps=[...compStats].sort((a,b)=>b.failRate-a.failRate).filter(c=>c.failRate>0).slice(0,10);

    /* Department performance */
    const deptStats=depts.map(d=>{
      const deptKits=kits.filter(k=>k.deptId===d.id);
      const inspected=deptKits.filter(k=>k.lastChecked&&daysAgo(k.lastChecked)<=30).length;
      const compliance=deptKits.length?inspected/deptKits.length:0;
      let totalDamage=0,totalMissing=0;
      deptKits.forEach(k=>{Object.values(k.comps).forEach(v=>{if(v==="DAMAGED")totalDamage++;if(v==="MISSING")totalMissing++})});
      const issued=deptKits.filter(k=>k.issuedTo).length;
      return{dept:d,kitCount:deptKits.length,compliance,totalDamage,totalMissing,issuedCount:issued}});

    /* Inspection health */
    const overdueInspection=kits.filter(k=>!k.lastChecked||daysAgo(k.lastChecked)>30);
    const inspectionRate=kits.length?(kits.length-overdueInspection.length)/kits.length:0;
    const recentInspections=kits.flatMap(k=>k.inspections.map(i=>({...i,kit:k}))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,10);

    /* Overdue returns */
    const overdueReturns=kits.filter(k=>{if(!k.issuedTo)return false;const h=k.issueHistory[k.issueHistory.length-1];
      return h&&!h.returnedDate&&daysAgo(h.issuedDate)>14});

    /* Calibration due */
    const calibrationDue=[];
    kits.forEach(k=>{const ty=types.find(t=>t.id===k.typeId);if(!ty)return;
      const ex=expandComps(ty.compIds,ty.compQtys||{});
      ex.forEach(e=>{const c=comps.find(x=>x.id===e.compId);if(c&&c.calibrationRequired){
        const lastCal=k.calibrationDates[e.key];const due=lastCal?daysUntil(new Date(new Date(lastCal).getTime()+c.calibrationIntervalDays*day).toISOString()):0;
        const lbl=e.qty>1?c.label+" ("+(e.idx+1)+" of "+e.qty+")":c.label;
        if(due!==null&&due<=30)calibrationDue.push({kit:k,comp:{...c,label:lbl},dueIn:due,lastCal})}})});

    /* Activity trends (last 7 days) */
    const last7=Array(7).fill(0).map((_,i)=>{const d=new Date(now-i*day).toISOString().slice(0,10);
      return{date:d,checkouts:logs.filter(l=>l.action==="checkout"&&l.date.slice(0,10)===d).length,
        returns:logs.filter(l=>l.action==="return"&&l.date.slice(0,10)===d).length,
        inspections:logs.filter(l=>l.action==="inspect"&&l.date.slice(0,10)===d).length}}).reverse();

    /* Maintenance */
    const inMaintenance=kits.filter(k=>k.maintenanceStatus);

    return{kitUtil,mostUsedKits,leastUsedKits,idleKits,userStats,problemUsers,compStats,problemComps,
      deptStats,overdueInspection,inspectionRate,recentInspections,overdueReturns,calibrationDue,
      last7,inMaintenance}},
  [kits,personnel,depts,comps,types,logs,reservations]);}

export default useAnalytics;
