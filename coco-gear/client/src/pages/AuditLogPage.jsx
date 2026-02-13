import { useState, useMemo, useEffect, useCallback } from 'react';
import { T } from '../theme/theme.js';
import { fmtDate, SYS_ROLE_LABELS, sysRoleColor } from '../theme/helpers.js';
import { Bg, Bt, In, SH, Sl, Tabs, StatCard, Sw } from '../components/ui/index.js';
import api from '../api.js';

/* ─── Constants ─── */
const ACTION_COLORS={
  checkout:T.bl,return:T.gn,inspect:T.tl,
  maintenance_start:T.am,maintenance_end:T.gn,maintenance_return:T.gn,
  location_change:T.ind,
  kit_create:T.bl,kit_update:T.ind,kit_delete:T.rd,
  asset_create:T.bl,asset_update:T.ind,asset_delete:T.rd,asset_checkout:T.bl,asset_return:T.gn,
  consumable_create:T.bl,consumable_update:T.ind,consumable_delete:T.rd,consumable_adjust:T.or,
  personnel_create:T.bl,personnel_update:T.ind,personnel_delete:T.rd,personnel_bulk_import:T.pu,
  trip_create:T.bl,trip_update:T.ind,trip_delete:T.rd,
  trip_assign_kits:T.tl,trip_remove_kit:T.rd,trip_add_personnel:T.tl,trip_remove_personnel:T.rd,trip_add_personnel_bulk:T.pu,
  trip_assign_boats:T.tl,trip_remove_boat:T.rd,
  reservation_create:T.pu,reservation_approve:T.gn,reservation_cancel:T.rd,reservation_delete:T.rd,
  component_create:T.bl,component_update:T.ind,component_delete:T.rd,
  location_create:T.bl,location_update:T.ind,location_delete:T.rd,
  department_create:T.bl,department_update:T.ind,department_delete:T.rd,
  boat_create:T.bl,boat_update:T.ind,boat_delete:T.rd,
  type_create:T.bl,type_update:T.ind,type_delete:T.rd,
  settings_update:T.am,self_signup:T.pu,
  checkout_request:T.am,resolve_degraded:T.gn,serial_update:T.ind,
  approved:T.gn,denied:T.rd,
};

const ACTION_ICONS={
  checkout:"\u2197",return:"\u21A9",inspect:"\u2713",maintenance_start:"\u2699",maintenance_end:"\u2713",maintenance_return:"\u2713",
  location_change:"\u2316",
  kit_create:"+",kit_update:"\u270E",kit_delete:"\u2717",
  asset_create:"+",asset_update:"\u270E",asset_delete:"\u2717",asset_checkout:"\u2197",asset_return:"\u21A9",
  consumable_create:"+",consumable_update:"\u270E",consumable_delete:"\u2717",consumable_adjust:"\u0394",
  personnel_create:"+",personnel_update:"\u270E",personnel_delete:"\u2717",personnel_bulk_import:"\u21D1",
  trip_create:"+",trip_update:"\u270E",trip_delete:"\u2717",
  trip_assign_kits:"\u2192",trip_remove_kit:"\u2190",trip_add_personnel:"\u2192",trip_remove_personnel:"\u2190",trip_add_personnel_bulk:"\u21D1",
  trip_assign_boats:"\u2192",trip_remove_boat:"\u2190",
  reservation_create:"+",reservation_approve:"\u2713",reservation_cancel:"\u2717",reservation_delete:"\u2717",
  component_create:"+",component_update:"\u270E",component_delete:"\u2717",
  location_create:"+",location_update:"\u270E",location_delete:"\u2717",
  department_create:"+",department_update:"\u270E",department_delete:"\u2717",
  boat_create:"+",boat_update:"\u270E",boat_delete:"\u2717",
  type_create:"+",type_update:"\u270E",type_delete:"\u2717",
  settings_update:"\u2699",self_signup:"\u2713",
  checkout_request:"\u21BB",resolve_degraded:"\u2713",serial_update:"\u270E",
  approved:"\u2713",denied:"\u2717",
};

