// Original procedural music and artwork. No third-party samples or lyrics.
import { mkdirSync, writeFileSync } from 'node:fs';
mkdirSync('public/samples', { recursive: true });
const rate = 16000, seconds = 32;
const tracks = [ ['afterglow', [130.81,164.81,196,261.63], '#294137', '#d6b76c'], ['blue-hour',[110,130.81,164.81,220], '#1b3048','#9cbfd3'], ['komorebi',[146.83,174.61,220,293.66],'#4c362c','#ebb678'] ];
for (const [name, notes, dark, light] of tracks) {
  const data = Buffer.alloc(44 + rate * seconds * 2);
  data.write('RIFF'); data.writeUInt32LE(data.length-8,4); data.write('WAVEfmt ',8);
  data.writeUInt32LE(16,16); data.writeUInt16LE(1,20); data.writeUInt16LE(1,22); data.writeUInt32LE(rate,24);
  data.writeUInt32LE(rate*2,28); data.writeUInt16LE(2,32); data.writeUInt16LE(16,34); data.write('data',36); data.writeUInt32LE(data.length-44,40);
  for(let i=0; i<rate*seconds; i++) {
    const t=i/rate, beat=t%0.5, section=Math.floor(t/4)%4;
    const fade=Math.min(1,t/1.5,(seconds-t)/2);
    const chord=notes.reduce((v,n,j)=>v+Math.sin(t*n*Math.PI*2*(section===2?1.125:1)+Math.sin(t*.6+j)*.18),0)*.047;
    const pluck=Math.sin(t*notes[Math.floor(t*2)%4]*4*Math.PI)*Math.exp(-beat*11)*.13;
    const kick=Math.sin(2*Math.PI*(46*beat+5*(1-Math.exp(-beat*30))))*Math.exp(-beat*19)*.12;
    data.writeInt16LE(Math.round((chord+pluck+kick)*fade*30000),44+i*2);
  }
  writeFileSync(`public/samples/${name}.wav`,data);
  writeFileSync(`public/samples/${name}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="${light}"/></linearGradient><radialGradient id="s"><stop stop-color="${light}"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient></defs><rect width="400" height="400" fill="url(#b)"/><circle cx="260" cy="118" r="110" fill="url(#s)"/><path d="M-30 340Q95 40 210 300T450 155V440H-30" fill="${dark}" opacity=".6"/><path d="M-40 350Q145 160 270 365T450 275V410H-40" fill="${dark}"/><circle cx="265" cy="113" r="32" fill="${light}" opacity=".8"/><text x="28" y="365" fill="#fff" opacity=".8" font-family="sans-serif" font-size="14" letter-spacing="4">${name.toUpperCase()}</text></svg>`);
}
console.log('Generated 3 original 32-second PCM soundscapes and SVG covers.');
