'use client';

import { useEffect, useRef, useState } from 'react';

// Ziel der „Guck dir diesen Loser an!"-Push. Öffnet die Frontkamera als Spiegel.
// getUserMedia braucht HTTPS (Vercel ok). iOS verlangt playsInline + ggf. eine
// Nutzer-Geste — deshalb gibt es einen „Kamera starten"-Fallback-Button.
export default function LoserPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'idle' | 'on' | 'denied' | 'error'>('idle');

  async function start() {
    if (!navigator.mediaDevices?.getUserMedia) { setState('error'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setState('on');
    } catch (e) {
      setState((e as DOMException)?.name === 'NotAllowedError' ? 'denied' : 'error');
    }
  }

  useEffect(() => {
    start();
    return () => streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[950] overflow-hidden">
      {/* Frontkamera als Spiegel (horizontal gespiegelt) */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)', opacity: state === 'on' ? 1 : 0, transition: 'opacity .3s' }}
      />
      {/* Verlauf für Lesbarkeit der Texte */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.6) 0%, transparent 28%, transparent 60%, rgba(0,0,0,.75) 100%)' }} />

      {/* Headline */}
      <div className="absolute top-0 left-0 right-0 px-6 pt-[calc(env(safe-area-inset-top)+24px)] text-center">
        <div className="text-4xl mb-2">🐔</div>
        <h1 className="font-display text-4xl tracking-wide text-white leading-tight"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,.8)' }}>
          Guck dir diesen<br />Loser an!
        </h1>
      </div>

      {/* Zustände ohne Bild */}
      {state !== 'on' && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div>
            {state === 'denied' && (
              <p className="text-white/80 text-sm mb-4 max-w-xs">
                Kamerazugriff wurde blockiert. Erlaube die Kamera in den Einstellungen und versuch es nochmal.
              </p>
            )}
            {state === 'error' && (
              <p className="text-white/80 text-sm mb-4 max-w-xs">
                Kamera nicht verfügbar auf diesem Gerät.
              </p>
            )}
            <button onClick={start} className="btn btn-primary">
              Kamera starten
            </button>
          </div>
        </div>
      )}

      {/* Schließen */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-[calc(env(safe-area-inset-bottom)+92px)] flex justify-center">
        <a href="/start" className="btn btn-ghost text-white/90">Schon gut, schließen</a>
      </div>
    </div>
  );
}
