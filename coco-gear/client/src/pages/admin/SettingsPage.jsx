import { useState, useRef } from 'react';
import { T } from '../../theme/theme.js';
import { DEF_ROLE_PERMS } from '../../theme/helpers.js';
import { Bt, Fl, In, Sl, Tg, SH, Tabs } from '../../components/ui/index.js';

/* ═══════════ SETTINGS (SUPER ADMIN) ═══════════ */
function SettingsPage({settings,setSettings,onSaveSettings}){
  const[tab,setTab]=useState("general");
  const saveTimer=useRef(null);
  const updateSetting=(key,value)=>{setSettings(p=>{const next={...p,[key]:value};
    clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{if(onSaveSettings)onSaveSettings(next)},800);return next})};
  const updateRolePerm=(role,perm,value)=>{setSettings(p=>{
    const rp={...p.rolePerms||DEF_ROLE_PERMS};
    rp[role]={...(rp[role]||DEF_ROLE_PERMS[role]||{}),[perm]:value};
    const next={...p,rolePerms:rp};
    clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{if(onSaveSettings)onSaveSettings(next)},800);return next})};
  const generalItems=[
    {k:"requireDeptApproval",l:"Require dept approval for cross-dept kits",d:"Kits outside a user's department require approval"},
    {k:"directorBypassApproval",l:"Directors bypass approval",d:"Directors can take any kit without requesting"},
    {k:"requireAccessRequest",l:"Require access request before checkout",d:"Users must request and be approved for kit access before checkout. Access is revoked after return."},
    {k:"restrictReturnToHolder",l:"Restrict kit returns to holder or lead+",d:"Only the kit holder or a lead or above can return a kit. When off, any user can return any kit."},
    {k:"allowUserLocationUpdate",l:"Allow user storage updates",d:"Users can change which storage area a kit is in"},
  ];
  const approvalRoleOpts=[{v:"lead",l:"Lead"},{v:"manager",l:"Manager"},{v:"director",l:"Director"}];
  const accessApprovalRoleOpts=[{v:"lead",l:"Lead"},{v:"manager",l:"Manager"},{v:"director",l:"Director"}];
  const serialItems=[
    {k:"requireSerialsOnCheckout",l:"Require serials on checkout",d:"S/N entry during checkout"},
    {k:"requireSerialsOnReturn",l:"Require serials on return",d:"S/N entry during return"},
    {k:"requireSerialsOnInspect",l:"Require serials on inspect",d:"S/N entry during inspection"},
  ];
  const featureItems=[
    {k:"enableReservations",l:"Enable reservations",d:"Kit booking system"},
    {k:"enableMaintenance",l:"Enable maintenance tracking",d:"Repair and service tracking"},
    {k:"enableConsumables",l:"Enable consumables",d:"Stock management"},
    {k:"enableQR",l:"Enable QR codes",d:"QR code generation, printing, and scanning"},
    {k:"autoReserveOnTrip",l:"Auto-reserve on trip creation",d:"Automatically create reservations for equipment, boats, and personnel when assigned to trips"},
    {k:"enableSelfSignup",l:"Enable team self-signup",d:"Allow new members to create their own accounts using a verified email domain"},
  ];
  const boatFieldItems=[
    {k:"type",l:"Type",d:"USV model/type (e.g. WAM-V, Heron)"},
    {k:"hullId",l:"Hull / Serial #",d:"Hull ID or serial number"},
    {k:"length",l:"Length",d:"Vessel length in meters"},
    {k:"homePort",l:"Home Port",d:"Vessel home port"},
    {k:"notes",l:"Notes",d:"Additional notes field"},
  ];
  const updateBoatField=(field,value)=>{setSettings(p=>{const bf={...(p.boatFields||{type:true,hullId:true,length:true,homePort:true,notes:true}),[field]:value};
    const next={...p,boatFields:bf};clearTimeout(saveTimer.current);saveTimer.current=setTimeout(()=>{if(onSaveSettings)onSaveSettings(next)},800);return next})};
  const numItems=[
    {k:"inspectionDueThreshold",l:"Inspection due threshold",d:"Days before inspection overdue",unit:"days"},
    {k:"overdueReturnThreshold",l:"Overdue return threshold",d:"Days before return overdue",unit:"days"},
  ];
  const permItems=[
    {k:"trips",l:"Trips",d:"Create, edit, and manage trip planning"},
    {k:"analytics",l:"Analytics",d:"View fleet analytics and insights"},
    {k:"reports",l:"Reports",d:"Generate and export reports"},
    {k:"maintenance",l:"Maintenance",d:"Manage maintenance workflow"},
    {k:"consumables",l:"Consumables",d:"Manage consumable inventory"},
    {k:"types",l:"Kit Types",d:"Create and edit kit templates"},
    {k:"components",l:"Components",d:"Manage component library"},
    {k:"locations",l:"Storage",d:"Manage storage areas (cages, rooms, racks)"},
    {k:"departments",l:"Departments",d:"Manage departments"},
    {k:"personnel",l:"Personnel",d:"Manage personnel records"},
    {k:"boats",l:"USVs",d:"Manage unmanned surface vehicles"},
  ];
  const roles=[{k:"lead",l:"Lead",c:T.or},{k:"manager",l:"Manager",c:T.am}];
  const ToggleRow=({item,checked,onChange})=>(
    <div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
      <Tg checked={checked} onChange={onChange}/>
      <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:checked?T.tx:T.mu,fontFamily:T.u}}>{item.l}</div>
        <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{item.d}</div></div></div>);
  const getRolePerm=(role,perm)=>{
    const rp=settings.rolePerms||DEF_ROLE_PERMS;
    if(rp[role]&&perm in rp[role])return rp[role][perm];
    return DEF_ROLE_PERMS[role]?.[perm]||false;
  };
  return(<div>
    <SH title="System Settings" sub="Super Admin configuration"/>
    <Tabs tabs={[{id:"general",l:"General"},{id:"serials",l:"Serials"},{id:"features",l:"Features"},{id:"usvFields",l:"USV Fields"},{id:"roles",l:"Role Permissions"}]} active={tab} onChange={setTab}/>
    <div style={{maxWidth:700,display:"flex",flexDirection:"column",gap:6}}>
      {tab==="general"&&<>
        {generalItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>updateSetting(it.k,v)}/>)}
        {settings.requireDeptApproval&&<div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>Minimum approval role</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>Minimum role that can approve cross-department kit requests</div></div>
          <Sl options={approvalRoleOpts} value={settings.deptApprovalMinRole||"lead"} onChange={e=>updateSetting("deptApprovalMinRole",e.target.value)} style={{width:130}}/></div>}
        {settings.requireAccessRequest&&<div style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>Access request min approval role</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>Minimum role that can approve kit access requests</div></div>
          <Sl options={accessApprovalRoleOpts} value={settings.accessRequestMinApprovalRole||"lead"} onChange={e=>updateSetting("accessRequestMinApprovalRole",e.target.value)} style={{width:130}}/></div>}
        {numItems.map(it=><div key={it.k} style={{display:"flex",alignItems:"center",gap:14,padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{it.l}</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{it.d}</div></div>
          <In type="number" value={settings[it.k]} onChange={e=>updateSetting(it.k,Number(e.target.value))} style={{width:70,textAlign:"right"}}/>
          <span style={{fontSize:10,color:T.mu,fontFamily:T.m,width:30}}>{it.unit}</span></div>)}</>}
      {tab==="serials"&&serialItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>updateSetting(it.k,v)}/>)}
      {tab==="features"&&<>{featureItems.map(it=><ToggleRow key={it.k} item={it} checked={settings[it.k]} onChange={v=>updateSetting(it.k,v)}/>)}
        {settings.enableSelfSignup&&<div style={{padding:"12px 16px",borderRadius:8,background:T.card,border:"1px solid "+T.bd,display:"flex",alignItems:"center",gap:14}}>
          <div style={{flex:1}}><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>Allowed Email Domain</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>Only users with this email domain can self-register</div></div>
          <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:11,color:T.mu,fontFamily:T.m}}>@</span>
          <In value={settings.allowedEmailDomain||""} onChange={e=>updateSetting("allowedEmailDomain",e.target.value)} style={{width:180}} placeholder="saronic.com"/></div></div>}</>}
      {tab==="usvFields"&&<>
        <div style={{padding:12,borderRadius:8,background:"rgba(96,165,250,.03)",border:"1px solid rgba(96,165,250,.12)",marginBottom:8}}>
          <div style={{fontSize:10,color:T.bl,fontFamily:T.m}}>Choose which fields are visible when adding or viewing USVs. Name and Status are always shown.</div></div>
        {boatFieldItems.map(it=><ToggleRow key={it.k} item={it} checked={(settings.boatFields||{})[it.k]!==false} onChange={v=>updateBoatField(it.k,v)}/>)}</>}
      {tab==="roles"&&<>
        <div style={{padding:12,borderRadius:8,background:"rgba(96,165,250,.03)",border:"1px solid rgba(96,165,250,.12)",marginBottom:8}}>
          <div style={{fontSize:10,color:T.bl,fontFamily:T.m}}>Configure exactly what each role can access. Directors always have full access. Operators have view-only access to inventory and trips.</div></div>
        {/* Permission matrix */}
        <div style={{borderRadius:10,border:"1px solid "+T.bd,overflow:"hidden"}}>
          {/* Header row */}
          <div style={{display:"grid",gridTemplateColumns:"1fr repeat("+(roles.length+1)+",72px)",padding:"10px 16px",background:T.card,borderBottom:"1px solid "+T.bd}}>
            <div style={{fontSize:10,fontWeight:700,color:T.tx,fontFamily:T.u}}>Permission</div>
            {roles.map(r=><div key={r.k} style={{fontSize:10,fontWeight:700,color:r.c,fontFamily:T.m,textAlign:"center"}}>{r.l}</div>)}
            <div style={{fontSize:10,fontWeight:700,color:T.rd,fontFamily:T.m,textAlign:"center"}}>Director</div></div>
          {/* Permission rows */}
          {permItems.map((it,i)=><div key={it.k} style={{display:"grid",gridTemplateColumns:"1fr repeat("+(roles.length+1)+",72px)",padding:"10px 16px",
            background:i%2===0?"transparent":T.card,borderBottom:i<permItems.length-1?"1px solid "+T.bd:"none",alignItems:"center"}}>
            <div><div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.u}}>{it.l}</div>
              <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>{it.d}</div></div>
            {roles.map(r=><div key={r.k} style={{display:"flex",justifyContent:"center"}}>
              <Tg checked={getRolePerm(r.k,it.k)} onChange={v=>updateRolePerm(r.k,it.k,v)}/></div>)}
            <div style={{display:"flex",justifyContent:"center"}}>
              <Tg checked={true} onChange={()=>{}}/></div></div>)}</div>
      </>}</div></div>);}

export default SettingsPage;
