# Playback Audit

Date: 2026-06-08

## Scope

This audit covers the current deterministic playback backbone:

`SongDNA -> ProducerBrain -> RemixBlueprintGenerator -> ArrangementReconstructionEngine -> TimelineEventV2[] -> EventScheduler -> ToneAdapter -> BusGraph`

It also reviews runtime entrypoints, diagnostics, worker files, and known side paths that must not become public-alpha playback behavior.

## Current Event Creation

`TimelineEventV2` is defined in `src/lib/producer/types.ts`.

`TimelineEventV2[]` is created by `src/lib/producer/ArrangementReconstructionEngine.ts`.

The reconstruction engine currently emits:

- `marker` section start events
- stem role events: `stem_clip`, `drum`, `bass`, `fx`, and related stem event types
- transition events: `transition`, `riser`, `impact`, `fill`
- `silence` events for fakeouts

The core deterministic path is covered in `tests/wublabz-harness.test.ts`:

`AnalysisSnapshot -> SongDNAExtractor -> ProducerBrain -> RemixBlueprintGenerator -> ArrangementReconstructionEngine -> EventScheduler`

## Current Scheduling

`src/lib/playback/EventScheduler.ts` validates events, deduplicates by event identity, sorts deterministically by `startTime` then `id`, and forwards scheduled events to `ToneJsAdapter` when an adapter is provided.

Current strengths:

- accepts `TimelineEventV2[]`
- validates event shape through `validateTimelineEvents`
- deterministic ordering
- deterministic deduplication
- adapter schedule clearing before reschedule
- safe `seekRecovery(positionSeconds)` filtering by future `endTime`

Current gaps:

- no explicit scheduler transport state
- no scheduler-level `play`, `pause`, `stop`, `seek`, `dispose`, or `emergencyStop`
- no scheduler-owned timer tracking because timer ownership currently lives in `ToneJsAdapter`
- no explicit `getScheduledEventCount()` or `getTransportState()` helpers

## Current Routing

There is no standalone `TimelineEventRouter` module.

Routing is currently split across:

- `src/lib/playback/EventPlaybackStrategy.ts`
- `src/lib/playback/ToneAdapter.ts`
- `src/lib/playback/PlaybackTransport.ts`

`EventPlaybackStrategy` maps events into abstract playback instructions. `ToneAdapter` separately classifies events into `trigger`, `fade`, `marker`, or `noop` commands and schedules Tone transport callbacks. `PlaybackTransport` also resolves event bus names for graph connection bookkeeping.

Current gap:

- the target canonical layer `TimelineEventRouter` is missing, so routing concerns are not isolated or directly testable.

## Current Tone/WebAudio Boundaries

Allowed Tone/WebAudio boundary files:

- `src/lib/playback/ToneAdapter.ts`
- `src/lib/audio/BusGraph.ts`

`src/wublabz/server.ts` does not import or directly touch Tone/WebAudio.

`src/wublabz/runtimeController.ts` does not import or directly touch Tone/WebAudio.

Direct Tone/WebAudio findings:

- `ToneAdapter.ts` imports `tone`, owns Tone runtime scheduling, owns `Tone.Player`, and should remain the rendering boundary.
- `BusGraph.ts` owns Tone node graph creation and modulation parameter binding.
- `BusGraph.ts` uses broad Tone-like object typing at the adapter boundary.

Current public-alpha gap:

- `ToneAdapter.triggerEventPlayback()` falls back to `player.toDestination()` when no `BusGraph` is set. That bypasses the canonical bus graph and should be removed or converted to a dropped/no-op playback result.

## Current BusGraph

`src/lib/audio/BusGraph.ts` owns the physical audio graph.

Current named buses:

- `master`
- `drum`
- `bass`
- `melody`
- `vocal`
- `fx`
- `preview`
- `render`

Target public-alpha names include `drums`, `bass`, `music`, `vocals`, `fx`, and `master`. Current implementation uses singular/internal names (`drum`, `melody`, `vocal`) aligned with existing `AudioBusName` and event mapping.

Current strengths:

- idempotent `initialize()` guard through `ready`
- central master effects chain
- emergency stop mutes input buses and cancels automation
- exposes `getRegisteredModulationTargetCount()`

Current gaps:

- no `getRegisteredBusCount()`
- no explicit `reset()` method
- no explicit `dispose()` method clearing node references
- broad `any` is present at the Tone boundary

## Current Runtime Integration

`src/wublabz/runtimeController.ts` delegates:

- transport control to `WubLabzEngine`
- modulation to `ModulationAdapter`
- performance macros to `performanceMacros`
- scenes to `SceneScheduler`
- emergency stop to engine, modulation reset, scene stop, and macro cancellation

Current strengths:

- `PLAY` and `SEEK` require a loaded timeline
- `STOP`, `RESET`, and `PAUSE` are allowed without a timeline
- `EMERGENCY_STOP` is ungated
- no direct Tone/WebAudio access
- protocol validation happens before runtime dispatch in `src/wublabz/protocol.ts`

Current gaps:

- runtime diagnostics do not yet report pending macro count
- diagnostics do not include `lastRouteError`
- diagnostics do not include registered modulation target count

## Current Timer Paths

Allowed current timer paths:

- `ToneAdapter` uses `Tone.Transport.scheduleOnce()` for playback scheduling.
- `ToneAdapter` uses bounded `setTimeout()` for player cleanup and clears those timers on stop/clear/dispose paths.
- `performanceMacros` uses bounded `setTimeout()` for quantized macro execution and fakeout restore; emergency stop clears pending macros.
- WubPad integration uses heartbeat/reconnect intervals outside the audio scheduling path.

Current gap:

- scheduler-level timer ownership is not explicit because Tone scheduling is owned by `ToneAdapter`.

## Current Worker Files

Existing worker files:

- `src/lib/audio/audioDecode.worker.ts`
- `src/lib/audio/waveform.worker.ts`
- `src/lib/audio/analysis.worker.ts`

No `stem.worker.ts` currently exists.

Worker flow needs separate lifecycle documentation and cleanup tests before public alpha.

## Pseudo/No-op Paths

Known intentional no-op or placeholder behavior:

- `silence` events become no-op playback commands.
- `marker` events do not render sound.
- placeholder stem events can be emitted when source stems are unavailable.
- `WubLabzEngine.setBusGain()` is currently a TODO and does not map bus names yet.
- `ArrangementPreviewEngine` is a lightweight preview orchestration helper, not the canonical runtime renderer.

## Safe Next Patch Set

Recommended safe order:

1. Add `TimelineEventRouter` as an additive typed routing layer with tests.
2. Wire diagnostics for route errors without changing playback behavior.
3. Add scheduler state/helper methods and emergency clear semantics without moving Tone timer ownership yet.
4. Remove `ToneAdapter` direct destination fallback so playback never bypasses `BusGraph`.
5. Add BusGraph lifecycle helpers and tests.
6. Update runtime diagnostics for pending macro count, bus count, modulation target count, and route error.
