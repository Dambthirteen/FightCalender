'use client';

import { useEffect, useState } from 'react';

// VAPID-Public-Key (base64url) → Uint8Array für applicationServerKey.
// Puffer explizit als ArrayBuffer anlegen (BufferSource-kompatibel).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export default function NotificationsToggle() {
  const [supported, setSupported] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const supp = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(supp);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setIsStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
        // iOS Safari nutzt navigator.standalone
        (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
    if (!supp) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function subscribe() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      if (!VAPID_PUBLIC_KEY) {
        setError('Server nicht konfiguriert (VAPID-Schlüssel fehlt).');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Benachrichtigungen wurden nicht erlaubt.');
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(JSON.parse(JSON.stringify(sub))),
      });
      if (!res.ok) {
        setError('Konnte Abo nicht speichern.');
        return;
      }
      setSubscribed(true);
      setMsg('Benachrichtigungen sind aktiv. 🔔');
    } catch (e) {
      setError('Fehler beim Aktivieren: ' + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setMsg('Benachrichtigungen deaktiviert.');
    } catch (e) {
      setError('Fehler: ' + String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setError('');
    setMsg('');
    try {
      const res = await fetch('/api/push/test', { method: 'POST' });
      if (!res.ok) {
        setError('Test fehlgeschlagen.');
        return;
      }
      setMsg('Test verschickt — sollte gleich erscheinen. 📲');
    } catch (e) {
      setError('Fehler: ' + String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-[#111] border border-[#1a1a1a] rounded-2xl p-6">
      <h2 className="font-semibold text-base mb-1">🔔 Benachrichtigungen</h2>
      <p className="text-sm text-gray-400 mb-5">
        Erhalte ~2 Std vor deinen zugesagten Kursen eine Erinnerung, wer noch dabei ist.
      </p>

      {!supported ? (
        <p className="text-sm text-gray-500">
          Dieses Gerät / dieser Browser unterstützt keine Push-Benachrichtigungen.
        </p>
      ) : isIOS && !isStandalone ? (
        <div className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
          Auf dem iPhone musst du die App zuerst <strong>zum Home-Bildschirm hinzufügen</strong>:
          unten auf <span aria-label="Teilen">⎋ Teilen</span> tippen → „Zum Home-Bildschirm". Öffne
          die App dann über das neue Icon und aktiviere hier die Benachrichtigungen.
        </div>
      ) : (
        <div className="space-y-3">
          {!subscribed ? (
            <button
              onClick={subscribe}
              disabled={busy}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
            >
              {busy ? 'Moment…' : 'Benachrichtigungen aktivieren'}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={sendTest}
                disabled={busy}
                className="bg-[#1a1a1a] border border-[#333] hover:border-[#555] disabled:opacity-40 text-white font-medium px-4 py-2.5 rounded-lg transition-colors text-sm"
              >
                Test senden
              </button>
              <button
                onClick={unsubscribe}
                disabled={busy}
                className="text-gray-500 hover:text-red-500 disabled:opacity-40 font-medium px-4 py-2.5 rounded-lg transition-colors text-sm"
              >
                Deaktivieren
              </button>
            </div>
          )}
          {msg && <p className="text-green-500 text-sm">{msg}</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      )}
    </section>
  );
}
