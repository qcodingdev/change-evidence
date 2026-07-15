import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildHookScript,
  CONFIG_PATH,
  resolveHookPath,
  writeHook,
  uninstallHook,
  installHook,
  defaultAnswers,
  writeInstallConfig,
  HOOK_PATH,
} from '../src/hook/install-hook.js';
import { createDefaultConfig } from '../src/config/defaults.js';
import type { ChangeEvidenceConfig } from '../src/shared/types.js';

let tmpDir: string;

function makeRepo(): string {
  tmpDir = join(tmpdir(), `ce-hook-${Math.random().toString(36).slice(2)}`);
  mkdirSync(join(tmpDir, '.git', 'hooks'), { recursive: true });
  return tmpDir;
}

function cleanup(): void {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
}

beforeEach(() => {
  tmpDir = '';
});

afterEach(() => {
  cleanup();
});

describe('buildHookScript', () => {
  it('produces an executable shell script', () => {
    const script = buildHookScript('ce');
    expect(script.startsWith('#!/bin/sh')).toBe(true);
    expect(script).toContain('exec ce --staged --hook');
  });

  it('uses the provided bin name', () => {
    expect(buildHookScript('change-evidence')).toContain('exec change-evidence --staged --hook');
  });

  it('includes the change-evidence marker', () => {
    expect(buildHookScript('ce')).toContain('# change-evidence pre-commit hook');
  });
});

describe('resolveHookPath', () => {
  it('resolves .git/hooks/pre-commit in a normal repo', () => {
    const repo = makeRepo();
    expect(resolveHookPath(repo)).toBe(join(repo, '.git', 'hooks', 'pre-commit'));
  });

  it('returns undefined when not a git repo', () => {
    const dir = join(tmpdir(), `ce-nogit-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    try {
      expect(resolveHookPath(dir)).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles .git file (gitdir) indirection', () => {
    const repo = makeRepo();
    const altGitdir = join(tmpdir(), `ce-alt-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(altGitdir, 'hooks'), { recursive: true });
    // Replace the .git directory with a .git file pointing to altGitdir.
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    writeFileSync(join(repo, '.git'), `gitdir: ${altGitdir}`);
    try {
      expect(resolveHookPath(repo)).toBe(join(altGitdir, 'hooks', 'pre-commit'));
    } finally {
      rmSync(altGitdir, { recursive: true, force: true });
    }
  });

  it('resolves a relative gitdir indirection against the worktree', () => {
    const repo = makeRepo();
    const altGitdir = join(tmpDir, 'git-data');
    mkdirSync(join(altGitdir, 'hooks'), { recursive: true });
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    writeFileSync(join(repo, '.git'), 'gitdir: git-data');
    expect(resolveHookPath(repo)).toBe(join(altGitdir, 'hooks', 'pre-commit'));
  });

  it('respects core.hooksPath in a real repository', () => {
    const repo = makeRepo();
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    execFileSync('git', ['init'], { cwd: repo, stdio: 'ignore' });
    execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { cwd: repo });
    expect(resolveHookPath(repo)).toBe(join(repo, '.githooks', 'pre-commit'));
  });
});

