import { describe, expect, it, beforeEach, vi } from 'vitest';
import { createEmptyProject } from '../src/lib/project/projectTimeline.js';
import type { AudioClip, AudioClipEdit, WubLabzProject } from '../src/lib/project/projectSchema.js';
import { answerWubGuidePrompt } from '../src/ui/assistant/wubGuideKnowledge.js';
import { analyzeProducerProject } from '../src/ui/assistant/producerModeEngine.js';
import { EMPTY_USER_PROGRESS } from '../src/ui/assistant/wubGuideProgress.js';
import { useStudioStore, studioController } from '../src/state/useStudioStore.js';

// Prevent Tone.js scheduling from running during unit tests
vi.spyOn(studioController, 'setProject').mockImplementation(() => {});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeAudioClip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    type: 'audio',
    trackId: 'track-1',
    name: 'Test Clip',
    startTime: 0,
    endTime: 4,
    clipGain: 1,
    muted: false,
    selected: false,
    assetId: 'asset-1',
    sourceOffsetSeconds: 0,
    ...overrides,
  };
}

function makeProject(clips: AudioClip[]): WubLabzProject {
  const base = createEmptyProject('test', 'Test');
  return { ...base, audioClips: clips };
}

// ─── Schema / migration ───────────────────────────────────────────────────────

describe('AudioClipEdit schema defaults', () => {
  it('old clips without edit field satisfy the schema (optional field)', () => {
    const clip = makeAudioClip('clip-1');
    expect(clip.edit).toBeUndefined();
    // Reading through defaults is safe
    expect(clip.edit?.gain).toBeUndefined();
    expect(clip.edit?.reverse).toBeUndefined();
    expect(clip.edit?.fadeInSeconds).toBeUndefined();
    expect(clip.edit?.fadeOutSeconds).toBeUndefined();
    expect(clip.edit?.normalized).toBeUndefined();
  });

  it('accepts a fully populated edit object', () => {
    const edit: AudioClipEdit = {
      gain: 1.5,
      reverse: true,
      fadeInSeconds: 0.1,
      fadeOutSeconds: 0.2,
      normalized: true,
    };
    const clip = makeAudioClip('clip-2', { edit });
    expect(clip.edit?.gain).toBe(1.5);
    expect(clip.edit?.reverse).toBe(true);
    expect(clip.edit?.fadeInSeconds).toBe(0.1);
    expect(clip.edit?.fadeOutSeconds).toBe(0.2);
    expect(clip.edit?.normalized).toBe(true);
  });

  it('accepts a partial edit object', () => {
    const edit: AudioClipEdit = { gain: 0.8 };
    const clip = makeAudioClip('clip-3', { edit });
    expect(clip.edit?.gain).toBe(0.8);
    expect(clip.edit?.reverse).toBeUndefined();
  });

  it('project with mixed edited/unedited clips loads correctly', () => {
    const project = makeProject([
      makeAudioClip('clip-a'),
      makeAudioClip('clip-b', { edit: { reverse: true } }),
    ]);
    expect(project.audioClips[0]!.edit).toBeUndefined();
    expect(project.audioClips[1]!.edit?.reverse).toBe(true);
  });
});

// ─── Store actions ────────────────────────────────────────────────────────────

describe('updateClipEdit store action', () => {
  beforeEach(() => {
    const project = makeProject([makeAudioClip('clip-1')]);
    useStudioStore.setState({ project, selectedClipId: null });
  });

  it('applies gain edit', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { gain: 1.5 });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.gain).toBe(1.5);
  });

  it('applies reverse toggle', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { reverse: true });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.reverse).toBe(true);
  });

  it('applies fade in', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { fadeInSeconds: 0.1 });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.fadeInSeconds).toBe(0.1);
  });

  it('applies fade out', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { fadeOutSeconds: 0.15 });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.fadeOutSeconds).toBe(0.15);
  });

  it('applies normalized flag', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { normalized: true });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.normalized).toBe(true);
  });

  it('merges partial edits without overwriting existing fields', () => {
    useStudioStore.getState().updateClipEdit('clip-1', { gain: 1.2, reverse: true });
    useStudioStore.getState().updateClipEdit('clip-1', { fadeInSeconds: 0.05 });
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit?.gain).toBe(1.2);
    expect(clip?.edit?.reverse).toBe(true);
    expect(clip?.edit?.fadeInSeconds).toBe(0.05);
  });

  it('leaves other clips unchanged', () => {
    const project = makeProject([makeAudioClip('clip-1'), makeAudioClip('clip-2')]);
    useStudioStore.setState({ project });
    useStudioStore.getState().updateClipEdit('clip-1', { gain: 2 });
    const clip2 = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-2');
    expect(clip2?.edit).toBeUndefined();
  });
});

describe('resetClipEdits store action', () => {
  it('clears edit data from the target clip', () => {
    const project = makeProject([makeAudioClip('clip-1', { edit: { gain: 1.5, reverse: true } })]);
    useStudioStore.setState({ project });
    useStudioStore.getState().resetClipEdits('clip-1');
    const clip = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-1');
    expect(clip?.edit).toBeUndefined();
  });

  it('leaves other clips unchanged', () => {
    const project = makeProject([
      makeAudioClip('clip-1', { edit: { gain: 1.5 } }),
      makeAudioClip('clip-2', { edit: { reverse: true } }),
    ]);
    useStudioStore.setState({ project });
    useStudioStore.getState().resetClipEdits('clip-1');
    const clip2 = useStudioStore.getState().project.audioClips.find((c) => c.id === 'clip-2');
    expect(clip2?.edit?.reverse).toBe(true);
  });
});

