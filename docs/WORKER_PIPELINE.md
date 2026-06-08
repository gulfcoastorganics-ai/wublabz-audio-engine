# Worker Pipeline

## Existing Workers

WubLabz currently has three Node worker-thread entrypoints:

- `src/lib/audio/audioDecode.worker.ts`
- `src/lib/audio/waveform.worker.ts`
- `src/lib/audio/analysis.worker.ts`

There is no `stem.worker.ts` yet.

## Decode Worker

`audioDecode.worker.ts` accepts:

```ts
{
  input: {
    bytes: Uint8Array;
    sourcePath: string;
  }
}
```

It returns an `AudioDecodeResult` from `decodeAudioInline()`.

Missing input returns:

```ts
{ error: 'Missing audio decode input.' }
```

## Waveform Worker

`waveform.worker.ts` accepts decoded channel data and sample rate, mixes to mono, and computes waveform peaks.

It returns `WaveformPeak[]`.

Missing input returns:

```ts
{ error: 'Missing waveform input.' }
```

## Analysis Worker

`analysis.worker.ts` accepts raw audio bytes and a source path. It runs `AnalysisEngine` with `useWorkers: false` to prevent recursive worker spawning.

It returns an `AudioIngestionSnapshot`.

Missing input returns:

```ts
{ error: 'Missing analysis input.' }
```

## Lifecycle Expectations

- Workers must not own playback state.
- Workers must not create Tone/WebAudio nodes.
- Workers must post only serializable data.
- Worker callers must terminate workers after completion or failure.
- Analysis workers must not upload raw audio to Gemini or any remote API.

## Current Limitations

- Worker handlers are exported and testable, but lifecycle cleanup tests for actual `Worker` instances are still roadmap.
- Stem separation is not workerized yet.
- Full DSP offload should remain additive; do not rewrite the playback pipeline to add workerization.
