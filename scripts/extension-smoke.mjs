// Real unpacked extension + real Rust loopback bridge; local YouTube Music DOM fixture.
// This verifies the integration contract, not the live service's current selectors.
import { chromium, expect } from '@playwright/test';
import { resolve, dirname } from 'node:path';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const native=await chromium.connectOverCDP('http://127.0.0.1:9223');
const main=native.contexts()[0].pages().find(p=>p.url().startsWith('http://tauri.localhost/')&&!p.url().includes('overlay'));
const invoke=(command,args={})=>main.evaluate(({command,args})=>window.__TAURI_INTERNALS__.invoke(command,args),{command,args});
const profile=await mkdtemp(resolve(tmpdir(),'floating-extension-'));
const extensionPath=resolve('browser-extension');
let context;const passed=[];
const record=name=>{passed.push(name);console.log(`PASS ${name}`);};
try {
  context=await chromium.launchPersistentContext(profile,{channel:'chromium',headless:true,args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`]});
  const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
  const {token,error}=await invoke('browser_pairing');assert.equal(error,null);
  await worker.evaluate(token=>chrome.storage.local.set({token}),token);
  const page=await context.newPage();
  await page.route('https://music.youtube.com/**',async route=>{
    if(route.request().url().endsWith('/fixture.wav'))return route.fulfill({path:resolve('public/samples/afterglow.wav'),contentType:'audio/wav'});
    return route.fulfill({contentType:'text/html',body:`<!doctype html><html><body><ytmusic-player-bar><span class="title">Extension E2E fixture</span><div class="byline"><a>Local test artist</a></div><button class="next-button" onclick="document.querySelector('.title').textContent='Next fixture'">Next</button><button class="previous-button" onclick="document.querySelector('.title').textContent='Extension E2E fixture'">Previous</button></ytmusic-player-bar><video src="/fixture.wav" preload="auto" controls></video></body></html>`});
  });
  await page.goto('https://music.youtube.com/');
  await expect.poll(()=>page.locator('video').evaluate(v=>v.readyState)).toBeGreaterThanOrEqual(2);
  let session;
  await expect.poll(async()=>{session=(await invoke('media_sessions')).find(s=>s.title==='Extension E2E fixture');return !!session;},{timeout:10000}).toBe(true);
  assert.equal(session.artist,'Local test artist');assert.equal(session.canStop,false);
  record('Unpacked extension publishes real media duration and metadata through authenticated bridge');
  await page.locator('video').click(); // User activation for media playback.
  await page.locator('video').evaluate(v=>v.pause());
  assert.equal(await invoke('media_command',{id:session.id,title:session.title,action:'play'}),true);
  await expect.poll(()=>page.locator('video').evaluate(v=>v.currentTime)).toBeGreaterThan(0);
  record('Native play command crosses extension worker and content script to media element');
  await main.evaluate(async()=>{
    window.testBands=[];window.testSpectrumError='';const api=window.__TAURI_INTERNALS__;
    await api.invoke('plugin:event|listen',{event:'spectrum:bands',target:{kind:'Any'},handler:api.transformCallback(e=>window.testBands.push(e.payload))});
    await api.invoke('plugin:event|listen',{event:'spectrum:error',target:{kind:'Any'},handler:api.transformCallback(e=>window.testSpectrumError=e.payload)});
  });
  await invoke('set_spectrum_enabled',{enabled:true});
  await expect.poll(()=>main.evaluate(()=>({error:window.testSpectrumError,active:window.testBands.some(b=>b.some(v=>v>0.01))})),{timeout:8000}).toEqual({error:'',active:true});
  await invoke('set_spectrum_enabled',{enabled:false});
  record('Windows WASAPI loopback produces nonzero FFT bands during playback');
  assert.equal(await invoke('media_command',{id:session.id,title:session.title,action:'pause'}),true);
  await expect.poll(()=>page.locator('video').evaluate(v=>v.paused)).toBe(true);
  assert.equal(await invoke('media_command',{id:session.id,title:session.title,action:'next'}),true);
  await expect(page.locator('.title')).toHaveText('Next fixture');
  await expect.poll(async()=> (await invoke('media_sessions')).some(s=>s.id===session.id&&s.title==='Next fixture')).toBe(true);
  assert.equal(await invoke('media_command',{id:session.id,title:'Next fixture',action:'previous'}),true);
  await expect(page.locator('.title')).toHaveText(session.title);
  record('Pause, next and previous complete with acknowledgements and refreshed metadata');
  await context.close();context=undefined;
  await expect.poll(async()=> (await invoke('media_sessions')).some(s=>s.id===session.id),{timeout:8000}).toBe(false);
  record('Closing browser removes expired extension session');
  await writeFile('artifacts/extension-test-results.json',JSON.stringify({date:new Date().toISOString(),fixture:true,results:passed},null,2));
} finally {
  await invoke('set_spectrum_enabled',{enabled:false}).catch(()=>{});
  await context?.close();await native.close();assert.equal(dirname(profile),resolve(tmpdir()));await rm(profile,{recursive:true,force:true});
}
