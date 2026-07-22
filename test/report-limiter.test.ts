import { describe, it, expect } from 'vitest';
import { analyse } from '../src/analysis/risk-engine.js';
import { createDefaultConfig } from '../src/config/defaults.js';
import type { DiffResult, FileChange } from '../src/shared/types.js';

function makeFile(path: string, opts: Partial<FileChange> = {}): FileChange {
  return {
    path,
    status: 'modified',
    additions: 5,
    deletions: 2,
    patch: '',
    extension: path.includes('.') ? path.split('.').pop()!.toLowerCase() : '',
    ...opts,
  };
}

function makeDiff(files: FileChange[]): DiffResult {
  return {
    files,
    totalAdditions: files.reduce((s, f) => s + f.additions, 0),
    totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
  };
}

const CONFIG = createDefaultConfig();

describe('report limiter — maxRiskItems', () => {
  it('caps highRiskFiles at maxRiskItems', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, maxRiskItems: 3 } };
    const files = [
      makeFile('src/auth/A.java'),
      makeFile('src/auth/B.java'),
      makeFile('src/auth/C.java'),
      makeFile('src/auth/D.java'),
      makeFile('src/auth/E.java'),
    ];
    const report = analyse(makeDiff(files), config);
    expect(report.highRiskFiles.length).toBeLessThanOrEqual(3);
  });

  it('maxRiskItems=0 yields no high-risk files in output', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, maxRiskItems: 0 } };
    const report = analyse(makeDiff([makeFile('src/auth/A.java')]), config);
    expect(report.highRiskFiles).toHaveLength(0);
    expect(report.signals).toHaveLength(0);
    expect(report.truncation?.highRiskFilesOmitted).toBe(1);
    expect(report.truncation?.signalsOmitted).toBeGreaterThan(0);
  });

  it('does not cap when changes are below the limit', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, maxRiskItems: 10 } };
    const files = [makeFile('src/auth/A.java'), makeFile('src/auth/B.java')];
    const report = analyse(makeDiff(files), config);
    expect(report.highRiskFiles).toHaveLength(2);
  });

  it('caps risk signals and reports how many were omitted', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, maxRiskItems: 2 } };
    const files = [
      makeFile('src/auth/A.ts', { patch: '+ api_key = "x"' }),
      makeFile('package.json'),
      makeFile('.github/workflows/ci.yml'),
    ];
    const report = analyse(makeDiff(files), config);
    expect(report.signals).toHaveLength(2);
    expect(report.truncation?.signalsOmitted).toBeGreaterThan(0);
    expect(report.signals.every((signal) => signal.severity === 'high')).toBe(true);
  });
});

describe('report limiter — maxFiles', () => {
  it('caps the high-risk file detail list independently', () => {
    const config = {
      ...CONFIG,
      report: { ...CONFIG.report, maxFiles: 2, maxRiskItems: 10 },
    };
    const files = [
      makeFile('src/auth/A.java'),
      makeFile('src/auth/B.java'),
      makeFile('src/auth/C.java'),
      makeFile('src/auth/D.java'),
    ];
    const report = analyse(makeDiff(files), config);
    expect(report.summary.highRiskFiles).toBe(4);
    expect(report.highRiskFiles).toHaveLength(2);
    expect(report.truncation?.highRiskFilesOmitted).toBe(2);
  });
});

describe('report limiter — maxChecklistItems', () => {
  it('caps checklist at maxChecklistItems', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, maxChecklistItems: 2 } };
    // Trigger many distinct signal types so checklist is long.
    const files = [
      makeFile('src/auth/A.ts', { patch: '+  api_key = "x"' }),
      makeFile('src/auth/B.ts'),
      makeFile('package.json'),
      makeFile('Dockerfile'),
    ];
    const report = analyse(makeDiff(files), config);
    expect(report.checklistItems.length).toBeLessThanOrEqual(2);
  });

  it('checklist deduplicates by signal type', () => {
    const files = [
      makeFile('src/auth/A.ts', { patch: '+  api_key = "x"' }),
      makeFile('src/auth/B.ts', { patch: '+  token = "y"' }),
      makeFile('src/auth/C.ts', { patch: '+  secret = "z"' }),
    ];
    const report = analyse(makeDiff(files), CONFIG);
    // All three trigger secret-keyword; checklist should have only one secrets item.
    const secretsItems = report.checklistItems.filter((i) => i.includes('secrets'));
    expect(secretsItems).toHaveLength(1);
  });
});

describe('report limiter — collapseLowRisk', () => {
  it('counts documentation + style-asset as collapsed when enabled', () => {
    const files = [
      makeFile('src/a.ts'),
      makeFile('README.md'),
      makeFile('docs/guide.md'),
      makeFile('logo.svg'),
      makeFile('styles.css'),
    ];
    const report = analyse(makeDiff(files), CONFIG);
    expect(report.collapsedLowRiskCount).toBe(4);
  });

  it('collapses zero low-risk files when all are production', () => {
    const files = [makeFile('src/a.ts'), makeFile('src/b.ts')];
    const report = analyse(makeDiff(files), CONFIG);
    expect(report.collapsedLowRiskCount).toBe(0);
    expect(report.signals.some((s) => s.type === 'low-risk-collapsed')).toBe(false);
  });

  it('disables collapse when collapseLowRisk=false', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, collapseLowRisk: false } };
    const files = [makeFile('README.md'), makeFile('docs/g.md')];
    const report = analyse(makeDiff(files), config);
    expect(report.collapsedLowRiskCount).toBe(0);
  });
});
