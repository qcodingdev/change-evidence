import { describe, it, expect } from 'vitest';
import { generateChecklist } from '../src/analysis/checklist.js';
import type { Signal } from '../src/shared/types.js';

function sig(type: Signal['type'], severity: Signal['severity'] = 'medium'): Signal {
  return { type, severity, message: 'test' };
}

describe('generateChecklist', () => {
  it('generates items for known signal types', () => {
    const signals = [
      sig('secret-keyword', 'high'),
      sig('test-missing'),
      sig('config-change'),
    ];
    const items = generateChecklist(signals);
    expect(items).toHaveLength(3);
    expect(items.some((i) => i.includes('secrets'))).toBe(true);
    expect(items.some((i) => i.includes('tests'))).toBe(true);
    expect(items.some((i) => i.includes('config'))).toBe(true);
  });

  it('returns undefined-equivalent (skips) for low-risk-collapsed', () => {
    const items = generateChecklist([sig('low-risk-collapsed', 'ok')]);
    expect(items).toHaveLength(0);
  });

  it('deduplicates by signal type', () => {
    const signals = [
      sig('size-large-single-file'),
      sig('size-large-single-file'),
      sig('size-large-single-file'),
    ];
    const items = generateChecklist(signals);
    expect(items).toHaveLength(1);
  });

  it('caps at maxItems', () => {
    const signals: Signal['type'][] = [
      'secret-keyword',
      'config-change',
      'dependency-change',
      'migration-change',
      'ci-change',
      'high-risk-path',
      'test-missing',
      'test-deleted',
      'size-file-count',
      'size-large-changeset',
    ];
    const items = generateChecklist(signals.map((t) => sig(t)), 8);
    expect(items).toHaveLength(8);
  });

  it('returns empty array for empty signals', () => {
    expect(generateChecklist([])).toHaveLength(0);
  });
});
