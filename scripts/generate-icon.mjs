import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const crc32=(bytes)=>{let crc=0xffffffff;for(const b of bytes){crc^=b;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
const chunk=(type,body)=>{const kind=Buffer.from(type);const head=Buffer.alloc(4);head.writeUInt32BE(body.length);const tail=Buffer.alloc(4);tail.writeUInt32BE(crc32(Buffer.concat([kind,body])));return Buffer.concat([head,kind,body,tail]);};
const size=128,raw=Buffer.alloc((size*4+1)*size);
for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const column=Math.floor((x-28)/20),height=[34,64,84,48][column];
  const bar=x>=28&&x<100&&(x-28)%20<10&&Math.abs(y-64)<height/2;
  raw.set(bar?[208,237,172,255]:[38,59,48,255],y*(size*4+1)+1+x*4);
}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;
mkdirSync('src-tauri/icons',{recursive:true});
writeFileSync('src-tauri/icons/icon.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
