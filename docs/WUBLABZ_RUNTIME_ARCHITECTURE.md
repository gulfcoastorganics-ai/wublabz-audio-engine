# WubLabz Runtime Architecture

## Core Identity

WubLabz is a local-first AI Producer, AI Remix Engineer, and AI Arrangement Workstation.

It is not a generic text-to-music generator.

## Runtime Flow

```text
Audio File
-> AnalysisSnapshot
-> StemManifest
-> BeatGrid
-> PhraseGrid
-> SectionGrid
-> SongDNA
-> ProducerBrain
-> RemixBlueprint
-> ArrangementReconstructionEngine
-> TimelineEventV2
-> EventScheduler
-> TimelineEventRouter
-> ToneAdapter
-> BusGraph
-> Playback / Export
```

## Runtime Boundaries

- `server.ts` owns HTTP/WebSocket transport only.
- `protocol.ts` owns inbound event validation.
- `RuntimeController` owns orchestration and diagnostics updates.
- `WubLabzEngine` owns playback engine composition.
- `PlaybackTransport` coordinates scheduler and renderer.
- `ToneAdapter` owns Tone rendering primitives.
- `BusGraph` owns audio graph lifecycle and modulation parameter binding.

## Producer Intelligence

Producer Intelligence v1 includes:

- `MotifMemory`
- `PhraseRecall`
- `DropEscalation`
- `RepetitionFatigue`
- `ProducerBrain`

Repeated consecutive fakeouts deterministically suppress the second fakeout into breakdown strategy output without mutating `SongDNA`.

## Diagnostics

Runtime diagnostics track:

- engine state and transport state
- BPM, beat, bar, phrase
- scene state
- scheduled event count
- bus and modulation target counts
- active modulation count
- pending macro count
- route, scheduler, audio, modulation, scene, macro errors
- producer diagnostics

## Current Limitations

- Source classification is still lightweight.
- Stem separation is not implemented as a dedicated worker.
- Route actions for macro/modulation/gain/mute are typed but not all renderer actions are fully materialized.
