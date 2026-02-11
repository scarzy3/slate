import { useState, useMemo } from 'react';
import { T } from '../../theme/theme.js';
import { SYS_ROLE_LABELS } from '../../theme/helpers.js';
import { Bg, Bt, Fl, In, Ta, Sl, SH, ModalWrap, ConfirmDialog } from '../../components/ui/index.js';
import api from '../../api.js';

/* ═══════════ PERSONNEL ═══════════ */
function PersonnelAdmin({personnel,setPersonnel,kits,depts,onRefreshPersonnel,settings:appSettings,curUserId}){
  const[md,setMd]=useState(null);const[fm,setFm]=useState({name:"",email:"",title:"",role:"user",deptId:"",pin:""});
  const[deleteConfirm,setDeleteConfirm]=useState(null);
  const[importMd,setImportMd]=useState(false);const[importText,setImportText]=useState("");const[importParsed,setImportParsed]=useState([]);
  const[importError,setImportError]=useState("");const[importLoading,setImportLoading]=useState(false);const[importRole,setImportRole]=useState("user");const[importDept,setImportDept]=useState("");
  const allowedDomain=appSettings?.allowedEmailDomain||"";
  const parseImportText=(text)=>{
    setImportText(text);setImportError("");
    const lines=text.split("\n").map(l=>l.trim()).filter(Boolean);
    const parsed=[];
    for(const line of lines){
      // Support formats: "name, email" or "email" or "name <email>"
      let name="",email="";
      const angleMatch=line.match(/^(.+?)\s*<([^>]+@[^>]+)>/);
      if(angleMatch){name=angleMatch[1].trim();email=angleMatch[2].trim()}
      else if(line.includes(",")){const parts=line.split(",").map(s=>s.trim());name=parts[0];email=parts[1]||""}
      else if(line.includes("@")){email=line;name=email.split("@")[0].replace(/[._-]/g," ").replace(/\b\w/g,c=>c.toUpperCase())}
      if(email&&email.includes("@"))parsed.push({name,email:email.toLowerCase(),title:"",role:importRole,deptId:importDept||null})}
    setImportParsed(parsed)};
  const doImport=async()=>{
    if(!importParsed.length){setImportError("No valid entries to import");return}
    // Check for domain violations
    if(allowedDomain){const bad=importParsed.filter(m=>m.email.split("@")[1]!==allowedDomain.toLowerCase());
      if(bad.length){setImportError("Some emails don't match @"+allowedDomain+": "+bad.map(b=>b.email).join(", "));return}}
    // Check for existing emails
    const existingEmails=personnel.filter(p=>p.email).map(p=>p.email.toLowerCase());
    const dupes=importParsed.filter(m=>existingEmails.includes(m.email));
    if(dupes.length){setImportError("Already exist: "+dupes.map(d=>d.email).join(", "));return}
    setImportLoading(true);setImportError("");
    try{await api.personnel.import(importParsed.map(m=>({...m,role:importRole,deptId:importDept||null})));
      await onRefreshPersonnel();setImportMd(false);setImportText("");setImportParsed([])}
    catch(e){setImportError(e.message||"Import failed")}
    finally{setImportLoading(false)}};

  /* Primary protected user: the currently logged-in developer, else first developer by creation, else first director-level user */
  const devs=personnel.filter(p=>p.role==="developer");
  const primaryDirector=devs.find(p=>p.id===curUserId)||devs[0]||personnel.find(p=>p.role==="director"||p.role==="super"||p.role==="engineer");
  const isPrimarySuper=(id)=>primaryDirector?.id===id;

  const save=async()=>{if(!fm.name.trim())return;
    try{if(md==="add"){await api.personnel.create({name:fm.name.trim(),email:fm.email?.trim()||undefined,title:fm.title.trim(),role:fm.role,deptId:fm.deptId||null,pin:fm.pin||"password"})}
    else{
      if(isPrimarySuper(md)&&!["developer","director","super","engineer"].includes(fm.role)){alert("Cannot change role of primary director");return}
      const data={name:fm.name.trim(),email:fm.email?.trim()||null,title:fm.title.trim(),role:fm.role,deptId:fm.deptId||null};
      if(fm.pin)data.pin=fm.pin;
      await api.personnel.update(md,data)}
    await onRefreshPersonnel()}catch(e){alert(e.message)}
    setMd(null)};

  const confirmDelete=(person)=>{
    if(person.role==="developer"){alert("Cannot delete the developer account");return}
    const ik=kits.filter(k=>k.issuedTo===person.id);
    if(ik.length>0){alert("Cannot delete: user has "+ik.length+" kit(s) checked out");return}
    if(isPrimarySuper(person.id)){alert("Cannot delete the primary administrator");return}
    setDeleteConfirm(person)};

  const doDelete=async()=>{if(deleteConfirm){try{await api.personnel.delete(deleteConfirm.id);await onRefreshPersonnel()}catch(e){alert(e.message)}}};

  const rc={developer:T.gn,director:T.rd,super:T.rd,engineer:T.rd,manager:T.am,admin:T.am,lead:T.or,user:T.bl};
  const grouped=useMemo(()=>{const g={"Unassigned":[]};depts.forEach(d=>{g[d.name]=[]});
    personnel.forEach(p=>{const d=p.deptId?depts.find(x=>x.id===p.deptId):null;(g[d?.name||"Unassigned"]=g[d?.name||"Unassigned"]||[]).push(p)});return g},[personnel,depts]);
  return(<div>
    <SH title="Personnel" sub={personnel.length+" people"} action={<div style={{display:"flex",gap:8}}>
      <Bt v="ind" onClick={()=>{setImportMd(true);setImportText("");setImportParsed([]);setImportError("")}}>Import Team</Bt>
      <Bt v="primary" onClick={()=>{setFm({name:"",email:"",title:"",role:"user",deptId:"",pin:""});setMd("add")}}>+ Add</Bt></div>}/>
    {Object.entries(grouped).filter(([,members])=>members.length>0).map(([deptName,members])=>{const dept=depts.find(d=>d.name===deptName);return(<div key={deptName} style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        {dept&&<div style={{width:4,height:16,borderRadius:2,background:dept.color}}/>}
        <span style={{fontSize:10,textTransform:"uppercase",letterSpacing:1.5,color:dept?.color||T.mu,fontFamily:T.m}}>{deptName} ({members.length})</span></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(300px,100%),1fr))",gap:6}}>
        {members.map(p=>{const ik=kits.filter(k=>k.issuedTo===p.id);const isProtected=isPrimarySuper(p.id);return(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:8,background:T.card,border:"1px solid "+(isProtected?"rgba(239,68,68,.2)":T.bd)}}>
            <div style={{width:32,height:32,borderRadius:16,background:(rc[p.role])+"18",border:"1px solid "+(rc[p.role])+"44",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:rc[p.role],fontFamily:T.m}}>{p.name.split(" ").map(n=>n[0]).join("")}</div>
            <div style={{flex:1,minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:12,fontWeight:600,color:T.tx,fontFamily:T.u}}>{p.name}</span>
              {isProtected&&<span style={{fontSize:8,color:T.rd,fontFamily:T.m}}>★ PRIMARY</span>}</div>
              <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{p.title||"No title"}{p.email&&<span style={{marginLeft:6,fontSize:9,color:T.dm}}>{p.email}</span>}</div>
              <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}>
                <Bg color={rc[p.role]||T.bl} bg={(rc[p.role]||T.bl)+"18"}>{SYS_ROLE_LABELS[p.role]||p.role}</Bg>
                {ik.length>0&&<Bg color={T.pk} bg="rgba(244,114,182,.08)">{ik.length} kit{ik.length>1?"s":""}</Bg>}</div></div>
            <Bt v="ghost" sm onClick={()=>{setFm({name:p.name,email:p.email||"",title:p.title||"",role:p.role,deptId:p.deptId||"",pin:""});setMd(p.id)}}>Edit</Bt>
            <Bt v="ghost" sm onClick={()=>confirmDelete(p)} style={{color:T.rd}} disabled={ik.length>0||isProtected}
              title={isProtected?"Primary director cannot be deleted":ik.length>0?"Has kits checked out":""}>Del</Bt></div>)})}</div></div>)})}

    <ModalWrap open={!!md&&md!=="delete"} onClose={()=>setMd(null)} title={md==="add"?"Add Person":"Edit Person"}>
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        <Fl label="Name"><In value={fm.name} onChange={e=>setFm(p=>({...p,name:e.target.value}))}/></Fl>
        <Fl label="Email" sub="optional"><In type="email" value={fm.email} onChange={e=>setFm(p=>({...p,email:e.target.value}))} placeholder="user@saronic.com"/></Fl>
        <Fl label="Title"><In value={fm.title} onChange={e=>setFm(p=>({...p,title:e.target.value}))} placeholder="e.g. Project Manager, Engineer"/></Fl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
          <Fl label="Role"><Sl options={[{v:"user",l:"Operator"},{v:"lead",l:"Lead"},{v:"manager",l:"Manager"},{v:"engineer",l:"Engineer"},{v:"director",l:"Director"}]} value={fm.role} onChange={e=>setFm(p=>({...p,role:e.target.value}))}
            disabled={isPrimarySuper(md)}/></Fl>
          <Fl label="Department"><Sl options={[{v:"",l:"-- None --"},...depts.map(d=>({v:d.id,l:d.name}))] } value={fm.deptId} onChange={e=>setFm(p=>({...p,deptId:e.target.value}))}/></Fl>
          <Fl label="Password"><In type="password" value={fm.pin} onChange={e=>setFm(p=>({...p,pin:e.target.value}))} placeholder={md==="add"?"password":"unchanged"}/></Fl></div>
        {isPrimarySuper(md)&&<div style={{padding:10,borderRadius:6,background:"rgba(239,68,68,.05)",border:"1px solid rgba(239,68,68,.1)"}}>
          <div style={{fontSize:10,color:T.rd,fontFamily:T.m}}>This is the primary director. Role cannot be changed.</div></div>}
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={()=>setMd(null)}>Cancel</Bt><Bt v="primary" onClick={save}>{md==="add"?"Add":"Save"}</Bt></div></div></ModalWrap>

    <ConfirmDialog open={!!deleteConfirm} onClose={()=>setDeleteConfirm(null)} onConfirm={doDelete}
      title="Delete User?" message={`Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`}/>

    <ModalWrap open={importMd} onClose={()=>setImportMd(false)} title="Import Team Members" wide>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{padding:12,borderRadius:8,background:"rgba(129,140,248,.04)",border:"1px solid rgba(129,140,248,.15)"}}>
          <div style={{fontSize:11,color:T.ind,fontFamily:T.m,fontWeight:600,marginBottom:4}}>Paste emails or names + emails</div>
          <div style={{fontSize:10,color:T.dm,fontFamily:T.m,lineHeight:1.5}}>
            Supported formats (one per line):<br/>
            jane@{allowedDomain||"company.com"}<br/>
            Jane Smith, jane@{allowedDomain||"company.com"}<br/>
            Jane Smith {"<"}jane@{allowedDomain||"company.com"}{">"}</div></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fl label="Default Role"><Sl options={[{v:"user",l:"Operator"},{v:"lead",l:"Lead"},{v:"manager",l:"Manager"}]} value={importRole} onChange={e=>{setImportRole(e.target.value);if(importText)parseImportText(importText)}}/></Fl>
          <Fl label="Default Department"><Sl options={[{v:"",l:"-- None --"},...depts.map(d=>({v:d.id,l:d.name}))]} value={importDept} onChange={e=>{setImportDept(e.target.value);if(importText)parseImportText(importText)}}/></Fl></div>
        <Fl label="Team Members">
          <Ta rows={8} value={importText} onChange={e=>parseImportText(e.target.value)}
            placeholder={"jane@"+(allowedDomain||"company.com")+"\nJohn Smith, john@"+(allowedDomain||"company.com")+"\nBob Jones <bob@"+(allowedDomain||"company.com")+">"}/></Fl>
        {importParsed.length>0&&<div>
          <div style={{fontSize:10,fontWeight:600,color:T.tx,fontFamily:T.m,marginBottom:8}}>Preview ({importParsed.length} member{importParsed.length!==1?"s":""})</div>
          <div style={{maxHeight:200,overflowY:"auto",borderRadius:8,border:"1px solid "+T.bd}}>
            {importParsed.map((m,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
              background:i%2===0?"transparent":T.card,borderBottom:i<importParsed.length-1?"1px solid "+T.bd:"none"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:T.tx,fontFamily:T.m}}>{m.name}</div>
                <div style={{fontSize:10,color:T.mu,fontFamily:T.m}}>{m.email}</div></div>
              <Bg color={T.bl} bg="rgba(96,165,250,.08)">user</Bg></div>)}</div></div>}
        {importError&&<div style={{fontSize:11,color:T.rd,fontFamily:T.m,padding:"8px 12px",borderRadius:6,
          background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>{importError}</div>}
        <div style={{fontSize:9,color:T.dm,fontFamily:T.m}}>All imported members get the default password "password" and must change it on first login.</div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Bt onClick={()=>setImportMd(false)}>Cancel</Bt>
          <Bt v="ind" onClick={doImport} disabled={importLoading||!importParsed.length}>{importLoading?"Importing...":"Import "+importParsed.length+" Member"+(importParsed.length!==1?"s":"")}</Bt></div>
      </div></ModalWrap></div>);}

export default PersonnelAdmin;
