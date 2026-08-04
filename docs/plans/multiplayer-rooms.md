# Multiplayer piano rooms for Lumenote

## Goal

Turn Lumenote from a **local-only** visualizer into a **multiplayer piano site**: rooms where several people play live MIDI (QWERTY, touch, hardware), hear/see each other, and chat. **Anonymous guests first**; optional accounts later.

Solo studio (`/player` MIDI file, export, scenes) should stay intact. Multiplayer is a **new product surface** that reuses live input + visuals, not a rewrite of bake/export.

---

## What you already have (reuse)

| Piece | Role in multiplayer |
|--------|---------------------|
| `playbackEngine.liveNoteOn/Off` | Local + remote notes (no transport reanchor) |
| QWERTY / touch / Web MIDI | Input sources → emit room note events |
| Rising bars, particles, keyboard lights | Visualize all players (color per player) |
| Static Vite SPA | Keep as frontend |

**Do not** stream audio between users. Relay **note events** only; each browser synthesizes locally (same model as Virtual Piano multiplayer). That keeps bandwidth low and latency manageable.

---

## Product shape (MVP)

### Routes (suggested)

| Path | Purpose |
|------|---------|
| `/` | Home (existing + “Play together”) |
| `/player` | Solo studio (unchanged) |
| `/rooms` | Lobby: create / join room list or code |
| `/room/:id` | Multiplayer stage: piano + chat + presence |

### MVP features

1. **Anonymous identity** – server assigns `playerId` + random display name (editable once per session); cookie or `localStorage` reconnect token.
2. **Rooms** – create room (name, optional password, max players e.g. 8–16); join by code/URL; host can kick (phase 1.5).
3. **Live multiplayer piano** – each client plays immediately locally, then broadcasts `note_on` / `note_off` (pitch, velocity, optional channel); others play remote notes with that player’s color.
4. **Presence** – who’s in the room, mute self (don’t send notes), optional mute others (don’t play their notes).
5. **Chat** – text messages in-room, short history (e.g. last 50), basic rate limit + length cap.
6. **Connection UX** – reconnect, “you’re lagging”, disconnect cleanup (auto note-off for that player).

### Explicitly out of MVP

- Full user accounts / OAuth (phase 2)
- Shared MIDI file sync / multiplayer play-along of a song
- Voice chat
- Server-side SF2 or cloud synth
- Recording multiplayer sessions to video
- Global public matchmaking at scale

---

## Architecture

```
┌─────────────────┐     WSS      ┌──────────────────────────┐
│ Browser A       │◄────────────►│ Realtime server          │
│ local noteOn    │  note/chat   │  rooms, presence, chat   │
│ + broadcast     │              │  (no audio synthesis)    │
└────────┬────────┘              └────────────┬─────────────┘
         │ liveNoteOn                         │
         ▼                                    │ fan-out
┌─────────────────┐     WSS                   │
│ Visualizer +    │◄──────────────────────────┘
│ Browser B/C…    │  remote note_on/off → liveNoteOn(playerColor)
└─────────────────┘
```

### Note event protocol (lean JSON first)

```ts
// client → server
{ type: 'note_on',  pitch: 60, velocity: 0.8, t?: number }
{ type: 'note_off', pitch: 60 }
{ type: 'chat',     text: 'hello' }
{ type: 'presence', name?: string, muted?: boolean }

// server → clients (adds playerId, serverTime)
{ type: 'note_on', playerId, pitch, velocity, serverTime }
{ type: 'note_off', playerId, pitch, serverTime }
{ type: 'chat', playerId, name, text, serverTime }
{ type: 'join' | 'leave' | 'roster', ... }
```

Rules:

- **Optimistic local play**: never wait for the server to hear yourself.
- **Ignore echo** of your own notes if the server rebroadcasts them (or server excludes sender).
- **On disconnect / leave**: server tells room `player_left`; clients `noteOff` all pitches that player held (track remote holds per player).
- **Rate limit** notes (e.g. drop floods) and chat (e.g. 1 msg / 400ms).

