import Link from 'next/link';

// Impressum nach § 5 DDG (ehem. TMG). Vor breitem Launch anwaltlich prüfen lassen.
export const metadata = { title: 'Impressum · Submit' };

export default function ImpressumPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="max-w-md mx-auto px-4 py-8 space-y-5">
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Zurück</Link>
        <h1 className="font-display text-3xl tracking-wide">Impressum</h1>

        <section className="card p-5 space-y-4 text-sm leading-relaxed text-[var(--muted)]">
          <div>
            <h2 className="text-white font-semibold mb-1">Angaben gemäß § 5 DDG</h2>
            <p>
              Dani Lipke<br />
              Einzelunternehmen<br />
              Franzstraße 72<br />
              50935 Köln<br />
              Deutschland
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">Kontakt</h2>
            <p>E-Mail: danijasonlipke@gmail.com</p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">Verantwortlich i. S. d. § 18 Abs. 2 MStV</h2>
            <p>Dani Lipke, Anschrift wie oben.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">Verbraucherstreitbeilegung</h2>
            <p>
              Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
              Verbraucherschlichtungsstelle teilzunehmen.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
