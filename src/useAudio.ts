import { useCallback, useEffect, useRef, useState } from 'react';
import { samples } from './samples';
export function useAudio(enabled = true) {
  const [index,setIndex] = useState(0), [playing,setPlaying] = useState(false), [position,setPosition] = useState(0);
  const [duration,setDuration] = useState(32), [volume,setVolume] = useState(.65), [error,setError] = useState('');
  const [ready,setReady]=useState(false);
  const [bands,setBands] = useState<number[]>(Array(7).fill(0));
  const spectrumAvailable=typeof window.AudioContext==='function';
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const graph = useRef<{ context: AudioContext; analyser: AnalyserNode; source: MediaElementAudioSourceNode } | null>(null);
  const indexRef = useRef(index); indexRef.current = index;
  const resumeAfterSwitch = useRef(false);
  const getAudio = useCallback(() => {
    if (!audioRef.current) { audioRef.current = new Audio(); audioRef.current.preload = 'metadata'; }
    return audioRef.current;
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const audio=getAudio(); audio.pause(); setReady(false);setPosition(0); setPlaying(false); setError('');
    const abort=new AbortController();let disposed=false,objectUrl='';
    const resume=resumeAfterSwitch.current;resumeAfterSwitch.current=false;
    const sync=()=>{ setPosition(audio.currentTime); setDuration(Number.isFinite(audio.duration)?audio.duration:32); setPlaying(!audio.paused);setReady(audio.readyState>=1); };
    const failed=()=>{ setError('Audio could not load. Retry or choose another sample.'); setPlaying(false); };
    ['timeupdate','loadedmetadata','play','pause','seeked','ended'].forEach(e=>audio.addEventListener(e,sync));
    audio.addEventListener('error',failed);
    const loadTimeout=setTimeout(()=>{if(!objectUrl||audio.readyState<2){abort.abort();failed();}},8000);
    void fetch(samples[index].audio,{signal:abort.signal}).then(async response=>{
      if(!response.ok)throw Error('Sample unavailable');const blob=await response.blob();if(disposed)return;
      // Windows WebKit cannot decode blob-backed WAVs; its native URL loader can.
      objectUrl=spectrumAvailable?URL.createObjectURL(blob):samples[index].audio;audio.src=objectUrl;audio.load();
      if(resume)void audio.play().catch(()=>{if(!disposed)setError('Press play to continue this sample.');});
    }).catch(()=>{if(!disposed&&!abort.signal.aborted)failed();});
    return ()=>{disposed=true;abort.abort();clearTimeout(loadTimeout);audio.pause(); ['timeupdate','loadedmetadata','play','pause','seeked','ended'].forEach(e=>audio.removeEventListener(e,sync)); audio.removeEventListener('error',failed);if(objectUrl)URL.revokeObjectURL(objectUrl);};
  }, [index, enabled, getAudio, spectrumAvailable]);
  useEffect(()=>{ if(audioRef.current) audioRef.current.volume=volume; },[volume,index]);
  useEffect(()=>{
    if(!playing) { setBands(Array(7).fill(0)); return; }
    let frame=0,last=0;
    const tick=(time:number)=>{
      if(time-last>45) {
        const analyser=graph.current?.analyser;
        if(analyser) {
          const values=new Uint8Array(analyser.frequencyBinCount); analyser.getByteFrequencyData(values);
          const edges=[1,3,6,12,24,48,96,192];
          setBands(edges.slice(0,7).map((start,i)=>{ let total=0; for(let j=start;j<edges[i+1];j++) total+=values[j]||0; return total/((edges[i+1]-start)*255); }));
        }
        if(audioRef.current) setPosition(audioRef.current.currentTime);
        last=time;
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick); return ()=>cancelAnimationFrame(frame);
  },[playing]);
  const play=useCallback(async()=>{
    if(!enabled) return;
    const audio=getAudio(); setError(''); const expectedIndex=indexRef.current;
    try {
      if(spectrumAvailable&&!graph.current) {
        const context=new AudioContext(), analyser=context.createAnalyser(); analyser.fftSize=1024; analyser.smoothingTimeConstant=.72;
        const source=context.createMediaElementSource(audio); source.connect(analyser); analyser.connect(context.destination);
        graph.current={context,analyser,source};
      }
      if(graph.current)await graph.current.context.resume();
      if(audio.error) { audio.src=samples[indexRef.current].audio; audio.load(); }
      if(audio.ended) audio.currentTime=0;
      await audio.play();
    } catch { if(expectedIndex===indexRef.current)setError('Playback was interrupted. Press play to try again.'); }
  },[enabled,getAudio,spectrumAvailable]);
  const pause=()=>getAudio().pause();
  const seek=(time:number)=>{ getAudio().currentTime=Math.max(0,Math.min(time,duration)); setPosition(getAudio().currentTime); };
  const stop=()=>{ pause(); seek(0); };
  const select=(next:number)=>{if(next===indexRef.current)return;resumeAfterSwitch.current=!getAudio().paused;setIndex(next);};
  return { index, setIndex:select, track:samples[index], ready,playing, position, duration, volume, setVolume, error, bands, spectrumAvailable, play, pause, seek, stop,
    toggle:()=>playing?pause():void play(), next:()=>select((indexRef.current+1)%samples.length), previous:()=>select((indexRef.current+samples.length-1)%samples.length) };
}
