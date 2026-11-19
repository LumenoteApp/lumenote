# Agent instructions (Lumenote v2)

Lumenote is a browser MIDI piano visualizer: live play with Web MIDI, and offline MP4 export. Vanilla TypeScript + Vite, no framework.

## Layout

- `src/midi.ts`: parse MIDI into `Song` (notes with `end` = key up, `soundEnd` = with sustain pedal, `hand` 0/1).
- `src/looks.ts`: the looks and `Settings` (look, hands, fall, glow, sparks). Keep the setting surface small on purpose.
- `src/render/Renderer.ts` + `shaders.ts`: WebGL2. One instanced shape pass (notes, keys, glows, sparks), then bloom, then tonemap / vignette / grain.
- `src/audio/Piano.ts`: sampler used both realtime and in `OfflineAudioContext`.
- `src/audio/Player.ts`: transport + scheduling. `src/live.ts`: Web MIDI input.
- `src/export.ts`: Mediabunny export (`startAt`, `maxSeconds`, `externalAudio`, `overlay` options).
- `src/main.ts`: UI wiring.

## Hard rules

- Live view and export must render through the same `Renderer.frame(t, dt)`. Do not fork drawing code for export.
- Particles must stay deterministic for a given `dt` sequence (seeded RNG), so exports are reproducible.
- Do not create or resume an `AudioContext` before a user gesture.
- Offline audio schedules voices in blocks (`renderSongAudio`). Do not go back to creating every voice up front: thousands of idle nodes make long songs extremely slow.
- Keep the UI small: a few looks and sliders, not dozens of parameters.
- No em dashes in user-facing copy.
- Confirm before force-push, deploy, or destructive git.

## Verify

```bash
npm run build
```

Then check the app in the browser (load a MIDI, play, export a short clip).

## Related (not in this repo)

The YouTube content pipeline ("Lumenote Studio") lives in a separate local folder and imports `src/` from this repo by path. Keep the exports of `midi.ts`, `looks.ts`, `render/Renderer.ts` and `export.ts` stable, or update the studio at the same time.
