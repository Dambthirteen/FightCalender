# Fight Calendar als iOS-App (Xcode)

Diese App wird mit **Capacitor** in eine native iOS-App verpackt. Die App ist
ein nativer Wrapper, der die deployte Web-App (auf Vercel) in einem WebView
lädt. Dadurch funktionieren Server-Rendering, API-Routen, Neon-Datenbank und
das Cookie-Login **unverändert** weiter — du musst die App-Logik nicht neu
schreiben.

```
iPhone-App (Xcode/Capacitor)  ──lädt──►  https://deine-app.vercel.app
                                              │
                                              └──►  Neon-Postgres (über Vercel)
```

---

## 0. Voraussetzungen (einmalig installieren)

Diese Werkzeuge fehlen aktuell auf dem Rechner und müssen installiert werden:

| Werkzeug    | Wozu                          | Installation |
|-------------|-------------------------------|--------------|
| Node.js     | npm, Capacitor-CLI            | `brew install node` *(oder nvm)* |
| Xcode       | iOS-App bauen & starten       | **App Store** → „Xcode" (mehrere GB) |
| CocoaPods   | iOS-Abhängigkeiten            | `brew install cocoapods` |

Falls Homebrew noch fehlt:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Nach der Xcode-Installation einmalig die Command-Line-Tools auf das volle
Xcode umstellen und die Lizenz bestätigen:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

Prüfen, dass alles da ist:

```bash
node -v && npm -v && pod --version && xcodebuild -version
```

---

## 1. Web-App auf Vercel deployen

Die iOS-App braucht eine erreichbare URL. Wenn noch nicht geschehen:

1. Repo auf [vercel.com](https://vercel.com) importieren.
2. In den **Environment Variables** setzen:
   - `DATABASE_URL` (über die Vercel-↔-Neon-Integration automatisch verknüpfbar)
   - `JWT_SECRET` (langer Zufallsstring)
   - `ADMIN_PASSWORD`
3. Deployen. Du bekommst eine URL wie `https://fight-calender.vercel.app`.

> Merke dir diese URL — sie kommt gleich in die Capacitor-Config.

---

## 2. Projekt vorbereiten

```bash
# Abhängigkeiten installieren (inkl. der neu hinzugefügten Capacitor-Pakete)
npm install
```

Trage deine Vercel-URL in **`capacitor.config.ts`** ein
(Platzhalter `https://DEINE-APP.vercel.app` ersetzen).

---

## 3. iOS-Projekt erzeugen

```bash
# Einmalig: das native ios/-Xcode-Projekt anlegen
npx cap add ios

# Web-Assets & Config ins iOS-Projekt übertragen (nach jeder Config-Änderung)
npm run cap:sync
```

*(Optional)* App-Icon & Splashscreen generieren — siehe `resources/README.md`:

```bash
npm run ios:icons
```

---

## 4. In Xcode öffnen & starten

```bash
npm run cap:open      # öffnet ios/App/App.xcworkspace in Xcode
```

In Xcode:

1. Oben links das **Zielgerät** wählen (Simulator, z. B. „iPhone 16", oder dein
   angestecktes iPhone).
2. Auf **▶ (Run)** klicken.

Beim ersten Mal auf einem echten iPhone:

- In Xcode → Projekt **App** → Tab **Signing & Capabilities** →
  **Team** auf deine Apple-ID setzen („Add an Account…", normale Apple-ID
  reicht für die eigene Nutzung).
- Auf dem iPhone unter **Einstellungen → Allgemein → VPN & Geräteverwaltung**
  dein Entwickler-Zertifikat **vertrauen**.

Das war's — die App startet und lädt deine Web-App. 🎉

---

## Entwicklung gegen den lokalen Server

Wenn du Änderungen live testen willst, ohne jedes Mal nach Vercel zu deployen:

```bash
# Terminal 1: Next.js-Dev-Server
npm run dev

# Terminal 2: Capacitor auf localhost zeigen lassen und syncen
CAP_SERVER_URL=http://localhost:3000 npm run cap:sync
npm run cap:open
```

Funktioniert am einfachsten im **Simulator** (erreicht `localhost` direkt).
Für ein echtes iPhone im selben WLAN stattdessen die LAN-IP deines Macs nutzen
(z. B. `http://192.168.0.42:3000`) — dafür ist in `capacitor.config.ts` bereits
`cleartext` für `http://` aktiviert.

Vor dem Release/TestFlight wieder auf die Vercel-URL zurückstellen und
`npm run cap:sync` ausführen.

---

## Später: an Freunde verteilen / App Store

- **Freunde testen lassen:** Über **TestFlight** (in Xcode → Product → Archive →
  zu App Store Connect hochladen). Braucht einen **Apple Developer Account**
  (99 $/Jahr).
- **Offizieller App-Store-Release:** Apple lehnt reine „Website-im-WebView"-Apps
  manchmal ab (Richtlinie 4.2). Wenn es soweit ist, lohnt es sich, native
  Mehrwerte zu ergänzen — z. B. **Push-Benachrichtigungen** für die
  Voting-Countdowns oder „Wer kommt diese Woche?"-Erinnerungen. Sag mir
  Bescheid, dann bauen wir das ein.

---

## Nützliche npm-Scripts

| Script              | Wirkung |
|---------------------|---------|
| `npm run cap:sync`  | Config & Web-Assets ins iOS-Projekt übertragen |
| `npm run cap:open`  | Xcode-Projekt öffnen |
| `npm run cap:ios`   | `cap:sync` + `cap:open` in einem |
| `npm run ios:icons` | App-Icon & Splash aus `resources/` generieren |

---

## Troubleshooting

- **`pod: command not found`** → CocoaPods installieren (`brew install cocoapods`).
- **Weiße/leere App** → URL in `capacitor.config.ts` falsch oder nicht erreichbar;
  danach `npm run cap:sync` nicht vergessen.
- **Login/Cookies funktionieren nicht** → stelle sicher, dass die Server-URL
  `https://` ist (Vercel) — httpOnly-Cookies brauchen eine sichere Verbindung.
- **Änderungen an der Config wirken nicht** → immer `npm run cap:sync` nach jeder
  Änderung an `capacitor.config.ts`.
