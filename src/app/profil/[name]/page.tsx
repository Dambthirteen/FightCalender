'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';
import { ARTS, SKILLS, BELT_COLORS, ROLES, isCoach, artLabel, artBelts, overallRating, type MartialArtEntry, type Skills } from '@/lib/fighter';
import { GENDERS, athleteLabel, competitorLabel, trainerLabel, macherMonth } from '@/lib/gender';
import { nextStreakBadge, STREAK_BADGES, COMPETITION_BADGES, FIGHT_BADGES, TOURNAMENT_BADGES, JUDGE_BADGES, SPECIAL_BADGES, SECRET_BADGES } from '@/lib/badges';
import XpBar, { type XpData } from '@/components/XpBar';
import FullscreenLoader from '@/components/FullscreenLoader';
import { nameplateStyle, avatarFrame, flameFilter, beltSkin, beltFxClass, xpBarColor } from '@/lib/cosmetics';

interface BadgeInfo { id: string; label: string; emoji: string; kind: string; hint: string }
interface BadgeData { streakDays: number; streakWeeks: number; longest: number; competitions: number; earned: BadgeInfo[]; displayed: string[]; clanTag?: string | null; points?: number; adAvailable?: boolean }

// Championship-Belt: Clantag mittig (schwarz), 4 ausgestellte Badges auf den Achtecken.
// Gemessene Achteck-Zentren (% der Breite). Füll-Reihenfolge von INNEN nach außen,
// damit 1 Badge neben dem Clantag sitzt und 2 symmetrisch sind:
// inner-links · inner-rechts · outer-links · outer-rechts.
const BELT_SLOTS = [32, 67.9, 21.4, 78.6];
// Slot-Geometrie je Gürteltyp: Championship = mittige Platte + Seitenplatten;
// BJJ = Strap, Clantag mittig + Trophäen in einer Reihe darauf.
const BJJ_SLOTS = [13, 21, 29, 37];
function Belt({ clanTag, badges, onBadge, skin, fx }: { clanTag: string | null; badges: BadgeInfo[]; onBadge?: (b: BadgeInfo) => void; skin?: string; fx?: string }) {
  const s = beltSkin(skin);
  const slots = s.bjj ? BJJ_SLOTS : BELT_SLOTS;
  const clanLeft = s.bjj ? '47%' : '49.8%';
  const clanTop = s.bjj ? '53%' : '53%';
  const badgeTop = s.bjj ? '53%' : '48%';
  const badgeSize = s.bjj ? '5cqw' : '5.5cqw';
  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1400 / 319', containerType: 'inline-size' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={s.src} alt="Gürtel" className={`w-full h-full object-contain pointer-events-none ${beltFxClass(fx)}`} />
      {clanTag && (
        <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: clanLeft, top: clanTop }}>
          <span className="font-display tracking-wide" style={{ color: s.clanColor, fontSize: '6.5cqw', lineHeight: 1 }}>{clanTag}</span>
        </div>
      )}
      {slots.map((x, i) => badges[i] ? (
        <button key={i} type="button" onClick={() => onBadge?.(badges[i])} aria-label={badges[i].label}
          className="absolute -translate-x-1/2 -translate-y-1/2 active:scale-90 transition-transform"
          style={{ left: `${x}%`, top: badgeTop }}>
          <span style={{ fontSize: badgeSize, lineHeight: 1, display: 'block' }}>{badges[i].emoji}</span>
        </button>
      ) : null)}
    </div>
  );
}

interface YearRow { user_name: string; total: number }

// Bild im Browser auf 256×256 (cover) verkleinern → JPEG-Data-URL.
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Pinnwand-Foto: Seitenverhältnis behalten, progressiv verkleinern (max 1280px) und
// JPEG-Qualität senken, bis die Data-URL sicher unter ~700 KB liegt.
function compressPhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const tries: Array<[number, number]> = [[1280, 0.72], [1280, 0.6], [1024, 0.6], [800, 0.55], [640, 0.5]];
      let out = '';
      for (const [maxDim, q] of tries) {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { const s = maxDim / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('no ctx')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        out = canvas.toDataURL('image/jpeg', q);
        if (out.length <= 700_000) { resolve(out); return; }
      }
      resolve(out); // bestmögliche (kleinste) Version
    };
    img.onerror = reject;
    img.src = url;
  });
}

function Stat({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div className="card flex-1 min-w-0 px-2 py-3.5 text-center">
      <div className="font-display text-3xl tnum" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mt-1 leading-tight">{label}</div>
    </div>
  );
}

const TABS = [['fighter', 'Fighter'], ['stats', 'Stats'], ['plan', 'Plan'], ['ehrungen', 'Ehrungen'], ['pinnwand', 'Pinnwand']] as const;
type Tab = (typeof TABS)[number][0];

// Kursfarben (wie auf der Startseite) → für den Trainingsplan.
const CLASS_COLOR: Record<string, string> = {
  red: '#ff8a80', blue: '#93b7f7', green: '#8fe0b0', orange: '#ffbf80', purple: '#c9a3f5',
};
const classHex = (c: string) => CLASS_COLOR[c] ?? CLASS_COLOR.red;
const DAY_FULL = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const PLACEMENT_MED: Record<string, string> = { gold: '🥇 1. Platz', silver: '🥈 2. Platz', bronze: '🥉 3. Platz', part: 'Teilnahme' };
type CompRow = { id: number; name: string; competition_date: string; weight_class: string | null; result: string | null; method: string | null; placement: string | null };

interface FighterInfo {
  role?: string; // 'fighter' | 'coach' | 'both'
  athlete?: string; // 'hobby' | 'competitor'
  gender?: string; // 'm' | 'f' | 'd'
  trainingSince?: string; // 'YYYY-MM'
  coachingSince?: string; // 'YYYY-MM' (Trainer seit)
  coachingArts?: string[]; // Kampfsportarten, die der Coach trainiert
  licenses?: string; // Trainerlizenzen/Zertifikate
  weightKg?: number; heightCm?: number; stance?: string;
  nickname?: string; gym?: string; instagram?: string; goal?: string;
}
// Gewichtsklasse aus kg (grobe Standard-Divisionen).
function weightClass(kg: number): string {
  const C: [number, string][] = [
    [56.7, 'Flyweight'], [61.2, 'Bantamweight'], [65.8, 'Featherweight'],
    [70.3, 'Lightweight'], [77.1, 'Welterweight'], [83.9, 'Middleweight'],
    [93.0, 'Light Heavyweight'], [120.2, 'Heavyweight'],
  ];
  for (const [max, name] of C) if (kg <= max) return name;
  return 'Super Heavyweight';
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-semibold text-right">{value}</span>
    </div>
  );
}

