# WubLabz Studio

WubLabz Studio is a local-first AI Producer, AI Remix Engineer, and AI Arrangement Workstation.

It is not a generic text-to-music generator. The current application is a functional browser DAW foundation with a polished studio interface and a deterministic playback backbone.

## Current Product State

WubLabz Studio currently provides the core browser DAW surface:

- Transport for play, stop, rewind, BPM, loop, snap, save, export, and panel toggles.
- Browser sidebar for local sample import and project loading.
- Arrangement view with tracks, clips, timeline ruler, grid, loop region, context menu, and playhead.
- Mixer panel with channel strips, mute/solo, pan, faders, and master control.
- Piano roll for MIDI note editing, note drawing, selection, erase mode, grid size, velocity, and velocity lane.
- Beginner Mode with WubGuide AI, a local deterministic assistant that teaches the interface and highlights relevant controls.

The most recent UI pass added premium glassmorphism visual polish only. It did not change audio engine behavior, scheduling, project persistence contracts, export logic, or runtime playback routing.

## Beginner Mode and WubGuide AI

Beginner Mode is a guided UX/help layer for new users. It adds contextual labels, section help buttons, guided highlights, deterministic action workflows, and the WubGuide AI assistant panel.

WubGuide AI is local and deterministic for now:

- No external AI API is connected.
- No audio is uploaded.
- Questions are answered with keyword/rule-based matching.
- Action workflows can open panels, focus controls, create starter tracks, and create starter MIDI clip placeholders.
- Context-aware onboarding tracks beginner milestones and proactively suggests the next step.
- Progress is persisted in local storage.
- Responses can highlight UI targets such as transport, browser, arrangement, mixer, piano roll, save, export, snap, loop, tracks, and clips.
- The tutorial walks through transport, browser, arrangement, mixer, piano roll, save, and export.
- WubGuide also answers meter, clipping, and headroom questions.

Future real AI integration should remain optional and must preserve the local-first guardrails.

## Producer Mode

WubGuide also includes Producer Mode for users who already understand the DAW interface. Producer Mode analyzes project structure, not raw audio, and gives deterministic production coaching.

It summarizes BPM, time signature, tracks, audio clips, MIDI clips, arrangement length, mute/solo usage, saved state, export state, and meter conditions. Suggestions are categorized by arrangement, rhythm, melody, bass, mix, workflow, and export.

See [docs/PRODUCER_MODE.md](docs/PRODUCER_MODE.md).

## Architecture Guardrails

Playback must remain on the canonical path:

```text
TimelineEvent[]
-> EventScheduler
-> TimelineRouter
-> ToneAdapter
-> BusGraph
```

Guardrails:

- Do not schedule Tone.js directly outside `ToneAdapter`.
- Do not create rogue `AudioContext` instances.
- Do not add side-channel playback paths from UI, server handlers, preview helpers, macros, or WebSocket routes.
- Do not bypass `BusGraph` for final audio output.
- Keep Gemini optional and never upload raw audio to Gemini.
- Keep generation deterministic. Do not use `Math.random` for remix generation; use seeded randomness when variation is needed.

See [docs/ARCHITECTURE_GUARDRAILS.md](docs/ARCHITECTURE_GUARDRAILS.md) for details.

## UI System

The UI uses global design tokens in `src/index.css` for:

- Dark premium background and panel colors.
- Glass panel surfaces and soft borders.
- Purple, indigo, and blue accent/glow states.
- Shared shadows for floating DAW panels and active controls.
- A laptop-friendly layout target around `1366x768`.

See [docs/UI_DESIGN_SYSTEM.md](docs/UI_DESIGN_SYSTEM.md) for token usage and UI conventions.

## Developer Workflow

Use npm scripts from `package.json`.

```sh
NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck
NODE_OPTIONS=--max-old-space-size=2048 npm run lint
NODE_OPTIONS=--max-old-space-size=2048 npm test
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npm run dev
```

## Current Verification Status

As of the Beginner Mode/WubGuide pass:

- Typecheck passing.
- Lint passing.
- Build passing.
- Test suite passing: 34 files, 155 tests.

## Roadmap

Recommended next phases:

- Responsive resizing and dockable panels.
- Real audio clip editing refinements.
- MIDI piano roll improvements.
- Mixer metering and clipping guidance.
- Stem import/separation.
- Offline WAV/stem rendering polish.
- WubPad remote-control integration.
- Producer memory and AI arrangement later, only after core DAW stability.

## More Documentation

- [WubLabz Studio Status](docs/WUBLABZ_STUDIO_STATUS.md)
- [Architecture Guardrails](docs/ARCHITECTURE_GUARDRAILS.md)
- [UI Design System](docs/UI_DESIGN_SYSTEM.md)
- [Producer Mode](docs/PRODUCER_MODE.md)
- [Mixer Metering](docs/METERING.md)
- [Runtime Architecture](docs/WUBLABZ_RUNTIME_ARCHITECTURE.md)
- [Playback Pipeline](docs/PLAYBACK_PIPELINE.md)
