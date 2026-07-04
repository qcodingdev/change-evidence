import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, statSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseDocument } from 'yaml';
import type { ChangeEvidenceConfig, HookMode, Language, RiskLevel } from '../shared/types.js';

/** Where pre-commit hooks live relative to a git repo root. */
export const HOOK_PATH = '.git/hooks/pre-commit';
export const CONFIG_PATH = '.change-evidence.yml';

/** Marker so we know a hook was written by us (safe to overwrite later). */
const HOOK_MARKER = '# change-evidence pre-commit hook';

/**
 * The pre-commit hook script body. Executable, calls back into the CLI with
 * the staged/hook flags so the same analysis pipeline runs.
 *
 * `bin` is the command name (either `change-evidence` or `ce`).
 */
export function buildHookScript(bin: string): string {
  return [
    '#!/bin/sh',
    HOOK_MARKER,
    `# Installed by \`change-evidence install-hook\`. Safe to remove or edit.`,
    `exec ${bin} --staged --hook`,
    '',
  ].join('\n');
}

/**
 * Resolve a path to the git hooks directory, handling the `.git` file
 * indirection used by worktrees and submodules.
 *
 * Returns undefined when not inside a git repository.
 */
export function resolveHookPath(repoRoot: string): string | undefined {
  const dotGit = join(repoRoot, '.git');
  if (!existsSync(dotGit)) return undefined;

  // A `.git` file (worktree/submodule) contains `gitdir: /path`. A real
  // `.git` directory is the normal case. Use statSync to tell them apart.
  const stat = statSync(dotGit);
  if (stat.isFile()) {
    const content = readFileSync(dotGit, 'utf8');
    if (content.startsWith('gitdir:')) {
      const gitdir = content.split('gitdir:')[1].trim();
      return join(gitdir, 'hooks', 'pre-commit');
    }
  }

  return join(dotGit, 'hooks', 'pre-commit');
}

/** Result of an install attempt, useful for tests and user messaging. */
export interface InstallResult {
  installed: boolean;
  hookPath: string;
  /** The bin name written into the hook (ce or change-evidence). */
  bin: string;
  /** Config file written during install, when install choices are persisted. */
  configPath?: string;
  /** true when an existing non-managed hook was preserved (not overwritten). */
  preserved?: boolean;
  reason?: string;
}

/** Result of a hook uninstall attempt. */
export interface UninstallResult {
  removed: boolean;
  hookPath: string;
  /** Config file updated during uninstall, when present. */
  configPath?: string;
  /** true when an existing non-managed hook was preserved. */
  preserved?: boolean;
  reason?: string;
}

/**
 * Write the pre-commit hook file. Refuses to overwrite a hook that wasn't
 * written by us (no HOOK_MARKER) unless `force` is true.
 *
 * @param repoRoot absolute path to the git working tree root
 * @param bin command to invoke from the hook
 * @param force overwrite an existing non-managed hook
 */
export function writeHook(
  repoRoot: string,
  bin: string,
  force = false,
): InstallResult {
  const hookPath = resolveHookPath(repoRoot);
  if (!hookPath) {
    return {
      installed: false,
      hookPath: join(repoRoot, HOOK_PATH),
      bin,
      reason: 'not a git repository (no .git directory)',
    };
  }

  // Preserve an existing, non-managed hook unless forced.
  if (existsSync(hookPath)) {
    const existing = readFileSync(hookPath, 'utf8');
    const isOurs = existing.includes(HOOK_MARKER);
    if (!isOurs && !force) {
      return {
        installed: false,
        hookPath,
        bin,
        preserved: true,
        reason: 'existing pre-commit hook not written by change-evidence; use force to overwrite',
      };
    }
  }

  mkdirSync(dirname(hookPath), { recursive: true });
  writeFileSync(hookPath, buildHookScript(bin), { mode: 0o755 });
  try {
    chmodSync(hookPath, 0o755);
  } catch {
    // chmod may fail on some filesystems; the write mode already set it.
  }

  return { installed: true, hookPath, bin };
}

// ─── Interactive install flow ─────────────────────────────────

/** User's answers from the interactive prompts. */
export interface HookInstallAnswers {
  install: boolean;
  language: Language;
  mode: HookMode;
  trigger: {
    minChangedFiles: number;
    minRiskLevel: RiskLevel;
  };
}

/**
 * Default answers derived from the loaded config — used as the suggested
 * values when prompting and as the non-interactive fallback.
 */
export function defaultAnswers(config: ChangeEvidenceConfig): HookInstallAnswers {
  return {
    install: config.hook.enabled,
    language: config.language,
    mode: config.hook.mode,
    trigger: {
      minChangedFiles: config.hook.trigger.minChangedFiles,
      minRiskLevel: config.hook.trigger.minRiskLevel,
    },
  };
}

/**
 * Persist the choices that affect future hook runs. Existing risk/report
 * config is preserved; only top-level language and hook settings are updated.
 */
