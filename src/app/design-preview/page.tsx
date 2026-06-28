/* Design-Vorschau: Mix aus Fight-Night (rotes Action-Rot) × Dark-Fantasy
   (Navy-Schwarz, Gold-Headings in New Rocker, blaues Glühen, kantige Kanten, Glint).
   Voll gescoped unter .mix — verändert NICHTS am Rest der App. Route: /design-preview */

const CSS = `
.mix {
  --gold:#F8B700; --blue:#024FCB; --blue-l:#3A88E8; --blue-glow:rgba(2,79,203,.35);
  --red:#ff3b30; --surface:#0e1626; --surface2:#16223c; --panel:#0a0e18;
  --body:#94A3B8; --bodysub:#64748B; --border:#1a3060;
  min-height:100vh; color:var(--body);
  font-family:var(--font-body),system-ui,sans-serif;
  background:
    radial-gradient(1100px 560px at 50% -8%, rgba(2,79,203,.14), transparent 60%),
    radial-gradient(900px 700px at 50% 120%, rgba(248,183,0,.05), transparent 60%),
    linear-gradient(180deg,#060a10 0%,#080c14 50%,#060a10 100%);
  background-attachment: fixed;
}
.mix .head { font-family:var(--font-medieval),serif; color:var(--gold); text-transform:uppercase; letter-spacing:.04em; font-weight:400; line-height:1.05; text-shadow:0 2px 10px rgba(0,0,0,.6); }
.mix .label { font-size:11px; text-transform:uppercase; letter-spacing:.2em; color:var(--bodysub); font-weight:600; }
.mix-card { position:relative; background:linear-gradient(180deg,var(--surface),var(--panel)); border:2px solid rgba(2,79,203,.28); border-radius:4px; box-shadow:0 4px 6px -1px rgba(0,0,0,.45), 0 0 15px rgba(2,79,203,.08); }
.mix-card::before { content:''; position:absolute; inset:3px; border:1px solid rgba(2,79,203,.15); border-radius:3px; pointer-events:none; }
.mix-card.int { transition:border-color .15s, box-shadow .15s, transform .12s; cursor:pointer; }
.mix-card.int:hover { border-color:rgba(2,79,203,.6); box-shadow:0 10px 15px -3px rgba(0,0,0,.5), 0 0 26px var(--blue-glow); }
.mix-card.int:active { transform:scale(.99); }
.mix-btn { display:inline-flex; align-items:center; justify-content:center; gap:.5rem; font-family:var(--font-medieval),serif; text-transform:uppercase; letter-spacing:.1em; font-weight:400; font-size:15px; border-radius:4px; padding:.62rem 1.1rem; border:2px solid; transition:filter .12s, transform .08s; cursor:pointer; }
.mix-btn:active { transform:scale(.98); }
.mix-btn-brand { background:linear-gradient(180deg,#0d3f93,#062a66); border-color:var(--blue-l); color:var(--gold); text-shadow:0 1px 3px rgba(0,0,0,.9); box-shadow:0 1px 2px rgba(0,0,0,.25), inset rgba(184,216,248,.14) 0 1px 0, rgba(2,79,203,.7) 0 4px 12px -5px; }
.mix-btn-brand:hover { filter:brightness(1.22); }
.mix-btn-action { background:linear-gradient(180deg,#ff5247,#d6271d); border-color:#ff8079; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.6); box-shadow:0 1px 2px rgba(0,0,0,.25), inset rgba(255,255,255,.2) 0 1px 0, rgba(255,59,48,.5) 0 4px 12px -5px; }
.mix-btn-action:hover { filter:brightness(1.12); }
.mix-btn-ghost { background:transparent; border-color:transparent; color:var(--gold); }
.mix-btn-ghost:hover { background:rgba(255,255,255,.06); }
.mix-chip { display:inline-flex; align-items:center; gap:.35rem; font-size:.72rem; font-weight:700; padding:.22rem .6rem; border:2px solid; border-radius:9999px; }
.mix-input { width:100%; background:#0e1a2e; border:2px solid #1a3060; border-radius:4px; padding:.6rem .85rem; color:var(--body); font-size:14px; }
.mix-input::placeholder { color:var(--bodysub); }
.mix-input:focus { outline:none; border-color:var(--blue-l); box-shadow:0 0 0 2px rgba(2,79,203,.4); }
.mix-swatch { height:54px; border-radius:4px; border:1px solid rgba(255,255,255,.08); display:flex; align-items:flex-end; padding:6px; font-size:10px; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,.8); }
`;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="head text-2xl mb-4">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPreview() {
  return (
    <div className="mix">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <main style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 80px' }}>
        {/* Hero */}
        <header style={{ textAlign: 'center', paddingTop: 40 }}>
          <div className="label" style={{ color: 'var(--blue-l)' }}>Design-Mix · Vorschau</div>
          <h1 className="head" style={{ fontSize: 44, marginTop: 8 }}>Fight Calendar</h1>
          <p style={{ marginTop: 10, fontSize: 15 }}>Fight-Night × Dark-Fantasy — Gold-Headings, blaues Glühen, kantige Kanten, rotes Action-Rot.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 18 }}>
            <button className="mix-btn mix-btn-brand">Loslegen</button>
            <button className="mix-btn mix-btn-ghost">Mehr</button>
          </div>
        </header>

        {/* Farben */}
        <Section title="Farben">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            <div className="mix-swatch" style={{ background: '#060a10' }}>Navy-Schwarz</div>
            <div className="mix-swatch" style={{ background: 'linear-gradient(180deg,#16223c,#0a0e18)' }}>Surface</div>
            <div className="mix-swatch" style={{ background: '#F8B700', color: '#1a1a1a' }}>Gold</div>
            <div className="mix-swatch" style={{ background: '#024FCB' }}>Brand-Blau</div>
            <div className="mix-swatch" style={{ background: '#3A88E8', color: '#06101f' }}>Blau-Glow</div>
            <div className="mix-swatch" style={{ background: '#ff3b30' }}>Action-Rot</div>
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button className="mix-btn mix-btn-brand">Brand · Glint</button>
            <button className="mix-btn mix-btn-action">Action</button>
            <button className="mix-btn mix-btn-ghost">Ghost</button>
          </div>
          <p className="label" style={{ marginTop: 10 }}>Blau-Gradient + Gold-Text + Glint (Inset-Highlight + Glow), kantige 4 px-Ecken.</p>
        </Section>

        {/* Karten */}
        <Section title="Karten">
          <div className="mix-card int" style={{ padding: 18, marginBottom: 12 }}>
            <h3 className="head text-xl">Statistiken</h3>
            <p style={{ fontSize: 13, marginTop: 6 }}>Macher · Bitch · Jahr — tippen für Details (Hover = blaues Glühen).</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
            {[['Macher d.M.', '3', 'var(--gold)'], ['Bitch d.M.', '1', '#f5c518'], ['Tage weg', '0', '#1ec7da']].map(([l, v, c]) => (
              <div key={l} className="mix-card" style={{ padding: '14px 6px', textAlign: 'center' }}>
                <div className="head" style={{ fontSize: 28, color: c }}>{v}</div>
                <div className="label" style={{ marginTop: 4 }}>{l}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span className="mix-chip" style={{ borderColor: 'var(--gold)', color: 'var(--gold)', background: 'rgba(248,183,0,.1)' }}>🏆 Macher</span>
            <span className="mix-chip" style={{ borderColor: 'var(--blue-l)', color: '#B8D8F8', background: 'rgba(2,79,203,.18)' }}>⚡ Real Threat</span>
            <span className="mix-chip" style={{ borderColor: 'var(--red)', color: '#ff8079', background: 'rgba(255,59,48,.12)' }}>💥 K.-o.-Sieger</span>
            <span className="mix-chip" style={{ borderColor: 'var(--border)', color: 'var(--body)', background: 'var(--surface2)' }}>🔥 12 Tage</span>
          </div>
        </Section>

        {/* Profil + Belt */}
        <Section title="Profil-Header">
          <div className="mix-card" style={{ padding: 20, textAlign: 'center' }}>
            <div style={{ width: 92, height: 92, borderRadius: 9999, margin: '0 auto 10px', border: '2px solid var(--blue-l)', boxShadow: '0 0 30px var(--blue-glow)', background: 'radial-gradient(circle,#16223c,#0a0e18)', display: 'grid', placeItems: 'center' }}>
              <span className="head" style={{ fontSize: 34, color: 'var(--gold)' }}>D</span>
            </div>
            <div className="head" style={{ fontSize: 30 }}>Dani</div>
            <div style={{ marginTop: 6 }}>
              <span className="mix-chip" style={{ borderColor: 'var(--red)', color: '#ff8079', background: 'rgba(255,59,48,.12)' }}>🔥 12 Tage</span>
            </div>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1400 / 319', containerType: 'inline-size', marginTop: 14 }}>
              <img src="/belt.png" alt="Belt" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              <div style={{ position: 'absolute', left: '49.8%', top: '53%', transform: 'translate(-50%,-50%)' }}>
                <span className="head" style={{ color: '#1a1a1a', fontSize: '6.5cqw', WebkitTextStroke: '0' }}>NFT</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button className="mix-btn mix-btn-action" style={{ flex: 1 }}>Lob geben</button>
              <button className="mix-btn mix-btn-brand" style={{ flex: 1 }}>Gigalob</button>
            </div>
          </div>
        </Section>

        {/* Leaderboard */}
        <Section title="Rangliste">
          <div className="mix-card" style={{ overflow: 'hidden' }}>
            {[['1', 'Angelo', '14', 'var(--gold)'], ['2', 'Tim', '11', '#c9ccd3'], ['3', 'Max', '9', '#cd7f32']].map(([r, n, c, col], i) => (
              <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ width: 26, height: 26, display: 'grid', placeItems: 'center', borderRadius: 9999, border: `1px solid ${col}`, color: col, fontSize: 12, fontWeight: 700 }}>{r}</span>
                  <span style={{ fontWeight: 600, color: '#e8edf5' }}>{n}</span>
                </div>
                <span className="head" style={{ fontSize: 18, color: col }}>{c}×</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Eingabe + Alert */}
        <Section title="Eingabe & Hinweis">
          <input className="mix-input" placeholder="Deine Ausrede…" />
          <div className="mix-card" style={{ padding: 14, marginTop: 12, borderColor: 'rgba(2,79,203,.4)' }}>
            <div style={{ color: '#B8D8F8', fontWeight: 600, fontSize: 14 }}>Voting läuft</div>
            <p style={{ fontSize: 13, marginTop: 4 }}>Richte die Ausreden — Ergebnis wird am 1. festgeschrieben.</p>
          </div>
        </Section>

        <div style={{ textAlign: 'center', marginTop: 36 }}>
          <a href="/start" className="mix-btn mix-btn-ghost" style={{ textDecoration: 'none' }}>← Zurück zur App</a>
        </div>
      </main>
    </div>
  );
}
