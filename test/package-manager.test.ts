import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  checkGlobalCliVersion,
  compareVersions,
  uninstallGlobalCli,
  updateGlobalCli,
} from '../src/cli/package-manager.js';

const tempDirs: string[] = [];

function tempRepo(): string {
  const repo = mkdtempSync(join(tmpdir(), 'ce-package-manager-'));
  tempDirs.push(repo);
  mkdirSync(join(repo, '.git', 'hooks'), { recursive: true });
  return repo;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('updateGlobalCli', () => {
  it('updates the public package through global npm install', async () => {
    const calls: string[][] = [];
    const write = vi.fn();

    await updateGlobalCli('en', {
      runNpm: async (args) => { calls.push([...args]); },
      write,
    });

    expect(calls).toEqual([
      ['install', '--global', 'change-evidence@latest'],
    ]);
    expect(write).toHaveBeenCalledWith(expect.stringContaining('Updating'));
    expect(write).toHaveBeenCalledWith(expect.stringContaining('complete'));
  });

  it('propagates npm update failures', async () => {
    await expect(updateGlobalCli('en', {
      runNpm: async () => { throw new Error('npm failed'); },
    })).rejects.toThrow('npm failed');
  });
});

describe('compareVersions', () => {
  it('compares stable semantic versions', () => {
    expect(compareVersions('0.1.2', '0.1.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
  });

  it('orders prerelease identifiers according to semver precedence', () => {
    expect(compareVersions('1.0.0', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-rc.2', '1.0.0-rc.1')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0-alpha.1', '1.0.0-alpha.beta')).toBeLessThan(0);
  });

  it('returns undefined for invalid versions', () => {
    expect(compareVersions('latest', '0.1.1')).toBeUndefined();
  });
});

describe('checkGlobalCliVersion', () => {
  it('prints an upgrade reminder when npm latest is newer', async () => {
    const write = vi.fn();
    await checkGlobalCliVersion('0.1.1', 'en', {
      readLatestVersion: async () => '0.2.0',
      write,
    });
    expect(write).toHaveBeenCalledWith('Current version: 0.1.1');
    expect(write).toHaveBeenCalledWith('Latest npm version: 0.2.0');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('ce update'));
  });

  it('reports when the installed version is current', async () => {
    const write = vi.fn();
    await checkGlobalCliVersion('0.1.1', 'zh-CN', {
      readLatestVersion: async () => '0.1.1',
      write,
    });
    expect(write).toHaveBeenCalledWith('当前已是最新版本。');
  });
});

describe('uninstallGlobalCli', () => {
  it('removes the current managed hook before uninstalling globally', async () => {
    const repo = tempRepo();
    const hookPath = join(repo, '.git', 'hooks', 'pre-commit');
    writeFileSync(
      hookPath,
      '#!/bin/sh\n# change-evidence pre-commit hook\nexec ce --staged --hook\n',
    );
    const calls: string[][] = [];

    await uninstallGlobalCli(repo, 'en', {
      runNpm: async (args) => { calls.push([...args]); },
      write: vi.fn(),
      writeError: vi.fn(),
    });

    expect(existsSync(hookPath)).toBe(false);
    expect(calls).toEqual([
      ['uninstall', '--global', 'change-evidence'],
    ]);
  });

  it('preserves custom hooks and warns before uninstalling the CLI', async () => {
    const repo = tempRepo();
    const hookPath = join(repo, '.git', 'hooks', 'pre-commit');
    writeFileSync(hookPath, '#!/bin/sh\necho custom\n');
    const writeError = vi.fn();

    await uninstallGlobalCli(repo, 'zh-CN', {
      runNpm: async () => undefined,
      write: vi.fn(),
      writeError,
    });

    expect(readFileSync(hookPath, 'utf8')).toContain('echo custom');
    expect(writeError).toHaveBeenCalledWith(expect.stringContaining('已保留'));
    expect(writeError).toHaveBeenCalledWith(expect.stringContaining('其他仓库'));
  });

  it('propagates npm uninstall failures after local cleanup', async () => {
    const repo = tempRepo();
    await expect(uninstallGlobalCli(repo, 'en', {
      runNpm: async () => { throw new Error('permission denied'); },
      write: vi.fn(),
      writeError: vi.fn(),
    })).rejects.toThrow('permission denied');
  });
});
