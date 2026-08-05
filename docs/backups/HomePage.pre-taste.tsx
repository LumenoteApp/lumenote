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
      stat: `${stats.scenes}`,
      unit: 'full scenes',
      body: `${stats.sceneCategories} mood categories (rave, chill, cinema, retro, cosmic, and more). One click swaps particles, background, colors, and instrument.`,
    },
    {
      title: 'Color systems',
      stat: `${stats.palettes}`,
      unit: 'palettes',
      body: `${stats.colorModes} color modes including per-track, palette scatter, rainbow pitch/time, spectrum, and RGB chase. Recolor hands without desyncing audio.`,
    },
    {
      title: 'Background atmospheres',
      stat: `${stats.backgrounds}`,
      unit: 'styles',
      body: 'Nebula, aurora, starfield, pulse beams, synthwave grid, void, digital rain, radar sweep, and hyperspace warp. All of them react to note energy.',
    },
    {
      title: 'Particle engines',
      stat: `${stats.particles}`,
      unit: 'presets',
      body: 'Ember, neon, stardust, firework, plasma, aurora haze, rain, blizzard, soft, inferno, crystal. Hit sparks, trails, sustain glow, and shockwaves.',
    },
    {
      title: 'Music-reactive field',
      stat: `${stats.musicReactive}`,
      unit: 'modes',
      body: 'Ambient dust, rising columns, bass shockwaves, and attack pops that lock to pitch bands. From chill haze to full rave chaos.',
    },
    {
      title: 'Sound + export',
      stat: `${stats.instruments}+`,
      unit: 'instruments',
      body: `Built-in Tone synths, GM chip/FM, load your own SF2/SF3. Bake smooth MP4 up to ${stats.exportMaxLabel} at 30/60 fps, or realtime capture.`,
    },
  ];

  const highlights = [
    {
      title: 'Multi-track piano roll',
      body: 'Separate hands stay separate colors. Mute, hide, or recolor any track while playback stays locked.',
    },
    {
      title: 'Live MIDI in and out',
      body: 'Play a hardware keyboard into the same visualizer. Optional MIDI thru for your DAW or external gear.',
    },
    {
      title: 'Surprise and Party mode',
      body: 'Randomize whole looks, or let parameters dance over time with palette flips and continuous motion.',
    },
    {
      title: 'Local-first, no watermark',
      body: 'Runs in the browser. MIDI and soundfonts stay on your machine. Export clean video you own.',
    },
  ];

  return (
    <div className="home">
      <div className="home-bg" aria-hidden>
        <div className="home-orb home-orb-a" />
        <div className="home-orb home-orb-b" />
        <div className="home-orb home-orb-c" />
        <div className="home-grid" />
        <div className="home-vignette" />
      </div>

      <header className="home-nav">
        <div className="home-logo">
          <span className="home-logo-mark">L</span>
          <span className="home-logo-text">Lumenote</span>
        </div>
        <nav className="home-nav-links" aria-label="Page">
          <a href="#looks">Looks</a>
          <a href="#toolkit">Toolkit</a>
          <a href="#how">How it works</a>
        </nav>
        <button type="button" className="btn home-nav-cta" onClick={onEnter}>
          Open studio
        </button>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <p className="home-eyebrow">Free open-source MIDI piano visualizer</p>
          <h1 className="home-title">
            Make piano videos that
            <span className="home-title-glow"> feel alive</span>
          </h1>
          <p className="home-lead">
            Load a multi-track MIDI and get falling notes, music-reactive particles, living
            backgrounds, and clean {stats.exportMaxLabel} export. {stats.scenes} scene presets,
            {` ${stats.palettes} `}color palettes, and a full visual playground in the browser.
          </p>

          <div className="home-ctas">
            <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
              Launch studio
            </button>
            <label className="btn home-cta-secondary">
              Open MIDI file
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
            <span className="home-drop-icon" aria-hidden>
              ↓
            </span>
            <span>
              Drop a <strong>.mid</strong> here to jump straight into the studio
            </span>
          </div>
          {error && <p className="home-error">{error}</p>}
        </section>

        <section className="home-stats" aria-label="Product numbers">
          <div className="home-stat">
            <strong>{stats.scenes}</strong>
            <span>scene presets</span>
          </div>
          <div className="home-stat">
            <strong>{stats.palettes}</strong>
            <span>color palettes</span>
          </div>
          <div className="home-stat">
            <strong>{stats.backgrounds}</strong>
            <span>background styles</span>
          </div>
          <div className="home-stat">
            <strong>{stats.particles}</strong>
            <span>particle looks</span>
          </div>
          <div className="home-stat">
            <strong>{stats.exportMaxLabel}</strong>
            <span>bake export</span>
          </div>
          <div className="home-stat">
            <strong>{stats.instruments}+</strong>
            <span>instruments + SF2</span>
          </div>
        </section>

        <section className="home-highlights" aria-label="Highlights">
          {highlights.map((h) => (
            <article key={h.title} className="home-hi-card">
              <h2>{h.title}</h2>
              <p>{h.body}</p>
            </article>
          ))}
        </section>

        <section id="looks" className="home-looks">
          <div className="home-section-head">
            <h2>
              {stats.scenes} looks, {stats.sceneCategories} moods
            </h2>
            <p>
              Built-in scene presets cover full snapshots: visuals, particles, colors, FX, and
              sound. Browse by category so the library stays fast to scan.
            </p>
          </div>
          <div className="home-mood-row">
            {SCENE_CATEGORIES.map((c) => (
              <div key={c.id} className="home-mood-chip">
                <strong>{c.label}</strong>
                <span>{c.blurb}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="toolkit" className="home-toolkit">
          <div className="home-section-head">
            <h2>The visual toolkit</h2>
            <p>
              Not just a skin. Lumenote is a stack of independent systems you can mix, randomize,
              or lock into a saved scene.
            </p>
          </div>
          <div className="home-toolkit-grid">
            {toolkit.map((item) => (
              <article key={item.title} className="home-tool-card">
                <div className="home-tool-stat">
                  <strong>{item.stat}</strong>
                  <span>{item.unit}</span>
                </div>
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="home-more" aria-label="More capabilities">
          <div className="home-more-card home-more-export">
            <h2>Export that stays smooth</h2>
            <p>
              Offline bake steps every frame at exact fps for clean MP4s. Choose 720p, 1080p,
              1440p, or {stats.exportMaxLabel} at 30 or 60 fps, with optional audio. Realtime
              capture is there when you want a quick take.
            </p>
            <ul className="home-bullets">
              <li>{stats.exportResolutions} export resolutions through {stats.exportMaxLabel}</li>
              <li>30 / 60 fps bake with design-space scaling</li>
              <li>No watermark, no account, downloads to your machine</li>
            </ul>
          </div>
          <div className="home-more-card home-more-play">
            <h2>Play it live</h2>
            <p>
              Web MIDI input for controllers, rising live note bars, and optional MIDI out / thru.
              Pair a soundfont for real GM banks, or stick to the built-in synths.
            </p>
            <ul className="home-bullets">
              <li>Hardware keyboard → particles and hit rail</li>
              <li>Load custom SF2 / SF3 soundfonts locally</li>
              <li>Fullscreen stage with overlay studio panel</li>
            </ul>
          </div>
        </section>

        <section id="how" className="home-how">
          <h2>How it works</h2>
          <ol className="home-steps">
            <li>
              <strong>Open</strong> a multi-track MIDI (separate hands give cleaner colors)
            </li>
            <li>
              <strong>Pick a scene</strong> or dive into colors, particles, backgrounds, and Party
              mode
            </li>
            <li>
              <strong>Export</strong> a smooth bake up to {stats.exportMaxLabel}, or fullscreen and
              capture live
            </li>
          </ol>
          <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
            Start creating
          </button>
          <p className="home-how-note">
            Free and open source. Chrome or Edge recommended for SF2, Web MIDI, and video bake.
          </p>
        </section>
      </main>

      <footer className="home-foot">
        <span>Lumenote · local-first · MIT open source</span>
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
            Enter studio
          </button>
        </div>
      </footer>
    </div>
  );
}
