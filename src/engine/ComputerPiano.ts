/**
 * Virtual Piano QWERTY + pointer → playbackEngine.liveNoteOn/Off.
 * Layout: 1–m whites (C2–C7); Shift hold = temp +1 transpose;
 * arrows transpose; Space flips sustain from the configured default.
 */
import { playbackEngine } from './PlaybackEngine';
import {
  type ComputerPianoPrefs,
  clampTranspose,
  codeToMidi,
  isComputerPianoHandledCode,
  isComputerPianoNoteCode,
  loadComputerPianoPrefs,
  saveComputerPianoPrefs,
} from './computerKeyboardMap';

const DEFAULT_VELOCITY = 0.82;

type Listener = () => void;

function isShiftCode(code: string): boolean {
  return code === 'ShiftLeft' || code === 'ShiftRight';
}

export class ComputerPiano {
  private prefs: ComputerPianoPrefs;
  private listeners = new Set<Listener>();
  /** KeyboardEvent.code → MIDI currently held (finger down) */
  private heldCodes = new Map<string, number>();
  /** pointerId → MIDI currently held via touch/mouse */
  private heldPointers = new Map<number, number>();
  /**
   * Notes still ringing after key-up while sustain is active.
   * Cleared when sustain turns off or on releaseAll.
   */
  private sustained = new Set<number>();
  /** Space currently held (inverts sustain from default). */
  private spaceHeld = false;
  /** Physical Shift keys currently down (temp +1 transpose while any held). */
  private shiftKeys = new Set<string>();
  private attached = false;

  constructor() {
    this.prefs = loadComputerPianoPrefs();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    for (const fn of this.listeners) fn();
  }

  private persist() {
    saveComputerPianoPrefs(this.prefs);
    this.emit();
  }

  getPrefs(): Readonly<ComputerPianoPrefs> {
    return this.prefs;
  }

  isQwertyEnabled() {
    return this.prefs.qwertyEnabled;
  }

  getTranspose() {
    return this.prefs.transpose;
  }

  /** Base transpose + temporary Shift hold (+1). */
  getEffectiveTranspose() {
    return this.prefs.transpose + (this.isShiftHeld() ? 1 : 0);
  }

  isShiftHeld() {
    return this.shiftKeys.size > 0;
  }

  showLabels() {
    return this.prefs.showLabels;
  }

  /**
   * Effective sustain: follows sustainDefaultOn, inverted while Space is held.
   * Default on (VP): sustain unless Space held.
   * Default off: sustain only while Space held.
   */
  isSustainOn() {
    return this.prefs.sustainDefaultOn ? !this.spaceHeld : this.spaceHeld;
  }

  /** True if App studio shortcuts should ignore this key while QWERTY piano is on. */
  handlesCode(code: string): boolean {
    return this.prefs.qwertyEnabled && isComputerPianoHandledCode(code);
  }

  isNoteCode(code: string): boolean {
    return isComputerPianoNoteCode(code);
  }

  setQwertyEnabled(enabled: boolean) {
    this.prefs = { ...this.prefs, qwertyEnabled: enabled };
    if (!enabled) {
      this.spaceHeld = false;
      this.shiftKeys.clear();
      this.releaseAll();
    }
    this.persist();
  }

  setTranspose(transpose: number) {
    const next = clampTranspose(transpose);
    if (next === this.prefs.transpose) return;
    this.releaseKeyboardNotes();
    this.releaseSustained();
    this.prefs = { ...this.prefs, transpose: next };
    this.persist();
  }

  shiftTranspose(delta: number) {
    this.setTranspose(this.prefs.transpose + delta);
  }

  setShowLabels(show: boolean) {
    this.prefs = { ...this.prefs, showLabels: show };
    this.persist();
  }

  setSustainDefaultOn(on: boolean) {
    const wasOn = this.isSustainOn();
    this.prefs = { ...this.prefs, sustainDefaultOn: on };
    // If sustain just turned off, cut ringing notes
    if (wasOn && !this.isSustainOn()) {
      this.releaseSustained();
    }
    this.persist();
  }

  attach() {
    if (this.attached || typeof window === 'undefined') return;
    this.attached = true;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.shiftKeys.clear();
    this.spaceHeld = false;
    this.releaseAll();
  }

