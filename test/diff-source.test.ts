import { describe, it, expect } from 'vitest';
import { getDiff, GitUnavailableError, NotARepositoryError } from '../src/git/diff-source.js';

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

  it('returns empty result for unknown revision instead of throwing', async () => {
    const runner = async () => {
      const err = new Error('unknown revision') as Error & { stderr: string };
      err.stderr = "fatal: bad revision 'nonexistent...HEAD'";
      throw err;
    };
    const result = await getDiff('branch', {
      base: 'nonexistent',
      gitRunner: runner,
    });
    expect(result.files).toHaveLength(0);
  });
});
