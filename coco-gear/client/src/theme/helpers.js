import { T } from './theme.js';

const uid=()=>crypto.randomUUID();
const CATS=["Comms","Power","Cables","Cases","Optics","Other"];
const SYS_ROLE_LABELS={developer:"Developer",director:"Director",super:"Director",engineer:"Engineer",manager:"Manager",admin:"Manager",lead:"Lead",user:"Operator"};
const sysRoleColor=r=>({developer:T.gn,director:T.rd,super:T.rd,engineer:T.rd,manager:T.am,admin:T.am,lead:T.or,user:T.bl}[r]||T.bl);
const td=()=>new Date().toISOString().slice(0,10);
const now=()=>new Date().toISOString();
const daysAgo=d=>{if(!d)return null;return Math.floor((Date.now()-new Date(d).getTime())/864e5)};
const daysUntil=d=>{if(!d)return null;return Math.floor((new Date(d).getTime()-Date.now())/864e5)};
const stMeta=d=>{const n=daysAgo(d);if(n===null)return{bg:"rgba(239,68,68,.1)",fg:T.rd,tag:"NEVER"};if(n<=7)return{bg:"rgba(34,197,94,.1)",fg:T.gn,tag:n+"d"};if(n<=30)return{bg:"rgba(251,191,36,.1)",fg:T.am,tag:n+"d"};return{bg:"rgba(239,68,68,.1)",fg:T.rd,tag:n+"d"}};
const cSty={GOOD:{bg:"rgba(34,197,94,.1)",bd:"rgba(34,197,94,.25)",fg:T.gn,ic:"OK"},MISSING:{bg:"rgba(239,68,68,.1)",bd:"rgba(239,68,68,.2)",fg:T.rd,ic:"X"},DAMAGED:{bg:"rgba(251,191,36,.1)",bd:"rgba(251,191,36,.2)",fg:T.am,ic:"!!"}};
const expandComps=(compIds,compQtys={})=>{const r=[];compIds.forEach(id=>{const q=compQtys[id]||1;for(let i=0;i<q;i++)r.push({compId:id,idx:i,qty:q,key:q>1?id+"#"+i:id})});return r};
const mkCS=(ids,qtys={})=>Object.fromEntries(expandComps(ids,qtys).map(e=>[e.key,"GOOD"]));
const fmtDate=d=>d?new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}):"--";

const DEF_ROLE_PERMS={
  lead:{trips:true,maintenance:false,consumables:false,analytics:false,reports:false,
    types:false,components:false,locations:false,departments:false,personnel:false,boats:false},
  manager:{trips:true,maintenance:true,consumables:true,analytics:true,reports:true,
    types:true,components:true,locations:true,departments:true,personnel:true,boats:true},
};
const DEF_SETTINGS={
  requireDeptApproval:true,allowUserLocationUpdate:true,
  requireSerialsOnCheckout:true,requireSerialsOnReturn:true,requireSerialsOnInspect:true,
  allowUserInspect:true,allowUserCheckout:true,
  inspectionDueThreshold:30,overdueReturnThreshold:14,
  enableReservations:true,enableMaintenance:true,enableConsumables:true,enableQR:true,
  boatFields:{type:true,hullId:true,length:true,homePort:true,notes:true},
  autoReserveOnTrip:true,
  /* Admin permissions - what admins can access (legacy, kept for compat) */
  adminPerms:{
    analytics:true,reports:true,maintenance:true,consumables:true,
    types:true,components:true,locations:true,departments:true,personnel:true,
  },
  /* Role-based permissions - configurable by super admins */
  rolePerms:DEF_ROLE_PERMS,
};

export { uid, CATS, SYS_ROLE_LABELS, sysRoleColor, td, now, daysAgo, daysUntil, stMeta, cSty, expandComps, mkCS, fmtDate, DEF_ROLE_PERMS, DEF_SETTINGS };