const TARGET_COLORS={kit:T.pk,asset:T.or,consumable:T.am,user:T.pu,reservation:T.bl,trip:T.tl,
  component:T.ind,location:T.cy||T.tl,department:T.gn,boat:T.bl,type:T.ind,settings:T.am};

const ACTION_CATEGORIES={
  'Kit Operations':['checkout','checkout_request','return','inspect','kit_create','kit_update','kit_delete','serial_update','resolve_degraded','location_change'],
  'Maintenance':['maintenance_start','maintenance_end','maintenance_return'],
  'Assets':['asset_create','asset_update','asset_delete','asset_checkout','asset_return'],
  'Consumables':['consumable_create','consumable_update','consumable_delete','consumable_adjust'],
  'Personnel':['personnel_create','personnel_update','personnel_delete','personnel_bulk_import','self_signup'],
  'Trips':['trip_create','trip_update','trip_delete','trip_assign_kits','trip_remove_kit','trip_add_personnel','trip_remove_personnel','trip_add_personnel_bulk','trip_assign_boats','trip_remove_boat'],
  'Reservations':['reservation_create','reservation_approve','reservation_cancel','reservation_delete','approved','denied'],
  'Configuration':['component_create','component_update','component_delete','location_create','location_update','location_delete',
    'department_create','department_update','department_delete','boat_create','boat_update','boat_delete','type_create','type_update','type_delete','settings_update'],
};

const DETAIL_LABELS={
  kitColor:'Kit',typeId:'Kit Type',locId:'Location',from:'From',to:'To',recipientId:'Recipient',
  serialCount:'Serial Count',resolved:'Resolved',type:'Type',reason:'Reason',name:'Name',
  previousQty:'Previous Qty',newQty:'New Qty',delta:'Change',role:'Role',count:'Count',
  emails:'Emails',status:'Status',kitCount:'Kit Count',autoReserve:'Auto Reserve',
  kitId:'Kit',startDate:'Start Date',endDate:'End Date',purpose:'Purpose',
  notes:'Notes',category:'Category',sku:'SKU',unit:'Unit',qty:'Quantity',minQty:'Min Qty',
  serial:'Serial',condition:'Condition',hullId:'Hull ID',length:'Length',homePort:'Home Port',
  site:'Site',color:'Color',desc:'Description',key:'Key',label:'Label',shortCode:'Code',
  tripRole:'Trip Role',boatId:'Boat',tripId:'Trip',personId:'Person',
  deptId:'Department',inspector:'Inspector',
};

/* ─── Helpers ─── */
function relativeTime(dateStr){
  const d=new Date(dateStr),now=new Date(),diff=now-d,s=Math.floor(diff/1000),m=Math.floor(s/60),h=Math.floor(m/60),dy=Math.floor(h/24);
  if(s<60)return 'just now';if(m<60)return m+'m ago';if(h<24)return h+'h ago';if(dy<7)return dy+'d ago';return fmtDate(dateStr);
}

function formatAction(action){return(action||'').replace(/_/g,' ')}

function getActionCategory(action){
  for(const[cat,actions]of Object.entries(ACTION_CATEGORIES)){if(actions.includes(action))return cat}
  return 'Other';
}

/* ─── Detail Resolver ─── */
function resolveDetailValue(key,val,refs){
  if(val===null||val===undefined)return '—';
  if(key==='typeId'&&refs.types){const t=refs.types.find(x=>x.id===val);if(t)return t.name}
  if(key==='locId'&&refs.locs){const l=refs.locs.find(x=>x.id===val);if(l)return l.name}
  if(key==='deptId'&&refs.depts){const d=refs.depts.find(x=>x.id===val);if(d)return d.name}
  if((key==='recipientId'||key==='personId'||key==='inspector')&&refs.personnel){const p=refs.personnel.find(x=>x.id===val);if(p)return p.name}
  if(key==='kitId'&&refs.kits){const k=refs.kits.find(x=>x.id===val);if(k)return 'Kit '+k.color}
  if(key==='tripId'&&refs.trips){const t=refs.trips.find(x=>x.id===val);if(t)return t.name;return 'Restricted trip'}
  if(key==='boatId'&&refs.boats){const b=refs.boats.find(x=>x.id===val);if(b)return b.name}
  if(key==='from'||key==='to'){
    if(refs.locs){const l=refs.locs.find(x=>x.id===val);if(l)return l.name}
    if(refs.personnel){const p=refs.personnel.find(x=>x.id===val);if(p)return p.name}
  }
  if(typeof val==='boolean')return val?'Yes':'No';
  if(Array.isArray(val))return val.join(', ');
  if(typeof val==='object')return JSON.stringify(val);
  return String(val);
}

