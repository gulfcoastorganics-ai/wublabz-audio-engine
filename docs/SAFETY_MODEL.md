# Safety Model

## Determinism

Producer and arrangement generation must remain deterministic.

Allowed:

- explicit seeds
- stable hashing
- deterministic ordering by time and ID

Forbidden:

- `Math.random()` in remix, arrangement, routing, or playback scheduling logic
- mutation of `SongDNA` input
- runtime AI decisions during playback

## Playback Safety

All playback must pass through:

```text
TimelineEventV2[] -> EventScheduler -> TimelineEventRouter -> ToneAdapter -> BusGraph
```

Forbidden:

- direct sound scheduling from UI components
- direct sound scheduling from `server.ts`
- direct Tone/WebAudio access from `RuntimeController`
- `Tone.Player.toDestination()` fallback bypasses
- unbounded timers
- worker-owned playback state

## Emergency Stop Cascade

Emergency stop must:

- clear playback transport scheduling
- stop Tone transport through the adapter path
- cancel pending performance macros
- reset modulation state
- clear scene state
- silence `BusGraph`
- update diagnostics with `emergencyStopped: true`

## Protocol Safety

`src/wublabz/protocol.ts` validates inbound events before runtime dispatch.

Malformed events return deterministic `EVENT_REJECTED` responses and must not reach `RuntimeController`.

## Diagnostics Safety

Diagnostics must be JSON-serializable.

Diagnostics must never include:

- `AudioContext`
- `AudioNode`
- `AudioParam`
- Tone objects
- `AudioBuffer`
- `File`
- functions
