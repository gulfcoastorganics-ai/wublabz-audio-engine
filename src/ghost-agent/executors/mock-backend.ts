import type { LocalExecutionBackend, Point, ScrollDelta } from './local-executor.js';

export interface MockLocalExecutionCall {
  method: 'moveMouse' | 'click' | 'typeText' | 'keyPress' | 'scroll' | 'wait';
  args: unknown[];
}

export interface MockLocalExecutionBackendResult {
  backend: LocalExecutionBackend;
  calls: MockLocalExecutionCall[];
}

export function createMockLocalExecutionBackend(): MockLocalExecutionBackendResult {
  const calls: MockLocalExecutionCall[] = [];

  const record = (method: MockLocalExecutionCall['method'], args: unknown[] = []) => {
    calls.push({ method, args });
  };

  const backend: LocalExecutionBackend = {
    async moveMouse(point: Point): Promise<void> {
      record('moveMouse', [point]);
    },
    async click(point?: Point): Promise<void> {
      record('click', [point]);
    },
    async typeText(text: string): Promise<void> {
      record('typeText', [text]);
    },
    async keyPress(key: string): Promise<void> {
      record('keyPress', [key]);
    },
    async scroll(delta: ScrollDelta): Promise<void> {
      record('scroll', [delta]);
    },
    async wait(milliseconds: number): Promise<void> {
      record('wait', [milliseconds]);
    }
  };

  return { backend, calls };
}
