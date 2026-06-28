/* Design-Vorschau v2 — zusammenhängender Startseiten-Screen statt Kästchen-Katalog.
   Flach & modern (kein Win7-Glanz), heller Text, weiche Übergänge, mehr Flow.
   Voll gescoped unter .mix — verändert NICHTS am Rest der App. Route: /design-preview */

const CSS = `
.mix {
  --text:#eef2f8; --body:#b6c2d6; --sub:#8493ab;
  --gold:#FFC53D; --gold-soft:#ffd977;
  --blue:#3b82f6; --blue-2:#5b9bff; --red:#ff4d45; --teal:#2dd4bf;
  --line:rgba(255,255,255,.07); --line-2:rgba(255,255,255,.12);
  min-height:100vh; color:var(--body);
  font-family:var(--font-body),system-ui,sans-serif;
  -webkit-font-smoothing:antialiased;
  background:
    radial-gradient(1000px 520px at 50% -12%, rgba(59,130,246,.13), transparent 62%),
    radial-gradient(700px 500px at 90% 30%, rgba(255,197,61,.05), transparent 60%),
    linear-gradient(180deg,#0b0f1a 0%,#090c14 60%,#070a11 100%);
  background-attachment:fixed;
}
.mix .display { font-family:var(--font-medieval),serif; color:var(--gold); font-weight:400; letter-spacing:.02em; line-height:1; }
.mix .h { font-family:var(--font-body),sans-serif; color:var(--text); font-weight:700; letter-spacing:-.01em; }
.mix .eyebrow { font-size:11px; text-transform:uppercase; letter-spacing:.18em; color:var(--sub); font-weight:600; }
.mix .num { font-family:var(--font-medieval),serif; font-weight:400; line-height:1; }

/* weiche Fläche statt harter Rahmen */
.mix-soft { background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.012)); border:1px solid var(--line); border-radius:18px; box-shadow:0 12px 30px -18px rgba(0,0,0,.8); }
.mix-tile { border-radius:18px; padding:18px; transition:transform .15s, box-shadow .2s, border-color .2s; cursor:pointer; }
.mix-tile:hover { transform:translateY(-2px); border-color:var(--line-2); box-shadow:0 18px 40px -20px rgba(0,0,0,.9), 0 0 0 1px rgba(91,155,255,.12); }
.mix-tile:active { transform:translateY(0); }

/* flache, moderne Buttons — kein Glanz, kein Inset-Highlight */
.mix-btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; font-family:var(--font-body); font-weight:600; font-size:15px; border-radius:13px; padding:.78rem 1.2rem; border:1px solid transparent; transition:background .15s, box-shadow .2s, transform .08s; cursor:pointer; }
.mix-btn:active { transform:scale(.985); }
.mix-btn-primary { background:var(--blue); color:#fff; }
.mix-btn-primary:hover { background:#4f8ef8; box-shadow:0 10px 26px -10px rgba(59,130,246,.85); }
.mix-btn-gold { background:var(--gold); color:#241803; font-weight:700; }
.mix-btn-gold:hover { background:var(--gold-soft); box-shadow:0 10px 26px -10px rgba(255,197,61,.6); }
.mix-btn-action { background:var(--red); color:#fff; }
.mix-btn-action:hover { background:#ff635b; box-shadow:0 10px 26px -10px rgba(255,77,69,.7); }
.mix-btn-ghost { background:rgba(255,255,255,.05); color:var(--text); border-color:var(--line-2); }
.mix-btn-ghost:hover { background:rgba(255,255,255,.09); }

.mix-icon { width:42px; height:42px; display:grid; place-items:center; border-radius:13px; background:rgba(255,255,255,.05); border:1px solid var(--line); color:var(--body); font-size:18px; transition:background .15s, color .15s; }
.mix-icon:hover { background:rgba(255,255,255,.1); color:var(--text); }
.mix-pill { display:inline-flex; align-items:center; gap:.35rem; font-size:.74rem; font-weight:700; padding:.28rem .65rem; border-radius:9999px; }
.mix-input { width:100%; background:rgba(255,255,255,.04); border:1px solid var(--line-2); border-radius:13px; padding:.8rem 1rem; color:var(--text); font-size:15px; }
.mix-input::placeholder { color:var(--sub); }
.mix-input:focus { outline:none; border-color:var(--blue-2); box-shadow:0 0 0 3px rgba(59,130,246,.22); }
`;

