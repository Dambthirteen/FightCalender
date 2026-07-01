'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from './UserProvider';

interface Highlight { user: string; count: number }
interface ExcuseHi { user: string; excuse: string; accept?: number; reject?: number }
interface WrappedData {
  available: boolean;
  seen?: boolean;
  month: string;
  groupName: string;
  macher: Highlight | null;
  bitch: Highlight | null;
  bestExcuse: ExcuseHi | null;
  worstExcuse: ExcuseHi | null;
  topJudge: Highlight | null;
  lobKing: Highlight | null;
  me: { trainings: number; skips: number; lobe: number; bitch: number };
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
  if (d.macher) cards.push({ emoji: '🏆', label: 'Macher des Monats', big: d.macher.user, sub: `${d.macher.count}× am Start`, color: 'var(--gold)' });
  if (d.bitch) cards.push({ emoji: '🐔', label: 'Bitch des Monats', big: d.bitch.user, sub: `${d.bitch.count}× gefehlt`, color: 'var(--bitch)' });
  if (d.bestExcuse) cards.push({ emoji: '😇', label: 'Beste Ausrede', big: d.bestExcuse.user, sub: `„${d.bestExcuse.excuse}"`, color: 'var(--good)' });
  if (d.worstExcuse) cards.push({ emoji: '🙄', label: 'Härtester Reinfall', big: d.worstExcuse.user, sub: `„${d.worstExcuse.excuse}"`, color: 'var(--accent)' });
  if (d.topJudge) cards.push({ emoji: '⚖️', label: 'Fleißigster Richter', big: d.topJudge.user, sub: `${d.topJudge.count}× gerichtet`, color: 'var(--teal)' });
  if (d.lobKing) cards.push({ emoji: '👏', label: 'Meiste Würdigungen', big: d.lobKing.user, sub: `${d.lobKing.count}× gelobt`, color: 'var(--gold)' });
  cards.push({
    emoji: '💪', label: 'Dein Monat', big: `${d.me.trainings}× trainiert`,
    lines: [`${d.me.skips}× geschwänzt`, `${d.me.bitch} Bitch-Punkte`, `${d.me.lobe} Würdigungen erhalten`],
    color: 'var(--accent-2)',
  });
  cards.push({ emoji: '🥊', label: 'Weiter geht’s', big: 'Bis nächsten Monat!', sub: 'Bleib am Start.', color: 'var(--accent)' });
  return cards;
}

function Story({ data, onClose }: { data: WrappedData; onClose: () => void }) {
  const cards = buildCards(data);
  const [i, setI] = useState(0);
  const card = cards[i];
  const next = () => (i < cards.length - 1 ? setI(i + 1) : onClose());
  const prev = () => setI((v) => Math.max(0, v - 1));

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col" style={{ background: '#08080a' }}>
      {/* Hintergrund-Glow in Kartenfarbe */}
      <div className="absolute inset-0 pointer-events-none transition-colors duration-300"
        style={{ background: `radial-gradient(120% 80% at 50% 0%, ${card.color}22, transparent 60%)` }} />

      {/* Fortschritts-Balken */}
      <div className="relative flex gap-1 px-3 pt-3" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
        {cards.map((_, idx) => (
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

      {/* Karte */}
      <div className="relative flex-1 flex flex-col items-center justify-center text-center px-8">
        <div key={i} className="anim-pop">
          <div className="text-6xl mb-4">{card.emoji}</div>
          <div className="section-label mb-2" style={{ color: card.color }}>{card.label}</div>
          <div className="font-display text-4xl tracking-wide leading-tight">{card.big}</div>
          {card.sub && <div className="text-[var(--muted)] mt-3 max-w-xs mx-auto">{card.sub}</div>}
          {card.lines && (
            <div className="mt-4 space-y-1.5">
              {card.lines.map((l) => <div key={l} className="text-[var(--muted)]">{l}</div>)}
            </div>
          )}
        </div>
      </div>

      <div className="relative pb-8 text-center text-[11px] text-[var(--faint)]">Tippen zum Weiterblättern</div>
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
