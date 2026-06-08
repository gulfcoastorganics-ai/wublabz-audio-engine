import type { TimelineEventV2 } from '../producer/types.js';

const AUDIO_EVENT_TYPES = new Set([
  'stem_clip',
  'drum',
  'bass',
  'lead',
  'synth',
  'vocal',
  'fx'
]);

const NON_OVERLAY_TYPES = new Set(['marker', 'silence']);

export class PlaybackValidator {
  validate(events: TimelineEventV2[]): TimelineEventV2[] {
    const issues = this.findIssues(events);
    if (issues.length) {
      throw new Error(`Playback validation failed: ${issues.join('; ')}`);
    }

    return events;
  }

  findIssues(events: TimelineEventV2[]): string[] {
    const issues: string[] = [];

    events.forEach((event, index) => {
      if (!Number.isFinite(event.startTime) || event.startTime < 0) {
        issues.push(`event[${index}] has invalid startTime`);
      }

      if (!Number.isFinite(event.endTime) || event.endTime <= event.startTime) {
        issues.push(`event[${index}] has invalid duration`);
      }

      if (!event.sectionId) {
        issues.push(`event[${index}] missing sectionId`);
      }

      if (AUDIO_EVENT_TYPES.has(event.type) && !event.stemId && !event.payload?.clipId) {
        issues.push(`event[${index}] missing clip reference`);
      }

      if (event.type === 'transition' || event.type === 'riser' || event.type === 'impact' || event.type === 'fill') {
        const sectionType = typeof event.payload?.sectionType === 'string' ? event.payload.sectionType : undefined;
        if (!sectionType) {
          issues.push(`event[${index}] missing section transition context`);
        }
      }
    });

    for (let leftIndex = 0; leftIndex < events.length; leftIndex += 1) {
      const left = events[leftIndex];
      if (!left) {
        continue;
      }

      for (let rightIndex = leftIndex + 1; rightIndex < events.length; rightIndex += 1) {
        const right = events[rightIndex];
        if (!right) {
          continue;
        }

        if (NON_OVERLAY_TYPES.has(left.type) || NON_OVERLAY_TYPES.has(right.type)) {
          continue;
        }

        if (left.sectionId !== right.sectionId) {
          continue;
        }

        const sameClip = (left.stemId ?? left.payload?.clipId) === (right.stemId ?? right.payload?.clipId);
        if (!sameClip) {
          continue;
        }

        const duplicateTiming = left.startTime === right.startTime && left.endTime === right.endTime;
        const hasSectionContext = typeof left.payload?.sectionType === 'string' || typeof right.payload?.sectionType === 'string';
        if (duplicateTiming && !hasSectionContext) {
          issues.push(`events[${leftIndex}] and events[${rightIndex}] overlap`);
        }
      }
    }

    return issues;
  }
}
