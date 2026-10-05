import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { ALargeSmall, ArrowDownToLine, ArrowLeft, ArrowRight, AudioLines, Check, CircleHelp, Focus, Grip, Headphones, Maximize2, Monitor, Moon, Mouse, Music, Music2, Pause, Pipette, Play, RotateCcw, Settings as SettingsIcon, SkipBack, SkipForward, SlidersHorizontal, Square, Sun, TextAlignCenter, TextAlignEnd, TextAlignJustify, TextAlignStart, Type, Upload, Volume2, Waves, X } from 'lucide-react';
import { activeLine, clamp, constrainBounds, defaults, fonts, formatTime, parseLrc, readSettings, resizeBounds, type Bounds, type Font, type LyricLine, type Settings } from './core';
import { samples } from './samples';
import { useAudio } from './useAudio';
import { native, openOverlay, browserPairing, showSettings } from './native';
import { useNativePlayer } from './useNativePlayer';
import { useSpectrum } from './useSpectrum';
import { listen } from '@tauri-apps/api/event';
import { Tour, tourKey } from './Tour';

const storageKey='floating:settings:v1';
const params=new URLSearchParams(location.search);
const overlayWindow = native && params.has('overlay');
let autoOverlayAttempted = false;
/** Set when a global shortcut had to create the overlay window first. */
const startAction = overlayWindow ? params.get('start') : null;
type Player = { title:string; artist:string; album:string; artwork:string; playing:boolean; position:number; duration:number; bands:number[]; pending:boolean;
  canPlay:boolean; canPause:boolean; canNext:boolean; canPrevious:boolean; canStop:boolean;
  toggle:()=>void; next:()=>void; previous:()=>void; stop:()=>void; seek:(v:number)=>void };
