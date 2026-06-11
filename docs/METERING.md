# Mixer Metering

WubLabz Studio uses a read-only meter layer to make the mixer feel alive without changing playback architecture.

## Design Goals

- Keep metering deterministic.
- Observe existing audio flow only.
- Avoid direct destination routing.
- Avoid any new Tone scheduling or AudioContext usage.
- Keep the UI responsive at laptop sizes.

## Current Architecture

Metering uses a lightweight registry in `src/audio/metering/`:

- `MeterRegistry` stores per-channel and master levels.
- `useMeterLevels` exposes the current meter snapshot to React components.
- The mixer feeds the registry from existing project state and existing `BusGraph` meter reads.
- If bus-level data is unavailable, the system falls back to deterministic project/playhead-based simulation.

## Visual Rules

- Green indicates healthy signal.
- Yellow indicates strong signal and approaching headroom limits.
- Red indicates clipping.
- The meter peak-hold line should decay smoothly.
- Inactive channels should fall back to zero rather than stay frozen.

## Producer Mode Integration

Producer Mode may surface meter-aware mix suggestions such as:

- lower gain on clipping channels
- no audible signal detected yet
- give the master more headroom

## Beginner Mode Integration

WubGuide can answer beginner questions about meters, clipping, and headroom and highlight the mixer panel when needed.

## Future Path

The registry is intentionally structured so real audio-node metering can replace the simulated fallback later without changing the UI contract.
