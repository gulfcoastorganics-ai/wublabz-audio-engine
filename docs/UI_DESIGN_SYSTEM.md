# UI Design System

## Direction

WubLabz Studio uses a dark premium DAW interface with glass panels, rounded controls, subtle neon accents, clear contrast, and compact spacing suitable for laptop production sessions.

The current UI polish pass was visual only. It did not alter audio engine behavior, playback scheduling, persistence contracts, or export logic.

Beginner Mode builds on the same visual system with guide labels, neon target highlights, and a glass WubGuide AI assistant panel. It is a UI/help layer only.

## Token Source

Global design tokens live in `src/index.css`.

Use those tokens first when styling UI surfaces. Component-local inline styles may reference the same token names for consistency.

## Color System

Primary tokens:

```css
:root {
  --color-bg-main: #04060e;
  --color-bg-panel: rgba(8, 11, 24, 0.92);
  --color-bg-glass: rgba(255, 255, 255, 0.025);
  --color-border-soft: rgba(255, 255, 255, 0.055);
  --color-border-glow: rgba(139, 127, 248, 0.5);
  --color-text-main: #ced0ea;
  --color-text-muted: #555878;
  --color-text-bright: #eeeeff;
  --color-accent: #8b7ff8;
  --color-accent-2: #5b9cf8;
  --color-danger: #ff4444;
  --shadow-glass: 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04);
  --shadow-glow: 0 0 20px rgba(139,127,248,0.2);
}
```

Color usage:

- `--color-bg-main` is the app-level DAW background.
- `--color-bg-panel` is the default floating panel surface.
- `--color-bg-glass` is for very subtle translucent overlays.
- `--color-text-main` is default body text.
- `--color-text-muted` is for low-priority labels and secondary metadata.
- `--color-text-bright` is for active labels, titles, and important readouts.
- `--color-danger` is reserved for destructive or emergency controls.

## Glass Panels

Glass surfaces should use:

- Transparent layered backgrounds.
- Soft borders.
- Backdrop blur where supported.
- Inset top highlights.
- Rounded panel corners.
- Strong but soft shadows.

Common utilities:

- `.glass`
- `.glass-sm`
- `.glass-card`
- `.panel-float`

Use `.panel-float` for main DAW panels such as arrangement, mixer, and docked editors.

## Accent and Glow System

The accent system uses purple, indigo, and blue:

- `--color-accent` for primary active states.
- `--color-accent-2` for secondary blue detail, waveform, and selected-gradient support.
- `--color-border-glow` for active borders.
- `--shadow-glow` for low-intensity neon feedback.

Use glow sparingly:

- Active tab or tool states.
- Selected clips or MIDI notes.
- Playhead and loop region accents.
- Focus-visible states.
- Mixer solo or active controls.

Avoid applying glow to every surface; the interface should feel premium, not noisy.

## Shadows

Primary shadow tokens:

- `--shadow-glass` for elevated glass panels.
- `--shadow-glow` for active neon states.

Panel shadows should create depth without reducing text contrast. Control shadows should communicate state rather than decoration.

## Layout Target

The UI should remain laptop-friendly at `1366x768`.

Layout expectations:

- Transport stays compact.
- Browser width stays narrow enough for arrangement work.
- Mixer height remains docked and practical.
- Piano roll uses a constrained docked height.
- Arrangement view remains the primary workspace.
- Panel gutters should improve clarity without consuming too much vertical space.

## Module Styling Notes

### App Shell

The shell provides the global DAW background, top view switcher, and panel layout spacing.

### TransportBar

Transport styling should prioritize readability and speed:

- Bright play/pause state.
- Clear position readouts.
- Compact loop and snap controls.
- Emergency stop remains visually distinct.

### AssetBrowser

Browser styling should feel like a polished sample crate:

- Rounded glass container.
- Search field with strong contrast.
- Import drop zone.
- Asset cards with metadata and waveform preview.

### ArrangementView

Arrangement styling should emphasize timing:

- Clear ruler.
- Readable bar and beat grid.
- Alternating track lanes.
- Strong selected clip treatment.
- Glowing playhead.
- Helpful empty states.

### MixerPanel

Mixer styling should feel professional and compact:

- Individual channel strip surfaces.
- Track color bars.
- Clear mute/solo states.
- Pan strip and fader affordances.
- Master channel separation.

### PianoRoll

Piano roll styling should emphasize edit precision:

- Distinct white and black key rows.
- Strong bar lines.
- Clear selected note state.
- Velocity lane contrast.
- Compact tool controls.

### Beginner Mode and WubGuide AI

Beginner Mode should be visually helpful without cluttering advanced mode:

- Beginner labels and `?` buttons only render when Beginner Mode is enabled.
- Highlighted targets use a purple/blue glow on existing UI regions.
- Floating labels should be compact and should not reflow the DAW layout.
- WubGuide AI uses a glass card with chat-like messages, quick action chips, and tutorial footer controls.
- The avatar is an original animated music-note mascot with expressive eyes, a small mouth animation, and purple/blue glow.

WubGuide is local deterministic help for now:

- No external AI API.
- No remote model calls.
- Rule-based prompt matching from local knowledge.
- Deterministic action workflows only, such as opening panels and focusing highlighted UI regions.
- Context-aware onboarding displays Beginner Journey milestones and a proactive next-step prompt.
- Future real AI integration should keep the same UI affordances and remain optional.

## Accessibility and Interaction

Interactive elements should provide:

- Hover feedback.
- Active feedback.
- `focus-visible` styling.
- Adequate text contrast.
- Controls that remain usable with compact laptop spacing.

Do not remove semantic button, input, or select behavior for purely visual reasons.
