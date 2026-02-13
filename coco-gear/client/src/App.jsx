import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from './auth.jsx';
import api from './api.js';

import { T, applyTheme } from './theme/theme.js';
import { uid, SYS_ROLE_LABELS, sysRoleColor, DEF_ROLE_PERMS, DEF_SETTINGS, fmtDate } from './theme/helpers.js';
import { Sw, Bg, Bt, ModalWrap, DeptBg } from './components/ui/index.js';
import useAnalytics from './hooks/useAnalytics.js';
import useSocket from './hooks/useSocket.js';

import NavSection from './components/NavSection.jsx';
import GlobalSearch from './components/GlobalSearch.jsx';
import ScanAction from './components/ScanAction.jsx';

import Dash from './pages/Dashboard.jsx';
import KitInv from './pages/KitInventory.jsx';
import KitIssuance from './pages/KitIssuance.jsx';
import AnalyticsPage from './pages/AnalyticsPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import MaintenancePage from './pages/MaintenancePage.jsx';
import TripsPage from './pages/TripsPage.jsx';
import ReservationsPage from './pages/ReservationsPage.jsx';
import ConsumablesPage from './pages/ConsumablesPage.jsx';
import AuditLogPage from './pages/AuditLogPage.jsx';
import ApprovalsPage from './pages/ApprovalsPage.jsx';
import MyProfile from './pages/MyProfile.jsx';
import LoginScreen from './pages/LoginScreen.jsx';
import SignupScreen from './pages/SignupScreen.jsx';
import SetPasswordScreen from './pages/SetPasswordScreen.jsx';

import CompAdmin from './pages/admin/CompAdmin.jsx';
import TypeAdmin from './pages/admin/TypeAdmin.jsx';
import LocAdmin from './pages/admin/LocAdmin.jsx';
import DeptAdmin from './pages/admin/DeptAdmin.jsx';
import BoatAdmin from './pages/admin/BoatAdmin.jsx';
import PersonnelAdmin from './pages/admin/PersonnelAdmin.jsx';
import SettingsPage from './pages/admin/SettingsPage.jsx';

const NAV_SECTIONS=[
  {id:"main",label:null,items:[
    {id:"dashboard",l:"Dashboard",i:"◉",access:"all"},
    {id:"kits",l:"Inventory",i:"▤",access:"all"},
    {id:"issuance",l:"Checkout",i:"↔",access:"all"},
  ]},
  {id:"tools",label:"Tools",items:[
    {id:"trips",l:"Trips",i:"▸",access:"all"},
    {id:"reservations",l:"Reservations",i:"◷",access:"all",setting:"enableReservations"},
    {id:"approvals",l:"Approvals",i:"✓",access:"approver"},
    {id:"maintenance",l:"Maintenance",i:"⚙",access:"lead",perm:"maintenance",setting:"enableMaintenance"},
    {id:"consumables",l:"Supplies",i:"◨",access:"lead",perm:"consumables",setting:"enableConsumables"},
  ]},
  {id:"insights",label:"Insights",items:[
    {id:"analytics",l:"Analytics",i:"◔",access:"lead",perm:"analytics"},
    {id:"reports",l:"Reports",i:"◫",access:"lead",perm:"reports"},
    {id:"auditlog",l:"Audit Log",i:"≡",access:"director"},
  ]},
  {id:"config",label:"Configuration",items:[
    {id:"types",l:"Kit Types",i:"+",access:"lead",perm:"types"},
    {id:"components",l:"Components",i:":",access:"lead",perm:"components"},
    {id:"locations",l:"Storage",i:"⌖",access:"lead",perm:"locations"},
    {id:"departments",l:"Departments",i:"▣",access:"lead",perm:"departments"},
    {id:"personnel",l:"Personnel",i:"◎",access:"lead",perm:"personnel"},
    {id:"boats",l:"USVs",i:"⛵",access:"lead",perm:"boats"},
    {id:"settings",l:"Settings",i:"⚙",access:"director"},
  ]},
];