// 'YYYY-MM' → „seit 03/2019 · 7 Jahre"
function trainingLabel(since: string): string {
  const m = since.match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return since;
  const y = parseInt(m[1], 10);
  const mo = m[2] ? parseInt(m[2], 10) : 1;
  const now = new Date();
  let years = now.getFullYear() - y;
  let months = now.getMonth() + 1 - mo;
  if (months < 0) { years -= 1; months += 12; }
  const start = m[2] ? `${m[2]}/${m[1]}` : m[1];
  if (years <= 0 && months <= 0) return `seit ${start}`;
  if (years <= 0) return `seit ${start} · ${months} Mon.`;
  return `seit ${start} · ${years} ${years === 1 ? 'Jahr' : 'Jahre'}`;
}

export default function ProfilePage() {
  const params = useParams();
  const name = decodeURIComponent((params.name as string) ?? '');
  const { userName, loading: userLoading } = useUser();
  const isSelf = userName === name;

  const [ready, setReady] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [bio, setBio] = useState('');
  const [bioEdit, setBioEdit] = useState('');
  const [color, setColor] = useState<string | null>(null);
  const [macherYear, setMacherYear] = useState<number | null>(null);
  const [bitchYear, setBitchYear] = useState<number | null>(null);
  const [stats, setStats] = useState<{ macherTitles: number; bitchTitles: number; daysOut: number } | null>(null);
  const [statMode, setStatMode] = useState<'xp' | 'streak'>('xp'); // Tap auf die Leiste wechselt XP ↔ Streak
  const [arts, setArts] = useState<MartialArtEntry[]>([]);
  const [skills, setSkills] = useState<Skills>({});
  const [comps, setComps] = useState<CompRow[]>([]);
  const [fighterInfo, setFighterInfo] = useState<FighterInfo>({});
  const [xp, setXp] = useState<XpData | null>(null);
  const [cosmetics, setCosmetics] = useState<Record<string, string>>({});
  const [supporter, setSupporter] = useState(false);
  // Trainingsplan (fester Plan je Gruppe) fürs Profil.
  const [planGroups, setPlanGroups] = useState<{ id: number; name: string }[]>([]);
  const [planClasses, setPlanClasses] = useState<{ id: number; name: string; day_of_week: number; start_time: string; end_time: string; color: string; group_id: number }[]>([]);
  const [planGroupSel, setPlanGroupSel] = useState<number | null>(null);
  const [priv, setPriv] = useState(false);
  const [savingBio, setSavingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Kommentare, Skilltree-Anfechtungen, Lob/Gigalob
  const [comments, setComments] = useState<{ id: number; author_name: string; body: string; image?: string | null; created_at: string }[]>([]);
  const [commentImage, setCommentImage] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [challenges, setChallenges] = useState<{ id: number; challenger_name: string; proposal: Record<string, number>; note: string; created_at: string }[]>([]);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [proposal, setProposal] = useState<Record<string, number>>({});
  const [challengeNote, setChallengeNote] = useState('');
  const [submittingChallenge, setSubmittingChallenge] = useState(false);
  const [praises, setPraises] = useState<{ id: number; kind: string; from_user: string; reason: string; show_comment: boolean; created_at: string }[]>([]);
  const [praiseStatus, setPraiseStatus] = useState<{ lob: boolean; gigalob: boolean }>({ lob: false, gigalob: false });
  const [praiseKind, setPraiseKind] = useState<'lob' | 'gigalob' | null>(null);
  const [praiseReason, setPraiseReason] = useState('');
  const [givingPraise, setGivingPraise] = useState(false);
  const [praiseMsg, setPraiseMsg] = useState('');
  const [confirmPraise, setConfirmPraise] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('fighter');
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null);
  const [claimingAd, setClaimingAd] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [beltBadge, setBeltBadge] = useState<BadgeInfo | null>(null);
  const [editMode, setEditMode] = useState(false);

  const c = colorFor(name, color);

  useEffect(() => {
    setReady(false);
    // Layout-relevante Daten (bestimmen die Höhe/Struktur der Seite): erst wenn ALLE
    // da sind, wird die Seite gezeigt — sonst „baut" sie sich sichtbar nach.
    const pInfo = fetch(`/api/profile-info?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) {
        setPriv(d.private === true);
        setAvatar(d.avatar ?? null); setColor(d.color ?? null);
        setSupporter(!!d.supporter);
        if (!d.private) {
          setBio(d.bio ?? ''); setBioEdit(d.bio ?? '');
          setArts(Array.isArray(d.martial_arts) ? d.martial_arts : []);
          setSkills(d.skills && typeof d.skills === 'object' ? d.skills : {});
          setFighterInfo(d.fighter_info && typeof d.fighter_info === 'object' ? d.fighter_info : {});
          setCosmetics(d.cosmetics && typeof d.cosmetics === 'object' ? d.cosmetics : {});
        }
      }
    }).catch(() => {});
    const pStats = fetch(`/api/profile-stats?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) setStats(d);
    }).catch(() => {});
    const pYear = fetch(`/api/year?year=${new Date().getFullYear()}`).then((r) => r.json()).then((d) => {
      setMacherYear((d.macher as YearRow[] | undefined)?.find((x) => x.user_name === name)?.total ?? 0);
      setBitchYear((d.bitch as YearRow[] | undefined)?.find((x) => x.user_name === name)?.total ?? 0);
    }).catch(() => {});
    const pBadges = fetch(`/api/badges?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => { if (d && !d.error && !d.private) setBadgeData(d); }).catch(() => {});
    const pXp = fetch(`/api/xp?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => { if (d && !d.error && !d.private) setXp(d); }).catch(() => {});
    const pPlan = fetch(`/api/profile/plan?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => {
      if (d && !d.error) {
        const gs = Array.isArray(d.groups) ? d.groups : [];
        setPlanGroups(gs); setPlanClasses(Array.isArray(d.classes) ? d.classes : []);
        setPlanGroupSel((prev) => prev ?? gs[0]?.id ?? null);
      }
    }).catch(() => {});
    Promise.all([pInfo, pStats, pYear, pBadges, pXp, pPlan]).finally(() => setReady(true));

    // Tab-Inhalte (Pinnwand/Ehrungen) im Hintergrund — blockieren den Ladebildschirm nicht.
    fetch(`/api/comments?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setComments(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/challenges?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setChallenges(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/praise?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setPraises(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`/api/profile/competitions?user=${encodeURIComponent(name)}`).then((r) => r.json()).then((d) => setComps(Array.isArray(d) ? d : [])).catch(() => {});
  }, [name]);

  // Lob/Gigalob-Verfügbarkeit des Betrachters (für die Buttons auf fremden Profilen)
  useEffect(() => {
    if (!userName || userName === name) return;
    fetch('/api/praise/status').then((r) => r.json()).then((d) => setPraiseStatus({ lob: !!d.lob, gigalob: !!d.gigalob })).catch(() => {});
  }, [userName, name]);

  // Admin-Zugang nur auf dem EIGENEN Profil eines Admins (sonst nirgends sichtbar).
  useEffect(() => {
    if (!isSelf) return;
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const groups = (d.groups ?? []) as { role: string }[];
      setIsAdmin(groups.some((g) => g.role === 'admin'));
    }).catch(() => {});
  }, [isSelf]);

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch('/api/profile-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      if (res.ok) setAvatar(dataUrl);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function saveBio() {
    setSavingBio(true);
    try {
      await fetch('/api/profile-info', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: bioEdit }),
      });
      setBio(bioEdit);
    } finally {
      setSavingBio(false);
    }
  }

  async function saveArts(next: MartialArtEntry[]) {
    setArts(next);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ martial_arts: next }) }).catch(() => {});
  }
  function toggleArt(key: string) {
    const exists = arts.some((m) => m.art === key);
    saveArts(exists ? arts.filter((m) => m.art !== key) : [...arts, { art: key, belt: null }]);
  }
  function setBelt(key: string, belt: string | null) {
    saveArts(arts.map((m) => (m.art === key ? { ...m, belt } : m)));
  }
  async function saveSkills(next: Skills) {
    setSkills(next);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skills: next }) }).catch(() => {});
  }
  function setSkill(key: string, level: number) {
    const cur = Number(skills[key as keyof Skills] ?? 0);
    const val = cur === level * 20 ? (level - 1) * 20 : level * 20; // gleichen Balken nochmal tippen → einen runter
    saveSkills({ ...skills, [key]: val });
  }
  // Fighter-Eckdaten (trainiert seit, Gewicht, …) — speichert das ganze Objekt.
  async function saveFighter(next: FighterInfo) {
    setFighterInfo(next);
    await fetch('/api/profile-info', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fighter_info: next }) }).catch(() => {});
  }
  function setFighterField(key: keyof FighterInfo, value: string | number | undefined) {
    const next = { ...fighterInfo };
    if (value === undefined || value === '') delete next[key];
    else (next as Record<string, string | number>)[key] = value;
    saveFighter(next);
  }
  function toggleCoachingArt(artKey: string) {
    const cur = fighterInfo.coachingArts ?? [];
    const next = { ...fighterInfo, coachingArts: cur.includes(artKey) ? cur.filter((a) => a !== artKey) : [...cur, artKey] };
    saveFighter(next);
  }

  // --- Kommentare ---
  async function postComment() {
    const text = newComment.trim();
    if ((!text && !commentImage) || postingComment || imgBusy) return;
    setPostingComment(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: name, body: text, image: commentImage }),
      });
      if (res.ok) { const cm = await res.json(); setComments((prev) => [...prev, cm]); setNewComment(''); setCommentImage(null); }
    } finally { setPostingComment(false); }
  }
  async function onPickCommentImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgBusy(true);
    try { setCommentImage(await compressPhoto(file)); }
    catch { /* ignorieren */ }
    finally { setImgBusy(false); e.target.value = ''; }
  }
  async function deleteComment(id: number) {
    await fetch('/api/comments', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {});
    setComments((prev) => prev.filter((cm) => cm.id !== id));
  }

  // --- Skilltree anfechten ---
  function openChallenge() {
    const init: Record<string, number> = {};
    for (const s of SKILLS) init[s.key] = Math.round(Number(skills[s.key] ?? 0) / 20);
    setProposal(init); setChallengeNote(''); setChallengeOpen(true);
  }
  async function submitChallenge() {
    if (submittingChallenge) return;
    const changed: Record<string, number> = {};
    for (const s of SKILLS) {
      const cur = Math.round(Number(skills[s.key] ?? 0) / 20);
      if (proposal[s.key] !== cur) changed[s.key] = proposal[s.key];
    }
    if (Object.keys(changed).length === 0) { setChallengeOpen(false); return; }
    setSubmittingChallenge(true);
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: name, proposal: changed, note: challengeNote }),
      });
      if (res.ok) setChallengeOpen(false);
    } finally { setSubmittingChallenge(false); }
  }
  async function resolveChallenge(id: number, action: 'accept' | 'reject') {
    const res = await fetch(`/api/challenges/${id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setChallenges((prev) => prev.filter((ch) => ch.id !== id));
      if (action === 'accept') {
        fetch(`/api/profile-info?user=${encodeURIComponent(name)}`).then((r) => r.json())
          .then((d) => { if (d && !d.error && d.skills) setSkills(d.skills); }).catch(() => {});
      }
    }
  }

  // --- Lob / Gigalob vergeben ---
  async function givePraise() {
    if (!praiseKind || givingPraise) return;
    setGivingPraise(true); setPraiseMsg('');
    try {
      const res = await fetch('/api/praise', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: name, kind: praiseKind, reason: praiseReason }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setPraiseStatus((s) => (praiseKind === 'gigalob' ? { ...s, gigalob: false } : { ...s, lob: false }));
        setPraiseKind(null); setPraiseReason(''); setPraiseMsg('Gesendet!');
      } else {
        setPraiseMsg(d.error ?? 'Fehler');
      }
    } finally { setGivingPraise(false); setConfirmPraise(false); }
  }

  // Werbung-Platzhalter: 1 Streak-Punkt (max. 1×/Woche).
  async function claimAdPoint() {
    if (!badgeData || claimingAd) return;
    setClaimingAd(true);
    try {
      const res = await fetch('/api/streak/ad-point', { method: 'POST' });
      const d = await res.json().catch(() => ({}));
      setBadgeData({ ...badgeData, points: d.granted ? d.points : badgeData.points, adAvailable: false });
    } finally { setClaimingAd(false); }
  }

  // Bis zu 4 Abzeichen am Profil-Kopf ausstellen (nur eigenes Profil).
  async function toggleBadge(id: string) {
    if (!badgeData) return;
    const cur = badgeData.displayed;
    let next: string[];
    if (cur.includes(id)) next = cur.filter((x) => x !== id);
    else { if (cur.length >= 4) return; next = [...cur, id]; }
    setBadgeData({ ...badgeData, displayed: next });
    await fetch('/api/badges', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ badges: next }) }).catch(() => {});
  }

  const canInteract = !priv && !!userName;
  const displayedBadges = badgeData
    ? badgeData.displayed.map((id) => badgeData.earned.find((b) => b.id === id)).filter((b): b is BadgeInfo => !!b)
    : [];
  const nextBadge = badgeData ? nextStreakBadge(badgeData.streakWeeks) : null;
  const earnedSet = new Set(badgeData?.earned.map((b) => b.id) ?? []);
  const editing = isSelf && editMode; // Bearbeitungsmodus (Standard = Außenansicht)
  const year = new Date().getFullYear();
  const frame = avatarFrame(cosmetics.avatarFrame, c); // Spind: Avatar-Rahmen
  const streakDays = badgeData?.streakDays ?? 0;

  // Ausgestellte Abzeichen (für die read-only-Anzeige auf fremden Profilen).
  const displayedBadgeInfos = (badgeData?.earned ?? []).filter((b) => (badgeData?.displayed ?? []).includes(b.id));
  // Abzeichen-Karte nur zeigen, wenn eigenes Profil ODER die Person Abzeichen ausgestellt hat.
  const showBadgesCard = isSelf || displayedBadgeInfos.length > 0;
  const badgesCard = (
    <div className="card px-4 py-4">
      <div className="section-label mb-3">Abzeichen</div>
      {isSelf ? (
        <>
          {nextBadge && (
            <div className="text-xs text-[var(--muted)] mb-3">
              Noch {nextBadge.threshold - (badgeData?.streakWeeks ?? 0)} Wo. bis <strong>{nextBadge.emoji} {nextBadge.label}</strong>
            </div>
          )}
          <div className="text-xs text-[var(--muted)] mb-3">
            Streak-Punkte: <strong style={{ color: 'var(--text)' }}>{badgeData?.points ?? 0}</strong>
            {badgeData?.adAvailable && (
              <button onClick={claimAdPoint} disabled={claimingAd}
                className="ml-2 text-[11px] font-semibold px-2 py-1 rounded-lg border border-[var(--border)] disabled:opacity-40"
                style={{ color: 'var(--accent-2)' }}>
                {claimingAd ? '…' : 'Werbung'}
              </button>
            )}
          </div>
          {/* Volles Raster nur im Bearbeiten-Modus — sonst überlädt das Profil. */}
          {editing && badgeData && badgeData.earned.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {badgeData.earned.map((b) => {
                  const on = badgeData.displayed.includes(b.id);
                  const cls = 'flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all active:scale-95';
                  const style = on
                    ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-2)' }
                    : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)' };
                  return (
                    <button key={b.id} onClick={() => toggleBadge(b.id)} className={cls} style={style}>
                      <span className="text-2xl leading-none">{b.emoji}</span>
                      <span className="text-[10px] font-semibold leading-tight">{b.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-[var(--faint)] mt-2">Tippe an, um bis zu 4 auszustellen</p>
            </>
          )}
          <button onClick={() => setShowAllBadges(true)} className="mt-3 text-xs font-semibold" style={{ color: 'var(--teal)' }}>
            Alle Achievements anzeigen ›
          </button>
        </>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {displayedBadgeInfos.map((b) => (
            <div key={b.id} className="flex flex-col items-center gap-1 rounded-xl border p-2 text-center"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}>
              <span className="text-2xl leading-none">{b.emoji}</span>
              <span className="text-[9px] font-semibold leading-tight">{b.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (userLoading || !ready) return <FullscreenLoader />;

  return (
    <div className="min-h-screen text-[var(--text)]">
      <header className="max-w-md mx-auto px-4 pt-5 pb-2 grid grid-cols-3 items-center anim-in">
        <a href="/start" aria-label="Zurück" className="justify-self-start w-11 h-11 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        <h1 className="font-display text-xl tracking-wide text-center flex items-center justify-center gap-1.5 min-w-0">
          <span className="truncate" style={nameplateStyle(cosmetics.nameplate)}>{name}</span>
          {supporter && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/supporter-star.png" alt="Supporter" title="Supporter" width={14} height={14} className="shrink-0" style={{ transform: 'translateY(-2px)' }} />
          )}
        </h1>
        <div className="justify-self-end">
          {isSelf && (
            <button onClick={() => setEditMode((v) => !v)}
              className="h-11 px-3 grid place-items-center rounded-xl border bg-[var(--surface)] text-xs font-semibold transition-all active:scale-95"
              style={editMode ? { color: 'var(--accent)', borderColor: 'var(--accent)' } : { color: 'var(--muted)', borderColor: 'var(--border-soft)' }}>
              {editMode ? 'Fertig' : 'Bearbeiten'}
            </button>
          )}
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pb-24">
        {/* Identität */}
        <div className="flex flex-col items-center text-center anim-up pt-1">
          <button
            onClick={() => editing && fileRef.current?.click()}
            disabled={!editing || uploading}
            className={`relative w-24 h-24 rounded-full mb-2.5 overflow-hidden grid place-items-center ${frame.className ?? ''}`}
            style={{ background: avatar ? 'transparent' : `${c}22`, ...frame.style }}>
            {avatar
              ? <img src={avatar} alt={name} className="w-full h-full object-cover" />
              : <span className="font-display text-5xl" style={{ color: c }}>{initials(name)}</span>}
            {editing && (
              <span className="absolute bottom-0 inset-x-0 py-1 text-[10px] font-semibold text-white" style={{ background: 'rgba(0,0,0,0.55)' }}>
                {uploading ? '…' : '📷 Ändern'}
              </span>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickImage} />

          {(() => {
            const weeks = badgeData?.streakWeeks ?? 0;
            const longest = badgeData?.longest ?? 0;
            const flameIcon = <span style={{ filter: flameFilter(cosmetics.flame), display: 'inline-block' }}>🔥</span>;
            // Streak-Ansicht: gleiche Optik wie die XP-Leiste, Balken = Fortschritt zur nächsten Streak-Stufe.
            const streakPct = nextBadge ? Math.min(1, weeks / nextBadge.threshold) : 1;
            const streakView = (
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--accent-2)' }}>{flameIcon} {streakDays} {streakDays === 1 ? 'Tag' : 'Tage'} Streak</span>
                  <span className="text-[10px] text-[var(--faint)] tnum">{weeks} Wo · Rekord {longest}</span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.round(streakPct * 100))}%`, background: 'linear-gradient(90deg, var(--accent-2), var(--accent))', transition: 'width .6s ease' }} />
                </div>
              </div>
            );
            // Level/XP volle Breite (= Gürtel). Tap wechselt zwischen XP und Streak.
            if (xp) return (
              <button type="button" onClick={() => setStatMode((m) => (m === 'xp' ? 'streak' : 'xp'))}
                className="w-full mt-3 text-left active:opacity-80 transition-opacity" aria-label="Zwischen XP und Streak wechseln">
                {statMode === 'xp'
                  ? <XpBar data={xp} color={xpBarColor(cosmetics.xpbar)}
                      right={<span className="text-[10px] text-[var(--faint)] tnum">noch {Math.max(0, xp.span - xp.into)} XP</span>} />
                  : streakView}
              </button>
            );
            return <div className="mt-2">{streakView}</div>;
          })()}

          {/* Championship-Belt: Clantag + ausgestellte Badges */}
          <div className="w-full mt-2">
            <Belt clanTag={badgeData?.clanTag ?? null} badges={displayedBadges} onBadge={setBeltBadge} skin={cosmetics.belt} fx={cosmetics.beltFx} />
          </div>

        </div>

        {priv ? (
          <div className="card p-7 text-center anim-up mt-6">
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-display text-xl tracking-wide">Privates Profil</div>
            <p className="text-sm text-[var(--muted)] mt-1">Diese Person teilt ihr Profil nicht mit dir.</p>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex gap-6 justify-center border-b border-[var(--border-soft)] mt-5 mb-4 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: 'none' }}>
              {TABS.map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)}
                  className="shrink-0 pb-2.5 -mb-px text-[13px] font-semibold border-b-2 whitespace-nowrap transition-colors"
                  style={{ color: tab === key ? 'var(--text)' : 'var(--faint)', borderColor: tab === key ? 'var(--accent)' : 'transparent' }}>
                  {label}
                </button>
              ))}
            </div>

            {/* --- Tab: Fighter --- */}
            {tab === 'fighter' && (
              <div className="space-y-4 anim-in">
                {/* Eckdaten */}
                <div className="card px-4 py-4">
                  <div className="section-label mb-2.5">Eckdaten</div>
                  {editing ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] text-[var(--muted)] mb-1 block">Rolle</label>
                        <div className="flex gap-2">
                          {ROLES.map((r) => {
                            const on = (fighterInfo.role ?? 'fighter') === r.key;
                            return (
                              <button key={r.key} onClick={() => setFighterField('role', r.key)}
                                className="flex-1 py-2 rounded-lg border text-xs font-semibold"
                                style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface-2)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                                {r.key === 'both' ? 'Beides' : r.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted)] mb-1 block">Typ</label>
                        <div className="flex gap-2">
                          {([['hobby', 'Hobby'], ['competitor', competitorLabel(fighterInfo.gender)]] as const).map(([key, label]) => {
                            const on = (fighterInfo.athlete ?? 'competitor') === key;
                            return (
                              <button key={key} onClick={() => setFighterField('athlete', key)}
                                className="flex-1 py-2 rounded-lg border text-xs font-semibold"
                                style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface-2)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted)] mb-1 block">Geschlecht</label>
                        <div className="flex gap-2">
                          {GENDERS.map((g) => {
                            const on = fighterInfo.gender === g.key;
                            return (
                              <button key={g.key} onClick={() => setFighterField('gender', g.key)}
                                className="flex-1 py-2 rounded-lg border text-xs font-semibold"
                                style={on ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface-2)' } : { borderColor: 'var(--border)', color: 'var(--muted)', background: 'var(--surface-2)' }}>
                                {g.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted)] mb-1 block">Trainiert seit</label>
                        <input type="month" value={fighterInfo.trainingSince ?? ''} max={new Date().toISOString().slice(0, 7)}
                          onChange={(e) => setFighterField('trainingSince', e.target.value)} className="field" />
                      </div>
                      {isCoach(fighterInfo.role) && (
                        <>
                          <div>
                            <label className="text-[11px] text-[var(--muted)] mb-1 block">Trainer seit</label>
                            <input type="month" value={fighterInfo.coachingSince ?? ''} max={new Date().toISOString().slice(0, 7)}
                              onChange={(e) => setFighterField('coachingSince', e.target.value)} className="field" />
                          </div>
                          <div>
                            <label className="text-[11px] text-[var(--muted)] mb-1 block">Trainer-Fächer</label>
                            <div className="flex flex-wrap gap-2">
                              {ARTS.map((a) => {
                                const on = (fighterInfo.coachingArts ?? []).includes(a.key);
                                return (
                                  <button key={a.key} onClick={() => toggleCoachingArt(a.key)}
                                    className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95"
                                    style={on ? { background: 'rgba(45,212,191,0.14)', borderColor: 'var(--teal)', color: 'var(--teal)' } : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--muted)' }}>
                                    {a.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-[var(--muted)] mb-1 block">Lizenzen / Zertifikate</label>
                            <input type="text" placeholder="z.B. DBV C-Lizenz · BJJ Braungurt" value={fighterInfo.licenses ?? ''}
                              onChange={(e) => setFighterField('licenses', e.target.value)} className="field" />
                          </div>
                        </>
                      )}
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <label className="text-[11px] text-[var(--muted)] mb-1 block">Gewicht (kg)</label>
                          <input type="number" inputMode="numeric" min={20} max={300} value={fighterInfo.weightKg ?? ''}
                            onChange={(e) => setFighterField('weightKg', e.target.value === '' ? undefined : Number(e.target.value))} className="field" />
                        </div>
                        <div className="flex-1">
                          <label className="text-[11px] text-[var(--muted)] mb-1 block">Größe (cm)</label>
                          <input type="number" inputMode="numeric" min={100} max={250} value={fighterInfo.heightCm ?? ''}
                            onChange={(e) => setFighterField('heightCm', e.target.value === '' ? undefined : Number(e.target.value))} className="field" />
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted)] mb-1 block">Instagram</label>
                        <input type="text" placeholder="@handle" value={fighterInfo.instagram ?? ''}
                          onChange={(e) => setFighterField('instagram', e.target.value.replace(/^@/, ''))} className="field" />
                      </div>
                    </div>
                  ) : (fighterInfo.athlete || fighterInfo.trainingSince || fighterInfo.weightKg || fighterInfo.heightCm || fighterInfo.instagram || (isCoach(fighterInfo.role) && (fighterInfo.coachingSince || fighterInfo.coachingArts?.length || fighterInfo.licenses))) ? (
                    <div className="space-y-2 text-sm">
                      {fighterInfo.athlete && <InfoRow label="Typ" value={athleteLabel(fighterInfo.athlete, fighterInfo.gender)} />}
                      {fighterInfo.trainingSince && <InfoRow label="Trainiert" value={trainingLabel(fighterInfo.trainingSince)} />}
                      {isCoach(fighterInfo.role) && fighterInfo.coachingSince && <InfoRow label={`${trainerLabel(fighterInfo.gender)} seit`} value={trainingLabel(fighterInfo.coachingSince)} />}
                      {isCoach(fighterInfo.role) && !!fighterInfo.coachingArts?.length && <InfoRow label={`${trainerLabel(fighterInfo.gender)} für`} value={fighterInfo.coachingArts.map(artLabel).join(' · ')} />}
                      {isCoach(fighterInfo.role) && fighterInfo.licenses && <InfoRow label="Lizenzen" value={fighterInfo.licenses} />}
                      {fighterInfo.weightKg && <InfoRow label="Gewicht" value={`${fighterInfo.weightKg} kg · ${weightClass(fighterInfo.weightKg)}`} />}
                      {fighterInfo.heightCm && <InfoRow label="Größe" value={`${fighterInfo.heightCm} cm`} />}
                      {fighterInfo.instagram && (
                        <InfoRow label="Instagram" value={
                          <a href={`https://instagram.com/${fighterInfo.instagram}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal)' }}>
                            @{fighterInfo.instagram}
                          </a>
                        } />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--faint)]">Noch keine Angaben.</div>
                  )}
                </div>

                {/* Über mich */}
                {(editing || bio) && (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Über mich</div>
                    {editing ? (
                      <>
                        <textarea value={bioEdit} onChange={(e) => setBioEdit(e.target.value)} maxLength={300} rows={3}
                          placeholder="Kurze Beschreibung über dich…" className="field resize-none" />
                        {bioEdit !== bio && (
                          <button onClick={saveBio} disabled={savingBio} className="btn btn-primary mt-2 text-xs px-4 py-1.5">
                            {savingBio ? 'Speichern…' : 'Speichern'}
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-[var(--muted)] whitespace-pre-wrap break-words">{bio}</p>
                    )}
                  </div>
                )}

                {/* Kampfsport */}
                <div className="card px-4 py-4">
                  <div className="section-label mb-2.5">Kampfsport</div>
                  {editing ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {ARTS.map((a) => {
                          const active = arts.some((m) => m.art === a.key);
                          return (
                            <button key={a.key} onClick={() => toggleArt(a.key)}
                              className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all active:scale-95"
                              style={active
                                ? { background: `${c}1f`, borderColor: c, color: '#fff' }
                                : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)', color: 'var(--muted)' }}>
                              {a.label}
                            </button>
                          );
                        })}
                      </div>
                      {arts.filter((m) => artBelts(m.art)).map((m) => (
                        <div key={m.art} className="mt-3">
                          <div className="text-[11px] text-[var(--muted)] mb-1.5">{artLabel(m.art)} — Gürtel</div>
                          <div className="flex flex-wrap gap-1.5">
                            {artBelts(m.art)!.map((b) => (
                              <button key={b} onClick={() => setBelt(m.art, m.belt === b ? null : b)}
                                className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg border transition-all"
                                style={{ borderColor: m.belt === b ? (BELT_COLORS[b] ?? c) : 'var(--border-soft)', background: m.belt === b ? `${BELT_COLORS[b] ?? c}22` : 'transparent', color: 'var(--text)' }}>
                                <span className="w-3 h-3 rounded-full" style={{ background: BELT_COLORS[b] ?? '#888', border: '1px solid rgba(255,255,255,0.2)' }} />
                                {b}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : arts.length === 0 ? (
                    <div className="text-sm text-[var(--faint)]">Noch keine Kampfsportart angegeben.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {arts.map((m) => (
                        <span key={m.art} className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: `${c}1f`, border: `1px solid ${c}` }}>
                          {artLabel(m.art)}
                          {m.belt && <span className="flex items-center gap-1 opacity-90"><span className="w-2.5 h-2.5 rounded-full" style={{ background: BELT_COLORS[m.belt] ?? '#888' }} />{m.belt}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Skilltree */}
                {(() => {
                  const rating = overallRating(skills);
                  return (
                    <div className="card px-4 py-4">
                      <div className="flex items-center justify-between mb-3 gap-2">
                        <div className="section-label">Skills</div>
                        <div className="flex items-center gap-2">
                          {!isSelf && canInteract && !challengeOpen && (
                            <button onClick={openChallenge} className="text-[11px] font-semibold" style={{ color: 'var(--accent-2)' }}>⚔ anfechten</button>
                          )}
                          <span className="font-display text-base tracking-wide px-2 py-px rounded-[3px]"
                            style={{ color: rating.color, border: `1px solid ${rating.color}`, background: `${rating.color}1a` }}>
                            {rating.label}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        {SKILLS.map((s) => {
                          const level = Math.round(Number(skills[s.key] ?? 0) / 20);
                          return (
                            <div key={s.key} className="flex items-center gap-3">
                              <span className="text-xs font-medium w-28 shrink-0">{s.label}</span>
                              <div className="flex gap-1 flex-1">
                                {[1, 2, 3, 4, 5].map((seg) => (
                                  <button key={seg} onClick={() => editing && setSkill(s.key, seg)} disabled={!editing}
                                    className="h-3 flex-1 rounded-sm transition-all"
                                    style={{ background: level >= seg ? c : 'var(--surface-2)', border: '1px solid var(--border-soft)', cursor: editing ? 'pointer' : 'default' }} />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {editing && <p className="text-[10px] text-[var(--faint)] mt-3">Tippe die Balken (0–5).</p>}

                      {/* Anfechtung direkt am Skilltree */}
                      {!isSelf && challengeOpen && (
                        <div className="mt-4 pt-4 border-t border-[var(--border-soft)]">
                          <div className="section-label mb-2.5">Dein Vorschlag (Level 0–5)</div>
                          <div className="space-y-2.5">
                            {SKILLS.map((s) => {
                              const lvl = proposal[s.key] ?? 0;
                              return (
                                <div key={s.key} className="flex items-center gap-3">
                                  <span className="text-xs font-medium w-28 shrink-0">{s.label}</span>
                                  <div className="flex gap-1 flex-1">
                                    {[1, 2, 3, 4, 5].map((seg) => (
                                      <button key={seg}
                                        onClick={() => setProposal((p) => ({ ...p, [s.key]: (p[s.key] ?? 0) === seg ? seg - 1 : seg }))}
                                        className="h-3 flex-1 rounded-sm transition-all"
                                        style={{ background: lvl >= seg ? c : 'var(--surface-2)', border: '1px solid var(--border-soft)' }} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <textarea value={challengeNote} onChange={(e) => setChallengeNote(e.target.value)} rows={2} maxLength={300}
                            placeholder="Begründung (optional)" className="field resize-none mt-3" />
                          <div className="flex gap-2 mt-2">
                            <button onClick={() => setChallengeOpen(false)} className="btn btn-ghost flex-1">Abbrechen</button>
                            <button onClick={submitChallenge} disabled={submittingChallenge} className="btn btn-primary flex-1">
                              {submittingChallenge ? '…' : 'Anfechtung senden'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Offene Anfechtungen (eigenes Profil) */}
                {isSelf && challenges.length > 0 && (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Anfechtungen ({challenges.length})</div>
                    <div className="space-y-3">
                      {challenges.map((ch) => (
                        <div key={ch.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                          <div className="text-sm font-semibold mb-1.5">{ch.challenger_name} schlägt vor:</div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {Object.entries(ch.proposal).map(([k, v]) => {
                              const cur = Math.round(Number(skills[k as keyof Skills] ?? 0) / 20);
                              const label = SKILLS.find((s) => s.key === k)?.label ?? k;
                              return (
                                <span key={k} className="text-[11px] px-1.5 py-px rounded-[3px] border border-[var(--border)]">
                                  {label}: <span className="text-[var(--faint)]">{cur}</span> → <strong style={{ color: c }}>{v}</strong>
                                </span>
                              );
                            })}
                          </div>
                          {ch.note && <p className="text-xs text-[var(--muted)] italic mb-2">„{ch.note}“</p>}
                          <div className="flex gap-2">
                            <button onClick={() => resolveChallenge(ch.id, 'accept')} className="flex-1 text-xs font-bold py-2 rounded-lg text-black" style={{ background: 'var(--good)' }}>Übernehmen</button>
                            <button onClick={() => resolveChallenge(ch.id, 'reject')} className="flex-1 text-xs font-bold py-2 rounded-lg border border-[var(--border)] text-[var(--muted)]">Ablehnen</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wettkämpfe */}
                <div className="card px-4 py-4">
                  <div className="section-label mb-2.5">Wettkämpfe</div>
                  {(() => {
                    const wins = comps.filter(c => c.result === 'win').length;
                    const losses = comps.filter(c => c.result === 'loss').length;
                    const draws = comps.filter(c => c.result === 'draw').length;
                    if (wins + losses + draws === 0) return null;
                    return (
                      <div className="flex items-center justify-center gap-1.5 mb-3">
                        <span className="font-display text-3xl tnum" style={{ color: 'var(--good)' }}>{wins}</span>
                        <span className="font-display text-2xl text-[var(--faint)]">/</span>
                        <span className="font-display text-3xl tnum" style={{ color: 'var(--accent)' }}>{losses}</span>
                        <span className="font-display text-2xl text-[var(--faint)]">/</span>
                        <span className="font-display text-3xl tnum" style={{ color: 'var(--muted)' }}>{draws}</span>
                        <span className="text-[11px] text-[var(--faint)] ml-1.5 leading-tight">Siege /<br />Niederl. /<br />Unent.</span>
                      </div>
                    );
                  })()}
                  {comps.length === 0 ? (
                    <div className="text-sm text-[var(--faint)]">Noch keine Wettkämpfe.</div>
                  ) : (
                    <div className="space-y-2">
                      {comps.map((cp) => (
                        <div key={cp.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{cp.name}</div>
                            <div className="text-[11px] text-[var(--faint)] tnum">
                              {new Date(cp.competition_date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                              {cp.weight_class ? ` · ${cp.weight_class}` : ''}
                            </div>
                          </div>
                          {cp.placement ? (
                            <span className="text-xs font-bold shrink-0" style={{ color: 'var(--gold)' }}>{PLACEMENT_MED[cp.placement] ?? cp.placement}</span>
                          ) : cp.result ? (
                            <span className="text-xs font-bold shrink-0" style={{ color: cp.result === 'win' ? 'var(--good)' : cp.result === 'draw' ? 'var(--muted)' : 'var(--accent)' }}>
                              {cp.result === 'win' ? 'Sieg' : cp.result === 'draw' ? 'Unent.' : 'Niederlage'}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- Tab: Stats --- */}
            {tab === 'stats' && (
              <div className="space-y-5 anim-in">
                <div>
                  <div className="section-label mb-2.5">Titel &amp; Anwesenheit</div>
                  <div className="flex gap-2.5">
                    <Stat value={stats?.macherTitles ?? '–'} label={macherMonth(fighterInfo.gender)} color="var(--gold)" />
                    <Stat value={stats?.bitchTitles ?? '–'} label="Chicken des Monats" color="var(--bitch)" />
                    <Stat value={stats?.daysOut ?? '–'} label="Tage weg" color="var(--teal)" />
                  </div>
                </div>
                <div>
                  <div className="section-label mb-2.5">Punkte · {year}</div>
                  <div className="flex gap-2.5">
                    <Stat value={macherYear ?? '–'} label="Macher-Punkte" color="var(--gold)" />
                    <Stat value={bitchYear ?? '–'} label="Chicken-Punkte" color="var(--bitch)" />
                  </div>
                </div>
              </div>
            )}

            {/* --- Tab: Plan --- */}
            {tab === 'plan' && (() => {
              const gid = planGroupSel ?? planGroups[0]?.id ?? null;
              const cs = planClasses.filter((c) => c.group_id === gid);
              const byDay = new Map<number, typeof cs>();
              for (const c of cs) { if (!byDay.has(c.day_of_week)) byDay.set(c.day_of_week, []); byDay.get(c.day_of_week)!.push(c); }
              const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => byDay.has(d));
              return (
                <div className="space-y-4 anim-in">
                  {/* Gruppen-Auswahl (nur bei mehreren Crews) */}
                  {planGroups.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {planGroups.map((g) => {
                        const on = g.id === gid;
                        return (
                          <button key={g.id} onClick={() => setPlanGroupSel(g.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                            style={{ borderColor: on ? 'var(--accent)' : 'var(--border-soft)', background: on ? 'var(--accent-soft)' : 'var(--surface-2)', color: on ? 'var(--text)' : 'var(--muted)' }}>
                            {g.name}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {planGroups.length === 0 || cs.length === 0 ? (
                    <div className="card p-7 text-center">
                      <div className="text-3xl mb-2">🗓️</div>
                      <div className="font-display text-lg tracking-wide">Kein fester Plan</div>
                      <p className="text-sm text-[var(--muted)] mt-1">
                        {isSelf ? 'Trag auf der Startseite ein, an welchen Kursen du regelmäßig teilnimmst.' : 'Hier ist noch kein Trainingsplan hinterlegt.'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="section-label">Wochenplan</div>
                        <span className="text-[11px] text-[var(--faint)] tnum">{cs.length} {cs.length === 1 ? 'Einheit' : 'Einheiten'} · {days.length} {days.length === 1 ? 'Tag' : 'Tage'}</span>
                      </div>
                      <div className="space-y-3.5">
                        {days.map((d) => (
                          <div key={d}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{DAY_FULL[d - 1]}</span>
                              <div className="h-px flex-1" style={{ background: 'var(--border-soft)' }} />
                            </div>
                            <div className="space-y-1.5">
                              {byDay.get(d)!.map((c) => {
                                const col = classHex(c.color);
                                return (
                                  <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                                    style={{ background: `${col}14`, borderLeft: `3px solid ${col}` }}>
                                    <span className="text-sm font-semibold flex-1 min-w-0 truncate">{c.name}</span>
                                    <span className="text-xs tnum shrink-0" style={{ color: 'var(--muted)' }}>
                                      {c.start_time?.slice(0, 5)}{c.end_time ? `–${c.end_time.slice(0, 5)}` : ''}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {/* --- Tab: Ehrungen --- */}
            {tab === 'ehrungen' && (
              <div className="space-y-4 anim-in">
                {showBadgesCard && badgesCard}
                {!isSelf && canInteract && (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Würdigung geben</div>
                    {praiseKind === null ? (
                      <div className="flex gap-2">
                        <button onClick={() => setPraiseKind('lob')} disabled={!praiseStatus.lob}
                          className="flex-1 text-sm font-bold py-2.5 rounded-xl border disabled:opacity-40"
                          style={{ background: 'rgba(255,194,75,0.12)', borderColor: 'var(--gold)', color: 'var(--gold)' }}>
                          Lob
                        </button>
                        <button onClick={() => setPraiseKind('gigalob')} disabled={!praiseStatus.gigalob}
                          className="flex-1 text-sm font-bold py-2.5 rounded-xl border disabled:opacity-40"
                          style={{ background: 'rgba(255,59,48,0.12)', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                          Gigalob
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-sm font-semibold mb-2">{praiseKind === 'gigalob' ? 'Gigalob' : 'Lob'} an {name}</div>
                        <textarea value={praiseReason} onChange={(e) => setPraiseReason(e.target.value)} rows={2} maxLength={300}
                          placeholder="Warum hat die Person es verdient?" className="field resize-none" />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setPraiseKind(null); setPraiseReason(''); }} className="btn btn-ghost flex-1">Abbrechen</button>
                          <button onClick={() => setConfirmPraise(true)} disabled={givingPraise}
                            className="flex-1 text-xs font-bold py-2.5 rounded-xl text-black disabled:opacity-40" style={{ background: praiseKind === 'gigalob' ? 'var(--accent)' : 'var(--gold)' }}>
                            {givingPraise ? '…' : 'Senden'}
                          </button>
                        </div>
                      </>
                    )}
                    {praiseMsg && <p className="text-xs mt-2 text-[var(--muted)]">{praiseMsg}</p>}
                  </div>
                )}

                {praises.length > 0 ? (
                  <div className="card px-4 py-4">
                    <div className="section-label mb-2.5">Ausgestellte Würdigungen</div>
                    <div className="space-y-2">
                      {praises.map((p) => (
                        <div key={p.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                          <div className="text-sm font-semibold">
                            {p.kind === 'gigalob' ? 'Gigalob' : 'Lob'} <span className="text-[var(--muted)] font-normal">von {p.from_user}</span>
                          </div>
                          {p.show_comment && p.reason && <p className="text-xs text-[var(--muted)] italic mt-1">„{p.reason}“</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card p-8 text-center text-sm text-[var(--faint)]">Noch keine ausgestellten Würdigungen.</div>
                )}
              </div>
            )}

            {/* --- Tab: Pinnwand (Kommentare) --- */}
            {tab === 'pinnwand' && (
              <div className="card px-4 py-4 anim-in">
                {comments.length === 0 ? (
                  <div className="text-sm text-[var(--faint)] mb-3">Noch keine Kommentare.</div>
                ) : (
                  <div className="space-y-2.5 mb-3">
                    {comments.map((cm) => (
                      <div key={cm.id} className="rounded-xl border border-[var(--border-soft)] p-3" style={{ background: 'var(--surface-2)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <a href={`/profil/${encodeURIComponent(cm.author_name)}`} className="text-xs font-semibold" style={{ color: c }}>{cm.author_name}</a>
                          {(cm.author_name === userName || isSelf) && (
                            <button onClick={() => deleteComment(cm.id)} className="text-[var(--faint)] hover:text-[var(--accent)] text-xs px-1">✕</button>
                          )}
                        </div>
                        {cm.body && <p className="text-sm text-[var(--text)] mt-1 whitespace-pre-wrap break-words">{cm.body}</p>}
                        {cm.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cm.image} alt="" className="mt-2 rounded-lg w-full max-h-80 object-cover" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {canInteract && (
                  <div className="space-y-2">
                    {commentImage && (
                      <div className="relative w-fit">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={commentImage} alt="" className="rounded-lg max-h-40 object-cover" />
                        <button onClick={() => setCommentImage(null)}
                          className="absolute -top-2 -right-2 w-6 h-6 grid place-items-center rounded-full text-white text-xs" style={{ background: 'var(--accent)' }}>✕</button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <label className="shrink-0 w-11 grid place-items-center rounded-xl border border-[var(--border)] text-[var(--muted)] hover:text-white cursor-pointer transition-colors" title="Bild anhängen">
                        {imgBusy ? '…' : '📎'}
                        <input type="file" accept="image/*" hidden onChange={onPickCommentImage} />
                      </label>
                      <input value={newComment} onChange={(e) => setNewComment(e.target.value)} maxLength={500}
                        onKeyDown={(e) => e.key === 'Enter' && postComment()}
                        placeholder="Kommentar schreiben…" className="field flex-1" />
                      <button onClick={postComment} disabled={postingComment || imgBusy || (!newComment.trim() && !commentImage)} className="btn btn-primary">
                        {postingComment ? '…' : 'Senden'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Eigene Einstellungen — nur im Bearbeiten-Modus */}
            {editing && (
              <div className="mt-7 space-y-3">
                <a href="/spind" className="card px-4 py-3 flex items-center justify-between text-sm font-semibold">
                  <span>Spind — Anpassung</span>
                  <span className="text-[var(--faint)]">›</span>
                </a>
                {isAdmin && (
                  <a href="/admin" className="card px-4 py-3 flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--muted)' }}>
                    Admin-Bereich
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Würdigung bestätigen */}
      {confirmPraise && praiseKind && (
        <div className="fixed inset-0 z-[999] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmPraise(false); }}>
          <div className="card w-full max-w-sm p-5 anim-up rounded-b-none sm:rounded-2xl">
            <h2 className="font-display text-xl tracking-wide mb-1">{praiseKind === 'gigalob' ? 'Gigalob' : 'Lob'} wirklich geben?</h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Du kannst {praiseKind === 'gigalob' ? 'nur 1× pro Monat ein Gigalob' : 'nur 1× pro Woche ein Lob'} vergeben — nutze es mit Bedacht.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPraise(false)} className="btn btn-ghost flex-1">Abbrechen</button>
              <button onClick={givePraise} disabled={givingPraise}
                className="flex-1 text-sm font-bold py-2.5 rounded-xl text-black disabled:opacity-40" style={{ background: praiseKind === 'gigalob' ? 'var(--accent)' : 'var(--gold)' }}>
                {givingPraise ? '…' : 'Ja, geben'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Badge-Detail (Klick auf ein Belt-Abzeichen) */}
      {beltBadge && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setBeltBadge(null); }}>
          <div className="card w-full max-w-xs p-6 text-center anim-pop">
            <div className="text-5xl mb-2">{beltBadge.emoji}</div>
            <div className="font-display text-2xl tracking-wide">{beltBadge.label}</div>
            <div className="text-sm text-[var(--muted)] mt-1">{beltBadge.hint}</div>
            <button onClick={() => setBeltBadge(null)} className="btn btn-ghost w-full mt-4">Schließen</button>
          </div>
        </div>
      )}

      {/* Alle Achievements — Übersicht (erreicht + gesperrt mit Bedingung) */}
      {showAllBadges && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6 anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAllBadges(false); }}>
          <div className="card w-full max-w-md max-h-[82vh] overflow-y-auto p-5 anim-up">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-2xl tracking-wide">Alle Achievements</h2>
              <button onClick={() => setShowAllBadges(false)} className="text-[var(--faint)] hover:text-white text-lg px-1">✕</button>
            </div>
            {([['Streak', STREAK_BADGES], ['Wettkampf', COMPETITION_BADGES], ['Kampf-Siege', FIGHT_BADGES], ['Turnier', TOURNAMENT_BADGES], ['Gericht', JUDGE_BADGES], ['Spezial', SPECIAL_BADGES], ['Geheim', SECRET_BADGES]] as const).map(([title, list]) => {
              const visible = list.filter((b) => !b.secret || earnedSet.has(b.id)); // geheime erst nach Freischalten
              if (visible.length === 0) return null;
              return (
              <div key={title} className="mb-4 last:mb-0">
                <div className="section-label mb-2">{title}</div>
                <div className="space-y-2">
                  {visible.map((b) => {
                    const got = earnedSet.has(b.id);
                    return (
                      <div key={b.id} className="flex items-center gap-3 rounded-xl border p-2.5"
                        style={got ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-2)' } : { background: 'var(--surface-2)', borderColor: 'var(--border-soft)' }}>
                        <span className="text-2xl leading-none" style={got ? undefined : { filter: 'grayscale(1)', opacity: 0.45 }}>{b.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{b.label}</div>
                          <div className="text-[11px] text-[var(--muted)]">{b.hint}</div>
                        </div>
                        {got && <span className="text-sm font-bold" style={{ color: 'var(--good)' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