describe('writeHook', () => {
  it('writes a new hook when none exists', () => {
    const repo = makeRepo();
    const result = writeHook(repo, 'ce');
    expect(result.installed).toBe(true);
    expect(result.bin).toBe('ce');
    const hookPath = join(repo, HOOK_PATH);
    expect(existsSync(hookPath)).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain('exec ce --staged --hook');
  });

  it('overwrites a hook previously written by change-evidence', () => {
    const repo = makeRepo();
    writeHook(repo, 'ce');
    const result = writeHook(repo, 'change-evidence');
    expect(result.installed).toBe(true);
    const content = readFileSync(join(repo, HOOK_PATH), 'utf8');
    expect(content).toContain('exec change-evidence --staged --hook');
  });

  it('preserves an existing non-managed hook by default', () => {
    const repo = makeRepo();
    const hookPath = join(repo, HOOK_PATH);
    writeFileSync(hookPath, '#!/bin/sh\necho custom\n', { mode: 0o755 });
    const result = writeHook(repo, 'ce');
    expect(result.installed).toBe(false);
    expect(result.preserved).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain('echo custom');
  });

  it('overwrites an existing non-managed hook when force=true', () => {
    const repo = makeRepo();
    const hookPath = join(repo, HOOK_PATH);
    writeFileSync(hookPath, '#!/bin/sh\necho custom\n', { mode: 0o755 });
    const result = writeHook(repo, 'ce', true);
    expect(result.installed).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain('exec ce --staged --hook');
  });

  it('returns installed=false when not a git repo', () => {
    const dir = join(tmpdir(), `ce-nogit2-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    try {
      const result = writeHook(dir, 'ce');
      expect(result.installed).toBe(false);
      expect(result.reason).toContain('git');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('defaultAnswers', () => {
  it('derives answers from config', () => {
    const config = createDefaultConfig();
    const answers = defaultAnswers(config);
    expect(answers.install).toBe(true);
    expect(answers.language).toBe(config.language);
    expect(answers.mode).toBe(config.hook.mode);
    expect(answers.trigger.minChangedFiles).toBe(config.hook.trigger.minChangedFiles);
    expect(answers.trigger.minRiskLevel).toBe(config.hook.trigger.minRiskLevel);
  });

  it('uses hook.enabled as the default install answer', () => {
    const config = createDefaultConfig();
    config.hook.enabled = false;
    expect(defaultAnswers(config).install).toBe(false);
  });
});

describe('writeInstallConfig', () => {
  it('writes language and hook choices to .change-evidence.yml', () => {
    const repo = makeRepo();
    const configPath = writeInstallConfig(repo, {
      install: true,
      language: 'en',
      mode: 'report',
      trigger: {
        minChangedFiles: 5,
        minRiskLevel: 'low',
      },
    });

    const content = readFileSync(configPath, 'utf8');
    expect(configPath).toBe(join(repo, CONFIG_PATH));
    expect(content).toContain('language: en');
    expect(content).toContain('enabled: true');
    expect(content).toContain('mode: report');
    expect(content).toContain('minChangedFiles: 5');
    expect(content).toContain('minRiskLevel: low');
  });

  it('preserves existing risk settings while updating hook settings', () => {
    const repo = makeRepo();
    writeFileSync(join(repo, CONFIG_PATH), 'risk:\n  highPaths:\n    - "**/billing/**"\n');

    writeInstallConfig(repo, {
      install: true,
      language: 'zh-CN',
      mode: 'prompt',
      trigger: {
        minChangedFiles: 12,
        minRiskLevel: 'medium',
      },
    });

    const content = readFileSync(join(repo, CONFIG_PATH), 'utf8');
    expect(content).toContain('highPaths');
    expect(content).toContain('**/billing/**');
    expect(content).toContain('mode: prompt');
  });
});

describe('uninstallHook', () => {
  it('removes a hook written by change-evidence', () => {
    const repo = makeRepo();
    writeHook(repo, 'ce');

    const result = uninstallHook(repo);

    expect(result.removed).toBe(true);
    expect(existsSync(join(repo, HOOK_PATH))).toBe(false);
  });

  it('preserves an existing non-managed hook', () => {
    const repo = makeRepo();
    const hookPath = join(repo, HOOK_PATH);
    writeFileSync(hookPath, '#!/bin/sh\necho custom\n', { mode: 0o755 });

    const result = uninstallHook(repo);

    expect(result.removed).toBe(false);
    expect(result.preserved).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain('echo custom');
  });

  it('returns removed=false when no hook exists', () => {
    const repo = makeRepo();
    const result = uninstallHook(repo);
    expect(result.removed).toBe(false);
    expect(result.reason).toContain('not installed');
  });

  it('disables hook.enabled in existing config after removal', () => {
    const repo = makeRepo();
    writeHook(repo, 'ce');
    writeInstallConfig(repo, {
      install: true,
      language: 'zh-CN',
      mode: 'prompt',
      trigger: {
        minChangedFiles: 10,
        minRiskLevel: 'medium',
      },
    });

    const result = uninstallHook(repo);
    const content = readFileSync(join(repo, CONFIG_PATH), 'utf8');

    expect(result.removed).toBe(true);
    expect(result.configPath).toBe(join(repo, CONFIG_PATH));
    expect(content).toContain('enabled: false');
    expect(content).toContain('mode: prompt');
  });
});

describe('installHook (interactive flow)', () => {
  const config: ChangeEvidenceConfig = createDefaultConfig();

  it('writes hook using config defaults in non-interactive mode', async () => {
    const repo = makeRepo();
    const { result, answers } = await installHook(repo, config, { interactive: false });
    expect(result.installed).toBe(true);
    expect(answers.install).toBe(true);
    expect(existsSync(join(repo, HOOK_PATH))).toBe(true);
    expect(existsSync(join(repo, CONFIG_PATH))).toBe(true);
  });

  it('respects user declining the install', async () => {
    const repo = makeRepo();
    const { result, answers } = await installHook(repo, config, {
      interactive: true,
      io: {
        askChoice: async <T extends string>(_q: string, _choices: readonly T[], def: T): Promise<T> => def,
        askConfirm: async () => false,
      },
    });
    expect(answers.install).toBe(false);
    expect(result.installed).toBe(false);
    expect(existsSync(join(repo, HOOK_PATH))).toBe(false);
  });

  it('applies user answers to the install', async () => {
    const repo = makeRepo();
    const { result, answers } = await installHook(repo, config, {
      interactive: true,
      io: {
        askChoice: async <T extends string>(_q: string, _choices: readonly T[], def: T): Promise<T> => def,
        askConfirm: async () => true,
        askNumber: async () => 5,
      },
    });
    expect(result.installed).toBe(true);
    expect(answers.trigger.minChangedFiles).toBe(5);
  });

  it('surfaces preserved-hook state without writing', async () => {
    const repo = makeRepo();
    const hookPath = join(repo, HOOK_PATH);
    writeFileSync(hookPath, '#!/bin/sh\necho custom\n', { mode: 0o755 });
    const { result } = await installHook(repo, config, { interactive: false });
    expect(result.installed).toBe(false);
    expect(result.preserved).toBe(true);
    expect(readFileSync(hookPath, 'utf8')).toContain('echo custom');
  });
});
