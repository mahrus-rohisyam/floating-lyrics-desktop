import { parseLrc } from './core';
export const samples = [
  { id: 'afterglow', title: 'Afterglow', artist: 'Floating Studio', album: 'A quieter kind of day', color: '#c7e7a8',
    caption: 'Original soundscape · demo words',
    lrc: '[00:00.00]Let the world slow down\n[00:04.00]A little room to breathe\n[00:08.00]The light falls through the leaves\n[00:12.00]And everything feels lighter\n[00:16.00]Nothing else to chase\n[00:20.00]Just the rhythm of this place\n[00:24.00]We find our own way home\n[00:28.00]In the afterglow' },
  { id: 'blue-hour', title: 'Blue Hour', artist: 'Floating Studio', album: 'Between the quiet moments', color: '#9bc9e3',
    caption: 'Original soundscape · demo words',
    lrc: '[00:00.00]Across the sleeping city\n[00:04.00]A thousand little lights\n[00:08.00]Leave the day behind you\n[00:12.00]Let the evening take its time\n[00:16.00]Somewhere in the silence\n[00:20.00]We hear a softer sound\n[00:24.00]The blue hour holds us gently\n[00:28.00]Until the stars come out' },
  { id: 'komorebi', title: 'Komorebi', artist: 'Floating Studio', album: 'Light through the trees', color: '#efc297',
    caption: 'Original soundscape · Japanese demo words',
    lrc: '[00:00.00]木漏れ日の中で\n[00:04.00]静かな朝を迎える\n[00:08.00]風が葉を揺らして\n[00:12.00]今日もゆっくり歩こう\n[00:16.00]遠くの空を見上げて\n[00:20.00]小さな光を集める\n[00:24.00]心に余白を残して\n[00:28.00]また新しい一日' },
].map(s => ({ ...s, audio: `/samples/${s.id}.wav`, artwork: `/samples/${s.id}.svg`, lyrics: parseLrc(s.lrc) }));
export type Sample = typeof samples[number];
