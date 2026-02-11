import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { T } from '../theme/theme.js';
import { Bt, Fl, In } from '../components/ui/index.js';

function LoginScreen({personnel,onLogin,isDark,toggleTheme,signupDomain,onShowSignup}){
  const[nameVal,setNameVal]=useState("");const[pin,setPin]=useState("");const[error,setError]=useState("");const[loading,setLoading]=useState(false);
  const[showList,setShowList]=useState(false);const[hiIdx,setHiIdx]=useState(0);
  const[users,setUsers]=useState(personnel||[]);const[usersLoading,setUsersLoading]=useState(true);const[fetchError,setFetchError]=useState("");
  const nameRef=useRef(null);const listRef=useRef(null);const pwRef=useRef(null);const retriesRef=useRef(0);const formRef=useRef(null);
  const fetchUsers=useCallback(()=>{
    setUsersLoading(true);setFetchError("");
    fetch('/api/auth/users').then(r=>{
      if(!r.ok)throw new Error("Server returned "+r.status);
      return r.json();
    }).then(data=>{
      console.log("[Slate Login] Fetched users:",data?.length||0);
      if(Array.isArray(data)&&data.length>0)setUsers(data.map(p=>({id:p.id,name:p.name,title:p.title||"",role:p.role,deptId:p.deptId})));
      setUsersLoading(false);retriesRef.current=0;
    }).catch(err=>{
      console.error("[Slate Login] Fetch failed:",err);
      if(retriesRef.current<3){retriesRef.current++;setTimeout(fetchUsers,1500)}
      else{setUsersLoading(false);setFetchError(err.message||"Could not reach server")}
    });
  },[]);
  useEffect(()=>{fetchUsers()},[fetchUsers]);
  useEffect(()=>{if(personnel?.length&&!users.length)setUsers(personnel)},[personnel,users.length]);
  const resolveUser=(name)=>{if(!name)return null;const q=name.trim().toLowerCase();return users.find(p=>p.name.toLowerCase()===q)};
  const matchedUser=resolveUser(nameVal);
  const filtered=useMemo(()=>{
    if(!nameVal)return users;
    const q=nameVal.toLowerCase();
    return users.filter(p=>p.name.toLowerCase().includes(q)||p.role.toLowerCase().includes(q)||(p.title||"").toLowerCase().includes(q));
  },[users,nameVal]);
  useEffect(()=>{setHiIdx(0)},[filtered.length]);
  useEffect(()=>{
    if(!showList)return;
    const h=e=>{if(nameRef.current&&!nameRef.current.contains(e.target)&&listRef.current&&!listRef.current.contains(e.target))setShowList(false)};
    document.addEventListener("mousedown",h);return()=>document.removeEventListener("mousedown",h);
  },[showList]);
  const pickUser=(p)=>{setNameVal(p.name);setShowList(false);setError("");setTimeout(()=>pwRef.current?.focus(),50)};
  const handleNameKey=(e)=>{
    if(!showList)return;
    if(e.key==="ArrowDown"){e.preventDefault();setHiIdx(i=>Math.min(i+1,filtered.length-1))}
    else if(e.key==="ArrowUp"){e.preventDefault();setHiIdx(i=>Math.max(i-1,0))}
    else if(e.key==="Enter"&&filtered.length>0&&showList){e.preventDefault();pickUser(filtered[hiIdx])}
    else if(e.key==="Escape"){setShowList(false)}};
  const attempt=async()=>{
    const resolved=resolveUser(nameVal);
    if(!resolved){
      if(nameVal.trim()){setError("User not found. Select from the list.")}else{setError("Enter your name")}return}
    setLoading(true);setError("");
    try{await onLogin(resolved.id,pin)}
    catch(e){setError(e.message||"Login failed")}
    finally{setLoading(false)}};
  const handleSubmit=(e)=>{e.preventDefault();attempt()};
  return(
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:T.u}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *{box-sizing:border-box}::selection{background:${T._selBg}}
        option{background:${T._optBg};color:${T._optColor}}
        @media(max-width:767px){input,select{font-size:16px!important}}
      `}</style>
      <div style={{width:"92%",maxWidth:380,padding:"28px 24px",borderRadius:16,background:T.panel,border:"1px solid "+T.bd,animation:"mdIn .25s ease-out",position:"relative"}}>
        <style>{`@keyframes mdIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <button onClick={toggleTheme} style={{all:"unset",cursor:"pointer",position:"absolute",top:14,right:14,
          width:30,height:30,borderRadius:15,display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:14,background:isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.06)",border:"1px solid "+T.bd,
          color:T.mu,transition:"all .15s"}} title={isDark?"Switch to light mode":"Switch to dark mode"}>
          {isDark?"☀":"☾"}</button>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:28,background:"rgba(96,165,250,.1)",border:"1px solid rgba(96,165,250,.25)",
            display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:22,fontWeight:800,color:T.bl,fontFamily:T.u}}>S</div>
          <div style={{fontSize:24,fontWeight:800,color:T.tx,letterSpacing:-.5}}>Slate</div>
          <div style={{fontSize:11,color:T.mu,fontFamily:T.m,marginTop:4}}>Equipment Management System</div></div>
        <form ref={formRef} onSubmit={handleSubmit} autoComplete="on" style={{display:"flex",flexDirection:"column",gap:16}}>
          <Fl label="Name">
            <div style={{position:"relative"}} ref={nameRef}>
              {usersLoading?(
                <div style={{padding:"7px 11px",borderRadius:6,background:T.card,border:"1px solid "+T.bd,
                  color:T.mu,fontSize:11,fontFamily:T.m}}>Loading users...</div>
              ):(
                <>
                <input type="text" name="username" autoComplete="username" value={nameVal}
                  onChange={e=>{setNameVal(e.target.value);if(e.target.value)setShowList(true);setError("")}}
                  onFocus={()=>{if(nameVal||users.length)setShowList(true)}} onKeyDown={handleNameKey}
                  placeholder={users.length?users.length+" users — type to search...":"Enter your name..."}
                  style={{width:"100%",padding:"7px 11px",borderRadius:6,background:T.card,border:"1px solid "+(matchedUser?T.gn:T.bd),color:T.tx,
                    fontSize:11,fontFamily:T.m,outline:"none",transition:"border .15s"}}/>
                {matchedUser&&!showList&&<div style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                  fontSize:9,color:T.gn,fontFamily:T.m,pointerEvents:"none"}}>{matchedUser.role}</div>}
                </>
              )}
              {showList&&!usersLoading&&<div ref={listRef} style={{position:"absolute",top:"100%",left:0,right:0,marginTop:4,
                background:T.panel,border:"1px solid "+T.bd,borderRadius:8,maxHeight:200,overflowY:"auto",zIndex:10,
                boxShadow:"0 8px 24px rgba(0,0,0,.25)"}}>
                {filtered.length===0?<div style={{padding:"10px 12px",fontSize:11,color:T.mu,fontFamily:T.m}}>No users found</div>:
                  filtered.map((p,i)=>(
                    <div key={p.id} onMouseDown={e=>{e.preventDefault();pickUser(p)}} onMouseEnter={()=>setHiIdx(i)}
                      style={{padding:"8px 12px",cursor:"pointer",fontSize:11,fontFamily:T.m,
                        background:i===hiIdx?(T._isDark?"rgba(255,255,255,.06)":"rgba(0,0,0,.04)"):"transparent",
                        color:T.tx,borderBottom:i<filtered.length-1?"1px solid "+T.bd:"none",transition:"background .1s"}}>
                      {p.name} <span style={{color:T.mu}}>[{p.role}]</span>
                      {p.title&&<span style={{color:T.dm,marginLeft:6,fontSize:10}}>{p.title}</span>}
                    </div>))}</div>}
            </div></Fl>
          {fetchError&&!users.length&&<div style={{textAlign:"center",padding:"8px 12px",borderRadius:6,
            background:"rgba(251,191,36,.06)",border:"1px solid rgba(251,191,36,.15)"}}>
            <div style={{fontSize:11,color:T.am,fontFamily:T.m,marginBottom:6}}>Could not load users</div>
            <div style={{fontSize:9,color:T.dm,fontFamily:T.m,marginBottom:8}}>{fetchError}</div>
            <Bt sm onClick={()=>{retriesRef.current=0;fetchUsers()}} style={{fontSize:10}}>Retry</Bt></div>}
          <Fl label="Password">
            <input ref={pwRef} type="password" name="password" autoComplete="current-password" value={pin}
              onChange={e=>{setPin(e.target.value);setError("")}}
              placeholder="Enter password"
              style={{width:"100%",padding:"7px 11px",borderRadius:6,background:T.card,border:"1px solid "+T.bd,color:T.tx,
                fontSize:11,fontFamily:T.m,outline:"none",transition:"border .15s"}}/></Fl>
          {error&&<div style={{fontSize:11,color:T.rd,fontFamily:T.m,textAlign:"center",padding:"8px 12px",borderRadius:6,
            background:"rgba(239,68,68,.06)",border:"1px solid rgba(239,68,68,.15)"}}>{error}</div>}
          <Bt v="primary" onClick={attempt} disabled={loading} style={{justifyContent:"center",padding:"11px 0",fontSize:13}}>{loading?"Signing in...":"Sign In"}</Bt>
          <div style={{fontSize:9,color:T.dm,fontFamily:T.m,textAlign:"center"}}>Default password: password</div>
          <div style={{fontSize:8,color:T.dm,fontFamily:T.m,textAlign:"center",opacity:.5,marginTop:4}}>build 2026-02-06e</div>
        </form>
        {signupDomain&&<div style={{marginTop:16,textAlign:"center"}}>
          <div style={{fontSize:10,color:T.dm,fontFamily:T.m,marginBottom:6}}>New to Slate?</div>
          <button onClick={()=>onShowSignup&&onShowSignup()} style={{all:"unset",cursor:"pointer",fontSize:11,fontWeight:600,color:T.bl,fontFamily:T.m}}>Sign up with your @{signupDomain} email</button>
        </div>}
      </div></div>);}

export default LoginScreen;
