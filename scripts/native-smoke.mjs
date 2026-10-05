// Connect only to a test build explicitly launched with WebView2 CDP on port 9223.
import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.connectOverCDP('http://127.0.0.1:9223');
const context=browser.contexts()[0];
await expect.poll(()=>context.pages().some(p=>p.url().startsWith('http://tauri.localhost/')&&!p.url().includes('overlay')),{timeout:15000}).toBe(true);
const main=context.pages().find(p=>p.url().startsWith('http://tauri.localhost/')&&!p.url().includes('overlay'));
assert(main,'Main native window must be running');
const invoke=(command,args={})=>main.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const saved=await main.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
const results=[];let timer;
const record=name=>{results.push(name);console.log(`PASS ${name}`);};
try {
  await expect.poll(()=>context.pages().some(p=>p.url().includes('overlay')),{timeout:15000}).toBe(true);
  const startupOverlay=context.pages().find(p=>p.url().includes('overlay'));
  await expect(startupOverlay.getByTestId('lyrics-surface')).toHaveClass(/preset-caption/);
  const skipTour=main.getByRole('button',{name:'Skip tour'});if(await skipTour.isVisible())await skipTour.click();
  await expect(main.locator('.studio-header')).toBeVisible();
  await expect(main.locator('.native-controls')).toHaveCount(0);
  await main.getByRole('button',{name:'Behavior',exact:true}).click();
  await main.getByText('Playback & connections').click();
  await expect(main.getByRole('checkbox',{name:'Open overlay at startup'})).toBeChecked();
  record('Desktop opens the Caption overlay automatically at startup');
  const pairing=await invoke('browser_pairing');assert.equal(pairing.error,null);
  const request=(path,body,extra={})=>fetch(pairing.endpoint+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${pairing.token}`,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined});
  assert.equal((await fetch(pairing.endpoint+'/commands?id=browser:e2e')).status,401);
  assert.equal((await request('/commands?id=browser:e2e',undefined,{Origin:'https://example.com'})).status,403);
  record('Loopback bridge rejects missing token and website origin');
  const session={id:'browser:e2e',title:'Native E2E fixture',artist:'Local test',album:'',artwork:'',duration:32,position:6,playing:false,canPlay:true,canPause:true,canNext:true,canPrevious:true,canStop:false};
  const heartbeat=()=>request('/session',session);await heartbeat();timer=setInterval(()=>void heartbeat(),500);
  await expect.poll(async()=> (await invoke('media_sessions')).some(s=>s.id===session.id)).toBe(true);
  await main.getByLabel(/^Playback source/).selectOption('desktop');
  await main.getByLabel(/^Player /).selectOption(session.id);
  await main.getByRole('button',{name:'Floating lyrics',exact:true}).click();
  await main.getByRole('button',{name:'Appearance',exact:true}).click();
  await main.getByRole('button',{name:'Caption',exact:true}).click();
  await expect(main.locator('.player-track strong')).toHaveText(session.title);
  record('Native IPC discovers the authenticated companion session');
  const acknowledger=setInterval(async()=>{
    for(const command of await (await request('/commands?id=browser:e2e')).json()){
      assert.equal(command.title,session.title);session.playing=command.action==='play';
      await request('/result',{requestId:command.requestId,accepted:true});await heartbeat();
    }
  },100);
  try {
    await main.getByRole('button',{name:'Play',exact:true}).click();
    await expect(main.getByRole('button',{name:'Pause',exact:true})).toBeVisible();
    await main.getByRole('button',{name:'Pause',exact:true}).click();
    await expect(main.getByRole('button',{name:'Play',exact:true})).toBeVisible();
  } finally {clearInterval(acknowledger);}
  assert.equal(await invoke('media_command',{id:session.id,title:'Stale title',action:'next'}),false);
  assert.equal(await invoke('media_command',{id:session.id,title:session.title,action:'stop'}),false);
  record('UI playback receives actual bridge acknowledgements; stale title and unsupported stop rejected');
  await main.getByRole('button',{name:'Behavior',exact:true}).click();
  await main.getByLabel('Import lyrics',{exact:true}).setInputFiles({name:'native.lrc',mimeType:'text/plain',buffer:Buffer.from('[00:00.00]First test line\n[00:05.00]Native synchronized line')});
  await expect(main.getByTestId('active-lyric')).toHaveText('Native synchronized line');
  await main.getByRole('button',{name:'Show overlay'}).click();
  await expect.poll(()=>context.pages().some(p=>p.url().includes('overlay'))).toBe(true);
  const overlay=context.pages().find(p=>p.url().includes('overlay'));
  await expect(overlay.getByTestId('active-lyric')).toHaveText('Native synchronized line');
  await expect(overlay.getByTestId('song-info')).toContainText(session.title);
  assert.equal(await overlay.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgba(0, 0, 0, 0)');
  await expect(overlay.getByTestId('lyrics-surface')).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  record('Separate native overlay shares selected player and imported lyrics');
  await main.getByRole('button',{name:'Focus Island'}).click();
  await expect(overlay.getByTestId('island')).toBeVisible();
  await overlay.mouse.move(170,50);await overlay.getByTestId('island').hover();
  await expect(overlay.getByTestId('island')).toHaveAttribute('data-expanded','true');
  await expect(overlay.getByText(session.title,{exact:true})).toBeVisible();
  await expect(overlay.getByRole('button',{name:'Stop unavailable for this player'})).toBeDisabled();
  await mkdir('artifacts',{recursive:true});await overlay.screenshot({path:'artifacts/native-island.png'});
  record('Native Island expands, displays title and honors player capabilities');
  clearInterval(timer);timer=undefined;
  await expect.poll(async()=> (await invoke('media_sessions')).some(s=>s.id===session.id),{timeout:8000}).toBe(false);
  await expect(main.locator('.player-track strong')).toHaveText('Waiting for music');
  record('Disconnected companion expires instead of leaving a stale session');
  await writeFile('artifacts/native-test-results.json',JSON.stringify({date:new Date().toISOString(),platform:process.platform,results},null,2));
} finally {
  clearInterval(timer);
  await main.evaluate(saved=>{localStorage.clear();for(const [k,v] of Object.entries(saved)){if(k.includes('browser:e2e'))continue;localStorage.setItem(k,k==='floating:player'&&v==='browser:e2e'?'':v);}},saved);
  await main.reload();
  await browser.close();
}
