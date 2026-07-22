import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));
const CLI = fileURLToPath(new URL('../dist/cli/index.js', import.meta.url));

/**
 * End-to-end acceptance tests that exercise the built CLI binary against the
 * real git repository. These run after `npm run build`.
 *
 * `npm test` builds the CLI before Vitest starts. Direct Vitest invocations
 * may still skip this suite when the bundle does not exist.
 */
const hasBuild = existsSync(CLI);
const describeOrSkip = hasBuild ? describe : describe.skip;

describeOrSkip('CLI end-to-end (built binary)', () => {
  it('ce --staged --no-color produces a report header', async () => {
    const { stdout } = await execa('node', [CLI, '--staged', '--no-color'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    expect(stdout).toContain('Change Evidence');
  }, 15000);

  it('ce --staged --no-color --language en produces English output', async () => {
    const { stdout } = await execa(
      'node',
      [CLI, '--staged', '--no-color', '--language', 'en'],
      { cwd: REPO_ROOT, reject: false },
    );
    expect(stdout).toContain('Scope:');
    expect(stdout).toMatch(/staged changes/i);
  }, 15000);

  it('ce --no-color (working tree) emits a risk report', async () => {
    const tmpRepo = mkdtempSync(join(tmpdir(), 'ce-e2e-working-tree-'));
    try {
      await execa('git', ['init'], { cwd: tmpRepo });
      writeFileSync(join(tmpRepo, 'app.ts'), 'export function answer() { return 1; }\n');
      await execa('git', ['add', 'app.ts'], { cwd: tmpRepo });
      await execa(
        'git',
        [
          '-c',
          'user.email=ce@example.test',
          '-c',
          'user.name=Change Evidence',
          'commit',
          '-m',
          'initial',
        ],
        { cwd: tmpRepo },
      );
      writeFileSync(join(tmpRepo, 'app.ts'), 'export function answer() { return 2; }\n');

      const { stdout } = await execa('node', [CLI, '--no-color'], {
        cwd: tmpRepo,
        reject: false,
      });
      expect(stdout).toContain('风险等级');
      expect(stdout).toMatch(/摘要|Summary/);
    } finally {
      rmSync(tmpRepo, { recursive: true, force: true });
    }
  }, 15000);

  it('ce --format json emits one parseable RiskReport document', async () => {
    const tmpRepo = mkdtempSync(join(tmpdir(), 'ce-e2e-json-'));
    try {
      await execa('git', ['init'], { cwd: tmpRepo });
      writeFileSync(
        join(tmpRepo, '.change-evidence.yml'),
        'report:\n  maxFiles: 1\n  maxRiskItems: 1\n',
      );
      writeFileSync(
        join(tmpRepo, 'new.ts'),
        'export const api_key = "secret";\n',
      );

      const { exitCode, stdout, stderr } = await execa(
        'node',
        [CLI, '--format', 'json'],
        { cwd: tmpRepo, reject: false },
      );
      expect(exitCode).toBe(0);
      expect(stderr).toBe('');
      const report = JSON.parse(stdout) as {
        overallRisk: string;
        summary: { fileCount: number };
        signals: unknown[];
      };
      expect(report.summary.fileCount).toBe(2);
      expect(report.overallRisk).toBe('high');
      expect(report.signals.length).toBeGreaterThan(1);
    } finally {
      rmSync(tmpRepo, { recursive: true, force: true });
    }
  }, 15000);

  it('a prompt-mode hook blocks instead of committing when no terminal is available', async () => {
    const tmpRepo = mkdtempSync(join(tmpdir(), 'ce-e2e-hook-no-tty-'));
    try {
      await execa('git', ['init'], { cwd: tmpRepo });
      writeFileSync(join(tmpRepo, '.change-evidence.yml'), [
        'language: en',
        'hook:',
        '  enabled: true',
        '  mode: prompt',
        '  trigger:',
        '    minChangedFiles: 1',
        '    minRiskLevel: low',
        '',
      ].join('\n'));
      writeFileSync(join(tmpRepo, 'app.ts'), 'export function answer() { return 42; }\n');
      await execa('git', ['add', 'app.ts'], { cwd: tmpRepo });
      writeFileSync(
        join(tmpRepo, '.git', 'hooks', 'pre-commit'),
        `#!/bin/sh\nexec "${process.execPath}" "${CLI}" --staged --hook --no-color\n`,
        { mode: 0o755 },
      );

      const commit = await execa(
        'git',
        [
          '-c',
          'user.email=ce@example.test',
          '-c',
          'user.name=Change Evidence',
          'commit',
          '-m',
          'must be blocked',
        ],
        { cwd: tmpRepo, reject: false, detached: true },
      );
      expect(commit.exitCode).not.toBe(0);
      expect(commit.stderr).toContain('no interactive terminal');

      const head = await execa('git', ['rev-parse', '--verify', 'HEAD'], {
        cwd: tmpRepo,
        reject: false,
      });
      expect(head.exitCode).not.toBe(0);
    } finally {
      rmSync(tmpRepo, { recursive: true, force: true });
    }
  }, 15000);

  it('ce --help exits 0 and shows usage', async () => {
    const { exitCode, stdout } = await execa('node', [CLI, '--help'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('change-evidence');
    expect(stdout).toContain('update');
    expect(stdout).toContain('uninstall');
  }, 15000);

  it('ce --version exits 0 and prints the package version', async () => {
    const { exitCode, stdout } = await execa('node', [CLI, '--version'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe('0.1.1');
  }, 15000);

  it('ce foo (unknown positional) exits non-zero', async () => {
    const { exitCode } = await execa('node', [CLI, 'foo'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    expect(exitCode).not.toBe(0);
  }, 15000);

  it('ce --language fr (invalid) exits non-zero', async () => {
    const { exitCode } = await execa(
      'node',
      [CLI, '--language', 'fr'],
      { cwd: REPO_ROOT, reject: false },
    );
    expect(exitCode).not.toBe(0);
  }, 15000);

  it('ce --base with an unknown revision exits non-zero', async () => {
    const { exitCode, stderr } = await execa(
      'node',
      [CLI, '--base', 'ce-definitely-missing-base', '--no-color'],
      { cwd: REPO_ROOT, reject: false },
    );
    expect(exitCode).not.toBe(0);
    expect(stderr).toMatch(/unknown revision|bad revision|ambiguous argument/i);
  }, 15000);

  it('ce uninstall refuses non-interactive removal without --yes', async () => {
    const tmpRepo = mkdtempSync(join(tmpdir(), 'ce-e2e-uninstall-confirm-'));
    try {
      await execa('git', ['init'], { cwd: tmpRepo });
      const { exitCode, stderr } = await execa(
        'node',
        [CLI, 'uninstall'],
        { cwd: tmpRepo, reject: false },
      );
      expect(exitCode).not.toBe(0);
      expect(stderr).toContain('uninstall --yes');
      expect(existsSync(join(tmpRepo, '.git', 'hooks', 'pre-commit'))).toBe(false);
    } finally {
      rmSync(tmpRepo, { recursive: true, force: true });
    }
  }, 15000);

  it('ce --staged --no-color does not leak secret-looking values', async () => {
    const { stdout } = await execa('node', [CLI, '--staged', '--no-color'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    // The report should never contain raw token-like strings even if present
    // in diffs. REDACTED is the only acceptable form.
    expect(stdout).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
    expect(stdout).not.toMatch(/ghp_[a-zA-Z0-9]{10,}/);
  }, 15000);
});