describe('splitClip at playhead', () => {
  it('splits at playhead when playhead is inside the clip', () => {
    const project = makeProject([makeAudioClip('clip-1', { startTime: 0, endTime: 10 })]);
    useStudioStore.setState({ project, position: 4 });
    useStudioStore.getState().splitClip('clip-1');
    const clips = useStudioStore.getState().project.audioClips;
    expect(clips).toHaveLength(2);
    const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
    expect(sorted[0]!.endTime).toBe(4);
    expect(sorted[1]!.startTime).toBe(4);
  });

  it('splits at midpoint when playhead is outside the clip', () => {
    const project = makeProject([makeAudioClip('clip-1', { startTime: 0, endTime: 10 })]);
    useStudioStore.setState({ project, position: 20 }); // outside clip
    useStudioStore.getState().splitClip('clip-1');
    const clips = useStudioStore.getState().project.audioClips;
    const sorted = [...clips].sort((a, b) => a.startTime - b.startTime);
    expect(sorted[0]!.endTime).toBe(5); // midpoint
    expect(sorted[1]!.startTime).toBe(5);
  });

  it('preserves edit data on both halves', () => {
    const project = makeProject([
      makeAudioClip('clip-1', { startTime: 0, endTime: 10, edit: { reverse: true, fadeInSeconds: 0.1 } }),
    ]);
    useStudioStore.setState({ project, position: 5 });
    useStudioStore.getState().splitClip('clip-1');
    const clips = useStudioStore.getState().project.audioClips;
    expect(clips.every((c) => c.edit?.reverse === true)).toBe(true);
  });
});

// ─── WubGuide clip editing answers ───────────────────────────────────────────

describe('WubGuide clip editing Q&A', () => {
  it('answers how to split a clip', () => {
    const res = answerWubGuidePrompt('How do I split a clip?');
    expect(res.id).toBe('split-clip');
    expect(res.title).toBe('Split a Clip');
    expect(res.highlightTarget).toBe('clip');
  });

  it('answers how to fade a clip', () => {
    const res = answerWubGuidePrompt('How do I fade a clip?');
    expect(res.id).toBe('fade-clip');
    expect(res.highlightTarget).toBe('clip');
  });

  it('answers what normalize means', () => {
    const res = answerWubGuidePrompt('What does normalize mean?');
    expect(res.id).toBe('normalize');
    expect(res.title).toBe('What Does Normalize Mean?');
  });

  it('answers how to reverse audio', () => {
    const res = answerWubGuidePrompt('How do I reverse audio?');
    expect(res.id).toBe('reverse-audio');
    expect(res.highlightTarget).toBe('clip');
  });

  it('answers how to duplicate a clip', () => {
    const res = answerWubGuidePrompt('How do I duplicate a clip?');
    expect(res.id).toBe('duplicate-clip');
    expect(res.steps).toBeDefined();
    expect(res.steps!.some((s) => s.includes('Ctrl+D'))).toBe(true);
  });

  it('answers add fade in question', () => {
    const res = answerWubGuidePrompt('Add fade in');
    expect(res.id).toBe('fade-clip');
  });

  it('answers reverse clip question', () => {
    const res = answerWubGuidePrompt('How do I play backwards?');
    expect(res.id).toBe('reverse-audio');
  });
});

// ─── Producer Mode clip editing suggestions ───────────────────────────────────

describe('Producer Mode clip editing suggestions', () => {
  it('suggests adding fades when audio clips have no fades', () => {
    const project = makeProject([makeAudioClip('clip-1'), makeAudioClip('clip-2')]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).toContain('add-clip-fades');
  });

  it('does not suggest fades when all clips have fades', () => {
    const project = makeProject([
      makeAudioClip('clip-1', { edit: { fadeInSeconds: 0.05, fadeOutSeconds: 0.05 } }),
    ]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).not.toContain('add-clip-fades');
  });

  it('suggests lowering gain when clip gain is too high', () => {
    const project = makeProject([makeAudioClip('clip-1', { edit: { gain: 2.0 } })]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).toContain('lower-clip-gain');
  });

  it('does not suggest lowering gain when clip gain is normal', () => {
    const project = makeProject([makeAudioClip('clip-1', { edit: { gain: 1.0 } })]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).not.toContain('lower-clip-gain');
  });

  it('suggests variation workflow when same asset is used multiple times', () => {
    const project = makeProject([
      makeAudioClip('clip-1', { assetId: 'asset-1' }),
      makeAudioClip('clip-2', { assetId: 'asset-1' }),
    ]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).toContain('duplicate-variation');
  });

  it('suggests selecting a clip when no clips are selected', () => {
    const project = makeProject([makeAudioClip('clip-1', { selected: false })]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).toContain('select-clip-to-edit');
  });

  it('does not suggest selecting a clip when one is selected', () => {
    const project = makeProject([makeAudioClip('clip-1', { selected: true })]);
    const analysis = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).not.toContain('select-clip-to-edit');
  });

  it('does not suggest clip editing when there are no audio clips', () => {
    const base = createEmptyProject('empty', 'Empty');
    const analysis = analyzeProducerProject(base, EMPTY_USER_PROGRESS);
    expect(analysis.suggestions.map((s) => s.id)).not.toContain('add-clip-fades');
    expect(analysis.suggestions.map((s) => s.id)).not.toContain('lower-clip-gain');
  });
});
