import { useState, useMemo, useEffect, useRef, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════════════
   COCO GEAR v6 — Full-featured asset management system
   Analytics, Reports, Maintenance, Reservations, Audit, Alerts
   ═══════════════════════════════════════════════════════════════════ */

const T = {
  bg:"#06070a",panel:"#0c0d11",card:"rgba(255,255,255,0.022)",
  cardH:"rgba(255,255,255,0.045)",bd:"rgba(255,255,255,0.055)",
  bdH:"rgba(255,255,255,0.13)",tx:"#e4e4e7",sub:"#a1a1aa",
  mu:"#71717a",dm:"#3f3f46",bl:"#60a5fa",ind:"#818cf8",
  pu:"#a78bfa",gn:"#4ade80",rd:"#f87171",am:"#fbbf24",
  tl:"#2dd4bf",pk:"#f472b6",or:"#fb923c",cy:"#22d3ee",
  m:"'IBM Plex Mono',monospace",u:"'Outfit',sans-serif",
};
const CM={
  /* Solid Colors */
  BLACK:"#27272a",WHITE:"#E2E8F0",SILVER:"#94a3b8",GRAY:"#6b7280",
  RED:"#DC2626",CRIMSON:"#be123c",MAROON:"#7f1d1d",CORAL:"#f97316",
  ORANGE:"#EA7317",AMBER:"#f59e0b",GOLD:"#ca8a04",YELLOW:"#EAB308",
  LIME:"#84cc16",GREEN:"#22C55E",EMERALD:"#10b981",TEAL:"#14b8a6",
  CYAN:"#06b6d4",SKY:"#0ea5e9",BLUE:"#3B82F6",NAVY:"#1e3a5f",
  INDIGO:"#6366f1",PURPLE:"#8B5CF6",VIOLET:"#7c3aed",FUCHSIA:"#d946ef",
  PINK:"#E91E8C",ROSE:"#f43f5e",BROWN:"#7c3a12",OLIVE:"#4d7c0f",
  /* Numbered - for large fleets */
  "001":"#3B82F6","002":"#22C55E","003":"#DC2626","004":"#EAB308","005":"#8B5CF6",
  "006":"#14b8a6","007":"#f97316","008":"#E91E8C","009":"#6366f1","010":"#84cc16",
  "011":"#0ea5e9","012":"#f43f5e","013":"#ca8a04","014":"#06b6d4","015":"#d946ef",
  "016":"#10b981","017":"#7c3aed","018":"#f59e0b","019":"#be123c","020":"#94a3b8",
  /* Patterns */
  CHECKER:"repeating-conic-gradient(#1a1a1a 0% 25%,#e2e8f0 0% 50%) 50%/12px 12px",
  RWB:"linear-gradient(180deg,#DC2626 33%,#fff 33% 66%,#3B82F6 66%)",
  STRIPES:"repeating-linear-gradient(45deg,#27272a,#27272a 4px,#fbbf24 4px,#fbbf24 8px)",
};
const uid=()=>crypto.randomUUID();
const CATS=["Comms","Power","Cables","Cases","Optics","Other"];
const td=()=>new Date().toISOString().slice(0,10);
const now=()=>new Date().toISOString();
const daysAgo=d=>{if(!d)return null;return Math.floor((Date.now()-new Date(d).getTime())/864e5)};
const daysUntil=d=>{if(!d)return null;return Math.floor((new Date(d).getTime()-Date.now())/864e5)};
const stMeta=d=>{const n=daysAgo(d);if(n===null)return{bg:"rgba(239,68,68,.1)",fg:T.rd,tag:"NEVER"};if(n<=7)return{bg:"rgba(34,197,94,.1)",fg:T.gn,tag:n+"d"};if(n<=30)return{bg:"rgba(251,191,36,.1)",fg:T.am,tag:n+"d"};return{bg:"rgba(239,68,68,.1)",fg:T.rd,tag:n+"d"}};
const cSty={GOOD:{bg:"rgba(34,197,94,.1)",bd:"rgba(34,197,94,.25)",fg:T.gn,ic:"OK"},MISSING:{bg:"rgba(239,68,68,.1)",bd:"rgba(239,68,68,.2)",fg:T.rd,ic:"X"},DAMAGED:{bg:"rgba(251,191,36,.1)",bd:"rgba(251,191,36,.2)",fg:T.am,ic:"!!"}};
const expandComps=(compIds,compQtys={})=>{const r=[];compIds.forEach(id=>{const q=compQtys[id]||1;for(let i=0;i<q;i++)r.push({compId:id,idx:i,qty:q,key:q>1?id+"#"+i:id})});return r};
const mkCS=(ids,qtys={})=>Object.fromEntries(expandComps(ids,qtys).map(e=>[e.key,"GOOD"]));
const fmtDate=d=>d?new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"2-digit"}):"--";

/* ═══════════ QR CODE GENERATOR (inline, no deps) ═══════════ */
const QR=(()=>{
  /* Galois Field GF(2^8) with primitive polynomial 0x11d */
  const EX=new Array(256),LG=new Array(256);let xv=1;
  for(let i=0;i<256;i++){EX[i]=xv;LG[xv]=i;xv=(xv<<1)^(xv&128?0x11d:0)}
  const gm=(a,b)=>a&&b?EX[(LG[a]+LG[b])%255]:0;
  /* Reed-Solomon generator polynomial */
  const rsG=n=>{let g=[1];for(let i=0;i<n;i++){const p=Array(g.length+1).fill(0);
    for(let j=0;j<g.length;j++){p[j+1]^=g[j];p[j]^=gm(g[j],EX[i])}g=p}return g};
  /* Reed-Solomon encode: returns EC codewords */
  const rsE=(d,n)=>{const g=rsG(n),r=Array(d.length+n).fill(0);for(let i=0;i<d.length;i++)r[i]=d[i];
    for(let i=0;i<d.length;i++){const c=r[i];if(c)for(let j=0;j<g.length;j++)r[i+j]^=gm(g[j],c)}return r.slice(d.length)};
  /* Version params (EC Level M): [totalCW, ecPerBlock, g1Blocks, g1Data, g2Blocks, g2Data] */
  const VI=[null,[26,10,1,16,0,0],[44,16,1,28,0,0],[70,26,1,44,0,0],[100,18,2,32,0,0],
    [134,24,2,43,0,0],[172,16,4,27,0,0],[196,18,4,31,0,0],[242,22,2,38,2,39],[292,22,3,36,2,37],[346,26,4,43,1,44]];
  const DCAP=[0,14,26,42,62,84,106,122,152,180,213];
  const ALN=[null,[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];
  /* 8 mask functions */
  const MF=[(r,c)=>(r+c)%2===0,r=>r%2===0,(_,c)=>c%3===0,(r,c)=>(r+c)%3===0,
    (r,c)=>(~~(r/2)+~~(c/3))%2===0,(r,c)=>(r*c)%2+(r*c)%3===0,
    (r,c)=>((r*c)%2+(r*c)%3)%2===0,(r,c)=>((r+c)%2+(r*c)%3)%2===0];
  /* BCH format info for EC M */
  const fmtBits=mk=>{let d=mk,b=d<<10;for(let i=4;i>=0;i--)if(b&(1<<(i+10)))b^=(0x537<<i);return((d<<10)|b)^0x5412};
  /* Penalty score for mask selection */
  const penalty=m=>{const n=m.length;let p=0;
    for(let i=0;i<n;i++){let c=1;for(let j=1;j<n;j++){if(m[i][j]===m[i][j-1])c++;else{if(c>=5)p+=c-2;c=1}}if(c>=5)p+=c-2}
    for(let j=0;j<n;j++){let c=1;for(let i=1;i<n;i++){if(m[i][j]===m[i-1][j])c++;else{if(c>=5)p+=c-2;c=1}}if(c>=5)p+=c-2}
    for(let i=0;i<n-1;i++)for(let j=0;j<n-1;j++){const v=m[i][j];if(v===m[i][j+1]&&v===m[i+1][j]&&v===m[i+1][j+1])p+=3}
    let dk=0;for(let i=0;i<n;i++)for(let j=0;j<n;j++)dk+=m[i][j];p+=~~(Math.abs(dk*100/(n*n)-50)/5)*10;return p};
  function generate(text){
    const bytes=[...new TextEncoder().encode(text)];
    let ver=0;for(let i=1;i<=10;i++)if(bytes.length<=DCAP[i]){ver=i;break}
    if(!ver)return null;
    const nf=VI[ver],sz=ver*4+17,totalData=nf[2]*nf[3]+nf[4]*nf[5];
    /* Encode data (byte mode) */
    const bits=[];const ab=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>i)&1)};
    ab(4,4);ab(bytes.length,ver<=9?8:16);bytes.forEach(b=>ab(b,8));
    for(let i=0;i<4&&bits.length<totalData*8;i++)bits.push(0);
    while(bits.length%8)bits.push(0);
    let pd=0xEC;while(bits.length<totalData*8){ab(pd,8);pd=pd===0xEC?0x11:0xEC}
    const cw=[];for(let i=0;i<totalData;i++){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i*8+j];cw.push(b)}
    /* Split into blocks & compute EC */
    const bk=[];let off=0;
    for(let g=0;g<2;g++){const nb=g?nf[4]:nf[2],dl=g?nf[5]:nf[3];
      for(let i=0;i<nb;i++){const d=cw.slice(off,off+dl);bk.push({d,e:rsE(d,nf[1])});off+=dl}}
    /* Interleave data + EC */
    const fin=[];const mxD=Math.max(...bk.map(b=>b.d.length));
    for(let i=0;i<mxD;i++)for(const b of bk)if(i<b.d.length)fin.push(b.d[i]);
    for(let i=0;i<nf[1];i++)for(const b of bk)fin.push(b.e[i]);
    /* Build matrix */
    const mt=Array.from({length:sz},()=>Array(sz).fill(0)),rv=Array.from({length:sz},()=>Array(sz).fill(0));
    /* Finder patterns */
    const fp=(tr,tc)=>{for(let dr=-1;dr<=7;dr++)for(let dc=-1;dc<=7;dc++){
      const nr=tr+dr,nc=tc+dc;if(nr<0||nr>=sz||nc<0||nc>=sz)continue;
      const outer=dr===-1||dr===7||dc===-1||dc===7;
      mt[nr][nc]=(!outer&&(dr===0||dr===6||dc===0||dc===6||(dr>=2&&dr<=4&&dc>=2&&dc<=4)))?1:0;rv[nr][nc]=1}};
    fp(0,0);fp(0,sz-7);fp(sz-7,0);
    /* Timing patterns */
    for(let i=8;i<sz-8;i++){mt[6][i]=mt[i][6]=(i&1)?0:1;rv[6][i]=rv[i][6]=1}
    /* Alignment patterns */
    const al=ALN[ver];for(const ar of al)for(const ac of al){if(rv[ar][ac])continue;
      for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){
        mt[ar+dr][ac+dc]=(Math.abs(dr)===2||Math.abs(dc)===2||(!dr&&!dc))?1:0;rv[ar+dr][ac+dc]=1}}
    /* Dark module + reserve format areas */
    mt[sz-8][8]=1;rv[sz-8][8]=1;
    for(let i=0;i<9;i++){rv[8][i]=1;rv[i][8]=1}
    for(let i=0;i<8;i++){rv[8][sz-1-i]=1;rv[sz-1-i][8]=1}
    /* Place data bits (zigzag) */
    const db=[];for(const byte of fin)for(let i=7;i>=0;i--)db.push((byte>>i)&1);
    let bi=0,up=true;
    for(let col=sz-1;col>=0;col-=2){if(col===6)col=5;
      const rows=up?Array.from({length:sz},(_,i)=>sz-1-i):Array.from({length:sz},(_,i)=>i);
      for(const row of rows)for(let dc=0;dc<=1;dc++){const c=col-dc;if(c<0||rv[row][c])continue;mt[row][c]=bi<db.length?db[bi++]:0}
      up=!up}
    /* Select best mask */
    let bm=0,bp=Infinity;
    for(let mi=0;mi<8;mi++){const mm=mt.map(rw=>[...rw]);
      for(let rr=0;rr<sz;rr++)for(let cc=0;cc<sz;cc++)if(!rv[rr][cc]&&MF[mi](rr,cc))mm[rr][cc]^=1;
      const p=penalty(mm);if(p<bp){bp=p;bm=mi}}
    /* Apply best mask */
    for(let rr=0;rr<sz;rr++)for(let cc=0;cc<sz;cc++)if(!rv[rr][cc]&&MF[bm](rr,cc))mt[rr][cc]^=1;
    /* Place format information */
    const fmt=fmtBits(bm);
    [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]]
      .forEach(([fr,fc],i)=>{mt[fr][fc]=(fmt>>i)&1});
    for(let i=0;i<7;i++)mt[sz-1-i][8]=(fmt>>i)&1;
    for(let i=0;i<8;i++)mt[8][sz-8+i]=(fmt>>(7+i))&1;
    return mt}
  return{generate}
})();
/* QR data helpers */
const qrKitData=id=>"kit:"+id;
const qrAssetData=id=>"asset:"+id;
const qrSerialData=(kitId,compKey,serial)=>"ser:"+kitId.slice(0,8)+":"+compKey+":"+serial;
const parseQR=val=>{if(!val)return null;const s=val.trim();
  if(s.startsWith("kit:"))return{type:"kit",id:s.slice(4)};
  if(s.startsWith("asset:"))return{type:"asset",id:s.slice(6)};
  if(s.startsWith("ser:"))return{type:"serial",parts:s.slice(4).split(":")};
  return{type:"text",value:s}};

/* ─── DEFAULT SETTINGS ─── */
const DEF_SETTINGS={
  requireDeptApproval:true,allowUserLocationUpdate:true,
  requireSerialsOnCheckout:true,requireSerialsOnReturn:true,requireSerialsOnInspect:true,
  allowUserInspect:true,allowUserCheckout:true,
  inspectionDueThreshold:30,overdueReturnThreshold:14,
  enableReservations:true,enableMaintenance:true,enableConsumables:true,
  /* Admin permissions - what admins can access */
  adminPerms:{
    analytics:true,reports:true,maintenance:true,consumables:true,
    types:true,components:true,locations:true,departments:true,personnel:true,
  }
};

/* ─── INITIAL COMPONENTS ─── */
const IC=[
  {id:uid(),key:"pelican",label:"Pelican Case",cat:"Cases",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"goalZero",label:"Goal Zero",cat:"Power",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"gzCharger",label:"GZ Charger",cat:"Power",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"uxv",label:"UXV",cat:"Comms",ser:true,calibrationRequired:true,calibrationIntervalDays:365},
  {id:uid(),key:"uxvCharger",label:"UXV Charger",cat:"Power",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"silvus4200",label:"Silvus 4200",cat:"Comms",ser:true,calibrationRequired:true,calibrationIntervalDays:180},
  {id:uid(),key:"silvusBatt",label:"Silvus Battery",cat:"Power",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"silvusDockCh",label:"Silvus Dock Charger",cat:"Power",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"silvusDock",label:"Silvus Batt Dock",cat:"Power",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"hiGainAnt",label:"Hi-Gain Antenna",cat:"Comms",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"loGainAnt",label:"Lo-Gain Antenna",cat:"Comms",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"uxvEthCbl",label:"UXV Ethernet Cable",cat:"Cables",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"uxvSilvCbl",label:"UXV Silvus Cable",cat:"Cables",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"wifiDongle",label:"Wi-Fi Dongle",cat:"Comms",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"ptt",label:"PTT",cat:"Comms",ser:true,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"silvEthCord",label:"Silvus-Ethernet Cord",cat:"Cables",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"rj45",label:"RJ45 Coupler",cat:"Cables",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"ethUsbc",label:"Ethernet USB-C",cat:"Cables",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
  {id:uid(),key:"radioPouch",label:"Radio Pouch",cat:"Cases",ser:false,calibrationRequired:false,calibrationIntervalDays:null},
];

/* ─── KIT TYPES ─── */
const IKT=[
  {id:uid(),name:"COCO Kit",desc:"Standard comms kit",compIds:IC.map(c=>c.id),compQtys:{[IC.find(c=>c.key==="silvusBatt").id]:2},fields:[{key:"uxvModel",label:"UXV Model",type:"text"},{key:"silvusIP",label:"Silvus IP",type:"text"}]},
  {id:uid(),name:"Starlink Kit",desc:"Starlink connectivity",compIds:[],compQtys:{},fields:[{key:"miniPanel",label:"Panel S/N",type:"text"},{key:"ecoflow",label:"EcoFlow #",type:"text"}]},
  {id:uid(),name:"NVG Set",desc:"PVS-31 night vision",compIds:[],compQtys:{},fields:[{key:"serial",label:"Serial",type:"text"},{key:"hasMount",label:"Mount",type:"toggle"}]},
];

/* ─── LOCATIONS ─── */
const IL=[
  {id:uid(),name:"DAWG (VB)",sc:"DAWG"},{id:uid(),name:"FTX - GTX",sc:"GTX"},
  {id:uid(),name:"GTX - Demo",sc:"DEMO"},{id:uid(),name:"ATX BL7",sc:"ATX"},
  {id:uid(),name:"ATS",sc:"ATS"},{id:uid(),name:"MOPS Trailer",sc:"MOPS"},
  {id:uid(),name:"Field Site Alpha",sc:"ALPHA"},{id:uid(),name:"Maintenance Bay",sc:"MAINT"},
];

/* ─── DEPARTMENTS ─── */
const IDEPT=[
  {id:uid(),name:"Comms",color:"#60a5fa",headId:null},
  {id:uid(),name:"Optics",color:"#a78bfa",headId:null},
  {id:uid(),name:"Logistics",color:"#2dd4bf",headId:null},
];

/* ─── PERSONNEL ─── */
const IP=[
  {id:uid(),name:"Jordan Martinez",title:"Operations Director",role:"super",deptId:null,pin:"1234"},
  {id:uid(),name:"Riley Chen",title:"Field Technician",role:"user",deptId:null,pin:"1234"},
  {id:uid(),name:"Drew Williams",title:"Project Manager",role:"user",deptId:null,pin:"1234"},
  {id:uid(),name:"Kim Thompson",title:"Engineer",role:"user",deptId:null,pin:"1234"},
  {id:uid(),name:"Morgan Davis",title:"Analyst",role:"user",deptId:null,pin:"1234"},
  {id:uid(),name:"Taylor Nguyen",title:"Team Lead",role:"admin",deptId:null,pin:"1234"},
  {id:uid(),name:"Lee Garcia",title:"Technician",role:"user",deptId:null,pin:"1234"},
  {id:uid(),name:"Ash Patel",title:"Support Specialist",role:"user",deptId:null,pin:"1234"},
];
/* Wire dept heads */
IDEPT[0].headId=IP[5].id;IDEPT[1].headId=IP[0].id;IDEPT[2].headId=IP[5].id;
IP[1].deptId=IDEPT[0].id;IP[2].deptId=IDEPT[0].id;
IP[3].deptId=IDEPT[1].id;IP[6].deptId=IDEPT[1].id;
IP[4].deptId=IDEPT[2].id;IP[7].deptId=IDEPT[2].id;

/* ─── CONSUMABLES ─── */
const ICONS=[
  {id:uid(),name:"AA Batteries",sku:"BAT-AA",category:"Power",qty:48,minQty:20,unit:"ea"},
  {id:uid(),name:"CR123 Batteries",sku:"BAT-CR123",category:"Power",qty:24,minQty:10,unit:"ea"},
  {id:uid(),name:"Ethernet Cable 6ft",sku:"CBL-ETH-6",category:"Cables",qty:15,minQty:5,unit:"ea"},
  {id:uid(),name:"Ethernet Cable 25ft",sku:"CBL-ETH-25",category:"Cables",qty:8,minQty:3,unit:"ea"},
  {id:uid(),name:"Zip Ties (100pk)",sku:"MISC-ZIP",category:"Other",qty:5,minQty:2,unit:"pk"},
  {id:uid(),name:"Desiccant Packs",sku:"MISC-DES",category:"Other",qty:30,minQty:10,unit:"ea"},
];

/* ─── STANDALONE ASSETS (individual items that can be checked out) ─── */
const IASSETS=[
  {id:uid(),name:"PVS-14 Night Vision",serial:"NV-2024-001",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"PVS-14 Night Vision",serial:"NV-2024-002",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"PVS-14 Night Vision",serial:"NV-2024-003",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"FLIR Thermal Monocular",serial:"TH-2024-001",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"FLIR Thermal Monocular",serial:"TH-2024-002",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"Handheld GPS",serial:"GPS-001",category:"Comms",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"Handheld GPS",serial:"GPS-002",category:"Comms",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"Satellite Phone",serial:"SAT-001",category:"Comms",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"Rangefinder",serial:"RF-001",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
  {id:uid(),name:"Rangefinder",serial:"RF-002",category:"Optics",locId:null,issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:""},
];

/* ─── BUILD KITS WITH FULL DATA ─── */
const buildKits=(types,locs,pers,depts)=>{
  const ct=types[0];const d=locs[0].id,g=locs[1].id,dm=locs[2].id,a=locs[3].id;
  const expanded=expandComps(ct.compIds,ct.compQtys||{});
  const mkSer=()=>Object.fromEntries(expanded.map(e=>[e.key,""]));
  const mkCal=()=>Object.fromEntries(expanded.map(e=>[e.key,null]));
  const raw=[
    {color:"PINK",l:d,uxv:"Micronav 16",ip:"172.17.126.251",chk:"2026-01-20",iss:null,dept:depts[0].id,maint:null},
    {color:"RED",l:d,uxv:"Micronav 8",ip:"172.17.127.242",chk:"2026-01-18",iss:pers[1].id,dept:depts[0].id,maint:null},
    {color:"ORANGE",l:d,uxv:"Micronav 121",ip:"172.17.132.181",chk:null,iss:null,dept:null,maint:null},
    {color:"YELLOW",l:g,uxv:"Micronav 120",ip:"172.17.87.165",chk:"2026-01-09",iss:pers[2].id,dept:depts[0].id,maint:null},
    {color:"PURPLE",l:g,uxv:"Micronav 104",ip:"172.17.131.108",chk:"2026-01-09",iss:pers[3].id,dept:depts[1].id,maint:null},
    {color:"GREEN",l:dm,uxv:"Micronav 100",ip:"172.17.134.5",chk:"2026-01-29",iss:null,dept:null,maint:null},
    {color:"WHITE",l:d,uxv:"Micronav 15",ip:"172.17.126.254",chk:"2025-12-15",iss:null,dept:depts[1].id,maint:null},
    {color:"BLUE",l:dm,uxv:"Micronav 105",ip:"172.17.127.244",chk:"2026-01-29",iss:pers[6].id,dept:depts[1].id,maint:null},
    {color:"BROWN",l:a,uxv:"Micronav 103",ip:"172.18.70.220",chk:"2026-01-27",iss:null,dept:depts[2].id,maint:null},
    {color:"CHECKER",l:a,uxv:"Micronav 101",ip:"172.18.67.89",chk:"2026-01-27",iss:null,dept:null,maint:null},
    {color:"RWB",l:a,uxv:"Micronav 106",ip:"",chk:"2026-01-27",iss:pers[7].id,dept:depts[2].id,maint:null},
    {color:"GOLD",l:locs[7].id,uxv:"Micronav 102",ip:"",chk:"2025-11-10",iss:null,dept:null,maint:"repair"}, // In maintenance
  ];
  return raw.map((r,i)=>({
    id:uid(),typeId:ct.id,color:r.color,locId:r.l,deptId:r.dept,
    fields:{uxvModel:r.uxv,silvusIP:r.ip},
    lastChecked:r.chk,comps:mkCS(ct.compIds,ct.compQtys||{}),serials:mkSer(),calibrationDates:mkCal(),
    inspections:i<4?[{date:"2026-01-"+String(15+i).padStart(2,"0"),inspector:"System",results:mkCS(ct.compIds,ct.compQtys||{}),serials:{},notes:"Initial inspection"}]:[],
    issuedTo:r.iss,
    issueHistory:r.iss?[{id:uid(),personId:r.iss,issuedDate:"2026-01-15",returnedDate:null,issuedBy:pers[0].id,checkoutSerials:{},returnSerials:{},checkoutLoc:r.l,returnLoc:null}]:[],
    maintenanceStatus:r.maint, // null | "repair" | "calibration"
    maintenanceHistory:[],
    photos:[],
  }));
};

/* ─── BUILD HISTORICAL DATA FOR ANALYTICS ─── */
const buildHistoricalData=(kits,pers)=>{
  const logs=[];const addLog=(action,target,targetId,by,date,details={})=>logs.push({id:uid(),action,target,targetId,by,date,details});
  // Simulate past activity
  addLog("checkout","kit",kits[1].id,pers[1].id,"2026-01-15T09:00:00Z",{kitColor:"RED"});
  addLog("checkout","kit",kits[3].id,pers[2].id,"2026-01-10T08:30:00Z",{kitColor:"YELLOW"});
  addLog("checkout","kit",kits[4].id,pers[3].id,"2026-01-10T08:45:00Z",{kitColor:"PURPLE"});
  addLog("checkout","kit",kits[7].id,pers[6].id,"2026-01-20T10:00:00Z",{kitColor:"BLUE"});
  addLog("checkout","kit",kits[10].id,pers[7].id,"2026-01-22T14:00:00Z",{kitColor:"RWB"});
  addLog("inspect","kit",kits[0].id,pers[0].id,"2026-01-20T11:00:00Z",{kitColor:"PINK",result:"pass"});
  addLog("inspect","kit",kits[1].id,pers[5].id,"2026-01-18T09:00:00Z",{kitColor:"RED",result:"pass"});
  addLog("return","kit",kits[2].id,pers[4].id,"2026-01-12T16:00:00Z",{kitColor:"ORANGE"});
  addLog("maintenance_start","kit",kits[11].id,pers[5].id,"2026-01-25T08:00:00Z",{kitColor:"GOLD",reason:"Radio malfunction"});
  addLog("location_change","kit",kits[5].id,pers[2].id,"2026-01-28T13:00:00Z",{kitColor:"GREEN",from:"ATX BL7",to:"GTX - Demo"});
  return logs;
};

/* ─── SAMPLE RESERVATIONS ─── */
const buildReservations=(kits,pers)=>[
  {id:uid(),kitId:kits[0].id,personId:pers[4].id,startDate:"2026-02-10",endDate:"2026-02-14",purpose:"Field exercise",status:"confirmed",createdDate:"2026-01-28"},
  {id:uid(),kitId:kits[5].id,personId:pers[2].id,startDate:"2026-02-08",endDate:"2026-02-09",purpose:"Training demo",status:"confirmed",createdDate:"2026-01-30"},
  {id:uid(),kitId:kits[2].id,personId:pers[6].id,startDate:"2026-02-15",endDate:"2026-02-20",purpose:"Mission support",status:"pending",createdDate:"2026-02-01"},
];

/* ═══════════ UI PRIMITIVES ═══════════ */
function Sw({color,size=24}){const c=CM[color];const p=c&&(c.includes("gradient")||c.includes("conic"));
  return <div style={{width:size,height:size,borderRadius:4,flexShrink:0,background:p?c:(c||"#444"),border:color==="WHITE"?"1.5px solid #555":"1px solid "+T.bd}}/>;}
function Bg({children,color=T.mu,bg="rgba(255,255,255,.05)"}){
  return <span style={{fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:5,background:bg,color,fontFamily:T.m,letterSpacing:.3,whiteSpace:"nowrap"}}>{children}</span>;}
function Bt({children,onClick,v="default",disabled,sm,style:sx}){
  const base={all:"unset",cursor:disabled?"not-allowed":"pointer",display:"inline-flex",alignItems:"center",gap:6,
    padding:sm?"5px 10px":"8px 15px",borderRadius:7,fontSize:sm?10:12,fontWeight:600,fontFamily:T.m,
    transition:"all .15s",opacity:disabled?.4:1,letterSpacing:.3};
  const vs={default:{background:T.card,border:"1px solid "+T.bd,color:T.tx},
    primary:{background:"rgba(96,165,250,.14)",border:"1px solid rgba(96,165,250,.3)",color:T.bl},
    danger:{background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",color:T.rd},
    success:{background:"rgba(34,197,94,.1)",border:"1px solid rgba(34,197,94,.25)",color:T.gn},
    ghost:{background:"transparent",border:"1px solid transparent",color:T.mu},
    ind:{background:"rgba(129,140,248,.12)",border:"1px solid rgba(129,140,248,.3)",color:T.ind},
    warn:{background:"rgba(251,191,36,.1)",border:"1px solid rgba(251,191,36,.25)",color:T.am},
    pink:{background:"rgba(244,114,182,.1)",border:"1px solid rgba(244,114,182,.25)",color:T.pk},
    orange:{background:"rgba(251,146,60,.1)",border:"1px solid rgba(251,146,60,.25)",color:T.or}};
  return <button onClick={disabled?undefined:onClick} style={{...base,...vs[v],...sx}}>{children}</button>;}
function Fl({label,children,sub}){return <div style={{display:"flex",flexDirection:"column",gap:4}}>
  <label style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,whiteSpace:"nowrap"}}>
    {label}{sub&&<span style={{color:T.dm,fontWeight:400,textTransform:"none",letterSpacing:0}}> {sub}</span>}</label>{children}</div>;}
function In(props){return <input {...props} style={{padding:"7px 11px",borderRadius:6,background:"rgba(255,255,255,.04)",
  border:"1px solid "+T.bd,color:T.tx,fontSize:12,fontFamily:T.m,outline:"none",width:"100%",...props.style}}/>;}
function Ta(props){return <textarea {...props} style={{padding:"7px 11px",borderRadius:6,background:"rgba(255,255,255,.04)",
  border:"1px solid "+T.bd,color:T.tx,fontSize:12,fontFamily:T.m,outline:"none",width:"100%",resize:"vertical",...props.style}}/>;}
function Sl({options,...props}){return(
  <select {...props} style={{padding:"7px 11px",borderRadius:6,background:"rgba(255,255,255,.06)",
    border:"1px solid "+T.bd,color:T.tx,fontSize:11,fontFamily:T.m,outline:"none",cursor:"pointer",...props.style}}>
    {options.map(o=><option key={typeof o==="string"?o:o.v} value={typeof o==="string"?o:o.v}>{typeof o==="string"?o:o.l}</option>)}</select>);}
function Tg({checked,onChange}){return(
  <button onClick={()=>onChange(!checked)} style={{all:"unset",cursor:"pointer",width:36,height:20,
    borderRadius:10,background:checked?"rgba(34,197,94,.3)":"rgba(255,255,255,.08)",
    border:"1px solid "+(checked?"rgba(34,197,94,.4)":T.bd),position:"relative",transition:"all .2s"}}>
    <div style={{width:14,height:14,borderRadius:7,background:checked?T.gn:"#555",position:"absolute",top:2,left:checked?19:2,transition:"all .2s"}}/></button>);}
function ModalWrap({open,onClose,title,wide,children}){if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.72)",backdropFilter:"blur(6px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:wide?"min(900px,95vw)":"min(530px,95vw)",maxHeight:"92vh",
      background:"#111214",border:"1px solid "+T.bdH,borderRadius:14,display:"flex",flexDirection:"column",animation:"mdIn .18s ease-out",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 22px",borderBottom:"1px solid "+T.bd}}>
        <h3 style={{margin:0,fontSize:16,fontWeight:700,fontFamily:T.u,color:T.tx}}>{title}</h3>
        <button onClick={onClose} style={{all:"unset",cursor:"pointer",color:T.mu,fontSize:16,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,background:T.card}}>×</button></div>
      <div style={{padding:"18px 22px",overflowY:"auto",flex:1}}>{children}</div></div></div>);}

