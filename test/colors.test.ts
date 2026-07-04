import { describe, it, expect } from 'vitest';
import { createPalette, severityTag } from '../src/render/colors.js';

describe('createPalette', () => {
  it('returns plain text when noColor is true', () => {
    const p = createPalette(true);
    expect(p.red('x')).toBe('x');
    expect(p.bold('x')).toBe('x');
    expect(p.severity('high', 'x')).toBe('x');
    expect(p.severityLabel('high', 'x')).toBe('x');
  });

  it('applies color when noColor is false', () => {
    const p = createPalette(false);
    // Colored output contains ANSI escape codes (start with \x1b[).
    expect(p.red('x')).toMatch(/\x1b\[/);
    expect(p.bold('x')).toMatch(/\x1b\[/);
  });

  it('severity maps each level to a colored string', () => {
    const p = createPalette(false);
    const high = p.severity('high', 'HIGH');
    const med = p.severity('medium', 'MED');
    const low = p.severity('low', 'LOW');
    const ok = p.severity('ok', 'OK');
    // All four should produce distinct colored outputs (non-empty ANSI).
    expect(high).toContain('HIGH');
    expect(med).toContain('MED');
    expect(low).toContain('LOW');
    expect(ok).toContain('OK');
  });
});

describe('severityTag', () => {
  it('returns bracketed tag for each level', () => {
    expect(severityTag('high')).toBe('[HIGH]');
    expect(severityTag('medium')).toBe('[MEDIUM]');
    expect(severityTag('low')).toBe('[LOW]');
    expect(severityTag('ok')).toBe('[OK]');
  });
});
