export type AudioBusName = 'master' | 'drum' | 'bass' | 'melody' | 'vocal' | 'fx' | 'preview' | 'render';

export interface AudioBus {
  name: AudioBusName;
  gain: number;
  connectedTo: AudioBusName[];
}

export class AudioGraph {
  readonly masterBus: AudioBus;
  readonly drumBus: AudioBus;
  readonly bassBus: AudioBus;
  readonly melodyBus: AudioBus;
  readonly vocalBus: AudioBus;
  readonly fxBus: AudioBus;
  readonly previewBus: AudioBus;
  readonly renderBus: AudioBus;

  private readonly buses: Record<AudioBusName, AudioBus>;

  constructor() {
    this.masterBus = { name: 'master', gain: 1, connectedTo: [] };
    this.drumBus = { name: 'drum', gain: 1, connectedTo: ['master'] };
    this.bassBus = { name: 'bass', gain: 1, connectedTo: ['master'] };
    this.melodyBus = { name: 'melody', gain: 1, connectedTo: ['master'] };
    this.vocalBus = { name: 'vocal', gain: 1, connectedTo: ['master'] };
    this.fxBus = { name: 'fx', gain: 1, connectedTo: ['master'] };
    this.previewBus = { name: 'preview', gain: 1, connectedTo: ['master'] };
    this.renderBus = { name: 'render', gain: 1, connectedTo: ['master'] };
    this.buses = {
      master: this.masterBus,
      drum: this.drumBus,
      bass: this.bassBus,
      melody: this.melodyBus,
      vocal: this.vocalBus,
      fx: this.fxBus,
      preview: this.previewBus,
      render: this.renderBus
    };
  }

  setGain(bus: AudioBusName, gain: number): void {
    this.buses[bus].gain = Math.max(0, gain);
  }

  connect(from: AudioBusName, to: AudioBusName): void {
    const bus = this.buses[from];
    if (!bus.connectedTo.includes(to)) {
      bus.connectedTo.push(to);
    }
  }

  disconnect(from: AudioBusName, to: AudioBusName): void {
    const bus = this.buses[from];
    bus.connectedTo = bus.connectedTo.filter((entry) => entry !== to);
  }

  snapshot(): Record<AudioBusName, AudioBus> {
    return structuredClone(this.buses);
  }
}