function resolveTargetName(log,refs){
  if(!log.targetId)return null;
  const t=log.target;
  if(t==='kit'&&refs.kits){const k=refs.kits.find(x=>x.id===log.targetId);if(k)return 'Kit '+k.color}
  if(t==='asset'&&refs.assets){const a=refs.assets.find(x=>x.id===log.targetId);if(a)return a.name}
  if(t==='consumable'&&refs.consumables){const c=refs.consumables.find(x=>x.id===log.targetId);if(c)return c.name}
  if((t==='user'||t==='personnel')&&refs.personnel){const p=refs.personnel.find(x=>x.id===log.targetId);if(p)return p.name}
  if(t==='reservation'&&refs.reservations){const r=refs.reservations.find(x=>x.id===log.targetId);if(r){const k=refs.kits?.find(x=>x.id===r.kitId);return k?'Reservation for Kit '+k.color:'Reservation'}}
  if(t==='trip'&&refs.trips){const tr=refs.trips.find(x=>x.id===log.targetId);if(tr)return tr.name;return 'Restricted trip'}
  if(t==='component'&&refs.comps){const c=refs.comps.find(x=>x.id===log.targetId);if(c)return c.label}
  if(t==='location'&&refs.locs){const l=refs.locs.find(x=>x.id===log.targetId);if(l)return l.name}
  if(t==='department'&&refs.depts){const d=refs.depts.find(x=>x.id===log.targetId);if(d)return d.name}
  if(t==='boat'&&refs.boats){const b=refs.boats.find(x=>x.id===log.targetId);if(b)return b.name}
  if(t==='type'&&refs.types){const ty=refs.types.find(x=>x.id===log.targetId);if(ty)return ty.name}
  return log.targetId.slice(0,8)+'...';
}

