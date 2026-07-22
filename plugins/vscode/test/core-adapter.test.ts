import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeWorkspace,
  stagedDiffFingerprint,
} from '../src/core-adapter.js';

const execFileAsync = promisify(execFile);
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('staged diff fingerprint', () => {
  it('changes whenever staged content changes', async () => {
    const repository = await createRepository();
    const file = join(repository, 'src.ts');
    await writeFile(file, 'export const value = 1;\n', 'utf8');
    await git(repository, 'add', 'src.ts');
    const first = await stagedDiffFingerprint(repository);

    await writeFile(file, 'export const value = 2;\n', 'utf8');
    await git(repository, 'add', 'src.ts');
    const second = await stagedDiffFingerprint(repository);

    expect(second).not.toBe(first);
  });

  it('returns a stable not-repository result instead of rejecting', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ai-change-radar-'));
    temporaryDirectories.push(directory);

    const result = await analyzeWorkspace(directory, 'staged', true);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'NOT_A_REPOSITORY',
        message: 'not a git repository',
      },
    });
  });
});

async function createRepository(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ai-change-radar-'));
  temporaryDirectories.push(directory);
  await git(directory, 'init', '-q');
  return directory;
}

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
}
