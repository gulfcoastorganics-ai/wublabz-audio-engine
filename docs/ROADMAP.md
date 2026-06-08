# Roadmap

## Public Alpha Priorities

1. Keep the deterministic playback path green.
2. Finish renderer support for typed route actions.
3. Add full runtime pipeline loading from generated `TimelineEventV2[]`.
4. Harden worker lifecycle cleanup tests.
5. Improve source classification without uploading raw audio.

## Playback Backbone

Completed:

- deterministic `TimelineEventV2` creation
- scheduler validation, deduplication, ordering, and cleanup helpers
- typed `TimelineEventRouter`
- ToneAdapter direct-destination bypass removed
- BusGraph lifecycle helpers
- protocol validation before runtime dispatch

Next:

- make `TimelineEventRouter` the single source for every rendered Tone action
- materialize `stemMute`, `gainChange`, `macro`, and `modulation` route actions in the renderer where musically appropriate
- add loaded timeline ingestion to `RuntimeController`

## Workers

Completed:

- decode worker
- waveform worker
- analysis worker

Next:

- worker lifecycle cleanup tests
- optional stem worker scaffold
- non-blocking progress diagnostics for analysis jobs

## Producer Intelligence

Completed:

- motif memory
- phrase recall
- drop escalation
- repetition fatigue
- deterministic fakeout suppression

Next:

- target-genre-specific callback motif suffixing
- richer phrase recall roles
- producer diagnostics history snapshots
