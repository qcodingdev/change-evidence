import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getDiff,
  GitUnavailableError,
  InvalidRevisionError,
  NotARepositoryError,
} from '../src/git/diff-source.js';

/**
 * Create a mock gitRunner that returns fixed outputs for the three diff
 * formats (name-status, numstat, unified=0) based on the args.
 */
function makeRunner(responses: {
  nameStatus?: string;
  numstat?: string;
  unified?: string;
}) {
  return async (args: string[], _opts: { cwd: string }) => {
    const joined = args.join(' ');

    if (joined.includes('name-status')) {
      return { stdout: responses.nameStatus ?? '' };
    }
    if (joined.includes('numstat')) {
      return { stdout: responses.numstat ?? '' };
    }
    if (joined.includes('unified=0')) {
      return { stdout: responses.unified ?? '' };
    }
    return { stdout: '' };
  };
}

describe('getDiff', () => {
  it('returns empty result when there are no changes', async () => {
    const result = await getDiff('working-tree', {
      gitRunner: makeRunner({}),
    });
    expect(result.files).toHaveLength(0);
    expect(result.totalAdditions).toBe(0);
    expect(result.totalDeletions).toBe(0);
  });

  it('parses working-tree diff', async () => {
    const result = await getDiff('working-tree', {
      gitRunner: makeRunner({
        nameStatus: 'M\tfoo.ts\nA\tbar.ts',
        numstat: '10\t3\tfoo.ts\n5\t0\tbar.ts',
        unified: `diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,0 +1,1 @@
+hello`,
      }),
    });
    expect(result.files).toHaveLength(2);
    expect(result.totalAdditions).toBe(15);
    expect(result.totalDeletions).toBe(3);
    expect(result.files[0].path).toBe('foo.ts');
    expect(result.files[0].status).toBe('modified');
  });

  it('passes --cached for staged scope', async () => {
    let captured = '';
    const runner = async (args: string[]) => {
      captured += args.join(' ') + '\n';
      return { stdout: '' };
    };
    await getDiff('staged', { gitRunner: runner });
    // All three calls should include --cached.
    const lines = captured.trim().split('\n');
    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(line).toContain('--cached');
    }
    expect(lines.filter((line) => line.includes('name-status'))[0]).toContain('-z');
    expect(lines.filter((line) => line.includes('numstat'))[0]).toContain('-z');
    expect(lines.filter((line) => line.includes('unified=0'))[0]).not.toContain('-z');
  });

  it('passes <base>...HEAD for branch scope', async () => {
    let captured = '';
    const runner = async (args: string[]) => {
      captured += args.join(' ') + '\n';
      return { stdout: '' };
    };
    await getDiff('branch', { base: 'main', gitRunner: runner });
    const lines = captured.trim().split('\n');
    for (const line of lines) {
      expect(line).toContain('main...HEAD');
    }
  });

  it('throws when branch scope has no base', async () => {
    await expect(
      getDiff('branch', { gitRunner: makeRunner({}) }),
    ).rejects.toThrow('base ref');
  });

  it('throws GitUnavailableError when git binary is missing', async () => {
    const runner = async () => {
      const err = new Error('spawn git ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    };
    await expect(
      getDiff('working-tree', { gitRunner: runner }),
    ).rejects.toThrow(GitUnavailableError);
  });

  it('throws NotARepositoryError when cwd is not a git repo', async () => {
    const runner = async () => {
      const err = new Error('fatal') as Error & { stderr: string; code?: string };
      err.stderr = 'fatal: not a git repository';
      throw err;
    };
    await expect(
      getDiff('working-tree', { gitRunner: runner }),
    ).rejects.toThrow(NotARepositoryError);
  });

  it('throws InvalidRevisionError for an unknown revision', async () => {
    const runner = async () => {
      const err = new Error('unknown revision') as Error & { stderr: string };
      err.stderr = "fatal: bad revision 'nonexistent...HEAD'";
      throw err;
    };
    await expect(getDiff('branch', {
      base: 'nonexistent',
      gitRunner: runner,
    })).rejects.toThrow(InvalidRevisionError);
  });

  it.skipIf(process.platform === 'win32')(
    'preserves tabs and newlines in real staged file paths',
    async () => {
      const repo = mkdtempSync(join(tmpdir(), 'ce-diff-special-path-'));
      const oddPath = 'odd\tline\nname.ts';
      try {
        execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
        writeFileSync(join(repo, oddPath), 'export const answer = 42;\n');
        execFileSync('git', ['add', '--', oddPath], { cwd: repo });

        const result = await getDiff('staged', { cwd: repo });
        expect(result.files).toHaveLength(1);
        expect(result.files[0].path).toBe(oddPath);
        expect(result.files[0].additions).toBe(1);
        expect(result.files[0].patch).toContain('export const answer = 42');
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
  );

  it.skipIf(process.platform === 'win32')(
    'associates real rename stats and patches with the destination path',
    async () => {
      const repo = mkdtempSync(join(tmpdir(), 'ce-diff-rename-'));
      const oldPath = 'original.ts';
      const newPath = 'renamed\tfile.ts';
      const original = Array.from(
        { length: 20 },
        (_, i) => `export const v${i} = ${i};`,
      ).join('\n');
      try {
        execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
        writeFileSync(join(repo, oldPath), original + '\n');
        execFileSync('git', ['add', oldPath], { cwd: repo });
        execFileSync('git', [
          '-c', 'user.email=ce@example.test',
          '-c', 'user.name=Change Evidence',
          'commit', '-m', 'initial',
        ], { cwd: repo, stdio: 'ignore' });

        renameSync(join(repo, oldPath), join(repo, newPath));
        writeFileSync(
          join(repo, newPath),
          original.replace('v10 = 10', 'v10 = 100') + '\n',
        );
        execFileSync('git', ['add', '-A'], { cwd: repo });

        const result = await getDiff('staged', { cwd: repo });
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
          path: newPath,
          oldPath,
          status: 'renamed',
          additions: 1,
          deletions: 1,
        });
        expect(result.files[0].patch).toContain('v10 = 100');
      } finally {
        rmSync(repo, { recursive: true, force: true });
      }
    },
  );
});