/* ─── CSV Export ─── */
function exportCSV(logs,refs){
  const headers=['Date','Action','Category','Actor','Target Type','Target','Details'];
  const rows=logs.map(l=>{
    const actor=refs.personnel?.find(x=>x.id===l.by)?.name||'System';
    const targetName=resolveTargetName(l,refs)||'';
    const details=Object.entries(l.details||{}).map(([k,v])=>`${DETAIL_LABELS[k]||k}: ${resolveDetailValue(k,v,refs)}`).join('; ');
    return[new Date(l.date).toISOString(),l.action,getActionCategory(l.action),actor,l.target||'',targetName,details];
  });
  const csv=[headers,...rows].map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='audit_log_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

/* ─── Detail Panel Component ─── */
function DetailPanel({log,refs}){
  const details=log.details||{};
  const entries=Object.entries(details).filter(([,v])=>v!==null&&v!==undefined&&v!=='');
  const targetName=resolveTargetName(log,refs);
  const actor=refs.personnel?.find(x=>x.id===log.by);
  const actorColor=actor?sysRoleColor(actor.role):T.mu;

  return(
    <div style={{padding:'16px 20px',background:T.bg,borderTop:'1px solid '+T.bd,animation:'mdIn .15s ease-out'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:entries.length?16:0}}>
        {/* Left: Event metadata */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600}}>Event Details</div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Timestamp</div>
            <div style={{fontSize:11,color:T.tx,fontFamily:T.m,fontWeight:500}}>{new Date(log.date).toLocaleString('en-US',{weekday:'short',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Actor</div>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:20,height:20,borderRadius:10,background:actorColor+'22',display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:8,fontWeight:700,color:actorColor,fontFamily:T.m}}>
                {actor?actor.name.split(' ').map(n=>n[0]).join('').slice(0,2):'SY'}</div>
              <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{actor?.name||'System'}</span>
              {actor&&<Bg color={actorColor} bg={actorColor+'18'}>{SYS_ROLE_LABELS[actor.role]||actor.role}</Bg>}
            </div>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Action</div>
            <Bg color={ACTION_COLORS[log.action]||T.mu} bg={(ACTION_COLORS[log.action]||T.mu)+'18'}>{formatAction(log.action)}</Bg>
          </div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Category</div>
            <span style={{fontSize:11,color:T.sub,fontFamily:T.m}}>{getActionCategory(log.action)}</span>
          </div>
        </div>

        {/* Right: Target info */}
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600}}>Target</div>

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Type</div>
            <Bg color={TARGET_COLORS[log.target]||T.mu} bg={(TARGET_COLORS[log.target]||T.mu)+'18'}>{log.target||'—'}</Bg>
          </div>

          {targetName&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Name</div>
            <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>
              {log.target==='kit'&&refs.kits?<span style={{display:'inline-flex',alignItems:'center',gap:4}}>
                <Sw color={refs.kits.find(x=>x.id===log.targetId)?.color} size={14}/>{targetName}</span>:targetName}
            </span>
          </div>}

          {log.targetId&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>ID</div>
            <span style={{fontSize:10,color:T.dm,fontFamily:T.m,fontVariantNumeric:'tabular-nums',userSelect:'all'}}>{log.targetId}</span>
          </div>}

          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <div style={{fontSize:10,color:T.dm,fontFamily:T.m,width:70}}>Event ID</div>
            <span style={{fontSize:10,color:T.dm,fontFamily:T.m,fontVariantNumeric:'tabular-nums',userSelect:'all'}}>{log.id}</span>
          </div>
        </div>
      </div>

      {/* Detail fields */}
      {entries.length>0&&<div>
        <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600,marginBottom:8}}>Context</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:6}}>
          {entries.map(([k,v])=>(
            <div key={k} style={{display:'flex',gap:8,alignItems:'baseline',padding:'6px 10px',borderRadius:5,background:T.card,border:'1px solid '+T.bd}}>
              <span style={{fontSize:10,color:T.dm,fontFamily:T.m,minWidth:80,flexShrink:0}}>{DETAIL_LABELS[k]||k}</span>
              <span style={{fontSize:11,color:T.tx,fontFamily:T.m,fontWeight:500,wordBreak:'break-word'}}>{resolveDetailValue(k,v,refs)}</span>
            </div>))}
        </div>
      </div>}
    </div>);
}

