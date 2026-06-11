# Architecture Guardrails

## Canonical Playback Path

Playback must remain on this path:

```text
TimelineEvent[]
-> EventScheduler
-> TimelineRouter
-> ToneAdapter
-> BusGraph
```

The concrete event type may be `TimelineEventV2[]` in current runtime modules, but the architectural boundary is the same: timeline events are scheduled, routed, rendered through the Tone adapter, and connected through the bus graph.

## Non-Negotiable Rules

- No direct Tone.js scheduling outside `ToneAdapter`.
- No rogue `AudioContext` creation outside the approved audio boundary.
- No side-channel playback from UI components, server handlers, macros, WubPad routes, preview helpers, or diagnostics.
- No direct destination output that bypasses `BusGraph`.
- No hidden playback timers that compete with `EventScheduler` and `ToneAdapter`.
- Metering may observe existing bus output, but it must remain read-only and cannot create new playback paths.
- No raw-audio upload to Gemini or any remote AI provider.
- No API keys in source, logs, docs examples, or client-exposed state.

## Layer Ownership

### TimelineEvent[]

Timeline events are the deterministic playback contract. Higher-level producer, remix, arrangement, and project systems may produce or transform events, but they should not render sound directly.

### EventScheduler

`EventScheduler` owns validation, ordering, deduplication, schedule clearing, and handoff to the rendering path. Scheduler behavior must remain deterministic.

### TimelineRouter

`TimelineRouter` maps timeline events into typed playback actions. It is the isolation layer between musical event semantics and rendering implementation details.

### ToneAdapter

`ToneAdapter` is the Tone.js scheduling boundary. Tone transport callbacks, Tone players, and render primitive scheduling belong here. If a feature needs Tone scheduling, route the request through timeline events and the adapter.

### BusGraph

`BusGraph` owns the physical audio graph, named buses, effects chain, master output path, lifecycle reset/dispose behavior, and modulation parameter binding.

### Metering

The meter registry is a visual consumer of existing playback state. It may read bus levels or deterministic project/playhead state, but it must not route audio, schedule playback, or replace the canonical playback path.

## Disallowed Patterns

Do not add code like:

```ts
Tone.Transport.scheduleOnce(...)
```

outside `ToneAdapter`.

Do not add code like:

```ts
new AudioContext()
```

inside UI components, server handlers, store actions, or feature helpers.

Do not route audio directly to destination:

```ts
player.toDestination()
```

when the sound should be part of public playback. Public playback must flow through `BusGraph`.

## UI Boundary

UI components may:

- Display project, transport, mixer, browser, and piano-roll state.
- Dispatch store/controller actions.
- Provide editing affordances.
- Show diagnostics and status.

UI components must not:

- Schedule audio.
- Instantiate Tone/WebAudio nodes.
- Start independent playback timers for audio.
- Mutate persistence contracts to satisfy visual needs.

## Local-First and Optional AI

WubLabz remains local-first:

- Local audio stays local.
- Gemini and other AI providers must remain optional.
- Raw audio must not be uploaded to Gemini.
- AI arrangement and producer memory should come after core DAW stability.

## Determinism

Core remix and arrangement generation must remain deterministic:

- Do not use `Math.random` for remix generation.
- Use seeded randomness when variation is needed.
- Add tests for every core logic change.

## Validation Expectations

Before merging runtime or architecture changes, run:

```sh
NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck
NODE_OPTIONS=--max-old-space-size=2048 npm run lint
NODE_OPTIONS=--max-old-space-size=2048 npm test
NODE_OPTIONS=--max-old-space-size=2048 npm run build
```
