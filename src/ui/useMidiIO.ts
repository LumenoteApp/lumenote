import { useCallback, useEffect, useState } from 'react';
import { midiIO, type MidiPortInfo } from '../engine/MidiIO';
import { playbackEngine } from '../engine/PlaybackEngine';

export type MidiSnapshot = {
  supported: boolean;
  enabled: boolean;
  error: string | null;
  inputs: MidiPortInfo[];
  outputs: MidiPortInfo[];
  inputId: string | 'all' | null;
  outputId: string | null;
  inputEnabled: boolean;
  thru: boolean;
  outputPlayback: boolean;
};

export function snapMidi(): MidiSnapshot {
  return {
    supported: midiIO.isSupported(),
    enabled: midiIO.isEnabled(),
    error: midiIO.getError(),
    inputs: midiIO.getInputs(),
    outputs: midiIO.getOutputs(),
    inputId: midiIO.getInputId(),
    outputId: midiIO.getOutputId(),
    inputEnabled: midiIO.isInputEnabled(),
    thru: midiIO.isThru(),
    outputPlayback: midiIO.isOutputPlayback(),
  };
}

export function useMidiIO() {
  const [state, setState] = useState<MidiSnapshot>(() => snapMidi());
  const [busy, setBusy] = useState(false);
  const [activity, setActivity] = useState(false);

  useEffect(() => {
    const unsub = midiIO.subscribe(() => setState(snapMidi()));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsub = midiIO.onNote(() => {
      setActivity(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setActivity(false), 120);
    });
    return () => {
      unsub();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await playbackEngine.audio.init();
      await midiIO.enable();
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(() => {
    playbackEngine.releaseLiveNotes();
    midiIO.disable();
  }, []);

  return { state, busy, activity, enable, disable };
}
