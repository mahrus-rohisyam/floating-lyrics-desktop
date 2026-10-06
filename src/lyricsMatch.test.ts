import { describe, expect, it } from 'vitest';
import { selectAutomaticLyrics } from './lyricsMatch';
import type { LyricResult, Session } from './native';

const session: Session = { id:'player', title:'Song', artist:'Artist', album:'Album', artwork:'', duration:180,
  position:0, playing:true, canPlay:true, canPause:true, canNext:true, canPrevious:true, canStop:false };
const candidate = (changes: Partial<LyricResult> = {}): LyricResult => ({ id:1, trackName:'Song', artistName:'Artist',
  albumName:'Album', duration:180, syncedLyrics:'[00:01.00] Line', plainLyrics:'Line', instrumental:false, ...changes });

describe('automatic lyric matching', () => {
  it('prefers a synchronized exact version over plain lyrics', () => {
    expect(selectAutomaticLyrics([candidate({id:2,syncedLyrics:null}),candidate()],session)?.id).toBe(1);
  });
  it('rejects another recording and another artist even if their title matches', () => {
    expect(selectAutomaticLyrics([candidate({duration:240}),candidate({artistName:'Other'})],session)).toBeNull();
  });
  it('uses a single strong metadata match when player duration is unknown', () => {
    expect(selectAutomaticLyrics([candidate()],{...session,duration:0})?.id).toBe(1);
  });
  it('does not guess between conflicting equally scored synced versions', () => {
    expect(selectAutomaticLyrics([candidate(),candidate({id:2,syncedLyrics:'[00:03.00] Other'})],session)).toBeNull();
  });
  it('accepts an instrumental result as a truthful automatic state', () => {
    expect(selectAutomaticLyrics([candidate({syncedLyrics:null,plainLyrics:null,instrumental:true})],session)?.instrumental).toBe(true);
  });
});
