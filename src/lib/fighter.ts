// Kampfsport-Profil: Arten (+ Gürtelsysteme), Skills und Gesamtwert.
// Zentral & erweiterbar gehalten — neue Arten/Skills einfach hier ergänzen.

export interface MartialArt {
  key: string;
  label: string;
  belts: string[] | null; // null = kein Gürtelsystem
}

export const ARTS: MartialArt[] = [
  { key: 'bjj', label: 'BJJ', belts: ['Weiß', 'Blau', 'Lila', 'Braun', 'Schwarz'] },
  { key: 'luta', label: 'Luta Livre', belts: null },
  { key: 'judo', label: 'Judo', belts: ['Weiß', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'] },
  { key: 'wrestling', label: 'Ringen', belts: null },
  { key: 'sambo', label: 'Sambo', belts: null },
  { key: 'muaythai', label: 'Muay Thai', belts: null },
  { key: 'kickboxing', label: 'Kickboxen', belts: null },
  { key: 'boxing', label: 'Boxen', belts: null },
  { key: 'karate', label: 'Karate', belts: ['Weiß', 'Gelb', 'Orange', 'Grün', 'Blau', 'Braun', 'Schwarz'] },
  { key: 'taekwondo', label: 'Taekwondo', belts: ['Weiß', 'Gelb', 'Grün', 'Blau', 'Rot', 'Schwarz'] },
  { key: 'mma', label: 'MMA', belts: null },
  { key: 'kravmaga', label: 'Krav Maga', belts: null },
];

// Rolle im Profil/der Crew: reiner Fighter, reiner Coach, oder beides.
export type Role = 'fighter' | 'coach' | 'both';
export const ROLES: { key: Role; label: string; emoji: string }[] = [
  { key: 'fighter', label: 'Fighter', emoji: '🥊' },
  { key: 'coach', label: 'Coach', emoji: '🎓' },
  { key: 'both', label: 'Fighter & Coach', emoji: '🥊' },
];
export function isCoach(role: string | undefined | null): boolean {
  return role === 'coach' || role === 'both';
}
export function isFighter(role: string | undefined | null): boolean {
  return role === 'fighter' || role === 'both' || !role; // Standard = Fighter
}

export function artLabel(key: string): string {
  return ARTS.find((a) => a.key === key)?.label ?? key;
}
export function artBelts(key: string): string[] | null {
  return ARTS.find((a) => a.key === key)?.belts ?? null;
}

export const BELT_COLORS: Record<string, string> = {
  'Weiß': '#e5e5e5', 'Gelb': '#facc15', 'Orange': '#fb923c', 'Grün': '#22c55e',
  'Blau': '#3b82f6', 'Lila': '#a855f7', 'Rot': '#ef4444', 'Braun': '#7c4a1e', 'Schwarz': '#111111',
};

export const SKILLS = [
  { key: 'striking', label: 'Striking' },
  { key: 'clinch', label: 'Clinch' },
  { key: 'wrestling', label: 'Wrestling' },
  { key: 'grappling', label: 'Grappling' },
  { key: 'gnp', label: 'Ground & Pound' },
] as const;

export type SkillKey = (typeof SKILLS)[number]['key'];
export type Skills = Partial<Record<SkillKey, number>>; // 0–100 (in 20er-Schritten)

export interface MartialArtEntry { art: string; belt: string | null }

/** Gesamtwert aus den 5 Skills: Single Discipline … Allrounder. */
export function overallRating(skills: Skills | undefined | null): { label: string; tier: number; color: string } {
  const vals = SKILLS.map((s) => Number(skills?.[s.key] ?? 0));
  const total = vals.reduce((a, b) => a + b, 0);
  if (total === 0) return { label: 'Unbewertet', tier: 0, color: 'var(--faint)' };
  const developed = vals.filter((v) => v >= 40).length; // „beherrscht" = Level ≥ 2/5
  const avg = total / SKILLS.length;
  if (developed === 0) return { label: 'Rookie', tier: 1, color: '#9ca3af' };
  if (developed === 1) return { label: 'Single Discipline', tier: 2, color: '#3b82f6' };
  if (developed === 2) return { label: 'Dual Threat', tier: 3, color: '#1ec7da' };
  if (developed === 3) return { label: 'Hybrid-Kämpfer', tier: 4, color: '#22c55e' };
  if (developed === 4) return { label: 'Vielseitig', tier: 5, color: '#ffc24b' };
  return { label: avg >= 80 ? 'Complete Fighter' : 'Allrounder', tier: 6, color: '#ff3b30' };
}
