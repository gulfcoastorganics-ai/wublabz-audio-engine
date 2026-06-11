import { describe, expect, it, vi } from 'vitest';
import { createEmptyProject, projectToTimelineEvents } from '../src/lib/project/projectTimeline.js';
import { OfflineRenderService } from '../src/lib/audio/offlineRenderService.js';
import type { AudioClip, WubLabzProject } from '../src/lib/project/projectSchema.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildProject(clipOverrides: Partial<AudioClip> = {}): WubLabzProject {
  const project = createEmptyProject('proj-1', 'Test Project');
  project.tracks = [
    { id: 'track-1', name: 'Drums', type: 'audio', role: 'drums', order: 0, gain: 1, pan: 0, mute: false, solo: false, arm: false },
  ];
  project.audioAssets = [
    { id: 'asset-1', name: 'Drum', fileName: 'drum.wav', mimeType: 'audio/wav', durationSeconds: 1, sampleRate: 44100, channels: 1, waveformPeaks: [0, 0.5, 1.0, 0.5, 0], byteLength: 8, createdAt: '2026-01-01T00:00:00.000Z' },
  ];
  project.audioClips = [
    { id: 'clip-1', type: 'audio', trackId: 'track-1', name: 'Drum', startTime: 0, endTime: 1, clipGain: 1, muted: false, selected: false, assetId: 'asset-1', sourceOffsetSeconds: 0, ...clipOverrides },
  ];
  return project;
}

// ─── projectToTimelineEvents: clipEdit in payload ─────────────────────────────

describe('projectToTimelineEvents includes clipEdit in payload', () => {
  it('includes clipEdit: undefined when clip has no edits', () => {
    const project = buildProject();
    const events = projectToTimelineEvents(project);
    expect(events[0]?.payload).toHaveProperty('clipEdit');
    expect(events[0]?.payload?.clipEdit).toBeUndefined();
  });

  it('includes clipEdit object when clip has edits', () => {
    const project = buildProject({ edit: { gain: 1.5, reverse: true } });
    const events = projectToTimelineEvents(project);
    const clipEdit = events[0]?.payload?.clipEdit as Record<string, unknown>;
    expect(clipEdit?.gain).toBe(1.5);
    expect(clipEdit?.reverse).toBe(true);
  });

  it('includes normalizedGain of 1 when normalize is not active', () => {
    const project = buildProject();
    const events = projectToTimelineEvents(project);
    expect(events[0]?.payload?.normalizedGain).toBe(1);
  });

  it('includes computed normalizedGain when normalize is active', () => {
    // waveformPeaks: [0, 0.5, 1.0, 0.5, 0] → maxPeak = 1.0 → normalizedGain = 1/1.0 = 1.0
    const project = buildProject({ edit: { normalized: true } });
    const events = projectToTimelineEvents(project);
    expect(events[0]?.payload?.normalizedGain).toBeCloseTo(1.0);
  });

  it('computes higher normalizedGain for quiet audio', () => {
    // Set peaks to [0, 0.25, 0.5, 0.25, 0] → max = 0.5 → normalizedGain = 2.0
    const project = buildProject({ edit: { normalized: true } });
    project.audioAssets[0]!.waveformPeaks = [0, 0.25, 0.5, 0.25, 0];
    const events = projectToTimelineEvents(project);
    expect(events[0]?.payload?.normalizedGain).toBeCloseTo(2.0);
  });

  it('normalizedGain is 1 when asset not found', () => {
    const project = buildProject({ assetId: 'missing-asset', edit: { normalized: true } });
    const events = projectToTimelineEvents(project);
    expect(events[0]?.payload?.normalizedGain).toBe(1);
  });
});

// ─── OfflineRenderService: applies clip edits ─────────────────────────────────