### Client changes (high level)

1. **`RoomClient`** – WebSocket connect, room join, send/receive events.
2. **Bridge** – local live input path also `roomClient.sendNoteOn/Off` when in a room; remote events → `liveNoteOn/Off` with `playerId` / color (extend live note state to carry `playerId` + color if needed).
3. **UI** – lobby, room chrome (roster, chat panel, copy invite link, connection status).
4. Keep solo `/player` free of WebSocket dependency.

### Server responsibilities

- Room lifecycle (create, join, destroy when empty)
- Fan-out note + chat messages
- Presence roster
- Authn: anonymous session token (JWT or random id signed by server)
- Basic abuse controls (size limits, rate limits)
- Optional: room list for public rooms

---

## Recommended tech stack

### Keep (frontend)

- **Vite + React + TypeScript** (current Lumenote)
- Existing Tone / TinySynth / Spessa for local sound
- Existing visualizer for shared stage

### Realtime backend (pick one path)

**Recommended for MVP: Cloudflare (Workers + Durable Objects) or PartyKit**

| Option | Pros | Cons |
|--------|------|------|
| **A. Cloudflare Durable Objects** (or PartyKit on CF) | Rooms map cleanly to one DO; global edge; cheap at small scale; WSS built-in | Learning curve; local dev differs slightly |
| **B. Node + `ws` on Fly.io / Railway** | Simple mental model; easy local `localhost:8787` | Need sticky sessions or Redis if multi-instance; you manage process uptime |
| **C. Supabase Realtime + Auth** | Fast accounts + chat later; less custom server | Note latency / channel design less ideal for dense MIDI; harder to rate-limit notes finely |

**Suggestion:** **Path A (Cloudflare Durable Objects)** if you want “rooms” and low ops; **Path B (Fly.io Node server)** if you want the simplest code you can debug with `npm run server`.

Monorepo sketch:

```
lumenote/
  src/                 # existing SPA
  server/              # realtime (or packages/server)
  shared/              # zod types for protocol (optional)
```

### Auth (phased)

| Phase | Approach |
|-------|----------|
| **1 – Anonymous** | On first connect, server mints `sessionId` + default name; store in `localStorage`; reconnect with same id |
| **2 – Accounts** | Add **Clerk** or **Supabase Auth** (GitHub/Google/Discord); link session → user; keep guest path |

No need for a full custom auth system in v1.

### Data store

| Need | MVP | Later |
|------|-----|--------|
| Room state | In-memory on room process / DO | — |
| Chat history | Last N messages in room memory | Optional Postgres |
| Accounts / friends | — | Postgres (Supabase/Neon) |
| Public room directory | Optional in-memory or KV | DB |

---

## Hosting: what you need beyond static files

Today Lumenote can be **static-only** (`dist/` on Netlify/Pages). Multiplayer **cannot** be static-only.

### Required

1. **Realtime host with WebSockets**
   - Cloudflare Workers/DO **or** Fly.io/Railway/Render container running Node.
2. **HTTPS + WSS**
   - Browsers require secure context for mic/MIDI in some cases; WSS should match site origin or allow CORS/WSS from your frontend domain.
3. **Environment config on frontend**
   - e.g. `VITE_ROOM_WS_URL=wss://rooms.yourdomain.com`
4. **Domain (recommended)**
   - e.g. `lumenote.app` + `rooms.lumenote.app` or same origin reverse-proxy `/ws`.

### Strongly recommended

5. **Process / edge uptime** – not “upload HTML and forget”; need a always-on realtime tier (or CF paid plan if you exceed free DO limits).
6. **Observability** – basic logs (joins, errors, disconnects); optional Sentry on client.
7. **Rate limits & max room size** – protect yourself from note spam.
8. **Abuse policy for chat** – even guests need kick/ban tools eventually.

### Optional later

