import { T } from '../theme/theme.js';
import { fmtDate } from '../theme/helpers.js';
import { Sw, Bt } from './ui/index.js';

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
          <button onClick={()=>onToggleFav(k.id)} style={{all:"unset",cursor:"pointer",fontSize:14,color:T.am}}>{"\u2605"}</button></div>)}</div></div>}
    {myKits.length===0&&favKits.length===0&&<div style={{padding:20,textAlign:"center",color:T.dm,fontFamily:T.m,fontSize:11}}>
      No kits checked out. Star favorites from inventory for quick access.</div>}</div>);}

export default QuickActions;
