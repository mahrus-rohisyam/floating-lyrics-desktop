// Only reads the music.youtube.com player; no page history or other sites.
let polling=false;
const read=()=>{
  const video=document.querySelector('video');const bar=document.querySelector('ytmusic-player-bar');
  if(!video||!bar||!Number.isFinite(video.duration))return null;
  return {title:bar.querySelector('.title')?.textContent?.trim()||'',artist:bar.querySelector('.byline a')?.textContent?.trim()||'',album:'',artwork:bar.querySelector('img')?.src||'',duration:video.duration,position:video.currentTime,playing:!video.paused,
    canPlay:true,canPause:true,canNext:!!bar.querySelector('.next-button'),canPrevious:!!bar.querySelector('.previous-button'),canStop:false};
};
setInterval(async()=>{
  if(polling)return;const session=read();if(!session?.title)return;polling=true;
  try{
    const result=await chrome.runtime.sendMessage({type:'snapshot',session});
    for(const command of result?.commands||[]){
      let accepted=false;const current=read();const video=document.querySelector('video');
      if(current?.title===command.title&&video){
        try{switch(command.action){
          case 'play':await video.play();accepted=true;break;
          case 'pause':video.pause();accepted=true;break;
          case 'next':{const b=document.querySelector('ytmusic-player-bar .next-button');if(b){b.click();accepted=true;}break;}
          case 'previous':{const b=document.querySelector('ytmusic-player-bar .previous-button');if(b){b.click();accepted=true;}break;}
        }}catch{/* player rejected operation */}
      }
      await chrome.runtime.sendMessage({type:'result',result:{requestId:command.requestId,accepted}});
    }
  }catch{/* disconnected; retry on next heartbeat */}finally{polling=false;}
},800);