function IconButton({label,children,onClick,disabled=false,className=''}:{label:string;children:ReactNode;onClick:()=>void;disabled?:boolean;className?:string}) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>{children}</button>;
}
function Transport({player,compact=false}:{player:Player;compact?:boolean}) {
  return <div className={`transport ${compact?'small':''}`}>
    <IconButton label="Previous track" onClick={player.previous} disabled={!player.canPrevious||player.pending}><SkipBack size={18}/></IconButton>
    <IconButton label={player.playing?'Pause':'Play'} onClick={player.toggle} disabled={player.pending||!(player.playing?player.canPause:player.canPlay)} className="play-button">{player.playing?<Pause size={19} fill="currentColor"/>:<Play size={19} fill="currentColor"/>}</IconButton>
    <IconButton label="Next track" onClick={player.next} disabled={!player.canNext||player.pending}><SkipForward size={18}/></IconButton>
    <IconButton label={player.canStop?'Stop':'Stop unavailable for this player'} onClick={player.stop} disabled={!player.canStop||player.pending}><Square size={15}/></IconButton>
  </div>;
}
function Spectrum({bands,playing,reduced}:{bands:number[];playing:boolean;reduced:boolean}) {
  return <div className="spectrum" data-testid="spectrum" data-active={playing&&!reduced} aria-hidden="true">{bands.map((v,i)=><span key={i} style={{height:`${playing&&!reduced?4+Math.min(1,v*3.2)*24:4}px`}}/>)}</div>;
}
const ease='cubic-bezier(.16,1,.3,1)';
function LyricStream({lyrics,index,lines,align,reduced}:{lyrics:LyricLine[];index:number;lines:number;align:Settings['align'];reduced:boolean}) {
  const viewport=useRef<HTMLDivElement>(null), track=useRef<HTMLDivElement>(null);
  const [shift,setShift]=useState(0), [ready,setReady]=useState(false);
  const anchor=Math.max(0,index);
  const measure=useCallback(()=>{
    const view=viewport.current, items=track.current?.children as HTMLCollectionOf<HTMLElement>|undefined;
    const current=items?.[anchor];if(!view||!current)return;
    // Two-line mode centers the pair (current + next); otherwise the current line sits in the middle.
    const next=lines===2?items![anchor+1]:undefined;
    const center=next?(current.offsetTop+next.offsetTop+next.offsetHeight)/2:current.offsetTop+current.offsetHeight/2;
    setShift(view.clientHeight/2-center);
  },[anchor,lines]);
  useLayoutEffect(measure,[measure,lyrics]);
  useEffect(()=>{
    const observer=new ResizeObserver(measure);
    if(viewport.current)observer.observe(viewport.current);if(track.current)observer.observe(track.current);
    return()=>observer.disconnect();
  },[measure]);
  // Skip the entrance animation so the first paint is already in place.
  useEffect(()=>{const frame=requestAnimationFrame(()=>setReady(true));return()=>cancelAnimationFrame(frame);},[]);
  const origin=align==='left'?'left center':align==='right'?'right center':'center';
  const animate=ready&&!reduced;
  return <div className="lyric-viewport" ref={viewport}>
    <div className="lyric-track" ref={track}>{lyrics.map((line,i)=>{
      const d=i-anchor, active=i===index;
      const visible=lines===1?d===0:lines===2?d===0||d===1:Math.abs(d)<=1;
      const blur=active?0:visible?.8:3;
      return <div key={i} className={`lyric-line ${active?'active':''}`} data-testid={active?'active-lyric':undefined} aria-hidden={!visible||undefined}
        style={{transform:`translate3d(0,${shift}px,0) scale(${active?1:.92})`,transformOrigin:origin,opacity:active?1:visible?.58:0,filter:blur?`blur(${blur}px)`:'none',
          transitionProperty:animate?'transform,opacity,filter':'none',transitionDuration:'.82s,.64s,.64s',transitionTimingFunction:ease,
          transitionDelay:animate&&d>0?`${Math.min(d,5)*35}ms`:'0ms'}}><span className="lyric-text">{line.text||' '}</span></div>;
    })}</div>
  </div>;
}
function SongInfo({player}:{player:Player}) {
  return <div className="lyric-meta" data-testid="song-info">
    <div><strong title={player.title}>{player.title}</strong><span>{player.artist}{player.album&&<em> · {player.album}</em>}</span></div>
    <img src={player.artwork} alt=""/>
  </div>;
}
const swatches=['#f4f8ed','#ffffff','#d0f292','#f2d2a0','#a8d3ee','#f4a8c4'];
type Panel='color'|'font'|'size'|'layout'|null;
function ConfigBar({settings,setSettings,onDone,onIsland,onMore}:{settings:Settings;setSettings:(v:Settings|((s:Settings)=>Settings))=>void;onDone:()=>void;onIsland:()=>void;onMore:()=>void}) {
  const [panel,setPanel]=useState<Panel>(null);
  const set=<K extends keyof Settings>(key:K,value:Settings[K])=>setSettings(s=>({...s,[key]:value}));
  const tool=(id:Exclude<Panel,null>,label:string,icon:ReactNode)=><button type="button" className="config-tool" aria-label={label} title={label} aria-expanded={panel===id} onClick={()=>setPanel(p=>p===id?null:id)}>{icon}</button>;
  return <div className="config-layer" data-testid="config-bar" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==='Escape'&&panel){e.stopPropagation();setPanel(null);}}}>
    <button type="button" className="config-note" aria-label="Show song info" aria-pressed={settings.songInfo} title="Show song info" onClick={()=>set('songInfo',!settings.songInfo)}><Music size={16}/></button>
    {panel&&<div className="config-panel" role="group" aria-label={`${panel} options`}>
      {panel==='color'&&<div className="config-swatches">{swatches.map(c=><button key={c} type="button" aria-label={`Color ${c}`} aria-pressed={settings.color===c} style={{background:c}} onClick={()=>set('color',c)}/>)}<label className="config-custom" title="Custom color"><Pipette size={13}/><input aria-label="Custom lyric color" type="color" value={settings.color} onChange={e=>set('color',e.target.value)}/></label></div>}
      {panel==='font'&&<div className="config-list">{(Object.keys(fonts) as Font[]).map(f=><button key={f} type="button" aria-pressed={settings.font===f} style={{fontFamily:fonts[f][1]}} onClick={()=>set('font',f)}>{fonts[f][0]}</button>)}</div>}
      {panel==='size'&&<div className="config-stack"><label>Size <output>{settings.fontSize}px</output><input aria-label="Lyric font size" type="range" min="16" max="64" value={settings.fontSize} onChange={e=>set('fontSize',Number(e.target.value))}/></label>
        <div className="config-segments" role="group" aria-label="Font weight">{[[400,'Regular'],[500,'Medium'],[600,'Semibold'],[700,'Bold']].map(([w,l])=><button key={w} type="button" aria-pressed={settings.weight===w} onClick={()=>set('weight',w as number)}>{l}</button>)}</div></div>}
      {panel==='layout'&&<div className="config-stack">
        <div className="config-segments" role="group" aria-label="Visible lines">{[1,2,3].map(n=><button key={n} type="button" aria-pressed={settings.lines===n} onClick={()=>set('lines',n)}>{n} line{n>1?'s':''}</button>)}</div>
        <div className="config-segments" role="group" aria-label="Alignment">{([['left',<TextAlignStart key="l" size={14}/>],['center',<TextAlignCenter key="c" size={14}/>],['right',<TextAlignEnd key="r" size={14}/>]] as const).map(([a,icon])=><button key={a} type="button" aria-label={`Align ${a}`} aria-pressed={settings.align===a} onClick={()=>set('align',a)}>{icon}</button>)}</div>
        <div className="config-segments" role="group" aria-label="Style">{(['caption','minimal','subtitle','card'] as const).map(p=><button key={p} type="button" aria-pressed={settings.preset===p} onClick={()=>setSettings(s=>({...s,preset:p,opacity:p==='card'?82:p==='caption'?76:p==='minimal'?28:0}))}>{p[0].toUpperCase()+p.slice(1)}</button>)}</div>
      </div>}
    </div>}
    <div className="config-row">
      <label className="config-opacity" title="Background opacity"><span className="sr-only">Background opacity</span><input aria-label="Background opacity" type="range" min="0" max="100" value={settings.opacity} onChange={e=>setSettings(s=>({...s,opacity:Number(e.target.value),preset:s.preset==='subtitle'?'caption':s.preset}))}/></label>
      <div className="config-tools">
        {tool('color','Lyric color',<span className="rainbow" style={{boxShadow:`inset 0 0 0 3px ${settings.color}`}}/>)}
        {tool('font','Font',<Type size={17}/>)}
        {tool('size','Font size',<ALargeSmall size={19}/>)}
        {tool('layout','Lines and alignment',<TextAlignJustify size={17}/>)}
        <button type="button" className="config-tool" aria-label="Switch to Focus Island" title="Focus Island" onClick={onIsland}><span className="pill-icon"/></button>
        <button type="button" className="config-tool" aria-label="All settings" title="All settings" onClick={onMore}><SettingsIcon size={17}/></button>
        <button type="button" className="config-tool done" aria-label="Done customizing" title="Done (Alt+Shift+C)" onClick={onDone}><ArrowLeft size={18}/></button>
      </div>
    </div>
    <div className="config-tip"><span>Scroll</span><Mouse size={12}/><span>to adjust lyric font size</span></div>
  </div>;
}
/** Focus mode: nothing on screen except a brief pill when the track changes. */
function FocusPeek({player,trackKey,reduced}:{player:Player;trackKey:string;reduced:boolean}) {
  const [shown,setShown]=useState(true);
  useEffect(()=>{setShown(true);const timer=setTimeout(()=>setShown(false),4000);return()=>clearTimeout(timer);},[trackKey]);
  return <div className={`island peek ${shown?'shown':''}`} data-testid="focus-peek" data-shown={shown} role="status">
    <img className="peek-art" src={player.artwork} alt=""/>
    <div className="island-song"><strong>{player.title}</strong><span>{player.artist}</span></div>
    <Spectrum bands={player.bands} playing={player.playing&&shown} reduced={reduced}/>
  </div>;
}
function Island({player,settings,onExpanded}:{player:Player;settings:Settings;onExpanded:(v:boolean)=>void}) {
  const [expanded,setExpanded]=useState(false);
  const host=useRef<HTMLDivElement>(null), trigger=useRef<HTMLButtonElement>(null);
  const hoverTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined), collapseTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const hovered=useRef(false), keyboard=useRef(false), focused=useRef(false), suppressFocus=useRef(false), pressed=useRef(false);
  const clear=()=>{clearTimeout(hoverTimer.current);clearTimeout(collapseTimer.current);};
  const collapseLater=()=>{
    clearTimeout(collapseTimer.current);
    if(!hovered.current&&!focused.current&&!pressed.current&&!player.pending)
      collapseTimer.current=setTimeout(()=>setExpanded(false),settings.collapseDelay);
  };
  useEffect(()=>{onExpanded(expanded);},[expanded,onExpanded]);
  useEffect(()=>()=>{clearTimeout(hoverTimer.current);clearTimeout(collapseTimer.current);},[]);
  useEffect(()=>{if(!player.pending)collapseLater();},[player.pending,settings.collapseDelay]);
  useEffect(()=>{
    const outside=(e:PointerEvent)=>{if(!host.current?.contains(e.target as Node)&&!player.pending){focused.current=false;setExpanded(false);clear();}};
    document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);
  },[player.pending]);
  return <div ref={host} className={`island ${expanded?'expanded':''}`} data-testid="island" data-expanded={expanded}
    onPointerEnter={()=>{hovered.current=true;clearTimeout(collapseTimer.current);hoverTimer.current=setTimeout(()=>setExpanded(true),150);}}
    onPointerLeave={()=>{hovered.current=false;clearTimeout(hoverTimer.current);collapseLater();}}
    onPointerDown={()=>{keyboard.current=false;focused.current=false;pressed.current=true;clearTimeout(collapseTimer.current);}}
    onPointerUp={()=>{pressed.current=false;collapseLater();}}
    onPointerCancel={()=>{pressed.current=false;collapseLater();}}
    onKeyDown={e=>{keyboard.current=true;if(e.key==='Escape'){e.preventDefault();setExpanded(false);clear();suppressFocus.current=true;trigger.current?.focus();focused.current=false;}else if(e.key==='Tab'){focused.current=true;}}}
    onFocus={()=>{if(suppressFocus.current){suppressFocus.current=false;return;}if(keyboard.current||!hovered.current){focused.current=true;setExpanded(true);clearTimeout(collapseTimer.current);}}}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){focused.current=false;collapseLater();}}}>
    <div className="island-top">
      <button ref={trigger} className="island-art" aria-label={`${expanded?'Collapse':'Expand'} Focus Island`} aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}><img src={player.artwork} alt=""/></button>
      {expanded&&<div className="island-song"><strong title={player.title}>{player.title}</strong><span>{player.artist}{player.album&&` · ${player.album}`}</span></div>}
      <Spectrum bands={player.bands} playing={player.playing} reduced={settings.reducedMotion}/>
    </div>
    {expanded&&<div className="island-bottom"><Transport player={player} compact/><span className="island-status">{player.pending?'Updating…':player.playing?'Now playing':'Paused'}</span></div>}
  </div>;
}

