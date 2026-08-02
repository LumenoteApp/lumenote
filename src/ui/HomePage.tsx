import { useState } from 'react';
import './HomePage.css';

type Props = {
  onEnter: () => void;
  onOpenMidi: (file: File) => void;
};

const FEATURES = [
  {
    title: 'Multi-track color',
    body: 'Left and right hands light up in separate colors — recolor, mute, or hide any track.',
    icon: '🎹',
  },
  {
    title: 'Living particles',
    body: 'Hit sparks, shockwaves, and music-reactive dust that breathe with every note.',
    icon: '✨',
  },
  {
    title: 'Party mode',
    body: 'Parameters dance over time — smooth slides, palette flips, pure visual chaos on demand.',
    icon: '🎉',
  },
  {
    title: 'Yours, no watermark',
    body: 'Runs in the browser. Export by recording the player — nothing stamped on your video.',
    icon: '🎬',
  },
];

export function HomePage({ onEnter, onOpenMidi }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const takeFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.toLowerCase().match(/\.midi?$/)) {
      setError('Drop a .mid or .midi file');
      return;
    }
    setError(null);
    onOpenMidi(file);
  };

  return (
    <div className="home">
      <div className="home-bg" aria-hidden>
        <div className="home-orb home-orb-a" />
        <div className="home-orb home-orb-b" />
        <div className="home-grid" />
        <div className="home-vignette" />
      </div>

      <header className="home-nav">
        <div className="home-logo">
          <span className="home-logo-mark">NF</span>
          <span className="home-logo-text">NoteFall</span>
        </div>
        <button type="button" className="btn home-nav-cta" onClick={onEnter}>
          Open app
        </button>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <p className="home-eyebrow">Free browser MIDI visualizer</p>
          <h1 className="home-title">
            Piano videos that
            <span className="home-title-glow"> actually move</span>
          </h1>
          <p className="home-lead">
            Load a multi-track MIDI, watch notes fall with particles, glows, and music-reactive
            atmosphere — then fullscreen and record. No account, no watermark, no install.
          </p>

          <div className="home-ctas">
            <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
              Launch visualizer
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
            <span className="home-drop-icon">↓</span>
            <span>
              Or drop a <strong>.mid</strong> here to jump straight in
            </span>
          </div>
          {error && <p className="home-error">{error}</p>}
        </section>

        <section className="home-features" aria-label="Features">
          {FEATURES.map((f) => (
            <article key={f.title} className="home-card">
              <span className="home-card-icon" aria-hidden>
                {f.icon}
              </span>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </article>
          ))}
        </section>

        <section className="home-how">
          <h2>How it works</h2>
          <ol className="home-steps">
            <li>
              <strong>Open</strong> a multi-track MIDI (separate hands = separate colors)
            </li>
            <li>
              <strong>Tune</strong> particles, backgrounds, and Surprise / Party mode
            </li>
            <li>
              <strong>Fullscreen</strong> with F, then record with OBS or Game Bar
            </li>
          </ol>
          <button type="button" className="btn primary home-cta-main" onClick={onEnter}>
            Start creating
          </button>
        </section>
      </main>

      <footer className="home-foot">
        <span>NoteFall · runs locally in your browser</span>
        <button type="button" className="home-foot-link" onClick={onEnter}>
          Enter app →
        </button>
      </footer>
    </div>
  );
}
