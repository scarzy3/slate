import { useState } from 'react';
import { T } from '../theme/theme.js';
import { Bt, Fl, In } from '../components/ui/index.js';

function SetPasswordScreen({userName,onSubmit,onLogout,isDark,toggleTheme}){
  const[pw,setPw]=useState("");const[pw2,setPw2]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  const attempt=async()=>{
    if(!pw){setError("Please enter a new password");return}
    if(pw.length<4){setError("Password must be at least 4 characters");return}
    if(pw!==pw2){setError("Passwords do not match");return}
    setLoading(true);setError("");
    try{await onSubmit(pw)}catch(e){setError(e.message||"Failed to update password");setLoading(false)}
  };
  return(<div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.u,padding:16}}>
    <div style={{width:"92%",maxWidth:420,padding:"28px 24px",borderRadius:16,background:T.panel,border:"1px solid "+T.bd,
      boxShadow:"0 8px 32px rgba(0,0,0,.3)"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:18,fontWeight:800,color:T.tx,marginBottom:4}}>Set New Password</div>
        <div style={{fontSize:11,color:T.sub}}>Welcome, <b>{userName}</b>. Please create a new password to continue.</div></div>
      <Fl label="New Password">
        <In type="password" value={pw} onChange={e=>{setPw(e.target.value);setError("")}}
          placeholder="Enter new password" onKeyDown={e=>{if(e.key==="Enter")document.getElementById("slate-pw2")?.focus()}}/></Fl>
      <Fl label="Confirm Password">
        <In id="slate-pw2" type="password" value={pw2} onChange={e=>{setPw2(e.target.value);setError("")}}
          placeholder="Re-enter password" onKeyDown={e=>{if(e.key==="Enter")attempt()}}/></Fl>
      {error&&<div style={{fontSize:11,color:T.rd,fontFamily:T.m,textAlign:"center",padding:"8px 12px",borderRadius:6,
        background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)",marginBottom:8}}>{error}</div>}
      <Bt v="primary" onClick={attempt} disabled={loading} style={{justifyContent:"center",padding:"11px 0",fontSize:13,width:"100%"}}>{loading?"Saving...":"Set Password & Continue"}</Bt>
      <button onClick={onLogout} style={{all:"unset",cursor:"pointer",display:"block",width:"100%",textAlign:"center",
        fontSize:10,color:T.mu,fontFamily:T.m,marginTop:12}}>Sign out</button>
    </div></div>);}

export default SetPasswordScreen;