/* Confirmation Dialog for dangerous actions */
function ConfirmDialog({open,onClose,onConfirm,title,message,confirmLabel="Delete",confirmColor=T.rd}){
  if(!open)return null;
  return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.8)",backdropFilter:"blur(4px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"min(400px,90vw)",background:"#111214",border:"1px solid "+T.bdH,
      borderRadius:12,padding:24,animation:"mdIn .15s ease-out"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:20,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.rd}}>⚠</div>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.u}}>{title}</div></div></div>
      <div style={{fontSize:12,color:T.mu,fontFamily:T.m,marginBottom:20,lineHeight:1.5}}>{message}</div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
        <Bt onClick={onClose}>Cancel</Bt>
        <Bt v="danger" onClick={()=>{onConfirm();onClose()}}>{confirmLabel}</Bt></div></div></div>);}

function SH({title,sub,action}){return(
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
    <div><h2 style={{margin:0,fontSize:18,fontWeight:700,fontFamily:T.u,color:T.tx}}>{title}</h2>
      {sub&&<p style={{margin:"3px 0 0",fontSize:11,color:T.mu,fontFamily:T.m}}>{sub}</p>}</div>{action}</div>);}
function DeptBg({dept}){if(!dept)return null;return <Bg color={dept.color||T.mu} bg={(dept.color||T.mu)+"18"}>{dept.name}</Bg>;}
function StatCard({label,value,color,sub,icon,onClick}){return(
  <div onClick={onClick} style={{padding:"14px 16px",borderRadius:9,background:T.card,border:"1px solid "+T.bd,minWidth:100,
    cursor:onClick?"pointer":"default",transition:"all .12s",...(onClick?{":hover":{background:T.cardH}}:{})}}
    onMouseEnter={e=>{if(onClick)e.currentTarget.style.background=T.cardH}}
    onMouseLeave={e=>{if(onClick)e.currentTarget.style.background=T.card}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
      <div style={{fontSize:9,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:5}}>{label}</div>
      {icon&&<span style={{fontSize:14,opacity:.5}}>{icon}</span>}</div>
    <div style={{fontSize:24,fontWeight:800,color:color||T.bl,fontFamily:T.u}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:2}}>{sub}</div>}
    {onClick&&<div style={{fontSize:8,color:T.mu,fontFamily:T.m,marginTop:4,opacity:.6}}>Click to view →</div>}</div>);}
function Tabs({tabs,active,onChange}){return(
  <div style={{display:"flex",gap:2,marginBottom:16,borderBottom:"1px solid "+T.bd,paddingBottom:8}}>
    {tabs.map(t=><button key={t.id} onClick={()=>onChange(t.id)} style={{all:"unset",cursor:"pointer",padding:"6px 14px",borderRadius:6,
      fontSize:11,fontWeight:active===t.id?600:400,fontFamily:T.m,background:active===t.id?"rgba(255,255,255,.08)":"transparent",
      color:active===t.id?T.tx:T.mu,transition:"all .12s"}}>{t.l}{t.badge!==undefined&&<span style={{marginLeft:6,fontSize:9,
        padding:"1px 5px",borderRadius:8,background:t.badgeColor||"rgba(251,146,60,.15)",color:t.badgeColor?T.tx:T.or}}>{t.badge}</span>}</button>)}</div>);}
function ProgressBar({value,max,color=T.bl,height=6}){return(
  <div style={{width:"100%",height,borderRadius:height/2,background:T.card,overflow:"hidden"}}>
    <div style={{width:Math.min(100,value/max*100)+"%",height:"100%",borderRadius:height/2,background:color,transition:"width .3s"}}/></div>);}

/* ═══════════ CHART COMPONENTS ═══════════ */
function BarChart({data,height=120,color=T.bl}){
  const max=Math.max(...data.map(d=>d.value),1);
  return(<div style={{display:"flex",alignItems:"flex-end",gap:4,height,padding:"0 4px"}}>
    {data.map((d,i)=><div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
      <div style={{width:"100%",maxWidth:40,background:color,borderRadius:3,height:Math.max(4,d.value/max*(height-24)),transition:"height .3s"}}/>
      <span style={{fontSize:8,color:T.dm,fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:40}}>{d.label}</span>
    </div>)}</div>);}
function DonutChart({segments,size=100,strokeWidth=12}){
  const total=segments.reduce((a,s)=>a+s.value,0)||1;const radius=(size-strokeWidth)/2;const circ=2*Math.PI*radius;
  let offset=0;
  return(<svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
    <circle cx={size/2} cy={size/2} r={radius} fill="none" stroke={T.card} strokeWidth={strokeWidth}/>
    {segments.map((s,i)=>{const len=s.value/total*circ;const dash=`${len} ${circ-len}`;const el=(
      <circle key={i} cx={size/2} cy={size/2} r={radius} fill="none" stroke={s.color} strokeWidth={strokeWidth}
        strokeDasharray={dash} strokeDashoffset={-offset} style={{transition:"all .3s"}}/>);offset+=len;return el})}</svg>);}
function SparkLine({data,width=100,height=30,color=T.bl}){
  if(!data.length)return null;const max=Math.max(...data);const min=Math.min(...data);const range=max-min||1;
  const pts=data.map((v,i)=>`${i/(data.length-1)*width},${height-(v-min)/range*height}`).join(" ");
  return(<svg width={width} height={height}><polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/></svg>);}

/* ═══════════ QR CODE COMPONENTS ═══════════ */
function QRSvg({data,size=160,padding=2}){
  const matrix=useMemo(()=>QR.generate(data),[data]);
  if(!matrix)return <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",
    background:"#fff",borderRadius:8,fontSize:10,color:"#999",fontFamily:T.m}}>Too long</div>;
  const n=matrix.length;const total=n+padding*2;const cs=size/total;
  return(<svg width={size} height={size} viewBox={"0 0 "+size+" "+size} style={{borderRadius:4}}>
    <rect width={size} height={size} fill="#fff"/>
    {matrix.map((row,r)=>row.map((cell,c)=>cell?
      <rect key={r*n+c} x={(c+padding)*cs} y={(r+padding)*cs} width={cs+.5} height={cs+.5} fill="#000"/>:null))}</svg>);}

function QRScanner({onScan,onClose}){
  const vidRef=useRef(null);const streamRef=useRef(null);
  const[err,setErr]=useState("");const[manual,setManual]=useState("");const[active,setActive]=useState(true);
  useEffect(()=>{
    if(!active)return;let animId=null;let stopped=false;
    const start=async()=>{
      try{
        if(!('BarcodeDetector' in window)){setErr("Camera scanning not supported. Use manual entry below.");setActive(false);return}
        const detector=new BarcodeDetector({formats:['qr_code']});
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
        streamRef.current=stream;
        if(vidRef.current){vidRef.current.srcObject=stream;await vidRef.current.play()}
        const scan=async()=>{
          if(stopped||!vidRef.current)return;
          try{const codes=await detector.detect(vidRef.current);
            if(codes.length>0){onScan(codes[0].rawValue);return}}catch(e){}
          animId=requestAnimationFrame(scan)};
        scan();
      }catch(e){setErr("Camera access denied. Use manual entry.");setActive(false)}};
    start();
    return()=>{stopped=true;if(animId)cancelAnimationFrame(animId);
      if(streamRef.current)streamRef.current.getTracks().forEach(t=>t.stop())};
  },[active]);
  const go=()=>{if(manual.trim())onScan(manual.trim())};
  return(<div style={{display:"flex",flexDirection:"column",gap:14}}>
    {active&&<div style={{position:"relative",borderRadius:10,overflow:"hidden",background:"#000",aspectRatio:"4/3"}}>
      <video ref={vidRef} style={{width:"100%",height:"100%",objectFit:"cover"}} playsInline muted/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{width:"55%",height:"55%",border:"2px solid rgba(96,165,250,.6)",borderRadius:12}}/></div>
      <div style={{position:"absolute",bottom:10,left:0,right:0,textAlign:"center",fontSize:10,color:"rgba(255,255,255,.7)",fontFamily:T.m}}>
        Point camera at QR code</div></div>}
    {err&&<div style={{padding:12,borderRadius:8,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.15)",
      fontSize:11,color:T.am,fontFamily:T.m}}>{err}</div>}
    <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m}}>Or enter kit color / ID manually</div>
    <div style={{display:"flex",gap:8}}>
      <In value={manual} onChange={e=>setManual(e.target.value)} placeholder="Kit color, serial, or ID..."
        onKeyDown={e=>{if(e.key==="Enter")go()}} style={{flex:1}}/>
      <Bt v="primary" onClick={go} disabled={!manual.trim()}>Go</Bt></div>
    <div style={{display:"flex",justifyContent:"flex-end"}}><Bt onClick={onClose}>Cancel</Bt></div></div>);}

function QRPrintSheet({items,onClose}){
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontSize:12,color:T.mu,fontFamily:T.m}}>{items.length} QR codes</div>
      <div style={{display:"flex",gap:8}}>
        <Bt v="primary" onClick={()=>window.print()}>Print</Bt>
        <Bt onClick={onClose}>Close</Bt></div></div>
    <style>{`@media print{body>*{visibility:hidden}#qr-print-sheet,#qr-print-sheet *{visibility:visible}
      #qr-print-sheet{position:fixed;top:0;left:0;width:100%;background:#fff;padding:12px;z-index:9999}}`}</style>
    <div id="qr-print-sheet" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,padding:8}}>
      {items.map(item=><div key={item.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,
        padding:12,border:"1px solid #ddd",borderRadius:6,background:"#fff",pageBreakInside:"avoid"}}>
        <QRSvg data={item.qrData} size={120}/>
        <div style={{fontSize:12,fontWeight:700,color:"#111",fontFamily:"sans-serif",textAlign:"center"}}>{item.label}</div>
        <div style={{fontSize:9,color:"#666",fontFamily:"monospace",textAlign:"center"}}>{item.sub}</div></div>)}</div></div>);}

function QRDetailView({qrData,label,sub,serials,kitId,onClose}){
  return(<div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:16}}>
    <QRSvg data={qrData} size={200} padding={3}/>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.u}}>{label}</div>
      {sub&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:2}}>{sub}</div>}</div>
    <div style={{padding:10,borderRadius:8,background:"rgba(255,255,255,.03)",border:"1px solid "+T.bd,width:"100%"}}>
      <div style={{fontSize:9,color:T.dm,fontFamily:T.m,wordBreak:"break-all",textAlign:"center"}}>{qrData}</div></div>
    {serials&&serials.length>0&&<div style={{width:"100%"}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:8}}>
        Serialized Component QR Codes</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {serials.map(s=><div key={s.key} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4,
          padding:10,borderRadius:8,background:"rgba(251,191,36,.02)",border:"1px solid rgba(251,191,36,.1)"}}>
          <QRSvg data={qrSerialData(kitId,s.key,s.serial)} size={80} padding={1}/>
          <div style={{fontSize:9,fontWeight:600,color:T.tx,fontFamily:T.m,textAlign:"center"}}>{s.label}</div>
          <div style={{fontSize:8,color:T.am,fontFamily:T.m}}>{s.serial}</div></div>)}</div></div>}
    <div style={{display:"flex",gap:8}}>
      <Bt v="primary" onClick={()=>{const w=window.open('','_blank','width=320,height=450');
        w.document.write('<html><body style="display:flex;flex-direction:column;align-items:center;padding:24px;font-family:sans-serif">');
        w.document.write('<div id="qr"></div><h3>'+label+'</h3><p style="font-family:monospace;font-size:10px;color:#888">'+qrData+'</p>');
        w.document.write('<script>window.print();setTimeout(()=>window.close(),500)<\/script></body></html>');w.document.close()}}>Print</Bt>
      <Bt onClick={onClose}>Close</Bt></div></div>);}

/* ═══════════ ANALYTICS COMPUTATIONS ═══════════ */
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
    
    /* Low stock consumables */
    // Will be computed in consumables section
    
    return{kitUtil,mostUsedKits,leastUsedKits,idleKits,userStats,problemUsers,compStats,problemComps,
      deptStats,overdueInspection,inspectionRate,recentInspections,overdueReturns,calibrationDue,
      last7,inMaintenance}},
  [kits,personnel,depts,comps,types,logs,reservations]);}

/* ═══════════ SERIAL ENTRY FORM ═══════════ */
function SerialEntryForm({kit,type,allC,existingSerials,mode,onDone,onCancel,settings}){
  const expanded=expandComps(type.compIds,type.compQtys||{});
  const cs=expanded.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);
  const needSer=(mode==="checkout"&&settings.requireSerialsOnCheckout)||(mode==="return"&&settings.requireSerialsOnReturn)||(mode==="inspect"&&settings.requireSerialsOnInspect);
  const serComps=needSer?cs.filter(c=>c.ser):[];
  const[serials,setSerials]=useState(()=>{const init={};serComps.forEach(c=>{init[c._key]=(existingSerials&&existingSerials[c._key])||""});return init});
  const[notes,setNotes]=useState("");
  const filled=serComps.every(c=>serials[c._key]&&serials[c._key].trim());
  const ml=mode==="checkout"?"Checkout":mode==="return"?"Return":"Inspection";
  const mc=mode==="checkout"?T.bl:mode==="return"?T.am:T.gn;
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <Sw color={kit.color} size={30}/><div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{ml} - Kit {kit.color}</div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{type.name} | {td()}</div></div></div>
    {serComps.length>0&&<div>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:mc,fontFamily:T.m,marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
        <div style={{width:5,height:5,borderRadius:"50%",background:mc}}/>Serialized Items ({serComps.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {serComps.map(c=>{const ex=existingSerials&&existingSerials[c._key];const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;return(
          <div key={c._key} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:"rgba(251,191,36,.02)",border:"1px solid rgba(251,191,36,.1)"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:2}}>{lbl}</div>
              {ex&&mode!=="checkout"&&<div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:3}}>Last: {ex}</div>}
              <In value={serials[c._key]} onChange={e=>setSerials(p=>({...p,[c._key]:e.target.value}))} placeholder="S/N" style={{fontSize:11,padding:"5px 9px"}}/></div>
            <span style={{color:serials[c._key]?.trim()?T.gn:T.rd,fontSize:12,fontWeight:700}}>{serials[c._key]?.trim()?"✓":"--"}</span></div>)})}</div></div>}
    <Fl label="Notes"><Ta value={notes} onChange={e=>setNotes(e.target.value)} rows={2} placeholder="Any notes..."/></Fl>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt>
      <Bt v={mode==="checkout"?"primary":mode==="return"?"warn":"success"} onClick={()=>onDone({serials,notes})} disabled={needSer&&!filled}>
        {needSer&&!filled?"Enter all S/N":"Confirm "+ml}</Bt></div></div>);}

