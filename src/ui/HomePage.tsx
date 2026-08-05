import { useMemo, useState } from 'react';
import { getProductStats } from '../theme/productStats';
import { SCENE_CATEGORIES } from '../theme/scenePresets';
import './HomePage.css';

type Props = {
  onEnter: () => void;
  onOpenMidi: (file: File) => void;
};

export function HomePage({ onEnter, onOpenMidi }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stats = useMemo(() => getProductStats(), []);

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().match(/\.midi?$/)) {
      setError('Drop a .mid or .midi file');
      return;
    }
    setError(null);
    onOpenMidi(file);
  };

  const toolkit = [
    {
      title: 'Scene lookbooks',
      stat: String(stats.scenes),
      unit: 'full scenes',
      body: `${stats.sceneCategories} moods. One click swaps note style, particles, background, colors, and instrument.`,
      wide: true,
    },
    {
      title: 'Falling notes',
      stat: String(stats.noteStyles),
      unit: 'note styles',
      body: 'Solid, glass, gem, flame, crystal, outline, plasma, chrome, pixel. Borders, shine, and inner FX.',
      wide: false,
    },
    {
      title: 'Color systems',
      stat: String(stats.palettes),
      unit: 'palettes',
      body: `${stats.colorModes} modes: per-track, scatter, rainbow, spectrum, RGB chase. Recolor without desync.`,
      wide: false,
    },
    {
      title: 'Backgrounds',
      stat: String(stats.backgrounds),
      unit: 'styles',
      body: 'Nebula, aurora, starfield, pulse, grid, void, rain, radar, warp. Note energy drives motion.',
      wide: false,
    },
    {
      title: 'Particles',
      stat: String(stats.particles),
      unit: 'presets',
      body: 'Ember, neon, stardust, firework, plasma, aurora, rain, blizzard, soft, inferno, crystal.',
      wide: false,
    },
    {
      title: 'Music field',
      stat: String(stats.musicReactive),
      unit: 'modes',
      body: 'Ambient dust, rising columns, bass shockwaves, attack pops locked to pitch bands.',
      wide: false,
    },
    {
      title: 'Sound + export',
      stat: `${stats.instruments}+`,
      unit: 'instruments',
      body: `Tone synths, GM chip/FM, local SF2/SF3. Bake MP4 up to ${stats.exportMaxLabel} at 30/60 fps.`,
      wide: true,
    },
  ];

  return (
    <div className="home">
      <div className="home-bg" aria-hidden>
        <div className="home-orb home-orb-a" />
        <div className="home-orb home-orb-b" />
        <div className="home-vignette" />
      </div>

      <header className="home-nav">
        <div className="home-logo">
          <span className="home-logo-mark">L</span>
          <span className="home-logo-text">Lumenote</span>
        </div>
        <nav className="home-nav-links" aria-label="Page">
          <a href="#toolkit">Toolkit</a>
          <a href="#looks">Looks</a>
          <a href="#export">Export</a>
        </nav>
        <button type="button" className="btn home-nav-cta" onClick={onEnter}>
          Open studio
        </button>
      </header>

      <main className="home-main">
        {/* Layout family A: split hero */}
        <section className="home-hero">
          <div className="home-hero-copy">
            <p className="home-eyebrow">Free open-source MIDI visualizer</p>
            <h1 className="home-title">
              Piano videos that
              <br />
              actually move
            </h1>
            <p className="home-lead">
              Multi-track MIDI, styled falling notes, living particles, and smooth{' '}
              {stats.exportMaxLabel} bake export. No account. No watermark.
            </p>
            <div className="home-ctas">
              <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
                Launch studio
              </button>
              <label className="btn home-cta-secondary">
                Open MIDI
                <input
                  type="file"
                  accept=".mid,.midi,audio/midi"
                  hidden
                  onChange={(e) => {
                    takeFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div
              className={`home-drop ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                takeFile(e.dataTransfer.files?.[0]);
              }}
            >
              Drop a <strong>.mid</strong> to jump in
            </div>
            {error && <p className="home-error">{error}</p>}
          </div>

          <aside className="home-hero-panel" aria-label="At a glance">
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.scenes}</span>
              <span className="home-panel-label">scene presets</span>
            </div>
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.noteStyles}</span>
              <span className="home-panel-label">note styles</span>
            </div>
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.palettes}</span>
              <span className="home-panel-label">color palettes</span>
            </div>
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.backgrounds}</span>
              <span className="home-panel-label">background styles</span>
            </div>
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.particles}</span>
              <span className="home-panel-label">particle looks</span>
            </div>
            <div className="home-panel-row">
              <span className="home-panel-num">{stats.exportMaxLabel}</span>
              <span className="home-panel-label">bake export</span>
            </div>
            <div className="home-panel-row home-panel-row-last">
              <span className="home-panel-num">{stats.instruments}+</span>
              <span className="home-panel-label">instruments + SF2</span>
            </div>
          </aside>
        </section>

        {/* Layout family B: capability strip */}
        <section className="home-strip" aria-label="Capabilities">
          <p>
            Multi-track piano roll · Gem, flame, plasma note styles · Live MIDI · Party mode · Local
            files only
          </p>
        </section>

        {/* Layout family C: asymmetric toolkit bento */}
        <section id="toolkit" className="home-toolkit">
          <div className="home-section-head">
            <h2>Visual toolkit</h2>
            <p>
              Independent systems you mix, randomize, or lock into a saved scene. Counts stay
              tied to the real preset libraries.
            </p>
          </div>
          <div className="home-bento">
            {toolkit.map((item) => (
              <article
                key={item.title}
                className={`home-bento-cell ${item.wide ? 'is-wide' : ''}`}
              >
                <div className="home-bento-stat">
                  <span className="home-bento-num">{item.stat}</span>
                  <span className="home-bento-unit">{item.unit}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* Layout family D: mood list */}
        <section id="looks" className="home-looks">
          <div className="home-section-head">
            <h2>
              {stats.scenes} looks across {stats.sceneCategories} moods
            </h2>
            <p>
              Full snapshots: visuals, particles, colors, FX, and sound. Browse by category in
              the studio so the library never becomes a wall of chips.
            </p>
          </div>
          <ul className="home-mood-list">
            {SCENE_CATEGORIES.map((c) => (
              <li key={c.id}>
                <strong>{c.label}</strong>
                <span>{c.blurb}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Layout family E: two-up detail blocks */}
        <section id="export" className="home-detail">
          <article className="home-detail-block">
            <h2>Export that stays smooth</h2>
            <p>
              Offline bake steps every frame at exact fps for clean MP4s. 720p through{' '}
              {stats.exportMaxLabel}, 30 or 60 fps, optional audio. Realtime capture when you want
              a quick take.
            </p>
            <ul className="home-lines">
              <li>{stats.exportResolutions} resolutions through {stats.exportMaxLabel}</li>
              <li>Design-space scaling so composition stays consistent</li>
              <li>No watermark, downloads to your machine</li>
            </ul>
          </article>
          <article className="home-detail-block">
            <h2>Play it live</h2>
            <p>
              Web MIDI for controllers, rising live note bars, optional thru. Load SF2/SF3
              locally, or use the built-in synths. Fullscreen stage with an overlay studio panel.
            </p>
            <ul className="home-lines">
              <li>Hardware keys hit the same particle rail</li>
              <li>Custom soundfonts stay on your device</li>
              <li>Chrome or Edge recommended for bake and MIDI</li>
            </ul>
          </article>
        </section>

        {/* Layout family F: horizontal process + CTA */}
        <section id="how" className="home-how">
          <h2>Three steps</h2>
          <ol className="home-process">
            <li>
              <span className="home-process-k">Open</span>
              <span className="home-process-v">Multi-track MIDI for clean hand colors</span>
            </li>
            <li>
              <span className="home-process-k">Style</span>
              <span className="home-process-v">Scenes, colors, particles, Party mode</span>
            </li>
            <li>
              <span className="home-process-k">Export</span>
              <span className="home-process-v">Bake up to {stats.exportMaxLabel} or capture live</span>
            </li>
          </ol>
          <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
            Launch studio
          </button>
          <p className="home-how-note">MIT open source. Free forever. Runs fully local.</p>
        </section>
      </main>

      <footer className="home-foot">
        <span>Lumenote · local-first · MIT</span>
        <div className="home-foot-actions">
          <a
            className="home-foot-link"
            href="https://github.com/LumenoteApp/lumenote"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          <button type="button" className="home-foot-link" onClick={onEnter}>
            Open studio
          </button>
        </div>
      </footer>
    </div>
  );
}