  private onWindowBlur = () => {
    this.spaceHeld = false;
    this.shiftKeys.clear();
    this.releaseAll();
    this.emit();
  };

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') {
      this.spaceHeld = false;
      this.shiftKeys.clear();
      this.releaseAll();
      this.emit();
    }
  };

  private isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  private applySpaceHeld(held: boolean) {
    const before = this.isSustainOn();
    this.spaceHeld = held;
    const after = this.isSustainOn();
    if (before && !after) {
      this.releaseSustained();
    }
    this.emit();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (!this.prefs.qwertyEnabled) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (this.isTypingTarget(e.target)) return;

    // Shift: temporary +1 transpose while held (does not change saved transpose)
    if (isShiftCode(e.code)) {
      e.preventDefault();
      if (!this.shiftKeys.has(e.code)) {
        this.shiftKeys.add(e.code);
        this.emit();
      }
      return;
    }

    // Space: invert sustain from default
    if (e.code === 'Space') {
      e.preventDefault();
      if (e.repeat) return;
      this.applySpaceHeld(true);
      return;
    }

    // Permanent transpose
    if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (!e.repeat) this.shiftTranspose(-12);
      return;
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (!e.repeat) this.shiftTranspose(12);
      return;
    }
    if (e.code === 'ArrowDown') {
      e.preventDefault();
      if (!e.repeat) this.shiftTranspose(-1);
      return;
    }
    if (e.code === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) this.shiftTranspose(1);
      return;
    }

    if (!isComputerPianoNoteCode(e.code)) return;
    e.preventDefault();
    if (e.repeat) return;
    if (this.heldCodes.has(e.code)) return;

    const midi = codeToMidi(e.code, this.getEffectiveTranspose());
    if (midi === null) return;

    if (this.sustained.has(midi)) {
      this.sustained.delete(midi);
    }

    this.heldCodes.set(e.code, midi);
    void playbackEngine.liveNoteOn(midi, DEFAULT_VELOCITY, 0);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (!this.prefs.qwertyEnabled) return;

    if (isShiftCode(e.code)) {
      e.preventDefault();
      if (this.shiftKeys.delete(e.code)) {
        this.emit();
      }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      this.applySpaceHeld(false);
      return;
    }

    const midi = this.heldCodes.get(e.code);
    if (midi === undefined) return;
    this.heldCodes.delete(e.code);

    if (this.isSustainOn()) {
      this.sustained.add(midi);
    } else {
      playbackEngine.liveNoteOff(midi, 0);
    }
  };

  private releaseSustained() {
    for (const midi of this.sustained) {
      if (this.isMidiPhysicallyHeld(midi)) continue;
      playbackEngine.liveNoteOff(midi, 0);
    }
    this.sustained.clear();
  }

  private isMidiPhysicallyHeld(midi: number): boolean {
    for (const m of this.heldCodes.values()) {
      if (m === midi) return true;
    }
    for (const m of this.heldPointers.values()) {
      if (m === midi) return true;
    }
    return false;
  }

  private releaseKeyboardNotes() {
    for (const midi of this.heldCodes.values()) {
      playbackEngine.liveNoteOff(midi, 0);
    }
    this.heldCodes.clear();
  }

  private releasePointerNotes() {
    for (const midi of this.heldPointers.values()) {
      playbackEngine.liveNoteOff(midi, 0);
    }
    this.heldPointers.clear();
  }

  /** Release only computer-piano held + sustained notes (not hardware MIDI). */
  releaseAll() {
    this.releaseSustained();
    this.releaseKeyboardNotes();
    this.releasePointerNotes();
    this.sustained.clear();
  }

  private endPitch(midi: number) {
    if (this.isSustainOn()) {
      this.sustained.add(midi);
    } else {
      playbackEngine.liveNoteOff(midi, 0);
    }
  }

  pointerDown(pointerId: number, midi: number, velocity = DEFAULT_VELOCITY): boolean {
    if (midi < 0 || midi > 127) return false;
    const prev = this.heldPointers.get(pointerId);
    if (prev !== undefined && prev !== midi) {
      this.endPitch(prev);
    }
    if (prev === midi) return true;
    if (this.sustained.has(midi)) this.sustained.delete(midi);
    this.heldPointers.set(pointerId, midi);
    void playbackEngine.liveNoteOn(midi, velocity, 0);
    return true;
  }

  pointerMove(pointerId: number, midi: number | null, velocity = DEFAULT_VELOCITY) {
    const prev = this.heldPointers.get(pointerId);
    if (midi === null) {
      if (prev !== undefined) {
        this.heldPointers.delete(pointerId);
        this.endPitch(prev);
      }
      return;
    }
    if (prev === midi) return;
    if (prev !== undefined) {
      this.heldPointers.delete(pointerId);
      this.endPitch(prev);
    }
    if (this.sustained.has(midi)) this.sustained.delete(midi);
    this.heldPointers.set(pointerId, midi);
    void playbackEngine.liveNoteOn(midi, velocity, 0);
  }

  pointerUp(pointerId: number) {
    const midi = this.heldPointers.get(pointerId);
    if (midi === undefined) return;
    this.heldPointers.delete(pointerId);
    this.endPitch(midi);
  }
}

export const computerPiano = new ComputerPiano();
