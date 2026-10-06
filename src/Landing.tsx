import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowDownRight, ArrowRight, AudioLines, Check, ChevronRight, CirclePlay, ExternalLink, Focus, Grip, LayoutTemplate, Music2, Pause, ScanLine, Settings2, Sparkles, Waves } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './landing.css';

gsap.registerPlugin(ScrollTrigger);

const repository = 'https://github.com/mahrus-rohisyam/floating-lyrics-desktop';

const features = [
  { icon: ScanLine, number: '01', title: 'Lyrics found automatically', text: 'The desktop app searches for timed lyrics, then shows plain lyrics when timing is unavailable. Matching the right recording matters.' },
  { icon: LayoutTemplate, number: '02', title: 'Caption by default', text: 'A quiet background hugs the words instead of covering your desktop. Show artwork and song details only when you want them.' },
  { icon: Grip, number: '03', title: 'A layout that moves with you', text: 'Drag the overlay, resize from any corner, and tune typography, color, opacity, alignment, and line count.' },
  { icon: Focus, number: '04', title: 'Focus Island', text: 'A fixed, compact island shows artwork and a live spectrum. Hover or focus it for playback controls and track details.' },
  { icon: Music2, number: '05', title: 'Your music sources', text: 'Read desktop media sessions from Spotify or Apple Music, and pair YouTube Music through the browser companion.' },
  { icon: Settings2, number: '06', title: 'In your control', text: 'Choose lyrics or Island, adjust timing, import your own LRC, and save the look you like. Preferences stay local.' },
];

const steps = [
  { number: '01', title: 'Open your player', text: 'Start a track in Spotify or Apple Music. Pair the companion when you listen on YouTube Music.' },
  { number: '02', title: 'Let lyrics appear', text: 'The desktop app searches automatically. Timed lyrics follow playback; plain lyrics stay readable. Instrumental or missing tracks still show song details.' },
  { number: '03', title: 'Shape the view', text: 'Open Studio to choose a preset, move or resize lyrics, and adjust their style. Alt+Shift+C opens in-place controls.' },
  { number: '04', title: 'Stay in flow', text: 'Switch to Focus Island or press Alt+Shift+F when you want the music nearby with fewer distractions.' },
];

function Brand() {
  return <a className="landing-brand" href="/" aria-label="Floating Lyrics home"><span className="landing-brand-mark"><AudioLines size={21}/></span><span>floating<span>lyrics</span><i>.</i></span></a>;
}

