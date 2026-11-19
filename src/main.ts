import './style.css';
import { parseMidi, type Song } from './midi';
import { LOOKS, settingsForLook, type Settings } from './looks';
import { Renderer } from './render/Renderer';
import { Audio, Player } from './audio/Player';
import { LiveInput } from './live';
import { exportVideo, exportWindow, keyRangeFor } from './export';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ state

const STORE = 'lumenote.v2.settings';
function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) ?? '');
    if (s && s.look && Array.isArray(s.hands)) return { ...settingsForLook(s.look), ...s };
  } catch {
    /* first visit */
  }
  return settingsForLook('midnight');
}
let settings = loadSettings();
const save = () => localStorage.setItem(STORE, JSON.stringify(settings));

const canvas = $<HTMLCanvasElement>('stage');
const renderer = new Renderer(canvas);
renderer.setSettings(settings);

const audio = new Audio();
audio.volume = Number(localStorage.getItem('lumenote.v2.volume') ?? 0.9);
const player = new Player(audio);
const live = new LiveInput(audio);
let song: Song | null = null;

// ------------------------------------------------------------------ render loop

function fit() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(window.innerWidth * dpr, window.innerHeight * dpr);
  const [lo, hi] = keyRangeFor(song, window.innerWidth, window.innerHeight);
  renderer.setKeyRange(lo, hi);
}
window.addEventListener('resize', fit);
fit();

let last = performance.now();
function tick(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  live.prune(settings.fall + 1);
  renderer.frame(player.time, dt, live.notes, live.now());
  updateTransport();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ------------------------------------------------------------------ loading

async function openFile(file: File) {
  try {
    const buf = await file.arrayBuffer();
    loadSong(parseMidi(buf, file.name));
  } catch (e) {
    toast(`Could not read that MIDI file (${(e as Error).message})`);
  }
}

function loadSong(s: Song) {
  song = s;
  renderer.setSong(s);
  player.load(s, exportWindow(s, settings).t0);
  fit();
  $('empty').hidden = true;
  $('transport').hidden = false;
  $<HTMLButtonElement>('btn-export').disabled = false;
  $('song-name').textContent = s.name;
  $('dur').textContent = fmt(s.end);
  void audio.ensure().catch(() => toast('Piano sound could not load (offline?). Visuals still work.'));
}

const fileInput = $<HTMLInputElement>('file');
fileInput.addEventListener('change', () => {
  const f = fileInput.files?.[0];
  if (f) void openFile(f);
  fileInput.value = '';
});
const pick = () => {
  void audio.ensure().catch(() => {});
  fileInput.click();
};
$('btn-open').onclick = pick;
$('empty-open').onclick = pick;

window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  const f = e.dataTransfer?.files?.[0];
  if (f) {
    void audio.ensure().catch(() => {});
    void openFile(f);
  }
});

// ------------------------------------------------------------------ transport

const seek = $<HTMLInputElement>('seek');
let seeking = false;
const playIcon = $('play-icon');

function togglePlay() {
  if (!song) return;
  if (player.playing) player.pause();
  else void player.play();
}
$('btn-play').onclick = togglePlay;
player.onEnd = () => renderer.reset();

seek.addEventListener('input', () => {
  seeking = true;
  if (!song) return;
  const t0 = exportWindow(song, settings).t0;
  player.seek(t0 + (Number(seek.value) / 1000) * (song.end - t0));
  renderer.reset();
});
seek.addEventListener('change', () => (seeking = false));

function updateTransport() {
  playIcon.setAttribute('d', player.playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
  if (!song) return;
  const t = player.time;
  $('time').textContent = fmt(Math.max(0, t));
  if (!seeking) {
    const t0 = exportWindow(song, settings).t0;
    seek.value = String(Math.round(((t - t0) / (song.end - t0)) * 1000));
  }
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
  if ((document.querySelector('dialog[open]') as HTMLDialogElement | null)) return;
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
    if (!song) return;
    player.seek(player.time + (e.code === 'ArrowRight' ? 5 : -5));
    renderer.reset();
  } else if (e.code === 'KeyF') {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  } else if (e.code === 'KeyH') {
    document.body.classList.toggle('clean');
  }
});

// Hide UI while playing and the mouse is idle.
let idle = 0;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idle);
  idle = window.setTimeout(() => {
    if (player.playing || live.notes.length) document.body.classList.add('idle');
  }, 2500);
}
window.addEventListener('pointermove', wake);
window.addEventListener('pointerdown', wake);

// ------------------------------------------------------------------ live MIDI

