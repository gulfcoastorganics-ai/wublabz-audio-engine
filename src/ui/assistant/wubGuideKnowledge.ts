import type {
  WubGuideQuickAction,
  WubGuideResponse,
  WubGuideTarget,
  WubGuideTutorialStep,
} from './wubGuideTypes.js';
import type { WubGuideAction } from './wubGuideActions.js';

export const WUB_GUIDE_QUICK_ACTIONS: WubGuideQuickAction[] = [
  { id: 'tutorial', label: 'Start Tutorial', prompt: 'Start tutorial' },
  { id: 'import', label: 'Import Audio Help', prompt: 'How do I import audio?' },
  { id: 'playback', label: 'Playback Help', prompt: 'How do I press play?' },
  { id: 'mixer', label: 'Mixer Help', prompt: 'What is the mixer?' },
  { id: 'piano-roll', label: 'Piano Roll Help', prompt: 'How do I open the piano roll?' },
  { id: 'export', label: 'Export Help', prompt: 'How do I export WAV?' },
  { id: 'first-beat', label: 'First Beat Checklist', prompt: 'Help me make my first beat' },
];

export const WUB_GUIDE_TUTORIAL_STEPS: WubGuideTutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WubLabz Studio',
    body: 'This guided mode points out the main studio areas while leaving playback behavior unchanged.',
    highlightTarget: 'transport',
    label: 'Start here: the studio control center.',
  },
  {
    id: 'transport',
    title: 'Transport',
    body: 'Use the transport to play, stop, rewind, change BPM, loop, snap, save, and export.',
    highlightTarget: 'transport',
    label: 'Transport: playback and session controls.',
  },
  {
    id: 'browser',
    title: 'Browser',
    body: 'Import local audio here. Drop a file or click the import zone to add samples to the project.',
    highlightTarget: 'browser',
    label: 'Browser: import and find audio.',
  },
  {
    id: 'arrangement',
    title: 'Arrangement',
    body: 'Build the song here. Drag clips into lanes, move them on the timeline, and use the ruler to navigate.',
    highlightTarget: 'arrangement',
    label: 'Arrangement: your timeline workspace.',
  },
  {
    id: 'mixer',
    title: 'Mixer',
    body: 'Adjust volume, pan, mute, and solo for each track without changing the clips on the timeline.',
    highlightTarget: 'mixer',
    label: 'Mixer: balance track levels.',
  },
  {
    id: 'piano-roll',
    title: 'Piano Roll',
    body: 'Create and edit MIDI notes here after opening a MIDI clip.',
    highlightTarget: 'piano-roll',
    label: 'Piano Roll: MIDI note editing.',
  },
  {
    id: 'save-export',
    title: 'Save and Export',
    body: 'Save keeps the project available locally. Export WAV renders audio when your arrangement is ready.',
    highlightTarget: 'export',
    label: 'Export WAV when ready.',
  },
];

type KnowledgeEntry = {
  id: string;
  title: string;
  body: string;
  keywords: string[];
  steps?: string[];
  highlightTarget?: WubGuideTarget;
  actions?: WubGuideAction[];
};

