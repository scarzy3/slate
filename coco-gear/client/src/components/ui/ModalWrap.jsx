import { T } from '../../theme/theme.js';

function ModalWrap({open,onClose,title,wide,children}){if(!open)return null;return(
  <div style={{position:"fixed",inset:0,zIndex:999,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:T._isDark?"rgba(0,0,0,.72)":"rgba(0,0,0,.35)",backdropFilter:"blur(6px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:wide?"min(95vw,900px)":"min(95vw,530px)",maxHeight:"92vh",
      background:T.panel,border:"1px solid "+T.bdH,borderRadius:14,display:"flex",flexDirection:"column",animation:"mdIn .18s ease-out",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid "+T.bd,gap:8}}>
        <h3 style={{margin:0,fontSize:15,fontWeight:700,fontFamily:T.u,color:T.tx,flex:1,minWidth:0}}>{title}</h3>
        <button onClick={onClose} style={{all:"unset",cursor:"pointer",color:T.mu,fontSize:16,width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:5,background:T.card,flexShrink:0}}>×</button></div>
      <div style={{padding:"16px",overflowY:"auto",flex:1}}>{children}</div></div></div>);}

export default ModalWrap;
