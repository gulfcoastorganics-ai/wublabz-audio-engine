import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { CompressedScreenshotArtifact, ScreenshotArtifact } from './types.js';

export function compressScreenshotArtifact(input: ScreenshotArtifact): CompressedScreenshotArtifact {
  const compressed = gzipSync(Buffer.from(input.data));

  return {
    encoding: 'gzip',
    mimeType: input.mimeType,
    originalBytes: input.data.byteLength,
    compressedBytes: compressed.byteLength,
    sha256: createHash('sha256').update(input.data).digest('hex'),
    data: new Uint8Array(compressed)
  };
}

