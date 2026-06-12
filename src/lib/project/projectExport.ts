import type { WubLabzProject } from './projectSchema.js';

export function serializeProjectJson(project: WubLabzProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseProjectJson(json: string): WubLabzProject {
  const parsed = JSON.parse(json) as unknown;
  if (!isProjectLike(parsed)) {
    throw new Error('Invalid WubLabz project JSON.');
  }
  return parsed;
}

function isProjectLike(value: unknown): value is WubLabzProject {
  if (!value || typeof value !== 'object') return false;
  const project = value as Partial<WubLabzProject>;
  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    typeof project.bpm === 'number' &&
    Array.isArray(project.tracks) &&
    Array.isArray(project.audioAssets) &&
    Array.isArray(project.audioClips) &&
    Array.isArray(project.midiClips) &&
    Array.isArray(project.automationLanes) &&
    typeof project.mixerState === 'object'
  );
}