/* ─── Stats Panel Component ─── */
function StatsPanel({logs,stats,refs}){
  const topTargets=(stats?.byTarget||[]).slice(0,5);
  const topActions=(stats?.byAction||[]).slice(0,8);
  const topActors=(stats?.topActors||[]).slice(0,5);
  const total=stats?.total||logs.length;

  // Calculate rate from logs
  const last24h=logs.filter(l=>new Date(l.date)>new Date(Date.now()-86400000)).length;
  const last7d=logs.filter(l=>new Date(l.date)>new Date(Date.now()-604800000)).length;

  return(
    <div style={{marginBottom:20}}>
      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8,marginBottom:16}}>
        <StatCard label="Total Events" value={total} color={T.bl}/>
        <StatCard label="Last 24 Hours" value={last24h} color={T.gn} sub={last24h>0?Math.round(last24h/24*10)/10+'/hr':'quiet'}/>
        <StatCard label="Last 7 Days" value={last7d} color={T.ind} sub={last7d>0?Math.round(last7d/7)+'/day':'quiet'}/>
        <StatCard label="Unique Actions" value={new Set(logs.map(l=>l.action)).size} color={T.pu}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
        {/* Top Actions */}
        <div style={{padding:14,borderRadius:9,background:T.card,border:'1px solid '+T.bd}}>
          <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600,marginBottom:10}}>Top Actions</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {topActions.map(a=>{const pct=total>0?Math.round(a.count/total*100):0;return(
              <div key={a.action} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1,fontSize:10,color:T.tx,fontFamily:T.m}}>{formatAction(a.action)}</div>
                <div style={{width:60,height:4,borderRadius:2,background:T.bd,overflow:'hidden'}}>
                  <div style={{width:pct+'%',height:'100%',borderRadius:2,background:ACTION_COLORS[a.action]||T.mu}}/></div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,width:28,textAlign:'right'}}>{a.count}</div>
              </div>)})}
          </div>
        </div>

        {/* Top Targets */}
        <div style={{padding:14,borderRadius:9,background:T.card,border:'1px solid '+T.bd}}>
          <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600,marginBottom:10}}>By Target Type</div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {topTargets.map(t=>{const pct=total>0?Math.round(t.count/total*100):0;return(
              <div key={t.target} style={{display:'flex',alignItems:'center',gap:8}}>
                <Bg color={TARGET_COLORS[t.target]||T.mu} bg={(TARGET_COLORS[t.target]||T.mu)+'18'}>{t.target}</Bg>
                <div style={{flex:1}}/>
                <div style={{width:60,height:4,borderRadius:2,background:T.bd,overflow:'hidden'}}>
                  <div style={{width:pct+'%',height:'100%',borderRadius:2,background:TARGET_COLORS[t.target]||T.mu}}/></div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,width:28,textAlign:'right'}}>{t.count}</div>
              </div>)})}
          </div>
        </div>

        {/* Top Actors */}
        <div style={{padding:14,borderRadius:9,background:T.card,border:'1px solid '+T.bd}}>
          <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600,marginBottom:10}}>Most Active Users</div>
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {topActors.map((a,i)=>{const rc=sysRoleColor(a.role);return(
              <div key={a.userId} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{width:18,height:18,borderRadius:9,background:rc+'22',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:7,fontWeight:700,color:rc,fontFamily:T.m}}>{i+1}</div>
                <div style={{flex:1,fontSize:10,color:T.tx,fontFamily:T.m,fontWeight:500}}>{a.name}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{a.count}</div>
              </div>)})}
            {!topActors.length&&<div style={{fontSize:10,color:T.dm,fontFamily:T.m}}>No data</div>}
          </div>
        </div>
      </div>
    </div>);
}

/* ─── Activity Heatmap (30 day) ─── */
function ActivityHeatmap({logs}){
  const days=useMemo(()=>{
    const map={};const now=new Date();
    for(let i=29;i>=0;i--){const d=new Date(now);d.setDate(d.getDate()-i);const key=d.toISOString().slice(0,10);map[key]=0}
    logs.forEach(l=>{const key=new Date(l.date).toISOString().slice(0,10);if(key in map)map[key]++});
    return Object.entries(map);
  },[logs]);
  const max=Math.max(1,...days.map(([,c])=>c));

  return(
    <div style={{marginBottom:16,padding:14,borderRadius:9,background:T.card,border:'1px solid '+T.bd}}>
      <div style={{fontSize:9,textTransform:'uppercase',letterSpacing:1.2,color:T.mu,fontFamily:T.m,fontWeight:600,marginBottom:10}}>30-Day Activity</div>
      <div style={{display:'flex',gap:2,alignItems:'flex-end',height:40}}>
        {days.map(([day,count])=>{const h=count>0?Math.max(4,Math.round(count/max*36)):2;
          return(<div key={day} title={day+': '+count+' events'} style={{flex:1,height:h,borderRadius:2,
            background:count===0?T.bd:count/max>0.7?T.bl:count/max>0.3?T.ind+'88':T.ind+'44',
            cursor:'default',transition:'height .2s'}}/>)})}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
        <span style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{days[0]?.[0]}</span>
        <span style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{days[days.length-1]?.[0]}</span>
      </div>
    </div>);
}