function Visual({ compact = false }: { compact?: boolean }) {
  return <div className={`landing-visual ${compact ? 'landing-visual-compact' : ''}`} aria-label="Preview of Caption lyrics and Focus Island" role="img">
    <div className="visual-glow visual-glow-one"/><div className="visual-glow visual-glow-two"/>
    <div className="visual-topline"><span><span className="visual-dot"/> DESKTOP PREVIEW</span><span>FLOATING LYRICS / 01</span></div>
    <div className="visual-island"><span className="visual-island-art"/><span className="visual-island-bars" aria-hidden="true">{[6,12,18,10,15,8,13,5].map((n,i)=><i key={i} style={{height:n}}/>)}</span></div>
    <div className="visual-lyrics"><span className="visual-lyric-past">A little room to breathe</span><strong><span>Let the world slow down</span></strong><span className="visual-lyric-next">And everything feels lighter</span></div>
    <div className="visual-song"><span className="visual-art"><span/></span><span><strong>Afterglow</strong><small>Floating Studio · A quieter kind of day</small></span><span className="visual-song-play"><Pause size={13} fill="currentColor"/></span></div>
    <div className="visual-caption">CAPTION MODE <span/> THE WORDS, FRONT AND CENTER</div>
  </div>;
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useLayoutEffect(() => {
    document.title = 'Floating Lyrics — Your music, right where you are';
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    description?.setAttribute('content', 'Floating Lyrics searches for synced or plain lyrics automatically and keeps song details visible when lyrics are unavailable. Explore the desktop overlay and Focus Island.');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const context = gsap.context(() => {
      gsap.from('.landing-hero-copy > *', { y: 28, opacity: 0, duration: .85, stagger: .11, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.from('.landing-hero-visual', { y: 35, opacity: 0, scale: .97, duration: 1.15, delay: .18, ease: 'power3.out', clearProps: 'transform,opacity' });
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach(element => {
        gsap.from(element, { y: 35, opacity: 0, duration: .8, ease: 'power2.out', clearProps: 'transform,opacity', scrollTrigger: { trigger: element, start: 'top 88%', once: true } });
      });
    }, root);
    return () => context.revert();
  }, []);

  return <div className="landing" ref={root}>
    <header className="landing-header"><Brand/><button className="landing-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span/><span/></button><nav className={menuOpen ? 'open' : ''} aria-label="Site navigation"><a href="#features" onClick={()=>setMenuOpen(false)}>Features</a><a href="#how-it-works" onClick={()=>setMenuOpen(false)}>How it works</a><a href="#get-started" onClick={()=>setMenuOpen(false)}>Get the app</a><a className="landing-nav-demo" href="/demo">Try the demo <ArrowRight size={15}/></a></nav></header>
    <main>
      <section className="landing-hero" aria-labelledby="landing-title"><div className="landing-hero-copy"><span className="landing-kicker"><span/> A LITTLE SPACE FOR YOUR MUSIC</span><h1 id="landing-title">Stay with the song.<br/><em>Keep your flow.</em></h1><p>Lyrics appear above your desktop as the app searches automatically for the right version. Timed words follow the song; plain lyrics and track status keep the view useful when timing or lyrics are unavailable.</p><div className="landing-hero-actions"><a className="landing-button landing-button-light" href="/demo">Explore the live demo <ArrowRight size={17}/></a><a className="landing-text-link" href="#how-it-works">See how it works <ArrowDownRight size={17}/></a></div><div className="landing-hero-proof"><span><Check size={14}/> Caption by default</span><span><Check size={14}/> Customizable in place</span><span><Check size={14}/> No account</span></div></div><div className="landing-hero-visual"><Visual/><div className="landing-visual-tag"><Sparkles size={16}/> Made for the spaces between songs.</div></div></section>
      <div className="landing-marquee" aria-label="Supported listening sources"><span>MADE TO WORK WITH YOUR MUSIC</span><div><span>Spotify desktop</span><i/><span>Apple Music</span><i/><span>YouTube Music companion</span></div></div>
      <section className="landing-section landing-features" id="features" aria-labelledby="features-title"><div className="landing-section-heading" data-reveal><span className="landing-section-label">01 / WHAT IT DOES</span><h2 id="features-title">Everything you need.<br/><em>Nothing in your way.</em></h2><p>Built to feel like part of your desktop: readable when you look, quiet when you work.</p></div><div className="landing-feature-grid">{features.map(feature=><article className="landing-feature" key={feature.number} data-reveal><span className="landing-feature-top"><feature.icon size={23} strokeWidth={1.7}/><small>{feature.number}</small></span><h3>{feature.title}</h3><p>{feature.text}</p></article>)}</div></section>
      <section className="landing-modes" aria-labelledby="modes-title"><div className="landing-modes-copy" data-reveal><span className="landing-section-label">02 / TWO WAYS TO LISTEN</span><h2 id="modes-title">Be present.<br/><em>Or stay focused.</em></h2><p>Caption keeps the current words readable without a large panel. Focus Island takes up even less space and expands when you need control.</p><div className="landing-mode-points"><span><ScanLine size={17}/> Caption follows every line</span><span><Focus size={17}/> Island stays fixed at the top</span><span><Waves size={17}/> Live spectrum while music plays</span></div><a href="/demo" className="landing-inline-link">Try both modes <ArrowRight size={17}/></a></div><div className="landing-modes-showcase" data-reveal><div className="mode-caption-demo"><small>CAPTION / DEFAULT</small><strong><span>Let the world slow down</span></strong><span>A little room to breathe</span></div><div className="mode-island-demo"><span className="visual-island-art"/><span><strong>Afterglow</strong><small>Floating Studio</small></span><CirclePlay size={23}/></div><span className="modes-showcase-note">One app, two states of mind.</span></div></section>
      <section className="landing-section landing-how" id="how-it-works" aria-labelledby="how-title"><div className="landing-section-heading" data-reveal><span className="landing-section-label">03 / GET STARTED</span><h2 id="how-title">From play to floating<br/><em>in a few simple steps.</em></h2><p>The desktop app opens your overlay automatically. Studio is there whenever you want to make it yours.</p></div><div className="landing-step-grid">{steps.map(step=><article className="landing-step" key={step.number} data-reveal><span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p><ChevronRight size={19}/></article>)}</div></section>
      <section className="landing-cta" id="get-started" aria-labelledby="cta-title" data-reveal><div><span className="landing-section-label">READY WHEN YOU ARE</span><h2 id="cta-title">Give your music<br/><em>some room to breathe.</em></h2><p>Explore every mode in the browser. Desktop preview builds and source code live on GitHub.</p><div className="landing-cta-actions"><a className="landing-button landing-button-dark" href="/demo">Open interactive demo <ArrowRight size={17}/></a><a className="landing-button landing-button-outline" href={`${repository}/releases`} target="_blank" rel="noopener noreferrer">See desktop builds <ExternalLink size={16}/></a></div></div><div className="landing-cta-mark" aria-hidden="true"><AudioLines size={98} strokeWidth={1.25}/></div></section>
    </main>
    <footer className="landing-footer"><Brand/><span>A little companion for the songs you love.</span><div><a href="/demo">Demo</a><a href={repository} target="_blank" rel="noopener noreferrer">GitHub <ExternalLink size={12}/></a></div><small>© {new Date().getFullYear()} Floating Lyrics</small></footer>
  </div>;
}
