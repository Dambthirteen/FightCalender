/**
 * Customization (Level-System Phase 2) — der „Spind".
 * Jedes Cosmetic schaltet ab einem Level frei. Reine CSS-Looks (keine Assets).
 * Equippte Auswahl liegt in users.cosmetics (JSONB): { nameplate, avatarFrame, flame }.
 */
import type { CSSProperties } from 'react';

export type CosmeticCategory = 'nameplate' | 'avatarFrame' | 'flame' | 'belt' | 'xpbar';
export interface CosmeticItem { id: string; label: string; minLevel: number; sku?: string }

/** Premium-Farben der XP-Leiste (Supporter). 'default' = Rangfarbe (kein Override). */
export const XPBAR_COLORS: Record<string, string> = {
  crimson: '#ff3b30', orange: '#f59e0b', gold: '#f5c518', lime: '#84cc16', green: '#22c55e',
  teal: '#2dd4bf', sky: '#38bdf8', blue: '#3b82f6', purple: '#a855f7', pink: '#ec4899',
};
export function xpBarColor(id?: string): string | null {
  if (!id || id === 'default') return null;
  return XPBAR_COLORS[id] ?? null;
}

/** Gürtel-Skins. Gleiches Template (8779×2000) → identische Plattengeometrie,
 *  nur Bild + Clantag-Farbe unterscheiden sich. */
export interface BeltSkin { src: string; clanColor: string }
export const BELT_SKINS: Record<string, BeltSkin> = {
  default: { src: '/belt.png', clanColor: '#1a1a1a' },
  ice: { src: '/belt2.png', clanColor: '#16324a' },
  fire: { src: '/belt3.png', clanColor: '#3a1e00' },
};
export function beltSkin(id?: string): BeltSkin {
  return BELT_SKINS[id ?? 'default'] ?? BELT_SKINS.default;
}

export const COSMETICS: Record<CosmeticCategory, { label: string; items: CosmeticItem[] }> = {
  nameplate: {
    label: 'Namens-Stil',
    items: [
      { id: 'default', label: 'Standard', minLevel: 1 },
      { id: 'gold', label: 'Gold', minLevel: 3 },
      { id: 'glow', label: 'Glow', minLevel: 8 },
      { id: 'goldgrad', label: 'Gold-Verlauf', minLevel: 15 },
      { id: 'rainbow', label: 'Regenbogen', minLevel: 30 },
    ],
  },
  avatarFrame: {
    label: 'Avatar-Rahmen',
    items: [
      { id: 'default', label: 'Standard', minLevel: 1 },
      { id: 'gold', label: 'Gold', minLevel: 5 },
      { id: 'neon', label: 'Neon', minLevel: 12 },
      { id: 'pulse', label: 'Puls', minLevel: 20 },
    ],
  },
  flame: {
    label: 'Flammen-Farbe',
    items: [
      { id: 'default', label: 'Orange', minLevel: 1 },
      { id: 'blue', label: 'Blau', minLevel: 5 },
      { id: 'purple', label: 'Lila', minLevel: 10 },
      { id: 'green', label: 'Grün', minLevel: 18 },
    ],
  },
  belt: {
    label: 'Gürtel-Skin',
    items: [
      { id: 'default', label: 'Klassisch', minLevel: 1 },
      { id: 'ice', label: 'Eis', minLevel: 1 }, // zum Testen auf Level 1
      { id: 'fire', label: 'Fire', minLevel: 5 },
    ],
  },
  xpbar: {
    label: 'XP-Leiste',
    items: [
      { id: 'default', label: 'Standard', minLevel: 1 },
      { id: 'crimson', label: 'Rot', minLevel: 1, sku: 'supporter' },
      { id: 'orange', label: 'Orange', minLevel: 1, sku: 'supporter' },
      { id: 'gold', label: 'Gold', minLevel: 1, sku: 'supporter' },
      { id: 'lime', label: 'Limette', minLevel: 1, sku: 'supporter' },
      { id: 'green', label: 'Grün', minLevel: 1, sku: 'supporter' },
      { id: 'teal', label: 'Türkis', minLevel: 1, sku: 'supporter' },
      { id: 'sky', label: 'Himmel', minLevel: 1, sku: 'supporter' },
      { id: 'blue', label: 'Blau', minLevel: 1, sku: 'supporter' },
      { id: 'purple', label: 'Lila', minLevel: 1, sku: 'supporter' },
      { id: 'pink', label: 'Pink', minLevel: 1, sku: 'supporter' },
    ],
  },
};

/** Prüft, ob ein Item existiert und ab welchem Level es gilt (-1 = unbekannt). */
export function minLevelFor(category: string, itemId: string): number {
  const cat = COSMETICS[category as CosmeticCategory];
  if (!cat) return -1;
  return cat.items.find((i) => i.id === itemId)?.minLevel ?? -1;
}

/** SKU (z. B. 'plus'), falls das Item nur per Kauf/Entitlement freischaltbar ist — sonst null. */
export function skuFor(category: string, itemId: string): string | null {
  const cat = COSMETICS[category as CosmeticCategory];
  return cat?.items.find((i) => i.id === itemId)?.sku ?? null;
}

// ---- Style-Resolver (im UI angewandt) ----

export function nameplateStyle(id?: string): CSSProperties {
  switch (id) {
    case 'gold': return { color: 'var(--gold)' };
    case 'glow': return { color: '#fff', textShadow: '0 0 16px var(--accent)' };
    case 'goldgrad': return { background: 'linear-gradient(90deg,#ffe08a,#f5a623)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
    case 'rainbow': return { background: 'linear-gradient(90deg,#ff3b30,#ffc24b,#3ddc84,#1ec7da,#a855f7)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' };
    default: return {};
  }
}

export function avatarFrame(id: string | undefined, color: string): { style: CSSProperties; className?: string } {
  switch (id) {
    case 'gold': return { style: { border: '3px solid var(--gold)', boxShadow: '0 0 36px rgba(255,194,75,0.45)' } };
    case 'neon': return { style: { border: '3px solid #a855f7', boxShadow: '0 0 30px rgba(168,85,247,0.6)' } };
    case 'pulse': return { style: { border: `3px solid ${color}` }, className: 'frame-pulse' };
    default: return { style: { border: `2px solid ${color}`, boxShadow: `0 0 40px ${color}33` } };
  }
}

/** CSS-Filter zum Einfärben der orangenen 🔥-Emoji. */
export function flameFilter(id?: string): string | undefined {
  switch (id) {
    case 'blue': return 'hue-rotate(185deg) saturate(1.4)';
    case 'purple': return 'hue-rotate(255deg) saturate(1.25)';
    case 'green': return 'hue-rotate(85deg) saturate(1.25)';
    default: return undefined;
  }
}
