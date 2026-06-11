# Audio Edit Rendering

WubLabz Studio applies clip edits (gain, reverse, fades, normalize) in real time during both live playback and WAV export. All edits are non-destructive — the original audio file is never modified.

## Architecture

Clip edits flow through two separate but consistent paths:

### Live Playback Path

```
ProjectSchema (clip.edit) → projectToTimelineEvents → TimelineEvent payload
  → EventScheduler → TimelineRouter → ToneAdapter.triggerEventPlayback
  → Tone.js Player properties (reverse, fadeIn, fadeOut, volume)
```

The canonical playback pipeline is never altered. Edits are applied by setting native Tone.js Player properties before `player.start()`.

**Canonical pipeline (must never change):**
> TimelineEvent[] → EventScheduler → TimelineRouter → ToneAdapter → BusGraph

### Export (WAV Render) Path

```
ProjectSchema (clip.edit) → OfflineRenderService.mixClipInto
  → clipEditRenderer.renderClipEdits (peaks processing)
  → encodePcm16Wav
```

`OfflineRenderService` uses waveform peak data (Float32Array approximation) rather than actual PCM audio buffers. The `renderClipEdits` function processes these peaks using the same deterministic pipeline as the renderer.

## Processing Pipeline

Edits are applied in this deterministic order:

1. **Normalize** — Scale peaks so the maximum absolute value reaches 1.0. Applied first so gain is measured after normalization.
2. **Gain** — Multiply every sample by the user gain factor.
3. **Reverse** — Flip the sample order. The clip plays back to front.
4. **Fade In** — Linear ramp from 0 to 1 over the specified number of samples.
5. **Fade Out** — Linear ramp from 1 to 0 over the specified number of samples (last sample reaches silence).

## Files

| File | Role |
|------|------|
| `src/audio/rendering/clipRenderTypes.ts` | `RenderedClipBuffer` type, `hashClipEdit`, `makeCacheKey` |
| `src/audio/rendering/clipEditRenderer.ts` | Pure render functions: `applyGain`, `applyNormalize`, `applyReverse`, `applyFadeIn`, `applyFadeOut`, `renderClipEdits` |
| `src/audio/rendering/ClipRenderCache.ts` | Cache keyed by `clipId:assetId:editHash` |
| `src/lib/project/projectTimeline.ts` | Includes `clipEdit` and `normalizedGain` in audio clip event payloads |
| `src/lib/playback/ToneAdapter.ts` | Reads `event.payload.clipEdit` and applies to Player properties |
| `src/lib/audio/offlineRenderService.ts` | Calls `renderClipEdits` in `mixClipInto` for peaks-based export rendering |

## Normalization in Live Playback

For live playback, the normalization gain is **precomputed** in `projectToTimelineEvents` from the asset's waveform peaks:

```typescript
normalizedGain = 1 / Math.max(...asset.waveformPeaks)
```

This value is stored in the event payload as `normalizedGain` and combined with `edit.gain` inside `applyClipEditToPlayer` before setting `player.volume.value`.

This avoids any AudioContext or buffer manipulation at schedule time.

## ClipRenderCache

The cache stores processed `Float32Array` peaks keyed by `${clipId}:${assetId}:${editHash}`. Cache hits avoid re-running the edit pipeline.

- **Invalidation**: Automatic. When the edit changes, the key changes (different hash), naturally producing a cache miss.
- **Manual invalidation**: `cache.invalidate(clipId)` removes all entries for a given clip.

## Guardrails

- **No new AudioContext**: Edit rendering uses Float32Array operations only.
- **No playback side channels**: Edits are applied through existing Player properties, not by creating new audio nodes.
- **No destructive file modification**: Original audio files are never read or written by the edit renderer.
- **Deterministic**: Same inputs always produce the same outputs. This is required for WAV export consistency.

## Tests

- `tests/clipEditRenderer.test.ts` — Pure function tests for each processing step and the full pipeline.
- `tests/clipRenderCache.test.ts` — Cache hits, misses, invalidation, key generation.
- `tests/audioEditPlayback.test.ts` — Integration: timeline event payload, OfflineRenderService PCM amplitude verification, Producer Mode warnings, WubGuide Q&A.
