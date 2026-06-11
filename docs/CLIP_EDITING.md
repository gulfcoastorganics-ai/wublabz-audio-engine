# Clip Editing

WubLabz Studio provides professional clip editing tools for audio clips in the Arrangement view.

## Clip Edit Model

Each audio clip carries an optional `edit` field with the following structure:

```typescript
type AudioClipEdit = {
  gain?: number;           // Clip-level gain multiplier (default 1.0)
  reverse?: boolean;       // Play clip in reverse
  fadeInSeconds?: number;  // Fade-in duration from clip start
  fadeOutSeconds?: number; // Fade-out duration to clip end
  normalized?: boolean;    // Treat clip as normalized to peak level
};
```

The `edit` field is optional. Old projects that predate the clip editing feature load normally with no edit applied (all values default to their neutral state).

## Clip Tools (Context Menu)

Right-click any clip in the Arrangement to open its context menu.

**All clips:**
- **Duplicate** — Copies the clip, placing it immediately after the original. Keyboard shortcut: Ctrl+D / Cmd+D.

**Audio clips only:**
- **Split at Playhead** — Divides the clip at the current playhead position, creating two independent clips. If the playhead is outside the clip, the split defaults to the midpoint.
- **Normalize Clip** — Marks the clip as normalized. The NRM badge appears on the clip block.
- **Reverse Clip** — Toggles playback direction. The REV badge appears on the clip block.
- **Add Fade In** — Sets a short fade-in (0.05 s default). A dark left-edge overlay appears on the clip.
- **Add Fade Out** — Sets a short fade-out (0.05 s default). A dark right-edge overlay appears on the clip.
- **Reset Edits** — Removes all clip edit data, returning the clip to its unedited state.
- **Delete** — Removes the clip from the project.

## Clip Inspector

When an audio clip is selected, the Clip Inspector panel appears at the bottom of the Arrangement view.

The inspector shows:

| Field | Description |
|-------|-------------|
| Name | Clip name (display only) |
| Start | Start time in seconds |
| End | End time in seconds |
| Dur | Duration in seconds |
| Gain | Per-clip gain multiplier (0–4×) |
| Fade In | Fade-in duration in seconds |
| Fade Out | Fade-out duration in seconds |
| Reverse | Toggle to play the clip in reverse |
| Normalize | Toggle to treat the clip as normalized |

All inspector edits update project state only. The audio engine reads these values from `TimelineEvents` during playback.

## Visual Feedback

Clips display indicators when edit properties are active:

- **REV badge** — Clip is set to reverse.
- **NRM badge** — Clip is normalized.
- **G{value} badge** — Clip gain differs from 1.0 (e.g. `G1.50`).
- **Fade-in overlay** — Dark gradient on the left edge of the clip body.
- **Fade-out overlay** — Dark gradient on the right edge of the clip body.
- **Selected clip glow** — Purple glow border when the clip is selected.

## Architecture Note

All clip edits are UI/state-level. They are stored in `project.audioClips[n].edit` and flow into `TimelineEvents` during the project-to-timeline conversion step. The following engine components are not modified by clip editing features:

- `EventScheduler`
- `TimelineRouter`
- `ToneAdapter`
- `BusGraph`
- The canonical `TimelineEvent` playback flow

This preserves deterministic playback behavior while exposing full edit controls to the user.

## Migration

Projects without `edit` fields on audio clips load correctly. The `edit` field is optional, and all its sub-fields default to their neutral values (`gain = 1`, `reverse = false`, `fadeInSeconds = 0`, `fadeOutSeconds = 0`, `normalized = false`) wherever accessed.
