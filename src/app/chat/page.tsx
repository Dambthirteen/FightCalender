'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useUser } from '@/components/UserProvider';
import { colorFor, initials } from '@/lib/avatar';

interface Msg { id: string; user: string; text: string; ts: string; color: string | null }

function timeLabel(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const { userName } = useUser();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupAvatar, setGroupAvatar] = useState<string | null>(null);
  const [menu, setMenu] = useState<Msg | null>(null);
  const [err, setErr] = useState('');
  const [loaded, setLoaded] = useState(false);
  const lastId = useRef('0');
  const scroller = useRef<HTMLDivElement | null>(null);

  const markRead = useCallback((id: string) => {
    fetch('/api/chat/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lastId: id }) }).catch(() => {});
  }, []);

  const scrollDown = useCallback(() => {
    requestAnimationFrame(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; });
  }, []);

  // Gruppen-Kopf.
  useEffect(() => {
    fetch('/api/groups').then((r) => r.json()).then((d) => {
      const cur = (d.groups ?? []).find((g: { id: number; name: string; clan_tag?: string | null; avatar?: string | null }) => g.id === d.current);
      if (cur) { setGroupName(cur.clan_tag ? `[${cur.clan_tag}] ${cur.name}` : cur.name); setGroupAvatar(cur.avatar ?? null); }
    }).catch(() => {});
  }, []);

  // Erstladen.
  useEffect(() => {
    fetch('/api/chat').then((r) => r.json()).then((d) => {
      const m: Msg[] = Array.isArray(d.messages) ? d.messages : [];
      setMsgs(m); setCanModerate(!!d.canModerate); setLoaded(true);
      if (m.length) { lastId.current = m[m.length - 1].id; markRead(lastId.current); }
      scrollDown();
    }).catch(() => setLoaded(true));
  }, [markRead, scrollDown]);

  // Polling für neue Nachrichten.
  useEffect(() => {
    const iv = setInterval(() => {
      fetch(`/api/chat?after=${lastId.current}`).then((r) => r.json()).then((d) => {
        const fresh: Msg[] = Array.isArray(d.messages) ? d.messages : [];
        if (fresh.length) {
          setMsgs((prev) => [...prev, ...fresh]);
          lastId.current = fresh[fresh.length - 1].id;
          markRead(lastId.current);
          scrollDown();
        }
      }).catch(() => {});
    }, 4000);
    return () => clearInterval(iv);
  }, [markRead, scrollDown]);

  async function send() {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true); setErr('');
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: t }) });
      const d = await res.json();
      if (res.ok) {
        setMsgs((prev) => [...prev, d]);
        lastId.current = d.id; setText(''); scrollDown();
      } else setErr(d.error ?? 'Konnte nicht senden.');
    } catch { setErr('Netzwerkfehler'); }
    finally { setSending(false); }
  }

  async function moderate(action: string, m: Msg) {
    setMenu(null);
    await fetch('/api/chat/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, id: m.id, user: m.user }) }).catch(() => {});
    if (action === 'delete') setMsgs((prev) => prev.filter((x) => x.id !== m.id));
    if (action === 'block') setMsgs((prev) => prev.filter((x) => x.user !== m.user));
    if (action === 'report') setErr('Gemeldet. Danke — ein Admin schaut es sich an.');
  }

  return (
    <div className="flex flex-col text-[var(--text)]" style={{ height: '100dvh' }}>
      {/* Kopf */}
      <header className="shrink-0 flex items-center gap-3 px-4 border-b" style={{ borderColor: 'var(--border-soft)', paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)', paddingBottom: '0.75rem' }}>
        <a href="/start" className="w-9 h-9 grid place-items-center rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] text-[var(--muted)] hover:text-white active:scale-95 transition-all">←</a>
        {groupAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={groupAvatar} alt="" className="w-9 h-9 rounded-xl object-cover" />
        ) : (
          <span className="w-9 h-9 rounded-xl grid place-items-center font-display text-sm" style={{ background: `${colorFor(groupName || 'C')}22`, color: colorFor(groupName || 'C') }}>{initials(groupName || 'C')}</span>
        )}
        <div className="min-w-0">
          <div className="font-display text-lg tracking-wide truncate leading-tight">{groupName || 'Chat'}</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--faint)]">Gruppenchat</div>
        </div>
      </header>

      {/* Nachrichten */}
      <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {!loaded ? (
          <div className="text-center text-[var(--faint)] text-sm py-10">Laden…</div>
        ) : msgs.length === 0 ? (
          <div className="text-center text-[var(--faint)] text-sm py-10">Noch keine Nachrichten. Schreib die erste! 💬</div>
        ) : msgs.map((m) => {
          const mine = m.user === userName;
          const c = colorFor(m.user, m.color);
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? 'flex-row-reverse' : ''}`}>
              {!mine && <span className="w-8 h-8 rounded-full grid place-items-center text-[11px] font-display shrink-0 self-end" style={{ background: `${c}22`, color: c, border: `1px solid ${c}` }}>{initials(m.user)}</span>}
              <button onClick={() => setMenu(m)} className="max-w-[76%] text-left active:opacity-80">
                {!mine && <div className="text-[11px] font-semibold mb-0.5 ml-1" style={{ color: c }}>{m.user}</div>}
                <div className="px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                  style={mine
                    ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: 6 }
                    : { background: 'var(--surface-2)', borderBottomLeftRadius: 6 }}>
                  {m.text}
                </div>
                <div className={`text-[10px] text-[var(--faint)] mt-0.5 tnum ${mine ? 'text-right mr-1' : 'ml-1'}`}>{timeLabel(m.ts)}</div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Eingabe */}
      <div className="shrink-0 border-t px-3 py-2.5" style={{ borderColor: 'var(--border-soft)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.6rem)' }}>
        {err && <p className="text-[11px] text-[var(--accent)] mb-1.5 px-1">{err}</p>}
        <div className="flex items-end gap-2">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={1}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Nachricht…"
            className="flex-1 resize-none bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl px-4 py-2.5 text-sm text-white placeholder-[var(--faint)] focus:outline-none focus:border-[var(--accent)] max-h-28" />
          <button onClick={send} disabled={sending || !text.trim()}
            className="shrink-0 w-11 h-11 grid place-items-center rounded-full text-white disabled:opacity-40 active:scale-95 transition-transform" style={{ background: 'var(--accent)' }} aria-label="Senden">➤</button>
        </div>
      </div>

      {/* Aktions-Sheet */}
      {menu && (
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/60 backdrop-blur-sm anim-in"
          onClick={(e) => { if (e.target === e.currentTarget) setMenu(null); }}>
          <div className="card w-full max-w-md p-2 mb-0 rounded-b-none anim-up">
            <div className="px-3 py-2 text-[11px] text-[var(--faint)] truncate">Nachricht von {menu.user}</div>
            {(menu.user === userName || canModerate) && (
              <button onClick={() => moderate('delete', menu)} className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-white/5" style={{ color: 'var(--accent)' }}>Löschen</button>
            )}
            {menu.user !== userName && (
              <>
                <button onClick={() => moderate('report', menu)} className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-white/5">Melden</button>
                <button onClick={() => moderate('block', menu)} className="w-full text-left px-3 py-3 rounded-xl text-sm font-semibold hover:bg-white/5">{menu.user} blockieren</button>
              </>
            )}
            <button onClick={() => setMenu(null)} className="w-full text-center px-3 py-3 rounded-xl text-sm text-[var(--muted)] hover:bg-white/5">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}
