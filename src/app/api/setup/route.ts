import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Schema-Setup nur mit Admin-Passwort (verhindert anonyme Aufrufe).
    const pw = req.headers.get('x-admin-password') ?? (await req.json().catch(() => ({})))?.adminPassword;
    if (!process.env.ADMIN_PASSWORD || pw !== process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS classes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
        start_time VARCHAR(5) NOT NULL,
        end_time VARCHAR(5) NOT NULL,
        color VARCHAR(20) DEFAULT 'red',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS attendance (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        week_start DATE NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(class_id, week_start, user_name)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS skipping (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        excuse TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(date, user_name)
      )
    `;
    await sql`ALTER TABLE skipping ADD COLUMN IF NOT EXISTS excuse TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE skipping ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`
      CREATE TABLE IF NOT EXISTS competitions (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        name VARCHAR(200) NOT NULL,
        competition_date DATE NOT NULL,
        location VARCHAR(200) NOT NULL DEFAULT '',
        weight_class VARCHAR(100) NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_status (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        status_type VARCHAR(20) NOT NULL CHECK (status_type IN ('sick', 'injured', 'vacation')),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS user_schedule (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        UNIQUE(user_name, class_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS excuse_votes (
        id SERIAL PRIMARY KEY,
        skip_id INTEGER NOT NULL REFERENCES skipping(id) ON DELETE CASCADE,
        voter_name VARCHAR(100) NOT NULL,
        vote VARCHAR(10) NOT NULL CHECK (vote IN ('accept', 'reject')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(skip_id, voter_name)
      )
    `;
    // Push-Abos: ein Eintrag pro Gerät (endpoint ist eindeutig); ein Nutzer kann mehrere Geräte haben.
    await sql`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    // Protokoll bereits verschickter Benachrichtigungen — verhindert Doppel-Versand
    // bei mehrfachem Cron-Aufruf (UNIQUE über Kurs + Datum + Art).
    await sql`
      CREATE TABLE IF NOT EXISTS notification_log (
        id SERIAL PRIMARY KEY,
        class_id INTEGER NOT NULL,
        notify_date DATE NOT NULL,
        kind VARCHAR(40) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(class_id, notify_date, kind)
      )
    `;
    // Profil-Felder (Phase 4) — additiv, bestehende Daten bleiben erhalten.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS color VARCHAR(20)`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS martial_arts JSONB NOT NULL DEFAULT '[]'::jsonb`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(10) NOT NULL DEFAULT 'public'`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility_group INTEGER`;
    // Benachrichtigungs-Einstellungen pro Nutzer
    await sql`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_name VARCHAR(100) PRIMARY KEY,
        class_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        court_open BOOLEAN NOT NULL DEFAULT TRUE,
        court_result BOOLEAN NOT NULL DEFAULT TRUE
      )
    `;
    await sql`ALTER TABLE notification_prefs ADD COLUMN IF NOT EXISTS bitch_reminders BOOLEAN NOT NULL DEFAULT TRUE`;
    // Dedup für personalisierte (pro-Nutzer) Erinnerungen — einmal pro Tag/Art.
    await sql`
      CREATE TABLE IF NOT EXISTS user_notif_log (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        notify_date DATE NOT NULL,
        kind VARCHAR(60) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_name, notify_date, kind)
      )
    `;
    // --- Multi-Gruppen (Phase 1): Schema ---
    await sql`
      CREATE TABLE IF NOT EXISTS groups (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        invite_code VARCHAR(12) NOT NULL UNIQUE,
        created_by VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS group_members (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
        user_name VARCHAR(100) NOT NULL,
        role VARCHAR(10) NOT NULL DEFAULT 'member',     -- 'admin' | 'member'
        status VARCHAR(10) NOT NULL DEFAULT 'active',   -- 'active' | 'pending'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(group_id, user_name)
      )
    `;
    await sql`ALTER TABLE classes ADD COLUMN IF NOT EXISTS group_id INTEGER`;
    await sql`ALTER TABLE skipping ADD COLUMN IF NOT EXISTS group_id INTEGER`;
    await sql`ALTER TABLE competitions ADD COLUMN IF NOT EXISTS group_id INTEGER`;

    // --- Einmalige, GESCHÜTZTE Migration: bestehende Daten → Standard-Gruppe „NFT Köln" ---
    // Läuft nur, solange es ≤ 1 Gruppe gibt → kann nie Daten anderer Gruppen überschreiben.
    await sql`
      INSERT INTO groups (name, invite_code, created_by)
      SELECT 'NFT Köln', 'NFTKOELN', (SELECT user_name FROM users ORDER BY created_at LIMIT 1)
      WHERE NOT EXISTS (SELECT 1 FROM groups)
    `;
    await sql`UPDATE classes SET group_id = (SELECT MIN(id) FROM groups) WHERE group_id IS NULL AND (SELECT COUNT(*) FROM groups) = 1`;
    await sql`UPDATE skipping SET group_id = (SELECT MIN(id) FROM groups) WHERE group_id IS NULL AND (SELECT COUNT(*) FROM groups) = 1`;
    await sql`UPDATE competitions SET group_id = (SELECT MIN(id) FROM groups) WHERE group_id IS NULL AND (SELECT COUNT(*) FROM groups) = 1`;
    await sql`
      INSERT INTO group_members (group_id, user_name, role, status)
      SELECT (SELECT MIN(id) FROM groups), u.user_name, 'member', 'active'
      FROM users u WHERE (SELECT COUNT(*) FROM groups) = 1
      ON CONFLICT (group_id, user_name) DO NOTHING
    `;
    await sql`
      UPDATE group_members SET role = 'admin'
      WHERE group_id = (SELECT MIN(id) FROM groups)
        AND user_name = (SELECT user_name FROM users ORDER BY created_at LIMIT 1)
        AND (SELECT COUNT(*) FROM groups) = 1
    `;
    // --- „des Monats"-Titel + Gleichstand-Voting (gruppenbasiert) ---
    // monthly_titles: nur bei GLEICHSTAND angelegt (friert Kandidaten ein, hält
    // Voting-Status + späteren Sieger). Eindeutige Sieger werden nicht gespeichert
    // (jederzeit neu berechenbar).
    await sql`
      CREATE TABLE IF NOT EXISTS monthly_titles (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        month VARCHAR(7) NOT NULL,            -- 'YYYY-MM' (der ausgewertete Monat)
        kind VARCHAR(10) NOT NULL,            -- 'macher' | 'bitch'
        candidates JSONB NOT NULL DEFAULT '[]'::jsonb,
        winner VARCHAR(100),                  -- NULL solange Voting läuft
        status VARCHAR(10) NOT NULL DEFAULT 'voting', -- 'voting' | 'final'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(group_id, month, kind)
      )
    `;
    // title_votes: eine Stimme pro Nutzer je Gleichstand.
    await sql`
      CREATE TABLE IF NOT EXISTS title_votes (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        month VARCHAR(7) NOT NULL,
        kind VARCHAR(10) NOT NULL,
        voter_name VARCHAR(100) NOT NULL,
        choice VARCHAR(100) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(group_id, month, kind, voter_name)
      )
    `;
    // title_awards_seen: merkt, wer welches Verleihungs-Popup schon gesehen hat
    // (Popup erscheint genau einmal, geräteübergreifend).
    await sql`
      CREATE TABLE IF NOT EXISTS title_awards_seen (
        id SERIAL PRIMARY KEY,
        group_id INTEGER NOT NULL,
        user_name VARCHAR(100) NOT NULL,
        award_month VARCHAR(7) NOT NULL,
        kind VARCHAR(10) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(group_id, user_name, award_month, kind)
      )
    `;

    // --- Profil-Kommentare ---
    await sql`
      CREATE TABLE IF NOT EXISTS profile_comments (
        id SERIAL PRIMARY KEY,
        profile_name VARCHAR(100) NOT NULL,   -- wessen Profil
        author_name VARCHAR(100) NOT NULL,    -- wer kommentiert
        body TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    // --- Skilltree-Anfechtungen (Vorschlag → Übernehmen/Ablehnen) ---
    await sql`
      CREATE TABLE IF NOT EXISTS skill_challenges (
        id SERIAL PRIMARY KEY,
        profile_name VARCHAR(100) NOT NULL,      -- wessen Skilltree
        challenger_name VARCHAR(100) NOT NULL,   -- wer anficht
        proposal JSONB NOT NULL DEFAULT '{}'::jsonb, -- { skillKey: level(0–5) } nur geänderte
        note TEXT NOT NULL DEFAULT '',
        status VARCHAR(10) NOT NULL DEFAULT 'open',   -- 'open' | 'accepted' | 'rejected'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE
      )
    `;
    // --- In-App-Benachrichtigungen ---
    await sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,     -- Empfänger
        type VARCHAR(20) NOT NULL,           -- 'comment' | 'challenge' | 'challenge_result' | 'praise'
        actor VARCHAR(100) NOT NULL,         -- Auslöser
        body TEXT NOT NULL,
        link TEXT NOT NULL DEFAULT '',
        ref_id INTEGER,                      -- z. B. praise.id für Ausstellen-Aktionen
        read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id INTEGER`;
    await sql`CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_name, read)`;

    // --- Lob / Gigalob (Kudos) ---
    // UNIQUE(from_user, kind, period) erzwingt: 1 Lob pro Woche, 1 Gigalob pro Monat je Geber.
    // period = Wochenstart-Datum (Lob) bzw. 'YYYY-MM' (Gigalob).
    await sql`
      CREATE TABLE IF NOT EXISTS praises (
        id SERIAL PRIMARY KEY,
        kind VARCHAR(10) NOT NULL,            -- 'lob' | 'gigalob'
        from_user VARCHAR(100) NOT NULL,
        to_user VARCHAR(100) NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        period VARCHAR(10) NOT NULL,
        displayed BOOLEAN NOT NULL DEFAULT FALSE,    -- vom Empfänger fürs Profil freigegeben
        show_comment BOOLEAN NOT NULL DEFAULT FALSE, -- mit Begründung anzeigen
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(from_user, kind, period)
      )
    `;

    // --- Streaks & Badges ---
    // streak_points: „Joker", um einen Skip einzulegen ohne die Streak zu brechen
    // (jeder startet mit 3). displayed_badges: bis zu 4 am Profil ausgestellte Abzeichen.
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS streak_points INTEGER NOT NULL DEFAULT 3`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS displayed_badges JSONB NOT NULL DEFAULT '[]'::jsonb`;
    // longest_streak: persistierter Rekord (bleibt, auch wenn die aktuelle Streak reißt).
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0`;
    // streak_point_log: Vergabe-Ledger → verhindert Doppel-Vergabe (perfekte Woche, Streak-Badge,
    // Gigalob, Werbung). Kontostand bleibt users.streak_points.
    await sql`
      CREATE TABLE IF NOT EXISTS streak_point_log (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        kind VARCHAR(20) NOT NULL,   -- 'perfect_week' | 'streak_badge' | 'gigalob' | 'ad'
        ref VARCHAR(40) NOT NULL,    -- Wochenstart / badge_id / praise_id
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_name, kind, ref)
      )
    `;
    // streak_protected: dieser Skip wurde mit einem Streak-Punkt geschützt → bricht die Streak nicht
    // (zählt aber weiterhin als Bitch-Punkt).
    await sql`ALTER TABLE skipping ADD COLUMN IF NOT EXISTS streak_protected BOOLEAN NOT NULL DEFAULT FALSE`;
    // badges_awarded: merkt verliehene Abzeichen (für die einmalige „freigeschaltet"-Benachrichtigung).
    await sql`
      CREATE TABLE IF NOT EXISTS badges_awarded (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        badge_id VARCHAR(40) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_name, badge_id)
      )
    `;

    // --- Monats-Wrapped: merkt, wer den Rückblick eines Monats schon gesehen hat ---
    await sql`
      CREATE TABLE IF NOT EXISTS wrapped_seen (
        id SERIAL PRIMARY KEY,
        user_name VARCHAR(100) NOT NULL,
        month VARCHAR(7) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_name, month)
      )
    `;

    // --- Indizes auf häufig gefilterte Spalten (Performance) ---
    await sql`CREATE INDEX IF NOT EXISTS attendance_user_idx ON attendance (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS attendance_week_idx ON attendance (week_start)`;
    await sql`CREATE INDEX IF NOT EXISTS attendance_class_idx ON attendance (class_id)`;
    await sql`CREATE INDEX IF NOT EXISTS skipping_user_idx ON skipping (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS skipping_date_idx ON skipping (date)`;
    await sql`CREATE INDEX IF NOT EXISTS skipping_group_idx ON skipping (group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS excuse_votes_skip_idx ON excuse_votes (skip_id)`;
    await sql`CREATE INDEX IF NOT EXISTS excuse_votes_voter_idx ON excuse_votes (voter_name)`;
    await sql`CREATE INDEX IF NOT EXISTS competitions_user_idx ON competitions (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS classes_group_idx ON classes (group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_schedule_user_idx ON user_schedule (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS group_members_user_idx ON group_members (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS group_members_group_idx ON group_members (group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS user_status_user_idx ON user_status (user_name)`;
    await sql`CREATE INDEX IF NOT EXISTS praises_to_idx ON praises (to_user)`;
    await sql`CREATE INDEX IF NOT EXISTS profile_comments_profile_idx ON profile_comments (profile_name)`;

    return NextResponse.json({ ok: true, message: 'Tables created successfully' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
