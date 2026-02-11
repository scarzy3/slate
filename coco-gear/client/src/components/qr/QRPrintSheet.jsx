import { T } from '../../theme/theme.js';
import Bt from '../ui/Bt.jsx';
import QRSvg from './QRSvg.jsx';

function QRPrintSheet({items,onClose}){
  return(<div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <div style={{fontSize:12,color:T.mu,fontFamily:T.m}}>{items.length} QR codes</div>
      <div style={{display:"flex",gap:8}}>
        <Bt v="primary" onClick={()=>window.print()}>Print</Bt>
        <Bt onClick={onClose}>Close</Bt></div></div>
    <style>{`@media print{body>*{visibility:hidden}#qr-print-sheet,#qr-print-sheet *{visibility:visible}
      #qr-print-sheet{position:fixed;top:0;left:0;width:100%;background:#fff;padding:12px;z-index:9999}}`}</style>
    <div id="qr-print-sheet" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:12,padding:8}}>
      {items.map(item=><div key={item.id} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,
        padding:12,border:"1px solid #ddd",borderRadius:6,background:"#fff",pageBreakInside:"avoid"}}>
        <QRSvg data={item.qrData} size={120}/>
        <div style={{fontSize:12,fontWeight:700,color:"#111",fontFamily:"sans-serif",textAlign:"center"}}>{item.label}</div>
        <div style={{fontSize:9,color:"#666",fontFamily:"monospace",textAlign:"center"}}>{item.sub}</div></div>)}</div></div>);}

export default QRPrintSheet;
