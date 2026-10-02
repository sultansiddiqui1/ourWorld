# Our Universe & First Bloom 🌌🌸 — Build Plan

A mobile-first (≤480px column) love-letter webapp for a long-distance relationship: a real night sky with both birthday constellations joined by a bridge of light, a garden that grows one new flower every day, voice-note letters, and a 3D "reasons" vending machine.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React 19 + TypeScript** | Fast dev server, typed content files |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Quick mobile layouts, theme tokens in `src/index.css` |
| 3D | **React Three Fiber + drei** (instead of raw Three.js or Spline) | Declarative scenes in React; Spline exports are heavy on phones |
| 3D assets | **Blender (via Blender MCP)** → `.glb` in `public/models/` | Real modelled assets; sources kept in `blender/` |
| Shaders | Hand-written GLSL (stars, flares, nebula, light bridge, heart) | Glow without a post-processing pass → cheap on mobile |
| Animation | **GSAP + `@gsap/react`** | Bloom timelines, sheet transitions, capsule drop |
| Audio | HTML5 `Audio` via `useAudio` hook | No dependency; one voice note plays at a time |
| Hosting | Vercel / Netlify (static) | Push-to-deploy, free |

**Mobile rules baked in:** audio only starts from a tap (iOS/Android block autoplay) · touch targets ≥44px · `100dvh` + safe-area insets · render loops pause on hidden tabs · DPR capped at 2.

---

## Project layout

```
src/
  content/              ← everything personal lives here
    config.ts           passcode, start date, birthdays & birthplaces, welcome text
    gardenNotes.ts      notes hidden in each day's flower (+ fallback lines)
  lib/
    constellations.ts   real star data (RA/Dec/magnitude) for Virgo & Taurus + projection
    flowers.ts          which flower blooms on which day, colours, special days
    dates.ts, random.ts deterministic date & seeded-random helpers
  hooks/                useToday, useAudio
  components/
    gate/               soft passcode keypad
    welcome/            fade-in + cassette voice note
    shell/              tab layout + bottom nav
    universe/           Sky (constellations, bridge, nebula) + Garden (flowers, meadow, Himalaya)
    ui/                 Sheet
public/
  models/flowers.glb    7 low-poly flower species (from blender/flowers.blend)
  audio/                welcome.mp3, letters/*.mp3
blender/flowers.blend   editable source for the flowers
```

---

## Roadmap

### ✅ Phase 1 — Shell & navigation
- Passcode gate (`config.passcode`, remembered on the device).
- Welcome: cinematic fade from black, cassette tape that plays `public/audio/welcome.mp3` with spinning reels + tape progress.
- App shell: 480px column, bottom tab bar (Universe · Open when · Reasons), dark night theme.

### ✅ Phase 2 — The Universe tab (sky + garden)
**Sky (top half)**
- 18 Sep 2000 → **Virgo ♍** (anchor star **Spica**, blue-white) · 21 Apr 2002 → **Taurus ♉** (anchor **Aldebaran**, orange; Pleiades included). Star positions are real J2000 coordinates.
- Stars fade in, constellation lines draw one by one, anchors pulse with a four-point flare.
- **Light bridge** arcs between the two anchor stars: two sparks leave each star, meet in the middle, and a heart flashes — every 9 s.
- Twinkling deep field + drifting nebula + the occasional shooting star; gentle parallax follows the finger.
- Tap a constellation → card with birthday, birthplace (Nepalgunj / Hetauda) and guiding star.

**Garden (bottom half) — "never-wilt"**
- One flower per day since `config.startDate`; swipe (with fling + snap) or use the arrows to walk back through the days.
- 7 species modelled in Blender: daisy, cosmos, tulip, lotus, rose, **sayapatri** (marigold) and **lali gurans** (rhododendron). Species cycles through shuffled bags so neighbours rarely repeat; colour/size/lean are seeded by the date so a flower never changes once it has bloomed.
- Special days: the first day (red rose), every monthiversary (red rose + "N months of us"), and both birthdays (white lotus / red lali gurans).
- Today's flower grows from the soil and unfurls its petals (per-petal rotation driven by `bloomDelta` data exported from Blender).
- Tap any flower (or the date pill) → bottom sheet with the date and that day's hidden note.
- Moonlit low-poly meadow, grass, fireflies and a snow-capped Himalayan skyline — terrain is streamed in chunks so it scales to years of flowers.

### ⏳ Phase 3 — "Open when" audio letters
- `src/content/letters.ts`: `{ id, title, body, audio }[]` (e.g. *Open when you miss me / can't sleep / need a laugh*).
- 2-column grid of envelopes; opened state remembered per device (wax seal broken).
- Tap → GSAP flap-open + letter slides up full screen: handwritten body + custom audio player (play/pause, scrub, time) reusing `useAudio`.
- Optional: model the envelope + wax seal in Blender for a 3D opening moment.

### ⏳ Phase 4 — Reasons vending machine & polish
- Blender: vending machine (glass front, coils, chute, tray) + capsules, exported to `public/models/vending.glb`.
- "Dispense a reason" → GSAP timeline: coil turns, capsule drops down the chute, bounces on the tray (`bounce.out`), pops open → card with a reason from `src/content/reasons.ts` (shuffle-bag, no repeats until all are seen).
- Polish: `vite-plugin-pwa` (add to home screen, offline audio), haptics, `prefers-reduced-motion` fallbacks, split the three.js vendor chunk, compress audio (~64 kbps mono), real-device test on iOS Safari + Android Chrome, deploy.

---

## Before sharing with her — TODO
1. `src/content/config.ts` → set **`passcode`**, **`passcodeHint`** and **`startDate`** (the day the first flower bloomed). Optionally add names to `people`.
2. Record `public/audio/welcome.mp3`.
3. Fill `src/content/gardenNotes.ts` with notes for as many dates as you like (future dates too — they appear on that day).

## Editing the flowers
Open `blender/flowers.blend` (scene **Flowers**), tweak, then export the `FlowerSet` collection to `public/models/flowers.glb` as glTF Binary with **Include → Custom Properties** enabled (petals carry `part` and `bloomDelta`). Root object names must match `SPECIES` in `src/lib/flowers.ts`.

## Verification checklist
- `npm run dev` → open at 390×844 (DevTools device mode) or on your phone via the Network URL Vite prints.
- Gate → welcome → Universe; constellations draw in, the bridge pulses, today's flower blooms.
- Swipe the garden, tap flowers and constellations; no horizontal page scroll; tab bar clears the home indicator.
- `npm run build` passes typecheck.