describe('OfflineRenderService applies clip edits', () => {
  // Decode 16-bit PCM absolute amplitude sum (skips 44-byte WAV header)
  async function decodeAbsSum(blob: Blob): Promise<number> {
    const buf = await blob.arrayBuffer();
    const view = new DataView(buf, 44);
    let sum = 0;
    for (let i = 0; i + 1 < view.byteLength; i += 2) {
      sum += Math.abs(view.getInt16(i, true));
    }
    return sum;
  }

  it('render with gain < 1 produces smaller PCM values than without', async () => {
    const service = new OfflineRenderService();
    const base = service.renderProject(buildProject());
    const attenuated = service.renderProject(buildProject({ edit: { gain: 0.5 } }));
    expect(await decodeAbsSum(attenuated.master)).toBeLessThan(await decodeAbsSum(base.master));
  });

  it('render with gain > 1 produces larger PCM values', async () => {
    const service = new OfflineRenderService();
    const base = service.renderProject(buildProject());
    const boosted = service.renderProject(buildProject({ edit: { gain: 2 } }));
    expect(await decodeAbsSum(boosted.master)).toBeGreaterThan(await decodeAbsSum(base.master));
  });

  it('render with reverse produces different output than without', async () => {
    const service = new OfflineRenderService();
    // Use asymmetric peaks so reversal produces genuinely different PCM data
    const proj = buildProject();
    proj.audioAssets[0]!.waveformPeaks = [0.1, 0.4, 0.9, 0.6, 0.2];
    const projRev = buildProject({ edit: { reverse: true } });
    projRev.audioAssets[0]!.waveformPeaks = [0.1, 0.4, 0.9, 0.6, 0.2];

    const normal = service.renderProject(proj);
    const reversed = service.renderProject(projRev);

    const normPcm = new Uint8Array(await normal.master.arrayBuffer());
    const revPcm = new Uint8Array(await reversed.master.arrayBuffer());
    expect(normPcm).not.toEqual(revPcm);
  });

  it('render with fade in produces zero energy at the start', async () => {
    const service = new OfflineRenderService();
    // 100% fade in (the entire clip fades in from 0 to 1)
    const faded = service.renderProject(buildProject({ edit: { fadeInSeconds: 1.0 }, startTime: 0, endTime: 1 }));
    const fadedPcm = new Uint8Array(await faded.master.arrayBuffer()).slice(44);

    // Very first samples should be near 0 (faded in from silence)
    const firstFewSamples = Array.from(fadedPcm.slice(0, 16));
    expect(firstFewSamples.every((s) => s === 0 || s === 128 || Math.abs(s - 128) < 4)).toBe(true);
  });

  it('render with normalize boosts quiet audio', async () => {
    const service = new OfflineRenderService();
    const peaks = [0.1, 0.2, 0.1]; // max = 0.2, normalize factor = 5

    const proj = buildProject();
    proj.audioAssets[0]!.waveformPeaks = peaks;
    const base = service.renderProject(proj);

    const projNorm = buildProject({ edit: { normalized: true } });
    projNorm.audioAssets[0]!.waveformPeaks = peaks;
    const normalized = service.renderProject(projNorm);

    // Decode 16-bit PCM to compare true absolute amplitude sums
    const decodeAbsSum = async (blob: Blob): Promise<number> => {
      const buf = await blob.arrayBuffer();
      const view = new DataView(buf, 44); // skip 44-byte WAV header
      let sum = 0;
      for (let i = 0; i + 1 < view.byteLength; i += 2) {
        sum += Math.abs(view.getInt16(i, true));
      }
      return sum;
    };

    const baseAmp = await decodeAbsSum(base.master);
    const normAmp = await decodeAbsSum(normalized.master);
    expect(normAmp).toBeGreaterThan(baseAmp);
  });

  it('two renders with the same edits are deterministic', async () => {
    const service = new OfflineRenderService();
    const edit = { gain: 1.2, reverse: true, fadeInSeconds: 0.1, fadeOutSeconds: 0.1 };
    const first = service.renderProject(buildProject({ edit }));
    const second = service.renderProject(buildProject({ edit }));
    const firstPcm = new Uint8Array(await first.master.arrayBuffer());
    const secondPcm = new Uint8Array(await second.master.arrayBuffer());
    expect(firstPcm).toEqual(secondPcm);
  });
});

// ─── Producer Mode: new edit warnings ────────────────────────────────────────

describe('Producer Mode: normalize + gain and fades exceed duration', () => {
  it('warns about normalize + high gain', async () => {
    const { analyzeProducerProject } = await import('../src/ui/assistant/producerModeEngine.js');
    const { EMPTY_USER_PROGRESS } = await import('../src/ui/assistant/wubGuideProgress.js');
    const project = buildProject({ edit: { normalized: true, gain: 2.0 } });
    const result = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(result.suggestions.map((s) => s.id)).toContain('normalize-gain-headroom');
  });

  it('does not warn when normalized is false even if gain is high', async () => {
    const { analyzeProducerProject } = await import('../src/ui/assistant/producerModeEngine.js');
    const { EMPTY_USER_PROGRESS } = await import('../src/ui/assistant/wubGuideProgress.js');
    const project = buildProject({ edit: { gain: 2.0 } });
    const result = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(result.suggestions.map((s) => s.id)).not.toContain('normalize-gain-headroom');
  });

  it('warns when fades exceed clip duration', async () => {
    const { analyzeProducerProject } = await import('../src/ui/assistant/producerModeEngine.js');
    const { EMPTY_USER_PROGRESS } = await import('../src/ui/assistant/wubGuideProgress.js');
    // clip is 1 second, fades sum to 1.5 seconds
    const project = buildProject({ edit: { fadeInSeconds: 0.8, fadeOutSeconds: 0.7 }, startTime: 0, endTime: 1 });
    const result = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(result.suggestions.map((s) => s.id)).toContain('fades-exceed-duration');
  });

  it('does not warn when fades fit within clip duration', async () => {
    const { analyzeProducerProject } = await import('../src/ui/assistant/producerModeEngine.js');
    const { EMPTY_USER_PROGRESS } = await import('../src/ui/assistant/wubGuideProgress.js');
    const project = buildProject({ edit: { fadeInSeconds: 0.2, fadeOutSeconds: 0.2 }, startTime: 0, endTime: 1 });
    const result = analyzeProducerProject(project, EMPTY_USER_PROGRESS);
    expect(result.suggestions.map((s) => s.id)).not.toContain('fades-exceed-duration');
  });
});

// ─── WubGuide: rendering/editing knowledge ────────────────────────────────────

describe('WubGuide non-destructive editing answers', () => {
  it('answers what reverse does', async () => {
    const { answerWubGuidePrompt } = await import('../src/ui/assistant/wubGuideKnowledge.js');
    const res = answerWubGuidePrompt('What does reverse do?');
    expect(res.id).toBe('reverse-mechanics');
  });

  it('answers whether normalize changes the file', async () => {
    const { answerWubGuidePrompt } = await import('../src/ui/assistant/wubGuideKnowledge.js');
    const res = answerWubGuidePrompt('Does normalize change my file?');
    expect(res.id).toBe('normalize-nondestructive');
  });

  it('answers what destructive editing is', async () => {
    const { answerWubGuidePrompt } = await import('../src/ui/assistant/wubGuideKnowledge.js');
    const res = answerWubGuidePrompt('What is destructive editing?');
    expect(res.id).toBe('destructive-editing');
  });

  it('answers whether edits are permanent', async () => {
    const { answerWubGuidePrompt } = await import('../src/ui/assistant/wubGuideKnowledge.js');
    const res = answerWubGuidePrompt('Are my edits permanent?');
    expect(res.id).toBe('edits-permanent');
  });
});
