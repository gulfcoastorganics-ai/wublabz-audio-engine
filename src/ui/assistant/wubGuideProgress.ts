export type UserProgress = {
  importedAudio: boolean;
  createdTrack: boolean;
  createdClip: boolean;
  openedPianoRoll: boolean;
  openedMixer: boolean;
  savedProject: boolean;
  exportedAudio: boolean;
};

export type WubGuideProgressKey = keyof UserProgress;

export type WubGuideMilestone = {
  id: WubGuideProgressKey;
  label: string;
};

export const WUB_GUIDE_PROGRESS_STORAGE_KEY = 'wublabz:wubguide:progress:v1';

export const EMPTY_USER_PROGRESS: UserProgress = {
  importedAudio: false,
  createdTrack: false,
  createdClip: false,
  openedPianoRoll: false,
  openedMixer: false,
  savedProject: false,
  exportedAudio: false,
};

export const WUB_GUIDE_MILESTONES: WubGuideMilestone[] = [
  { id: 'importedAudio', label: 'Import Audio' },
  { id: 'createdTrack', label: 'Create Track' },
  { id: 'createdClip', label: 'Create Clip' },
  { id: 'openedPianoRoll', label: 'Piano Roll' },
  { id: 'openedMixer', label: 'Mixer' },
  { id: 'savedProject', label: 'Save' },
  { id: 'exportedAudio', label: 'Export' },
];

function isProgressKey(key: string): key is WubGuideProgressKey {
  return key in EMPTY_USER_PROGRESS;
}

export function normalizeUserProgress(value: unknown): UserProgress {
  if (!value || typeof value !== 'object') return { ...EMPTY_USER_PROGRESS };
  const source = value as Record<string, unknown>;
  const progress = { ...EMPTY_USER_PROGRESS };
  for (const key of Object.keys(source)) {
    if (isProgressKey(key)) progress[key] = source[key] === true;
  }
  return progress;
}

export function loadWubGuideProgress(storage: Storage | undefined = globalThis.localStorage): UserProgress {
  if (!storage) return { ...EMPTY_USER_PROGRESS };
  try {
    const raw = storage.getItem(WUB_GUIDE_PROGRESS_STORAGE_KEY);
    return raw ? normalizeUserProgress(JSON.parse(raw)) : { ...EMPTY_USER_PROGRESS };
  } catch {
    return { ...EMPTY_USER_PROGRESS };
  }
}

export function saveWubGuideProgress(
  progress: UserProgress,
  storage: Storage | undefined = globalThis.localStorage
): void {
  if (!storage) return;
  try {
    storage.setItem(WUB_GUIDE_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage quota/privacy failures; guide state remains in memory.
  }
}

export function mergeUserProgress(progress: UserProgress, patch: Partial<UserProgress>): UserProgress {
  return { ...progress, ...patch };
}