export function writeInstallConfig(
  repoRoot: string,
  answers: HookInstallAnswers,
): string {
  const configPath = join(repoRoot, CONFIG_PATH);
  let raw = '{}\n';
  if (existsSync(configPath)) {
    try {
      raw = readFileSync(configPath, 'utf8');
    } catch {
      raw = '{}\n';
    }
  }

  let doc = parseDocument(raw);
  if (doc.errors.length > 0 || doc.contents == null) {
    doc = parseDocument('{}\n');
  }

  doc.set('language', answers.language);
  doc.set('hook', {
    enabled: answers.install,
    mode: answers.mode,
    trigger: {
      minChangedFiles: answers.trigger.minChangedFiles,
      minRiskLevel: answers.trigger.minRiskLevel,
    },
  });

  writeFileSync(configPath, String(doc), 'utf8');
  return configPath;
}

function setHookEnabledInConfig(repoRoot: string, enabled: boolean): string | undefined {
  const configPath = join(repoRoot, CONFIG_PATH);
  if (!existsSync(configPath)) return undefined;

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return undefined;
  }

  let doc = parseDocument(raw);
  if (doc.errors.length > 0 || doc.contents == null) {
    doc = parseDocument('{}\n');
  }

  if (!doc.has('hook')) {
    doc.set('hook', {});
  }
  doc.setIn(['hook', 'enabled'], enabled);

  writeFileSync(configPath, String(doc), 'utf8');
  return configPath;
}

/**
 * Remove a pre-commit hook previously written by Change Evidence. Existing
 * non-managed hooks are preserved so uninstall is safe by default.
 */
export function uninstallHook(repoRoot: string): UninstallResult {
  const hookPath = resolveHookPath(repoRoot);
  if (!hookPath) {
    return {
      removed: false,
      hookPath: join(repoRoot, HOOK_PATH),
      reason: 'not a git repository (no .git directory)',
    };
  }

  if (!existsSync(hookPath)) {
    return {
      removed: false,
      hookPath,
      reason: 'pre-commit hook is not installed',
    };
  }

  const existing = readFileSync(hookPath, 'utf8');
  if (!existing.includes(HOOK_MARKER)) {
    return {
      removed: false,
      hookPath,
      preserved: true,
      reason: 'existing pre-commit hook not written by change-evidence; preserved',
    };
  }

  unlinkSync(hookPath);
  return {
    removed: true,
    hookPath,
    configPath: setHookEnabledInConfig(repoRoot, false),
  };
}

/** Injection seam for the interactive prompts. */
export interface PromptIO {
  askConfirm?: (question: string, defaultValue: boolean) => Promise<boolean>;
  askChoice?: <T extends string>(question: string, choices: readonly T[], defaultChoice: T) => Promise<T>;
  askNumber?: (question: string, defaultValue: number) => Promise<number>;
  write?: (message: string) => void;
}

/**
 * Run the interactive install flow: ask the four questions, then write the
 * hook. Returns the install result + the resolved answers.
 *
 * In non-interactive mode (interactive=false) the config defaults are used
 * and no prompts are issued.
 */
export async function installHook(
  repoRoot: string,
  config: ChangeEvidenceConfig,
  options: {
    interactive?: boolean;
    io?: PromptIO;
    bin?: string;
    force?: boolean;
    persistConfig?: boolean;
  } = {},
): Promise<{ result: InstallResult; answers: HookInstallAnswers }> {
  const {
    interactive = true,
    io = {},
    bin = 'ce',
    force = false,
    persistConfig = true,
  } = options;
  const answers = defaultAnswers(config);

  if (interactive) {
    answers.language = (await io.askChoice?.(
      'Output language',
      ['zh-CN', 'en'] as const,
      config.language,
    )) ?? config.language;

    answers.install = (await io.askConfirm?.(
      'Install pre-commit hook?',
      true,
    )) ?? true;

    if (answers.install) {
      answers.mode = (await io.askChoice?.(
        'Hook mode',
        ['off', 'report', 'prompt', 'block'] as const,
        config.hook.mode,
      )) ?? config.hook.mode;

      answers.trigger.minChangedFiles = (await io.askNumber?.(
        'Trigger: minimum changed files',
        config.hook.trigger.minChangedFiles,
      )) ?? config.hook.trigger.minChangedFiles;

      answers.trigger.minRiskLevel = (await io.askChoice?.(
        'Trigger: minimum risk level',
        ['ok', 'low', 'medium', 'high'] as const,
        config.hook.trigger.minRiskLevel,
      )) ?? config.hook.trigger.minRiskLevel;
    }
  }

  let result: InstallResult;
  if (!answers.install) {
    const hookPath = resolveHookPath(repoRoot) ?? join(repoRoot, HOOK_PATH);
    result = {
      installed: false,
      hookPath,
      bin,
      reason: 'user declined to install',
    };
  } else {
    result = writeHook(repoRoot, bin, force);
  }

  const write = io.write ?? (() => undefined);
  if (result.installed) {
    if (persistConfig) {
      result.configPath = writeInstallConfig(repoRoot, answers);
    }
    write(`Installed pre-commit hook at ${result.hookPath}`);
    if (result.configPath) {
      write(`Wrote change-evidence config to ${result.configPath}`);
    }
  } else if (result.preserved) {
    write(`Skipped: ${result.reason}`);
  } else if (!answers.install) {
    write('No hook installed.');
  }

  return { result, answers };
}
