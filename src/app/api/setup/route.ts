import { neon } from '@neondatabase/serverless';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
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
    // Benachrichtigungs-Einstellungen pro Nutzer
    await sql`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_name VARCHAR(100) PRIMARY KEY,
        class_reminders BOOLEAN NOT NULL DEFAULT TRUE,
        court_open BOOLEAN NOT NULL DEFAULT TRUE,
        court_result BOOLEAN NOT NULL DEFAULT TRUE
      )
    `;
    return NextResponse.json({ ok: true, message: 'Tables created successfully' });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