/* ═══════════ INSPECTION WORKFLOW ═══════════ */
function InspWF({kit,type,allC,onDone,onCancel,settings,onPhotoAdd}){
  const expanded=expandComps(type.compIds,type.compQtys||{});
  const cs=expanded.map(e=>{const c=allC.find(x=>x.id===e.compId);return c?{...c,_key:e.key,_idx:e.idx,_qty:e.qty}:null}).filter(Boolean);const tot=cs.length;
  const[step,setStep]=useState(0);const[res,setRes]=useState(()=>{const init={};cs.forEach(c=>{init[c._key]=kit.comps[c._key]||"GOOD"});return init});
  const needSer=settings.requireSerialsOnInspect;const serComps=cs.filter(c=>c.ser);
  const[serials,setSerials]=useState(()=>{const init={};serComps.forEach(c=>{init[c._key]=(kit.serials&&kit.serials[c._key])||""});return init});
  const[notes,setNotes]=useState("");const[insp,setInsp]=useState("");const[photos,setPhotos]=useState([]);
  const isRev=step>=tot;const cur=cs[step];
  const mark=s=>{setRes(p=>({...p,[cur._key]:s}));if(step<tot-1)setTimeout(()=>setStep(p=>p+1),150);else setTimeout(()=>setStep(tot),150)};
  const counts=useMemo(()=>{const c={GOOD:0,MISSING:0,DAMAGED:0};cs.forEach(comp=>{c[res[comp._key]||"GOOD"]++});return c},[res,cs]);
  const allSerFilled=!needSer||serComps.every(c=>serials[c._key]?.trim());
  const handlePhoto=e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();
    reader.onload=ev=>{setPhotos(p=>[...p,{id:uid(),data:ev.target.result,name:file.name,date:td()}])};reader.readAsDataURL(file)};
  const instLabel=c=>c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;
  if(tot===0)return <div style={{padding:20,textAlign:"center",color:T.mu}}>No components.</div>;
  if(isRev){const iss=cs.filter(c=>res[c._key]!=="GOOD");return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><Sw color={kit.color} size={30}/>
        <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>Review - Kit {kit.color}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{td()}</div></div></div>
      <div style={{display:"flex",gap:8}}>{Object.entries(counts).map(([k,v])=>{const s=cSty[k];return(
        <div key={k} style={{flex:1,padding:"10px 14px",borderRadius:8,background:s.bg,border:"1px solid "+s.bd,textAlign:"center"}}>
          <div style={{fontSize:20,fontWeight:700,color:s.fg,fontFamily:T.u}}>{v}</div>
          <div style={{fontSize:9,color:s.fg,fontFamily:T.m}}>{k}</div></div>)})}</div>
      {iss.length>0&&<div style={{display:"flex",flexDirection:"column",gap:3}}>
        {iss.map(c=>{const s=cSty[res[c._key]];return(
          <div key={c._key} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",borderRadius:6,background:s.bg,border:"1px solid "+s.bd}}>
            <span style={{color:s.fg,fontSize:11,fontWeight:700,width:20}}>{s.ic}</span>
            <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.m}}>{instLabel(c)}</span>
            <Bg color={s.fg} bg="transparent">{res[c._key]}</Bg></div>)})}</div>}
      {needSer&&serComps.length>0&&<div>
        <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:8}}>Serials</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
          {serComps.map(c=><div key={c._key} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:6,background:"rgba(251,191,36,.02)",border:"1px solid rgba(251,191,36,.08)"}}>
            <span style={{fontSize:9,color:T.mu,fontFamily:T.m,flex:1}}>{instLabel(c)}</span>
            <In value={serials[c._key]} onChange={e=>setSerials(p=>({...p,[c._key]:e.target.value}))} placeholder="S/N" style={{width:100,fontSize:9,padding:"3px 6px"}}/></div>)}</div></div>}
      <div><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.mu,fontFamily:T.m,marginBottom:6}}>Photos ({photos.length})</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {photos.map(ph=><div key={ph.id} style={{width:60,height:60,borderRadius:6,background:`url(${ph.data}) center/cover`,border:"1px solid "+T.bd}}/>)}
          <label style={{width:60,height:60,borderRadius:6,background:T.card,border:"1px dashed "+T.bd,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:20,color:T.dm}}>
            +<input type="file" accept="image/*" onChange={handlePhoto} style={{display:"none"}}/></label></div></div>
      <Fl label="Inspector"><In value={insp} onChange={e=>setInsp(e.target.value)} placeholder="Your name"/></Fl>
      <Fl label="Notes"><Ta value={notes} onChange={e=>setNotes(e.target.value)} rows={2}/></Fl>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt>
        <Bt v="success" onClick={()=>onDone({results:res,serials,notes,inspector:insp,date:td(),photos})} disabled={!allSerFilled}>
          {allSerFilled?"Complete":"Fill S/N first"}</Bt></div></div>)}
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{flex:1,height:3,borderRadius:2,background:T.card,overflow:"hidden"}}>
        <div style={{width:(step/tot*100)+"%",height:"100%",borderRadius:2,background:`linear-gradient(90deg,${T.bl},${T.ind})`,transition:"width .3s"}}/></div>
      <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{step+1}/{tot}</span></div>
    <div style={{textAlign:"center",padding:"10px 0"}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:4}}>{cur.cat}</div>
      <div style={{fontSize:20,fontWeight:700,fontFamily:T.u,color:T.tx}}>{instLabel(cur)}</div>
      {cur.ser&&needSer&&<div style={{marginTop:6}}><Bg color={T.am} bg="rgba(251,191,36,.08)">S/N Required</Bg></div>}</div>
    {cur.ser&&needSer&&<div style={{padding:"10px 16px",borderRadius:8,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.12)"}}>
      <In value={serials[cur._key]||""} onChange={e=>setSerials(p=>({...p,[cur._key]:e.target.value}))} placeholder={"S/N for "+instLabel(cur)}/></div>}
    <div style={{display:"flex",gap:10,justifyContent:"center"}}>{Object.entries(cSty).map(([key,s])=>{const a=res[cur._key]===key;return(
      <button key={key} onClick={()=>mark(key)} style={{all:"unset",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:5,
        padding:"18px 24px",borderRadius:10,minWidth:90,background:a?s.bg:"rgba(255,255,255,.02)",border:a?"2px solid "+s.fg:"1px solid "+T.bd,transition:"all .15s"}}>
        <span style={{fontSize:20,fontWeight:700}}>{s.ic}</span>
        <span style={{fontSize:10,fontWeight:700,fontFamily:T.m,color:s.fg}}>{key}</span></button>)})}</div>
    <div style={{display:"flex",justifyContent:"space-between"}}>
      <Bt v="ghost" onClick={()=>step>0&&setStep(step-1)} disabled={step===0}>Back</Bt>
      <div style={{display:"flex",gap:6}}><Bt v="ghost" onClick={onCancel}>Cancel</Bt>
        <Bt v="primary" onClick={()=>setStep(step+1)}>{step===tot-1?"Review":"Skip"}</Bt></div></div></div>);}

/* ═══════════ ALERTS PANEL ═══════════ */
function AlertsPanel({analytics,kits,settings,onNavigate,onFilterKits}){
  const alerts=[];
  analytics.overdueReturns.forEach(k=>{const h=k.issueHistory[k.issueHistory.length-1];
    alerts.push({id:uid(),type:"overdue",severity:"high",title:`Kit ${k.color} overdue`,sub:`Out ${daysAgo(h.issuedDate)} days`,kitId:k.id,
      action:()=>onFilterKits&&onFilterKits("overdue"),actionLabel:"View overdue"})});
  analytics.overdueInspection.forEach(k=>alerts.push({id:uid(),type:"inspection",severity:daysAgo(k.lastChecked)>60?"high":"medium",
    title:`Kit ${k.color} needs inspection`,sub:k.lastChecked?`Last: ${fmtDate(k.lastChecked)}`:"Never inspected",kitId:k.id,
    action:()=>onNavigate&&onNavigate("issuance"),actionLabel:"Go to checkout"}));
  analytics.calibrationDue.forEach(c=>alerts.push({id:uid(),type:"calibration",severity:c.dueIn<0?"high":"medium",
    title:`${c.comp.label} calibration ${c.dueIn<0?"overdue":"due"}`,sub:`Kit ${c.kit.color} - ${c.dueIn<0?Math.abs(c.dueIn)+" days overdue":"in "+c.dueIn+" days"}`,kitId:c.kit.id,
    action:()=>onNavigate&&onNavigate("maintenance"),actionLabel:"Maintenance"}));
  analytics.inMaintenance.forEach(k=>alerts.push({id:uid(),type:"maintenance",severity:"low",
    title:`Kit ${k.color} in maintenance`,sub:k.maintenanceStatus,kitId:k.id,
    action:()=>onFilterKits&&onFilterKits("maintenance"),actionLabel:"View maintenance"}));
  const sevOrder={high:0,medium:1,low:2};const sorted=[...alerts].sort((a,b)=>sevOrder[a.severity]-sevOrder[b.severity]);
  const sevColors={high:T.rd,medium:T.am,low:T.mu};
  const typeIcons={overdue:"⏰",inspection:"🔍",calibration:"📐",maintenance:"🔧"};
  if(!sorted.length)return <div style={{padding:20,textAlign:"center",color:T.gn,fontFamily:T.m,fontSize:11}}>✓ All clear — no issues</div>;
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.slice(0,10).map(a=><div key={a.id} onClick={a.action} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
      borderRadius:7,background:T.card,border:"1px solid "+T.bd,cursor:"pointer",borderLeft:"3px solid "+sevColors[a.severity],transition:"all .12s"}}
      onMouseEnter={e=>e.currentTarget.style.background=T.cardH} onMouseLeave={e=>e.currentTarget.style.background=T.card}>
      <div style={{fontSize:14,opacity:.7}}>{typeIcons[a.type]||"•"}</div>
      <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{a.title}</div>
        <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.sub}</div></div>
      <div style={{fontSize:8,color:sevColors[a.severity],fontFamily:T.m,opacity:.8}}>{a.actionLabel} →</div></div>)}
    {sorted.length>10&&<div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center",padding:8}}>+{sorted.length-10} more alerts</div>}</div>);}

/* ═══════════ GLOBAL SEARCH ═══════════ */
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
    <In value={q} onChange={e=>setQ(e.target.value)} placeholder="Search kits, people, locations, serials..." autoFocus style={{fontSize:14,padding:"12px 16px"}}/>
    {results.length>0?<div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:400,overflowY:"auto"}}>
      {results.map((r,i)=><button key={i} onClick={()=>{onSelect(r);onClose()}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
        padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{width:24,height:24,borderRadius:6,background:r.type==="kit"?T.ind+"22":r.type==="person"?T.pk+"22":T.tl+"22",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:r.type==="kit"?T.ind:r.type==="person"?T.pk:T.tl,fontFamily:T.m}}>
          {r.type==="kit"?"K":r.type==="person"?"P":"L"}</div>
        <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{r.label}</div>
          <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{r.sub}</div></div></button>)}</div>
      :q.trim()&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m}}>No results for "{q}"</div>}</div>);}

/* ═══════════ QUICK ACTIONS / MY KITS WIDGET ═══════════ */
function QuickActions({kits,curUserId,personnel,onAction,favorites,onToggleFav}){
  const myKits=kits.filter(k=>k.issuedTo===curUserId);const favKits=kits.filter(k=>favorites.includes(k.id)&&k.issuedTo!==curUserId&&!k.issuedTo);
  return(<div style={{display:"flex",flexDirection:"column",gap:12}}>
    {myKits.length>0&&<div>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.pk,fontFamily:T.m,marginBottom:8}}>My Kits ({myKits.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {myKits.map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)"}}>
          <Sw color={k.color} size={24}/>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k.color}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Out since {fmtDate(k.issueHistory[k.issueHistory.length-1]?.issuedDate)}</div></div>
          <Bt v="warn" sm onClick={()=>onAction("return",k.id)}>Return</Bt>
          <Bt sm onClick={()=>onAction("inspect",k.id)}>Inspect</Bt></div>)}</div></div>}
    {favKits.length>0&&<div>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:8}}>Favorites ({favKits.length})</div>
      <div style={{display:"flex",flexDirection:"column",gap:4}}>
        {favKits.map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
          <Sw color={k.color} size={24}/>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k.color}</div></div>
          <Bt v="primary" sm onClick={()=>onAction("checkout",k.id)}>Checkout</Bt>
          <button onClick={()=>onToggleFav(k.id)} style={{all:"unset",cursor:"pointer",fontSize:14,color:T.am}}>★</button></div>)}</div></div>}
    {myKits.length===0&&favKits.length===0&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>
      No kits checked out. Star favorites from inventory for quick access.</div>}</div>);}

/* ═══════════ ACTIVITY FEED ═══════════ */
function ActivityFeed({logs,kits,personnel,limit=10}){
  const sorted=[...logs].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,limit);
  const actionIcons={checkout:"↗",return:"↩",inspect:"✓",maintenance_start:"🔧",location_change:"📍",approved:"✓",denied:"✗"};
  const actionColors={checkout:T.bl,return:T.gn,inspect:T.tl,maintenance_start:T.am,location_change:T.ind,approved:T.gn,denied:T.rd};
  return(<div style={{display:"flex",flexDirection:"column",gap:4}}>
    {sorted.map(l=>{const person=personnel.find(p=>p.id===l.by);return(
      <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{width:24,height:24,borderRadius:12,background:(actionColors[l.action]||T.mu)+"22",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:actionColors[l.action]||T.mu}}>{actionIcons[l.action]||"•"}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:T.tx,fontFamily:T.m}}><span style={{fontWeight:600}}>{person?.name||"System"}</span> {l.action.replace("_"," ")} {l.details?.kitColor&&<span style={{color:T.ind}}>Kit {l.details.kitColor}</span>}</div>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{fmtDate(l.date)}</div></div></div>)})}
    {!sorted.length&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No activity</div>}</div>);}

/* ═══════════ ANALYTICS DASHBOARD ═══════════ */
function AnalyticsPage({analytics,kits,personnel,depts,comps,types,locs}){
  const[tab,setTab]=useState("overview");
  return(<div>
    <SH title="Analytics" sub="Fleet insights and performance metrics"/>
    <Tabs tabs={[{id:"overview",l:"Overview"},{id:"utilization",l:"Utilization"},{id:"accountability",l:"Accountability"},
      {id:"components",l:"Components"},{id:"departments",l:"Departments"}]} active={tab} onChange={setTab}/>
    
    {tab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Summary Stats */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
        <StatCard label="Total Kits" value={kits.length} color={T.bl}/>
        <StatCard label="Checked Out" value={kits.filter(k=>k.issuedTo).length} color={T.pk}/>
        <StatCard label="Available" value={kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length} color={T.gn}/>
        <StatCard label="In Maintenance" value={analytics.inMaintenance.length} color={T.am}/>
        <StatCard label="Overdue Returns" value={analytics.overdueReturns.length} color={analytics.overdueReturns.length?T.rd:T.gn}/>
        <StatCard label="Needs Inspection" value={analytics.overdueInspection.length} color={analytics.overdueInspection.length?T.am:T.gn}/>
        <StatCard label="Inspection Rate" value={Math.round(analytics.inspectionRate*100)+"%"} color={analytics.inspectionRate>.8?T.gn:T.am}/>
        <StatCard label="Calibration Due" value={analytics.calibrationDue.length} color={analytics.calibrationDue.length?T.or:T.gn}/></div>
      
      {/* Activity Trend */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>7-Day Activity</div>
        <div style={{display:"flex",gap:20}}>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Checkouts</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.checkouts}))} height={80} color={T.bl}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Returns</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.returns}))} height={80} color={T.gn}/></div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m,marginBottom:4}}>Inspections</div>
            <BarChart data={analytics.last7.map(d=>({label:d.date.slice(5),value:d.inspections}))} height={80} color={T.tl}/></div></div></div>
      
      {/* Fleet Status Donut */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Fleet Status</div>
          <div style={{display:"flex",alignItems:"center",gap:20}}>
            <DonutChart segments={[
              {value:kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length,color:T.gn},
              {value:kits.filter(k=>k.issuedTo).length,color:T.pk},
              {value:kits.filter(k=>k.maintenanceStatus).length,color:T.am}]} size={90}/>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.gn}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Available ({kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.pk}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Checked Out ({kits.filter(k=>k.issuedTo).length})</span></div>
              <div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:2,background:T.am}}/><span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Maintenance ({kits.filter(k=>k.maintenanceStatus).length})</span></div></div></div></div>
        
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>By Location</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {locs.slice(0,5).map(l=>{const ct=kits.filter(k=>k.locId===l.id).length;const max=Math.max(...locs.map(x=>kits.filter(k=>k.locId===x.id).length),1);
              return(<div key={l.id} style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:9,color:T.mu,fontFamily:T.m,width:60,overflow:"hidden",textOverflow:"ellipsis"}}>{l.sc}</span>
                <ProgressBar value={ct} max={max} color={T.tl} height={8}/>
                <span style={{fontSize:10,color:T.tx,fontFamily:T.m,width:20,textAlign:"right"}}>{ct}</span></div>)})}</div></div></div></div>}
    
    {tab==="utilization"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Most/Least Used */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Most Used Kits</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {analytics.mostUsedKits.map((u,i)=><div key={u.kit.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <span style={{fontSize:10,color:T.dm,fontFamily:T.m,width:16}}>{i+1}</span>
              <Sw color={u.kit.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {u.kit.color}</span>
              <Bg color={T.bl} bg="rgba(96,165,250,.1)">{u.checkouts} uses</Bg>
              <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{u.totalDaysOut}d out</span></div>)}</div></div>
        <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Least Used / Idle</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {analytics.idleKits.length>0?analytics.idleKits.slice(0,5).map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <Sw color={k.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {k.color}</span>
              <Bg color={T.dm} bg="rgba(255,255,255,.03)">Never used</Bg></div>)
              :analytics.leastUsedKits.filter(u=>u.checkouts>0).slice(0,5).map(u=><div key={u.kit.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.02)"}}>
              <Sw color={u.kit.color} size={20}/>
              <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>Kit {u.kit.color}</span>
              <Bg color={T.mu}>{u.checkouts} uses</Bg></div>)}</div></div></div>
      
      {/* Utilization table */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>All Kit Utilization</div>
        <div style={{display:"grid",gridTemplateColumns:"auto 1fr repeat(3,80px)",gap:"8px 16px",alignItems:"center",fontSize:10,fontFamily:T.m}}>
          <div style={{color:T.dm}}>Kit</div><div style={{color:T.dm}}>Type</div><div style={{color:T.dm,textAlign:"right"}}>Checkouts</div><div style={{color:T.dm,textAlign:"right"}}>Days Out</div><div style={{color:T.dm,textAlign:"right"}}>Avg Duration</div>
          {analytics.kitUtil.map(u=><>
            <div key={u.kit.id+"c"} style={{display:"flex",alignItems:"center",gap:6}}><Sw color={u.kit.color} size={16}/><span style={{color:T.tx}}>{u.kit.color}</span></div>
            <div style={{color:T.mu}}>{types.find(t=>t.id===u.kit.typeId)?.name}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.checkouts}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.totalDaysOut}</div>
            <div style={{color:T.tx,textAlign:"right"}}>{u.avgDuration}d</div></>)}</div></div></div>}
    
    {tab==="accountability"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Problem users */}
      {analytics.problemUsers.length>0&&<div style={{padding:18,borderRadius:10,background:"rgba(239,68,68,.03)",border:"1px solid rgba(239,68,68,.1)"}}>
        <div style={{fontSize:12,fontWeight:600,color:T.rd,fontFamily:T.u,marginBottom:12}}>Attention Needed</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {analytics.problemUsers.map(u=><div key={u.person.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
            <div style={{width:32,height:32,borderRadius:16,background:T.rd+"18",border:"1px solid "+T.rd+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.rd,fontFamily:T.m}}>{u.person.title.slice(0,3)}</div>
            <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{u.person.name}</div>
              <div style={{display:"flex",gap:4,marginTop:2}}>
                {u.overdueCount>0&&<Bg color={T.rd} bg="rgba(239,68,68,.1)">{u.overdueCount} overdue</Bg>}
                {u.damageCount>0&&<Bg color={T.am} bg="rgba(251,191,36,.1)">{u.damageCount} damaged</Bg>}
                {u.missingCount>0&&<Bg color={T.or} bg="rgba(251,146,60,.1)">{u.missingCount} missing</Bg>}</div></div></div>)}</div></div>}
      
      {/* User stats table */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Personnel Statistics</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr repeat(5,70px)",gap:"8px 12px",alignItems:"center",fontSize:10,fontFamily:T.m}}>
          <div style={{color:T.dm}}>Person</div><div style={{color:T.dm,textAlign:"right"}}>Total</div><div style={{color:T.dm,textAlign:"right"}}>Active</div><div style={{color:T.dm,textAlign:"right"}}>Overdue</div><div style={{color:T.dm,textAlign:"right"}}>Damaged</div><div style={{color:T.dm,textAlign:"right"}}>Missing</div>
          {analytics.userStats.map(u=><>
            <div key={u.person.id} style={{color:T.tx}}>{u.person.title} {u.person.name}</div>
            <div style={{textAlign:"right",color:T.tx}}>{u.totalCheckouts}</div>
            <div style={{textAlign:"right",color:u.activeCheckouts?T.pk:T.tx}}>{u.activeCheckouts}</div>
            <div style={{textAlign:"right",color:u.overdueCount?T.rd:T.tx}}>{u.overdueCount}</div>
            <div style={{textAlign:"right",color:u.damageCount?T.am:T.tx}}>{u.damageCount}</div>
            <div style={{textAlign:"right",color:u.missingCount?T.or:T.tx}}>{u.missingCount}</div></>)}</div></div></div>}
    
    {tab==="components"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Problem components */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Component Failure Rates</div>
        {analytics.problemComps.length>0?<div style={{display:"flex",flexDirection:"column",gap:6}}>
          {analytics.problemComps.map(c=><div key={c.comp.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(255,255,255,.02)"}}>
            <div style={{width:6,height:6,borderRadius:3,background:c.failRate>.1?T.rd:c.failRate>.05?T.am:T.mu}}/>
            <span style={{flex:1,fontSize:11,color:T.tx,fontFamily:T.u}}>{c.comp.label}</span>
            <Bg color={T.am} bg="rgba(251,191,36,.08)">{c.damaged} damaged</Bg>
            <Bg color={T.rd} bg="rgba(239,68,68,.08)">{c.missing} missing</Bg>
            <span style={{fontSize:10,color:c.failRate>.1?T.rd:T.mu,fontFamily:T.m,fontWeight:600}}>{(c.failRate*100).toFixed(1)}%</span></div>)}</div>
          :<div style={{padding:20,textAlign:"center",color:T.gn,fontFamily:T.m,fontSize:11}}>✓ No component failures recorded</div>}</div>
      
      {/* Component by category */}
      <div style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Issues by Category</div>
        <div style={{display:"flex",gap:12}}>
          {CATS.map(cat=>{const catComps=analytics.compStats.filter(c=>c.comp.cat===cat);const issues=catComps.reduce((a,c)=>a+c.damaged+c.missing,0);
            return(<div key={cat} style={{flex:1,padding:12,borderRadius:8,background:"rgba(255,255,255,.02)",textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:700,color:issues?T.am:T.gn,fontFamily:T.u}}>{issues}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{cat}</div></div>)})}</div></div></div>}
    
    {tab==="departments"&&<div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Department performance cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
        {analytics.deptStats.map(d=><div key={d.dept.id} style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd,borderLeft:"4px solid "+d.dept.color}}>
          <div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:10}}>{d.dept.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <div><div style={{fontSize:18,fontWeight:700,color:T.bl,fontFamily:T.u}}>{d.kitCount}</div><div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Kits</div></div>
            <div><div style={{fontSize:18,fontWeight:700,color:T.pk,fontFamily:T.u}}>{d.issuedCount}</div><div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Issued</div></div></div>
          <div style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Inspection Compliance</span>
              <span style={{fontSize:10,fontWeight:600,color:d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd,fontFamily:T.m}}>{Math.round(d.compliance*100)}%</span></div>
            <ProgressBar value={d.compliance*100} max={100} color={d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd}/></div>
          <div style={{display:"flex",gap:4}}>
            {d.totalDamage>0&&<Bg color={T.am} bg="rgba(251,191,36,.08)">{d.totalDamage} damaged</Bg>}
            {d.totalMissing>0&&<Bg color={T.rd} bg="rgba(239,68,68,.08)">{d.totalMissing} missing</Bg>}
            {d.totalDamage===0&&d.totalMissing===0&&<Bg color={T.gn} bg="rgba(34,197,94,.08)">All good</Bg>}</div></div>)}</div></div>}</div>);}