export default function App(){
  const authCtx=useAuth();
  const[pg,setPg]=useState("dashboard");
  const[comps,setComps]=useState([]);const[types,setTypes]=useState([]);const[locs,setLocs]=useState([]);
  const[depts,setDepts]=useState([]);const[personnel,setPersonnel]=useState([]);
  const[kits,setKits]=useState([]);
  const[curUser,setCurUser]=useState(authCtx.user?.id||null);const[mustChangePw,setMustChangePw]=useState(false);const[settings,setSettings]=useState(DEF_SETTINGS);
  const[requests,setRequests]=useState([]);const[accessRequests,setAccessRequests]=useState([]);const[logs,setLogs]=useState([]);
  const[reservations,setReservations]=useState([]);const[trips,setTrips]=useState([]);
  const[consumables,setConsumables]=useState([]);const[assets,setAssets]=useState([]);const[boats,setBoats]=useState([]);const[favorites,setFavorites]=useState([]);
  const[searchMd,setSearchMd]=useState(false);const[scanMd,setScanMd]=useState(null);const[kitFilter,setKitFilter]=useState("all");const[navKitId,setNavKitId]=useState(null);const[navAction,setNavAction]=useState(null);const[navPersonId,setNavPersonId]=useState(null);
  const[collapsedSections,setCollapsedSections]=useState({insights:true,config:true});
  const[dataLoaded,setDataLoaded]=useState(false);const[loadError,setLoadError]=useState("");
  const[loginUsers,setLoginUsers]=useState([]);
  const[showSignup,setShowSignup]=useState(false);const[signupDomain,setSignupDomain]=useState("");
  const[isDark,setIsDark]=useState(()=>localStorage.getItem("slate_theme")!=="light");
  const[mobileNav,setMobileNav]=useState(false);
  const[isMobile,setIsMobile]=useState(()=>typeof window!=="undefined"&&window.innerWidth<768);
  useEffect(()=>{const h=()=>setIsMobile(window.innerWidth<768);window.addEventListener("resize",h);return()=>window.removeEventListener("resize",h)},[]);
  useEffect(()=>{if(mobileNav){document.body.style.overflow="hidden";document.body.style.position="fixed";document.body.style.width="100%";document.body.style.top=`-${window.scrollY}px`}else{const top=document.body.style.top;document.body.style.overflow="";document.body.style.position="";document.body.style.width="";document.body.style.top="";if(top)window.scrollTo(0,-parseInt(top))}return()=>{document.body.style.overflow="";document.body.style.position="";document.body.style.width="";document.body.style.top=""}},[mobileNav]);
  const toggleTheme=useCallback(()=>{setIsDark(d=>{const next=!d;applyTheme(next);return next})},[]);

  /* Load user list for login (public endpoint) */
  useEffect(()=>{if(!authCtx.token){fetch('/api/auth/users').then(r=>r.ok?r.json():[]).then(setLoginUsers).catch(()=>{});
    fetch('/api/auth/signup-info').then(r=>r.ok?r.json():null).then(d=>{if(d?.enabled&&d?.domain)setSignupDomain(d.domain);else setSignupDomain("")}).catch(()=>{})}}, [authCtx.token]);

  /* Transform API component data to frontend format */
  const xformComp=c=>({id:c.id,key:c.key,label:c.label,cat:c.category,ser:c.serialized,qrScan:c.qrScannable!==false,calibrationRequired:c.calibrationRequired,calibrationIntervalDays:c.calibrationIntervalDays});
  const xformType=(t,compList)=>{
    const tComps=t.components||[];
    return{id:t.id,name:t.name,desc:t.desc||"",
      compIds:tComps.map(c=>c.componentId||c.component?.id),
      compQtys:Object.fromEntries(tComps.filter(c=>c.quantity>1).map(c=>[c.componentId||c.component?.id,c.quantity])),
      criticalCompIds:tComps.filter(c=>c.critical).map(c=>c.componentId||c.component?.id),
      fields:(t.fields||[]).map(f=>({key:f.key,label:f.label,type:f.type||"text"})),
      deptIds:(t.departments||[]).map(d=>d.deptId||d.department?.id).filter(Boolean)}};
  const xformLoc=l=>({id:l.id,name:l.name,sc:l.shortCode});
  const xformDept=d=>({id:d.id,name:d.name,color:d.color||"#60a5fa",site:d.site||"",
    managerIds:(d.managers||[]).map(m=>m.userId||m.user?.id).filter(Boolean),
    leadIds:(d.leads||[]).map(l=>l.userId||l.user?.id).filter(Boolean),
    kitTypeIds:(d.kitTypes||[]).map(kt=>kt.kitTypeId||kt.kitType?.id).filter(Boolean)});
  const xformTrip=t=>({id:t.id,name:t.name,description:t.description||"",location:t.location||"",objectives:t.objectives||"",
    leadId:t.leadId||null,leadName:t.lead?.name||null,startDate:(t.startDate||"").slice(0,10),endDate:(t.endDate||"").slice(0,10),
    status:t.status,restricted:t.restricted||false,classification:t.classification||null,
    kits:(t.kits||[]).map(k=>({id:k.id,color:k.color,typeId:k.typeId,deptId:k.deptId,issuedToId:k.issuedToId,
      typeName:k.type?.name,deptName:k.department?.name,deptColor:k.department?.color,holderName:k.issuedTo?.name})),
    personnel:(t.personnel||[]).map(p=>({id:p.id,userId:p.user?.id,name:p.user?.name,title:p.user?.title,sysRole:p.user?.role,
      deptId:p.user?.deptId,tripRole:p.role,notes:p.notes||""})),
    notes:(t.notes||[]).map(n=>({id:n.id,content:n.content,category:n.category,authorName:n.author?.name,authorId:n.authorId,createdAt:n.createdAt})),
    boats:(t.boats||[]).map(tb=>({tripBoatId:tb.id,boatId:tb.boat?.id,name:tb.boat?.name,type:tb.boat?.type,hullId:tb.boat?.hullId,
      length:tb.boat?.length,status:tb.boat?.status,role:tb.role,notes:tb.notes||""})),
    tasks:(t.tasks||[]).map(tk=>({id:tk.id,title:tk.title,phase:tk.phase,priority:tk.priority,status:tk.status,
      sortOrder:tk.sortOrder,dueDate:tk.dueDate,completedAt:tk.completedAt,
      assignedToId:tk.assignedToId||null,assignedTo:tk.assignedTo||null,completedBy:tk.completedBy||null})),
    taskCount:t._count?.tasks||0,taskDone:(t.tasks||[]).filter(tk=>tk.status==="done").length,
    personnelCount:t._count?.personnel||0,reservationCount:t._count?.reservations||0,boatCount:t._count?.boats||0});
  const xformBoat=b=>({id:b.id,name:b.name,type:b.type||"",hullId:b.hullId||"",length:b.length,
    homePort:b.homePort||"",status:b.status,notes:b.notes||"",
    trips:(b.trips||[]).map(tb=>({tripBoatId:tb.id,tripId:tb.trip?.id,tripName:tb.trip?.name,tripStatus:tb.trip?.status,role:tb.role,notes:tb.notes||""}))});
  const xformPerson=p=>({id:p.id,name:p.name,email:p.email||"",title:p.title||"",role:p.role,deptId:p.deptId});
  const xformKit=(k)=>({
    id:k.id,typeId:k.typeId,color:k.color,locId:k.locId,deptId:k.deptId,tripId:k.tripId||null,
    fields:k.fields||{},lastChecked:k.lastChecked,comps:k.comps||{},serials:k.serials||{},calibrationDates:k.calibrationDates||{},
    inspections:k.inspections||[],issuedTo:k.issuedTo,issueHistory:k.issueHistory||[],degraded:k.degraded||false,
    maintenanceStatus:k.maintenanceStatus,maintenanceHistory:k.maintenanceHistory||[],photos:k.photos||[],reservations:k.reservations||[],
    _type:k._type,_location:k._location,_department:k._department,_issuedTo:k._issuedTo,_trip:k._trip||null,_tripRestricted:k._tripRestricted||false,
  });
  const xformLog=l=>({id:l.id,action:l.action,target:l.target,targetId:l.targetId,by:l.userId,date:l.date,details:l.details||{}});
  const xformReservation=r=>({id:r.id,kitId:r.kitId,personId:r.personId,tripId:r.tripId||null,tripName:r.trip?.name||null,tripRestricted:r._tripRestricted||r.trip?.restricted||false,startDate:(r.startDate||"").slice(0,10),endDate:(r.endDate||"").slice(0,10),purpose:r.purpose||"",status:r.status,createdDate:r.createdAt,person:r.person||null});
  const xformConsumable=c=>({id:c.id,name:c.name,sku:c.sku||"",category:c.category,qty:c.qty,minQty:c.minQty,unit:c.unit||"ea"});
  const xformAsset=a=>({id:a.id,name:a.name,serial:a.serial,category:a.category,locId:a.locId,issuedTo:a.issuedToId||null,
    issueHistory:(a.issueHistory||[]).map(h=>({id:h.id,personId:h.personId,issuedDate:h.issuedDate,returnedDate:h.returnedDate,issuedBy:h.issuedById})),
    lastInspected:a.lastInspected,condition:a.condition||"GOOD",notes:a.notes||""});

  /* Load all data from API */
  const loadData=useCallback(async()=>{
    try{
      const[compsD,typesD,locsD,deptsD,persD,kitsD,consD,assetsD,resD,tripsD,boatsD]=await Promise.all([
        api.components.list(),api.types.list(),api.locations.list(),api.departments.list(),
        api.personnel.list(),api.kits.list(),api.consumables.list(),api.assets.list(),api.reservations.list(),api.trips.list(),api.boats.list(),
      ]);
      const mappedComps=compsD.map(xformComp);
      setComps(mappedComps);setTypes(typesD.map(t=>xformType(t,mappedComps)));setLocs(locsD.map(xformLoc));
      setDepts(deptsD.map(xformDept));setPersonnel(persD.map(xformPerson));setKits(kitsD.map(xformKit));
      setConsumables(consD.map(xformConsumable));setAssets(assetsD.map(xformAsset));setReservations(resD.map(xformReservation));
      setTrips((tripsD||[]).map(xformTrip));setBoats((boatsD||[]).map(xformBoat));
      try{const logsD=await api.audit.list({limit:500});setLogs((logsD.logs||[]).map(xformLog))}catch(e){}
      try{const sett=await api.settings.get();setSettings(s=>({...s,...sett}))}catch(e){}
      try{const accessD=await api.kits.accessRequests();setAccessRequests(accessD||[])}catch(e){}
      try{const reqD=await api.kits.checkoutRequests();setRequests(reqD||[])}catch(e){}
      setDataLoaded(true);setLoadError("");
    }catch(e){setLoadError(e.message||"Failed to load data");console.error("Load error:",e)}
  },[]);

  useEffect(()=>{if(authCtx.isLoggedIn&&!mustChangePw)loadData()},[authCtx.isLoggedIn,mustChangePw]);

  /* Deep link: handle /s/kit/{id} and /s/verify/{...} URLs from external QR scans */
  useEffect(()=>{if(!dataLoaded)return;const p=window.location.pathname;
    if(p.startsWith("/s/kit/")){const id=p.slice(7);setScanMd("kit:"+id);window.history.replaceState(null,"","/");return}
    if(p.startsWith("/s/verify/")){const parts=p.slice(10).split("/").map(decodeURIComponent);
      const raw="ser:"+parts.join(":");setScanMd("serial:"+raw);window.history.replaceState(null,"","/");return}
    if(p.startsWith("/s/asset/")){window.history.replaceState(null,"","/");return}
  },[dataLoaded]);

  /* Helper: refresh specific data after mutations */
  const refreshKits=async()=>{try{const d=await api.kits.list();setKits(d.map(xformKit))}catch(e){}};
  const refreshConsumables=async()=>{try{const d=await api.consumables.list();setConsumables(d.map(xformConsumable))}catch(e){}};
  const refreshAssets=async()=>{try{const d=await api.assets.list();setAssets(d.map(xformAsset))}catch(e){}};
  const refreshReservations=async()=>{try{const d=await api.reservations.list();setReservations(d.map(xformReservation))}catch(e){}};
  const refreshTrips=async()=>{try{const d=await api.trips.list();setTrips((d||[]).map(xformTrip))}catch(e){}};
  const refreshBoats=async()=>{try{const d=await api.boats.list();setBoats((d||[]).map(xformBoat))}catch(e){}};
  const refreshPersonnel=async()=>{try{const d=await api.personnel.list();setPersonnel(d.map(xformPerson))}catch(e){}};
  const refreshComps=async()=>{try{const d=await api.components.list();setComps(d.map(xformComp))}catch(e){}};
  const refreshTypes=async()=>{try{const d=await api.types.list();setTypes(d.map(t=>xformType(t,comps)))}catch(e){}};
  const refreshLocs=async()=>{try{const d=await api.locations.list();setLocs(d.map(xformLoc))}catch(e){}};
  const refreshDepts=async()=>{try{const d=await api.departments.list();setDepts(d.map(xformDept))}catch(e){}};
  const refreshLogs=async()=>{try{const d=await api.audit.list({limit:500});setLogs((d.logs||[]).map(xformLog))}catch(e){}};
  const refreshAccessRequests=async()=>{try{const d=await api.kits.accessRequests();setAccessRequests(d||[])}catch(e){}};
  const refreshCheckoutRequests=async()=>{try{const d=await api.kits.checkoutRequests();setRequests(d||[])}catch(e){}};
  const saveSettings=async(s)=>{try{await api.settings.update(s)}catch(e){console.error("Settings save error:",e)}};
  const refreshSettings=async()=>{try{const s=await api.settings.get();setSettings(prev=>({...prev,...s}))}catch(e){}};

  /* ─── Real-time updates via Socket.IO ─── */
  const socketRefreshCallbacks=useMemo(()=>({
    kits:refreshKits,trips:refreshTrips,personnel:refreshPersonnel,
    types:refreshTypes,components:refreshComps,locations:refreshLocs,
    departments:refreshDepts,reservations:refreshReservations,
    consumables:refreshConsumables,assets:refreshAssets,boats:refreshBoats,
    settings:refreshSettings,requests:()=>{refreshCheckoutRequests();refreshAccessRequests()},
  }),[]);
  const{connected:socketConnected,lastEvent:socketLastEvent}=useSocket(authCtx.token,socketRefreshCallbacks,curUser||authCtx.user?.id);

  const user=curUser?personnel.find(p=>p.id===curUser):authCtx.user?personnel.find(p=>p.id===authCtx.user.id):personnel[0];
  const isDeveloper=user?.role==="developer";
  const [devViewAs,setDevViewAs]=useState(null);
  const effectiveRole=isDeveloper&&devViewAs?devViewAs:user?.role;
  const isDirector=(isDeveloper&&!devViewAs)||effectiveRole==="director"||effectiveRole==="super"||effectiveRole==="engineer";const isManager=effectiveRole==="manager"||effectiveRole==="admin"||isDirector;
  const isLead=effectiveRole==="lead"||isManager;const isSuper=isDirector;const isAdmin=isManager;
  const analytics=useAnalytics(kits,personnel,depts,comps,types,logs,reservations);
  const _uid=curUser||authCtx.user?.id;
  const headOf=depts.filter(d=>(d.managerIds||[]).includes(_uid)||(d.leadIds||[]).includes(_uid)).map(d=>d.id);
  const _rl={user:0,lead:1,manager:2,admin:2,director:3,super:3,developer:3,engineer:3};
  const isApprover=headOf.length>0||(_rl[effectiveRole]||0)>=(_rl[settings.deptApprovalMinRole||"lead"]||1);

  const addLog=(action,target,targetId,by,date,details={})=>{setLogs(p=>[...p,{id:uid(),action,target,targetId,by,date,details}]);refreshLogs()};

  /* ─── API-backed mutation helpers ─── */
  const apiCheckout=async(kitId,personId,serials,notes)=>{
    try{const result=await api.kits.checkout({kitId,personId,serials,notes});
    if(result.pending)return result;await refreshKits();return result}catch(e){alert(e.message);throw e}};
  const apiReturn=async(kitId,serials,notes)=>{
    try{await api.kits.return({kitId,serials,notes});await refreshKits()}catch(e){alert(e.message);throw e}};
  const apiInspect=async(kitId,inspector,notes,results,photos=[])=>{
    try{const resultsMap={};for(const[key,status]of Object.entries(results)){
      const{componentId,slotIndex}=parseCompKeyForApi(key);
      resultsMap[key]={componentId,slotIndex,status}};
    const photoRefs=photos.map(p=>({filename:p.filename,originalName:p.originalName}));
    await api.kits.inspect({kitId,inspector,notes,results:resultsMap,photos:photoRefs});await refreshKits()}catch(e){console.error("Inspect API error:",e)}};
  const apiSendMaint=async(kitId,type,reason,notes)=>{
    try{await api.maintenance.send({kitId,type,reason,notes});await refreshKits()}catch(e){alert(e.message);throw e}};
  const apiReturnMaint=async(kitId,notes)=>{
    try{await api.maintenance.return(kitId,notes);await refreshKits()}catch(e){alert(e.message);throw e}};
  const apiResolveDegraded=async(kitId)=>{
    try{await api.kits.resolveDegraded(kitId);await refreshKits()}catch(e){alert(e.message);throw e}};
  const parseCompKeyForApi=(key)=>{const parts=key.split('#');
    const compId=parts[0];const comp=comps.find(c=>c.id===compId);
    return{componentId:compId,slotIndex:parts.length>1?parseInt(parts[1],10):0}};

  /* Role-based permission check */
  const normalizeRole=r=>r==="admin"?"manager":r==="super"||r==="engineer"?"director":r;
  const hasPerm=(perm)=>{
    if(isDirector)return true;
    if(!isLead)return false;
    const role=normalizeRole(effectiveRole);
    const perms=settings.rolePerms?.[role];
    if(perms&&perm in perms)return perms[perm];
    return DEF_ROLE_PERMS[role]?.[perm]||false;
  };
  const canManageTrips=hasPerm("trips");

  /* Permission check for nav items */
  const canAccess=(item)=>{
    if(item.setting&&!settings[item.setting])return false;
    if(item.access==="all")return true;
    if(item.access==="super"||item.access==="director")return isDirector;
    if(item.access==="approver")return isApprover;
    /* Items with perm key use the rolePerms system */
    if(item.perm){
      if(isDirector)return true;
      if(!isLead)return false;
      return hasPerm(item.perm);
    }
    if(item.access==="lead")return isLead;
    if(item.access==="admin"||item.access==="manager")return isManager;
    return false;
  };

  /* Check if current page is accessible */
  const allItems=NAV_SECTIONS.flatMap(s=>s.items);
  const currentItem=allItems.find(i=>i.id===pg);
  if(currentItem&&!canAccess(currentItem))setPg("dashboard");

  const pendCt=requests.filter(r=>r.status==="pending"&&(isLead||headOf.includes(r.deptId))).length+accessRequests.filter(r=>r.status==="pending"&&isLead).length;
  const lowStock=consumables.filter(c=>c.qty<=c.minQty).length;
  const getBadge=(id)=>id==="approvals"?pendCt:id==="consumables"?lowStock:0;

  const toggleSection=(id)=>setCollapsedSections(p=>({...p,[id]:!p[id]}));

  const roleColor=isDeveloper?sysRoleColor(devViewAs||"developer"):sysRoleColor(user?.role);
  const roleLabel=isDeveloper?(devViewAs?SYS_ROLE_LABELS[devViewAs]+" (dev)":"Developer"):SYS_ROLE_LABELS[user?.role]||"Operator";

  const handleQuickAction=(action,kitId)=>{
    if(action==="return"||action==="checkout"||action==="inspect"){setPg("issuance")}
  };
  const handleNavigate=(page,kitId,action)=>{if(kitId)setNavKitId(kitId);if(action)setNavAction(action);setPg(page)};
  const handleFilterKits=(filter)=>{setKitFilter(filter);setPg("kits")};
  const handleSearchSelect=(result)=>{
    if(result.type==="kit"){setNavKitId(result.item.id);setPg("kits")}
    else if(result.type==="person"){setNavPersonId(result.item.id)}
    else if(result.type==="location"){setPg("locations")}
    else if(result.type==="dept"){setPg("departments")}
    setSearchMd(false)};

  if(!authCtx.token&&showSignup&&signupDomain)return <SignupScreen domain={signupDomain} isDark={isDark} toggleTheme={toggleTheme}
    onBack={()=>setShowSignup(false)}
    onSignup={async(data)=>{const res=await api.auth.signup(data);
      localStorage.setItem('slate_token',res.token);localStorage.setItem('slate_user',JSON.stringify(res.user));
      authCtx.setUser(res.user);setCurUser(res.user.id);setShowSignup(false);window.location.reload()}}/>;
  if(!authCtx.token)return <LoginScreen personnel={loginUsers.length?loginUsers.map(xformPerson):personnel} isDark={isDark} toggleTheme={toggleTheme}
    signupDomain={signupDomain} onShowSignup={()=>setShowSignup(true)}
    onLogin={async(userId,pin)=>{
    const userData=await authCtx.login(userId,pin);setCurUser(userData.id);
    if(userData.mustChangePassword)setMustChangePw(true)}}/>;
  if(mustChangePw)return <SetPasswordScreen userName={authCtx.user?.name||"User"} isDark={isDark} toggleTheme={toggleTheme}
    onLogout={()=>{authCtx.logout();setMustChangePw(false);setCurUser(null)}}
    onSubmit={async(newPw)=>{await api.auth.changePassword(newPw);authCtx.setUser({...authCtx.user,mustChangePassword:false});setMustChangePw(false)}}/>;
  if(!dataLoaded&&!loadError)return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.u}}>
    <div style={{textAlign:"center"}}><div style={{fontSize:18,fontWeight:700,color:T.tx,marginBottom:8}}>Loading Slate...</div>
      <div style={{fontSize:11,color:T.mu,fontFamily:T.m}}>Connecting to server</div></div></div>);
  if(loadError)return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.u}}>
    <div style={{textAlign:"center",maxWidth:400}}><div style={{fontSize:18,fontWeight:700,color:T.rd,marginBottom:8}}>Connection Error</div>
      <div style={{fontSize:11,color:T.mu,fontFamily:T.m,marginBottom:16}}>{loadError}</div>
      <Bt v="primary" onClick={loadData}>Retry</Bt></div></div>);
  if(!user){authCtx.logout();setDataLoaded(false);setCurUser(null);return null;}

  const navContent=<>
        <div style={{padding:"0 16px 12px",borderBottom:"1px solid "+T.bd,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:roleColor,boxShadow:"0 0 8px "+roleColor+"55"}}/>
            <span style={{fontSize:8,textTransform:"uppercase",letterSpacing:1.5,color:roleColor,fontFamily:T.m,fontWeight:600}}>{roleLabel}</span></div>
          <div style={{fontSize:15,fontWeight:800,fontFamily:T.u,letterSpacing:-.3,display:"flex",alignItems:"center",gap:6}}>Slate
            {socketConnected&&<span title="Live updates active" style={{fontSize:7,fontWeight:600,fontFamily:T.m,color:T.gn,
              textTransform:"uppercase",letterSpacing:1,display:"flex",alignItems:"center",gap:3}}>
              <span style={{width:5,height:5,borderRadius:"50%",background:T.gn,display:"inline-block",boxShadow:"0 0 6px "+T.gn+"88"}}/>live</span>}</div>
          {isDeveloper&&<select value={devViewAs||""} onChange={e=>setDevViewAs(e.target.value||null)}
            style={{marginTop:6,width:"100%",padding:"4px 6px",fontSize:9,fontFamily:T.m,fontWeight:600,
              background:T.card,color:T.tx,border:"1px solid "+T.gn+"44",borderRadius:4,cursor:"pointer",outline:"none"}}>
            <option value="">View as: Developer</option>
            <option value="director">View as: Director</option>
            <option value="engineer">View as: Engineer</option>
            <option value="manager">View as: Manager</option>
            <option value="lead">View as: Lead</option>
            <option value="user">View as: Operator</option>
          </select>}</div>

        <button onClick={()=>{setSearchMd(true);setMobileNav(false)}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          margin:"0 10px 6px",padding:"7px 12px",borderRadius:6,background:T.card,border:"1px solid "+T.bd,
          fontSize:10,color:T.mu,fontFamily:T.m}}>
          <span>⌕</span> Search...</button>

        {settings.enableQR!==false&&<button onClick={()=>{setScanMd("scan");setMobileNav(false)}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
          margin:"0 10px 10px",padding:"7px 12px",borderRadius:6,background:"rgba(96,165,250,.06)",border:"1px solid rgba(96,165,250,.15)",
          fontSize:10,color:T.bl,fontFamily:T.m,fontWeight:600}}>
          <span style={{fontSize:12}}>⎘</span> Scan QR Code</button>}

        {NAV_SECTIONS.map(section=><NavSection key={section.id} section={section} pg={pg} setPg={id=>{setPg(id);setMobileNav(false)}}
          collapsed={collapsedSections[section.id]} onToggle={()=>toggleSection(section.id)}
          canAccess={canAccess} getBadge={getBadge}/>)}

        <div style={{flex:1,minHeight:20}}/>

        {/* Profile button */}
        <button onClick={()=>{setPg("profile");setMobileNav(false)}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:10,
          margin:"0 10px 8px",padding:"10px 12px",borderRadius:8,background:pg==="profile"?T.cardH:T.card,
          border:"1px solid "+(pg==="profile"?T.bdH:T.bd),transition:"all .12s"}}
          onMouseEnter={e=>{if(pg!=="profile")e.currentTarget.style.background=T.cardH}}
          onMouseLeave={e=>{if(pg!=="profile")e.currentTarget.style.background=T.card}}>
          <div style={{width:28,height:28,borderRadius:14,background:roleColor+"22",border:"1px solid "+roleColor+"44",
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:roleColor,fontFamily:T.m}}>
            {user.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{user.name}</div>
            <div style={{fontSize:8,color:T.mu,fontFamily:T.m}}>{user.title||roleLabel}</div></div>
          <span style={{fontSize:10,color:T.dm}}>⚙</span></button>

        <div style={{padding:"4px 10px"}}>
          <button onClick={toggleTheme} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",gap:8,
            width:"100%",padding:"7px 12px",borderRadius:6,fontSize:10,fontWeight:600,fontFamily:T.m,color:T.mu,
            background:isDark?"rgba(255,255,255,.03)":"rgba(0,0,0,.04)",border:"1px solid "+T.bd,transition:"all .15s"}}
            onMouseEnter={e=>e.currentTarget.style.background=isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.07)"}
            onMouseLeave={e=>e.currentTarget.style.background=isDark?"rgba(255,255,255,.03)":"rgba(0,0,0,.04)"}>
            <span style={{fontSize:13}}>{isDark?"☀":"☾"}</span>{isDark?"Light Mode":"Dark Mode"}</button></div>

        <div style={{padding:"4px 12px 10px",borderTop:"1px solid "+T.bd,marginTop:4}}>
          <button onClick={()=>{authCtx.logout();setDataLoaded(false);setCurUser(null);setPg("dashboard");setMobileNav(false)}} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            width:"100%",padding:"7px 0",borderRadius:6,fontSize:10,fontWeight:600,fontFamily:T.m,color:T.rd,
            background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",transition:"all .15s",marginTop:6}}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(239,68,68,.12)"}
            onMouseLeave={e=>e.currentTarget.style.background="rgba(239,68,68,.06)"}>Sign Out</button></div></>;

  return(
    <div style={{display:"flex",flexDirection:isMobile?"column":"row",minHeight:"100vh",background:T.bg,color:T.tx,fontFamily:T.u,overflowX:"hidden",width:"100%"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        @keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
        *{box-sizing:border-box}::selection{background:rgba(96,165,250,.3)}
        html,body{overflow-x:hidden;width:100%}
        ::-webkit-scrollbar{width:5px;height:5px}::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:${T._scrollThumb};border-radius:3px}option{background:${T._optBg};color:${T._optColor}}
        @media(max-width:767px){
          .slate-grid-side{grid-template-columns:1fr!important}
          .slate-resp{grid-template-columns:1fr!important}
          input,select{font-size:16px!important}
        }
      `}</style>

      {/* Mobile top bar */}
      {isMobile&&<div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",background:T.panel,borderBottom:"1px solid "+T.bd,zIndex:50}}>
        <button onClick={()=>setMobileNav(v=>!v)} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          width:36,height:36,borderRadius:8,background:T.card,border:"1px solid "+T.bd,fontSize:18,color:T.tx}}>☰</button>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:800,fontFamily:T.u,letterSpacing:-.3}}>Slate</div>
          <div style={{fontSize:8,color:roleColor,fontFamily:T.m,fontWeight:600,textTransform:"uppercase",letterSpacing:1}}>{roleLabel}</div></div>
        {settings.enableQR!==false&&<button onClick={()=>setScanMd("scan")} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          width:36,height:36,borderRadius:8,background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",fontSize:14,color:T.bl}}>⎘</button>}
        <button onClick={()=>setSearchMd(true)} style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
          width:36,height:36,borderRadius:8,background:T.card,border:"1px solid "+T.bd,fontSize:14,color:T.mu}}>⌕</button>
        <button onClick={()=>{setPg("profile");setMobileNav(false)}} style={{all:"unset",cursor:"pointer",
          width:28,height:28,borderRadius:14,background:roleColor+"22",border:"1px solid "+roleColor+"44",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:roleColor,fontFamily:T.m}}>
          {user.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</button></div>}

      {/* Mobile nav drawer */}
      {isMobile&&mobileNav&&<>
        <div onClick={()=>setMobileNav(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:98,touchAction:"none"}}/>
        <nav style={{position:"fixed",top:0,left:0,bottom:0,width:260,background:T.panel,borderRight:"1px solid "+T.bd,padding:"14px 0",
          display:"flex",flexDirection:"column",overflowY:"auto",overflowX:"hidden",zIndex:99,animation:"slideIn .2s ease-out",touchAction:"pan-y",WebkitOverflowScrolling:"touch"}}>
          {navContent}</nav></>}

      {/* Desktop sidebar */}
      {!isMobile&&<nav style={{width:200,flexShrink:0,background:T.panel,borderRight:"1px solid "+T.bd,padding:"14px 0",display:"flex",flexDirection:"column",overflowX:"hidden"}}>
        {navContent}</nav>}

      <main style={{flex:1,padding:isMobile?"14px 12px":"20px 26px",overflowX:"hidden"}}>
        {pg==="dashboard"&&<Dash kits={kits} types={types} locs={locs} comps={comps} personnel={personnel} depts={depts} trips={trips} requests={requests}
          analytics={analytics} logs={logs} settings={settings} curUserId={curUser} userRole={effectiveRole} favorites={favorites} setFavorites={setFavorites} onNavigate={handleNavigate} onAction={handleQuickAction} onFilterKits={handleFilterKits}/>}
        {pg==="kits"&&<KitInv kits={kits} setKits={setKits} types={types} locs={locs} comps={comps} personnel={personnel} depts={depts}
          isAdmin={isAdmin} isSuper={isSuper} settings={settings} favorites={favorites} setFavorites={setFavorites} addLog={addLog} curUserId={curUser}
          initialFilter={kitFilter} onFilterChange={setKitFilter} analytics={analytics} onRefreshKits={refreshKits}
          initialSelectedKit={navKitId} onClearSelectedKit={()=>setNavKitId(null)} initialAction={navAction} onClearAction={()=>setNavAction(null)} apiInspect={apiInspect} isMobile={isMobile}
          apiSendMaint={apiSendMaint} apiResolveDegraded={apiResolveDegraded}/>}
        {pg==="issuance"&&<KitIssuance kits={kits} setKits={setKits} types={types} locs={locs} personnel={personnel} allC={comps} depts={depts}
          isAdmin={isAdmin} isSuper={isSuper} userRole={effectiveRole} curUserId={curUser} settings={settings} requests={requests} setRequests={setRequests}
          accessRequests={accessRequests} setAccessRequests={setAccessRequests} addLog={addLog}
          reservations={reservations} onNavigateToKit={kitId=>{setNavKitId(kitId);setPg("kits")}} trips={trips}
          apiCheckout={apiCheckout} apiReturn={apiReturn} apiInspect={apiInspect} onRefreshKits={refreshKits} onRefreshRequests={refreshCheckoutRequests} apiSendMaint={apiSendMaint} apiResolveDegraded={apiResolveDegraded}/>}
        {pg==="analytics"&&canAccess({access:"admin",perm:"analytics"})&&<AnalyticsPage analytics={analytics} kits={kits} personnel={personnel} depts={depts} comps={comps} types={types} locs={locs}/>}
        {pg==="reports"&&canAccess({access:"admin",perm:"reports"})&&<ReportsPage kits={kits} personnel={personnel} depts={depts} comps={comps} types={types} locs={locs} logs={logs} analytics={analytics}/>}
        {pg==="approvals"&&isApprover&&<ApprovalsPage requests={requests} setRequests={setRequests}
          accessRequests={accessRequests} setAccessRequests={setAccessRequests}
          kits={kits} setKits={setKits}
          personnel={personnel} depts={depts} allC={comps} types={types} curUserId={curUser} userRole={effectiveRole} settings={settings} addLog={addLog} onRefreshKits={refreshKits} onRefreshRequests={refreshCheckoutRequests}/>}
        {pg==="trips"&&<TripsPage trips={trips} kits={kits} types={types} depts={depts} personnel={personnel} reservations={reservations} boats={boats}
          isAdmin={canManageTrips} isSuper={isSuper} curUserId={curUser} settings={settings} onRefreshTrips={refreshTrips} onRefreshKits={refreshKits} onRefreshPersonnel={refreshPersonnel} onRefreshBoats={refreshBoats} onRefreshReservations={refreshReservations}/>}
        {pg==="reservations"&&settings.enableReservations&&<ReservationsPage reservations={reservations} setReservations={setReservations}
          kits={kits} personnel={personnel} trips={trips} curUserId={curUser} isAdmin={isAdmin} addLog={addLog} onRefreshReservations={refreshReservations}/>}
        {pg==="maintenance"&&canAccess({access:"admin",perm:"maintenance",setting:"enableMaintenance"})&&settings.enableMaintenance&&<MaintenancePage kits={kits} setKits={setKits} types={types} locs={locs}
          personnel={personnel} addLog={addLog} curUserId={curUser} onSendMaint={apiSendMaint} onReturnMaint={apiReturnMaint}/>}
        {pg==="consumables"&&canAccess({access:"admin",perm:"consumables",setting:"enableConsumables"})&&settings.enableConsumables&&<ConsumablesPage consumables={consumables} setConsumables={setConsumables}
          assets={assets} setAssets={setAssets} personnel={personnel} locs={locs} addLog={addLog} curUserId={curUser} isAdmin={hasPerm("consumables")}
          onRefreshConsumables={refreshConsumables} onRefreshAssets={refreshAssets}/>}
        {pg==="auditlog"&&isSuper&&<AuditLogPage logs={logs} kits={kits} personnel={personnel} types={types} locs={locs} depts={depts} comps={comps}
          consumables={consumables} assets={assets} trips={trips} boats={boats} reservations={reservations} onRefreshLogs={refreshLogs}/>}
        {pg==="types"&&canAccess({access:"admin",perm:"types"})&&<TypeAdmin types={types} setTypes={setTypes} comps={comps} kits={kits} depts={depts} onRefreshTypes={refreshTypes}/>}
        {pg==="components"&&canAccess({access:"admin",perm:"components"})&&<CompAdmin comps={comps} setComps={setComps} types={types} onRefreshComps={refreshComps}/>}
        {pg==="locations"&&canAccess({access:"admin",perm:"locations"})&&<LocAdmin locs={locs} setLocs={setLocs} kits={kits} onRefreshLocs={refreshLocs}/>}
        {pg==="departments"&&canAccess({access:"admin",perm:"departments"})&&<DeptAdmin depts={depts} setDepts={setDepts} personnel={personnel} kits={kits} locs={locs} onRefreshDepts={refreshDepts} onRefreshPersonnel={refreshPersonnel}/>}
        {pg==="personnel"&&canAccess({access:"admin",perm:"personnel"})&&<PersonnelAdmin personnel={personnel} setPersonnel={setPersonnel} kits={kits} depts={depts} onRefreshPersonnel={refreshPersonnel} settings={settings} curUserId={user?.id}/>}
        {pg==="boats"&&canAccess({access:"lead",perm:"boats"})&&<BoatAdmin boats={boats} onRefreshBoats={refreshBoats} settings={settings}/>}
        {pg==="settings"&&isSuper&&<SettingsPage settings={settings} setSettings={setSettings} onSaveSettings={saveSettings}/>}
        {pg==="profile"&&<MyProfile user={user} personnel={personnel} setPersonnel={setPersonnel} kits={kits} assets={assets} depts={depts} onRefreshPersonnel={refreshPersonnel}/>}
      </main>

      <ModalWrap open={searchMd} onClose={()=>setSearchMd(false)} title="Search">
        <GlobalSearch kits={kits} personnel={personnel} locs={locs} depts={depts} types={types} comps={comps}
          onSelect={handleSearchSelect} onClose={()=>setSearchMd(false)}/></ModalWrap>

      {/* Person Detail Modal */}
      <ModalWrap open={!!navPersonId} onClose={()=>setNavPersonId(null)} title="Person Details" wide>
        {navPersonId&&(()=>{const person=personnel.find(p=>p.id===navPersonId);if(!person)return null;
          const pDept=person.deptId?depts.find(d=>d.id===person.deptId):null;
          const pKits=kits.filter(k=>k.issuedTo===person.id);
          const pTrips=trips.filter(t=>(t.personnel||[]).some(tp=>tp.userId===person.id||tp.id===person.id));
          const pReservations=reservations.filter(r=>r.personId===person.id&&r.status!=="cancelled");
          const pCheckoutHistory=kits.reduce((acc,k)=>{(k.issueHistory||[]).forEach(h=>{if(h.personId===person.id)acc.push({...h,kitColor:k.color,kitId:k.id})});return acc},[])
            .sort((a,b)=>new Date(b.issuedDate)-new Date(a.issuedDate)).slice(0,10);
          const rc=sysRoleColor(person.role);
          return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",gap:16}}>
              <div style={{width:56,height:56,borderRadius:28,background:rc+"22",border:"2px solid "+rc+"44",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:700,color:rc,fontFamily:T.u}}>
                {person.name.split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:18,fontWeight:700,color:T.tx,fontFamily:T.u}}>{person.name}</div>
                <div style={{fontSize:12,color:T.mu,fontFamily:T.m}}>{person.title||"No title"}</div>
                <div style={{display:"flex",gap:6,marginTop:4}}>
                  <Bg color={rc} bg={rc+"18"}>{SYS_ROLE_LABELS[person.role]||person.role}</Bg>
                  {pDept&&<DeptBg dept={pDept}/>}</div></div></div>

            {/* Stats Row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
              <div style={{padding:12,borderRadius:8,background:"rgba(244,114,182,.04)",border:"1px solid rgba(244,114,182,.12)"}}>
                <div style={{fontSize:20,fontWeight:700,color:T.pk,fontFamily:T.u}}>{pKits.length}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Kits Checked Out</div></div>
              <div style={{padding:12,borderRadius:8,background:"rgba(168,85,247,.04)",border:"1px solid rgba(168,85,247,.12)"}}>
                <div style={{fontSize:20,fontWeight:700,color:T.pu||"#a855f7",fontFamily:T.u}}>{pTrips.length}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Active Trips</div></div>
              <div style={{padding:12,borderRadius:8,background:"rgba(96,165,250,.04)",border:"1px solid rgba(96,165,250,.12)"}}>
                <div style={{fontSize:20,fontWeight:700,color:T.bl,fontFamily:T.u}}>{pReservations.length}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Reservations</div></div>
              <div style={{padding:12,borderRadius:8,background:"rgba(34,197,94,.04)",border:"1px solid rgba(34,197,94,.12)"}}>
                <div style={{fontSize:20,fontWeight:700,color:T.gn,fontFamily:T.u}}>{pCheckoutHistory.length}</div>
                <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>Recent Checkouts</div></div></div>

            {/* Current Kits */}
            {pKits.length>0&&<div>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.pk,fontFamily:T.m,fontWeight:600,marginBottom:8}}>Kits Checked Out ({pKits.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {pKits.map(k=>{const ty=types.find(t=>t.id===k.typeId);const lastIssue=(k.issueHistory||[]).filter(h=>h.personId===person.id).slice(-1)[0];
                  return(<button key={k.id} onClick={()=>{setNavPersonId(null);setNavKitId(k.id);setPg("kits")}} style={{all:"unset",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(244,114,182,.03)",border:"1px solid rgba(244,114,182,.12)",transition:"all .12s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(244,114,182,.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(244,114,182,.03)"}>
                    <Sw color={k.color} size={22}/>
                    <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>Kit {k.color}</div>
                      <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{ty?.name||"Unknown type"}{lastIssue?" | Since "+fmtDate(lastIssue.issuedDate):""}</div></div>
                    <span style={{fontSize:10,color:T.dm}}>View →</span></button>)})}</div></div>}

            {/* Trips */}
            {pTrips.length>0&&<div>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.pu||"#a855f7",fontFamily:T.m,fontWeight:600,marginBottom:8}}>Trips ({pTrips.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {pTrips.map(t=>{const tp=(t.personnel||[]).find(p=>p.userId===person.id||p.id===person.id);
                  return(<button key={t.id} onClick={()=>{setNavPersonId(null);setPg("trips")}} style={{all:"unset",cursor:"pointer",
                    display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(168,85,247,.03)",border:"1px solid rgba(168,85,247,.12)",transition:"all .12s"}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(168,85,247,.08)"}
                    onMouseLeave={e=>e.currentTarget.style.background="rgba(168,85,247,.03)"}>
                    <div style={{width:22,height:22,borderRadius:6,background:"rgba(168,85,247,.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.pu||"#a855f7"}}>▸</div>
                    <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{t.name}</div>
                      <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{t.location||"No location"}{tp?.tripRole?" | "+tp.tripRole:""} | {t.status}</div></div>
                    <Bg color={t.status==="active"?T.gn:t.status==="completed"?T.bl:T.am} bg={(t.status==="active"?T.gn:t.status==="completed"?T.bl:T.am)+"18"}>{t.status}</Bg></button>)})}</div></div>}

            {/* Reservations */}
            {pReservations.length>0&&<div>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.bl,fontFamily:T.m,fontWeight:600,marginBottom:8}}>Reservations ({pReservations.length})</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                {pReservations.map(r=>{const k=kits.find(x=>x.id===r.kitId);
                  return(<div key={r.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:7,background:"rgba(96,165,250,.03)",border:"1px solid rgba(96,165,250,.12)"}}>
                    {k&&<Sw color={k.color} size={18}/>}
                    <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{k?"Kit "+k.color:"Kit"}{r.tripRestricted?" for \u{1F512} Restricted":r.tripName?" for "+r.tripName:""}</div>
                      <div style={{fontSize:9,color:T.mu,fontFamily:T.m}}>{r.startDate} to {r.endDate}{!r.tripRestricted&&r.purpose?" | "+r.purpose:""}</div></div>
                    <Bg color={r.status==="approved"?T.gn:r.status==="pending"?T.am:T.mu} bg={(r.status==="approved"?T.gn:r.status==="pending"?T.am:T.mu)+"18"}>{r.status}</Bg></div>)})}</div></div>}

            {/* Recent Checkout History */}
            {pCheckoutHistory.length>0&&<div>
              <div style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.2,color:T.tl,fontFamily:T.m,fontWeight:600,marginBottom:8}}>Recent Checkout History</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {pCheckoutHistory.map((h,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 14px",borderRadius:5,background:i%2===0?"transparent":"rgba(255,255,255,.015)"}}>
                  <Sw color={h.kitColor} size={16}/>
                  <span style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m,minWidth:80}}>Kit {h.kitColor}</span>
                  <span style={{fontSize:10,color:T.mu,fontFamily:T.m,flex:1}}>{fmtDate(h.issuedDate)}</span>
                  {h.returnedDate?<Bg color={T.gn} bg="rgba(34,197,94,.08)">Returned {fmtDate(h.returnedDate)}</Bg>
                    :<Bg color={T.pk} bg="rgba(244,114,182,.08)">Outstanding</Bg>}</div>))}</div></div>}

            {pKits.length===0&&pTrips.length===0&&pReservations.length===0&&pCheckoutHistory.length===0&&
              <div style={{padding:30,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>No activity found for this person</div>}
          </div>)})()}</ModalWrap>

      {settings.enableQR!==false&&<ScanAction scanMd={scanMd} setScanMd={setScanMd} kits={kits} types={types} locs={locs} comps={comps}
        personnel={personnel} depts={depts} settings={settings} curUserId={curUser} isAdmin={isAdmin} isSuper={isSuper}
        apiCheckout={apiCheckout} apiReturn={apiReturn} onRefreshKits={refreshKits} reservations={reservations}
        onNavigateToKit={kitId=>{setNavKitId(kitId);setPg("kits")}}/>}
    </div>);}
