import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  getDiff,
  GitUnavailableError,
  InvalidRevisionError,
  MAX_UNTRACKED_PATCH_BYTES,
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

  it('classifies ambiguous revision errors as InvalidRevisionError', async () => {
    const runner = async () => {
      const err = new Error('fatal') as Error & { stderr: string };
      err.stderr = "fatal: ambiguous argument 'missing...HEAD'";
      throw err;
    };
    await expect(getDiff('branch', {
      base: 'missing',
      gitRunner: runner,
    })).rejects.toThrow(InvalidRevisionError);
  });

  it('optionally includes untracked non-ignored text files with redacted patches', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-diff-untracked-'));
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      writeFileSync(join(repo, '.gitignore'), 'ignored.txt\n');
      writeFileSync(
        join(repo, 'new-config.ts'),
        'const api_key = "must-not-leak";\nexport const ready = true;\n',
      );
      writeFileSync(join(repo, 'ignored.txt'), 'password=ignored\n');

      const withoutUntracked = await getDiff('working-tree', { cwd: repo });
      expect(withoutUntracked.files).toHaveLength(0);

      const result = await getDiff('working-tree', {
        cwd: repo,
        includeUntracked: true,
        sensitiveKeywords: ['api_key'],
      });
      expect(result.files).toHaveLength(2);
      expect(result.files.map((file) => file.path)).toEqual([
        '.gitignore',
        'new-config.ts',
      ]);
      const configFile = result.files.find((file) => file.path === 'new-config.ts');
      expect(configFile).toMatchObject({
        status: 'added',
        additions: 2,
        deletions: 0,
      });
      expect(configFile?.patch).toContain('***REDACTED***');
      expect(configFile?.patch).not.toContain('must-not-leak');
      expect(result.totalAdditions).toBe(3);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it.skipIf(process.platform === 'win32')(
    'does not follow untracked symlinks outside the repository',
    async () => {
      const repo = mkdtempSync(join(tmpdir(), 'ce-diff-untracked-link-'));
      const outside = join(tmpdir(), `ce-outside-${Date.now()}.txt`);
      try {
        execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
        writeFileSync(outside, 'password=outside-secret\n');
        symlinkSync(outside, join(repo, 'outside-link.txt'));

        const result = await getDiff('working-tree', {
          cwd: repo,
          includeUntracked: true,
        });
        expect(result.files).toHaveLength(1);
        expect(result.files[0]).toMatchObject({
          path: 'outside-link.txt',
          additions: 0,
          patch: '',
        });
      } finally {
        rmSync(repo, { recursive: true, force: true });
        rmSync(outside, { force: true });
      }
    },
  );

  it('does not load oversized untracked files into a patch', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-diff-untracked-large-'));
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      writeFileSync(
        join(repo, 'generated.txt'),
        Buffer.alloc(MAX_UNTRACKED_PATCH_BYTES + 1, 97),
      );

      const result = await getDiff('working-tree', {
        cwd: repo,
        includeUntracked: true,
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: 'generated.txt',
        additions: 0,
        patch: '',
      });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('includes an untracked binary file without exposing binary content', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-diff-untracked-binary-'));
    try {
      execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
      writeFileSync(join(repo, 'asset.bin'), Buffer.from([1, 2, 0, 3, 4]));

      const result = await getDiff('working-tree', {
        cwd: repo,
        includeUntracked: true,
      });
      expect(result.files).toHaveLength(1);
      expect(result.files[0]).toMatchObject({
        path: 'asset.bin',
        additions: 0,
        deletions: 0,
        patch: '',
      });
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('ignores unsafe and already-disappeared untracked paths', async () => {
    const repo = mkdtempSync(join(tmpdir(), 'ce-diff-untracked-race-'));
    try {
      const runner = async (args: string[]) => {
        if (args[0] === 'ls-files') {
          return { stdout: '../outside.txt\0vanished.txt\0' };
        }
        return { stdout: '' };
      };
      const result = await getDiff('working-tree', {
        cwd: repo,
        includeUntracked: true,
        gitRunner: runner,
      });
      expect(result.files).toHaveLength(0);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
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
