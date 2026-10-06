import { invoke, isTauri } from '@tauri-apps/api/core';
export const native = isTauri();
export type Session = {
  id: string; title: string; artist: string; album: string; artwork: string; duration: number; position: number;
  playing: boolean; canPlay: boolean; canPause: boolean; canNext: boolean; canPrevious: boolean; canStop: boolean;
};
export const getSessions = () => invoke<Session[]>('media_sessions');
export const mediaCommand = (id: string, title: string, action: string) => invoke<boolean>('media_command', { id, title, action });
export const browserPairing = () => invoke<{endpoint:string;token:string;error:string|null}>('browser_pairing');
export const openOverlay = () => invoke('open_overlay');
export type LyricResult = { id: number; trackName: string; artistName: string; albumName: string; duration: number; syncedLyrics: string | null; plainLyrics: string | null; instrumental: boolean; source?: string };
export const lookupLyrics = (session: Session) => invoke<LyricResult[]>('find_lyrics', { title:session.title, artist:session.artist, album:session.album, duration:session.duration });
export const showSettings = () => invoke('show_settings');