const KNOWLEDGE: KnowledgeEntry[] = [
  // ── Clip editing (checked first: specific multi-word keywords that would
  //    otherwise be caught by generic entries like 'audio' or 'play') ──────
  {
    id: 'split-clip',
    title: 'Split a Clip',
    body: 'Split a clip at the playhead position by right-clicking it and choosing Split at Playhead. This creates two clips you can move independently.',
    keywords: ['split clip', 'cut clip', 'split at playhead', 'divide clip', 'how do i split'],
    highlightTarget: 'clip',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Move the playhead to where you want to cut.',
      'Right-click the audio clip in the arrangement.',
      'Choose "Split at Playhead".',
      'Two clips are created at the cut point.',
    ],
  },
  {
    id: 'fade-clip',
    title: 'Fade a Clip',
    body: 'Fades ramp the volume at the start or end of a clip to avoid clicks and pops. Right-click a clip and choose Add Fade In or Add Fade Out, or adjust the values in the Clip Inspector.',
    keywords: ['fade clip', 'fade in', 'fade out', 'how do i fade', 'add fade', 'clip fade'],
    highlightTarget: 'clip',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Select an audio clip.',
      'Right-click and choose "Add Fade In" or "Add Fade Out".',
      'A dark gradient appears at the clip edge showing the fade.',
      'Use the Clip Inspector to set a precise fade duration in seconds.',
    ],
  },
  {
    id: 'normalize',
    title: 'What Does Normalize Mean?',
    body: 'Normalize raises a clip to the maximum possible level without clipping. It makes quiet clips louder so they sit better in the mix. Right-click a clip and choose Normalize Clip.',
    keywords: ['normalize', 'normalise', 'what does normalize mean', 'clip normalize', 'normalize clip'],
    highlightTarget: 'clip',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Select an audio clip.',
      'Right-click and choose "Normalize Clip".',
      'The NRM badge appears on the clip.',
      'The clip will play at its maximum level without distorting.',
    ],
  },
  {
    id: 'reverse-audio',
    title: 'Reverse Audio',
    body: 'Reversing a clip plays it backwards, which creates interesting textures and effects. Right-click a clip and choose Reverse Clip, or toggle the Reverse control in the Clip Inspector.',
    keywords: ['reverse audio', 'reverse clip', 'backwards', 'play backwards', 'how do i reverse', 'reverse'],
    highlightTarget: 'clip',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Select an audio clip.',
      'Right-click and choose "Reverse Clip".',
      'The REV badge appears on the clip.',
      'Toggle it again to restore the original direction.',
    ],
  },
  {
    id: 'duplicate-clip',
    title: 'Duplicate a Clip',
    body: 'Duplicate creates a copy of the selected clip placed right after the original. Use Ctrl+D or right-click and choose Duplicate.',
    keywords: ['duplicate clip', 'copy clip', 'how do i duplicate', 'ctrl d', 'clone clip'],
    highlightTarget: 'clip',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Click a clip to select it.',
      'Press Ctrl+D (or Cmd+D on Mac), or right-click and choose "Duplicate".',
      'A copy appears right after the original.',
      'Drag the duplicate to where you need it.',
    ],
  },
  // ── General studio knowledge ───────────────────────────────────────────────
  {
    id: 'transport',
    title: 'Transport',
    body: 'The Transport is the main control strip for playback, tempo, loop, snap, saving, and exporting.',
    keywords: ['transport', 'controls', 'toolbar'],
    highlightTarget: 'transport',
    actions: [{ type: 'focusTransport' }],
    steps: [
      'Use Play and Stop for playback.',
      'Edit BPM to change tempo.',
      'Use Snap and Loop while arranging.',
      'Save or Export WAV from the right side.',
    ],
  },
  {
    id: 'import-audio',
    title: 'Import Audio',
    body: 'Use the Browser on the left to bring local audio into WubLabz. Audio stays local in the browser.',
    keywords: ['import', 'audio', 'sample', 'file', 'drop', 'browser'],
    highlightTarget: 'import-zone',
    actions: [{ type: 'openBrowser' }],
    steps: [
      'Open Beginner Mode if it is not already on.',
      'Find the Browser panel on the left.',
      'Drop an audio file on the import zone, or click it and choose a file.',
      'WubLabz creates an audio track if one is needed and places the clip in the arrangement.',
    ],
  },
  {
    id: 'playback',
    title: 'Play and Stop',
    body: 'The play button starts transport playback. The stop button halts playback and returns the playhead to the beginning.',
    keywords: ['play', 'press play', 'pause', 'stop', 'transport', 'start playback'],
    highlightTarget: 'play-button',
    actions: [{ type: 'focusTransport' }],
    steps: [
      'Look at the Transport bar at the top.',
      'Press the green Play button to start.',
      'Press it again to pause, or press Stop to reset to the beginning.',
    ],
  },
  {
    id: 'bpm',
    title: 'Change BPM',
    body: 'BPM controls the tempo of the project. Change it from the BPM number field in the transport.',
    keywords: ['bpm', 'tempo', 'speed'],
    highlightTarget: 'bpm',
    actions: [{ type: 'focusTransport' }],
    steps: ['Find BPM in the Transport.', 'Click the number field.', 'Type a new tempo, such as 120 or 140.'],
  },
  {
    id: 'arrangement',
    title: 'Arrangement View',
    body: 'The Arrangement is the main timeline where tracks, clips, the ruler, and the playhead come together.',
    keywords: ['arrangement', 'timeline', 'view', 'grid', 'lane', 'ruler'],
    highlightTarget: 'arrangement',
    actions: [{ type: 'focusArrangement' }],
    steps: [
      'Use the ruler to see bars and beats.',
      'Use lanes to organize clips by track.',
      'Drag clips to arrange the song structure.',
    ],
  },
  {
    id: 'mixer',
    title: 'Mixer',
    body: 'The Mixer balances tracks. Use channel strips for gain, pan, mute, and solo.',
    keywords: ['mixer', 'volume', 'fader', 'pan', 'level'],
    highlightTarget: 'mixer',
    actions: [{ type: 'openMixer' }],
    steps: [
      'Find the Mixer at the bottom.',
      'Move faders to change track volume.',
      'Use pan to place sounds left or right.',
      'Use mute or solo to focus on specific tracks.',
    ],
  },
  {
    id: 'meters',
    title: 'What Are Meters?',
    body: 'Meters show how loud a channel or the master output is. Green is healthy, yellow is close, and red means the signal is clipping.',
    keywords: ['what are meters', 'meters', 'meter', 'levels'],
    highlightTarget: 'mixer',
    actions: [{ type: 'openMixer' }],
    steps: [
      'Look at the vertical bars beside each fader.',
      'Watch the master meter to keep the full mix under control.',
      'Use meters to balance tracks without guessing.',
    ],
  },
  {
    id: 'clipping',
    title: 'What Is Clipping?',
    body: 'Clipping happens when a signal is pushed too hard and turns red. Lower the gain, trim the channel, or give the master more headroom.',
    keywords: ['why is it red', 'red', 'clipping', 'too loud', 'how loud should it be', 'headroom'],
    highlightTarget: 'mixer',
    actions: [{ type: 'openMixer' }],
    steps: [
      'Watch for the red clip indicator on the meter.',
      'Lower the channel gain or the master if needed.',
      'Aim for strong green and a little yellow, not constant red.',
    ],
  },
  {
    id: 'midi-clip',
    title: 'Make a MIDI Clip',
    body: 'MIDI clips live on MIDI tracks. Double-click a MIDI lane or use the track MIDI button to create one.',
    keywords: ['midi clip', 'make midi', 'create midi', 'add midi', 'create clip', 'place sample', 'place that sample'],
    highlightTarget: 'clip',
    actions: [{ type: 'createClipPlaceholder' }],
    steps: [
      'Add a MIDI track if one is not visible.',
      'Double-click in a MIDI lane to create a clip.',
      'Open the clip to edit notes in the Piano Roll.',
    ],
  },
  {
    id: 'create-track',
    title: 'Create Track',
    body: 'Tracks are lanes for audio or MIDI. I can create a starter audio track so you have a place to build.',
    keywords: ['create track', 'add track', 'make track', 'starter track'],
    highlightTarget: 'track-header',
    actions: [{ type: 'createTrack' }],
    steps: [
      'Use + Audio for samples or + MIDI for notes.',
      'Start with one track, then add more as the idea grows.',
    ],
  },
  {
    id: 'piano-roll',
    title: 'Open the Piano Roll',
    body: 'The Piano Roll opens when you double-click a MIDI clip or create a MIDI clip from a MIDI track.',
    keywords: ['piano roll', 'notes', 'midi notes', 'open piano'],
    highlightTarget: 'piano-roll',
    actions: [{ type: 'openPianoRoll' }],
    steps: [
      'Create or select a MIDI clip.',
      'Double-click the MIDI clip.',
      'Use Pencil to draw notes and the velocity lane to shape dynamics.',
    ],
  },
  {
    id: 'save',
    title: 'Save Project',
    body: 'Save stores the project locally through the studio project system.',
    keywords: ['save', 'save project', 'store'],
    highlightTarget: 'save',
    actions: [{ type: 'focusSave' }],
    steps: ['Use the Save button in the Transport.', 'Wait for the status message to confirm the save.'],
  },
  {
    id: 'export',
    title: 'Export WAV',
    body: 'Export WAV renders the current project output when you are ready to make an audio file.',
    keywords: ['export', 'wav', 'render', 'bounce'],
    highlightTarget: 'export',
    actions: [{ type: 'focusExport' }],
    steps: ['Finish your arrangement.', 'Check levels in the Mixer.', 'Click Export WAV in the Transport.'],
  },
  {
    id: 'snap',
    title: 'Snap',
    body: 'Snap helps clips and edits land on rhythmic grid positions instead of arbitrary times.',
    keywords: ['snap', 'grid', 'quantize'],
    highlightTarget: 'snap',
    actions: [{ type: 'focusTransport' }],
    steps: ['Turn Snap on in the Transport.', 'Choose a grid value.', 'Move clips or create notes against that grid.'],
  },
  {
    id: 'playhead',
    title: 'Playhead',
    body: 'The playhead is the glowing vertical line showing the current playback position in the Arrangement.',
    keywords: ['playhead', 'red line', 'position', 'cursor'],
    highlightTarget: 'arrangement',
    actions: [{ type: 'focusArrangement' }],
    steps: ['Click the ruler to seek.', 'Press Play.', 'Watch the playhead move across the arrangement.'],
  },
  {
    id: 'mute',
    title: 'Mute a Track',
    body: 'Mute silences a track while keeping it in the project.',
    keywords: ['mute', 'silence track'],
    highlightTarget: 'mixer',
    actions: [{ type: 'openMixer' }],
    steps: ['Find the track in the Mixer or track header.', 'Click M to mute.', 'Click M again to unmute.'],
  },
  {
    id: 'solo',
    title: 'Solo a Track',
    body: 'Solo lets you focus on one track while checking a sound or part.',
    keywords: ['solo', 'listen one track'],
    highlightTarget: 'mixer',
    actions: [{ type: 'openMixer' }],
    steps: ['Find the track in the Mixer or track header.', 'Click S to solo.', 'Click S again to leave solo mode.'],
  },
  {
    id: 'first',
    title: 'First Beat Coach',
    body: 'I set up the studio path for you: Browser is available, a starter track exists, and the Arrangement is ready for your first clip.',
    keywords: ['what should i do first', 'first', 'start', 'begin', 'checklist', 'new user', 'first beat', 'make my first beat'],
    highlightTarget: 'arrangement',
    actions: [{ type: 'openBrowser' }, { type: 'createTrack' }, { type: 'focusArrangement' }],
    steps: [
      'Step 1: I opened the Browser.',
      'Step 2: Use the highlighted import area to drop or choose audio.',
      'Step 3: I made sure there is a track to start with.',
      'Step 4: I focused the Arrangement where clips become your beat.',
      'Step 5: Drag imported clips into the timeline lanes.',
      'Next step: ask "How do I press play?" when your first clip is in place.',
    ],
  },
  {
    id: 'loop',
    title: 'Loop',
    body: 'Loop repeats a selected time range, which is useful when editing a small section.',
    keywords: ['loop', 'repeat', 'range'],
    highlightTarget: 'loop',
    actions: [{ type: 'focusTransport' }],
    steps: ['Enable Loop in the Transport.', 'Set start and end seconds.', 'Press Play to hear that range repeat.'],
  },
];

