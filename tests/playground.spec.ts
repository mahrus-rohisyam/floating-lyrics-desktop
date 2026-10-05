import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async({page},testInfo)=>{if(!testInfo.title.startsWith('first-run tour'))await page.addInitScript(()=>localStorage.setItem('floating:tour:v1','done'));await page.goto('/demo');await page.evaluate(()=>document.fonts.ready);});
test('first-run tour can be skipped, resumed, and completed',async({page})=>{
  const tour=page.getByTestId('tour');
  await expect(tour).toBeVisible();
  await expect(tour.getByRole('heading')).toHaveText('Your lyrics are ready');
  await tour.getByRole('button',{name:'Next'}).click();
  await expect(tour.getByRole('heading')).toHaveText('Play a song');
  await tour.getByRole('button',{name:'Skip tour'}).click();
  await expect(tour).toHaveCount(0);
  await page.reload();
  await expect(tour).toHaveCount(0);
  await page.getByRole('button',{name:'Quick tour'}).click();
  await expect(tour.getByRole('heading')).toHaveText('Your lyrics are ready');
  for(let i=0;i<3;i++)await tour.getByRole('button',{name:'Next'}).click();
  await expect(tour.getByRole('heading')).toHaveText('Stay focused');
  await tour.getByRole('button',{name:'Finish'}).click();
  await expect(tour).toHaveCount(0);
  await expect(page.getByTestId('lyrics-surface')).toHaveClass(/preset-caption/);
});
test('plays real audio, seeks synced lyrics, pauses and stops',async({page})=>{
  await expect(page.getByTestId('active-lyric')).toHaveText('Let the world slow down');
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.getByTestId('playback-time')).not.toHaveText('0:00');
  await page.getByLabel('Seek',{exact:true}).fill('12.5');
  await expect(page.getByTestId('active-lyric')).toHaveText('And everything feels lighter');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const paused=await page.getByTestId('playback-time').textContent();await page.waitForTimeout(650);
  await expect(page.getByTestId('playback-time')).toHaveText(paused!);
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  await expect(page.getByTestId('playback-time')).toHaveText('0:00');
  await expect(page.getByTestId('active-lyric')).toHaveText('Let the world slow down');
});
test('caption is the default, scrolls to the current line, and backgrounds only words',async({page})=>{
  const surface=page.getByTestId('lyrics-surface');
  await expect(surface).toHaveClass(/preset-caption/);
  await expect(surface).toHaveCSS('background-color','rgba(0, 0, 0, 0)');
  const active=page.getByTestId('active-lyric');
  await expect(active.locator('.lyric-text')).toHaveCSS('background-color',/rgba\(8, 18, 13, 0\.76\)/);
  await expect(page.locator('.lyric-line:not(.active)').first()).toHaveCSS('filter',/blur/);
  const before=await active.evaluate(e=>getComputedStyle(e).transform);
  await page.getByLabel('Seek',{exact:true}).fill('12.5');
  await expect(page.getByTestId('active-lyric')).toHaveText('And everything feels lighter');
  await expect.poll(async()=>page.getByTestId('active-lyric').evaluate(e=>getComputedStyle(e).transform)).not.toBe(before);
  await page.getByRole('button',{name:'Minimal',exact:true}).click();
  await expect(page.getByTestId('lyrics-surface')).toHaveClass(/preset-minimal/);
});
test('track selection resets playback and renders non-Latin words',async({page})=>{
  await page.getByRole('button',{name:'Next track'}).click();await expect(page.getByTestId('active-lyric')).toHaveText('Across the sleeping city');
  await page.getByLabel('Try a different mood').selectOption('2');await expect(page.getByTestId('active-lyric')).toHaveText('木漏れ日の中で');
  await page.getByRole('button',{name:'Previous track'}).click();await expect(page.getByTestId('active-lyric')).toHaveText('Across the sleeping city');
});
test('persists custom appearance across reload and recovers presets',async({page})=>{
  await page.getByLabel('Font size',{exact:true}).fill('36');await page.getByLabel('Visible lines').selectOption('2');
  await page.getByRole('button',{name:'Save my preset'}).click();
  await page.getByRole('button',{name:'Card',exact:true}).click();await page.getByRole('button',{name:'Restore',exact:true}).click();
  await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('36');await page.reload();
  await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('36');await expect(page.getByLabel('Visible lines')).toHaveValue('2');
});
test('drag moves overlay and all four corners resize it',async({page})=>{
  await page.getByTestId('desktop-scene').scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Move overlay'})).toHaveCount(0);
  await page.keyboard.press('Alt+Shift+C');
  const overlay=page.getByTestId('overlay');const start=(await overlay.boundingBox())!;
  const grip=(await page.getByRole('button',{name:'Move overlay'}).boundingBox())!;
  await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2+20,grip.y+grip.height/2+20,{steps:5});await page.mouse.up();
  expect((await overlay.boundingBox())!.x).toBeCloseTo(start.x+20,0);
  for(const corner of ['se','sw','ne','nw']){
    const before=(await overlay.boundingBox())!;const handle=(await page.getByRole('button',{name:`Resize ${corner}`}).boundingBox())!;
    await page.mouse.move(handle.x+6,handle.y+6);await page.mouse.down();await page.mouse.move(handle.x+6+(corner.includes('w')?10:-10),handle.y+6+(corner.includes('n')?10:-10),{steps:5});await page.mouse.up();
    const after=(await overlay.boundingBox())!;expect(after.width).toBeLessThan(before.width);expect(after.height).toBeLessThan(before.height);
  }
});
test('customize toolbar styles lyrics and closes again',async({page})=>{
  await page.getByRole('button',{name:'Customize'}).click();const bar=page.getByTestId('config-bar');await expect(bar).toBeVisible();
  await bar.getByRole('button',{name:'Font',exact:true}).click();await bar.getByRole('button',{name:'Serif'}).click();
  await expect(page.getByTestId('lyrics-surface')).toHaveCSS('font-family',/Georgia/);
  const before=await page.locator('#font-size').inputValue();
  const surface=(await page.getByTestId('lyrics-surface').boundingBox())!;await page.mouse.move(surface.x+surface.width/2,surface.y+30);await page.mouse.wheel(0,-100);
  await expect(page.locator('#font-size')).not.toHaveValue(before);
  await bar.getByRole('button',{name:'Show song info'}).click();await expect(page.getByTestId('song-info')).toHaveCount(0);
  await page.keyboard.press('Escape');await expect(bar.getByRole('group',{name:'font options'})).toHaveCount(0);await page.keyboard.press('Escape');await expect(bar).toHaveCount(0);await expect(page.getByRole('button',{name:'Resize se'})).toHaveCount(0);
});
test('hovering the lyrics hides them and lets clicks through',async({page})=>{
  const overlay=page.getByTestId('overlay');await overlay.scrollIntoViewIfNeeded();
  await expect(overlay).toHaveAttribute('data-hidden','false');
  await page.getByTestId('lyrics-surface').hover({force:true});await expect(overlay).toHaveAttribute('data-hidden','true');
  await expect(overlay).toHaveCSS('pointer-events','none');
  const meta=(await page.getByTestId('song-info').boundingBox())!,box=(await overlay.boundingBox())!;
  expect(meta.x+meta.width).toBeGreaterThan(box.x+box.width-30);expect(meta.y+meta.height).toBeGreaterThan(box.y+box.height-40);
});
test('lyrics return to their last spot after the island',async({page})=>{
  await page.getByRole('button',{name:'Behavior',exact:true}).click();await page.getByLabel('Place overlay').selectOption('bottom-right');
  const placed=(await page.getByTestId('overlay').boundingBox())!;
  await page.getByRole('button',{name:'Focus Island'}).click();await expect(page.getByTestId('island')).toBeVisible();
  await page.getByRole('button',{name:'Floating lyrics'}).click();const back=(await page.getByTestId('overlay').boundingBox())!;
  expect(back.x).toBeCloseTo(placed.x,0);expect(back.y).toBeCloseTo(placed.y,0);
});
test('Alt+Shift+F focus mode only peeks on track change',async({page})=>{
  await page.locator('body').click({position:{x:5,y:5}});await page.keyboard.press('Alt+Shift+F');
  const peek=page.getByTestId('focus-peek');await expect(peek).toHaveAttribute('data-shown','true');
  await expect(peek).toHaveAttribute('data-shown','false',{timeout:6000});
  await page.getByRole('button',{name:'Next track'}).click();await expect(peek).toHaveAttribute('data-shown','true');await expect(peek).toContainText('Blue Hour');
  await page.keyboard.press('Alt+Shift+F');await expect(peek).toHaveCount(0);await expect(page.getByTestId('lyrics-surface')).toBeVisible();
});
test('Island expands on intent, renders spectrum from audio, and collapses after leaving',async({page})=>{
  await page.getByRole('button',{name:'Focus Island'}).click();const island=page.getByTestId('island');
  await expect(island).toHaveAttribute('data-expanded','false');
  const compact=(await island.boundingBox())!;
  await island.hover();await expect(island).toHaveAttribute('data-expanded','true');
  const open=(await island.boundingBox())!;
  expect(open.x+open.width/2).toBeCloseTo(compact.x+compact.width/2,0);
  expect(open.y).toBeCloseTo(compact.y,0);
  await expect(page.getByRole('button',{name:'Move overlay'})).toHaveCount(0);
  await island.getByRole('button',{name:'Play',exact:true}).click();
  if(await page.evaluate(()=>typeof AudioContext==='function')){
    await expect.poll(async()=>island.getByTestId('spectrum').locator('span').evaluateAll(nodes=>nodes.some(n=>parseFloat((n as HTMLElement).style.height)>5))).toBe(true);
  }else{
    await expect(page.getByText('Audio visualization is unavailable in this browser. Playback and lyrics still work.')).toBeVisible();
    await expect(page.getByTestId('playback-time')).not.toHaveText('0:00');
  }
  await page.mouse.move(5,5);await expect(island).toHaveAttribute('data-expanded','false',{timeout:4000});
  await island.hover();await island.getByRole('button',{name:'Pause',exact:true}).click();
  await expect(island.getByTestId('spectrum')).toHaveAttribute('data-active','false');
});
test('Island remains open during keyboard interaction and Escape collapses',async({page})=>{
  await page.getByRole('button',{name:'Focus Island'}).click();await page.mouse.move(5,5);
  await page.getByRole('button',{name:'Expand Focus Island'}).focus();const island=page.getByTestId('island');await expect(island).toHaveAttribute('data-expanded','true');
  await page.keyboard.press('Tab');await page.waitForTimeout(2300);await expect(island).toHaveAttribute('data-expanded','true');
  await page.keyboard.press('Escape');await expect(island).toHaveAttribute('data-expanded','false');
});
test('imports local LRC safely and applies per-track timing offset',async({page})=>{
  await page.getByRole('button',{name:'Behavior',exact:true}).click();
  await page.getByLabel('Import lyrics',{exact:true}).setInputFiles({name:'example.lrc',mimeType:'text/plain',buffer:Buffer.from('[00:00]First\n[00:02]<script>not code</script>')});
  await expect(page.getByTestId('active-lyric')).toHaveText('First');await page.getByLabel('Lyric timing offset').fill('2000');
  await expect(page.getByTestId('active-lyric')).toHaveText('<script>not code</script>');
  await page.getByLabel('Try a different mood').selectOption('1');await expect(page.getByLabel('Lyric timing offset')).toHaveValue('0');
  await page.getByLabel('Try a different mood').selectOption('0');await expect(page.getByLabel('Lyric timing offset')).toHaveValue('2000');
});
test('shows an actionable audio error and recovers on another sample',async({page})=>{
  await page.route('**/samples/blue-hour.wav',route=>route.abort());await page.getByLabel('Try a different mood').selectOption('1');
  await expect(page.getByRole('alert')).toContainText('Audio could not load',{timeout:12000});await page.getByLabel('Try a different mood').selectOption('2');await expect(page.getByRole('alert')).toHaveCount(0);
});
test('corrupt preferences do not break startup',async({page})=>{
  await page.evaluate(()=>localStorage.setItem('floating:settings:v1','{broken'));await page.reload();await expect(page.getByLabel('Font size',{exact:true})).toHaveValue('28');
});
test('works without persistent storage',async({page})=>{
  await page.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Disabled','SecurityError');};});await page.reload();
  await expect(page.getByText('Session only',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Play',exact:true}).click();await expect(page.getByTestId('playback-time')).not.toHaveText('0:00');
});
test('download route, help dialog, mobile layout and reduced motion',async({page})=>{
  await page.goto('/download');await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.getByRole('button',{name:'Demo help'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByRole('button',{name:'Focus Island'}).click();await page.getByRole('button',{name:'Expand Focus Island'}).click();await expect(page.getByTestId('island')).toHaveAttribute('data-expanded','true');
  const island=(await page.getByTestId('island').boundingBox())!;expect(island.x).toBeGreaterThanOrEqual(0);expect(island.x+island.width).toBeLessThanOrEqual(375);
  await expect(page.getByRole('button',{name:'Build not available yet'}).first()).toBeDisabled();
  await page.screenshot({path:'test-results/mobile.png',fullPage:true});
});
test('no serious accessibility violations on default layout',async({page})=>{
  const results=await new AxeBuilder({page}).analyze();expect(results.violations.filter(v=>['critical','serious'].includes(v.impact||''))).toEqual([]);
  await page.screenshot({path:'test-results/desktop.png',fullPage:true});
});
