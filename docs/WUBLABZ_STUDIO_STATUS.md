# WubLabz Studio Status

## Product State

WubLabz Studio is now a functional browser DAW foundation. It provides the main production surface expected from the MVP studio experience while keeping the core architecture local-first and deterministic.

Current UI modules include:

- Transport
- Browser
- Arrangement view
- Mixer
- Piano roll
- App shell view switcher
- Beginner Mode and WubGuide AI assistant
- WubGuide Producer Mode

The current visual pass added premium glassmorphism UI polish only. Runtime behavior, playback scheduling, Tone rendering, BusGraph routing, project persistence contracts, and export logic were intentionally left unchanged.

## Beginner Mode and WubGuide AI

Beginner Mode is a guided UX/help layer for learning the studio. It is not a playback feature and does not alter engine behavior.

Current WubGuide behavior:

- Local deterministic assistant only.
- No external AI API yet.
- No raw audio upload.
- Keyword/rule-based responses for common beginner questions.
- Deterministic action workflows for opening panels, focusing controls, creating starter tracks, and creating starter MIDI clip placeholders.
- Context-aware onboarding that tracks imported audio, created tracks, clips, Piano Roll use, Mixer use, saves, and exports.
- Beginner Journey progress persisted in local storage.
- Visual highlight system using `data-wubguide-target` UI targets.
- Guided tutorial with Next, Back, Skip, and Finish.
- Quick prompts for tutorial, import help, playback help, mixer help, piano roll help, export help, and a first beat checklist.
- Animated original music-note mascot avatar.

Future AI model integration can be added later, but it must remain optional and preserve the local-first architecture guardrails.

## Producer Mode

Producer Mode is the advanced WubGuide mode for users who already understand the DAW. It coaches musical decisions using deterministic project structure analysis.

Current Producer Mode reads:

- BPM and time signature.
- Track count.
- Audio and MIDI clip counts.
- Clip lengths and arrangement duration.
- Mixer mute/solo usage.
- Saved/exported progress.

It does not analyze raw audio and does not call external AI APIs.

## Current Modules

### App Shell

`src/App.tsx` owns the top-level studio shell, view switching, error boundaries, engine initialization, and playhead RAF ticking while playing. It composes the transport, browser, arrangement, piano roll, mixer, WubPad view, and engine monitor view.

### TransportBar

`src/ui/transport/TransportBar.tsx` provides the primary DAW toolbar:

- Play/pause, stop, and rewind.
- Position readouts in time and bars/beats.
- BPM display/editing.
- Loop enablement and loop range fields.
- Snap enablement and snap grid selection.
- Emergency stop.
- Save and WAV export actions.
- Browser and mixer visibility toggles.
- Status display.

### AssetBrowser

`src/ui/browser/AssetBrowser.tsx` provides a local-first asset sidebar:

- Samples/projects tabs.
- Local audio import by click or drag/drop.
- Search filtering for imported audio assets.
- Asset metadata display.
- Mini waveform previews when waveform peaks exist.
- Project load affordance.

### ArrangementView

`src/ui/playlist/ArrangementView.tsx` is the main timeline workspace:

- Track headers and add-track controls.
- Timeline ruler with bar/beat markers.
- Scrollable arrangement lanes.
- Audio and MIDI clip blocks.
- Clip move/resize interaction.
- Context menu for clip actions.
- Loop region visualization.
- Glowing playhead.
- Empty-state guidance.

### MixerPanel

`src/ui/mixer/MixerPanel.tsx` provides DAW-style channel strips:

- Per-track channel strip.
- Track color indicator.
- Mute and solo controls.
- Pan strip.
- Vertical fader and dB readout.
- Master fader.
- Empty-state message when no tracks exist.

### PianoRoll

`src/ui/pianoRoll/PianoRoll.tsx` provides MIDI editing:

- Pencil, select, and erase tools.
- Grid duration selection.
- Default velocity field.
- Piano keyboard column.
- Beat and pitch grid.
- MIDI note drawing, moving, resizing, selection, and deletion.
- Velocity lane editing.

### WubGuidePanel

`src/ui/assistant/WubGuidePanel.tsx` provides the beginner assistant:

- Local deterministic question answering.
- Quick prompt chips.
- Tutorial state controls.
- Chat-like guide responses.
- Visual target highlighting through `useWubGuide`.
- WubGuide avatar states for idle, speaking, thinking, celebrating, and pointing.

## Testing Status

Latest documented verification after the Beginner Mode/WubGuide pass:

- 32 test files passing.
- 144 tests passing.
- Typecheck passing.
- Lint passing.
- Build passing.

## Developer Commands

```sh
NODE_OPTIONS=--max-old-space-size=2048 npm run typecheck
NODE_OPTIONS=--max-old-space-size=2048 npm run lint
NODE_OPTIONS=--max-old-space-size=2048 npm test
NODE_OPTIONS=--max-old-space-size=2048 npm run build
npm run dev
```

## Recommended Roadmap

Next work should continue in phases:

- Responsive resizing and dockable panels.
- Real audio clip editing refinements.
- MIDI piano roll improvements.
- Mixer metering.
- Stem import/separation.
- Offline WAV/stem rendering polish.
- WubPad remote-control integration.
- Producer memory and AI arrangement later, only after core DAW stability.
