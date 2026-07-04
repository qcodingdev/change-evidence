import { describe, it, expect } from 'vitest';
import { detectSensitiveSignals } from '../src/analysis/sensitive-signal.js';
import type { FileChange } from '../src/shared/types.js';

const KEYWORDS = ['token', 'secret', 'password', 'api_key', 'authorization'];

function makeFile(path: string, patch: string): FileChange {
  return {
    path,
    status: 'modified',
    additions: 1,
    deletions: 0,
    patch,
    extension: 'ts',
  };
}

describe('detectSensitiveSignals', () => {
  it('detects sensitive keywords on added lines', () => {
    const file = makeFile(
      'src/config.ts',
      `+  api_key = "sk-123"\n+  const token = "x";\n-  password: old`,
    );
    const result = detectSensitiveSignals([file], KEYWORDS);
    // api_key and token are on added lines; password is on a removed line (not flagged).
    expect(result.hitsByFile.get('src/config.ts')).toEqual(
      expect.arrayContaining(['api_key', 'token']),
    );
    expect(result.hitsByFile.get('src/config.ts')).not.toContain('password');
    const signal = result.signals[0];
    expect(signal.type).toBe('secret-keyword');
    expect(signal.severity).toBe('high');
  });

  it('ignores keywords on removed/context lines', () => {
    // Keyword only on a removed line and a context line — should not be flagged.
    const file = makeFile(
      'src/config.ts',
      `  token: visible-in-context\n-  secret = old_value`,
    );
    const result = detectSensitiveSignals([file], KEYWORDS);
    expect(result.signals).toHaveLength(0);
  });

  it('handles files with no patch', () => {
    const file = makeFile('src/empty.ts', '');
    const result = detectSensitiveSignals([file], KEYWORDS);
    expect(result.signals).toHaveLength(0);
  });

  it('handles empty keyword list', () => {
    const file = makeFile('src/config.ts', '+  password = "abc"');
    const result = detectSensitiveSignals([file], []);
    expect(result.signals).toHaveLength(0);
  });

  it('is case-insensitive and dedupes keywords', () => {
    const file = makeFile('src/c.ts', '+  TOKEN = 1\n+  token = 2');
    const result = detectSensitiveSignals([file], KEYWORDS);
    expect(result.hitsByFile.get('src/c.ts')).toEqual(['token']);
  });
});
