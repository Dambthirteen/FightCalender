'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from './UserProvider';
import { renderWrappedCard } from '@/lib/wrapped-card';
import { track } from '@/lib/analytics';
import { macherMonth } from '@/lib/gender';

interface Highlight { user: string; count: number }
interface ExcuseHi { user: string; excuse: string; accept?: number; reject?: number }
interface WrappedData {
  available: boolean;
  seen?: boolean;
  month: string;
  groupName: string;
  macher: Highlight | null;
  macherGender?: string | null;
  bitch: Highlight | null;
  bestExcuse: ExcuseHi | null;
  worstExcuse: ExcuseHi | null;
  topJudge: Highlight | null;
  lobKing: Highlight | null;
  me: { trainings: number; skips: number; lobe: number; bitch: number };
  streak?: { days: number; weeks: number } | null;
  praiseComment?: { from: string; reason: string; kind: string } | null;
  trainingDays?: number;
  topClass?: { name: string; count: number } | null;
  youMacher?: boolean;
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}
function clientYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface Card { emoji: string; label: string; big: string; sub?: string; lines?: string[]; color: string; }

function buildCards(d: WrappedData): Card[] {
  const cards: Card[] = [];
  cards.push({ emoji: '📅', label: `${d.groupName} · Rückblick`, big: monthLabel(d.month), sub: 'Dein Monat in Zahlen', color: 'var(--teal)' });
  if (d.macher) cards.push({ emoji: '🏆', label: macherMonth(d.macherGender), big: d.macher.user, sub: `${d.macher.count}× am Start`, color: 'var(--gold)' });
  if (d.bitch) cards.push({ emoji: '🐔', label: 'Chicken des Monats', big: d.bitch.user, sub: `${d.bitch.count}× gefehlt`, color: 'var(--bitch)' });
  if (d.bestExcuse) cards.push({ emoji: '😇', label: 'Beste Ausrede', big: d.bestExcuse.user, sub: `„${d.bestExcuse.excuse}"`, color: 'var(--good)' });
  if (d.worstExcuse) cards.push({ emoji: '🙄', label: 'Härtester Reinfall', big: d.worstExcuse.user, sub: `„${d.worstExcuse.excuse}"`, color: 'var(--accent)' });
  if (d.topJudge) cards.push({ emoji: '⚖️', label: 'Fleißigster Richter', big: d.topJudge.user, sub: `${d.topJudge.count}× gerichtet`, color: 'var(--teal)' });
  if (d.lobKing) cards.push({ emoji: '👏', label: 'Meiste Würdigungen', big: d.lobKing.user, sub: `${d.lobKing.count}× gelobt`, color: 'var(--gold)' });
  if (d.topClass) cards.push({ emoji: '🥋', label: 'Meist trainiert', big: d.topClass.name, sub: `${d.topClass.count}× diesen Monat`, color: 'var(--teal)' });
  if (d.praiseComment) cards.push({ emoji: '💬', label: d.praiseComment.kind === 'gigalob' ? 'Gigalob erhalten von' : 'Lob erhalten von', big: d.praiseComment.from, sub: `„${d.praiseComment.reason}"`, color: 'var(--good)' });
  const meLines = [`${d.me.skips}× geschwänzt`, `${d.me.bitch} Chicken-Punkte`, `${d.me.lobe} Würdigungen erhalten`];
  if (d.streak && d.streak.weeks >= 1) meLines.unshift(`🔥 ${d.streak.weeks} ${d.streak.weeks === 1 ? 'Woche' : 'Wochen'} Streak`);
  cards.push({ emoji: '💪', label: 'Dein Monat', big: `${d.me.trainings}× trainiert`, lines: meLines, color: 'var(--accent-2)' });
  return cards;
}

