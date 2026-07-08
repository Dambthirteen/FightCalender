import Link from 'next/link';

// Datenschutzerklärung (DSGVO). Vor breitem Launch anwaltlich prüfen lassen.
export const metadata = { title: 'Datenschutz · Submit' };

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen text-[var(--text)]">
      <main className="max-w-md mx-auto px-4 py-8 space-y-5">
        <Link href="/login" className="text-sm text-[var(--muted)] hover:text-white transition-colors">← Zurück</Link>
        <h1 className="font-display text-3xl tracking-wide">Datenschutzerklärung</h1>

        <section className="card p-5 space-y-5 text-sm leading-relaxed text-[var(--muted)]">
          <div>
            <h2 className="text-white font-semibold mb-1">1. Verantwortlicher</h2>
            <p>
              Dani Lipke, Franzstraße 72, 50935 Köln, danijasonlipke@gmail.com. Siehe auch{' '}
              <Link href="/impressum" className="underline">Impressum</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">2. Welche Daten wir verarbeiten</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kontodaten: dein gewählter Name, deine E-Mail-Adresse und ein Passwort (nur als Hash gespeichert).</li>
              <li>Geburtsdatum: freiwillig, <strong>nicht öffentlich</strong> — dient nur der eindeutigen Zuordnung von Profilen und der Altersprüfung; für andere Nutzer nicht sichtbar.</li>
              <li>Nutzungsdaten: Anwesenheiten, eingetragene Ausreden, Trainings-Status, Wettkämpfe, Streaks, Abzeichen.</li>
              <li>Soziale Inhalte: Gruppen-Mitgliedschaften, Lob/Kudos, Profil-Kommentare, Reaktionen, von dir gesetzte Profilangaben (inkl. optionalem Profilbild).</li>
              <li>Push-Benachrichtigungen: technische Abo-Daten deiner Geräte (nur nach ausdrücklicher Aktivierung).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">3. Gesundheitsbezogene Angaben</h2>
            <p>
              Ein von dir gesetzter Status wie „krank“ oder „verletzt“ kann eine Gesundheitsangabe im Sinne von
              Art. 9 DSGVO sein. Diese Angabe ist freiwillig; die Verarbeitung erfolgt ausschließlich auf Grundlage
              deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO). Du kannst einen Trainingstag auch ohne
              konkreten Grund auslassen.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">4. Zwecke &amp; Rechtsgrundlage</h2>
            <p>
              Bereitstellung der App-Funktionen (Trainingsplanung, Gruppen, Gamification) zur Erfüllung des
              Nutzungsverhältnisses (Art. 6 Abs. 1 lit. b DSGVO). Push-Benachrichtigungen sowie gesundheitsbezogene
              Angaben auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a bzw. Art. 9 Abs. 2 lit. a DSGVO), die du
              jederzeit widerrufen kannst.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">5. Hosting &amp; Auftragsverarbeiter</h2>
            <p>
              Die App wird bei Vercel Inc. (USA) gehostet, die Datenbank bei Neon Inc. Für den Versand von
              Transaktions-E-Mails (Bestätigung, Passwort-Reset) nutzen wir Resend Inc. (USA); dabei wird deine
              E-Mail-Adresse übermittelt (Art. 6 Abs. 1 lit. b DSGVO). Diese Anbieter verarbeiten Daten in unserem
              Auftrag; es bestehen Auftragsverarbeitungsverträge (AVV).
            </p>
            <p className="mt-2">
              Soweit dabei Daten in die USA übermittelt werden, erfolgt dies auf Grundlage der EU-Standardvertrags&shy;klauseln
              bzw. einer Zertifizierung nach dem EU-U.S. Data Privacy Framework.
            </p>
            <p className="mt-2">
              Zur Verbesserung der App kann <strong>PostHog</strong> (EU-Server) für eine datensparsame Nutzungsanalyse
              eingesetzt werden: erfasst werden Seitenaufrufe und einzelne Produkt-Ereignisse (z.&nbsp;B. Registrierung,
              Anwesenheit eingetragen). Es findet <em>kein</em> automatisches Erfassen beliebiger Klicks/Eingaben und
              <em>keine</em> Sitzungsaufzeichnung statt. Rechtsgrundlage: berechtigtes Interesse an der Produkt&shy;verbesserung
              (Art. 6 Abs. 1 lit. f DSGVO) bzw. deine Einwilligung.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">6. Cookies</h2>
            <p>
              Wir setzen ausschließlich technisch notwendige Cookies, die für Login und Sitzung erforderlich sind
              (§ 25 Abs. 2 TTDSG). Es werden keine Cookies zu Werbe- oder geräteübergreifenden Tracking-Zwecken gesetzt.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">7. Speicherdauer</h2>
            <p>
              Wir speichern deine Daten, solange dein Konto besteht. Nach der Löschung deines Kontos werden alle
              personenbezogenen Daten entfernt.
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">8. Deine Rechte</h2>
            <p>
              Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und
              Widerspruch. Auskunft (Datenexport) und Löschung kannst du jederzeit direkt in der App unter
              „Einstellungen“ → „Meine Daten“ selbst ausführen.
            </p>
            <p className="mt-2">
              Zudem hast du ein Beschwerderecht bei einer Aufsichtsbehörde, z.&nbsp;B. der Landesbeauftragten für
              Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW).
            </p>
          </div>

          <div>
            <h2 className="text-white font-semibold mb-1">9. Kontakt</h2>
            <p>Bei Fragen zum Datenschutz: danijasonlipke@gmail.com.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
