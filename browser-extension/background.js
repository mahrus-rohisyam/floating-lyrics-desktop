chrome.runtime.onMessage.addListener((message,sender,reply)=>{
  if(!sender.tab || !sender.url?.startsWith('https://music.youtube.com/'))return;
  (async()=>{
    const {token,endpoint:storedEndpoint}=await chrome.storage.local.get(['token','endpoint']);if(!/^[a-f0-9]{64}$/.test(token||''))throw Error('Pair the desktop app first.');
    const endpoint=/^http:\/\/127\.0\.0\.1:49\d{3}$/.test(storedEndpoint||'')?storedEndpoint:'http://127.0.0.1:49271';
    const headers={'Authorization':`Bearer ${token}`,'Content-Type':'application/json'};
    const request=async(path,body)=>{const r=await fetch(endpoint+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(2500)});if(!r.ok)throw Error(`Connection: ${r.status}`);return r.json();};
    if(message.type==='snapshot') {
      const id=`browser:${sender.tab.id}`;
      await request('/session',{...message.session,id});
      reply({commands:await request(`/commands?id=${id}`)});
    }else if(message.type==='result'){await request('/result',message.result);reply({ok:true});}
  })().catch(e=>reply({error:String(e)}));
  return true;
});