// Island is pinned to the top center of the work area; only its height changes when it opens.
const islandWindow={width:360,compact:64,expanded:150,margin:12};
const windowRectKey='floating:overlay-window';
async function placeIsland(height:number) {
  const {getCurrentWindow,currentMonitor,LogicalSize,PhysicalPosition}=await import('@tauri-apps/api/window');
  const win=getCurrentWindow(), monitor=await currentMonitor();
  await win.setSize(new LogicalSize(islandWindow.width,height));
  if(!monitor)return;
  const scale=monitor.scaleFactor, area=monitor.workArea;
  await win.setPosition(new PhysicalPosition(Math.round(area.position.x+(area.size.width-islandWindow.width*scale)/2),Math.round(area.position.y+islandWindow.margin*scale)));
}
/** Puts the lyric window back where the user last left it before switching to the island. */
async function restoreLyricWindow(minWidth:number,minHeight:number) {
  const {getCurrentWindow,LogicalSize,PhysicalPosition,PhysicalSize}=await import('@tauri-apps/api/window');
  const win=getCurrentWindow(), scale=await win.scaleFactor();
  let rect:{x:number;y:number;width:number;height:number}|null=null;
  try{rect=JSON.parse(localStorage.getItem(windowRectKey)||'null');}catch{/* first run */}
  const valid=rect&&['x','y','width','height'].every(k=>Number.isFinite(rect![k as keyof typeof rect]));
  if(!valid){await win.setSize(new LogicalSize(Math.max(560,minWidth),Math.max(230,minHeight)));return;}
  await win.setSize(new PhysicalSize(Math.max(rect!.width,Math.round(minWidth*scale)),Math.max(rect!.height,Math.round(minHeight*scale))));
  await win.setPosition(new PhysicalPosition(rect!.x,rect!.y));
}

type OverlayProps={settings:Settings;setSettings:(v:Settings|((s:Settings)=>Settings))=>void;player:Player;lyrics:LyricLine[];plain?:string;status?:string;size:{width:number;height:number};
  trackKey:string;configuring:boolean;setConfiguring:(v:boolean)=>void;onMore:()=>void};
