import { describe, it, expect } from 'vitest';
import { detectTestSignals } from '../src/analysis/test-signal.js';
import type { FileChange, FileCategory } from '../src/shared/types.js';

function makeFile(path: string, status: FileChange['status'] = 'modified'): FileChange {
  return {
    path,
    status,
    additions: 1,
    deletions: 0,
    patch: '',
    extension: path.includes('.') ? path.split('.').pop()!.toLowerCase() : '',
  };
}

function catMap(entries: [string, FileCategory][]): Map<string, FileCategory> {
  return new Map(entries);
}

describe('detectTestSignals', () => {
  it('emits test-missing when production changes without tests', () => {
    const files = [makeFile('src/auth/AuthService.ts')];
    const categories = catMap([['src/auth/AuthService.ts', 'production']]);
    const result = detectTestSignals(files, categories);
    expect(result.productionWithoutTests).toBe(true);
    expect(result.signals).toHaveLength(1);
    expect(result.signals[0].type).toBe('test-missing');
    expect(result.signals[0].severity).toBe('medium');
  });

  it('does not emit test-missing when tests are present', () => {
    const files = [makeFile('src/auth/AuthService.ts'), makeFile('src/auth/AuthService.test.ts')];
    const categories = catMap([
      ['src/auth/AuthService.ts', 'production'],
      ['src/auth/AuthService.test.ts', 'test'],
    ]);
    const result = detectTestSignals(files, categories);
    expect(result.productionWithoutTests).toBe(false);
    expect(result.signals).toHaveLength(0);
  });

  it('emits test-deleted (high) when a test file is deleted', () => {
    const files = [makeFile('src/auth/AuthService.test.ts', 'deleted')];
    const categories = catMap([['src/auth/AuthService.test.ts', 'test']]);
    const result = detectTestSignals(files, categories);
    expect(result.deletedTestPaths).toEqual(['src/auth/AuthService.test.ts']);
    const deleted = result.signals.find((s) => s.type === 'test-deleted');
    expect(deleted).toBeDefined();
    expect(deleted!.severity).toBe('high');
  });

  it('does not emit signals when only tests changed (no production)', () => {
    const files = [makeFile('src/auth/AuthService.test.ts')];
    const categories = catMap([['src/auth/AuthService.test.ts', 'test']]);
    const result = detectTestSignals(files, categories);
    expect(result.signals).toHaveLength(0);
    expect(result.productionWithoutTests).toBe(false);
  });
});
