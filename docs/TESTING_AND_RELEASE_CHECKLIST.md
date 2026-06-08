# Testing And Release Checklist

## Required Commands

Run before every public-alpha commit:

```bash
npm run typecheck
npm run test
npm run build
```

If present and meaningful for the current change, also run:

```bash
npm run lint
npm run validate
```

## Repository Hygiene

Verify prohibited files are not tracked:

```bash
git ls-files | grep -E "node_modules|dist|\.codex|\.gemini|\.config|\.cache|\.npm|\.local|\.env|\.pdf|wublabz marketing"
```

Expected result: no prohibited tracked files.

`vitest.config.ts` can be a false positive for loose `.config` regexes. The prohibited path is `.config/`, not `vitest.config.ts`.

## Runtime Safety Checks

- `EMERGENCY_STOP` works before readiness.
- `STOP`, `RESET`, and `PAUSE` are allowed without a timeline.
- `PLAY` and `SEEK` reject without a timeline.
- malformed WebSocket events are rejected before runtime dispatch.
- no direct Tone/WebAudio access in `server.ts` or `RuntimeController`.
- no direct destination fallback in `ToneAdapter`.

## Producer Checks

- no `Math.random()` in producer/remix logic
- no `SongDNA` mutation
- repeated fakeout suppression remains deterministic
- `MotifMemory` public getters return defensive clones
- producer diagnostics remain serializable

## Playback Checks

- `TimelineEventRouter` safely no-ops unsupported metadata
- scheduler deduplicates and orders deterministically
- stop/seek/emergency clear pending adapter schedules
- BusGraph init is idempotent
- BusGraph emergency stop silences buses
