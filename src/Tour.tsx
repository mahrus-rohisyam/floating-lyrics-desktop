import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';

export const tourKey = 'floating:tour:v1';

type Step = { title: string; description: string; target: string };

export function Tour({ open, desktop, reducedMotion, onClose }: { open: boolean; desktop: boolean; reducedMotion: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const steps: Step[] = [
    { title: 'Your lyrics are ready', description: desktop ? 'The transparent Caption overlay opens automatically above your desktop. Start a song in a supported player to see its lyrics.' : 'This preview starts in Caption mode. Play a sample to see synced words on the desktop scene.', target: 'scene' },
    { title: 'Play a song', description: desktop ? 'Choose a desktop media session below, or switch to Demo samples to explore without a player.' : 'Use Play, seek, or select another sample. The current lyric follows the music.', target: 'player' },
    { title: 'Make it yours', description: 'Choose Caption, change the type and layout, or press Alt+Shift+C to drag and resize the lyrics.', target: 'settings' },
    { title: 'Stay focused', description: 'Switch to Focus Island for a fixed, compact view. Hover it for the song title and playback controls.', target: 'modes' },
  ];
  useEffect(() => {
    if (!open) { setIndex(0); return; }
    const target = document.querySelector<HTMLElement>(`[data-tour="${steps[index].target}"]`);
    target?.classList.add('tour-highlight');
    target?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'center' });
    heading.current?.focus({ preventScroll: true });
    return () => target?.classList.remove('tour-highlight');
  }, [open, index, reducedMotion]);
  if (!open) return null;
  const finish = () => { try { localStorage.setItem(tourKey, 'done'); } catch { /* session only */ } onClose(); };
  return <div className="tour-layer" data-testid="tour">
    <section className="tour-card" aria-label="Getting started tour">
      <div className="tour-top"><span>QUICK TOUR · {index + 1} OF {steps.length}</span><button type="button" className="tour-close" onClick={finish} aria-label="Close tour"><X size={17}/></button></div>
      <div className="tour-progress" aria-hidden="true">{steps.map((step, i) => <span key={step.title} className={i <= index ? 'active' : ''}/>)}</div>
      <h2 ref={heading} tabIndex={-1}>{steps[index].title}</h2>
      <p>{steps[index].description}</p>
      <div className="tour-actions"><button type="button" className="tour-skip" onClick={finish}>Skip tour</button><div>{index > 0 && <button type="button" className="tour-back" onClick={() => setIndex(i => i - 1)}><ArrowLeft size={15}/> Back</button>}<button type="button" className="tour-next" onClick={() => index === steps.length - 1 ? finish() : setIndex(i => i + 1)}>{index === steps.length - 1 ? 'Finish' : 'Next'} <ArrowRight size={15}/></button></div></div>
    </section>
  </div>;
}
