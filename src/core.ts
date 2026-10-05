export type LyricLine = { time: number; text: string };
export type Mode = 'lyrics' | 'island';
export const fonts = { 'dm-sans': ['DM Sans', "'DM Sans', system-ui, sans-serif"], manrope: ['Manrope', 'Manrope, system-ui, sans-serif'], system: ['System', 'system-ui, sans-serif'], serif: ['Serif', "Georgia, 'Times New Roman', serif"], mono: ['Mono', "ui-monospace, 'Cascadia Mono', Consolas, monospace"] } as const;
export type Font = keyof typeof fonts;
export type Bounds = { x: number; y: number; width: number; height: number };
export type Settings = {
  version: 1; mode: Mode; preset: 'minimal' | 'subtitle' | 'card'; fontSize: number;
  weight: number; color: string; opacity: number; lines: number; align: 'left' | 'center' | 'right';
  collapseDelay: number; offset: number; reducedMotion: boolean; focus: boolean; font: Font;
  songInfo: boolean; bounds: Bounds; islandBounds: Bounds;
};
export const defaults: Settings = {
  version: 1, mode: 'lyrics', preset: 'minimal', fontSize: 28, weight: 500, color: '#f4f8ed',
  opacity: 28, lines: 3, align: 'center', collapseDelay: 2000, offset: 0, focus: false, font: 'dm-sans',
  reducedMotion: false, songInfo: true, bounds: { x: 120, y: 120, width: 440, height: 230 },
  islandBounds: { x: 244, y: 50, width: 180, height: 56 },
};
export const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
export function parseLrc(text: string): LyricLine[] {
  const offset = Number(text.match(/\[offset:([+-]?\d+)\]/i)?.[1] || 0) / 1000;
  const lines: LyricLine[] = [];
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const stamps = [...raw.matchAll(/\[(\d+):(\d{2})(?:[.:,](\d{1,3}))?\]/g)];
    const lyric = raw.replace(/\[[^\]]*\]/g, '').trim();
    for (const stamp of stamps) {
      if (Number(stamp[2]) >= 60) continue;
      const fraction = Number((stamp[3] || '').padEnd(3, '0')) / 1000;
      lines.push({ time: Math.max(0, Number(stamp[1]) * 60 + Number(stamp[2]) + fraction - offset), text: lyric });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}
export function activeLine(lines: LyricLine[], position: number, offsetMs = 0) {
  let lo = 0, hi = lines.length - 1, result = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time <= position + offsetMs / 1000) { result = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return result;
}
export function constrainBounds(b: Bounds, width: number, height: number): Bounds {
  const w = clamp(b.width, Math.min(160, width), width), h = clamp(b.height, Math.min(48, height), height);
  return { width: w, height: h, x: clamp(b.x, 0, Math.max(0, width - w)), y: clamp(b.y, 0, Math.max(0, height - h)) };
}
export function resizeBounds(start: Bounds, dx: number, dy: number, corner: string, width: number, height: number): Bounds {
  const minW = Math.min(240, width), minH = Math.min(100, height);
  let left = start.x, top = start.y, right = start.x + start.width, bottom = start.y + start.height;
  if (corner.includes('w')) left = clamp(start.x + dx, 0, right - minW);
  if (corner.includes('e')) right = clamp(right + dx, left + minW, width);
  if (corner.includes('n')) top = clamp(start.y + dy, 0, bottom - minH);
  if (corner.includes('s')) bottom = clamp(bottom + dy, top + minH, height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
export function readSettings(raw: string | null): Settings {
  try {
    const s = JSON.parse(raw || 'null');
    if (!s || s.version !== 1) return structuredClone(defaults);
    const number = (key: keyof Settings, min: number, max: number) => typeof s[key] === 'number' && Number.isFinite(s[key]) ? clamp(s[key], min, max) : defaults[key];
    const bounds = (key: 'bounds' | 'islandBounds') => s[key] && ['x','y','width','height'].every(k => typeof s[key][k] === 'number' && Number.isFinite(s[key][k])) ? constrainBounds(s[key], 4000, 3000) : defaults[key];
    return { ...defaults, mode: s.mode === 'island' ? 'island' : 'lyrics',
      preset: ['minimal','subtitle','card'].includes(s.preset) ? s.preset : 'minimal',
      fontSize: number('fontSize', 16, 64) as number, weight: number('weight', 400, 700) as number,
      color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : defaults.color,
      opacity: number('opacity', 0, 100) as number, lines: [1,2,3].includes(s.lines) ? s.lines : 3,
      align: ['left','center','right'].includes(s.align) ? s.align : 'center',
      collapseDelay: number('collapseDelay', 500, 5000) as number, focus: s.focus === true,
      font: typeof s.font === 'string' && Object.keys(fonts).includes(s.font) ? s.font : defaults.font,
      offset: 0, reducedMotion: s.reducedMotion === true, songInfo: s.songInfo !== false, bounds: bounds('bounds'), islandBounds: bounds('islandBounds') };
  } catch { return structuredClone(defaults); }
}
export const formatTime = (s: number) => `${Math.floor(Math.max(0,s)/60)}:${String(Math.floor(Math.max(0,s)%60)).padStart(2,'0')}`;
