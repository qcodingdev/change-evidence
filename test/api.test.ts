import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  analyzeRepository,
  analyseRepository,
  createDefaultConfig,
  tryAnalyzeRepository,
} from '../src/api/index.js';

describe('public repository analysis API', () => {
  it('returns a RiskReport without writing or exiting', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-api-'));
    const exitSpy = vi.spyOn(process, 'exit');
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    const stderrSpy = vi.spyOn(process.stderr, 'write');
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      writeFileSync(
        join(repo, 'src.ts'),
        'export function answer() { return 42; }\n',
      );

      const report = await analyzeRepository({ cwd: repo });
      expect(report.summary.fileCount).toBe(1);
      expect(report.overallRisk).toBe('medium');
      expect(exitSpy).not.toHaveBeenCalled();
      expect(stdoutSpy).not.toHaveBeenCalled();
      expect(stderrSpy).not.toHaveBeenCalled();

      const aliasReport = await analyseRepository({
        cwd: repo,
        includeUntracked: false,
      });
      expect(aliasReport.summary.fileCount).toBe(0);
    } finally {
      exitSpy.mockRestore();
      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('returns typed failures from the never-throw API', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'ce-api-not-repo-'));
    try {
      const outcome = await tryAnalyzeRepository({ cwd: directory });
      expect(outcome).toEqual({
        ok: false,
        error: {
          code: 'NOT_A_REPOSITORY',
          message: 'not a git repository',
        },
      });
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('normalizes an invalid base into a stable error code', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-api-base-'));
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      const outcome = await tryAnalyzeRepository({
        cwd: repo,
        scope: 'branch',
        base: 'definitely-missing',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.error.code).toBe('INVALID_REVISION');
        expect(outcome.error.message).toMatch(/bad revision|ambiguous argument/);
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('returns complete evidence by default and can opt into display limits', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-api-limits-'));
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      writeFileSync(
        join(repo, 'package.json'),
        '{"api_key":"secret","dependencies":{"x":"1"}}\n',
      );
      const config = createDefaultConfig();
      config.report.maxFiles = 1;
      config.report.maxRiskItems = 1;

      const complete = await analyzeRepository({ cwd: repo, config });
      expect(complete.signals.length).toBeGreaterThan(1);
      expect(complete.truncation).toEqual({
        highRiskFilesOmitted: 0,
        signalsOmitted: 0,
      });

      const limited = await analyzeRepository({
        cwd: repo,
        config,
        applyReportLimits: true,
      });
      expect(limited.signals).toHaveLength(1);
      expect(limited.highRiskFiles).toHaveLength(1);
      expect(limited.truncation?.signalsOmitted).toBeGreaterThan(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