const midiBtn = $('btn-midi');
function midiStatus() {
  midiBtn.classList.toggle('on', live.connected);
  midiBtn.querySelector('.label')!.textContent = live.connected ? live.devices[0] : 'Keyboard';
  midiBtn.title = live.connected ? live.devices.join(', ') : 'Connect a MIDI keyboard';
}
live.onChange = midiStatus;
async function connectMidi() {
  try {
    await live.connect();
    if (!live.connected) toast('MIDI is on. Plug in a keyboard and it shows up here.');
    else toast(`Connected: ${live.devices.join(', ')}`);
  } catch (e) {
    toast((e as Error).message);
  }
}
midiBtn.onclick = connectMidi;
$('empty-midi').onclick = connectMidi;
void live.autoConnect();
// Audio needs one click before it can sound; any click on the page counts.
window.addEventListener('pointerdown', () => void audio.ensure().catch(() => {}), { once: true });

// ------------------------------------------------------------------ look panel

const panel = $('panel');
$('btn-look').onclick = () => (panel.hidden = !panel.hidden);

const looksEl = $('looks');
for (const look of LOOKS) {
  const b = document.createElement('button');
  b.className = 'look';
  b.dataset.id = look.id;
  b.style.setProperty('--bg', look.bg[1]);
  b.style.setProperty('--a', look.hands[0]);
  b.style.setProperty('--b', look.hands[1]);
  b.innerHTML = `<i></i><span>${look.name}</span>`;
  b.onclick = () => {
    settings = { ...settingsForLook(look.id), fall: settings.fall };
    apply();
  };
  looksEl.appendChild(b);
}

const cl = $<HTMLInputElement>('c-left');
const cr = $<HTMLInputElement>('c-right');
const sp = $<HTMLInputElement>('s-speed');
const gl = $<HTMLInputElement>('s-glow');
const sk = $<HTMLInputElement>('s-sparks');
const vol = $<HTMLInputElement>('s-volume');

function apply() {
  renderer.setSettings(settings);
  save();
  cl.value = settings.hands[0];
  cr.value = settings.hands[1];
  // Speed slider: higher = faster = shorter fall time.
  sp.value = String(6 - settings.fall);
  gl.value = String(settings.glow);
  sk.value = String(settings.sparks);
  for (const b of looksEl.children) (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.id === settings.look);
}
cl.oninput = () => {
  settings.hands = [cl.value, settings.hands[1]];
  apply();
};
cr.oninput = () => {
  settings.hands = [settings.hands[0], cr.value];
  apply();
};
sp.oninput = () => {
  settings.fall = 6 - Number(sp.value);
  apply();
};
gl.oninput = () => {
  settings.glow = Number(gl.value);
  apply();
};
sk.oninput = () => {
  settings.sparks = Number(sk.value);
  apply();
};
vol.value = String(audio.volume);
vol.oninput = () => {
  audio.setVolume(Number(vol.value));
  localStorage.setItem('lumenote.v2.volume', vol.value);
};
$('btn-reset').onclick = () => {
  settings = settingsForLook(settings.look);
  apply();
};
apply();

// ------------------------------------------------------------------ export

const dlg = $<HTMLDialogElement>('export');
const choice: Record<string, string> = { format: 'landscape', quality: '1080', fps: '60' };
for (const seg of dlg.querySelectorAll<HTMLElement>('.seg')) {
  seg.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    for (const x of seg.children) x.classList.toggle('on', x === b);
    choice[seg.dataset.name!] = b.dataset.v!;
  });
}
$('btn-export').onclick = () => {
  player.pause();
  dlg.showModal();
};
let abort: AbortController | null = null;
$('exp-cancel').onclick = () => {
  abort?.abort();
  dlg.close();
};
const prog = dlg.querySelector<HTMLElement>('.progress')!;
const bar = dlg.querySelector<HTMLElement>('.bar')!;
const plabel = dlg.querySelector<HTMLElement>('.plabel')!;
const go = $<HTMLButtonElement>('exp-go');
go.onclick = async () => {
  if (!song) return;
  const q = Number(choice.quality);
  const portrait = choice.format === 'portrait';
  const long = Math.round((q * 16) / 9 / 2) * 2;
  const [w, h] = portrait ? [q, long] : [long, q];
  abort = new AbortController();
  go.disabled = true;
  prog.hidden = false;
  try {
    const blob = await exportVideo(song, settings, {
      width: w,
      height: h,
      fps: Number(choice.fps) as 30 | 60,
      audio: true,
      signal: abort.signal,
      onProgress: (f, label) => {
        bar.style.width = `${(f * 100).toFixed(1)}%`;
        plabel.textContent = label;
      },
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${song.name} - lumenote.mp4`;
    a.click();
    plabel.textContent = `Done · ${(blob.size / 1e6).toFixed(1)} MB`;
  } catch (e) {
    if ((e as Error).name !== 'AbortError') plabel.textContent = `Export failed: ${(e as Error).message}`;
  } finally {
    go.disabled = false;
    abort = null;
  }
};

// ------------------------------------------------------------------ misc

let toastTimer = 0;
function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 3500);
}