export const WUB_GUIDE_FALLBACK_RESPONSE: WubGuideResponse = {
  id: 'fallback',
  title: 'Try a Studio Question',
  body: 'I can help with importing audio, playback, BPM, the arrangement, mixer, piano roll, saving, exporting, snap, loop, mute, solo, clip editing (split, fade, normalize, reverse, duplicate), and what to do first.',
  steps: ['Choose a quick prompt below.', 'Or ask a short question like "How do I fade a clip?"'],
  highlightTarget: 'transport',
  quickActions: WUB_GUIDE_QUICK_ACTIONS,
};

export const WUB_GUIDE_WELCOME_RESPONSE: WubGuideResponse = {
  id: 'welcome',
  title: 'WubGuide AI',
  body: 'I am a local deterministic guide for learning WubLabz Studio. Ask how to use a section, or start the tutorial.',
  steps: [
    'Use quick prompts for common workflows.',
    'Beginner Mode highlights the relevant studio area.',
    'No external AI API is connected yet.',
  ],
  highlightTarget: 'transport',
  quickActions: WUB_GUIDE_QUICK_ACTIONS,
};

export function answerWubGuidePrompt(prompt: string): WubGuideResponse {
  const normalized = prompt.toLowerCase().trim();
  if (!normalized) return WUB_GUIDE_WELCOME_RESPONSE;

  if (normalized.includes('tutorial')) {
    return {
      id: 'tutorial-help',
      title: 'Start the Guided Tutorial',
      body: 'The tutorial walks through the Transport, Browser, Arrangement, Mixer, Piano Roll, and export controls.',
      steps: ['Click Start Tutorial.', 'Use Next and Back to move through the guide.', 'Finish or Skip anytime.'],
      highlightTarget: 'transport',
      actions: [{ type: 'startTutorial' }],
      quickActions: WUB_GUIDE_QUICK_ACTIONS,
    };
  }

  const match = KNOWLEDGE.find((entry) =>
    entry.keywords.some((keyword) => normalized.includes(keyword))
  );

  if (!match) return WUB_GUIDE_FALLBACK_RESPONSE;

  return {
    id: match.id,
    title: match.title,
    body: match.body,
    steps: match.steps,
    highlightTarget: match.highlightTarget,
    quickActions: WUB_GUIDE_QUICK_ACTIONS,
    actions: match.actions,
  };
}
