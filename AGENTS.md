# WubLabz Agent Instructions

## Project Identity

WubLabz is a local-first AI Producer, AI Remix Engineer, and AI Arrangement Workstation.

It is not a generic text-to-music generator.

## Core Pipeline

Audio File
→ AnalysisSnapshot
→ StemManifest
→ BeatGrid
→ PhraseGrid
→ SectionGrid
→ SongDNA
→ ProducerBrain
→ RemixBlueprint
→ ArrangementReconstructionEngine
→ TimelineEventV2
→ EventScheduler
→ Playback
→ Export

## Rules

- Keep local-first.
- Keep Gemini optional.
- Do not upload raw audio to Gemini.
- Do not expose API keys.
- Do not break existing UI.
- Do not remove working functionality.
- Use deterministic generation.
- Do not use Math.random for remix generation.
- Use seeded randomness when variation is needed.
- Add tests for every core logic change.
- Run validation after changes.

## Commands

Use available scripts from package.json.

Preferred validation:

npm run typecheck
npm run lint
npm run test
npm run build
npm run validate

If some scripts do not exist, inspect package.json and use the closest available command.

## Priority

1. Fix build/type/test failures.
2. Implement missing core pipeline.
3. Improve architecture.
4. Improve tests.
5. Improve MVP readiness.
