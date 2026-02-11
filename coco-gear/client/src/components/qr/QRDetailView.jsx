import { T } from '../../theme/theme.js';
import Bt from '../ui/Bt.jsx';
import QRSvg from './QRSvg.jsx';
import { qrSerialData } from './qrHelpers.js';

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

export default QRDetailView;
