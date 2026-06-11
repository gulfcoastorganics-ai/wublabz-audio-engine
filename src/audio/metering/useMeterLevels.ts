import { useSyncExternalStore } from 'react';
import { meterRegistry } from './MeterRegistry.js';
import type { MeterSnapshot } from './meterTypes.js';

export function useMeterLevels(): MeterSnapshot {
  return useSyncExternalStore(
    meterRegistry.subscribe.bind(meterRegistry),
    meterRegistry.getSnapshot.bind(meterRegistry),
    meterRegistry.getSnapshot.bind(meterRegistry)
  );
}
