import type { LyricResult, Session } from './native';

const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase()
  .replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

function quality(result: LyricResult) {
  if (result.syncedLyrics?.trim()) return 3;
  if (result.plainLyrics?.trim()) return 2;
  if (result.instrumental) return 1;
  return 0;
}

export function selectAutomaticLyrics(items: LyricResult[], session: Session): LyricResult | null {
  const title = normalize(session.title), artist = normalize(session.artist);
  if (!title || !artist) return null;
  const candidates = items.filter(item => {
    if (normalize(item.trackName) !== title || normalize(item.artistName) !== artist || !quality(item)) return false;
    // A different recording length can make timed lyrics visibly wrong.
    return !(session.duration > 0 && item.duration > 0 && Math.abs(item.duration - session.duration) > 3);
  });
  if (!candidates.length) return null;
  const scored = candidates.map(item => ({ item, score: quality(item) * 100
    + (session.album && normalize(item.albumName) === normalize(session.album) ? 10 : 0)
    + (session.duration > 0 && item.duration > 0 ? 5 - Math.abs(item.duration - session.duration) : 0) }));
  scored.sort((a, b) => b.score - a.score);
  if (scored.length > 1 && scored[0].score - scored[1].score < 2 && scored[0].item.syncedLyrics !== scored[1].item.syncedLyrics) return null;
  return scored[0].item;
}

export function lyricStatus(result: LyricResult) {
  const provider = result.source ? ` · ${result.source}` : '';
  if (result.instrumental && !result.syncedLyrics && !result.plainLyrics) return `Instrumental${provider}`;
  if (result.syncedLyrics?.trim()) return `Synced lyrics${provider}`;
  return `Unsynced lyrics${provider}`;
}
