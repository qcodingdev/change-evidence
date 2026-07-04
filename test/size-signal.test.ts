import { describe, it, expect } from 'vitest';
import { detectSizeSignals } from '../src/analysis/size-signal.js';
import type { FileChange } from '../src/shared/types.js';

function makeFile(path: string, additions: number, deletions: number): FileChange {
  return {
    path,
    status: 'modified',
    additions,
    deletions,
    patch: '',
    extension: 'ts',
  };
}

const THRESHOLDS = { maxFiles: 10, maxTotalLines: 500, maxSingleFileLines: 200 };

describe('detectSizeSignals', () => {
  it('emits size-file-count when exceeding file threshold', () => {
    const files = Array.from({ length: 11 }, (_, i) => makeFile(`f${i}.ts`, 1, 0));
    const result = detectSizeSignals(files, 11, 0, THRESHOLDS);
    const count = result.signals.find((s) => s.type === 'size-file-count');
    expect(count).toBeDefined();
    expect(count!.severity).toBe('medium');
  });

  it('emits size-large-changeset when exceeding total lines threshold', () => {
    const files = [makeFile('a.ts', 300, 0), makeFile('b.ts', 250, 0)];
    const result = detectSizeSignals(files, 550, 0, THRESHOLDS);
    const large = result.signals.find((s) => s.type === 'size-large-changeset');
    expect(large).toBeDefined();
  });

  it('emits size-large-single-file for files exceeding single-file threshold', () => {
    const files = [makeFile('big.ts', 150, 60)]; // 210 total > 200
    const result = detectSizeSignals(files, 150, 60, THRESHOLDS);
    expect(result.largeFiles).toEqual(['big.ts']);
    const single = result.signals.find((s) => s.type === 'size-large-single-file');
    expect(single).toBeDefined();
    expect(single!.severity).toBe('low');
  });

  it('does not emit signals when below all thresholds', () => {
    const files = [makeFile('a.ts', 10, 5)];
    const result = detectSizeSignals(files, 10, 5, THRESHOLDS);
    expect(result.signals).toHaveLength(0);
  });

  it('does not emit size-file-count when exactly at threshold', () => {
    const files = Array.from({ length: 10 }, (_, i) => makeFile(`f${i}.ts`, 1, 0));
    const result = detectSizeSignals(files, 10, 0, THRESHOLDS);
    expect(result.signals.find((s) => s.type === 'size-file-count')).toBeUndefined();
  });
});
