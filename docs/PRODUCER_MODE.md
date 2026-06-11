# WubGuide Producer Mode

Producer Mode is the advanced WubGuide assistant mode for users who already understand the DAW interface.

Beginner Mode teaches where controls are. Producer Mode coaches musical decisions using deterministic project-structure analysis.

## Current Scope

Producer Mode does not connect to an external AI API and does not analyze raw audio.

It reads:

- project BPM
- time signature
- track count
- audio clip count
- MIDI clip count
- clip lengths
- arrangement duration
- whether any track is muted or soloed
- WubGuide progress for saved/exported state

## Suggestions

Suggestions are deterministic and categorized as:

- arrangement
- rhythm
- melody
- bass
- mix
- workflow
- export

Each suggestion has:

- priority
- title
- body
- optional action label
- optional WubGuide highlight target

Clicking a suggestion highlights the relevant studio region.

## Examples

- Empty project: start with a drum loop or MIDI pattern.
- Short arrangement: build an 8-16 bar loop before arranging a full song.
- MIDI-only project: layer audio drums or texture under MIDI.
- Audio-only project: add a MIDI bassline or lead.
- 120-130 BPM: good for house, techno, pop, and dance.
- No mute/solo usage: use mute/solo to isolate mix problems.
- Unsaved project: save before experimenting.
- Not exported: export a WAV test bounce when the loop feels solid.

## Guardrails

Producer Mode is UI guidance only:

- No audio engine architecture changes.
- No raw audio analysis.
- No external AI model calls.
- No Tone scheduling.
- No playback side channels.
