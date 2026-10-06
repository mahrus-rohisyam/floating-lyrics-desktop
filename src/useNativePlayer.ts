import { useEffect, useRef, useState } from 'react';
import { getSessions, lookupLyrics, mediaCommand, native, type LyricResult, type Session } from './native';
import { parseLrc } from './core';
import { useSharedString } from './useSharedState';
import { lyricStatus, selectAutomaticLyrics } from './lyricsMatch';
export function useNativePlayer(enabled: boolean) {
  const [sessions,setSessions]=useState<Session[]>([]);
  const [selected,setSelected]=useSharedString('floating:player','');
  const [error,setError]=useState(''), [pending,setPending]=useState(false), [results,setResults]=useState<LyricResult[]>([]);
  const [chosen,setChosen]=useState<LyricResult|null>(null), [status,setStatus]=useState('Waiting for a player');
  const [position,setPosition]=useState(0);
  const [cacheVersion,setCacheVersion]=useState(0);
  const generation=useRef(0), busy=useRef(false);
  // A disconnected explicitly selected player must never redirect controls to another app.
  const session=selected?sessions.find(s=>s.id===selected):sessions.find(s=>s.playing)||sessions[0];
  const key=session ? `${session.id}|${session.title}|${session.artist}|${session.duration}` : '';
  const currentKey=useRef(key); currentKey.current=key;
  useEffect(()=>{const receive=(event:StorageEvent)=>{if(event.key===`floating:lyrics:${key}`)setCacheVersion(v=>v+1);};window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);},[key]);
  useEffect(()=>{
    if(!enabled || !native) return;
    let disposed=false, timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      try { const next=await getSessions(); if(!disposed) { setSessions(next); setError(''); } }
      catch(e) { if(!disposed) setError(String(e)); }
      if(!disposed) timer=setTimeout(poll,750);
    };
    void poll(); return ()=>{disposed=true; clearTimeout(timer);};
  },[enabled]);
  useEffect(()=>{
    if(!session) { setPosition(0); return; }
    const start=performance.now(); setPosition(session.position);
    const timer=setInterval(()=>setPosition(Math.min(session.duration||Infinity,session.position+(session.playing?(performance.now()-start)/1000:0))),100);
    return ()=>clearInterval(timer);
  },[session]);
  useEffect(()=>{
    const gen=++generation.current; setChosen(null); setResults([]);
    if(!enabled || !session?.title) { setStatus('Waiting for a player'); return; }
    const cacheKey=`floating:lyrics:${key}`;
    let cached:LyricResult|null=null;
    try { cached=JSON.parse(localStorage.getItem(cacheKey)||'null'); } catch { /* storage unavailable */ }
    if(cached) { setChosen(cached); setStatus(lyricStatus(cached)); }
    // Keep looking for timed lyrics when only plain text or an instrumental result was cached.
    if(cached?.syncedLyrics?.trim()) return;
    if(!cached) setStatus('Finding lyrics…');
    lookupLyrics(session).then(items=>{
      if(gen!==generation.current) return;
      setResults(items);
      const match=selectAutomaticLyrics(items,session);
      if(match?.syncedLyrics?.trim() || (match && !cached)) {
        setChosen(match); setStatus(lyricStatus(match));
        try { localStorage.setItem(cacheKey,JSON.stringify(match)); } catch { /* optional cache */ }
      } else if(!cached) setStatus(items.length?'Choose the matching version below':'Lyrics not found. Track details remain visible; you can import LRC or TXT.');
    }).catch(()=>{if(gen===generation.current&&!cached)setStatus('Lyrics unavailable. Check your connection or import a file.');});
  // The identity key intentionally drives lookup, not the polling object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key,enabled,cacheVersion]);
  const choose=(r:LyricResult)=>{setChosen(r); setStatus(lyricStatus(r)); try{localStorage.setItem(`floating:lyrics:${key}`,JSON.stringify(r));}catch{/* optional cache */}};
  const command=async(action:string)=>{
    if(!session||busy.current) return;
    busy.current=true;setPending(true); const commandKey=key;
    try{if(!await mediaCommand(session.id,session.title,action))throw Error('This player did not accept the command.');}
    catch(e){if(currentKey.current===commandKey)setError(String(e));}
    finally{busy.current=false;setPending(false);}
  };
  return { sessions,selected,setSelected,session,position,error,pending,results,chosen,choose,status,command,
    lyrics:chosen?.syncedLyrics?parseLrc(chosen.syncedLyrics):[], plain:chosen?.plainLyrics||'' };
}