function Overlay({settings,setSettings,player,lyrics,plain='',status='',size,trackKey,configuring,setConfiguring,onMore}:OverlayProps) {
  const isIsland=settings.focus||settings.mode==='island';
  const [expanded,setExpanded]=useState(false), [dragging,setDragging]=useState(false), [hovered,setHovered]=useState(false);
  const setExpansion=useCallback((v:boolean)=>setExpanded(v),[]);
  const bounds=constrainBounds(settings.bounds,size.width,size.height);
  const gesture=useRef<{x:number;y:number;start:Bounds;corner:string}|null>(null);
  const host=useRef<HTMLDivElement>(null), wasExpanded=useRef(false);
  const index=activeLine(lyrics,player.position,settings.offset);
  // Lyrics step aside while the pointer is over them; the clicks themselves go to whatever is behind.
  useEffect(()=>{
    if(overlayWindow){
      let disposed=false,unlisten:(()=>void)|undefined;
      void (async()=>{const off=await listen<boolean>('overlay:hover',e=>setHovered(e.payload));if(disposed)off();else unlisten=off;})();
      return()=>{disposed=true;unlisten?.();};
    }
    const move=(e:PointerEvent)=>{const r=host.current?.getBoundingClientRect();setHovered(!!r&&e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom);};
    const leave=()=>setHovered(false);
    document.addEventListener('pointermove',move);document.documentElement.addEventListener('pointerleave',leave);
    return()=>{document.removeEventListener('pointermove',move);document.documentElement.removeEventListener('pointerleave',leave);};
  },[]);
  useEffect(()=>{
    if(!overlayWindow)return;
    void import('@tauri-apps/api/window').then(({getCurrentWindow})=>getCurrentWindow().setIgnoreCursorEvents(settings.focus||(!isIsland&&!configuring)));
  },[isIsland,configuring,settings.focus]);
  useEffect(()=>{
    if(!overlayWindow||!isIsland)return;
    const open=expanded&&!settings.focus;
    let cancelled=false;const apply=()=>{if(!cancelled)void placeIsland(open?islandWindow.expanded:islandWindow.compact);};
    // Grow at once so the opening animation has room; shrink only after the closing animation ends.
    const delay=!open&&wasExpanded.current?320:0;wasExpanded.current=open;
    const timer=setTimeout(apply,delay);return()=>{cancelled=true;clearTimeout(timer);};
  },[isIsland,expanded,settings.focus]);
  useEffect(()=>{
    if(!overlayWindow||isIsland)return;
    void restoreLyricWindow(configuring?420:0,configuring?250:0);
    let disposed=false;const unlisten:(()=>void)[]=[];
    void import('@tauri-apps/api/window').then(async({getCurrentWindow})=>{
      const win=getCurrentWindow();
      const save=async()=>{if(disposed)return;const [p,s]=await Promise.all([win.outerPosition(),win.innerSize()]);try{localStorage.setItem(windowRectKey,JSON.stringify({x:p.x,y:p.y,width:s.width,height:s.height}));}catch{/* session only */}};
      const offs=[await win.onMoved(save),await win.onResized(save)];
      if(disposed)offs.forEach(off=>off());else unlisten.push(...offs);
    });
    return()=>{disposed=true;unlisten.forEach(off=>off());};
  },[isIsland,configuring]);
  function begin(event:ReactPointerEvent<HTMLElement>,corner='') {
    if(!configuring||event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    if(overlayWindow){
      void import('@tauri-apps/api/window').then(({getCurrentWindow})=>{
        const directions:Record<string,string>={nw:'NorthWest',ne:'NorthEast',sw:'SouthWest',se:'SouthEast'};
        if(corner)void getCurrentWindow().startResizeDragging(directions[corner] as 'NorthWest');else void getCurrentWindow().startDragging();
      });return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);gesture.current={x:event.clientX,y:event.clientY,start:bounds,corner};setDragging(true);
  }
  function move(event:ReactPointerEvent<HTMLElement>){
    const g=gesture.current;if(!g)return;
    const dx=event.clientX-g.x,dy=event.clientY-g.y;
    const next=g.corner?resizeBounds(g.start,dx,dy,g.corner,size.width,size.height):constrainBounds({...g.start,x:g.start.x+dx,y:g.start.y+dy},size.width,size.height);
    setSettings(s=>({...s,bounds:next}));
  }
  const finish=()=>{gesture.current=null;setDragging(false);};
  if(isIsland){
    // Fixed at the top center: no drag handle, no resize.
    const style:CSSProperties=overlayWindow?{left:0,top:0,width:'100%',height:'100%'}:{left:0,top:37+islandWindow.margin,width:'100%',height:islandWindow.expanded};
    return <div className="floating-object island-object" style={style} data-testid="overlay">
      {settings.focus?<FocusPeek player={player} trackKey={trackKey} reduced={settings.reducedMotion}/>:<Island player={player} settings={settings} onExpanded={setExpansion}/>}
    </div>;
  }
  const style:CSSProperties=overlayWindow?{left:0,top:0,width:'100%',height:'100%'}:{left:bounds.x,top:bounds.y,width:bounds.width,height:bounds.height};
  const arrows:Record<string,[number,number]>={ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
  return <div ref={host} className={`floating-object lyric-object ${configuring?'configuring':'passive'} ${hovered&&!configuring?'stepped-aside':''} ${dragging?'dragging':''}`} style={style} data-testid="overlay" data-hidden={hovered&&!configuring}
    onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}
    onWheel={e=>{if(configuring&&e.deltaY)setSettings(s=>({...s,fontSize:clamp(s.fontSize+(e.deltaY<0?2:-2),16,64)}));}}>
    {configuring&&<button className="drag-handle" aria-label="Move overlay" title="Drag to move · arrow keys to reposition" onPointerDown={e=>begin(e)} onKeyDown={e=>{
      if(arrows[e.key]){e.preventDefault();const [dx,dy]=arrows[e.key];setSettings(s=>({...s,bounds:constrainBounds({...s.bounds,x:bounds.x+dx,y:bounds.y+dy},size.width,size.height)}));}
    }}><Grip size={14}/></button>}
    <div className={`lyrics-surface preset-${settings.preset} ${settings.songInfo?'with-info':'lyrics-only'}`} onPointerDown={e=>begin(e)}
      style={{fontSize:settings.fontSize,fontWeight:settings.weight,fontFamily:fonts[settings.font][1],color:settings.color,textAlign:settings.align,background:settings.preset==='subtitle'||settings.preset==='caption'?'transparent':`rgba(10,22,16,${settings.opacity/100})`,'--caption-opacity':settings.opacity/100} as CSSProperties} data-testid="lyrics-surface">
      {lyrics.length?<LyricStream lyrics={lyrics} index={index} lines={settings.lines} align={settings.align} reduced={settings.reducedMotion}/>:<div className="lyric-placeholder">{plain||status||'Waiting for lyrics'}</div>}
      {settings.songInfo&&<SongInfo player={player}/>}
    </div>
    {configuring&&<ConfigBar settings={settings} setSettings={setSettings} onDone={()=>setConfiguring(false)} onMore={onMore}
      onIsland={()=>{setConfiguring(false);setSettings(s=>({...s,mode:'island',focus:false}));}}/>}
    {configuring&&['nw','ne','sw','se'].map(c=><button key={c} className={`resize-handle ${c}`} aria-label={`Resize ${c}`} onPointerDown={e=>begin(e,c)} onKeyDown={e=>{
      if(arrows[e.key]){e.preventDefault();setSettings(s=>({...s,bounds:resizeBounds(bounds,...arrows[e.key],c,size.width,size.height)}));}
    }}/>)}
  </div>;
}

export default function App(){
  const [settings,setSettings]=useState<Settings>(()=>{try{return readSettings(localStorage.getItem(storageKey));}catch{return structuredClone(defaults);}});
  const [storageWarning,setStorageWarning]=useState(false), [tab,setTab]=useState<'appearance'|'behavior'>('appearance');
  const [light,setLight]=useState(false),[showHelp,setShowHelp]=useState(false),[nativeError,setNativeError]=useState('');
  const [tourOpen,setTourOpen]=useState(()=>{if(overlayWindow)return false;try{return localStorage.getItem(tourKey)!=='done';}catch{return true;}});
  const [autoOverlay,setAutoOverlay]=useState(()=>{try{return localStorage.getItem('floating:auto-overlay')!=='false';}catch{return true;}});
  const [pairing,setPairing]=useState<{endpoint:string;token:string;error:string|null}|null>(null);
  const [source,setSource]=useState(native?'desktop':'demo');
  const [systemSpectrum,setSystemSpectrum]=useState(()=>{try{const saved=localStorage.getItem('floating:spectrum');return saved===null?native&&/Windows/i.test(navigator.userAgent):saved==='true';}catch{return native&&/Windows/i.test(navigator.userAgent);}});
  const [configuring,setConfiguring]=useState(startAction==='config');
  const configuringRef=useRef(configuring);configuringRef.current=configuring;
  const [imported,setImported]=useState<{lyrics:LyricLine[];plain:string;name:string}|null>(null);
  const [importError,setImportError]=useState('');
  const [customPreset,setCustomPreset]=useState<string|null>(()=>{try{return localStorage.getItem('floating:preset');}catch{return null;}});
  const stage=useRef<HTMLDivElement>(null),helpDialog=useRef<HTMLDialogElement>(null),[size,setSize]=useState({width:760,height:440});
  const audio=useAudio(source==='demo');const desktop=useNativePlayer(source==='desktop');
  const spectrum=useSpectrum(systemSpectrum&&source==='desktop'&&(settings.mode==='island'||settings.focus)&&!!desktop.session?.playing,!overlayWindow);
  useEffect(()=>{try{localStorage.setItem('floating:spectrum',String(systemSpectrum));}catch{/* session only */}},[systemSpectrum]);
  useEffect(()=>{
    if(!native||overlayWindow||!autoOverlay||autoOverlayAttempted)return;
    autoOverlayAttempted=true;
    void openOverlay().catch(e=>{autoOverlayAttempted=false;setNativeError(`Could not open the overlay: ${String(e)}`);});
  },[autoOverlay]);
  useEffect(()=>{try{localStorage.setItem('floating:auto-overlay',String(autoOverlay));}catch{/* session only */}},[autoOverlay]);
  const player:Player=source==='demo'?{...audio,title:audio.track.title,artist:audio.track.artist,album:audio.track.album,artwork:audio.track.artwork,pending:false,canPlay:audio.ready,canPause:true,canNext:true,canPrevious:true,canStop:true}:{
    title:desktop.session?.title||'Waiting for music',artist:desktop.session?.artist||'Open a supported player',album:desktop.session?.album||'',artwork:desktop.session?.artwork||'/icon.svg',
    playing:desktop.session?.playing||false,position:desktop.position,duration:desktop.session?.duration||0,bands:spectrum.bands,pending:desktop.pending,
    canPlay:desktop.session?.canPlay||false,canPause:desktop.session?.canPause||false,canNext:desktop.session?.canNext||false,canPrevious:desktop.session?.canPrevious||false,canStop:desktop.session?.canStop||false,
    toggle:()=>void desktop.command(desktop.session?.playing?'pause':'play'),next:()=>void desktop.command('next'),previous:()=>void desktop.command('previous'),stop:()=>void desktop.command('stop'),seek:()=>{},
  };
  const trackKey=source==='demo'?audio.track.id:`${desktop.session?.id}|${desktop.session?.title}|${desktop.session?.artist}|${desktop.session?.duration}`;
  const importKey=`floating:import:${trackKey}`;
  function saveImport(value:typeof imported){setImported(value);try{if(value)localStorage.setItem(importKey,JSON.stringify(value));else localStorage.removeItem(importKey);}catch{setStorageWarning(true);}}
  useEffect(()=>{
    const restore=()=>{try{const value=JSON.parse(localStorage.getItem(importKey)||'null');setImported(value&&Array.isArray(value.lyrics)&&typeof value.plain==='string'&&typeof value.name==='string'?value:null);}catch{setImported(null);}};
    restore();const receive=(event:StorageEvent)=>{if(event.key===importKey)restore();};
    window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
  },[importKey]);
  useEffect(()=>{
    setImportError('');
    let offset=0;try{const n=Number(localStorage.getItem(`floating:offset:${trackKey}`));if(Number.isFinite(n))offset=clamp(n,-10000,10000);}catch{/* optional storage */}
    setSettings(s=>({...s,offset}));
  },[trackKey]);
  useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify(settings));setStorageWarning(false);}catch{setStorageWarning(true);}},[settings]);
  useEffect(()=>{const update=(e:StorageEvent)=>{if(e.key===storageKey)setSettings(readSettings(e.newValue));};window.addEventListener('storage',update);return()=>window.removeEventListener('storage',update);},[]);
  // Alt+Shift+C: customize the lyrics in place. Customizing is about the lyric layout, so it leaves island/focus.
  const openConfig=useCallback(()=>{setConfiguring(true);setSettings(s=>s.focus||s.mode==='island'?{...s,focus:false,mode:'lyrics'}:s);},[]);
  const toggleConfig=useCallback(()=>{if(configuringRef.current)setConfiguring(false);else openConfig();},[openConfig]);
  // Alt+Shift+F: focus mode hides everything except a short pill when the track changes.
  const toggleFocus=useCallback(()=>{setConfiguring(false);setSettings(s=>({...s,focus:!s.focus}));},[]);
  useEffect(()=>{if(startAction==='focus')toggleFocus();},[toggleFocus]);
  useEffect(()=>{
    if(!overlayWindow)return;
    let disposed=false;const unlisten:(()=>void)[]=[];
    void (async()=>{
      const offs=[await listen('shortcut:config',toggleConfig),await listen('shortcut:focus',toggleFocus),await listen('overlay:unlock',openConfig)];
      if(disposed)offs.forEach(off=>off());else unlisten.push(...offs);
    })();
    return()=>{disposed=true;unlisten.forEach(off=>off());};
  },[toggleConfig,toggleFocus,openConfig]);
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      if(e.key==='Escape'&&configuringRef.current){setConfiguring(false);return;}
      // Natively these arrive as global shortcuts; in the browser they are page shortcuts outside text fields.
      if(native||!e.shiftKey||!e.altKey||e.ctrlKey||e.metaKey||e.repeat||target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.code==='KeyC'){e.preventDefault();toggleConfig();}else if(e.code==='KeyF'){e.preventDefault();toggleFocus();}
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[toggleConfig,toggleFocus]);
  useEffect(()=>{
    if(!stage.current)return;
    const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));
    observer.observe(stage.current);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{if(showHelp)helpDialog.current?.showModal();else helpDialog.current?.close();},[showHelp]);
  const lyrics=imported?.lyrics||(source==='demo'?audio.track.lyrics:desktop.lyrics);
  const plain=imported?.plain||(source==='desktop'?desktop.plain:'');
  function set<K extends keyof Settings>(key:K,value:Settings[K]){setSettings(s=>({...s,[key]:value}));}
  const setOffset=(n:number)=>{set('offset',n);try{localStorage.setItem(`floating:offset:${trackKey}`,String(n));}catch{/* session only */}};
  function preset(name:Settings['preset']){setSettings(s=>({...s,preset:name,opacity:name==='card'?82:name==='caption'?76:name==='minimal'?28:0,fontSize:name==='subtitle'?24:28,weight:name==='card'?600:500,lines:name==='subtitle'?2:3}));}
  function resetPosition(){setSettings(s=>({...s,bounds:constrainBounds({...defaults.bounds,x:(size.width-440)/2,y:(size.height-230)/2},size.width,size.height),islandBounds:{...defaults.islandBounds,x:(size.width-180)/2,y:48}}));}
  const error=source==='demo'?audio.error:desktop.error;
  const openSettings=()=>{setConfiguring(false);if(overlayWindow)void showSettings();else document.getElementById('settings-panel')?.scrollIntoView({behavior:settings.reducedMotion?'auto':'smooth',block:'nearest'});};
  const overlay=<Overlay settings={settings} setSettings={setSettings} player={player} lyrics={lyrics} plain={plain} status={desktop.status} size={size}
    trackKey={trackKey} configuring={configuring} setConfiguring={setConfiguring} onMore={openSettings}/>;
  if(overlayWindow)return <main className="native-overlay" ref={stage}>{overlay}</main>;
  return <div className={`app ${native?'studio-app':''} ${settings.reducedMotion?'reduce-motion':''}`}>
    {native?<header className="studio-header"><div className="studio-brand"><span className="brand-icon"><AudioLines size={22}/></span><div><strong>Floating Lyrics</strong><small>YOUR OVERLAY STUDIO</small></div></div><div className="studio-header-actions"><span className="studio-status"><span className="live-dot"/>{desktop.session?desktop.session.title:'Ready for your music'}</span><button type="button" onClick={()=>setTourOpen(true)}><CircleHelp size={16}/> Quick tour</button><button type="button" className="studio-open" onClick={()=>void openOverlay().catch(e=>setNativeError(String(e)))}><Maximize2 size={16}/> Show overlay</button></div></header>:<header className="site-header"><a className="brand" href="/" aria-label="Floating Lyrics home"><span className="brand-icon"><AudioLines size={23}/></span><span>floating<span className="brand-light">lyrics</span><span className="brand-dot">.</span></span></a>
      <nav aria-label="Main navigation"><a className="nav-active" href="/demo">Playground</a><button type="button" className="nav-tour" onClick={()=>setTourOpen(true)}>Quick tour</button><a href="/#how-it-works">How it works</a><a className="download-nav" href="/#get-started">Get the app <ArrowDownToLine size={15}/></a></nav>
    </header>}
    <main>
      {native?<section className="studio-intro"><div><span className="studio-eyebrow">LIVE CUSTOMIZATION</span><h1>Make the lyrics yours.</h1><p>Choose a look, adjust the details, and see it on your desktop as you go.</p></div><span className="studio-tip"><SlidersHorizontal size={17}/> Alt+Shift+C edits the overlay in place</span></section>:<section className="intro"><div><div className="eyebrow"><span/> MUSIC, WITHOUT THE DISTRACTION</div><h1>A little space<br className="mobile-break"/> for your <em>music.</em></h1><p>Your favorite words. Right where you want them.<br className="mobile-break"/> Make yourself at home in the playground.</p></div><div className="intro-note"><Waves size={25}/><span>Less window switching.<br/>More being in the moment.</span></div></section>}
      <section className="workspace" aria-label="Interactive playground">
        <div className="preview-column"><div className="preview-toolbar"><div className="mode-switch" role="group" aria-label="Display mode" data-tour="modes"><button aria-pressed={settings.mode==='lyrics'&&!settings.focus} onClick={()=>setSettings(s=>({...s,mode:'lyrics',focus:false}))}><Music2 size={15}/>Floating lyrics</button><button aria-pressed={settings.mode==='island'&&!settings.focus} onClick={()=>{setConfiguring(false);setSettings(s=>({...s,mode:'island',focus:false}));}}><span className="pill-icon"/>Focus Island<span className="new-label">NEW</span></button></div><div className="preview-actions"><button type="button" className="chip-button" aria-pressed={configuring} onClick={toggleConfig} aria-label="Customize" title="Customize (Alt+Shift+C)"><SlidersHorizontal size={14}/><span className="chip-text">Customize</span><kbd>⌥⇧C</kbd></button><button type="button" className="chip-button" aria-pressed={settings.focus} onClick={toggleFocus} aria-label="Focus mode" title="Focus mode (Alt+Shift+F)"><Focus size={14}/><span className="chip-text">Focus</span><kbd>⌥⇧F</kbd></button><IconButton label={light?'Dark background':'Light background'} onClick={()=>setLight(v=>!v)}>{light?<Moon size={17}/>:<Sun size={17}/>}</IconButton><IconButton label="Demo help" onClick={()=>setShowHelp(true)}><CircleHelp size={17}/></IconButton></div></div>
          <div className={`desktop-scene ${light?'scene-light':''}`} ref={stage} data-testid="desktop-scene" data-tour="scene">
            <div className="scene-orbit orbit-one"/><div className="scene-orbit orbit-two"/><div className="scene-grain"/>
            <div className="desktop-menubar"><span><span className="desktop-dot"/> Your space</span><span>MONDAY <span className="menu-divider">/</span> 09:41</span></div>
            <div className="ambient-copy"><span>ROOM TO</span><strong>breathe.</strong></div>
            {overlay}
            <div className="scene-footer"><span><span className="live-dot"/> {source==='demo'?'INTERACTIVE DEMO':'DESKTOP PREVIEW'}</span><span>{settings.focus?'Focus mode · shows only when the track changes':settings.mode==='island'?'Pinned top center · hover to open':configuring?'Drag to move · pull a corner to resize · scroll for size':'Hover to see through · Alt+Shift+C to customize'}</span></div>
          </div>
          <div className="canvas-footer"><span><Monitor size={14}/>{source==='demo'?'A preview of your desktop. No install needed.':'Live session from your desktop player.'}</span><button onClick={resetPosition}><RotateCcw size={13}/>Reset position</button></div>
          <section className="sample-player" aria-label="Sample player" data-tour="player"><div className="player-track"><img src={player.artwork} alt={`${player.title} artwork`}/><div><span className="eyebrow">{source==='demo'?'ON THE DEMO DECK':'NOW PLAYING'}</span><strong>{player.title}</strong><span>{player.artist}</span></div></div><div className="player-center"><Transport player={player}/><div className="seek-row"><time data-testid="playback-time">{formatTime(player.position)}</time><input aria-label="Seek" type="range" min="0" max={player.duration||32} step="0.1" value={player.position} onChange={e=>player.seek(Number(e.target.value))} disabled={source!=='demo'}/><time>{formatTime(player.duration)}</time></div></div><div className="volume-control"><Volume2 size={16}/><input aria-label="Volume" type="range" min="0" max="1" step="0.01" value={audio.volume} onChange={e=>audio.setVolume(Number(e.target.value))} disabled={source!=='demo'}/></div></section>
          {error&&<p className="notice error" role="alert">{error}</p>}
          {source==='demo'&&!audio.spectrumAvailable&&<p className="notice" role="status">Audio visualization is unavailable in this browser. Playback and lyrics still work.</p>}
          {source==='demo'&&<div className="sample-selector"><label htmlFor="sample-select">Try a different mood</label><select id="sample-select" value={audio.index} onChange={e=>audio.setIndex(Number(e.target.value))}>{samples.map((s,i)=><option key={s.id} value={i}>{s.title} · {s.id==='komorebi'?'Japanese':'English'}</option>)}</select><span>Original instrumental audio & demo words</span></div>}
        </div>
        <aside className="settings-panel" id="settings-panel" aria-label="Customize overlay" data-tour="settings"><div className="settings-heading"><div><SlidersHorizontal size={18}/><h2>Make it yours</h2></div><span className="auto-save"><Check size={12}/>{storageWarning?'Session only':'Auto-saved'}</span></div>
          <div className="settings-tabs" role="group" aria-label="Settings sections"><button aria-pressed={tab==='appearance'} onClick={()=>setTab('appearance')}>Appearance</button><button aria-pressed={tab==='behavior'} onClick={()=>setTab('behavior')}>Behavior</button></div>
          {tab==='appearance'?<div className="settings-body">
            <div className="field-label">START WITH A PRESET</div><div className="preset-grid">{(['caption','minimal','subtitle','card'] as const).map(p=><button key={p} aria-pressed={settings.preset===p} onClick={()=>preset(p)}><span className={`preset-preview ${p}`}><i/><i/><i/></span><span>{p[0].toUpperCase()+p.slice(1)}</span>{settings.preset===p&&<Check size={11}/>}</button>)}</div>
            <div className="setting-group"><div className="label-row"><label htmlFor="font-size">Font size</label><output>{settings.fontSize} px</output></div><input id="font-size" type="range" min="16" max="64" value={settings.fontSize} onChange={e=>set('fontSize',Number(e.target.value))}/><div className="range-labels"><span>Aa</span><span>Aa</span></div></div>
            <div className="setting-group row"><label htmlFor="font-family">Font</label><select id="font-family" value={settings.font} onChange={e=>set('font',e.target.value as Font)}>{(Object.keys(fonts) as Font[]).map(f=><option key={f} value={f}>{fonts[f][0]}</option>)}</select></div>
            <div className="setting-group row"><label htmlFor="weight">Font weight</label><select id="weight" value={settings.weight} onChange={e=>set('weight',Number(e.target.value))}><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option></select></div>
            <div className="setting-group row"><span id="color-label">Lyric color</span><div className="swatches" role="group" aria-labelledby="color-label">{['#f4f8ed','#d0f292','#f2d2a0','#a8d3ee'].map(c=><button key={c} aria-label={`Color ${c}`} aria-pressed={settings.color===c} style={{background:c}} onClick={()=>set('color',c)}>{settings.color===c&&<Check size={13}/>}</button>)}<input aria-label="Custom lyric color" type="color" value={settings.color} onChange={e=>set('color',e.target.value)}/></div></div>
            <div className="setting-group"><div className="label-row"><label htmlFor="opacity">Background opacity</label><output>{settings.opacity}%</output></div><input id="opacity" type="range" min="0" max="100" value={settings.opacity} onChange={e=>set('opacity',Number(e.target.value))}/></div>
            <div className="setting-group row"><label htmlFor="lines">Visible lines</label><select id="lines" value={settings.lines} onChange={e=>set('lines',Number(e.target.value))}><option value="1">1 line</option><option value="2">2 lines</option><option value="3">3 lines</option></select></div>
            <label className="toggle-row"><span><strong>Show song info</strong><small>Artwork, title and artist at the bottom right. Off for lyrics only.</small></span><input type="checkbox" checked={settings.songInfo} onChange={e=>set('songInfo',e.target.checked)}/></label>
            <div className="setting-group row"><label htmlFor="alignment">Alignment</label><select id="alignment" value={settings.align} onChange={e=>set('align',e.target.value as Settings['align'])}><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select></div>
            <div className="preset-actions"><button onClick={()=>{const value=JSON.stringify(settings);setCustomPreset(value);try{localStorage.setItem('floating:preset',value);}catch{setStorageWarning(true);}}}><ArrowDownToLine size={13}/>Save my preset</button><button disabled={!customPreset} onClick={()=>{if(customPreset)setSettings(readSettings(customPreset));}}>Restore</button></div>
          </div>:<div className="settings-body">
            <label className="toggle-row"><span><strong>Focus mode</strong><small>Hide everything; show a short pill when the track changes. Alt+Shift+F</small></span><input type="checkbox" checked={settings.focus} onChange={e=>{setConfiguring(false);set('focus',e.target.checked);}}/></label>
            <label className="toggle-row"><span><strong>Reduced motion</strong><small>Quiet transitions, static spectrum</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={e=>set('reducedMotion',e.target.checked)}/></label>
            <div className="setting-group"><div className="label-row"><label htmlFor="collapse-delay">Island collapse delay</label><output>{settings.collapseDelay/1000}s</output></div><input id="collapse-delay" type="range" min="500" max="5000" step="500" value={settings.collapseDelay} onChange={e=>set('collapseDelay',Number(e.target.value))}/><p className="field-help">Closes after the pointer and keyboard focus leave.</p></div>
            <div className="setting-group"><div className="label-row"><label htmlFor="offset">Lyric timing offset</label><output>{settings.offset>0?'+':''}{settings.offset} ms</output></div><input id="offset" type="range" min="-5000" max="5000" step="100" value={settings.offset} onChange={e=>setOffset(Number(e.target.value))}/><p className="field-help">Positive values show lyrics earlier. Saved per track.</p></div>
            <div className="setting-group"><label htmlFor="position">Place overlay</label><select id="position" defaultValue="" disabled={settings.mode==='island'} onChange={e=>{const v=e.target.value,b=settings.bounds;setSettings(s=>({...s,bounds:{...b,x:v.includes('right')?size.width-b.width-24:v==='center'?(size.width-b.width)/2:24,y:v.includes('bottom')?size.height-b.height-45:v==='center'?(size.height-b.height)/2:45}}));}}><option value="" disabled>Choose position</option><option value="top-left">Top left</option><option value="top-right">Top right</option><option value="center">Center</option><option value="bottom-left">Bottom left</option><option value="bottom-right">Bottom right</option></select>{settings.mode==='island'&&<p className="field-help">Focus Island always sits at the top center.</p>}</div>
            <label className="file-input"><Upload size={15}/>Import lyrics (.lrc / .txt)<input aria-label="Import lyrics" type="file" accept=".lrc,.txt" onChange={async e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>1024*1024){setImportError('Choose a lyric file smaller than 1 MB.');return;}const text=await file.text();const lines=parseLrc(text);saveImport({lyrics:lines,plain:lines.length?'':text,name:file.name});setImportError('');}}/></label>
            {imported&&<p className="field-help">{imported.name} · {imported.lyrics.length?'Synced lyrics':'Plain text · not synced'} <button onClick={()=>saveImport(null)}>Clear</button></p>}{importError&&<p role="alert" className="notice error">{importError}</p>}
            <button className="reset-all" onClick={()=>{setSettings(structuredClone(defaults));setOffset(0);saveImport(null);resetPosition();}}><RotateCcw size={14}/>Reset all settings</button>
            {native&&<details className="studio-connections"><summary>Playback & connections <span>Source, lyrics and startup</span></summary><div className="studio-connection-body"><label className="toggle-row"><span><strong>Open overlay at startup</strong><small>Caption lyrics appear automatically when the app starts.</small></span><input aria-label="Open overlay at startup" type="checkbox" checked={autoOverlay} onChange={e=>setAutoOverlay(e.target.checked)}/></label><label className="studio-field">Playback source<select value={source} onChange={e=>setSource(e.target.value)}><option value="desktop">Desktop media sessions</option><option value="demo">Demo samples</option></select></label><label className="studio-field">Player<select value={desktop.selected} onChange={e=>desktop.setSelected(e.target.value)}><option value="">Automatic</option>{desktop.sessions.map(s=><option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}</select></label><p className="field-help">{desktop.status}</p><button type="button" className="studio-pair" onClick={()=>void browserPairing().then(setPairing).catch(e=>setNativeError(String(e)))}>Pair YouTube Music companion <ArrowRight size={14}/></button>{pairing&&<label className="studio-field">Pairing code<input readOnly value={pairing.token} onFocus={e=>e.target.select()}/><small>{pairing.error||pairing.endpoint}</small></label>}<label className="toggle-row"><span><strong>Visualize system audio (Windows)</strong><small>Analyzed locally; never recorded.</small></span><input type="checkbox" checked={systemSpectrum} onChange={e=>setSystemSpectrum(e.target.checked)}/></label>{spectrum.error&&<p role="alert" className="notice error">{spectrum.error}</p>}{desktop.results.length>0&&<label className="studio-field">Lyric version<select defaultValue="" onChange={e=>{const r=desktop.results.find(r=>r.id===Number(e.target.value));if(r)desktop.choose(r);}}><option value="" disabled>Choose a matching version</option>{desktop.results.map(r=><option key={r.id} value={r.id}>{r.trackName} · {r.artistName} · {r.albumName} · {formatTime(r.duration)}</option>)}</select></label>}{nativeError&&<p role="alert" className="notice error">{nativeError}</p>}</div></details>}
          </div>}
          <div className="settings-bottom"><Headphones size={17}/><p>{settings.mode==='island'?'Hover over the island to reveal your music controls.':'Press Alt+Shift+C to move and style the lyrics. There’s no wrong way to listen.'}</p></div>
        </aside>
      </section>
    </main>
    {!native&&<footer><span className="footer-brand"><AudioLines size={16}/> floatinglyrics.</span><span>A small companion for the songs you love.</span><button type="button" className="tour-replay" onClick={()=>setTourOpen(true)}>Replay tour</button><span>Local preferences. No account.</span></footer>}
    <Tour open={tourOpen} desktop={native} reducedMotion={settings.reducedMotion} onClose={()=>setTourOpen(false)}/>
    <dialog ref={helpDialog} className="help-dialog" onCancel={()=>setShowHelp(false)} onClick={e=>{if(e.target===e.currentTarget)setShowHelp(false);}}><div className="dialog-heading"><h2>A place to play.</h2><IconButton label="Close help" onClick={()=>setShowHelp(false)}><X size={19}/></IconButton></div><p>Press Play to hear an original instrumental soundscape. Demo words show how synced lyrics follow the track.</p><ol><li>Press Alt+Shift+C (or Customize) to move, resize and style the lyrics. Scroll over them to change the size.</li><li>Hover the lyrics and they step aside, so you can keep working behind them.</li><li>Alt+Shift+F turns on Focus mode: nothing on screen until the track changes.</li><li>Choose Focus Island, then hover or tap to reveal playback controls.</li><li>Explore Appearance and Behavior. Changes save on this browser.</li></ol><p>Desktop always-on-top, system playback, and click-through require the desktop app. This preview stays inside the page.</p><button className="primary-button" onClick={()=>setShowHelp(false)}>Got it <ArrowRight size={16}/></button></dialog>
  </div>;
}
