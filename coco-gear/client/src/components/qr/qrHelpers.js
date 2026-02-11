import QRCodeLib from 'qrcode';

const QR={generate(text){try{const code=QRCodeLib.create(text,{errorCorrectionLevel:'M'});
  const n=code.modules.size,d=code.modules.data,mt=[];
  for(let r=0;r<n;r++){const row=[];for(let c=0;c<n;c++)row.push(d[r*n+c]?1:0);mt.push(row)}return mt}catch(e){return null}}};
const qrBase=()=>window.location.origin;
const qrKitData=id=>qrBase()+"/s/kit/"+id;
const qrAssetData=id=>qrBase()+"/s/asset/"+id;
const qrSerialData=(kitId,compKey,serial)=>qrBase()+"/s/verify/"+kitId.slice(0,8)+"/"+encodeURIComponent(compKey)+"/"+encodeURIComponent(serial);
const parseQR=val=>{if(!val)return null;const s=val.trim();
  /* URL-based QR codes (scannable from iPhone camera) */
  try{const u=new URL(s);const p=u.pathname;
    if(p.startsWith("/s/kit/"))return{type:"kit",id:p.slice(7)};
    if(p.startsWith("/s/asset/"))return{type:"asset",id:p.slice(9)};
    if(p.startsWith("/s/verify/")){const parts=p.slice(10).split("/").map(decodeURIComponent);return{type:"serial",parts}}
  }catch(e){}
  /* Legacy plain-text formats */
  if(s.startsWith("kit:"))return{type:"kit",id:s.slice(4)};
  if(s.startsWith("asset:"))return{type:"asset",id:s.slice(6)};
  if(s.startsWith("ser:"))return{type:"serial",parts:s.slice(4).split(":")};
  return{type:"text",value:s}};
const parseSerialFromQR=val=>{if(!val)return null;const s=val.trim();
  try{const u=new URL(s);if(u.pathname.startsWith("/s/verify/")){const parts=u.pathname.slice(10).split("/").map(decodeURIComponent);return parts[2]||null}}catch(e){}
  if(s.startsWith("ser:")){const parts=s.slice(4).split(":");return parts[2]||null}
  return s};

export { QR, qrBase, qrKitData, qrAssetData, qrSerialData, parseQR, parseSerialFromQR };
