# Push-Benachrichtigungen – Einrichtung

Erinnerung **~2 Std vor Kursbeginn** an alle, die zugesagt haben („Auch dabei: …"
oder „Heute bist du allein am Start"). Kostenlos, ohne Apple Developer Account –
funktioniert über die zum Home-Bildschirm hinzugefügte Web-App (PWA).

> **Geheimnisse:** Die echten Schlüsselwerte stehen in deiner lokalen
> `.env.local` (nicht im Repo). Diese drei Variablen brauchst du unten.

**Legende:** 🧑 = du · 🤖 = kann Claude im Terminal

---

## 1. Code deployen 🧑/🤖
Den neuen Code zu GitHub pushen → Vercel deployt automatisch.

## 2. Environment Variables in Vercel setzen 🧑
Vercel → Projekt → **Settings → Environment Variables** → diese drei anlegen
(Werte aus `.env.local` kopieren), dann **Redeploy**:

| Variable | geheim? |
|----------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | nein (geht an den Browser) |
| `VAPID_PRIVATE_KEY` | **ja** |
| `CRON_SECRET` | **ja** |

## 3. Neue DB-Tabellen anlegen 🤖
Nach dem Deploy einmalig (idempotent, legt `push_subscriptions` + `notification_log` an):
```
curl -X POST https://fight-calender.vercel.app/api/setup
```

## 4. Wecker: GitHub Action 🧑 (ein Secret hinzufügen)
Vercels Gratis-Plan löst Cronjobs nur 1×/Tag aus – zu grob. Stattdessen pingt
eine **GitHub Action** (`.github/workflows/notify.yml`, schon im Repo) alle
15 Min `/api/notify` an. Du musst nur das Secret hinterlegen:

1. GitHub → Repo `Dambthirteen/FightCalender` → **Settings** → **Secrets and
   variables** → **Actions** → **New repository secret**.
2. **Name:** `CRON_SECRET` · **Secret:** Wert aus `.env.local` → **Add secret**.
3. Tab **Actions** → ggf. Workflows aktivieren → bei „Kurs-Erinnerungen" einmal
   **Run workflow** (manuell testen). Grüner Haken = läuft.

> Ohne korrekten `Authorization`-Header antwortet der Endpoint mit `401` – so ist
> er gegen Fremdaufrufe geschützt. Die Action schickt den Header automatisch aus
> dem Secret.
>
> **Alternative (pünktlicher):** [cron-job.org](https://cron-job.org) – Job auf
> `https://fight-calender.vercel.app/api/notify`, alle 15 Min, Header
> `Authorization: Bearer <CRON_SECRET>`. GitHub-Actions-Läufe können sich um ein
> paar Minuten verspäten; wegen des 1–2-Std-Fensters ist das aber unkritisch.

## 5. Am iPhone aktivieren 🧑
1. In **Safari** `https://fight-calender.vercel.app` öffnen → Teilen ⎋ →
   **„Zum Home-Bildschirm"**.
2. App über das **neue Icon** öffnen (wichtig – Push geht nur in der installierten PWA).
3. **„👤 Mein Status"** → **🔔 Benachrichtigungen** → **aktivieren** → erlauben.
4. **„Test senden"** → die Test-Benachrichtigung sollte erscheinen. ✅

---

## Wie es funktioniert (technisch)
- `/api/notify` (Node-Runtime, per `CRON_SECRET` geschützt) wird alle 15 Min aufgerufen.
- Es rechnet in **Europe/Berlin**, ermittelt Kurse, die in 1–2 Std starten, und an
  Feiertagen (NRW) nichts.
- Empfänger = wer in der Wochen-Anwesenheit zugesagt hat **und** für heute nicht
  abgesagt/krank/Urlaub ist **und** ein Push-Abo besitzt.
- `notification_log` (UNIQUE Kurs+Datum+Art) verhindert Doppelversand bei mehreren Läufen.
- Abos liegen in `push_subscriptions`; tote Abos (404/410) werden automatisch gelöscht.

## Fehlersuche
- **Test kommt nicht an (iPhone):** App wirklich über das Home-Bildschirm-Icon
  geöffnet? In Safari-Tab funktioniert Push nicht. iOS ≥ 16.4 nötig.
- **`/api/notify` gibt 401:** `Authorization`-Header / `CRON_SECRET` stimmt nicht.
- **`VAPID-Schlüssel fehlen` (500):** Env-Variablen in Vercel fehlen oder kein Redeploy.
- **Niemand bekommt was:** Hat jemand für diese Woche zugesagt? Liegt der Lauf im
  Fenster 1–2 Std vor Kursbeginn? Feiertag?
</content>