9. **Database** – Supabase/Neon for users, saved room names, bans.
10. **Redis** – only if multi-node Node servers need shared room routing (skip if single process or Durable Objects).
11. **CDN for SPA** – keep Vite static on Cloudflare Pages / Netlify / GitHub Pages; WS on separate subdomain is fine.
12. **Email / OAuth apps** – only when you add real accounts (Discord/Google developer consoles).

### Cost sketch (order of magnitude, small hobby traffic)

| Piece | Ballpark |
|-------|----------|
| Cloudflare Pages (SPA) | Free tier often enough |
| Durable Objects / Workers | Free tier then low $ for light use |
| Fly.io small VM | ~$5–10/mo if always on |
| Custom domain | ~$10–15/yr |
| Supabase free | Fine for early accounts |

You do **not** need: GPU, media servers, SF2 hosting, or WebRTC for MVP piano notes.

### What static hosts alone cannot do

Netlify/Vercel **serverless functions** are a poor fit for long-lived WebSockets (unless using a dedicated realtime product). Prefer:

- CF Durable Objects / PartyKit, or  
- A small always-on Node service on Fly/Railway.

---

## Latency and UX notes

- Target “good enough” casual jam: **local 0 ms**, remote **30–150 ms** typical.
- Prefer **UDP-like behavior**: drop late/dupe-tolerant; don’t retransmit old note_ons.
- Show remote players with **distinct colors** on keyboard + rising bars.
- Cap concurrent remote voices if needed (e.g. 32–64 total sounding notes).
- Mobile: touch piano already exists; rooms should work on phone landscape.

---

## Implementation phases

### Phase 1 – Vertical slice (shippable MVP)

1. Minimal WS server: create/join room, presence, note relay, chat.
2. Frontend `/rooms` + `/room/:id`.
3. Wire local live notes → send; remote notes → `liveNoteOn/Off` + colors.
4. Anonymous session + display name.
5. Deploy SPA + WS; document `VITE_ROOM_WS_URL`.
6. Smoke: 2 browsers, 2 QWERTY keyboards, chat, disconnect cleanup.

### Phase 2 – Room product polish

- Public/private rooms, password, max players  
- Mute self / mute player  
- Host controls (kick)  
- Better reconnect + “player held notes” panic  
- Rate limits hardened  

### Phase 3 – Accounts & social

- Optional login (Clerk/Supabase)  
- Persistent display name, avatar color  
- Friends / recent rooms (needs DB)  

### Phase 4 – Music features (optional)

- Shared instrument preset per room  
- Optional shared MIDI backing track (harder clock sync)  
- Room recording / clip export  

---

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Note spam / abuse | Rate limits, max room size, kick |
| Ghost notes after disconnect | Track holds per player; force all-notes-off on leave |
| Studio shortcut conflicts in room | Reuse QWERTY piano mode rules (shortcuts off while playing) |
| Bundle size / audio init | Warm audio on “Join room” gesture (same autoplay rules) |
| Scope creep vs solo visualizer | Separate routes; don’t block export/bake work |

---

## Success criteria (MVP)

- Two users in one room hear and see each other’s notes within ~100–200 ms on a good connection.  
- Chat messages deliver reliably.  
- Leaving or refreshing does not leave stuck notes for others.  
- Solo `/player` still works offline with no WS required.  
- Deploy docs list: static host + realtime host + env vars + domain.

---

## Suggested default decisions (for approval)

1. **Protocol:** JSON WebSocket events (upgrade to binary later if needed).  
2. **Backend:** Cloudflare Durable Objects **or** Fly.io Node+ws (choose one before coding).  
3. **Auth:** anonymous first; accounts only in phase 3.  
4. **Audio model:** event relay + local synth only (no WebRTC audio).  
5. **UI:** new `/rooms` + `/room/:id`; keep `/player` solo.  

---

## Open choices (confirm when implementing)

- Backend host preference: **Cloudflare DO** vs **Fly Node**  
- Public room browser vs invite-link-only for MVP  
- Max players per room (recommend **8** for v1)  
- Whether remote players share one instrument or each picks their own  
