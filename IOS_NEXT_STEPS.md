# iOS-App – Komplette Anleitung & Fortschritt

> Dieses Dokument ist deine **Checkliste**. Hak ab, was erledigt ist.
> Technische Details zu jedem Schritt stehen in **`IOS_SETUP.md`**.
>
> **Ansatz:** Capacitor-Wrapper → die App lädt deine auf **Vercel** deployte
> Web-App in einem nativen iOS-WebView. Server, API, Neon-DB und Login laufen
> unverändert weiter.

**Legende:** 🧑 = machst du selbst (GUI/Passwort nötig) · 🤖 = kann Claude im
Terminal für dich erledigen

---

## ✅ Stand (zuletzt aktualisiert: 19.06.2026)

- [x] Capacitor-Setup im Code vorbereitet (capacitor.config.ts, Scripts,
      Manifest, Viewport, .gitignore, Doku) — **erledigt**
- [x] **Phase 1:** Mac-Werkzeuge installiert — **erledigt**
      (Node v26.3.1, npm 11.16.0, CocoaPods 1.16.2, Xcode 26.5, Homebrew 6.0.2)
- [x] **Phase 2:** Web-App auf Vercel live — **erledigt**
      (URL: https://fight-calender.vercel.app · Neon-DB verbunden · Tabellen via
      `POST /api/setup` angelegt)
- [x] **Phase 3:** iOS-Projekt erzeugt & in Xcode gestartet — **erledigt**
      (App läuft im Simulator und lädt die Vercel-Web-App ✅)
- [~] **Push-Benachrichtigungen (gratis, via PWA):** Code **fertig & baut** —
      Erinnerung ~2 Std vor Kursbeginn an Zugesagte. 🧑 offen: Env-Vars in
      Vercel, Code pushen, `POST /api/setup`, cron-job.org einrichten, am iPhone
      aktivieren. **Anleitung: `PUSH_SETUP.md`.**
- [ ] **Phase 4 (optional/später):** App-Icon, echtes iPhone, TestFlight

➡️ **Nächster Schritt: `PUSH_SETUP.md` durchgehen (Push live schalten).**

---

## Phase 1 – Mac vorbereiten 🧑

> Du wolltest den Mac aktualisieren — mach das zuerst, dann diese Schritte.

1. **macOS aktualisieren:** Systemeinstellungen → Allgemein → Softwareupdate →
   installieren, neu starten.

2. **Homebrew installieren** (Paketmanager). In die Claude-Eingabezeile tippen,
   mit `!` davor, damit du dein Mac-Passwort eingeben kannst:
   ```
   ! /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   ```

3. **Homebrew in die PATH aufnehmen** (Apple-Silicon-Mac → `/opt/homebrew`):
   ```
   ! echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
   ```

4. **Node + CocoaPods installieren:**
   ```
   ! brew install node cocoapods
   ```

5. **Xcode** aus dem **App Store** installieren (mehrere GB – parallel starten,
   dauert am längsten). Danach:
   ```
   ! sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
   ! sudo xcodebuild -license accept
   ```

6. **Prüfen, dass alles da ist** (das kann Claude übernehmen 🤖):
   ```
   node -v && npm -v && pod --version && xcodebuild -version
   ```

✅ **Phase 1 fertig, wenn alle vier Versionen ohne Fehler erscheinen.**

---

## Phase 2 – Web-App auf Vercel live bringen 🧑

1. Auf [vercel.com](https://vercel.com) einloggen → **Repo importieren**
   (`Dambthirteen/FightCalender`).
2. **Neon-Datenbank verbinden:** Vercel → Storage → Neon-Integration → DB
   anlegen/verknüpfen. Dadurch wird `DATABASE_URL` automatisch gesetzt.
3. Weitere **Environment Variables** setzen:
   - `JWT_SECRET` = langer Zufallsstring
   - `ADMIN_PASSWORD` = dein Admin-Passwort
4. **Deploy** starten → du bekommst eine URL, z. B.
   `https://fight-calender.vercel.app` → **URL notieren!**
5. **Datenbank-Tabellen anlegen** (einmalig, legt alle Tabellen an):
   ```
   ! curl -X POST https://DEINE-APP.vercel.app/api/setup
   ```
   *(optional Beispieldaten:)* `curl -X POST https://DEINE-APP.vercel.app/api/seed`
6. URL im Browser öffnen und kurz testen (Login/Registrierung).

✅ **Phase 2 fertig, wenn die Web-App im Browser unter der Vercel-URL läuft.**

---

## Phase 3 – iOS-App bauen & starten

1. 🤖 **Abhängigkeiten installieren:**
   ```
   npm install
   ```
2. 🧑 In **`capacitor.config.ts`** den Platzhalter
   `https://DEINE-APP.vercel.app` durch deine **echte Vercel-URL** ersetzen.
3. 🤖 **Xcode-Projekt erzeugen** (einmalig):
   ```
   npx cap add ios
   ```
4. 🤖 **Synchronisieren:**
   ```
   npm run cap:sync
   ```
5. 🧑 **(Optional) App-Icon:** `resources/icon.png` (1024×1024) ablegen, dann
   `npm run ios:icons` (siehe `resources/README.md`).
6. 🤖 **Xcode öffnen:**
   ```
   npm run cap:open
   ```
7. 🧑 **In Xcode:**
   - Projekt **App** → **Signing & Capabilities** → **Team** = deine Apple-ID.
   - Oben das Zielgerät wählen (Simulator oder dein iPhone) → **▶ Run**.
   - Auf echtem iPhone: Einstellungen → Allgemein → VPN & Geräteverwaltung →
     Entwickler-Zertifikat **vertrauen**.

✅ **Phase 3 fertig, wenn die App im Simulator/auf dem iPhone startet und deine
Web-App zeigt.** 🎉

---

## Phase 4 – Später (optional)

- **Freunde testen lassen:** TestFlight (Apple Developer Account, 99 $/Jahr).
- **App Store:** evtl. native Mehrwerte ergänzen (z. B. **Push für
  Voting-Countdowns**), damit Apple nicht als „reine Website" ablehnt.
- **Live-Entwicklung gegen localhost:** siehe `IOS_SETUP.md`, Abschnitt
  „Entwicklung gegen den lokalen Server".

---

## Wenn du Claude neu startest

Sag einfach: **„Wir machen mit der iOS-App weiter, lies IOS_NEXT_STEPS.md"** –
dann sieht Claude diesen Stand und macht an der richtigen Stelle weiter.
