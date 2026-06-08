declare module 'tone' {
  const Tone: unknown;
  export = Tone;
}

declare module 'wavefile' {
  const wavefile: unknown;
  export default wavefile;
}

declare module 'mpg123-decoder' {
  export interface MPEGDecodedAudio {
    sampleRate: number;
    channelData: Float32Array[];
    samplesDecoded: number;
  }

  export class MPEGDecoder {
    decode(bytes: Uint8Array): MPEGDecodedAudio;
    free(): void;
  }
}
