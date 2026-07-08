// Avatar-/Profilfarben-Helfer. Zwei wählbare Reihen: kräftig + Pastell (gleiche Farbtöne).
export const PALETTE_NORMAL = ['#ff3b30', '#ff8c1a', '#ffc24b', '#3ddc84', '#1ec7da', '#3b82f6', '#a855f7', '#ec4899'];
export const PALETTE_PASTEL = ['#ff8a80', '#ffb570', '#ffd98a', '#8fe0b0', '#84d6e0', '#93b7f7', '#c9a3f5', '#f2a0c4'];
export const PALETTE = [...PALETTE_NORMAL, ...PALETTE_PASTEL];

/** Deterministische Fallback-Farbe aus dem Namen (falls keine Profilfarbe gesetzt). */
export function userColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** Profilfarbe wenn gesetzt, sonst Fallback. */
export function colorFor(name: string, stored?: string | null): string {
  return stored || userColor(name);
}

export function initials(name: string): string {
  return (name.trim().slice(0, 1) || '?').toUpperCase();
}
