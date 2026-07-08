'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useCallback } from 'react';

interface GalleryImage { id: number; image: string; }

/**
 * Verkleinert ein Bild clientseitig: längste Kante ≤ maxDim, dann JPEG-Qualität so weit
 * runter, bis die data-URL unter maxBytes liegt (Kompressor gegen zu große Dateien).
 */
async function compressImage(file: File, maxDim = 1280, maxBytes = 480_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('no ctx')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      let q = 0.85;
      let out = canvas.toDataURL('image/jpeg', q);
      while (out.length > maxBytes && q > 0.4) { q -= 0.12; out = canvas.toDataURL('image/jpeg', q); }
      resolve(out);
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProfileGallery({ user, isMe, supporter }: { user: string; isMe: boolean; supporter: boolean }) {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [max, setMax] = useState(supporter ? 6 : 4);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [lightbox, setLightbox] = useState<number | null>(null);

  const load = useCallback(() => {
    fetch(`/api/gallery?user=${encodeURIComponent(user)}`).then((r) => r.json()).then((d) => {
      setImages(Array.isArray(d.images) ? d.images : []);
      if (typeof d.max === 'number') setMax(d.max);
    }).catch(() => {});
  }, [user]);
  useEffect(() => { load(); }, [load]);

  // Lightbox: Pfeiltasten + Escape
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null);
      else if (e.key === 'ArrowRight') setLightbox((i) => (i === null ? i : (i + 1) % images.length));
      else if (e.key === 'ArrowLeft') setLightbox((i) => (i === null ? i : (i - 1 + images.length) % images.length));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, images.length]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setMsg('');
    try {
      const image = await compressImage(file);
      const res = await fetch('/api/gallery', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) load();
      else setMsg(d.error ?? 'Konnte Bild nicht hochladen.');
    } catch {
      setMsg('Bild konnte nicht verarbeitet werden.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setImages((prev) => prev.filter((im) => im.id !== id));
    await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }

  // Fremde, leere Galerie gar nicht anzeigen.
  if (!isMe && images.length === 0) return null;

  const atCap = images.length >= max;

  return (
    <div className="card px-4 py-4">
      <div className="section-label mb-2.5">Galerie</div>
      {isMe && images.length === 0 && (
        <p className="text-sm text-[var(--faint)] mb-3">Zeig deine Wettkampffotos, Trophäen &amp; Medaillen.</p>
      )}

      <div className="grid grid-cols-3 gap-2">
        {images.map((im, i) => (
          <div key={im.id} className="relative aspect-square">
            <button onClick={() => setLightbox(i)} className="block w-full h-full active:scale-[0.98] transition-transform">
              <img src={im.image} alt="" className="w-full h-full object-cover rounded-[3px]" />
            </button>
            {isMe && (
              <button onClick={() => remove(im.id)} aria-label="Bild entfernen"
                className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-[3px] text-[11px] text-white"
                style={{ background: 'rgba(0,0,0,0.6)' }}>✕</button>
            )}
          </div>
        ))}
        {isMe && !atCap && (
          <label className="aspect-square grid place-items-center rounded-[3px] border-2 border-dashed cursor-pointer text-[var(--faint)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
            style={{ borderColor: 'var(--border)' }}>
            <span className="text-2xl leading-none">{busy ? '…' : '+'}</span>
            <input type="file" accept="image/*" hidden onChange={onPick} disabled={busy} />
          </label>
        )}
      </div>

      {msg && <p className="text-xs text-[var(--accent)] mt-2">{msg}</p>}
      {isMe && atCap && (
        <p className="text-[11px] text-[var(--faint)] mt-2">
          {supporter ? `Maximal ${max} Bilder erreicht.` : `Maximal ${max} Bilder — als Supporter zeigst du bis zu 6.`}
        </p>
      )}

      {/* Lightbox — durchklickbar */}
      {lightbox !== null && images[lightbox] && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center anim-in"
          style={{ background: 'rgba(0,0,0,0.92)' }} onClick={() => setLightbox(null)}>
          <img src={images[lightbox].image} alt="" onClick={(e) => e.stopPropagation()}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-[3px]" />
          <button onClick={() => setLightbox(null)} aria-label="Schließen"
            className="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-[3px] text-white text-xl" style={{ background: 'rgba(255,255,255,0.12)' }}>✕</button>
          {images.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setLightbox((lightbox - 1 + images.length) % images.length); }} aria-label="Zurück"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-[3px] text-white text-2xl" style={{ background: 'rgba(255,255,255,0.12)' }}>‹</button>
              <button onClick={(e) => { e.stopPropagation(); setLightbox((lightbox + 1) % images.length); }} aria-label="Weiter"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center rounded-[3px] text-white text-2xl" style={{ background: 'rgba(255,255,255,0.12)' }}>›</button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70 tnum">{lightbox + 1} / {images.length}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
