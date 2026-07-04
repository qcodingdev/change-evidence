import { describe, it, expect } from 'vitest';
import { analyse } from '../src/analysis/risk-engine.js';
import { createDefaultConfig } from '../src/config/defaults.js';
import type { DiffResult, FileChange } from '../src/shared/types.js';

function makeFile(
  path: string,
  opts: Partial<FileChange> = {},
): FileChange {
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

describe('analyse (risk engine integration)', () => {
  it('returns ok overall risk for an empty diff', () => {
    const report = analyse(makeDiff([]), CONFIG);
    expect(report.overallRisk).toBe('ok');
    expect(report.summary.fileCount).toBe(0);
    expect(report.highRiskFiles).toHaveLength(0);
    expect(report.checklistItems).toHaveLength(0);
  });

  it('flags high-risk auth path', () => {
    const diff = makeDiff([makeFile('src/auth/AuthService.java')]);
    const report = analyse(diff, CONFIG);
    expect(report.overallRisk).toBe('high');
    expect(report.highRiskFiles).toHaveLength(1);
    expect(report.highRiskFiles[0].path).toContain('AuthService');
    expect(report.highRiskFiles[0].reasons).toContain('high-risk-path');
  });

  it('flags config and dependency files', () => {
    const diff = makeDiff([
      makeFile('src/main/resources/application.yml'),
      makeFile('package.json'),
    ]);
    const report = analyse(diff, CONFIG);
    expect(report.summary.byCategory.config).toBe(1);
    expect(report.summary.byCategory.dependency).toBe(1);
    expect(report.highRiskFiles.length).toBeGreaterThanOrEqual(2);
  });

  it('flags CI workflow changes', () => {
    const diff = makeDiff([makeFile('.github/workflows/ci.yml')]);
    const report = analyse(diff, CONFIG);
    expect(report.summary.byCategory.ci).toBe(1);
    const ciFile = report.highRiskFiles.find((f) => f.path.includes('ci.yml'));
    expect(ciFile).toBeDefined();
    expect(ciFile!.reasons).toContain('ci-change');
  });

  it('detects test-missing signal', () => {
    const diff = makeDiff([makeFile('src/auth/AuthService.ts')]); // production only
    const report = analyse(diff, CONFIG);
    const missing = report.signals.find((s) => s.type === 'test-missing');
    expect(missing).toBeDefined();
    expect(report.summary.productionFiles).toBe(1);
    expect(report.summary.testFiles).toBe(0);
  });

  it('detects secret keywords in patch', () => {
    const diff = makeDiff([
      makeFile('src/config.ts', { patch: '+  api_key = "sk-xxx"\n+  password = "abc"' }),
    ]);
    const report = analyse(diff, CONFIG);
    const secret = report.signals.find((s) => s.type === 'secret-keyword');
    expect(secret).toBeDefined();
    expect(secret!.severity).toBe('high');
  });

  it('detects large changeset', () => {
    const files = Array.from({ length: 12 }, (_, i) => makeFile(`f${i}.ts`));
    const diff = makeDiff(files);
    const report = analyse(diff, CONFIG);
    expect(report.signals.some((s) => s.type === 'size-file-count')).toBe(true);
  });

  it('collapses low-risk documentation files', () => {
    const diff = makeDiff([
      makeFile('src/auth/AuthService.ts'),
      makeFile('README.md'),
      makeFile('docs/guide.md'),
      makeFile('logo.svg'),
    ]);
    const report = analyse(diff, CONFIG);
    expect(report.collapsedLowRiskCount).toBe(3);
    expect(report.signals.some((s) => s.type === 'low-risk-collapsed')).toBe(true);
  });

  it('respects collapseLowRisk=false', () => {
    const config = { ...CONFIG, report: { ...CONFIG.report, collapseLowRisk: false } };
    const diff = makeDiff([makeFile('README.md')]);
    const report = analyse(diff, config);
    expect(report.collapsedLowRiskCount).toBe(0);
    expect(report.signals.some((s) => s.type === 'low-risk-collapsed')).toBe(false);
  });

  it('limits highRiskFiles to maxRiskItems', () => {
    const config = {
      ...CONFIG,
      report: { ...CONFIG.report, maxRiskItems: 2 },
    };
    const files = [
      makeFile('src/auth/A.java'),
      makeFile('src/auth/B.java'),
      makeFile('src/auth/C.java'),
      makeFile('src/auth/D.java'),
    ];
    const report = analyse(makeDiff(files), config);
    expect(report.highRiskFiles.length).toBeLessThanOrEqual(2);
  });

  it('detects public API changes', () => {
    const diff = makeDiff([
      makeFile('src/api/users.ts', {
        patch: '+export function getUser(id: string) { return null; }',
      }),
    ]);
    const report = analyse(diff, CONFIG);
    const api = report.signals.find((s) => s.type === 'public-api-change');
    expect(api).toBeDefined();
  });

  it('generates checklist items from detected signals', () => {
    const diff = makeDiff([
      makeFile('src/auth/AuthService.ts', {
        patch: '+  api_key = "sk-xxx"',
      }),
    ]);
    const report = analyse(diff, CONFIG);
    expect(report.checklistItems.length).toBeGreaterThan(0);
    expect(report.checklistItems.some((i) => i.includes('secrets'))).toBe(true);
  });

  it('summary counts match byCategory', () => {
    const diff = makeDiff([
      makeFile('src/a.ts'), // production
      makeFile('src/a.test.ts'), // test
      makeFile('README.md'), // documentation
      makeFile('app.yml'), // config
    ]);
    const report = analyse(diff, CONFIG);
    expect(report.summary.fileCount).toBe(4);
    expect(report.summary.byCategory.production).toBe(1);
    expect(report.summary.byCategory.test).toBe(1);
    expect(report.summary.byCategory.documentation).toBe(1);
    expect(report.summary.byCategory.config).toBe(1);
  });
});
