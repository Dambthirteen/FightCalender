import Link from 'next/link';

// Datenschutzerklärung (DSGVO). Substanzielle Vorlage mit Platzhaltern für die
// Betreiber-Identität — vor dem Launch ausfüllen und rechtlich prüfen lassen.
export const metadata = { title: 'Datenschutz · Tap In' };

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="max-w-md mx-auto px-4 py-8 space-y-5">
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Zurück</Link>
        <h1 className="font-display text-3xl tracking-wide">Datenschutzerklärung</h1>

        <div className="rounded-xl px-4 py-3 text-xs" style={{ background: 'var(--accent-soft)', border: '1px solid rgba(255,59,48,0.3)', color: 'var(--accent)' }}>
          Platzhalter-Vorlage. Betreiber-Angaben ergänzen und vor dem öffentlichen Launch anwaltlich prüfen lassen.
        </div>

        <section className="card p-5 space-y-5 text-sm leading-relaxed text-[var(--muted)]">
          <div>
            <h2 className="text-white font-semibold mb-1">1. Verantwortlicher</h2>
            <p>[Vor- und Nachname], [Anschrift], [E-Mail]. Siehe auch <Link href="/impressum" className="underline">Impressum</Link>.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">2. Welche Daten wir verarbeiten</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kontodaten: dein gewählter Name und ein Passwort (nur als Hash gespeichert).</li>
              <li>Nutzungsdaten: Anwesenheiten, eingetragene Ausreden, Trainings-Status (krank/verletzt/Urlaub), Wettkämpfe, Streaks, Abzeichen.</li>
              <li>Soziale Inhalte: Gruppen-Mitgliedschaften, Lob/Kudos, Profil-Kommentare, Reaktionen, von dir gesetzte Profilangaben.</li>
              <li>Push-Benachrichtigungen: technische Abo-Daten deiner Geräte (nur nach ausdrücklicher Aktivierung).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">3. Zwecke &amp; Rechtsgrundlage</h2>
            <p>
              Bereitstellung der App-Funktionen (Trainingsplanung, Gruppen, Gamification) zur Erfüllung des
              Nutzungsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO). Push-Benachrichtigungen auf Grundlage deiner
              Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Einstellungen widerrufen kannst.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">4. Hosting &amp; Auftragsverarbeiter</h2>
            <p>
              Die App wird bei [Vercel Inc.] gehostet, die Datenbank bei [Neon]. Diese Anbieter verarbeiten Daten
              in unserem Auftrag; es bestehen entsprechende Auftragsverarbeitungsverträge (AVV). [Angaben und
              ggf. Drittland-Transfer/EU-Standardvertragsklauseln hier konkretisieren.]
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">5. Speicherdauer</h2>
            <p>Wir speichern deine Daten, solange dein Konto besteht. Nach der Löschung deines Kontos werden alle personenbezogenen Daten entfernt.</p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">6. Deine Rechte</h2>
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
              Widerspruch sowie ein Beschwerderecht bei einer Aufsichtsbehörde. Auskunft und Löschung kannst du
              direkt in der App unter „Mein Status“ → „Meine Daten“ selbst ausführen (Datenexport bzw. Konto löschen).
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">7. Kontakt</h2>
            <p>Bei Fragen zum Datenschutz: [deine-adresse@example.com].</p>
          </div>
        </section>
      </main>
    </div>
  );
}