/* ─── Log Row Component ─── */
function LogRow({log,refs,expanded,onToggle}){
  const actor=refs.personnel?.find(x=>x.id===log.by);
  const targetName=resolveTargetName(log,refs);
  const color=ACTION_COLORS[log.action]||T.mu;
  const icon=ACTION_ICONS[log.action]||'\u2022';
  const details=log.details||{};
  const hasDetails=Object.keys(details).length>0||log.targetId;

  // Build a readable summary from details
  const summaryParts=[];
  if(details.kitColor)summaryParts.push('Kit '+details.kitColor);
  else if(targetName)summaryParts.push(targetName);
  if(details.reason)summaryParts.push(details.reason);
  if(details.name&&!targetName?.includes(details.name))summaryParts.push(details.name);
  if(details.from&&details.to){
    const fromName=resolveDetailValue('from',details.from,refs);
    const toName=resolveDetailValue('to',details.to,refs);
    summaryParts.push(fromName+' \u2192 '+toName);
  }
  if(details.previousQty!==undefined&&details.newQty!==undefined){
    summaryParts.push(details.previousQty+' \u2192 '+details.newQty);
  }
  if(details.status)summaryParts.push(details.status);
  if(details.count)summaryParts.push(details.count+' items');

  return(
    <div style={{borderRadius:8,background:T.card,border:'1px solid '+(expanded?T.bdH:T.bd),overflow:'hidden',transition:'border-color .12s'}}>
      <button onClick={onToggle} style={{all:'unset',cursor:'pointer',display:'flex',alignItems:'center',gap:12,padding:'10px 14px',width:'100%',boxSizing:'border-box',
        transition:'background .1s'}}
        onMouseEnter={e=>e.currentTarget.style.background=T.cardH}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>

        {/* Icon */}
        <div style={{width:30,height:30,borderRadius:15,background:color+'22',flexShrink:0,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:color}}>{icon}</div>

        {/* Content */}
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
            <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{actor?.name||'System'}</span>
            <span style={{fontSize:11,color:T.mu,fontFamily:T.m}}>{formatAction(log.action)}</span>
            {summaryParts.length>0&&<span style={{fontSize:11,color:T.sub,fontFamily:T.m}}>
              {log.target==='kit'&&details.kitColor?<span style={{display:'inline-flex',alignItems:'center',gap:3}}>
                <Sw color={details.kitColor} size={10}/>{summaryParts[0]}</span>:summaryParts[0]}
              {summaryParts.length>1&&<span style={{color:T.dm}}>{' \u2014 '+summaryParts.slice(1).join(', ')}</span>}
            </span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginTop:2}}>
            <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{relativeTime(log.date)}</span>
            <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{new Date(log.date).toLocaleString()}</span>
          </div>
        </div>

        {/* Right side: badges */}
        <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          {log.target&&<Bg color={TARGET_COLORS[log.target]||T.mu} bg={(TARGET_COLORS[log.target]||T.mu)+'12'}>{log.target}</Bg>}
          <Bg color={color} bg={color+'18'}>{formatAction(log.action)}</Bg>
          {hasDetails&&<span style={{fontSize:10,color:expanded?T.bl:T.dm,transition:'color .12s,transform .12s',
            transform:expanded?'rotate(180deg)':'rotate(0deg)',display:'inline-block'}}>{'\u25BE'}</span>}
        </div>
      </button>

      {expanded&&<DetailPanel log={log} refs={refs}/>}
    </div>);
}