/* ═══════════ REPORTS PAGE ═══════════ */
function ReportsPage({kits,personnel,depts,comps,types,locs,logs,analytics}){
  const[report,setReport]=useState(null);const[dateFrom,setDateFrom]=useState("");const[dateTo,setDateTo]=useState("");
  
  const generateCSV=(headers,rows,filename)=>{
    const csv=[headers.join(","),...rows.map(r=>r.map(c=>'"'+String(c||"").replace(/"/g,'""')+'"').join(","))].join("\n");
    const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=filename+".csv";a.click();URL.revokeObjectURL(url)};
  
  const generatePrintHTML=(title,content)=>{
    const win=window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{font-family:system-ui,sans-serif;padding:40px;max-width:900px;margin:0 auto;color:#111}
      h1{font-size:24px;margin-bottom:8px}h2{font-size:16px;margin-top:24px;margin-bottom:12px;border-bottom:1px solid #ddd;padding-bottom:4px}
      .meta{color:#666;font-size:12px;margin-bottom:24px}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px}
      th,td{padding:8px;text-align:left;border-bottom:1px solid #eee}
      th{background:#f5f5f5;font-weight:600}
      .stat{display:inline-block;padding:4px 12px;background:#f0f0f0;border-radius:4px;margin-right:8px;margin-bottom:8px}
      .good{color:#16a34a}.warn{color:#ca8a04}.bad{color:#dc2626}
      @media print{body{padding:20px}}
    </style></head><body>${content}<script>window.print()</script></body></html>`);
    win.document.close()};
  
  const reports=[
    {id:"fleet",name:"Fleet Status Report",desc:"Current state of all kits",icon:"📋"},
    {id:"checkout",name:"Checkout/Return Log",desc:"Activity history with date filtering",icon:"↔"},
    {id:"inspection",name:"Inspection History",desc:"All inspection records",icon:"✓"},
    {id:"personnel",name:"Personnel Accountability",desc:"User statistics and issues",icon:"👤"},
    {id:"components",name:"Component Health",desc:"Failure rates and issues",icon:"🔧"},
    {id:"department",name:"Department Summary",desc:"Performance by department",icon:"🏢"},
    {id:"maintenance",name:"Maintenance Log",desc:"Repair and service history",icon:"⚙"},
    {id:"custody",name:"Chain of Custody",desc:"Full history for specific kit",icon:"🔗"},
  ];
  
  const exportFleetStatus=(format)=>{
    const headers=["Kit","Type","Color","Location","Status","Issued To","Last Inspected","Dept","Issues"];
    const rows=kits.map(k=>{
      const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
      const person=k.issuedTo?personnel.find(p=>p.id===k.issuedTo):null;
      const dept=k.deptId?depts.find(d=>d.id===k.deptId):null;
      const issues=Object.values(k.comps).filter(v=>v!=="GOOD").length;
      const status=k.maintenanceStatus?"Maintenance":k.issuedTo?"Checked Out":"Available";
      return[k.color,ty?.name||"",k.color,lo?.name||"",status,person?`${person.name}`:"",k.lastChecked||"Never",dept?.name||"",issues]});
    if(format==="csv")generateCSV(headers,rows,"fleet_status_"+td());
    else{
      const content=`<h1>Fleet Status Report</h1><div class="meta">Generated: ${new Date().toLocaleString()} | Total Kits: ${kits.length}</div>
        <div><span class="stat">Available: ${kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length}</span>
        <span class="stat">Checked Out: ${kits.filter(k=>k.issuedTo).length}</span>
        <span class="stat">Maintenance: ${kits.filter(k=>k.maintenanceStatus).length}</span></div>
        <h2>All Kits</h2><table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===8&&c>0?' class="warn"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Fleet Status Report",content)}};
  
  const exportCheckoutLog=(format)=>{
    let allHistory=[];
    kits.forEach(k=>{k.issueHistory.forEach(h=>{
      const person=personnel.find(p=>p.id===h.personId);const issuer=personnel.find(p=>p.id===h.issuedBy);
      allHistory.push({kit:k.color,person:person?`${person.name}`:"?",issuedDate:h.issuedDate,returnedDate:h.returnedDate,
        issuedBy:issuer?issuer.name:"System",duration:h.returnedDate?daysAgo(h.issuedDate)-daysAgo(h.returnedDate):daysAgo(h.issuedDate)})})});
    if(dateFrom)allHistory=allHistory.filter(h=>h.issuedDate>=dateFrom);
    if(dateTo)allHistory=allHistory.filter(h=>h.issuedDate<=dateTo);
    allHistory.sort((a,b)=>new Date(b.issuedDate)-new Date(a.issuedDate));
    const headers=["Kit","Person","Issued Date","Returned Date","Issued By","Days Out"];
    const rows=allHistory.map(h=>[h.kit,h.person,h.issuedDate,h.returnedDate||"Outstanding",h.issuedBy,h.duration]);
    if(format==="csv")generateCSV(headers,rows,"checkout_log_"+td());
    else{
      const content=`<h1>Checkout/Return Log</h1><div class="meta">Generated: ${new Date().toLocaleString()}${dateFrom?" | From: "+dateFrom:""}${dateTo?" | To: "+dateTo:""}</div>
        <table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===3&&c==="Outstanding"?' class="warn"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Checkout Log",content)}};
  
  const exportInspections=(format)=>{
    let allInsp=[];
    kits.forEach(k=>{k.inspections.forEach(ins=>{
      const good=Object.values(ins.results).filter(v=>v==="GOOD").length;
      const damaged=Object.values(ins.results).filter(v=>v==="DAMAGED").length;
      const missing=Object.values(ins.results).filter(v=>v==="MISSING").length;
      allInsp.push({kit:k.color,date:ins.date,inspector:ins.inspector||"Unknown",good,damaged,missing,notes:ins.notes||""})})});
    if(dateFrom)allInsp=allInsp.filter(i=>i.date>=dateFrom);
    if(dateTo)allInsp=allInsp.filter(i=>i.date<=dateTo);
    allInsp.sort((a,b)=>new Date(b.date)-new Date(a.date));
    const headers=["Kit","Date","Inspector","Good","Damaged","Missing","Notes"];
    const rows=allInsp.map(i=>[i.kit,i.date,i.inspector,i.good,i.damaged,i.missing,i.notes]);
    if(format==="csv")generateCSV(headers,rows,"inspection_history_"+td());
    else{
      const content=`<h1>Inspection History</h1><div class="meta">Generated: ${new Date().toLocaleString()} | Total Inspections: ${allInsp.length}</div>
        <table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===4&&c>0?' class="warn"':i===5&&c>0?' class="bad"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Inspection History",content)}};
  
  const exportPersonnel=(format)=>{
    const headers=["Name","Title","Department","Dept","Total Checkouts","Active","Overdue","Damaged","Missing"];
    const rows=analytics.userStats.map(u=>{const dept=u.person.deptId?depts.find(d=>d.id===u.person.deptId):null;
      return[u.person.name,u.person.title||"",dept?.name||"",dept?.name||"",u.totalCheckouts,u.activeCheckouts,u.overdueCount,u.damageCount,u.missingCount]});
    if(format==="csv")generateCSV(headers,rows,"personnel_report_"+td());
    else{
      const problems=analytics.problemUsers;
      const content=`<h1>Personnel Accountability Report</h1><div class="meta">Generated: ${new Date().toLocaleString()} | Total Personnel: ${personnel.length}</div>
        ${problems.length>0?`<h2 class="bad">Attention Required (${problems.length})</h2><ul>${problems.map(u=>`<li><strong>${u.person.title} ${u.person.name}</strong>: ${u.overdueCount} overdue, ${u.damageCount} damaged, ${u.missingCount} missing</li>`).join("")}</ul>`:""}
        <h2>All Personnel</h2><table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${(i===6||i===7||i===8)&&c>0?' class="warn"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Personnel Report",content)}};
  
  const exportComponents=(format)=>{
    const headers=["Component","Category","Serialized","Times Inspected","Damaged","Missing","Failure Rate"];
    const rows=analytics.compStats.map(c=>[c.comp.label,c.comp.cat,c.comp.ser?"Yes":"No",c.total,c.damaged,c.missing,(c.failRate*100).toFixed(1)+"%"]);
    if(format==="csv")generateCSV(headers,rows,"component_health_"+td());
    else{
      const content=`<h1>Component Health Report</h1><div class="meta">Generated: ${new Date().toLocaleString()} | Total Components: ${comps.length}</div>
        <h2>Problem Components</h2>${analytics.problemComps.length>0?`<ul>${analytics.problemComps.slice(0,10).map(c=>`<li><strong>${c.comp.label}</strong>: ${c.damaged} damaged, ${c.missing} missing (${(c.failRate*100).toFixed(1)}% failure rate)</li>`).join("")}</ul>`:"<p class='good'>No component failures recorded</p>"}
        <h2>All Components</h2><table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===6&&parseFloat(c)>5?' class="warn"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Component Health",content)}};
  
  const exportDepartments=(format)=>{
    const headers=["Department","Kit Count","Issued","Compliance %","Damaged","Missing"];
    const rows=analytics.deptStats.map(d=>[d.dept.name,d.kitCount,d.issuedCount,Math.round(d.compliance*100)+"%",d.totalDamage,d.totalMissing]);
    if(format==="csv")generateCSV(headers,rows,"department_summary_"+td());
    else{
      const content=`<h1>Department Summary Report</h1><div class="meta">Generated: ${new Date().toLocaleString()}</div>
        <table><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr>
        ${rows.map(r=>`<tr>${r.map((c,i)=>`<td${i===3&&parseInt(c)<80?' class="warn"':''}>${c}</td>`).join("")}</tr>`).join("")}</table>`;
      generatePrintHTML("Department Summary",content)}};
  
  const[custodyKit,setCustodyKit]=useState("");
  const exportCustody=(format)=>{
    const k=kits.find(x=>x.id===custodyKit);if(!k)return;
    const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
    const history=[...k.issueHistory].reverse().map(h=>{const p=personnel.find(x=>x.id===h.personId);const ib=personnel.find(x=>x.id===h.issuedBy);
      return{type:"checkout",date:h.issuedDate,person:p?`${p.name}`:"?",issuedBy:ib?.name||"System",returnedDate:h.returnedDate}});
    const inspHist=k.inspections.map(i=>({type:"inspection",date:i.date,inspector:i.inspector,good:Object.values(i.results).filter(v=>v==="GOOD").length,
      issues:Object.values(i.results).filter(v=>v!=="GOOD").length}));
    const all=[...history.map(h=>({...h,sortDate:h.date})),...inspHist.map(i=>({...i,sortDate:i.date}))].sort((a,b)=>new Date(b.sortDate)-new Date(a.sortDate));
    if(format==="csv"){
      const headers=["Date","Event","Details"];
      const rows=all.map(e=>e.type==="checkout"?[e.date,"Checkout",`To: ${e.person}, By: ${e.issuedBy}${e.returnedDate?`, Returned: ${e.returnedDate}`:""}`]
        :[e.date,"Inspection",`Inspector: ${e.inspector}, Good: ${e.good}, Issues: ${e.issues}`]);
      generateCSV(headers,rows,`custody_${k.color}_${td()}`);}
    else{
      const content=`<h1>Chain of Custody: Kit ${k.color}</h1><div class="meta">Generated: ${new Date().toLocaleString()}</div>
        <div><span class="stat">Type: ${ty?.name}</span><span class="stat">Location: ${lo?.name}</span><span class="stat">Status: ${k.issuedTo?"Checked Out":k.maintenanceStatus?"Maintenance":"Available"}</span></div>
        <h2>History (${all.length} events)</h2><table><tr><th>Date</th><th>Event</th><th>Details</th></tr>
        ${all.map(e=>`<tr><td>${e.sortDate}</td><td>${e.type==="checkout"?"Checkout":"Inspection"}</td>
          <td>${e.type==="checkout"?`To: ${e.person}, By: ${e.issuedBy}${e.returnedDate?`, Returned: ${e.returnedDate}`:""}`:`Inspector: ${e.inspector}, Good: ${e.good}, Issues: ${e.issues}`}</td></tr>`).join("")}</table>`;
      generatePrintHTML(`Custody - Kit ${k.color}`,content)}};
  
  return(<div>
    <SH title="Reports" sub="Generate and export reports"/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:10,marginBottom:20}}>
      {reports.map(r=><button key={r.id} onClick={()=>setReport(r.id)} style={{all:"unset",cursor:"pointer",padding:16,borderRadius:10,
        background:report===r.id?"rgba(96,165,250,.08)":T.card,border:report===r.id?"1px solid rgba(96,165,250,.25)":"1px solid "+T.bd,transition:"all .15s"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:18}}>{r.icon}</span>
          <span style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{r.name}</span></div>
        <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{r.desc}</div></button>)}</div>
    
    {report&&<div style={{padding:20,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
      {(report==="checkout"||report==="inspection")&&<div style={{display:"flex",gap:12,marginBottom:16,alignItems:"flex-end"}}>
        <Fl label="From Date"><In type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={{width:150}}/></Fl>
        <Fl label="To Date"><In type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={{width:150}}/></Fl>
        <Bt v="ghost" sm onClick={()=>{setDateFrom("");setDateTo("")}}>Clear</Bt></div>}
      
      {report==="custody"&&<div style={{marginBottom:16}}>
        <Fl label="Select Kit"><Sl options={[{v:"",l:"-- Select Kit --"},...kits.map(k=>({v:k.id,l:`Kit ${k.color}`}))]} 
          value={custodyKit} onChange={e=>setCustodyKit(e.target.value)} style={{width:200}}/></Fl></div>}
      
      <div style={{display:"flex",gap:8}}>
        <Bt v="primary" onClick={()=>{
          if(report==="fleet")exportFleetStatus("pdf");
          if(report==="checkout")exportCheckoutLog("pdf");
          if(report==="inspection")exportInspections("pdf");
          if(report==="personnel")exportPersonnel("pdf");
          if(report==="components")exportComponents("pdf");
          if(report==="department")exportDepartments("pdf");
          if(report==="custody"&&custodyKit)exportCustody("pdf");
        }} disabled={report==="custody"&&!custodyKit}>Export PDF</Bt>
        <Bt onClick={()=>{
          if(report==="fleet")exportFleetStatus("csv");
          if(report==="checkout")exportCheckoutLog("csv");
          if(report==="inspection")exportInspections("csv");
          if(report==="personnel")exportPersonnel("csv");
          if(report==="components")exportComponents("csv");
          if(report==="department")exportDepartments("csv");
          if(report==="custody"&&custodyKit)exportCustody("csv");
        }} disabled={report==="custody"&&!custodyKit}>Export CSV</Bt></div></div>}</div>);}

/* ═══════════ MAINTENANCE PAGE ═══════════ */
function MaintenancePage({kits,setKits,types,locs,personnel,addLog,curUserId}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({reason:"",notes:"",type:"repair"});
  const inMaint=kits.filter(k=>k.maintenanceStatus);const available=kits.filter(k=>!k.maintenanceStatus&&!k.issuedTo);
  
  const sendToMaint=(kitId)=>{
    setKits(p=>p.map(k=>k.id===kitId?{...k,maintenanceStatus:fm.type,maintenanceHistory:[...k.maintenanceHistory,
      {id:uid(),type:fm.type,reason:fm.reason,notes:fm.notes,startDate:td(),endDate:null,startedBy:curUserId}]}:k));
    addLog("maintenance_start","kit",kitId,curUserId,now(),{kitColor:kits.find(x=>x.id===kitId)?.color,reason:fm.reason});
    setMd(null);setFm({reason:"",notes:"",type:"repair"})};
  
  const returnFromMaint=(kitId)=>{
    setKits(p=>p.map(k=>{if(k.id!==kitId)return k;
      const hist=k.maintenanceHistory.map((h,i)=>i===k.maintenanceHistory.length-1&&!h.endDate?{...h,endDate:td(),completedBy:curUserId}:h);
      return{...k,maintenanceStatus:null,maintenanceHistory:hist}}));
    addLog("maintenance_end","kit",kitId,curUserId,now(),{kitColor:kits.find(x=>x.id===kitId)?.color})};
  
  return(<div>
    <SH title="Maintenance" sub={inMaint.length+" in maintenance | "+available.length+" available"} 
      action={<Bt v="primary" onClick={()=>setMd("send")}>Send to Maintenance</Bt>}/>
    
    {inMaint.length>0&&<div style={{marginBottom:24}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.am,fontFamily:T.m,marginBottom:10}}>Currently in Maintenance</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:10}}>
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

/* ═══════════ RESERVATIONS PAGE ═══════════ */
function ReservationsPage({reservations,setReservations,kits,personnel,curUserId,isAdmin,addLog}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({kitId:"",startDate:"",endDate:"",purpose:""});
  const[viewDate,setViewDate]=useState(()=>new Date());const[selectedDay,setSelectedDay]=useState(null);
  const pending=reservations.filter(r=>r.status==="pending");
  const active=reservations.filter(r=>r.status==="confirmed"||r.status==="pending");
  const available=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus);
  
  const checkConflict=(kitId,start,end,excludeId=null)=>{
    return reservations.some(r=>r.id!==excludeId&&r.kitId===kitId&&r.status!=="cancelled"&&
      new Date(r.startDate)<=new Date(end)&&new Date(r.endDate)>=new Date(start))};
  
  const createRes=()=>{
    if(checkConflict(fm.kitId,fm.startDate,fm.endDate)){alert("Conflict with existing reservation");return}
    setReservations(p=>[...p,{id:uid(),kitId:fm.kitId,personId:curUserId,startDate:fm.startDate,endDate:fm.endDate,
      purpose:fm.purpose,status:isAdmin?"confirmed":"pending",createdDate:td()}]);
    addLog("reservation_create","kit",fm.kitId,curUserId,now(),{kitColor:kits.find(k=>k.id===fm.kitId)?.color});
    setMd(null);setFm({kitId:"",startDate:"",endDate:"",purpose:""})};
  
  const approveRes=(id)=>{setReservations(p=>p.map(r=>r.id===id?{...r,status:"confirmed"}:r))};
  const cancelRes=(id)=>{setReservations(p=>p.map(r=>r.id===id?{...r,status:"cancelled"}:r))};
  
  /* Calendar helpers */
  const year=viewDate.getFullYear();const month=viewDate.getMonth();
  const firstDay=new Date(year,month,1).getDay();const daysInMonth=new Date(year,month+1,0).getDate();
  const monthName=viewDate.toLocaleString("default",{month:"long",year:"numeric"});
  const prevMonth=()=>setViewDate(new Date(year,month-1,1));
  const nextMonth=()=>setViewDate(new Date(year,month+1,1));
  const today=new Date().toISOString().slice(0,10);
  
  const getResForDay=(day)=>{
    const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    return active.filter(r=>r.startDate<=dateStr&&r.endDate>=dateStr)};
  
  const getDayColor=(day)=>{
    const res=getResForDay(day);if(!res.length)return null;
    const k=kits.find(x=>x.id===res[0].kitId);return k?.color||"GRAY"};
  
  const calDays=[];
  for(let i=0;i<firstDay;i++)calDays.push(null);
  for(let i=1;i<=daysInMonth;i++)calDays.push(i);
  
  const selectedDateStr=selectedDay?`${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}`:null;
  const selectedRes=selectedDay?getResForDay(selectedDay):[];
  
  return(<div>
    <SH title="Reservations" sub={pending.length+" pending approval | "+active.length+" total"}
      action={<Bt v="primary" onClick={()=>setMd("new")}>+ New Reservation</Bt>}/>
    
    <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:20}}>
      {/* Calendar */}
      <div style={{padding:20,borderRadius:12,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <button onClick={prevMonth} style={{all:"unset",cursor:"pointer",width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.05)",
            display:"flex",alignItems:"center",justifyContent:"center",color:T.mu,fontSize:14}}>←</button>
          <span style={{fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.u}}>{monthName}</span>
          <button onClick={nextMonth} style={{all:"unset",cursor:"pointer",width:32,height:32,borderRadius:6,background:"rgba(255,255,255,.05)",
            display:"flex",alignItems:"center",justifyContent:"center",color:T.mu,fontSize:14}}>→</button></div>
        
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4,marginBottom:8}}>
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,color:T.dm,fontFamily:T.m,padding:4}}>{d}</div>)}</div>
        
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:4}}>
          {calDays.map((day,i)=>{
            if(!day)return <div key={i}/>;
            const dateStr=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
            const isToday=dateStr===today;const isSelected=day===selectedDay;
            const dayRes=getResForDay(day);const hasRes=dayRes.length>0;
            const resColors=dayRes.map(r=>{const k=kits.find(x=>x.id===r.kitId);return CM[k?.color]||"#888"});
            return(<button key={i} onClick={()=>setSelectedDay(day===selectedDay?null:day)} style={{all:"unset",cursor:"pointer",
              aspectRatio:"1",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2,
              background:isSelected?"rgba(96,165,250,.15)":isToday?"rgba(45,212,191,.08)":"rgba(255,255,255,.02)",
              border:isSelected?"1px solid rgba(96,165,250,.4)":isToday?"1px solid rgba(45,212,191,.2)":"1px solid transparent",
              transition:"all .12s"}}>
              <span style={{fontSize:12,fontWeight:isToday||isSelected?700:400,color:isSelected?T.bl:isToday?T.tl:T.tx,fontFamily:T.m}}>{day}</span>
              {hasRes&&<div style={{display:"flex",gap:2}}>{resColors.slice(0,3).map((c,j)=><div key={j} style={{width:6,height:6,borderRadius:3,background:c}}/>)}
                {resColors.length>3&&<span style={{fontSize:7,color:T.dm}}>+{resColors.length-3}</span>}</div>}
            </button>)})}</div></div>
      
      {/* Side panel */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {/* Selected day details */}
        {selectedDay&&<div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u,marginBottom:12}}>
            {new Date(year,month,selectedDay).toLocaleDateString("default",{weekday:"long",month:"short",day:"numeric"})}</div>
          {selectedRes.length>0?<div style={{display:"flex",flexDirection:"column",gap:8}}>
            {selectedRes.map(r=>{const k=kits.find(x=>x.id===r.kitId);const p=personnel.find(x=>x.id===r.personId);const isMine=r.personId===curUserId;
              return(<div key={r.id} style={{padding:12,borderRadius:8,background:isMine?"rgba(96,165,250,.05)":"rgba(255,255,255,.02)",
                border:"1px solid "+(isMine?"rgba(96,165,250,.15)":T.bd),borderLeft:"3px solid "+(CM[k?.color]||"#888")}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  {k&&<Sw color={k.color} size={20}/>}
                  <span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k?.color}</span>
                  {r.status==="pending"&&<Bg color={T.or} bg="rgba(251,146,60,.1)">Pending</Bg>}
                  {isMine&&<Bg color={T.bl} bg="rgba(96,165,250,.1)">Mine</Bg>}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{p?.name}</div>
                <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginTop:4}}>{r.startDate} → {r.endDate}</div>
                {r.purpose&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,fontStyle:"italic",marginTop:4}}>{r.purpose}</div>}
                {(isMine||isAdmin)&&<div style={{display:"flex",gap:4,marginTop:8}}>
                  {isAdmin&&r.status==="pending"&&<Bt v="success" sm onClick={()=>approveRes(r.id)}>Approve</Bt>}
                  <Bt v="danger" sm onClick={()=>cancelRes(r.id)}>Cancel</Bt></div>}</div>)})}
          </div>:<div style={{padding:16,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No reservations</div>}
          <Bt v="primary" sm style={{marginTop:12,width:"100%"}} onClick={()=>{
            setFm(p=>({...p,startDate:selectedDateStr,endDate:selectedDateStr}));setMd("new")}}>+ Reserve for this day</Bt></div>}
        
        {/* Pending approvals */}
        {pending.length>0&&isAdmin&&<div style={{padding:16,borderRadius:10,background:"rgba(251,146,60,.02)",border:"1px solid rgba(251,146,60,.12)"}}>
          <div style={{fontSize:11,fontWeight:600,color:T.or,fontFamily:T.u,marginBottom:10}}>Pending Approval ({pending.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {pending.slice(0,5).map(r=>{const k=kits.find(x=>x.id===r.kitId);const p=personnel.find(x=>x.id===r.personId);return(
              <div key={r.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,background:T.card}}>
                {k&&<Sw color={k.color} size={16}/>}
                <div style={{flex:1,minWidth:0}}><div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p?.name}</div>
                  <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>{r.startDate}</div></div>
                <Bt v="success" sm onClick={()=>approveRes(r.id)}>✓</Bt></div>)})}</div></div>}
        
        {/* Legend */}
        <div style={{padding:14,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{fontSize:10,fontWeight:600,color:T.mu,fontFamily:T.m,marginBottom:8}}>Kit Colors</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {kits.slice(0,8).map(k=><div key={k.id} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:10,height:10,borderRadius:5,background:CM[k.color]||"#888"}}/>
              <span style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{k.color}</span></div>)}</div></div></div></div>
    
    <ModalWrap open={md==="new"} onClose={()=>setMd(null)} title="New Reservation">
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Kit"><Sl options={[{v:"",l:"-- Select Kit --"},...available.map(k=>({v:k.id,l:`Kit ${k.color}`}))]}
          value={fm.kitId} onChange={e=>setFm(p=>({...p,kitId:e.target.value}))}/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Start Date"><In type="date" value={fm.startDate} onChange={e=>setFm(p=>({...p,startDate:e.target.value}))}/></Fl>
          <Fl label="End Date"><In type="date" value={fm.endDate} onChange={e=>setFm(p=>({...p,endDate:e.target.value}))}/></Fl></div>
        <Fl label="Purpose"><In value={fm.purpose} onChange={e=>setFm(p=>({...p,purpose:e.target.value}))} placeholder="Project, event, etc."/></Fl>
        {fm.kitId&&fm.startDate&&fm.endDate&&checkConflict(fm.kitId,fm.startDate,fm.endDate)&&
          <div style={{padding:10,borderRadius:6,background:"rgba(239,68,68,.1)",color:T.rd,fontSize:11,fontFamily:T.m}}>⚠ Conflicts with existing reservation</div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt>
          <Bt v="primary" onClick={createRes} disabled={!fm.kitId||!fm.startDate||!fm.endDate||checkConflict(fm.kitId,fm.startDate,fm.endDate)}>Create</Bt></div></div></ModalWrap></div>);}

/* ═══════════ CONSUMABLES PAGE ═══════════ */
function ConsumablesPage({consumables,setConsumables,assets,setAssets,personnel,locs,addLog,curUserId,isAdmin}){
  const[tab,setTab]=useState("consumables");
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",sku:"",category:"Other",qty:0,minQty:0,unit:"ea"});
  const[afm,setAfm]=useState({name:"",serial:"",category:"Optics",locId:"",notes:""});
  const[adj,setAdj]=useState({id:"",delta:0,reason:""});
  const lowStock=consumables.filter(c=>c.qty<=c.minQty);
  const issuedAssets=assets.filter(a=>a.issuedTo);const availAssets=assets.filter(a=>!a.issuedTo);
  
  const saveCon=()=>{if(!fm.name.trim())return;
    if(md==="addCon"){setConsumables(p=>[...p,{id:uid(),name:fm.name,sku:fm.sku,category:fm.category,qty:Number(fm.qty),minQty:Number(fm.minQty),unit:fm.unit}])}
    else{setConsumables(p=>p.map(c=>c.id===md?{...c,name:fm.name,sku:fm.sku,category:fm.category,minQty:Number(fm.minQty),unit:fm.unit}:c))}
    setMd(null)};
  
  const saveAsset=()=>{if(!afm.name.trim()||!afm.serial.trim())return;
    if(md==="addAsset"){setAssets(p=>[...p,{id:uid(),name:afm.name,serial:afm.serial,category:afm.category,locId:afm.locId||null,
      issuedTo:null,issueHistory:[],lastInspected:null,condition:"GOOD",notes:afm.notes}])}
    else{setAssets(p=>p.map(a=>a.id===md?{...a,name:afm.name,serial:afm.serial,category:afm.category,locId:afm.locId||null,notes:afm.notes}:a))}
    setMd(null)};
  
  const adjust=()=>{
    setConsumables(p=>p.map(c=>c.id===adj.id?{...c,qty:Math.max(0,c.qty+Number(adj.delta))}:c));
    addLog("consumable_adjust","consumable",adj.id,curUserId,now(),{delta:adj.delta,reason:adj.reason});
    setAdj({id:"",delta:0,reason:""})};
  
  const checkoutAsset=(assetId,personId)=>{
    setAssets(p=>p.map(a=>a.id===assetId?{...a,issuedTo:personId,
      issueHistory:[...a.issueHistory,{id:uid(),personId,issuedDate:td(),returnedDate:null,issuedBy:curUserId}]}:a));
    addLog("asset_checkout","asset",assetId,curUserId,now(),{serial:assets.find(a=>a.id===assetId)?.serial});
    setMd(null)};
  
  const returnAsset=(assetId)=>{
    setAssets(p=>p.map(a=>{if(a.id!==assetId)return a;
      const hist=a.issueHistory.map((h,i)=>i===a.issueHistory.length-1&&!h.returnedDate?{...h,returnedDate:td()}:h);
      return{...a,issuedTo:null,issueHistory:hist}}));
    addLog("asset_return","asset",assetId,curUserId,now(),{serial:assets.find(a=>a.id===assetId)?.serial})};
  
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
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
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
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:8}}>
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
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={saveCon}>Save</Bt></div></div></ModalWrap>
    
    {/* Asset edit modal */}
    <ModalWrap open={md==="addAsset"||(typeof md==="string"&&md.length>10&&!md.startsWith("checkout")&&!md.startsWith("history")&&!md.startsWith("qr")&&tab==="assets"&&md!=="addCon")} onClose={()=>setMd(null)} title={md==="addAsset"?"Add Asset":"Edit Asset"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={afm.name} onChange={e=>setAfm(p=>({...p,name:e.target.value}))} placeholder="e.g. PVS-14 Night Vision"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Serial Number"><In value={afm.serial} onChange={e=>setAfm(p=>({...p,serial:e.target.value}))}/></Fl>
          <Fl label="Category"><Sl options={CATS} value={afm.category} onChange={e=>setAfm(p=>({...p,category:e.target.value}))}/></Fl></div>
        <Fl label="Location"><Sl options={[{v:"",l:"-- None --"},...locs.map(l=>({v:l.id,l:l.name}))]} value={afm.locId} onChange={e=>setAfm(p=>({...p,locId:e.target.value}))}/></Fl>
        <Fl label="Notes"><Ta value={afm.notes} onChange={e=>setAfm(p=>({...p,notes:e.target.value}))} rows={2}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={saveAsset}>Save</Bt></div></div></ModalWrap>
    
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

/* ═══════════ AUDIT LOG PAGE ═══════════ */
function AuditLogPage({logs,kits,personnel}){
  const[filter,setFilter]=useState("");const[actionFilter,setActionFilter]=useState("all");
  const actions=[...new Set(logs.map(l=>l.action))];
  const filtered=useMemo(()=>{
    let list=logs;
    if(actionFilter!=="all")list=list.filter(l=>l.action===actionFilter);
    if(filter){const q=filter.toLowerCase();list=list.filter(l=>{
      const p=personnel.find(x=>x.id===l.by);const k=kits.find(x=>x.id===l.targetId);
      return l.action.toLowerCase().includes(q)||(p?.name.toLowerCase().includes(q))||(l.details?.kitColor?.toLowerCase().includes(q))});}
    return[...list].sort((a,b)=>new Date(b.date)-new Date(a.date))},[logs,filter,actionFilter,personnel,kits]);
  const actionColors={checkout:T.bl,return:T.gn,inspect:T.tl,maintenance_start:T.am,maintenance_end:T.gn,location_change:T.ind,
    approved:T.gn,denied:T.rd,reservation_create:T.pu,consumable_adjust:T.or};
  
  return(<div>
    <SH title="Audit Log" sub={logs.length+" events recorded"}/>
    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
      <In value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search..." style={{width:200}}/>
      <Sl options={[{v:"all",l:"All Actions"},...actions.map(a=>({v:a,l:a.replace("_"," ")}))]} value={actionFilter} onChange={e=>setActionFilter(e.target.value)}/></div>
    <div style={{display:"flex",flexDirection:"column",gap:4}}>
      {filtered.slice(0,100).map(l=>{const p=personnel.find(x=>x.id===l.by);return(
        <div key={l.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:28,height:28,borderRadius:14,background:(actionColors[l.action]||T.mu)+"22",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:600,color:actionColors[l.action]||T.mu,fontFamily:T.m}}>
            {l.action.slice(0,2).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,color:T.tx,fontFamily:T.m}}>
              <span style={{fontWeight:600}}>{p?.name||"System"}</span>
              <span style={{color:T.mu}}> {l.action.replace("_"," ")} </span>
              {l.details?.kitColor&&<span style={{color:T.ind}}>Kit {l.details.kitColor}</span>}
              {l.details?.reason&&<span style={{color:T.dm}}> ({l.details.reason})</span>}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{new Date(l.date).toLocaleString()}</div></div>
          <Bg color={actionColors[l.action]||T.mu} bg={(actionColors[l.action]||T.mu)+"18"}>{l.action.replace("_"," ")}</Bg></div>)})}
      {filtered.length>100&&<div style={{padding:12,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:10}}>Showing 100 of {filtered.length}</div>}
      {!filtered.length&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No matching events</div>}</div></div>);}

/* ═══════════ COMPONENTS ADMIN ═══════════ */
function CompAdmin({comps,setComps,types}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({key:"",label:"",cat:"Comms",ser:false,calibrationRequired:false,calibrationIntervalDays:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const grouped=useMemo(()=>{const g={};comps.forEach(c=>{(g[c.cat]=g[c.cat]||[]).push(c)});return g},[comps]);
  const save=()=>{if(!fm.label.trim())return;
    const k=fm.key.trim()||fm.label.trim().replace(/[^a-zA-Z0-9]/g,"").replace(/^./,ch=>ch.toLowerCase());
    if(md==="add"){setComps(p=>[...p,{id:uid(),key:k,label:fm.label.trim(),cat:fm.cat,ser:fm.ser,calibrationRequired:fm.calibrationRequired,calibrationIntervalDays:fm.calibrationRequired?Number(fm.calibrationIntervalDays):null}])}
    else{setComps(p=>p.map(c=>c.id===md?{...c,key:fm.key,label:fm.label.trim(),cat:fm.cat,ser:fm.ser,calibrationRequired:fm.calibrationRequired,calibrationIntervalDays:fm.calibrationRequired?Number(fm.calibrationIntervalDays):null}:c))}
    setMd(null)};
  const confirmDelete=(comp)=>{const inUse=types?.filter(t=>t.compIds.includes(comp.id)).length||0;
    if(inUse>0){alert("Cannot delete: component is used in "+inUse+" kit type(s)");return}
    setDeleteConfirm(comp)};
  const doDelete=()=>{if(deleteConfirm)setComps(p=>p.filter(x=>x.id!==deleteConfirm.id))};
  return(<div>
    <SH title="Components" sub={comps.length+" items | "+comps.filter(c=>c.ser).length+" serialized"}
      action={<Bt v="primary" onClick={()=>{setFm({key:"",label:"",cat:"Comms",ser:false,calibrationRequired:false,calibrationIntervalDays:""});setMd("add")}}>+ Add</Bt>}/>
    {Object.entries(grouped).map(([cat,items])=><div key={cat} style={{marginBottom:20}}>
      <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>{cat} ({items.length})</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:6}}>
        {items.map(c=>{const inUse=types?.filter(t=>t.compIds.includes(c.id)).length||0;return(
          <div key={c.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:6,height:6,borderRadius:3,background:c.ser?T.am:T.ind,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{c.label}</span>
              {c.ser&&<Bg color={T.am} bg="rgba(251,191,36,.08)">S/N</Bg>}
              {c.calibrationRequired&&<Bg color={T.tl} bg="rgba(45,212,191,.08)">CAL</Bg>}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{c.key}{inUse>0&&` • ${inUse} type(s)`}</div></div>
          <Bt v="ghost" sm onClick={()=>{setFm({key:c.key,label:c.label,cat:c.cat,ser:!!c.ser,calibrationRequired:!!c.calibrationRequired,calibrationIntervalDays:c.calibrationIntervalDays||""});setMd(c.id)}}>Edit</Bt>
          <Bt v="ghost" sm onClick={()=>confirmDelete(c)} style={{color:T.rd}} disabled={inUse>0}>Del</Bt></div>)})}</div></div>)}
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Component":"Edit Component"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Label"><In value={fm.label} onChange={e=>setFm(p=>({...p,label:e.target.value}))} placeholder="e.g. Silvus 4200"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Key"><In value={fm.key} onChange={e=>setFm(p=>({...p,key:e.target.value}))} placeholder="auto"/></Fl>
          <Fl label="Category"><Sl options={CATS} value={fm.cat} onChange={e=>setFm(p=>({...p,cat:e.target.value}))}/></Fl></div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Tg checked={fm.ser} onChange={v=>setFm(p=>({...p,ser:v}))}/>
            <span style={{fontSize:11,color:fm.ser?T.am:T.mu,fontFamily:T.m}}>Serialized</span></div>
          <div style={{display:"flex",alignItems:"center",gap:8}}><Tg checked={fm.calibrationRequired} onChange={v=>setFm(p=>({...p,calibrationRequired:v}))}/>
            <span style={{fontSize:11,color:fm.calibrationRequired?T.tl:T.mu,fontFamily:T.m}}>Requires Calibration</span></div></div>
        {fm.calibrationRequired&&<Fl label="Calibration Interval (days)"><In type="number" value={fm.calibrationIntervalDays} onChange={e=>setFm(p=>({...p,calibrationIntervalDays:e.target.value}))} placeholder="365"/></Fl>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Component?" message={`Are you sure you want to delete "${deleteConfirm?.label}"? This action cannot be undone.`}/></div>);}

/* ═══════════ KIT TYPES ═══════════ */
function TypeAdmin({types,setTypes,comps,kits}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",desc:"",compIds:[],compQtys:{},fields:[]});const[fd,setFd]=useState({key:"",label:"",type:"text"});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const grouped=useMemo(()=>{const g={};comps.forEach(c=>{(g[c.cat]=g[c.cat]||[]).push(c)});return g},[comps]);
  const togC=cid=>{setFm(p=>{if(p.compIds.includes(cid)){const nq={...p.compQtys};delete nq[cid];return{...p,compIds:p.compIds.filter(x=>x!==cid),compQtys:nq}}return{...p,compIds:[...p.compIds,cid]}})};
  const setCompQty=(cid,val)=>{const n=Math.max(1,parseInt(val)||1);setFm(p=>({...p,compQtys:n>1?{...p.compQtys,[cid]:n}:Object.fromEntries(Object.entries(p.compQtys).filter(([k])=>k!==cid))}))};
  const addField=()=>{if(!fd.label.trim())return;const k=fd.key.trim()||fd.label.trim().replace(/[^a-zA-Z0-9]/g,"").replace(/^./,ch=>ch.toLowerCase());
    setFm(p=>({...p,fields:[...p.fields,{key:k,label:fd.label.trim(),type:fd.type}]}));setFd({key:"",label:"",type:"text"})};
  const totalExpanded=(ids,qtys)=>ids.reduce((s,id)=>s+(qtys[id]||1),0);
  const save=()=>{if(!fm.name.trim())return;
    if(md==="add"){setTypes(p=>[...p,{id:uid(),name:fm.name.trim(),desc:fm.desc.trim(),compIds:fm.compIds,compQtys:fm.compQtys,fields:fm.fields}])}
    else{setTypes(p=>p.map(t=>t.id===md?{...t,name:fm.name.trim(),desc:fm.desc.trim(),compIds:fm.compIds,compQtys:fm.compQtys,fields:fm.fields}:t))}setMd(null)};
  const confirmDelete=(type)=>{const n=kits?.filter(k=>k.typeId===type.id).length||0;
    if(n>0){alert("Cannot delete: "+n+" kit(s) use this type");return}
    setDeleteConfirm(type)};
  const doDelete=()=>{if(deleteConfirm)setTypes(p=>p.filter(x=>x.id!==deleteConfirm.id))};
  return(<div>
    <SH title="Kit Types" sub={types.length+" templates"} action={<Bt v="primary" onClick={()=>{setFm({name:"",desc:"",compIds:[],compQtys:{},fields:[]});setMd("add")}}>+ Add</Bt>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:12}}>
      {types.map(t=>{const sc=t.compIds.filter(id=>comps.find(c=>c.id===id&&c.ser)).length;const inUse=kits?.filter(k=>k.typeId===t.id).length||0;const tc=totalExpanded(t.compIds,t.compQtys||{});return(
        <div key={t.id} style={{padding:18,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
            <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{t.name}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:2}}>{t.desc||"No description"}</div></div>
            <div style={{display:"flex",gap:4}}><Bt v="ghost" sm onClick={()=>{setFm({name:t.name,desc:t.desc,compIds:[...t.compIds],compQtys:{...(t.compQtys||{})},fields:t.fields.map(f=>({...f}))});setMd(t.id)}}>Edit</Bt>
              <Bt v="ghost" sm onClick={()=>confirmDelete(t)} style={{color:T.rd}} disabled={inUse>0}>Del</Bt></div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <Bg color={T.ind} bg="rgba(129,140,248,.1)">{tc} items ({t.compIds.length} types)</Bg>
            {sc>0&&<Bg color={T.am} bg="rgba(251,191,36,.08)">{sc} serialized</Bg>}
            <Bg color={T.tl} bg="rgba(45,212,191,.1)">{t.fields.length} fields</Bg>
            {inUse>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{inUse} kits</Bg>}</div></div>)})}</div>
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
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Create":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Kit Type?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This template will no longer be available for new kits.`}/></div>);}

/* ═══════════ LOCATIONS ═══════════ */
function LocAdmin({locs,setLocs,kits}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",sc:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const save=()=>{if(!fm.name.trim())return;
    if(md==="add"){setLocs(p=>[...p,{id:uid(),name:fm.name.trim(),sc:fm.sc.trim()||fm.name.trim().slice(0,4).toUpperCase()}])}
    else{setLocs(p=>p.map(l=>l.id===md?{...l,name:fm.name.trim(),sc:fm.sc.trim()}:l))}setMd(null)};
  const confirmDelete=(loc)=>{const n=kits.filter(k=>k.locId===loc.id).length;
    if(n>0){alert("Cannot delete: location has "+n+" kit(s)");return}
    setDeleteConfirm(loc)};
  const doDelete=()=>{if(deleteConfirm)setLocs(p=>p.filter(x=>x.id!==deleteConfirm.id))};
  return(<div>
    <SH title="Locations" sub={locs.length+" locations"} action={<Bt v="primary" onClick={()=>{setFm({name:"",sc:""});setMd("add")}}>+ Add</Bt>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
      {locs.map(l=>{const n=kits.filter(k=>k.locId===l.id).length;return(
        <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{width:32,height:32,borderRadius:6,background:"rgba(45,212,191,.08)",border:"1px solid rgba(45,212,191,.2)",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:T.tl,fontFamily:T.m}}>{l.sc.slice(0,3)}</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:T.tx,fontFamily:T.u}}>{l.name}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{n} kit{n!==1?"s":""}</div></div>
          <Bt v="ghost" sm onClick={()=>{setFm({name:l.name,sc:l.sc});setMd(l.id)}}>Edit</Bt>
          <Bt v="ghost" sm onClick={()=>confirmDelete(l)} style={{color:T.rd}} disabled={n>0}>Del</Bt></div>)})}</div>
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Location":"Edit Location"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <Fl label="Short Code"><In value={fm.sc} onChange={e=>setFm(p=>({...p,sc:e.target.value}))} style={{width:120}}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Location?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}/></div>);}

/* ═══════════ DEPARTMENTS ═══════════ */
function DeptAdmin({depts,setDepts,personnel,kits}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",color:T.bl,headId:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const save=()=>{if(!fm.name.trim())return;
    if(md==="add"){setDepts(p=>[...p,{id:uid(),name:fm.name.trim(),color:fm.color,headId:fm.headId||null}])}
    else{setDepts(p=>p.map(d=>d.id===md?{...d,name:fm.name.trim(),color:fm.color,headId:fm.headId||null}:d))}setMd(null)};
  const confirmDelete=(dept)=>{const dKits=kits.filter(k=>k.deptId===dept.id);
    if(dKits.length>0){alert("Cannot delete: department has "+dKits.length+" kit(s) assigned");return}
    setDeleteConfirm(dept)};
  const doDelete=()=>{if(deleteConfirm)setDepts(p=>p.filter(x=>x.id!==deleteConfirm.id))};
  const dColors=["#60a5fa","#818cf8","#a78bfa","#f472b6","#fb923c","#4ade80","#2dd4bf","#fbbf24","#f87171","#22d3ee"];
  return(<div>
    <SH title="Departments" sub={depts.length+" departments"} action={<Bt v="primary" onClick={()=>{setFm({name:"",color:T.bl,headId:""});setMd("add")}}>+ Add</Bt>}/>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
      {depts.map(d=>{const head=d.headId?personnel.find(p=>p.id===d.headId):null;const dKits=kits.filter(k=>k.deptId===d.id);const dPers=personnel.filter(p=>p.deptId===d.id);
        return(<div key={d.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,borderLeft:"3px solid "+d.color}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
            <div><div style={{fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx}}>{d.name}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Head: {head?head.name:"Unassigned"}</div></div>
            <div style={{display:"flex",gap:4}}><Bt v="ghost" sm onClick={()=>{setFm({name:d.name,color:d.color,headId:d.headId||""});setMd(d.id)}}>Edit</Bt>
              <Bt v="ghost" sm onClick={()=>confirmDelete(d)} style={{color:T.rd}} disabled={dKits.length>0}>Del</Bt></div></div>
          <div style={{display:"flex",gap:6}}><Bg color={d.color} bg={d.color+"18"}>{dKits.length} kits</Bg><Bg color={d.color} bg={d.color+"18"}>{dPers.length} members</Bg></div></div>)})}</div>
    <ModalWrap open={!!md} onClose={()=>setMd(null)} title={md==="add"?"Add Department":"Edit Department"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <Fl label="Color"><div style={{display:"flex",gap:5}}>{dColors.map(c=><button key={c} onClick={()=>setFm(p=>({...p,color:c}))} style={{all:"unset",cursor:"pointer",width:24,height:24,borderRadius:5,background:c,border:fm.color===c?"2px solid #fff":"2px solid transparent"}}/>)}</div></Fl>
        <Fl label="Head"><Sl options={[{v:"",l:"-- Unassigned --"},...personnel.filter(p=>p.role!=="user").map(p=>({v:p.id,l:p.name}))]} value={fm.headId} onChange={e=>setFm(p=>({...p,headId:e.target.value}))}/></Fl>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete Department?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? Personnel in this department will become unassigned.`}/></div>);}

/* ═══════════ PERSONNEL ═══════════ */
function PersonnelAdmin({personnel,setPersonnel,kits,depts}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",title:"",role:"user",deptId:"",pin:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);

  /* First super admin is protected and cannot be deleted */
  const primarySuper=personnel.find(p=>p.role==="super");
  const isPrimarySuper=(id)=>primarySuper?.id===id;

  const save=()=>{if(!fm.name.trim())return;
    if(md==="add"){setPersonnel(p=>[...p,{id:uid(),name:fm.name.trim(),title:fm.title.trim(),role:fm.role,deptId:fm.deptId||null,pin:fm.pin||"1234"}])}
    else{
      /* Prevent demoting the primary super admin */
      if(isPrimarySuper(md)&&fm.role!=="super"){alert("Cannot change role of primary administrator");return}
      setPersonnel(p=>p.map(x=>x.id===md?{...x,name:fm.name.trim(),title:fm.title.trim(),role:fm.role,deptId:fm.deptId||null,pin:fm.pin||x.pin}:x))}
    setMd(null)};
  
  const confirmDelete=(person)=>{
    const ik=kits.filter(k=>k.issuedTo===person.id);
    if(ik.length>0){alert("Cannot delete: user has "+ik.length+" kit(s) checked out");return}
    if(isPrimarySuper(person.id)){alert("Cannot delete the primary administrator");return}
    setDeleteConfirm(person)};
  
  const doDelete=()=>{if(deleteConfirm)setPersonnel(p=>p.filter(x=>x.id!==deleteConfirm.id))};
  
  const rc={super:T.rd,admin:T.am,user:T.bl};
  const grouped=useMemo(()=>{const g={"Unassigned":[]};depts.forEach(d=>{g[d.name]=[]});
    personnel.forEach(p=>{const d=p.deptId?depts.find(x=>x.id===p.deptId):null;(g[d?.name||"Unassigned"]=g[d?.name||"Unassigned"]||[]).push(p)});return g},[personnel,depts]);
  return(<div>
    <SH title="Personnel" sub={personnel.length+" people"} action={<Bt v="primary" onClick={()=>{setFm({name:"",title:"",role:"user",deptId:"",pin:""});setMd("add")}}>+ Add</Bt>}/>
    {Object.entries(grouped).filter(([,members])=>members.length>0).map(([deptName,members])=>{const dept=depts.find(d=>d.name===deptName);return(<div key={deptName} style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        {dept&&<div style={{width:4,height:16,borderRadius:2,background:dept.color}}/>}
        <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:dept?.color||T.mu,fontFamily:T.m}}>{deptName} ({members.length})</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:6}}>
        {members.map(p=>{const ik=kits.filter(k=>k.issuedTo===p.id);const isProtected=isPrimarySuper(p.id);return(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:T.card,border:"1px solid "+(isProtected?"rgba(239,68,68,.2)":T.bd)}}>
            <div style={{width:32,height:32,borderRadius:16,background:(rc[p.role])+"18",border:"1px solid "+(rc[p.role])+"44",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:rc[p.role],fontFamily:T.m}}>{p.name.split(" ").map(n=>n[0]).join("")}</div>
            <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{p.name}</span>
              {isProtected&&<span style={{fontSize:8,color:T.rd,fontFamily:T.m}}>★ PRIMARY</span>}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{p.title||"No title"}</div>
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                <Bg color={rc[p.role]} bg={(rc[p.role])+"18"}>{p.role}</Bg>
                {ik.length>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{ik.length} kit{ik.length>1?"s":""}</Bg>}</div></div>
            <Bt v="ghost" sm onClick={()=>{setFm({name:p.name,title:p.title||"",role:p.role,deptId:p.deptId||"",pin:p.pin||""});setMd(p.id)}}>Edit</Bt>
            <Bt v="ghost" sm onClick={()=>confirmDelete(p)} style={{color:T.rd}} disabled={ik.length>0||isProtected}
              title={isProtected?"Primary admin cannot be deleted":ik.length>0?"Has kits checked out":""}>Del</Bt></div>)})}</div></div>)})}
    
    <ModalWrap open={!!md&&md!=="delete"} onClose={()=>setMd(null)} title={md==="add"?"Add Person":"Edit Person"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <Fl label="Title"><In value={fm.title} onChange={e=>setFm(p=>({...p,title:e.target.value}))} placeholder="e.g. Project Manager, Engineer"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fl label="Role"><Sl options={[{v:"user",l:"User"},{v:"admin",l:"Admin"},{v:"super",l:"Super Admin"}]} value={fm.role} onChange={e=>setFm(p=>({...p,role:e.target.value}))}
            disabled={isPrimarySuper(md)}/></Fl>
          <Fl label="Department"><Sl options={[{v:"",l:"-- None --"},...depts.map(d=>({v:d.id,l:d.name}))] } value={fm.deptId} onChange={e=>setFm(p=>({...p,deptId:e.target.value}))}/></Fl>
          <Fl label="Login PIN"><In type="password" value={fm.pin} onChange={e=>setFm(p=>({...p,pin:e.target.value}))} placeholder={md==="add"?"1234":"unchanged"} maxLength={6}/></Fl></div>
        {isPrimarySuper(md)&&<div style={{padding:10,borderRadius:6,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.1)"}}>
          <div style={{fontSize:10,color:T.rd,fontFamily:T.m}}>This is the primary administrator. Role cannot be changed.</div></div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>
    
    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete User?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}/></div>);}

/* ═══════════ SETTINGS (SUPER ADMIN) ═══════════ */
function SettingsPage({settings,setSettings}){
  const[tab,setTab]=useState("general");
  const generalItems=[
    {k:"requireDeptApproval",l:"Require dept head approval",d:"For department-locked kits"},
    {k:"allowUserLocationUpdate",l:"Allow user location updates",d:"Users can update kit locations"},
    {k:"allowUserInspect",l:"Allow user inspections",d:"Users can run inspections"},
    {k:"allowUserCheckout",l:"Allow user self-checkout",d:"Users can checkout to themselves"},
  ];
  const serialItems=[
    {k:"requireSerialsOnCheckout",l:"Require serials on checkout",d:"S/N entry during checkout"},
    {k:"requireSerialsOnReturn",l:"Require serials on return",d:"S/N entry during return"},
    {k:"requireSerialsOnInspect",l:"Require serials on inspect",d:"S/N entry during inspection"},
  ];
  const featureItems=[
    {k:"enableReservations",l:"Enable reservations",d:"Kit booking system"},
    {k:"enableMaintenance",l:"Enable maintenance tracking",d:"Repair and service tracking"},
    {k:"enableConsumables",l:"Enable consumables",d:"Stock management"},
  ];
  const numItems=[
    {k:"inspectionDueThreshold",l:"Inspection due threshold",d:"Days before inspection overdue",unit:"days"},
    {k:"overdueReturnThreshold",l:"Overdue return threshold",d:"Days before return overdue",unit:"days"},
  ];
  const adminPermItems=[
    {k:"analytics",l:"Analytics",d:"View fleet analytics and insights"},
    {k:"reports",l:"Reports",d:"Generate and export reports"},
    {k:"maintenance",l:"Maintenance",d:"Manage maintenance workflow"},
    {k:"consumables",l:"Consumables",d:"Manage consumable inventory"},
    {k:"types",l:"Kit Types",d:"Create and edit kit templates"},
    {k:"components",l:"Components",d:"Manage component library"},
    {k:"locations",l:"Locations",d:"Manage storage locations"},
    {k:"departments",l:"Departments",d:"Manage departments"},
    {k:"personnel",l:"Personnel",d:"Manage personnel records"},
  ];
  const ToggleRow=({item,checked,onChange})=>(
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
      <Tg checked={checked} onChange={onChange}/>
      <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:checked?T.tx:T.mu,fontFamily:T.u}}>{item.l}</div>
        <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{item.d}</div></div></div>);
  return(<div>
    <SH title="System Settings" sub="Super Admin configuration"/>
    <Tabs tabs={[{id:"general",l:"General"},{id:"serials",l:"Serials"},{id:"features",l:"Features"},{id:"admin",l:"Admin Permissions"}]} active={tab} onChange={setTab}/>
    <div style={{maxWidth:600,display:"flex",flexDirection:"column",gap:6}}>
      {tab==="general"&&<>
        {generalItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>setSettings(p=>({...p,[it.k]:v}))}/>)}
        {numItems.map(it=><div key={it.k} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{it.l}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{it.d}</div></div>
          <In type="number" value={settings[it.k]} onChange={e=>setSettings(p=>({...p,[it.k]:Number(e.target.value)}))} style={{width:70,textAlign:"right"}}/>
          <span style={{fontSize:10,color:T.mu,fontFamily:T.m,width:30}}>{it.unit}</span></div>)}</>}
      {tab==="serials"&&serialItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>setSettings(p=>({...p,[it.k]:v}))}/>)}
      {tab==="features"&&featureItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>setSettings(p=>({...p,[it.k]:v}))}/>)}
      {tab==="admin"&&<>
        <div style={{padding:12,borderRadius:8,background:"rgba(251,191,36,.03)",border:"1px solid rgba(251,191,36,.1)",marginBottom:8}}>
          <div style={{fontSize:10,color:T.am,fontFamily:T.m}}>Configure which pages Admins can access. Super Admins always have full access.</div></div>
        {adminPermItems.map(it=><ToggleRow key={it.k} item={it} checked={settings.adminPerms?.[it.k]!==false} 
          onChange={v=>setSettings(p=>({...p,adminPerms:{...p.adminPerms,[it.k]:v}}))}/>)}</>}</div></div>);}

/* ═══════════ MY PROFILE (User Settings) ═══════════ */
function MyProfile({user,personnel,setPersonnel,kits,assets,depts}){
  const[editing,setEditing]=useState(false);
  const[fm,setFm]=useState({name:user.name,title:user.title||""});
  
  const save=()=>{if(!fm.name.trim())return;
    setPersonnel(p=>p.map(x=>x.id===user.id?{...x,name:fm.name.trim(),title:fm.title.trim()}:x));
    setEditing(false)};
  
  const myKits=kits.filter(k=>k.issuedTo===user.id);
  const myAssets=assets.filter(a=>a.issuedTo===user.id);
  const myDept=user.deptId?depts.find(d=>d.id===user.deptId):null;
  const roleColor=user.role==="super"?T.rd:user.role==="admin"?T.am:T.bl;
  const roleLabel=user.role==="super"?"Super Admin":user.role==="admin"?"Admin":"User";
  
  return(<div>
    <SH title="My Profile" sub="Your account settings"/>
    
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
      {/* Profile Card */}
      <div style={{padding:24,borderRadius:12,background:T.card,border:"1px solid "+T.bd}}>
        {!editing?<>
          {/* View Mode */}
          <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:20}}>
            <div style={{width:64,height:64,borderRadius:32,background:roleColor+"22",border:"2px solid "+roleColor+"44",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:roleColor,fontFamily:T.u}}>
              {user.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:18,fontWeight:700,color:T.tx,fontFamily:T.u}}>{user.name}</div>
              <div style={{fontSize:12,color:T.mu,fontFamily:T.m}}>{user.title||"No title set"}</div>
            </div>
            <Bt onClick={()=>{setFm({name:user.name,title:user.title||""});setEditing(true)}}>Edit</Bt>
          </div>
        </>:<>
          {/* Edit Mode */}
          <div style={{marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:16}}>
              <div style={{width:64,height:64,borderRadius:32,background:roleColor+"22",border:"2px solid "+roleColor+"44",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:700,color:roleColor,fontFamily:T.u}}>
                {fm.name.split(" ").map(n=>n[0]).join("").slice(0,2)||"?"}</div>
              <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u}}>Edit Profile</div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <Fl label="Name">
                <In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))} placeholder="Your full name"/></Fl>
              <Fl label="Title">
                <In value={fm.title} onChange={e=>setFm(p=>({...p,title:e.target.value}))} placeholder="e.g. Project Manager, Engineer"/></Fl>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:16}}>
              <Bt onClick={()=>setEditing(false)}>Cancel</Bt>
              <Bt v="primary" onClick={save}>Save Changes</Bt></div>
          </div>
        </>}
        
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,background:"rgba(255,255,255,.02)"}}>
            <span style={{fontSize:10,color:T.dm,fontFamily:T.m,width:80}}>Role</span>
            <Bg color={roleColor} bg={roleColor+"18"}>{roleLabel}</Bg></div>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,background:"rgba(255,255,255,.02)"}}>
            <span style={{fontSize:10,color:T.dm,fontFamily:T.m,width:80}}>Department</span>
            {myDept?<DeptBg dept={myDept}/>:<span style={{fontSize:11,color:T.mu,fontFamily:T.m}}>Unassigned</span>}</div>
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:8,background:"rgba(255,255,255,.02)"}}>
            <span style={{fontSize:10,color:T.dm,fontFamily:T.m,width:80}}>User ID</span>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{user.id.slice(0,8)}...</span></div>
        </div>
      </div>
      
      {/* My Equipment */}
      <div style={{padding:24,borderRadius:12,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:16}}>My Equipment</div>
        
        {myKits.length>0&&<div style={{marginBottom:16}}>
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.pk,fontFamily:T.m,marginBottom:8}}>Kits ({myKits.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {myKits.map(k=>{const lastIssue=k.issueHistory[k.issueHistory.length-1];return(
              <div key={k.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)"}}>
                <Sw color={k.color} size={22}/>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k.color}</div>
                  <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Since {fmtDate(lastIssue?.issuedDate)}</div></div></div>)})}</div></div>}
        
        {myAssets.length>0&&<div style={{marginBottom:16}}>
          <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.tl,fontFamily:T.m,marginBottom:8}}>Assets ({myAssets.length})</div>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            {myAssets.map(a=>{const lastIssue=a.issueHistory[a.issueHistory.length-1];return(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(45,212,191,.03)",border:"1px solid rgba(45,212,191,.12)"}}>
                <div style={{width:22,height:22,borderRadius:6,background:"rgba(45,212,191,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.tl}}>◎</div>
                <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{a.name}</div>
                  <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{a.serial} | Since {fmtDate(lastIssue?.issuedDate)}</div></div></div>)})}</div></div>}
        
        {myKits.length===0&&myAssets.length===0&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>
          No equipment currently checked out to you</div>}
      </div>
    </div>
    
    {/* Activity Summary */}
    <div style={{marginTop:20,padding:20,borderRadius:12,background:T.card,border:"1px solid "+T.bd}}>
      <div style={{fontSize:14,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:16}}>Account Summary</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:12}}>
        <div style={{padding:14,borderRadius:8,background:"rgba(255,255,255,.02)"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.pk,fontFamily:T.u}}>{myKits.length}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Kits Checked Out</div></div>
        <div style={{padding:14,borderRadius:8,background:"rgba(255,255,255,.02)"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.tl,fontFamily:T.u}}>{myAssets.length}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Assets Checked Out</div></div>
        <div style={{padding:14,borderRadius:8,background:"rgba(255,255,255,.02)"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.bl,fontFamily:T.u}}>{kits.reduce((sum,k)=>sum+k.issueHistory.filter(h=>h.personId===user.id).length,0)}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Total Kit Checkouts</div></div>
        <div style={{padding:14,borderRadius:8,background:"rgba(255,255,255,.02)"}}>
          <div style={{fontSize:22,fontWeight:700,color:T.gn,fontFamily:T.u}}>{kits.filter(k=>k.inspections.some(i=>i.by===user.id)).length}</div>
          <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>Kits Inspected</div></div>
      </div>
    </div>
  </div>);}

/* ═══════════ KIT ISSUANCE ═══════════ */
function KitIssuance({kits,setKits,types,locs,personnel,allC,depts,isAdmin,isSuper,curUserId,settings,requests,setRequests,addLog}){
  const[md,setMd]=useState(null);const[search,setSearch]=useState("");const[view,setView]=useState("all");
  const filt=useMemo(()=>{let list=kits;
    if(view==="issued")list=list.filter(k=>k.issuedTo);if(view==="available")list=list.filter(k=>!k.issuedTo&&!k.maintenanceStatus);
    if(view==="mine")list=list.filter(k=>k.issuedTo===curUserId);
    if(search){const q=search.toLowerCase();list=list.filter(k=>{const p=k.issuedTo?personnel.find(x=>x.id===k.issuedTo):null;const lo=locs.find(l=>l.id===k.locId);
      return k.color.toLowerCase().includes(q)||(p&&p.name.toLowerCase().includes(q))||(lo&&lo.name.toLowerCase().includes(q))});}
    return list},[kits,view,search,personnel,locs,curUserId]);
  const issuedCt=kits.filter(k=>k.issuedTo).length;const myCt=kits.filter(k=>k.issuedTo===curUserId).length;
  const needsApproval=kit=>{if(!settings.requireDeptApproval||!kit.deptId||isSuper||isAdmin)return false;
    const dept=depts.find(d=>d.id===kit.deptId);return!(dept&&dept.headId===curUserId)};
  const doCheckout=(kitId,data)=>{const kit=kits.find(k=>k.id===kitId);
    if(kit&&needsApproval(kit)){setRequests(p=>[...p,{id:uid(),kitId,personId:curUserId,deptId:kit.deptId,date:td(),status:"pending",serials:data.serials,notes:data.notes,resolvedBy:null,resolvedDate:null}]);
      addLog("checkout_request","kit",kitId,curUserId,now(),{kitColor:kit.color});setMd(null);return}
    setKits(p=>p.map(k=>{if(k.id!==kitId)return k;const ns={...k.serials};if(data.serials)Object.entries(data.serials).forEach(([cid,sn])=>{if(sn)ns[cid]=sn});
      return{...k,issuedTo:curUserId,serials:ns,issueHistory:[...k.issueHistory,{id:uid(),personId:curUserId,issuedDate:td(),returnedDate:null,issuedBy:curUserId,checkoutSerials:data.serials||{},returnSerials:{},checkoutLoc:k.locId}]}}));
    addLog("checkout","kit",kitId,curUserId,now(),{kitColor:kit.color});setMd(null)};
  const doAdminIssue=(kitId,personId,data)=>{const kit=kits.find(k=>k.id===kitId);
    setKits(p=>p.map(k=>{if(k.id!==kitId)return k;const ns={...k.serials};if(data.serials)Object.entries(data.serials).forEach(([cid,sn])=>{if(sn)ns[cid]=sn});
      return{...k,issuedTo:personId,serials:ns,issueHistory:[...k.issueHistory,{id:uid(),personId,issuedDate:td(),returnedDate:null,issuedBy:curUserId,checkoutSerials:data.serials||{},returnSerials:{},checkoutLoc:k.locId}]}}));
    addLog("checkout","kit",kitId,curUserId,now(),{kitColor:kit?.color,issuedTo:personnel.find(p=>p.id===personId)?.name});setMd(null)};
  const doReturn=(kitId,data)=>{const kit=kits.find(k=>k.id===kitId);
    setKits(p=>p.map(k=>{if(k.id!==kitId)return k;const ns={...k.serials};if(data.serials)Object.entries(data.serials).forEach(([cid,sn])=>{if(sn)ns[cid]=sn});
      const hist=k.issueHistory.map((h,i)=>i===k.issueHistory.length-1&&!h.returnedDate?{...h,returnedDate:td(),returnSerials:data.serials||{},returnNotes:data.notes,returnLoc:k.locId}:h);
      return{...k,issuedTo:null,serials:ns,issueHistory:hist}}));
    addLog("return","kit",kitId,curUserId,now(),{kitColor:kit?.color});setMd(null)};
  return(<div>
    <SH title="Checkout / Return" sub={issuedCt+" out | "+(kits.length-issuedCt)+" available | "+myCt+" mine"}
      action={<div style={{display:"flex",gap:6}}>
        <Bt sm onClick={()=>setMd("qr-scan")}>Scan QR</Bt>
        {(isAdmin||isSuper)&&<Bt v="primary" onClick={()=>setMd("adminIssue")}>Admin Issue</Bt>}</div>}/>
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{width:200}}/>
      {["all","mine","issued","available"].map(v=>{const ct=v==="all"?kits.length:v==="mine"?myCt:v==="issued"?issuedCt:kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length;
        return <button key={v} onClick={()=>setView(v)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:5,fontSize:10,fontFamily:T.m,fontWeight:600,
          background:view===v?"rgba(255,255,255,.08)":"transparent",color:view===v?T.tx:T.mu,border:"1px solid "+(view===v?T.bdH:T.bd)}}>{v} ({ct})</button>})}</div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:8}}>
      {filt.map(kit=>{const person=kit.issuedTo?personnel.find(p=>p.id===kit.issuedTo):null;const lo=locs.find(l=>l.id===kit.locId);const ty=types.find(t=>t.id===kit.typeId);
        const st=stMeta(kit.lastChecked);const isMine=kit.issuedTo===curUserId;const dept=kit.deptId?depts.find(d=>d.id===kit.deptId):null;const na=needsApproval(kit);const inMaint=kit.maintenanceStatus;
        return(<div key={kit.id} style={{padding:14,borderRadius:8,background:isMine?"rgba(244,114,182,.02)":T.card,border:isMine?"1px solid rgba(244,114,182,.15)":"1px solid "+T.bd}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <Sw color={kit.color} size={28}/>
            <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,color:T.tx,fontFamily:T.u}}>{kit.color}</div>
              <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name} | {lo?.name}</div></div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2}}><Bg color={st.fg} bg={st.bg}>{st.tag}</Bg>{dept&&<DeptBg dept={dept}/>}</div></div>
          {(settings.allowUserLocationUpdate||isAdmin||isSuper)&&!inMaint&&<div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={kit.locId} onChange={e=>{setKits(p=>p.map(k=>k.id===kit.id?{...k,locId:e.target.value}:k));
              addLog("location_change","kit",kit.id,curUserId,now(),{kitColor:kit.color,from:lo?.name,to:locs.find(l=>l.id===e.target.value)?.name})}} style={{flex:1,fontSize:9,padding:"4px 8px"}}/></div>}
          {inMaint?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(251,191,36,.04)",border:"1px solid rgba(251,191,36,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.am}}/><span style={{fontSize:10,color:T.am,fontFamily:T.m}}>In Maintenance ({kit.maintenanceStatus})</span></div>
          :person?<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:isMine?"rgba(244,114,182,.06)":"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.pk}}/><span style={{fontSize:10,fontWeight:600,color:T.pk,fontFamily:T.m,flex:1}}>{isMine?"YOU":person.name}</span>
            {(isMine||isAdmin||isSuper)&&<Bt v="warn" sm onClick={()=>setMd("return:"+kit.id)}>Return</Bt>}</div>
          :<div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:7,background:"rgba(34,197,94,.03)",border:"1px solid rgba(34,197,94,.1)"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:T.gn}}/><span style={{fontSize:10,color:T.gn,fontFamily:T.m,flex:1}}>Available</span>
            {(settings.allowUserCheckout||isAdmin||isSuper)&&<Bt v={na?"orange":"primary"} sm onClick={()=>setMd("checkout:"+kit.id)}>{na?"Request":"Checkout"}</Bt>}</div>}</div>)})}</div>
    {!filt.length&&<div style={{padding:40,textAlign:"center",color:T.dm,fontFamily:T.m}}>No kits match</div>}
    <ModalWrap open={String(md).startsWith("checkout:")} onClose={()=>setMd(null)} title="Checkout Kit" wide>
      {String(md).startsWith("checkout:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <SerialEntryForm kit={k} type={ty} allC={allC} existingSerials={k.serials} mode="checkout" onDone={data=>doCheckout(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={String(md).startsWith("return:")} onClose={()=>setMd(null)} title="Return Kit" wide>
      {String(md).startsWith("return:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <SerialEntryForm kit={k} type={ty} allC={allC} existingSerials={k.serials} mode="return" onDone={data=>doReturn(kid,data)} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={md==="adminIssue"} onClose={()=>setMd(null)} title="Admin Issue" wide>
      {md==="adminIssue"&&<AdminIssuePicker kits={kits} types={types} locs={locs} personnel={personnel} allC={allC} settings={settings} onIssue={(kid,pid,data)=>doAdminIssue(kid,pid,data)} onCancel={()=>setMd(null)}/>}</ModalWrap>
    {/* QR Scanner for quick checkout/return */}
    <ModalWrap open={md==="qr-scan"} onClose={()=>setMd(null)} title="Scan QR to Checkout/Return">
      {md==="qr-scan"&&<QRScanner onScan={val=>{
        const parsed=parseQR(val);
        if(parsed?.type==="kit"){const k=kits.find(x=>x.id===parsed.id);
          if(k){if(k.issuedTo){setMd("return:"+k.id)}else if(!k.maintenanceStatus){setMd("checkout:"+k.id)}else{setMd(null)}return}}
        /* Fallback: search by color */
        const q=val.toLowerCase();const match=kits.find(k=>k.color.toLowerCase()===q||Object.values(k.serials).some(s=>s?.toLowerCase()===q));
        if(match){if(match.issuedTo){setMd("return:"+match.id)}else if(!match.maintenanceStatus){setMd("checkout:"+match.id)}else{setMd(null)}}
        else{setSearch(val);setMd(null)}
      }} onClose={()=>setMd(null)}/>}</ModalWrap></div>);}

function AdminIssuePicker({kits,types,locs,personnel,allC,settings,onIssue,onCancel}){
  const[selKit,setSelKit]=useState("");const[selPerson,setSelPerson]=useState("");const[phase,setPhase]=useState("pick");
  const availKits=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus);const kit=kits.find(k=>k.id===selKit);const ty=kit?types.find(t=>t.id===kit.typeId):null;
  if(phase==="serials"&&kit&&ty)return <SerialEntryForm kit={kit} type={ty} allC={allC} existingSerials={kit.serials} mode="checkout" onDone={data=>onIssue(selKit,selPerson,data)} onCancel={()=>setPhase("pick")} settings={settings}/>;
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <Fl label="Kit"><Sl options={[{v:"",l:"-- Select --"},...availKits.map(k=>{const lo=locs.find(l=>l.id===k.locId);return{v:k.id,l:k.color+" ("+(lo?.name||"?")+")"}})]} value={selKit} onChange={e=>setSelKit(e.target.value)}/></Fl>
    <Fl label="Issue To"><Sl options={[{v:"",l:"-- Select --"},...personnel.map(p=>({v:p.id,l:p.name}))]} value={selPerson} onChange={e=>setSelPerson(e.target.value)}/></Fl>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt><Bt v="primary" onClick={()=>setPhase("serials")} disabled={!selKit||!selPerson}>Next</Bt></div></div>);}

/* ═══════════ KIT INVENTORY ═══════════ */
function KitInv({kits,setKits,types,locs,comps:allC,personnel,depts,isAdmin,isSuper,settings,favorites,setFavorites,addLog,curUserId,initialFilter="all",onFilterChange,analytics}){
  const[selId,setSelId]=useState(null);const[md,setMd]=useState(null);const[search,setSearch]=useState("");const[lf,setLf]=useState("ALL");
  const[statusFilter,setStatusFilter]=useState(initialFilter);
  const[kf,setKf]=useState(null);const sel=kits.find(k=>k.id===selId);
  
  /* Sync with external filter */
  useEffect(()=>{setStatusFilter(initialFilter)},[initialFilter]);
  const changeStatusFilter=(f)=>{setStatusFilter(f);if(onFilterChange)onFilterChange(f)};
  
  const openAdd=()=>{const ft=types[0];setKf({typeId:ft?.id||"",color:"BLACK",locId:locs[0]?.id||"",fields:{},deptId:""});setMd("addK")};
  const saveK=()=>{if(!kf)return;const ty=types.find(t=>t.id===kf.typeId);
    if(md==="addK"){const ns={};const nc={};if(ty){const ex=expandComps(ty.compIds,ty.compQtys||{});ex.forEach(e=>{ns[e.key]="";nc[e.key]=null})}
      setKits(p=>[...p,{id:uid(),typeId:kf.typeId,color:kf.color,locId:kf.locId,deptId:kf.deptId||null,fields:{...kf.fields},lastChecked:null,
        comps:ty?mkCS(ty.compIds,ty.compQtys||{}):{},serials:ns,calibrationDates:nc,inspections:[],issuedTo:null,issueHistory:[],maintenanceStatus:null,maintenanceHistory:[],photos:[]}]);
      addLog("kit_create","kit",null,curUserId,now(),{kitColor:kf.color})}
    else{setKits(p=>p.map(k=>k.id===md?{...k,typeId:kf.typeId,color:kf.color,locId:kf.locId,deptId:kf.deptId||null,fields:{...kf.fields}}:k))}
    setMd(null);setKf(null)};
  const doneInsp=data=>{const kid=String(md).split(":")[1];
    setKits(p=>p.map(k=>{if(k.id!==kid)return k;const ns={...k.serials};if(data.serials)Object.entries(data.serials).forEach(([cid,sn])=>{if(sn)ns[cid]=sn});
      return{...k,comps:data.results,lastChecked:data.date,serials:ns,inspections:[...k.inspections,data],photos:[...k.photos,...(data.photos||[])]}}));
    addLog("inspect","kit",kid,curUserId,now(),{kitColor:kits.find(x=>x.id===kid)?.color});setMd(null)};
  
  /* Get overdue kit IDs from analytics if available */  
  const overdueIds=useMemo(()=>new Set((analytics?.overdueReturns||[]).map(k=>k.id)),[analytics]);
  const maintIds=useMemo(()=>new Set((analytics?.inMaintenance||[]).map(k=>k.id)),[analytics]);
  
  const filt=useMemo(()=>kits.filter(k=>{
    /* Status filter */
    if(statusFilter==="issued"&&!k.issuedTo)return false;
    if(statusFilter==="available"&&(k.issuedTo||k.maintenanceStatus))return false;
    if(statusFilter==="maintenance"&&!k.maintenanceStatus)return false;
    if(statusFilter==="overdue"&&!overdueIds.has(k.id))return false;
    /* Location filter */
    if(lf!=="ALL"&&k.locId!==lf)return false;
    /* Search filter */
    if(!search)return true;const q=search.toLowerCase();const lo=locs.find(l=>l.id===k.locId);
    return k.color.toLowerCase().includes(q)||(lo?.name||"").toLowerCase().includes(q)||Object.values(k.fields).some(v=>String(v).toLowerCase().includes(q))||Object.values(k.serials).some(v=>v?.toLowerCase().includes(q))}),[kits,lf,search,locs,statusFilter,overdueIds]);
  const lc=useMemo(()=>{const c={};kits.forEach(k=>{c[k.locId]=(c[k.locId]||0)+1});return c},[kits]);
  const cType=kf?types.find(t=>t.id===kf.typeId):null;const canInspect=settings.allowUserInspect||isAdmin||isSuper;
  const toggleFav=id=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);
  
  /* Status filter counts */
  const issuedCt=kits.filter(k=>k.issuedTo).length;
  const availCt=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length;
  const maintCt=kits.filter(k=>k.maintenanceStatus).length;
  const overdueCt=overdueIds.size;
  
  return(<div>
    <SH title="Kit Inventory" sub={kits.length+" kits"} action={<div style={{display:"flex",gap:6}}>
      <Bt sm onClick={()=>setMd("qr-scan")}>Scan QR</Bt>
      <Bt sm v="ind" onClick={()=>setMd("qr-bulk")}>Print QR Codes</Bt>
      {(isAdmin||isSuper)&&<Bt v="primary" onClick={openAdd} disabled={!types.length}>+ Add Kit</Bt>}</div>}/>
    
    {/* Status filter tabs */}
    <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}>
      {[{id:"all",l:"All",ct:kits.length,c:T.bl},{id:"available",l:"Available",ct:availCt,c:T.gn},{id:"issued",l:"Checked Out",ct:issuedCt,c:T.pk},
        {id:"maintenance",l:"Maintenance",ct:maintCt,c:T.am},{id:"overdue",l:"Overdue",ct:overdueCt,c:T.rd}].map(s=>
        <button key={s.id} onClick={()=>changeStatusFilter(s.id)} style={{all:"unset",cursor:"pointer",padding:"5px 12px",borderRadius:6,fontSize:10,fontFamily:T.m,
          background:statusFilter===s.id?s.c+"22":"transparent",color:statusFilter===s.id?s.c:T.mu,border:"1px solid "+(statusFilter===s.id?s.c+"44":T.bd),
          fontWeight:statusFilter===s.id?600:400,transition:"all .12s"}}>{s.l} ({s.ct})</button>)}</div>
    
    <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap",alignItems:"center"}}>
      <In value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search kits, serials..." style={{width:200}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
        <button onClick={()=>setLf("ALL")} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,fontWeight:600,
          background:lf==="ALL"?"rgba(255,255,255,.08)":"transparent",color:lf==="ALL"?T.tx:T.mu,border:"1px solid "+(lf==="ALL"?T.bdH:T.bd)}}>ALL ({kits.length})</button>
        {locs.map(l=><button key={l.id} onClick={()=>setLf(lf===l.id?"ALL":l.id)} style={{all:"unset",cursor:"pointer",padding:"3px 10px",borderRadius:5,fontSize:9,fontFamily:T.m,
          background:lf===l.id?"rgba(255,255,255,.08)":"transparent",color:lf===l.id?T.tx:T.mu,border:"1px solid "+(lf===l.id?T.bdH:T.bd)}}>{l.sc} ({lc[l.id]||0})</button>)}</div></div>
    <div style={{display:"grid",gridTemplateColumns:sel?"1fr 360px":"1fr",gap:0}}>
      <div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:8}}>
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
              {kit.maintenanceStatus?<Bg color={T.am} bg="rgba(251,191,36,.08)">Maint</Bg>:person?<Bg color={T.pk} bg="rgba(244,114,182,.06)">{person.title}</Bg>:<Bg color={T.gn} bg="rgba(34,197,94,.05)">Avail</Bg>}
              {dept&&<DeptBg dept={dept}/>}</div>
            {cEx.length>0&&<div style={{display:"flex",gap:1}}>{cEx.map(e=>{const s=cSty[kit.comps[e.key]||"GOOD"];return <div key={e.key} style={{flex:1,height:2.5,borderRadius:1,background:s.fg,opacity:.55}}/>})}</div>}</button>)})}</div>
        {!filt.length&&<div style={{padding:40,textAlign:"center",color:T.dm,fontFamily:T.m}}>No kits</div>}</div>
      {sel&&(()=>{const ty=types.find(t=>t.id===sel.typeId);const lo=locs.find(l=>l.id===sel.locId);const st=stMeta(sel.lastChecked);
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
          {(settings.allowUserLocationUpdate||isAdmin||isSuper)&&!sel.maintenanceStatus&&<div style={{marginBottom:14}}><Fl label="Location">
            <Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={sel.locId} onChange={e=>{setKits(p=>p.map(k=>k.id===sel.id?{...k,locId:e.target.value}:k));
              addLog("location_change","kit",sel.id,curUserId,now(),{kitColor:sel.color,to:locs.find(l=>l.id===e.target.value)?.name})}}/></Fl></div>}
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
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:2}}>{cs.map(c=>{const s=cSty[sel.comps[c._key]||"GOOD"];const lbl=c._qty>1?c.label+" ("+(c._idx+1)+" of "+c._qty+")":c.label;return(
              <div key={c._key} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 7px",borderRadius:4,background:"rgba(255,255,255,.012)"}}>
                <span style={{color:s.fg,fontSize:9,fontWeight:700,width:16}}>{s.ic}</span><span style={{fontSize:8,color:(sel.comps[c._key]||"GOOD")==="GOOD"?T.mu:T.tx,fontFamily:T.m}}>{lbl}</span></div>)})}</div></div>}
          {/* Inline QR Code */}
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,background:"rgba(129,140,248,.03)",border:"1px solid rgba(129,140,248,.1)",marginBottom:8,cursor:"pointer"}}
            onClick={()=>setMd("qr:"+sel.id)}>
            <QRSvg data={qrKitData(sel.id)} size={56} padding={1}/>
            <div style={{flex:1}}>
              <div style={{fontSize:10,fontWeight:600,color:T.ind,fontFamily:T.m}}>QR Code</div>
              <div style={{fontSize:8,color:T.dm,fontFamily:T.m}}>Click to view full size, print, or see serialized items</div></div></div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {canInspect&&!sel.maintenanceStatus&&<Bt v="success" sm onClick={()=>setMd("insp:"+sel.id)}>Inspect</Bt>}
            {(isAdmin||isSuper)&&<Bt v="primary" sm onClick={()=>{setKf({typeId:sel.typeId,color:sel.color,locId:sel.locId,fields:{...sel.fields},deptId:sel.deptId||""});setMd(sel.id)}}>Edit</Bt>}
            <Bt sm v="ind" onClick={()=>setMd("qr:"+sel.id)}>QR Code</Bt>
            <Bt sm onClick={()=>setMd("hist:"+sel.id)}>History</Bt>
            {(isAdmin||isSuper)&&<Bt v="danger" sm onClick={()=>{setKits(p=>p.filter(k=>k.id!==sel.id));setSelId(null)}} style={{marginLeft:"auto"}}>Delete</Bt>}</div></div>)})()}</div>
    <ModalWrap open={md==="addK"||kf&&md&&md!=="addK"&&!String(md).startsWith("insp")&&!String(md).startsWith("hist")&&!String(md).startsWith("qr")} onClose={()=>{setMd(null);setKf(null)}} title={md==="addK"?"Add Kit":"Edit Kit"}>
      {kf&&<div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Type"><Sl options={types.map(t=>({v:t.id,l:t.name}))} value={kf.typeId} onChange={e=>setKf(p=>({...p,typeId:e.target.value,fields:{}}))}/></Fl>
        <Fl label="Color"><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{Object.keys(CM).map(c=><button key={c} onClick={()=>setKf(p=>({...p,color:c}))} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:5,
          padding:"4px 8px",borderRadius:5,background:kf.color===c?"rgba(255,255,255,.1)":T.card,border:"1px solid "+(kf.color===c?T.bdH:T.bd)}}><Sw color={c} size={16}/><span style={{fontSize:9,color:kf.color===c?T.tx:T.mu,fontFamily:T.m}}>{c}</span></button>)}</div></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Location"><Sl options={locs.map(l=>({v:l.id,l:l.name}))} value={kf.locId} onChange={e=>setKf(p=>({...p,locId:e.target.value}))}/></Fl>
          <Fl label="Department"><Sl options={[{v:"",l:"-- None --"},...depts.map(d=>({v:d.id,l:d.name}))]} value={kf.deptId||""} onChange={e=>setKf(p=>({...p,deptId:e.target.value}))}/></Fl></div>
        {cType&&cType.fields.map(f=><Fl key={f.key} label={f.label}>{f.type==="toggle"?<Tg checked={!!kf.fields[f.key]} onChange={v=>setKf(p=>({...p,fields:{...p.fields,[f.key]:v}}))}/>
          :<In value={kf.fields[f.key]||""} onChange={e=>setKf(p=>({...p,fields:{...p.fields,[f.key]:e.target.value}}))}/>}</Fl>)}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>{setMd(null);setKf(null)}}>Cancel</Bt><Bt v="primary" onClick={saveK}>{md==="addK"?"Add":"Save"}</Bt></div></div>}</ModalWrap>
    <ModalWrap open={String(md).startsWith("insp:")} onClose={()=>setMd(null)} title="Inspection" wide>
      {String(md).startsWith("insp:")&&(()=>{const kid=String(md).split(":")[1];const k=kits.find(x=>x.id===kid);const ty=k?types.find(t=>t.id===k.typeId):null;
        if(!k||!ty)return null;return <InspWF kit={k} type={ty} allC={allC} onDone={doneInsp} onCancel={()=>setMd(null)} settings={settings}/>})()}</ModalWrap>
    <ModalWrap open={String(md).startsWith("hist:")} onClose={()=>setMd(null)} title="Kit History" wide>
      {String(md).startsWith("hist:")&&(()=>{const kid=md.split(":")[1];const k=kits.find(x=>x.id===kid);if(!k)return null;
        const all=[...k.inspections.map(i=>({type:"inspection",...i})),...k.issueHistory.map(h=>({type:"checkout",...h})),...k.maintenanceHistory.map(m=>({type:"maintenance",...m}))]
          .sort((a,b)=>new Date(b.date||b.issuedDate||b.startDate)-new Date(a.date||a.issuedDate||a.startDate));
        return(<div style={{maxHeight:400,overflowY:"auto"}}>{all.length?all.map((e,i)=><div key={i} style={{padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Bg color={e.type==="inspection"?T.tl:e.type==="checkout"?T.bl:T.am} bg={(e.type==="inspection"?T.tl:e.type==="checkout"?T.bl:T.am)+"18"}>{e.type}</Bg>
            <span style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{e.date||e.issuedDate||e.startDate}</span></div>
          {e.type==="inspection"&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:4}}>Inspector: {e.inspector}</div>}
          {e.type==="checkout"&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:4}}>{personnel.find(p=>p.id===e.personId)?.name}{e.returnedDate?" → Returned "+e.returnedDate:""}</div>}
          {e.type==="maintenance"&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginTop:4}}>{e.reason}{e.endDate?" → Completed "+e.endDate:""}</div>}</div>)
          :<div style={{padding:20,textAlign:"center",color:T.dm}}>No history</div>}</div>)})()}</ModalWrap>
    {/* QR Code detail modal */}
    <ModalWrap open={String(md).startsWith("qr:")&&md!=="qr-scan"&&md!=="qr-bulk"} onClose={()=>setMd(null)} title="Kit QR Code">
      {String(md).startsWith("qr:")&&md!=="qr-scan"&&md!=="qr-bulk"&&(()=>{const kid=md.slice(3);const k=kits.find(x=>x.id===kid);
        if(!k)return null;const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
        const serComps=ty?expandComps(ty.compIds,ty.compQtys||{}).map(e=>{const c=allC.find(x=>x.id===e.compId);
          return c&&c.ser&&k.serials[e.key]?{key:e.key,label:e.qty>1?c.label+" ("+(e.idx+1)+" of "+e.qty+")":c.label,serial:k.serials[e.key]}:null}).filter(Boolean):[];
        return <QRDetailView qrData={qrKitData(k.id)} label={"Kit "+k.color} sub={(ty?.name||"")+" | "+(lo?.name||"")}
          serials={serComps} kitId={k.id} onClose={()=>setMd(null)}/>})()}</ModalWrap>
    {/* QR Scanner modal */}
    <ModalWrap open={md==="qr-scan"} onClose={()=>setMd(null)} title="Scan QR Code">
      {md==="qr-scan"&&<QRScanner onScan={val=>{
        const parsed=parseQR(val);
        if(parsed?.type==="kit"){const k=kits.find(x=>x.id===parsed.id);if(k){setSelId(k.id);setMd(null);return}}
        /* Fallback: search by color or serial */
        const q=val.toLowerCase();const match=kits.find(k=>k.color.toLowerCase()===q||Object.values(k.serials).some(s=>s?.toLowerCase()===q));
        if(match){setSelId(match.id);setMd(null)}else{setMd(null);setSearch(val)}
      }} onClose={()=>setMd(null)}/>}</ModalWrap>
    {/* Bulk QR Print modal */}
    <ModalWrap open={md==="qr-bulk"} onClose={()=>setMd(null)} title="Print QR Codes" wide>
      {md==="qr-bulk"&&<QRPrintSheet items={filt.map(k=>{const ty=types.find(t=>t.id===k.typeId);const lo=locs.find(l=>l.id===k.locId);
        return{id:k.id,qrData:qrKitData(k.id),label:"Kit "+k.color,sub:(ty?.name||"")+" | "+(lo?.name||"")}})}
        onClose={()=>setMd(null)}/>}</ModalWrap></div>);}

/* ═══════════ APPROVALS ═══════════ */
function ApprovalsPage({requests,setRequests,kits,setKits,personnel,depts,allC,types,curUserId,addLog}){
  const user=personnel.find(p=>p.id===curUserId);const isSuper=user?.role==="super";
  const headOf=depts.filter(d=>d.headId===curUserId).map(d=>d.id);
  const visible=requests.filter(r=>isSuper||headOf.includes(r.deptId));
  const pending=visible.filter(r=>r.status==="pending");const resolved=visible.filter(r=>r.status!=="pending");
  const approve=reqId=>{const req=requests.find(r=>r.id===reqId);if(!req)return;
    setRequests(p=>p.map(r=>r.id===reqId?{...r,status:"approved",resolvedBy:curUserId,resolvedDate:td()}:r));
    setKits(p=>p.map(k=>{if(k.id!==req.kitId)return k;const ns={...k.serials};if(req.serials)Object.entries(req.serials).forEach(([cid,sn])=>{if(sn)ns[cid]=sn});
      return{...k,issuedTo:req.personId,serials:ns,issueHistory:[...k.issueHistory,{id:uid(),personId:req.personId,issuedDate:td(),returnedDate:null,issuedBy:curUserId,checkoutSerials:req.serials||{},returnSerials:{},checkoutLoc:k.locId}]}}));
    addLog("approved","kit",req.kitId,curUserId,now(),{kitColor:kits.find(k=>k.id===req.kitId)?.color})};
  const deny=reqId=>{setRequests(p=>p.map(r=>r.id===reqId?{...r,status:"denied",resolvedBy:curUserId,resolvedDate:td()}:r));
    addLog("denied","kit",requests.find(r=>r.id===reqId)?.kitId,curUserId,now())};
  return(<div>
    <SH title="Approvals" sub={pending.length+" pending"}/>
    {!pending.length&&<div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m}}>No pending requests</div>}
    {pending.map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId);const dept=depts.find(d=>d.id===req.deptId);
      return(<div key={req.id} style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd,marginBottom:8,borderLeft:"3px solid "+T.or}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>{kit&&<Sw color={kit.color} size={28}/>}
          <div style={{flex:1}}><div style={{fontSize:14,fontWeight:700,fontFamily:T.u,color:T.tx}}>Checkout: Kit {kit?.color}</div>
            <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{person?.name} | {req.date}</div></div>
          <Bg color={T.or} bg="rgba(251,146,60,.1)">PENDING</Bg></div>
        {dept&&<div style={{marginBottom:8}}><DeptBg dept={dept}/></div>}
        {req.notes&&<div style={{fontSize:10,color:T.mu,fontFamily:T.m,marginBottom:8,fontStyle:"italic"}}>"{req.notes}"</div>}
        <div style={{display:"flex",gap:6}}><Bt v="success" sm onClick={()=>approve(req.id)}>Approve</Bt><Bt v="danger" sm onClick={()=>deny(req.id)}>Deny</Bt></div></div>)})}
    {resolved.length>0&&<div style={{marginTop:20}}><div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:T.mu,fontFamily:T.m,marginBottom:8}}>Resolved</div>
      {resolved.slice().reverse().slice(0,10).map(req=>{const kit=kits.find(k=>k.id===req.kitId);const person=personnel.find(p=>p.id===req.personId);
        return(<div key={req.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:T.card,border:"1px solid "+T.bd,marginBottom:4}}>
          {kit&&<Sw color={kit.color} size={20}/>}<span style={{flex:1,fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{person?.name}</span>
          <span style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{req.resolvedDate}</span>
          <Bg color={req.status==="approved"?T.gn:T.rd} bg={req.status==="approved"?"rgba(34,197,94,.1)":"rgba(239,68,68,.1)"}>{req.status}</Bg></div>)})}</div>}</div>);}

/* ═══════════ DASHBOARD ═══════════ */
function Dash({kits,types,locs,personnel,depts,requests,analytics,logs,settings,curUserId,favorites,setFavorites,onNavigate,onAction,onFilterKits}){
  const nev=kits.filter(k=>!k.lastChecked).length;const issuedCt=kits.filter(k=>k.issuedTo).length;const pendCt=requests.filter(r=>r.status==="pending").length;
  const myKits=kits.filter(k=>k.issuedTo===curUserId);
  const availCt=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus).length;
  const maintCt=analytics.inMaintenance.length;const overdueCt=analytics.overdueReturns.length;
  return(<div>
    <SH title="Dashboard" sub="Fleet overview"/>
    {/* Stats Row */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:24}}>
      <StatCard label="Total Kits" value={kits.length} color={T.bl} onClick={()=>onFilterKits("all")}/>
      <StatCard label="Checked Out" value={issuedCt} color={issuedCt?T.pk:T.gn} onClick={()=>onFilterKits("issued")}/>
      <StatCard label="Available" value={availCt} color={T.gn} onClick={()=>onFilterKits("available")}/>
      <StatCard label="Maintenance" value={maintCt} color={maintCt?T.am:T.gn} onClick={()=>onFilterKits("maintenance")}/>
      <StatCard label="Overdue" value={overdueCt} color={overdueCt?T.rd:T.gn} onClick={()=>onFilterKits("overdue")}/>
      <StatCard label="Pending" value={pendCt} color={pendCt?T.or:T.gn} onClick={pendCt?()=>onNavigate("approvals"):undefined}/></div>
    
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
      {/* Alerts */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:T.rd}}>⚠</span> Needs Attention</div>
        <AlertsPanel analytics={analytics} kits={kits} settings={settings} onNavigate={onNavigate} onFilterKits={onFilterKits}/></div>
      
      {/* Quick Actions */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Quick Actions</div>
        <QuickActions kits={kits} curUserId={curUserId} personnel={personnel} onAction={onAction} favorites={favorites} onToggleFav={id=>setFavorites(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id])}/></div>
      
      {/* Recent Activity */}
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Recent Activity</div>
        <ActivityFeed logs={logs} kits={kits} personnel={personnel} limit={8}/></div></div>
    
    {/* Location breakdown */}
    <div style={{marginTop:20,display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>By Location</div>
        {locs.map(l=>{const lk=kits.filter(k=>k.locId===l.id);if(!lk.length)return null;return(
          <div key={l.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4}}>
            <div style={{width:26,height:26,borderRadius:5,background:"rgba(45,212,191,.06)",border:"1px solid rgba(45,212,191,.15)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:T.tl,fontFamily:T.m}}>{l.sc.slice(0,3)}</div>
            <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{l.name}</div></div>
            <Bg color={T.bl} bg="rgba(96,165,250,.1)">{lk.length}</Bg>
            {lk.filter(k=>k.issuedTo).length>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{lk.filter(k=>k.issuedTo).length} out</Bg>}</div>)})}</div>
      
      <div style={{padding:16,borderRadius:10,background:T.card,border:"1px solid "+T.bd}}>
        <div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u,marginBottom:12}}>Department Health</div>
        {analytics.deptStats.map(d=><div key={d.dept.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:6,background:"rgba(255,255,255,.015)",marginBottom:4}}>
          <div style={{width:4,height:24,borderRadius:2,background:d.dept.color}}/>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{d.dept.name}</div>
            <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{d.kitCount} kits | {Math.round(d.compliance*100)}% compliant</div></div>
          <ProgressBar value={d.compliance*100} max={100} color={d.compliance>.8?T.gn:d.compliance>.5?T.am:T.rd} height={6}/></div>)}</div></div></div>);}

/* ═══════════ ROOT APP ═══════════ */
/* Navigation structure with sections */
const NAV_SECTIONS=[
  {id:"main",label:null,items:[
    {id:"dashboard",l:"Dashboard",i:"◉",access:"all"},
    {id:"kits",l:"Inventory",i:"▤",access:"all"},
    {id:"issuance",l:"Checkout",i:"↔",access:"all"},
  ]},
  {id:"tools",label:"Tools",items:[
    {id:"reservations",l:"Reservations",i:"◷",access:"all",setting:"enableReservations"},
    {id:"approvals",l:"Approvals",i:"✓",access:"approver"},
    {id:"maintenance",l:"Maintenance",i:"⚙",access:"admin",perm:"maintenance",setting:"enableMaintenance"},
    {id:"consumables",l:"Inventory",i:"◨",access:"admin",perm:"consumables",setting:"enableConsumables"},
  ]},
  {id:"insights",label:"Insights",items:[
    {id:"analytics",l:"Analytics",i:"◔",access:"admin",perm:"analytics"},
    {id:"reports",l:"Reports",i:"◫",access:"admin",perm:"reports"},
    {id:"auditlog",l:"Audit Log",i:"≡",access:"super"},
  ]},
  {id:"config",label:"Configuration",items:[
    {id:"types",l:"Kit Types",i:"+",access:"admin",perm:"types"},
    {id:"components",l:"Components",i:":",access:"admin",perm:"components"},
    {id:"locations",l:"Locations",i:"⌖",access:"admin",perm:"locations"},
    {id:"departments",l:"Departments",i:"▣",access:"admin",perm:"departments"},
    {id:"personnel",l:"Personnel",i:"◎",access:"admin",perm:"personnel"},
    {id:"settings",l:"Settings",i:"⚙",access:"super"},
  ]},
];

function NavSection({section,pg,setPg,collapsed,onToggle,canAccess,getBadge}){
  const visibleItems=section.items.filter(canAccess);
  if(!visibleItems.length)return null;
  const hasLabel=!!section.label;
  return(<div style={{marginBottom:hasLabel?8:0}}>
    {hasLabel&&<button onClick={onToggle} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:6,
      padding:"6px 16px",width:"100%",boxSizing:"border-box"}}>
      <span style={{fontSize:8,color:T.dm,transition:"transform .15s",transform:collapsed?"rotate(-90deg)":"rotate(0)"}}>▼</span>
      <span style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.5,color:T.dm,fontFamily:T.m,fontWeight:600}}>{section.label}</span></button>}
    {!collapsed&&<div style={{display:"flex",flexDirection:"column",gap:1}}>
      {visibleItems.map(n=>{const badge=getBadge(n.id);return(
        <button key={n.id} onClick={()=>setPg(n.id)} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          padding:"6px 16px",margin:"0 8px",borderRadius:6,fontSize:11,fontWeight:pg===n.id?600:400,fontFamily:T.u,
          background:pg===n.id?"rgba(255,255,255,.06)":"transparent",color:pg===n.id?T.tx:T.mu,transition:"all .12s",
          borderLeft:pg===n.id?"2px solid "+T.bl:"2px solid transparent"}}>
          <span style={{fontSize:9,opacity:.5,fontFamily:T.m,width:12}}>{n.i}</span>{n.l}
          {badge>0&&<span style={{marginLeft:"auto",fontSize:8,fontWeight:700,color:n.id==="approvals"?T.or:T.rd,
            background:n.id==="approvals"?"rgba(251,146,60,.12)":"rgba(239,68,68,.12)",padding:"1px 5px",borderRadius:8,fontFamily:T.m}}>{badge}</span>}
        </button>)})}</div>}</div>);}

/* ═══════════ LOGIN SCREEN ═══════════ */
function LoginScreen({personnel,onLogin}){
  const[selUser,setSelUser]=useState("");const[pin,setPin]=useState("");const[error,setError]=useState("");
  const attempt=()=>{const person=personnel.find(p=>p.id===selUser);
    if(!person){setError("Select a user");return}
    if(person.pin&&person.pin!==pin){setError("Incorrect PIN");return}
    if(!person.pin&&pin){setError("Incorrect PIN");return}
    onLogin(person.id)};
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.u}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}::selection{background:rgba(96,165,250,.3)}
        option{background:#16171b;color:#e4e4e7}
      `}</style>
      <div style={{width:380,padding:36,borderRadius:16,background:T.panel,border:"1px solid "+T.bd,animation:"mdIn .25s ease-out"}}>
        <style>{`@keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:28,background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.25)",
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:22,fontWeight:800,color:T.bl,fontFamily:T.u}}>CG</div>
          <div style={{fontSize:24,fontWeight:800,color:T.tx,letterSpacing:-.5}}>COCO Gear</div>
          <div style={{fontSize:11,color:T.mu,fontFamily:T.m,marginTop:4}}>Equipment Management System</div></div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <Fl label="User">
            <Sl options={[{v:"",l:"-- Select User --"},...personnel.map(p=>({v:p.id,l:p.name+" ["+p.role+"]"}))]}
              value={selUser} onChange={e=>{setSelUser(e.target.value);setError("")}}/></Fl>
          <Fl label="PIN">
            <In type="password" value={pin} onChange={e=>{setPin(e.target.value);setError("")}}
              placeholder="Enter PIN" onKeyDown={e=>{if(e.key==="Enter")attempt()}} maxLength={6}/></Fl>
          {error&&<div style={{fontSize:11,color:T.rd,fontFamily:T.m,textAlign:"center",padding:"8px 12px",borderRadius:6,
            background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>{error}</div>}
          <Bt v="primary" onClick={attempt} style={{justifyContent:"center",padding:"11px 0",fontSize:13}}>Sign In</Bt>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center"}}>Default PIN: 1234</div>
        </div></div></div>);}

export default function App(){
  const[pg,setPg]=useState("dashboard");
  const[comps,setComps]=useState(IC);const[types,setTypes]=useState(IKT);const[locs,setLocs]=useState(IL);
  const[depts,setDepts]=useState(IDEPT);const[personnel,setPersonnel]=useState(IP);
  const[kits,setKits]=useState(()=>buildKits(IKT,IL,IP,IDEPT));
  const[curUser,setCurUser]=useState(IP[0].id);const[isLoggedIn,setIsLoggedIn]=useState(false);const[settings,setSettings]=useState(DEF_SETTINGS);
  const[requests,setRequests]=useState([]);const[logs,setLogs]=useState(()=>buildHistoricalData(buildKits(IKT,IL,IP,IDEPT),IP));
  const[reservations,setReservations]=useState(()=>buildReservations(buildKits(IKT,IL,IP,IDEPT),IP));
  const[consumables,setConsumables]=useState(ICONS);const[assets,setAssets]=useState(IASSETS);const[favorites,setFavorites]=useState([]);
  const[searchMd,setSearchMd]=useState(false);const[kitFilter,setKitFilter]=useState("all");
  const[collapsedSections,setCollapsedSections]=useState({});

  const user=personnel.find(p=>p.id===curUser)||personnel[0];
  const isSuper=user.role==="super";const isAdmin=user.role==="admin"||isSuper;
  const analytics=useAnalytics(kits,personnel,depts,comps,types,logs,reservations);
  const headOf=depts.filter(d=>d.headId===curUser).map(d=>d.id);
  const isApprover=isAdmin||isSuper||headOf.length>0;
  
  const addLog=(action,target,targetId,by,date,details={})=>setLogs(p=>[...p,{id:uid(),action,target,targetId,by,date,details}]);
  
  /* Permission check for nav items */
  const canAccess=(item)=>{
    if(item.setting&&!settings[item.setting])return false;
    if(item.access==="all")return true;
    if(item.access==="super")return isSuper;
    if(item.access==="approver")return isApprover;
    if(item.access==="admin"){
      if(isSuper)return true;
      if(!isAdmin)return false;
      if(item.perm&&settings.adminPerms?.[item.perm]===false)return false;
      return true;
    }
    return false;
  };
  
  /* Check if current page is accessible */
  const allItems=NAV_SECTIONS.flatMap(s=>s.items);
  const currentItem=allItems.find(i=>i.id===pg);
  if(currentItem&&!canAccess(currentItem))setPg("dashboard");
  
  const pendCt=requests.filter(r=>r.status==="pending"&&(isSuper||headOf.includes(r.deptId))).length;
  const lowStock=consumables.filter(c=>c.qty<=c.minQty).length;
  const getBadge=(id)=>id==="approvals"?pendCt:id==="consumables"?lowStock:0;
  
  const toggleSection=(id)=>setCollapsedSections(p=>({...p,[id]:!p[id]}));
  
  const roleColor=isSuper?T.rd:isAdmin?T.am:T.bl;const roleLabel=isSuper?"Super Admin":isAdmin?"Admin":"User";

  const handleQuickAction=(action,kitId)=>{
    if(action==="return"||action==="checkout"||action==="inspect"){setPg("issuance")}
  };
  const handleNavigate=(page,id)=>{setPg(page)};
  const handleFilterKits=(filter)=>{setKitFilter(filter);setPg("kits")};
  const handleSearchSelect=(result)=>{
    if(result.type==="kit"){setPg("kits")}
    else if(result.type==="person"){setPg("personnel")}
    setSearchMd(false)};

  if(!isLoggedIn)return <LoginScreen personnel={personnel} onLogin={id=>{setCurUser(id);setIsLoggedIn(true)}}/>;

  return(
    <div style={{display:"flex",minHeight:"100vh",background:T.bg,color:T.tx,fontFamily:T.u}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box}::selection{background:rgba(96,165,250,.3)}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,.07);border-radius:3px}option{background:#16171b;color:#e4e4e7}
      `}</style>
      
      <nav style={{width:200,flexShrink:0,background:T.panel,borderRight:"1px solid "+T.bd,padding:"14px 0",display:"flex",flexDirection:"column",overflowY:"auto"}}>
        <div style={{padding:"0 16px 12px",borderBottom:"1px solid "+T.bd,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:roleColor,boxShadow:"0 0 8px "+roleColor+"55"}}/>
            <span style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.5,color:roleColor,fontFamily:T.m,fontWeight:600}}>{roleLabel}</span></div>
          <div style={{fontSize:15,fontWeight:800,fontFamily:T.u,letterSpacing:-.3}}>COCO Gear</div></div>
        
        <button onClick={()=>setSearchMd(true)} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          margin:"0 10px 10px",padding:"7px 12px",borderRadius:6,background:"rgba(255,255,255,.03)",border:"1px solid "+T.bd,
          fontSize:10,color:T.mu,fontFamily:T.m}}>
          <span>⌕</span> Search...</button>
        
        {NAV_SECTIONS.map(section=><NavSection key={section.id} section={section} pg={pg} setPg={setPg}
          collapsed={collapsedSections[section.id]} onToggle={()=>toggleSection(section.id)}
          canAccess={canAccess} getBadge={getBadge}/>)}
        
        <div style={{flex:1,minHeight:20}}/>
        
        {/* Profile button */}
        <button onClick={()=>setPg("profile")} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
          margin:"0 10px 8px",padding:"10px 12px",borderRadius:8,background:pg==="profile"?"rgba(255,255,255,.06)":"rgba(255,255,255,.02)",
          border:"1px solid "+(pg==="profile"?T.bdH:T.bd),transition:"all .12s"}}
          onMouseEnter={e=>{if(pg!=="profile")e.currentTarget.style.background="rgba(255,255,255,.04)"}}
          onMouseLeave={e=>{if(pg!=="profile")e.currentTarget.style.background="rgba(255,255,255,.02)"}}>
          <div style={{width:28,height:28,borderRadius:14,background:roleColor+"22",border:"1px solid "+roleColor+"44",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:roleColor,fontFamily:T.m}}>
            {user.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
            <div style={{fontSize:8,color:T.mu,fontFamily:T.m}}>{user.title||roleLabel}</div></div>
          <span style={{fontSize:10,color:T.dm}}>⚙</span></button>
        
        <div style={{padding:"10px 12px",borderTop:"1px solid "+T.bd}}>
          <button onClick={()=>{setIsLoggedIn(false);setPg("dashboard")}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            width:"100%",padding:"7px 0",borderRadius:6,fontSize:10,fontWeight:600,fontFamily:T.m,color:T.rd,
            background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,.12)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(239,68,68,.06)"}>Sign Out</button></div></nav>
      
      <main style={{flex:1,padding:"20px 26px",overflowY:"auto",overflowX:"hidden"}}>
        {pg==="dashboard"&&<Dash kits={kits} types={types} locs={locs} comps={comps} personnel={personnel} depts={depts} requests={requests}
          analytics={analytics} logs={logs} settings={settings} curUserId={curUser} favorites={favorites} setFavorites={setFavorites} onNavigate={handleNavigate} onAction={handleQuickAction} onFilterKits={handleFilterKits}/>}
        {pg==="kits"&&<KitInv kits={kits} setKits={setKits} types={types} locs={locs} comps={comps} personnel={personnel} depts={depts}
          isAdmin={isAdmin} isSuper={isSuper} settings={settings} favorites={favorites} setFavorites={setFavorites} addLog={addLog} curUserId={curUser}
          initialFilter={kitFilter} onFilterChange={setKitFilter} analytics={analytics}/>}
        {pg==="issuance"&&<KitIssuance kits={kits} setKits={setKits} types={types} locs={locs} personnel={personnel} allC={comps} depts={depts}
          isAdmin={isAdmin} isSuper={isSuper} curUserId={curUser} settings={settings} requests={requests} setRequests={setRequests} addLog={addLog}/>}
        {pg==="analytics"&&canAccess({access:"admin",perm:"analytics"})&&<AnalyticsPage analytics={analytics} kits={kits} personnel={personnel} depts={depts} comps={comps} types={types} locs={locs}/>}
        {pg==="reports"&&canAccess({access:"admin",perm:"reports"})&&<ReportsPage kits={kits} personnel={personnel} depts={depts} comps={comps} types={types} locs={locs} logs={logs} analytics={analytics}/>}
        {pg==="approvals"&&isApprover&&<ApprovalsPage requests={requests} setRequests={setRequests} kits={kits} setKits={setKits}
          personnel={personnel} depts={depts} allC={comps} types={types} curUserId={curUser} addLog={addLog}/>}
        {pg==="reservations"&&settings.enableReservations&&<ReservationsPage reservations={reservations} setReservations={setReservations}
          kits={kits} personnel={personnel} curUserId={curUser} isAdmin={isAdmin} addLog={addLog}/>}
        {pg==="maintenance"&&canAccess({access:"admin",perm:"maintenance",setting:"enableMaintenance"})&&settings.enableMaintenance&&<MaintenancePage kits={kits} setKits={setKits} types={types} locs={locs}
          personnel={personnel} addLog={addLog} curUserId={curUser}/>}
        {pg==="consumables"&&canAccess({access:"admin",perm:"consumables",setting:"enableConsumables"})&&settings.enableConsumables&&<ConsumablesPage consumables={consumables} setConsumables={setConsumables}
          assets={assets} setAssets={setAssets} personnel={personnel} locs={locs} addLog={addLog} curUserId={curUser} isAdmin={isAdmin}/>}
        {pg==="auditlog"&&isSuper&&<AuditLogPage logs={logs} kits={kits} personnel={personnel}/>}
        {pg==="types"&&canAccess({access:"admin",perm:"types"})&&<TypeAdmin types={types} setTypes={setTypes} comps={comps} kits={kits}/>}
        {pg==="components"&&canAccess({access:"admin",perm:"components"})&&<CompAdmin comps={comps} setComps={setComps} types={types}/>}
        {pg==="locations"&&canAccess({access:"admin",perm:"locations"})&&<LocAdmin locs={locs} setLocs={setLocs} kits={kits}/>}
        {pg==="departments"&&canAccess({access:"admin",perm:"departments"})&&<DeptAdmin depts={depts} setDepts={setDepts} personnel={personnel} kits={kits}/>}
        {pg==="personnel"&&canAccess({access:"admin",perm:"personnel"})&&<PersonnelAdmin personnel={personnel} setPersonnel={setPersonnel} kits={kits} depts={depts}/>}
        {pg==="settings"&&isSuper&&<SettingsPage settings={settings} setSettings={setSettings}/>}
        {pg==="profile"&&<MyProfile user={user} personnel={personnel} setPersonnel={setPersonnel} kits={kits} assets={assets} depts={depts}/>}
      </main>
      
      <ModalWrap open={searchMd} onClose={()=>setSearchMd(false)} title="Search">
        <GlobalSearch kits={kits} personnel={personnel} locs={locs} depts={depts} types={types} comps={comps}
          onSelect={handleSearchSelect} onClose={()=>setSearchMd(false)}/></ModalWrap>
    </div>);}

