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
 * If the dist bundle doesn't exist (e.g. running tests before a build), the
 * suite is skipped rather than failing — unit tests cover the logic.
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

  it('ce --help exits 0 and shows usage', async () => {
    const { exitCode, stdout } = await execa('node', [CLI, '--help'], {
      cwd: REPO_ROOT,
      reject: false,
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain('change-evidence');
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
