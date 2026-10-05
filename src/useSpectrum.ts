import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { native } from './native';
export function useSpectrum(enabled:boolean,owner:boolean){
  const [bands,setBands]=useState<number[]>(Array(7).fill(0)),[error,setError]=useState('');
  useEffect(()=>{
    if(!native)return;
    let disposed=false;const cleanup:Array<()=>void>=[];
    void Promise.all([
      listen<number[]>('spectrum:bands',e=>setBands(e.payload)),
      listen<string>('spectrum:error',e=>setError(e.payload)),
    ]).then(unlisteners=>{if(disposed)unlisteners.forEach(f=>f());else cleanup.push(...unlisteners);});
    return()=>{disposed=true;cleanup.forEach(f=>f());};
  },[]);
  useEffect(()=>{
    if(!native||!owner)return;
    setError('');
    void invoke('set_spectrum_enabled',{enabled}).catch(e=>setError(String(e)));
    return()=>{void invoke('set_spectrum_enabled',{enabled:false});};
  },[enabled,owner]);
  return {bands,error};
}
