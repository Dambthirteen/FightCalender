// Deterministische Avatar-Farbe + Initiale aus dem Namen (Platzhalter, bis
// echte Profilbilder/Profilfarben in der DB liegen).
const PALETTE = ['#ff3b30', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#1ec7da', '#ec4899', '#f5c518'];

export function userColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initials(name: string): string {
  return (name.trim().slice(0, 1) || '?').toUpperCase();
}
