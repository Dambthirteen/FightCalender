// Avatar-/Profilfarben-Helfer.
export const PALETTE = ['#ff3b30', '#ff8c1a', '#ffc24b', '#3ddc84', '#1ec7da', '#3b82f6', '#a855f7', '#ec4899'];

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