function Story({ data, onClose }: { data: WrappedData; onClose: () => void }) {
  const cards = buildCards(data);
  const total = cards.length + 1;              // + Zusammenfassungs-Karte am Ende
  const [i, setI] = useState(0);
  const isSummary = i >= cards.length;
  const card = cards[i];
  const glowColor = card ? card.color : 'var(--accent)';
  const next = () => (i < total - 1 ? setI(i + 1) : onClose());
  const prev = () => setI((v) => Math.max(0, v - 1));
  const [sharing, setSharing] = useState(false);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const cardBlob = useRef<Blob | null>(null);

  // Teilbare Karte einmal vorab rendern (dient als letzter Slide UND fürs Teilen).
  useEffect(() => {
    let url: string | null = null;
    renderWrappedCard({
      month: data.month, groupName: data.groupName,
      trainingDays: data.trainingDays ?? data.me.trainings,
      streak: data.streak, youMacher: data.youMacher, topClass: data.topClass,
    }).then((blob) => {
      if (!blob) return;
      cardBlob.current = blob;
      url = URL.createObjectURL(blob);
      setCardUrl(url);
    }).catch(() => {});
    return () => { if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function share() {
    setSharing(true);
    try {
      const blob = cardBlob.current ?? await renderWrappedCard({
        month: data.month, groupName: data.groupName,
        trainingDays: data.trainingDays ?? data.me.trainings,
        streak: data.streak, youMacher: data.youMacher, macherGender: data.macherGender, topClass: data.topClass,
      });
      if (!blob) return;
      track('wrapped_shared', { month: data.month });
      const file = new File([blob], `submit-wrapped-${data.month}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] }) && navigator.share) {
        try { await navigator.share({ files: [file], title: 'Submit', text: 'Mein Trainingsmonat' }); } catch { /* abgebrochen */ }
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = file.name; a.click();
        URL.revokeObjectURL(url);
      }
    } finally { setSharing(false); }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col" style={{ background: '#08080a' }}>
      {/* Hintergrund-Glow in Kartenfarbe */}
      <div className="absolute inset-0 pointer-events-none transition-colors duration-300"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${glowColor}22, transparent 60%)` }} />

      {/* Fortschritts-Balken */}
      <div className="relative flex gap-1 px-3 pt-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        {Array.from({ length: total }).map((_, idx) => (
          <div key={idx} className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.18)' }}>
            <div className="h-full rounded-full" style={{ width: idx <= i ? '100%' : '0%', background: '#fff', transition: 'width 0.3s' }} />
          </div>
        ))}
      </div>
      <div className="relative flex justify-end px-4 pt-2">
        <button onClick={onClose} aria-label="Schließen" className="text-white/70 hover:text-white text-xl">✕</button>
      </div>

      {/* Tipp-Zonen */}
      <button aria-label="Zurück" onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/3 z-10" />
      <button aria-label="Weiter" onClick={next} className="absolute right-0 top-0 bottom-0 w-2/3 z-10" />

      {/* Karte bzw. Zusammenfassung */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-8 min-h-0">
        {isSummary ? (
          <div key="summary" className="anim-pop flex items-center justify-center w-full">
            {cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cardUrl} alt="Dein Rückblick" className="max-w-full rounded-2xl shadow-2xl shadow-black/50" style={{ maxHeight: '72vh' }} />
            ) : (
              <div className="text-[var(--muted)] text-sm">Karte wird erstellt…</div>
            )}
          </div>
        ) : card ? (
          <div key={i} className="anim-pop">
            {card.emoji === '🐔'
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src="/logo-chicken.png" alt="" className="w-20 h-20 mx-auto mb-4 object-contain" />
              : <div className="text-6xl mb-4">{card.emoji}</div>}
            <div className="section-label mb-2" style={{ color: card.color }}>{card.label}</div>
            <div className="font-display text-4xl tracking-wide leading-tight">{card.big}</div>
            {card.sub && <div className="text-[var(--muted)] mt-3 max-w-xs mx-auto">{card.sub}</div>}
            {card.lines && (
              <div className="mt-4 space-y-1.5">
                {card.lines.map((l) => <div key={l} className="text-[var(--muted)]">{l}</div>)}
              </div>
            )}
          </div>
        ) : null}
      </div>

      <div className="relative z-20 flex flex-col items-center gap-3 pb-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
        <button onClick={(e) => { e.stopPropagation(); share(); }} disabled={sharing}
          className="text-sm font-bold text-white px-6 py-2.5 rounded-full disabled:opacity-50" style={{ background: 'var(--accent)' }}>
          {sharing ? 'Erstelle Bild…' : 'Teilen'}
        </button>
        <div className="text-[11px] text-[var(--faint)]">Tippen zum Weiterblättern</div>
      </div>
    </div>
  );
}

/** Rückmeldung, wenn der manuell geöffnete Rückblick lädt oder (noch) keine Daten hat. */
function Notice({ busy, text, onClose }: { busy: boolean; text: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm anim-in px-6"
      onClick={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      {busy ? (
        <div className="text-[var(--muted)] text-sm">Rückblick wird geladen…</div>
      ) : (
        <div className="card w-full max-w-xs p-6 text-center anim-up">
          <div className="section-label mb-2" style={{ color: 'var(--teal)' }}>Monats-Wrapped</div>
          <p className="text-sm text-[var(--muted)]">{text}</p>
          <button onClick={onClose} className="btn btn-primary w-full mt-5">Alles klar</button>
        </div>
      )}
    </div>
  );
}

/** Auto-Popup am Monatsanfang (einmalig) + Vorschau via ?wrappedpreview=1. */
export default function WrappedPopup() {
  const { userName, loading } = useUser();
  const [data, setData] = useState<WrappedData | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);                    // manueller Abruf läuft
  const [notice, setNotice] = useState<string | null>(null);  // manuell, aber (noch) nichts zu zeigen
  const loadedFor = useRef('');

  useEffect(() => {
    if (loading || !userName) return;
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isPreview = params.get('wrappedpreview') === '1'; // Test: aktueller Monat
    const isManual = params.get('wrapped') === '1';          // manuell: letzter Monat, ungeachtet "gesehen"
    const manual = isPreview || isManual;
    const key = isPreview ? '__preview__' : isManual ? '__manual__' : userName;
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    // Spinner erst nach dem Mount setzen (window darf nicht im Render gelesen werden → Hydration-Mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (manual) setBusy(true);
    const url = isPreview ? `/api/wrapped?month=${clientYm()}` : '/api/wrapped';
    fetch(url).then((r) => r.json()).then((d: WrappedData) => {
      if (manual) {
        setBusy(false);
        if (d.available) { setPreview(true); setData(d); } // nicht als gesehen markieren
        else setNotice(`Für ${d.month ? monthLabel(d.month) : 'den letzten Monat'} gibt es noch keinen Rückblick – trainiert erst mal fleißig.`);
      } else if (d.available && !d.seen) setData(d);
    }).catch(() => {
      if (manual) { setBusy(false); setNotice('Der Rückblick konnte gerade nicht geladen werden. Bitte später erneut versuchen.'); }
    });
  }, [userName, loading]);

  function close() {
    if (!preview && data) {
      fetch('/api/wrapped/seen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ month: data.month }) }).catch(() => {});
    }
    setData(null);
  }

  if (data) return <Story data={data} onClose={close} />;
  if (busy || notice) return <Notice busy={busy} text={notice ?? ''} onClose={() => { setBusy(false); setNotice(null); }} />;
  return null;
}