export default function DesignPreview() {
  return (
    <div className="mix">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main style={{ maxWidth: 460, margin: '0 auto', padding: '0 18px 90px' }}>

        {/* Topbar */}
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 34 }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--blue-2)' }}>Mittwoch · 28. Juni</div>
            <div className="display" style={{ fontSize: 30, marginTop: 6 }}>Fight Calendar</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="mix-icon" style={{ position: 'relative' }}>
              🔔
              <span style={{ position: 'absolute', top: -3, right: -3, width: 18, height: 18, borderRadius: 9999, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 800, display: 'grid', placeItems: 'center', border: '2px solid #0b0f1a' }}>3</span>
            </div>
            <div className="mix-icon">⚙</div>
          </div>
        </header>

        {/* Streak-Hero — fließend, kein harter Kasten */}
        <section style={{ marginTop: 22 }}>
          <div className="eyebrow">Deine Streak</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
            <span style={{ fontSize: 40, lineHeight: 1 }}>🔥</span>
            <span className="num" style={{ fontSize: 64, color: 'var(--gold)' }}>12</span>
            <span className="h" style={{ fontSize: 22, color: 'var(--text)' }}>Tage</span>
          </div>
          <div style={{ marginTop: 10, color: 'var(--body)', fontSize: 14 }}>
            2 Wochen am Stück · noch <span style={{ color: 'var(--text)', fontWeight: 700 }}>1 Woche</span> bis „Soldier"
          </div>
          <div style={{ marginTop: 12, height: 8, borderRadius: 9999, background: 'rgba(255,255,255,.07)', overflow: 'hidden' }}>
            <div style={{ width: '66%', height: '100%', borderRadius: 9999, background: 'linear-gradient(90deg, var(--gold), var(--red))' }} />
          </div>
        </section>

        {/* Stats — eine Fläche, dünne Trenner statt drei Kästchen */}
        <section className="mix-soft" style={{ marginTop: 24, padding: '4px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
            {[['Macher', '3', 'var(--gold)'], ['Bitch', '1', 'var(--red)'], ['Wettkämpfe', '5', 'var(--teal)']].map(([l, v, c], i) => (
              <div key={l} style={{ textAlign: 'center', padding: '18px 6px', borderLeft: i ? '1px solid var(--line)' : 'none' }}>
                <div className="num" style={{ fontSize: 30, color: c }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 6 }}>{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Featured — zwei weiche Kacheln, kein harter Rahmen */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div className="mix-soft mix-tile" style={{ minHeight: 124, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 24 }}>🏆</span>
            <div>
              <div className="h" style={{ fontSize: 17 }}>Wettkämpfe</div>
              <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 3 }}>Nächster in 9 Tagen</div>
            </div>
          </div>
          <div className="mix-soft mix-tile" style={{ minHeight: 124, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 24 }}>📊</span>
            <div>
              <div className="h" style={{ fontSize: 17 }}>Statistiken</div>
              <div style={{ fontSize: 12, color: 'var(--body)', marginTop: 3 }}>Macher · Bitch · Jahr</div>
            </div>
          </div>
        </section>

        {/* Liste — Zeilen mit feinen Trennern, ein durchgehender Block */}
        <section className="mix-soft" style={{ marginTop: 14, overflow: 'hidden' }}>
          {[['🗳️', 'Ausreden-Gericht', '3 offen'], ['👥', 'Mitglieder', ''], ['🏥', 'Mein Status', '']].map(([ic, label, meta], i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
              <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{ic}</span>
              <span style={{ flex: 1, color: 'var(--text)', fontWeight: 600, fontSize: 15 }}>{label}</span>
              {meta && <span className="mix-pill" style={{ background: 'rgba(255,77,69,.14)', color: '#ff8e88' }}>{meta}</span>}
              <span style={{ color: 'var(--sub)' }}>›</span>
            </div>
          ))}
        </section>

        {/* Rangliste */}
        <section style={{ marginTop: 28 }}>
          <div className="display" style={{ fontSize: 20, marginBottom: 12 }}>Rangliste</div>
          <div className="mix-soft" style={{ overflow: 'hidden' }}>
            {[['1', 'Angelo', '14', 'var(--gold)'], ['2', 'Tim', '11', '#cdd3dd'], ['3', 'Max', '9', '#d08a4a']].map(([r, n, v, c], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: i < 2 ? '1px solid var(--line)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 9999, background: 'rgba(255,255,255,.05)', color: c, fontSize: 13, fontWeight: 800 }}>{r}</span>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>{n}</span>
                </div>
                <span className="num" style={{ fontSize: 18, color: c }}>{v}×</span>
              </div>
            ))}
          </div>
        </section>

        {/* Profil + Gürtel */}
        <section style={{ marginTop: 28 }}>
          <div className="display" style={{ fontSize: 20, marginBottom: 12 }}>Profil</div>
          <div className="mix-soft" style={{ padding: 22, textAlign: 'center' }}>
            <div style={{ width: 88, height: 88, borderRadius: 9999, margin: '0 auto 12px', background: 'radial-gradient(circle at 35% 30%, #24304a, #0e1626)', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 1px var(--line-2), 0 10px 30px -10px rgba(59,130,246,.5)' }}>
              <span className="display" style={{ fontSize: 34 }}>D</span>
            </div>
            <div className="h" style={{ fontSize: 22 }}>Dani</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              <span className="mix-pill" style={{ background: 'rgba(255,77,69,.14)', color: '#ff8e88' }}>🔥 12 Tage</span>
              <span className="mix-pill" style={{ background: 'rgba(255,197,61,.14)', color: 'var(--gold-soft)' }}>🏆 Macher</span>
            </div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1400 / 319', containerType: 'inline-size', marginTop: 18 }}>
              <img src="/belt.png" alt="Belt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{ position: 'absolute', left: '49.8%', top: '53%', transform: 'translate(-50%,-50%)' }}>
                <span className="display" style={{ color: '#1a1a1a', fontSize: '6.5cqw' }}>NFT</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button className="mix-btn mix-btn-action" style={{ flex: 1 }}>Lob geben</button>
              <button className="mix-btn mix-btn-gold" style={{ flex: 1 }}>Gigalob</button>
            </div>
          </div>
        </section>

        {/* Eingabe + Buttons */}
        <section style={{ marginTop: 28 }}>
          <div className="display" style={{ fontSize: 20, marginBottom: 12 }}>Eingabe</div>
          <input className="mix-input" placeholder="Deine Ausrede…" />
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="mix-btn mix-btn-primary" style={{ flex: 1 }}>Absenden</button>
            <button className="mix-btn mix-btn-ghost">Abbrechen</button>
          </div>
        </section>

        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <a href="/start" className="mix-btn mix-btn-ghost" style={{ textDecoration: 'none' }}>← Zurück zur App</a>
        </div>
      </main>
    </div>
  );
}
