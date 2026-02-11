import { useState } from 'react';
import { T } from '../theme/theme.js';
import ModalWrap from '../components/ui/ModalWrap.jsx';
import QRScanner from '../components/qr/QRScanner.jsx';
import { parseSerialFromQR } from '../components/qr/qrHelpers.js';

function SerialScanBtn({onSerial}){
  const[scanning,setScanning]=useState(false);
  return(<>{scanning&&<ModalWrap open title="Scan Serial QR" onClose={()=>setScanning(false)}>
    <QRScanner onScan={val=>{const serial=parseSerialFromQR(val);if(serial){onSerial(serial);setScanning(false)}}}
      onClose={()=>setScanning(false)}/></ModalWrap>}
    <button onClick={()=>setScanning(true)} title="Scan QR" style={{all:"unset",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
      width:30,height:30,borderRadius:6,background:"rgba(96,165,250,.08)",border:"1px solid rgba(96,165,250,.2)",flexShrink:0}}>
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={T.bl} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2"/>
        <rect x="7" y="7" width="10" height="10" rx="1"/></svg></button></>)}

export default SerialScanBtn;
