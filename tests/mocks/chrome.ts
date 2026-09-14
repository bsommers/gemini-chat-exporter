import { vi, beforeEach } from 'vitest';

/**
 * Minimal mock of the `chrome` extension APIs used by src/content/index.ts
 * and src/popup/popup.ts, so those modules can load and run under jsdom
 * without a real browser. Individual tests override method behavior with
 * `.mockResolvedValueOnce(...)` / `.mockImplementationOnce(...)` as needed.
 */
export function createChromeMock() {
  return {
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined)
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue(undefined)
    },
    downloads: {
      download: vi.fn().mockResolvedValue(1)
    },
    runtime: {
      onMessage: {
        addListener: vi.fn()
      },
      sendMessage: vi.fn()
    }
  };
}

// Assigned at module-evaluation time (before any test file's own static
// imports run) so modules with import-time side effects - content/index.ts
// registers its onMessage listener as soon as it's imported - always find a
// `chrome` global in place.
(globalThis as unknown as { chrome: ReturnType<typeof createChromeMock> }).chrome = createChromeMock();

// Reset to a pristine mock before every test so call history/overrides from
// one test never leak into the next.
beforeEach(() => {
  (globalThis as unknown as { chrome: ReturnType<typeof createChromeMock> }).chrome = createChromeMock();
});
