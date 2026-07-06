'use client';

import { useEffect, useState, useCallback } from 'react';
import PageHeader from '@/components/PageHeader';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';
import { BUNDESLAENDER } from '@/lib/holidays';
import { track } from '@/lib/analytics';

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const COLORS = ['red', 'blue', 'green', 'orange', 'purple'];
const COLOR_HEX: Record<string, string> = { red: '#ff3b30', blue: '#3b82f6', green: '#22c55e', orange: '#f59e0b', purple: '#a855f7' };

// Gruppenbild auf 256px quadratisch verkleinern → Data-URL (wie beim Profilbild).
function resizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = 256;
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
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

interface MyGroup { id: number; name: string; invite_code: string; role: string; clan_tag: string | null; hard_mode: boolean; bundesland: string; avatar?: string | null; description?: string }
interface Member { user_name: string; role: string; status: string }
interface Cls { id: number; name: string; day_of_week: number; start_time: string; end_time: string; color: string }

export default function GroupsPage() {
  const { userName } = useUser();
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [current, setCurrent] = useState<number | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [groupName, setGroupName] = useState<string>('');
  const [classes, setClasses] = useState<Cls[]>([]);

  const [newName, setNewName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [clanTag, setClanTag] = useState('');
  const [hardMode, setHardMode] = useState(false);
  const [bundesland, setBundesland] = useState('NW');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [groupDesc, setGroupDesc] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [qrUrl, setQrUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [form, setForm] = useState({ name: '', dayOfWeek: 1, startTime: '18:00', endTime: '19:30', color: 'red' });

  const load = useCallback(async () => {
    const [g, m, c] = await Promise.all([
      fetch('/api/groups').then((r) => r.json()).catch(() => ({})),
      fetch('/api/groups/members').then((r) => r.json()).catch(() => ({})),
      fetch('/api/classes').then((r) => r.json()).catch(() => []),
    ]);
    const gs: MyGroup[] = Array.isArray(g.groups) ? g.groups : [];
    setGroups(gs);
    setCurrent(g.current ?? null);
    const cur = gs.find((x) => x.id === g.current);
    setClanTag(cur?.clan_tag ?? '');
    setHardMode(cur?.hard_mode ?? false);
    setBundesland(cur?.bundesland ?? 'NW');
    setGroupAvatar(cur?.avatar ?? null);
    setGroupDesc(cur?.description ?? '');
    setMembers(Array.isArray(m.members) ? m.members : []);
    setMyRole(m.myRole ?? null);
    setInviteCode(m.inviteCode ?? null);
    setGroupName(m.group?.name ?? '');
    setClasses(Array.isArray(c) ? c : []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function createGroup() {
    if (!newName.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newName }) });
      if (res.ok) { track('group_created', { via: 'settings' }); setNewName(''); window.location.href = '/gruppen'; }
      else { const d = await res.json().catch(() => ({})); setMsg(d.error ?? 'Konnte Gruppe nicht erstellen — schon deployt & /api/setup gelaufen?'); }
    } finally { setBusy(false); }
  }
  async function joinGroup() {
    if (!joinCode.trim()) return;
    setBusy(true); setMsg('');
    try {
      const res = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: joinCode }) });
      const d = await res.json();
      if (res.ok) { track('group_joined', { via: 'settings', status: d.status }); setMsg(d.status === 'active' ? `Du bist in „${d.group}".` : `Anfrage an „${d.group}" gesendet — ein Admin muss sie annehmen.`); setJoinCode(''); }
      else setMsg(d.error ?? 'Fehler');
    } finally { setBusy(false); }
  }
  async function saveClanTag() {
    if (!current) return;
    setBusy(true);
    try {
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, clanTag }) });
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, clan_tag: clanTag || null } : g)));
    } finally { setBusy(false); }
  }
  async function pickGroupAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !current) return;
    setBusy(true);
    try {
      const dataUrl = await resizeImage(file);
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, avatar: dataUrl }) });
      setGroupAvatar(dataUrl);
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, avatar: dataUrl } : g)));
    } catch { /* egal */ } finally { setBusy(false); }
  }
  async function removeGroupAvatar() {
    if (!current) return;
    setBusy(true);
    try {
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, avatar: null }) });
      setGroupAvatar(null);
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, avatar: null } : g)));
    } finally { setBusy(false); }
  }
  async function saveGroupDesc() {
    if (!current) return;
    setBusy(true);
    try {
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, description: groupDesc }) });
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, description: groupDesc } : g)));
    } finally { setBusy(false); }
  }
  async function toggleHardMode() {
    if (!current) return;
    const next = !hardMode;
    if (next && !confirm('Harten Modus aktivieren? Damit sind öffentliche No-Shows, Chicken des Monats und das Ausreden-Gericht für ALLE in dieser Crew sichtbar. Nur einschalten, wenn alle einverstanden sind.')) return;
    setBusy(true);
    try {
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, hardMode: next }) });
      setHardMode(next);
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, hard_mode: next } : g)));
    } finally { setBusy(false); }
  }
  async function saveBundesland(bl: string) {
    if (!current) return;
    setBundesland(bl);
    setBusy(true);
    try {
      await fetch('/api/groups', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: current, bundesland: bl }) });
      setGroups((prev) => prev.map((g) => (g.id === current ? { ...g, bundesland: bl } : g)));
    } finally { setBusy(false); }
  }
  async function switchGroup(id: number) {
    await fetch('/api/groups/current', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: id }) });
    window.location.href = '/';
  }
  function inviteUrl() { return `${window.location.origin}/join?code=${inviteCode}`; }
  async function shareInvite() {
    if (!inviteCode) return;
    setInviteMsg('');
    track('invite_shared', { method: 'share' });
    if (typeof navigator !== 'undefined' && navigator.share) {
      try { await navigator.share({ title: 'Tap In', text: 'Komm in unsere Crew!', url: inviteUrl() }); } catch { /* abgebrochen */ }
    } else {
      try { await navigator.clipboard.writeText(inviteUrl()); setInviteMsg('Link kopiert.'); } catch {}
    }
  }
  async function copyInvite() {
    if (!inviteCode) return;
    track('invite_shared', { method: 'copy' });
    try { await navigator.clipboard.writeText(inviteUrl()); setInviteMsg('Link kopiert.'); } catch {}
  }
  async function toggleQr() {
    if (showQr) { setShowQr(false); return; }
    if (!inviteCode) return;
    track('invite_shared', { method: 'qr' });
    try {
      const QRCode = (await import('qrcode')).default;
      setQrUrl(await QRCode.toDataURL(inviteUrl(), { width: 240, margin: 1, color: { dark: '#0a0a0c', light: '#ffffff' } }));
      setShowQr(true);
    } catch { /* egal */ }
  }
  async function memberAction(action: string, user_name?: string) {
    if (action === 'leave' && !confirm('Gruppe wirklich verlassen?')) return;
    if (action === 'remove' && !confirm(`„${user_name}" entfernen?`)) return;
    await fetch('/api/groups/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, user_name }) });
    if (action === 'leave') window.location.href = '/';
    else load();
  }
  async function addClass() {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch('/api/classes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { setForm({ name: '', dayOfWeek: 1, startTime: '18:00', endTime: '19:30', color: 'red' }); load(); }
    } finally { setBusy(false); }
  }
  async function delClass(id: number) {
    if (!confirm('Kurs löschen?')) return;
    await fetch(`/api/classes/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    load();
  }

  const pending = members.filter((m) => m.status === 'pending');
  const active = members.filter((m) => m.status === 'active');
  const isAdmin = myRole === 'admin';
  const canModerate = isAdmin || myRole === 'moderator'; // rein-/rauslassen

  return (
    <div className="min-h-screen text-[var(--text)]">
      <PageHeader title="👥 Gruppen" />
      <main className="max-w-md mx-auto px-4 pb-16 space-y-5">
        {/* Meine Gruppen / Umschalter */}
        <section className="card p-4 anim-up">
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Meine Gruppen</div>
          <div className="space-y-2">
            {groups.map((g) => (
              <button key={g.id} onClick={() => g.id !== current && switchGroup(g.id)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.99]"
                style={{ borderColor: g.id === current ? 'var(--accent)' : 'var(--border-soft)', background: g.id === current ? 'var(--accent-soft)' : 'var(--surface-2)' }}>
                <span className="font-semibold text-sm">{g.clan_tag ? `[${g.clan_tag}] ` : ''}{g.name}</span>
                <span className="flex items-center gap-2">
                  {g.role === 'admin' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--muted)' }}>Admin</span>}
                  {g.role === 'moderator' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: 'rgba(45,212,191,0.14)', color: 'var(--teal)' }}>Mod</span>}
                  {g.id === current ? <span className="text-[10px] font-bold" style={{ color: 'var(--accent)' }}>AKTIV</span> : <span className="text-[var(--faint)] text-xs">wechseln ›</span>}
                </span>
              </button>
            ))}
            {groups.length === 0 && <div className="text-[var(--faint)] text-sm py-2">Noch in keiner Gruppe.</div>}
          </div>
        </section>

        {/* Gruppen-Profil: Bild + Beschreibung (Admins bearbeiten, alle sehen) */}
        {current && (() => {
          const gc = colorFor(groupName || 'Crew');
          return (
            <section className="card p-4 anim-up" style={{ animationDelay: '20ms' }}>
              <div className="flex items-center gap-3.5">
                {isAdmin ? (
                  <label className="relative cursor-pointer shrink-0" title="Gruppenbild ändern">
                    {groupAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={groupAvatar} alt="" className="w-16 h-16 rounded-2xl object-cover" style={{ border: `1.5px solid ${gc}` }} />
                    ) : (
                      <span className="w-16 h-16 rounded-2xl grid place-items-center font-display text-2xl" style={{ background: `${gc}22`, color: gc, border: `1.5px solid ${gc}` }}>{initials(groupName || 'C')}</span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={pickGroupAvatar} disabled={busy} />
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full grid place-items-center text-[11px] shadow" style={{ background: 'var(--accent)', color: '#fff' }}>✎</span>
                  </label>
                ) : groupAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={groupAvatar} alt="" className="w-16 h-16 rounded-2xl object-cover shrink-0" style={{ border: `1.5px solid ${gc}` }} />
                ) : (
                  <span className="w-16 h-16 rounded-2xl grid place-items-center font-display text-2xl shrink-0" style={{ background: `${gc}22`, color: gc, border: `1.5px solid ${gc}` }}>{initials(groupName || 'C')}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-display text-xl tracking-wide truncate">{clanTag ? `[${clanTag}] ` : ''}{groupName}</div>
                  {isAdmin && groupAvatar && (
                    <button onClick={removeGroupAvatar} disabled={busy} className="text-[11px] text-[var(--faint)] hover:text-[var(--accent)] transition-colors mt-0.5">Bild entfernen</button>
                  )}
                </div>
              </div>

              {isAdmin ? (
                <div className="mt-3">
                  <textarea value={groupDesc} onChange={(e) => setGroupDesc(e.target.value.slice(0, 500))} rows={3}
                    placeholder="Beschreibung eurer Crew — worum geht's, wer seid ihr?"
                    className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] resize-none" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[var(--faint)] tnum">{groupDesc.length}/500</span>
                    <button onClick={saveGroupDesc} disabled={busy} className="text-white font-bold px-4 py-2 rounded-xl text-sm disabled:opacity-40" style={{ background: 'var(--accent)' }}>Speichern</button>
                  </div>
                </div>
              ) : groupDesc ? (
                <p className="mt-3 text-sm text-[var(--muted)] whitespace-pre-line">{groupDesc}</p>
              ) : null}
            </section>
          );
        })()}

        {/* Erstellen / Beitreten */}
        <section className="card p-4 anim-up space-y-4" style={{ animationDelay: '40ms' }}>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2">Neue Gruppe erstellen</div>
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Name (z.B. dein Gym)…"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)]" />
              <button onClick={createGroup} disabled={busy || !newName.trim()} className="text-white font-bold px-4 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>Erstellen</button>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2">Per Code beitreten</div>
            <div className="flex gap-2">
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="EINLADUNGSCODE" maxLength={12}
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] tracking-widest font-mono" />
              <button onClick={joinGroup} disabled={busy || !joinCode.trim()} className="font-semibold px-4 rounded-xl border border-[var(--border)] text-[var(--text)] disabled:opacity-40">Anfragen</button>
            </div>
            {msg && <p className="text-xs mt-2" style={{ color: 'var(--teal)' }}>{msg}</p>}
          </div>
        </section>

        {/* Freunde einladen — jedes aktive Mitglied */}
        {current && inviteCode && (
          <section className="card p-4 anim-up" style={{ animationDelay: '30ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-1.5">Freunde einladen</div>
            <p className="text-[11px] text-[var(--faint)] mb-3">Schick den Link — wer ihn öffnet, ist mit einem Tap dabei (ein Admin bestätigt).</p>
            <div className="flex gap-2">
              <button onClick={shareInvite} className="flex-1 text-white font-bold py-2.5 rounded-xl" style={{ background: 'var(--accent)' }}>Einladung teilen</button>
              <button onClick={copyInvite} className="px-4 rounded-xl border border-[var(--border)] text-[var(--muted)] text-sm">Link kopieren</button>
            </div>
            <div className="text-center text-[11px] text-[var(--faint)] mt-3 font-mono tracking-widest">Code: {inviteCode}</div>
            <button onClick={toggleQr} className="w-full mt-2 text-xs text-[var(--muted)] hover:text-white transition-colors">
              {showQr ? 'QR-Code ausblenden' : 'QR-Code zum Scannen'}
            </button>
            {showQr && qrUrl && (
              <div className="mt-3 flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="Einladungs-QR-Code" width={200} height={200} className="rounded-xl" style={{ background: '#fff', padding: 10 }} />
              </div>
            )}
            {inviteMsg && <p className="text-xs mt-2 text-center" style={{ color: 'var(--teal)' }}>{inviteMsg}</p>}
          </section>
        )}

        {/* Harter Modus (nur Admin) */}
        {current && isAdmin && (
          <section className="card p-4 anim-up" style={{ animationDelay: '50ms' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Harter Modus</div>
                <p className="text-[11px] text-[var(--faint)] mt-1 leading-relaxed">
                  Schaltet die harten Features für die ganze Crew frei: öffentliche No-Shows, Chicken des Monats und Ausreden-Gericht. Standardmäßig aus.
                </p>
              </div>
              <button onClick={toggleHardMode} disabled={busy} role="switch" aria-checked={hardMode} aria-label="Harten Modus umschalten"
                className="relative w-12 h-7 rounded-full shrink-0 transition-colors disabled:opacity-40"
                style={{ background: hardMode ? 'var(--accent)' : 'var(--surface-2)', border: '1px solid var(--border)' }}>
                <span className="absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all"
                  style={{ left: hardMode ? '1.35rem' : '0.15rem' }} />
              </button>
            </div>
          </section>
        )}

        {/* Clantag (nur Admin) */}
        {current && isAdmin && (
          <section className="card p-4 anim-up" style={{ animationDelay: '60ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Clantag (max. 4 Buchstaben)</div>
            <div className="flex gap-2">
              <input value={clanTag} onChange={(e) => setClanTag(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 4))}
                maxLength={4} placeholder="z.B. NFT"
                className="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] tracking-widest font-mono" />
              <button onClick={saveClanTag} disabled={busy} className="text-white font-bold px-4 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>Speichern</button>
            </div>
            <p className="text-[11px] text-[var(--faint)] mt-2">Erscheint vor dem Gruppennamen.</p>
          </section>
        )}

        {/* Bundesland (nur Admin) — steuert die Feiertage in der Wertung */}
        {current && isAdmin && (
          <section className="card p-4 anim-up" style={{ animationDelay: '70ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-2.5">Bundesland (Feiertage)</div>
            <select value={bundesland} onChange={(e) => saveBundesland(e.target.value)} disabled={busy}
              className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]">
              {BUNDESLAENDER.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
            </select>
            <p className="text-[11px] text-[var(--faint)] mt-2">Bestimmt, welche Feiertage in der Wertung als frei gelten (Standard: NRW).</p>
          </section>
        )}

        {/* Aktuelle Gruppe: Mitglieder */}
        {current && (
          <section className="card p-4 anim-up" style={{ animationDelay: '80ms' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">{groupName} · Mitglieder</div>
            </div>

            {canModerate && pending.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-[var(--bitch)] uppercase tracking-wider mb-1.5">Offene Anfragen</div>
                {pending.map((m) => (
                  <div key={m.user_name} className="flex items-center gap-2 py-1.5">
                    <span className="text-sm flex-1">{m.user_name}</span>
                    <button onClick={() => memberAction('approve', m.user_name)} className="text-xs font-semibold px-2.5 py-1 rounded-lg text-white" style={{ background: 'var(--good)' }}>Annehmen</button>
                    <button onClick={() => memberAction('reject', m.user_name)} className="text-xs px-2.5 py-1 rounded-lg text-[var(--faint)] border border-[var(--border)]">Ablehnen</button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              {active.map((m) => {
                const col = colorFor(m.user_name);
                return (
                  <div key={m.user_name} className="flex items-center gap-2.5 py-1">
                    <span className="w-8 h-8 rounded-full grid place-items-center font-display text-sm shrink-0" style={{ background: `${col}22`, color: col, border: `1.5px solid ${col}` }}>{initials(m.user_name)}</span>
                    <span className="text-sm flex-1 truncate">{m.user_name}</span>
                    {m.role === 'admin' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>Admin</span>}
                    {m.role === 'moderator' && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0" style={{ background: 'rgba(45,212,191,0.14)', color: 'var(--teal)' }}>Mod</span>}
                    {isAdmin ? (
                      <span className="flex items-center gap-1.5 shrink-0">
                        {m.role === 'admin' ? (
                          <button onClick={() => memberAction('demote', m.user_name)} className="text-[10px] text-[var(--faint)]">↓ Member</button>
                        ) : m.role === 'moderator' ? (
                          <>
                            <button onClick={() => memberAction('unmod', m.user_name)} className="text-[10px] text-[var(--faint)]">↓ Member</button>
                            <button onClick={() => memberAction('promote', m.user_name)} className="text-[10px]" style={{ color: 'var(--teal)' }}>↑ Admin</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => memberAction('make_mod', m.user_name)} className="text-[10px]" style={{ color: 'var(--teal)' }}>↑ Mod</button>
                            <button onClick={() => memberAction('promote', m.user_name)} className="text-[10px]" style={{ color: 'var(--teal)' }}>↑ Admin</button>
                          </>
                        )}
                        <button onClick={() => memberAction('remove', m.user_name)} className="text-[var(--faint)] hover:text-[var(--accent)] text-sm">✕</button>
                      </span>
                    ) : canModerate && m.role !== 'admin' && m.user_name !== userName ? (
                      <button onClick={() => memberAction('remove', m.user_name)} className="text-[var(--faint)] hover:text-[var(--accent)] text-sm shrink-0">✕</button>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <button onClick={() => memberAction('leave')} className="mt-3 text-xs text-[var(--faint)] hover:text-[var(--accent)]">Gruppe verlassen</button>
          </section>
        )}

        {/* Stundenplan (nur Admins) */}
        {current && isAdmin && (
          <section className="card p-4 anim-up" style={{ animationDelay: '120ms' }}>
            <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)] mb-3">Stundenplan ({classes.length})</div>
            <div className="space-y-2 mb-4">
              {classes.map((cls) => (
                <div key={cls.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--surface-2)' }}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLOR_HEX[cls.color] ?? COLOR_HEX.red }} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cls.name}</div>
                      <div className="text-[11px] text-[var(--muted)] tnum">{DAY_NAMES[cls.day_of_week - 1]} · {cls.start_time}–{cls.end_time}</div>
                    </div>
                  </div>
                  <button onClick={() => delClass(cls.id)} className="text-[var(--faint)] hover:text-[var(--accent)] text-xs shrink-0">Löschen</button>
                </div>
              ))}
              {classes.length === 0 && <div className="text-[var(--faint)] text-sm">Noch keine Kurse — füge unten welche hinzu.</div>}
            </div>
            <div className="space-y-2.5 pt-1 border-t border-[var(--border-soft)]">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Kursname (z.B. MMA)…"
                className="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] mt-3" />
              <div className="grid grid-cols-2 gap-2">
                <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: parseInt(e.target.value) }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]">
                  {DAY_NAMES.map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}
                </select>
                <div className="flex gap-1.5 items-center justify-center">
                  {COLORS.map((cl) => (
                    <button key={cl} onClick={() => setForm((f) => ({ ...f, color: cl }))} className="w-7 h-7 rounded-full active:scale-90"
                      style={{ background: COLOR_HEX[cl], outline: form.color === cl ? '2px solid #fff' : 'none', outlineOffset: '2px' }} />
                  ))}
                </div>
                <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
                <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                  className="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[var(--accent)]" />
              </div>
              <button onClick={addClass} disabled={busy || !form.name.trim()} className="w-full text-white font-bold py-2.5 rounded-xl disabled:opacity-40" style={{ background: 'var(--accent)' }}>+ Kurs hinzufügen</button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
