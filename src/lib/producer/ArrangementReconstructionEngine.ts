import type {
  ArrangementReconstructionOptions,
  RemixBlueprint,
  SectionType,
  SongDNA,
  StemManifest,
  TimelineEventV2,
  TimelineEventType
} from './types.js';
import { clamp, createSeededRng, roundTo } from './seeded-rng.js';

const ALLOWED_EVENT_TYPES: TimelineEventType[] = [
  'stem_clip',
  'drum',
  'bass',
  'lead',
  'synth',
  'vocal',
  'fx',
  'transition',
  'silence',
  'marker',
  'riser',
  'impact',
  'fill'
];

export class TimelineValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid timeline events: ${issues.join('; ')}`);
    this.name = 'TimelineValidationError';
  }
}

function secondsPerBeat(songDNA: SongDNA): number {
  return 60 / songDNA.bpm;
}

function beatsPerBar(songDNA: SongDNA): number {
  return songDNA.beatsPerBar || 4;
}

function barToTime(songDNA: SongDNA, bar: number): number {
  return roundTo(bar * beatsPerBar(songDNA) * secondsPerBeat(songDNA));
}

function barToBeat(songDNA: SongDNA, bar: number): number {
  return roundTo(bar * beatsPerBar(songDNA));
}

function findStemId(stemManifest: StemManifest, role: string): string | undefined {
  const stem = stemManifest.stems.find((entry) => entry.enabled && entry.role === role);
  return stem?.id;
}

function eventTypeForRole(role: string, sectionType: SectionType): TimelineEventType {
  if (role === 'drums' || role === 'perc') return 'drum';
  if (role === 'bass') return 'bass';
  if (role === 'fx' || role === 'noise') return 'fx';
  if (sectionType === 'fakeout') return 'silence';
  return 'stem_clip';
}

function createEventId(seed: string, sectionId: string, type: TimelineEventType, role: string, index: number): string {
  return `${seed}:${sectionId}:${type}:${role}:${index}`;
}

function createSectionEvents(
  blueprint: RemixBlueprint,
  songDNA: SongDNA,
  stemManifest: StemManifest,
  sectionIndex: number,
  options: ArrangementReconstructionOptions
): TimelineEventV2[] {
  const section = blueprint.sections[sectionIndex];
  if (!section) {
    return [];
  }

  const rng = createSeededRng(options.seed ?? blueprint.seed, section.id);
  const sectionDurationBars = Math.max(1, section.endBar - section.startBar);
  const events: TimelineEventV2[] = [];
  const sectionStartTime = barToTime(songDNA, section.startBar);
  const sectionEndTime = barToTime(songDNA, section.endBar);
  const sectionStartBeat = barToBeat(songDNA, section.startBar);
  const sectionEndBeat = barToBeat(songDNA, section.endBar);

  const clampBarRange = (preferredStart: number, durationBars: number): { startBar: number; endBar: number } => {
    const maxStartBar = Math.max(section.startBar, section.endBar - 0.25);
    const startBar = roundTo(Math.min(maxStartBar, preferredStart));
    const minimumEndBar = startBar + 0.25;
    const requestedEndBar = startBar + Math.max(0.25, durationBars);
    const endBar = roundTo(Math.max(minimumEndBar, Math.min(section.endBar, requestedEndBar)));

    return {
      startBar,
      endBar
    };
  };

  events.push({
    id: createEventId(blueprint.seed, section.id, 'marker', 'section', 0),
    type: 'marker',
    sourceId: blueprint.id,
    sectionId: section.id,
    startTime: sectionStartTime,
    endTime: roundTo(sectionStartTime + 0.01),
    beatStart: sectionStartBeat,
    beatEnd: roundTo(sectionStartBeat + 0.01),
    barStart: section.startBar,
    barEnd: roundTo(section.startBar + 0.01),
    energyLevel: section.energyLevel,
    enabled: true,
    probability: 1,
    payload: {
      sectionType: section.type,
      motifId: section.motifId,
      label: section.markerLabels[0] ?? section.type
    }
  });

  section.stemInstructions.forEach((instruction, index) => {
    if (!instruction.enabled) {
      return;
    }

    const eventType = eventTypeForRole(instruction.role, section.type);
    const sourceStemId = instruction.sourceStemId ?? findStemId(stemManifest, instruction.role);
    const { startBar, endBar } = clampBarRange(section.startBar + index * 0.25, sectionDurationBars >= 2 ? 1 : 0.5);
    const startTime = barToTime(songDNA, startBar);
    const endTime = Math.max(startTime + 0.01, barToTime(songDNA, endBar));
    const beatStart = barToBeat(songDNA, startBar);
    const beatEnd = Math.max(beatStart + 0.01, barToBeat(songDNA, endBar));

    const event: TimelineEventV2 = {
      id: createEventId(blueprint.seed, section.id, eventType, instruction.role, index),
      type: eventType,
      sourceId: blueprint.id,
      sectionId: section.id,
      startTime,
      endTime,
      beatStart,
      beatEnd,
      barStart: startBar,
      barEnd: endBar,
      energyLevel: roundTo(clamp(section.energyLevel * instruction.intensity, 0.05, 1)),
      enabled: true,
      probability: sourceStemId ? 1 : 0.65,
      payload: {
        sectionType: section.type,
        role: instruction.role,
        motifId: section.motifId,
        placeholder: !sourceStemId,
        targetGenre: options.targetGenre ?? blueprint.targetGenre,
        variation: rng()
      }
    };

    if (sourceStemId) {
      event.stemId = sourceStemId;
    } else if (instruction.placeholderLabel) {
      event.stemId = instruction.placeholderLabel;
    }

    events.push(event);
  });

  section.transitionInstructions.forEach((instruction, index) => {
    const { startBar, endBar } = clampBarRange(section.startBar + instruction.barOffset, instruction.durationBars);
    const startTime = barToTime(songDNA, startBar);
    const endTime = Math.max(startTime + 0.01, barToTime(songDNA, endBar));
    const beatStart = barToBeat(songDNA, startBar);
    const beatEnd = Math.max(beatStart + 0.01, barToBeat(songDNA, endBar));
    const eventType = instruction.type === 'silence' ? 'silence' : instruction.type;

    events.push({
      id: createEventId(blueprint.seed, section.id, eventType, instruction.type, index + 100),
      type: eventType,
      sourceId: blueprint.id,
      sectionId: section.id,
      startTime,
      endTime,
      beatStart,
      beatEnd,
      barStart: startBar,
      barEnd: endBar,
      energyLevel: roundTo(clamp(instruction.intensity, 0.05, 1)),
      enabled: true,
      probability: instruction.probability,
      payload: {
        sectionType: section.type,
        transitionType: instruction.type,
        label: instruction.label,
        motifId: section.motifId
      }
    });
  });

  if (section.type === 'fakeout') {
    const silenceEndBar = roundTo(Math.min(section.endBar, section.startBar + Math.min(1, sectionDurationBars)));
    const silenceEndTime = Math.max(sectionStartTime + 0.01, barToTime(songDNA, silenceEndBar));
    events.push({
      id: createEventId(blueprint.seed, section.id, 'silence', 'fakeout', 999),
      type: 'silence',
      sourceId: blueprint.id,
      sectionId: section.id,
      startTime: sectionStartTime,
      endTime: silenceEndTime,
      beatStart: sectionStartBeat,
      beatEnd: barToBeat(songDNA, silenceEndBar),
      barStart: section.startBar,
      barEnd: silenceEndBar,
      energyLevel: roundTo(section.energyLevel * 0.45),
      enabled: true,
      probability: 1,
      payload: {
        sectionType: section.type,
        role: 'silence',
        motifId: section.motifId,
        fakeout: true
      }
    });
  }

  return events;
}

export function validateTimelineEvents(events: TimelineEventV2[]): TimelineEventV2[] {
  const issues: string[] = [];

  events.forEach((event, index) => {
    if (!event.sectionId) {
      issues.push(`event[${index}] missing sectionId`);
    }

    if (!ALLOWED_EVENT_TYPES.includes(event.type)) {
      issues.push(`event[${index}] has invalid type "${event.type}"`);
    }

    if (!Number.isFinite(event.startTime) || event.startTime < 0) {
      issues.push(`event[${index}] has invalid startTime`);
    }

    if (!Number.isFinite(event.endTime) || event.endTime <= event.startTime) {
      issues.push(`event[${index}] has invalid endTime`);
    }

    if (!Number.isFinite(event.beatStart) || !Number.isFinite(event.beatEnd) || event.beatEnd <= event.beatStart) {
      issues.push(`event[${index}] has invalid beat range`);
    }

    if (!Number.isFinite(event.barStart) || !Number.isFinite(event.barEnd) || event.barEnd <= event.barStart) {
      issues.push(`event[${index}] has invalid bar range`);
    }

    if (!Number.isFinite(event.energyLevel) || event.energyLevel < 0) {
      issues.push(`event[${index}] has invalid energyLevel`);
    }

    if (!Number.isFinite(event.probability) || event.probability < 0 || event.probability > 1) {
      issues.push(`event[${index}] has invalid probability`);
    }
  });

  if (issues.length) {
    throw new TimelineValidationError(issues);
  }

  return events;
}

export class ArrangementReconstructionEngine {
  reconstruct(
    blueprint: RemixBlueprint,
    songDNA: SongDNA,
    stemManifest: StemManifest,
    options: ArrangementReconstructionOptions = {}
  ): TimelineEventV2[] {
    const events = blueprint.sections.flatMap((_, index) =>
      createSectionEvents(blueprint, songDNA, stemManifest, index, options)
    );

    const ordered = events.sort((left, right) =>
      left.startTime === right.startTime ? left.id.localeCompare(right.id) : left.startTime - right.startTime
    );

    return validateTimelineEvents(ordered);
  }
}

