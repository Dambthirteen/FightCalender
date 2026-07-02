import Link from 'next/link';

// Impressum nach § 5 DDG (ehem. TMG). PLATZHALTER — vom Betreiber auszufüllen.
export const metadata = { title: 'Impressum · Tap In' };

export default function ImpressumPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="max-w-md mx-auto px-4 py-8 space-y-5">
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Zurück</Link>
        <h1 className="font-display text-3xl tracking-wide">Impressum</h1>

        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--accent)' }}>
          Platzhalter-Vorlage. Vor dem öffentlichen Launch mit echten Angaben füllen und rechtlich prüfen lassen.
        </div>

        <section className="card p-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
          <div>
            <h2 className="text-white font-semibold mb-1">Angaben gemäß § 5 DDG</h2>
            <p>
              [Vor- und Nachname / Firma]<br />
              [Straße und Hausnummer]<br />
              [PLZ und Ort]<br />
              [Land]
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">Kontakt</h2>
            <p>
              E-Mail: [deine-adresse@example.com]<br />
              Telefon: [optional]
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">Verantwortlich i. S. d. § 18 Abs. 2 MStV</h2>
            <p>[Vor- und Nachname, Anschrift wie oben]</p>
          </div>

          <p className="text-xs text-[var(--faint)]">
            „Tap In“ ist ein privates, nicht-kommerzielles Projekt zur Trainings-Koordination.
          </p>
        </section>
      </main>
    </div>
  );
}