/* ─── Main Page ─── */
function AuditLogPage({logs,kits,personnel,types,locs,depts,comps,consumables,assets,trips,boats,reservations,onRefreshLogs}){
  const[filter,setFilter]=useState('');
  const[actionFilter,setActionFilter]=useState('all');
  const[targetFilter,setTargetFilter]=useState('all');
  const[userFilter,setUserFilter]=useState('all');
  const[dateFrom,setDateFrom]=useState('');
  const[dateTo,setDateTo]=useState('');
  const[categoryFilter,setCategoryFilter]=useState('all');
  const[expanded,setExpanded]=useState({});
  const[tab,setTab]=useState('logs');
  const[displayCount,setDisplayCount]=useState(50);
  const[stats,setStats]=useState(null);

  const refs=useMemo(()=>({kits,personnel,types,locs,depts,comps,consumables,assets,trips,boats,reservations}),[kits,personnel,types,locs,depts,comps,consumables,assets,trips,boats,reservations]);

  // Load stats on mount
  useEffect(()=>{api.audit.stats().then(setStats).catch(()=>{})},[]);

  // Unique values for filter dropdowns
  const actions=useMemo(()=>[...new Set(logs.map(l=>l.action))].sort(),[logs]);
  const targets=useMemo(()=>[...new Set(logs.map(l=>l.target).filter(Boolean))].sort(),[logs]);
  const actors=useMemo(()=>{
    const seen=new Set();return logs.map(l=>l.by).filter(id=>{if(!id||seen.has(id))return false;seen.add(id);return true})
      .map(id=>{const p=personnel.find(x=>x.id===id);return{id,name:p?.name||'Unknown'}}).sort((a,b)=>a.name.localeCompare(b.name));
  },[logs,personnel]);

  const filtered=useMemo(()=>{
    let list=logs;
    if(actionFilter!=='all')list=list.filter(l=>l.action===actionFilter);
    if(targetFilter!=='all')list=list.filter(l=>l.target===targetFilter);
    if(userFilter!=='all')list=list.filter(l=>l.by===userFilter);
    if(categoryFilter!=='all'){const catActions=ACTION_CATEGORIES[categoryFilter]||[];list=list.filter(l=>catActions.includes(l.action))}
    if(dateFrom){const from=new Date(dateFrom);list=list.filter(l=>new Date(l.date)>=from)}
    if(dateTo){const to=new Date(dateTo);to.setHours(23,59,59,999);list=list.filter(l=>new Date(l.date)<=to)}
    if(filter){const q=filter.toLowerCase();list=list.filter(l=>{
      const p=personnel.find(x=>x.id===l.by);const targetName=resolveTargetName(l,refs);
      return l.action.toLowerCase().includes(q)||(p?.name.toLowerCase().includes(q))||(l.details?.kitColor?.toLowerCase().includes(q))
        ||(l.target?.toLowerCase().includes(q))||(targetName?.toLowerCase().includes(q))
        ||(l.details?.name?.toLowerCase().includes(q))||(l.details?.reason?.toLowerCase().includes(q))})}
    return[...list].sort((a,b)=>new Date(b.date)-new Date(a.date));
  },[logs,filter,actionFilter,targetFilter,userFilter,categoryFilter,dateFrom,dateTo,personnel,refs]);

  const toggleExpand=useCallback((id)=>setExpanded(p=>({...p,[id]:!p[id]})),[]);
  const expandAll=useCallback(()=>{const ids={};filtered.slice(0,displayCount).forEach(l=>ids[l.id]=true);setExpanded(ids)},[filtered,displayCount]);
  const collapseAll=useCallback(()=>setExpanded({}),[]);
  const clearFilters=useCallback(()=>{setFilter('');setActionFilter('all');setTargetFilter('all');setUserFilter('all');setCategoryFilter('all');setDateFrom('');setDateTo('')},[]);
  const hasFilters=filter||actionFilter!=='all'||targetFilter!=='all'||userFilter!=='all'||categoryFilter!=='all'||dateFrom||dateTo;

  const tabItems=[
    {id:'logs',l:'Event Log',badge:filtered.length},
    {id:'stats',l:'Overview'},
  ];

  return(
    <div>
      <SH title="Audit Log" sub={logs.length+' total events | '+filtered.length+' matching'} action={
        <div style={{display:'flex',gap:6,alignItems:'center'}}>
          {onRefreshLogs&&<Bt v="secondary" onClick={onRefreshLogs} style={{fontSize:10}}>Refresh</Bt>}
          <Bt v="secondary" onClick={()=>exportCSV(filtered,refs)} style={{fontSize:10}}>Export CSV</Bt>
        </div>
      }/>

      <Tabs tabs={tabItems} active={tab} onChange={setTab}/>

      {tab==='stats'&&<>
        <ActivityHeatmap logs={logs}/>
        <StatsPanel logs={logs} stats={stats} refs={refs}/>
      </>}

      {tab==='logs'&&<>
        {/* Filter Bar */}
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <In value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search events, people, targets..."
            style={{width:220,maxWidth:'100%'}}/>

          <Sl options={[{v:'all',l:'All Categories'},...Object.keys(ACTION_CATEGORIES).map(c=>({v:c,l:c}))]}
            value={categoryFilter} onChange={e=>{setCategoryFilter(e.target.value);setActionFilter('all')}}/>

          <Sl options={[{v:'all',l:'All Actions'},...actions.map(a=>({v:a,l:formatAction(a)}))]}
            value={actionFilter} onChange={e=>setActionFilter(e.target.value)}/>

          <Sl options={[{v:'all',l:'All Targets'},...targets.map(t=>({v:t,l:t}))]}
            value={targetFilter} onChange={e=>setTargetFilter(e.target.value)}/>

          <Sl options={[{v:'all',l:'All Users'},...actors.map(a=>({v:a.id,l:a.name}))]}
            value={userFilter} onChange={e=>setUserFilter(e.target.value)}/>
        </div>

        {/* Date range row */}
        <div style={{display:'flex',gap:6,marginBottom:12,flexWrap:'wrap',alignItems:'center'}}>
          <span style={{fontSize:10,color:T.dm,fontFamily:T.m}}>Date range:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}
            style={{padding:'5px 8px',borderRadius:5,background:T.cardH,border:'1px solid '+T.bd,color:T.tx,fontSize:11,fontFamily:T.m,outline:'none'}}/>
          <span style={{fontSize:10,color:T.dm,fontFamily:T.m}}>to</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}
            style={{padding:'5px 8px',borderRadius:5,background:T.cardH,border:'1px solid '+T.bd,color:T.tx,fontSize:11,fontFamily:T.m,outline:'none'}}/>

          {hasFilters&&<button onClick={clearFilters} style={{all:'unset',cursor:'pointer',fontSize:10,color:T.rd,fontFamily:T.m,fontWeight:600,
            padding:'5px 10px',borderRadius:5,background:'rgba(239,68,68,.06)',border:'1px solid rgba(239,68,68,.15)'}}>Clear filters</button>}

          <div style={{flex:1}}/>

          <button onClick={expandAll} style={{all:'unset',cursor:'pointer',fontSize:9,color:T.mu,fontFamily:T.m,padding:'4px 8px'}}
            onMouseEnter={e=>e.currentTarget.style.color=T.tx} onMouseLeave={e=>e.currentTarget.style.color=T.mu}>Expand all</button>
          <button onClick={collapseAll} style={{all:'unset',cursor:'pointer',fontSize:9,color:T.mu,fontFamily:T.m,padding:'4px 8px'}}
            onMouseEnter={e=>e.currentTarget.style.color=T.tx} onMouseLeave={e=>e.currentTarget.style.color=T.mu}>Collapse all</button>
        </div>

        {/* Results info */}
        {hasFilters&&<div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginBottom:8}}>
          Showing {Math.min(displayCount,filtered.length)} of {filtered.length} matching events
          {filtered.length!==logs.length&&<span> (filtered from {logs.length} total)</span>}
        </div>}

        {/* Log entries */}
        <div style={{display:'flex',flexDirection:'column',gap:4}}>
          {filtered.slice(0,displayCount).map(l=>(
            <LogRow key={l.id} log={l} refs={refs} expanded={!!expanded[l.id]} onToggle={()=>toggleExpand(l.id)}/>))}

          {filtered.length>displayCount&&
            <button onClick={()=>setDisplayCount(c=>c+50)} style={{all:'unset',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
              padding:'12px 0',borderRadius:8,background:T.card,border:'1px solid '+T.bd,
              fontSize:11,fontWeight:600,color:T.bl,fontFamily:T.m,transition:'all .12s'}}
              onMouseEnter={e=>e.currentTarget.style.background=T.cardH}
              onMouseLeave={e=>e.currentTarget.style.background=T.card}>
              Load more ({filtered.length-displayCount} remaining)</button>}

          {!filtered.length&&<div style={{padding:40,textAlign:'center',color:T.dm,fontFamily:T.m}}>
            <div style={{fontSize:20,marginBottom:8}}>No matching events</div>
            <div style={{fontSize:11}}>Try adjusting your filters or search query</div>
            {hasFilters&&<button onClick={clearFilters} style={{all:'unset',cursor:'pointer',marginTop:12,fontSize:11,color:T.bl,fontFamily:T.m,fontWeight:600}}>Clear all filters</button>}
          </div>}
        </div>
      </>}
    </div>);
}

export default AuditLogPage;
