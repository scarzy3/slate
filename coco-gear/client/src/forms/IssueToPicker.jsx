import { useState } from 'react';
import { Bt, Fl, Sl } from '../components/ui/index.js';
import InspWF from './InspWF.jsx';

function IssueToPicker({kits,types,locs,personnel,allC,settings,onIssue,onCancel}){
  const[selKit,setSelKit]=useState("");const[selPerson,setSelPerson]=useState("");const[phase,setPhase]=useState("pick");
  const availKits=kits.filter(k=>!k.issuedTo&&!k.maintenanceStatus);const kit=kits.find(k=>k.id===selKit);const ty=kit?types.find(t=>t.id===kit.typeId):null;
  if(phase==="serials"&&kit&&ty)return <InspWF kit={kit} type={ty} allC={allC} mode="checkout" onDone={data=>onIssue(selKit,selPerson,data)} onCancel={()=>setPhase("pick")} settings={settings}/>;
  return(<div style={{display:"flex",flexDirection:"column",gap:16}}>
    <Fl label="Kit"><Sl options={[{v:"",l:"-- Select --"},...availKits.map(k=>{const lo=locs.find(l=>l.id===k.locId);return{v:k.id,l:k.color+" ("+(lo?.name||"?")+")"}})]} value={selKit} onChange={e=>setSelKit(e.target.value)}/></Fl>
    <Fl label="Issue To"><Sl options={[{v:"",l:"-- Select --"},...personnel.map(p=>({v:p.id,l:p.name}))]} value={selPerson} onChange={e=>setSelPerson(e.target.value)}/></Fl>
    <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><Bt onClick={onCancel}>Cancel</Bt><Bt v="primary" onClick={()=>setPhase("serials")} disabled={!selKit||!selPerson}>Next</Bt></div></div>);}

export default IssueToPicker;
