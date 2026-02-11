import { T } from '../../theme/theme.js';
import Bt from './Bt.jsx';

function ConfirmDialog({open,onClose,onConfirm,title,message,confirmLabel="Delete",confirmColor=T.rd}){
  if(!open)return null;
  return(<div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
    <div style={{position:"absolute",inset:0,background:T._isDark?"rgba(0,0,0,.8)":"rgba(0,0,0,.4)",backdropFilter:"blur(4px)"}}/>
    <div onClick={e=>e.stopPropagation()} style={{position:"relative",width:"min(400px,90vw)",background:T.panel,border:"1px solid "+T.bdH,
      borderRadius:12,padding:24,animation:"mdIn .15s ease-out"}}>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
        <div style={{width:40,height:40,borderRadius:20,background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:T.rd}}>⚠</div>
        <div style={{flex:1}}><div style={{fontSize:16,fontWeight:700,color:T.tx,fontFamily:T.u}}>{title}</div></div></div>
      <div style={{fontSize:12,color:T.mu,fontFamily:T.m,marginBottom:20,lineHeight:1.5}}>{message}</div>
      <div style={{display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <Bt onClick={onClose}>Cancel</Bt>
        <Bt v="danger" onClick={()=>{onConfirm();onClose()}}>{confirmLabel}</Bt></div></div></div>);}

export default ConfirmDialog;
