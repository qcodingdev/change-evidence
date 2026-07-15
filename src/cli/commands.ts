import { Command, Option, CommanderError } from 'commander';
import { execa } from 'execa';
import * as readline from 'node:readline/promises';
import { stdin as stdinStream, stdout as stdoutStream } from 'node:process';
import type {
  ChangeEvidenceConfig,
  CliFlags,
  DiffScope,
  Language,
  ResolvedOptions,
} from '../shared/types.js';
import { loadConfig, resolveLanguage } from '../config/config-loader.js';
import { getDiff } from '../git/diff-source.js';
import { analyse } from '../analysis/risk-engine.js';
import { renderReport } from '../render/terminal-report.js';
import { installHook, uninstallHook } from '../hook/install-hook.js';
import { runHook } from '../hook/hook-runner.js';
import { t } from '../render/i18n.js';
import {
  checkGlobalCliVersion,
  uninstallGlobalCli,
  updateGlobalCli,
} from './package-manager.js';
import { askHookYesNo } from './terminal-prompt.js';

export const VERSION = '0.1.1';

export type RunAnalysis = (options: ResolvedOptions) => Promise<void> | void;

export type InstallHook = (options: {
  config: ChangeEvidenceConfig;
  interactive: boolean;
  force?: boolean;
}) => Promise<void> | void;

export type UninstallHook = (options: {
  config: ChangeEvidenceConfig;
}) => Promise<void> | void;

export type UpdateCli = (options: {
  config: ChangeEvidenceConfig;
  check: boolean;
}) => Promise<void> | void;

export type UninstallCli = (options: {
  config: ChangeEvidenceConfig;
  yes: boolean;
}) => Promise<void> | void;

/**
 * Resolve the git working-tree root from cwd by running
 * `git rev-parse --show-toplevel`. Falls back to cwd on any error.
 */
async function resolveGitRoot(cwd?: string): Promise<string> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], {
      cwd: cwd ?? process.cwd(),
      reject: true,
    });
    return stdout.trim();
  } catch {
    return cwd ?? process.cwd();
  }
}

/**
 * Default analysis pipeline: diff → analyse → render → stdout.
 * When the internal --hook flag is set, also run the hook runner and exit
 * with its returned code so the pre-commit hook can block the commit.
 */
async function defaultRunAnalysis(
  options: ResolvedOptions,
  cwd?: string,
): Promise<void> {
  if (
    options.hookMode &&
    (!options.config.hook.enabled || options.config.hook.mode === 'off')
  ) {
    return;
  }

  const diff = await getDiff(options.scope, {
    base: options.base,
    cwd,
    sensitiveKeywords: options.config.risk.sensitiveKeywords,
  });
  const report = analyse(diff, options.config);
  const output = renderReport(report, {
    scope: options.scope,
    language: options.language,
    noColor: options.noColor,
  });
  process.stdout.write(output + '\n');

  if (options.hookMode) {
    const result = await runHook(report, options.config, {
      promptYesNo: (question) => askHookYesNo(question, {
        language: options.language,
      }),
      write: (m) => process.stdout.write(m + '\n'),
    });
    if (result.exitCode !== 0) {
      process.exit(result.exitCode);
    }
  }
}

/**
 * Create a readline interface lazily. Returns null when stdin is not a TTY,
 * signalling the caller to fall back to non-interactive defaults.
 */
function createRl(): readline.Interface | null {
  if (!process.stdin.isTTY) return null;
  return readline.createInterface({ input: stdinStream, output: stdoutStream });
}

async function askLine(rl: readline.Interface, question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

/**
 * Default hook installer: resolve git root, run interactive flow, write hook.
 * Falls back to config defaults when stdin is not a TTY (piped / CI / hook).
 */
async function defaultInstallHook(options: {
  config: ChangeEvidenceConfig;
  interactive: boolean;
  cwd?: string;
  force?: boolean;
}): Promise<void> {
  const repoRoot = await resolveGitRoot(options.cwd);
  const interactive = options.interactive && process.stdin.isTTY === true;

  const { result } = await installHook(repoRoot, options.config, {
    interactive,
    bin: 'ce',
    force: options.force,
    io: {
      askConfirm: async (q, def) => {
        const rl = createRl();
        if (!rl) return def;
        const hint = def ? 'Y/n' : 'y/N';
        const answer = (await askLine(rl, `${q} [${hint}] `)).toLowerCase();
        rl.close();
        if (answer === '') return def;
        return answer === 'y' || answer === 'yes';
      },
      askChoice: async (q, _choices, def) => {
        const rl = createRl();
        if (!rl) return def;
        const answer = await askLine(rl, `${q} (default: ${def}) `);
        rl.close();
        return (answer || def) as typeof def;
      },
      askNumber: async (q, def) => {
        const rl = createRl();
        if (!rl) return def;
        const answer = await askLine(rl, `${q} (default: ${def}) `);
        rl.close();
        const n = parseInt(answer, 10);
        return Number.isFinite(n) ? n : def;
      },
      write: (m) => process.stdout.write(m + '\n'),
    },
  });

  if (!result.installed && result.preserved) {
    // Existing non-managed hook — surface to user, exit non-zero so they notice.
    process.stderr.write(`change-evidence: ${result.reason ?? 'hook not installed'}\n`);
    process.exit(1);
  }
}

async function defaultUninstallHook(options: {
  config: ChangeEvidenceConfig;
  cwd?: string;
}): Promise<void> {
  const repoRoot = await resolveGitRoot(options.cwd);
  const result = uninstallHook(repoRoot);

  if (result.removed) {
    process.stdout.write(`Removed pre-commit hook at ${result.hookPath}\n`);
    if (result.configPath) {
      process.stdout.write(`Updated change-evidence config at ${result.configPath}\n`);
    }
    return;
  }

  if (result.preserved) {
    process.stderr.write(`change-evidence: ${result.reason ?? 'hook not removed'}\n`);
    process.exit(1);
  }

  process.stdout.write(`No hook removed: ${result.reason ?? 'not installed'}\n`);
}

async function confirmGlobalUninstall(language: Language): Promise<boolean> {
  const rl = createRl();
  if (!rl) {
    throw new Error(t('package.uninstallNonInteractive', language));
  }

  try {
    while (true) {
      const answer = (await askLine(
        rl,
        t('package.uninstallConfirm', language),
      )).toLowerCase();
      if (answer === 'y' || answer === 'yes') return true;
      if (answer === '' || answer === 'n' || answer === 'no') return false;
      process.stderr.write(t('hook.answerYesNo', language) + '\n');
    }
  } finally {
    rl.close();
  }
}

async function defaultUpdateCli(options: {
  config: ChangeEvidenceConfig;
  check: boolean;
}): Promise<void> {
  if (options.check) {
    await checkGlobalCliVersion(VERSION, options.config.language);
    return;
  }
  await updateGlobalCli(options.config.language);
}

async function defaultUninstallCli(options: {
  config: ChangeEvidenceConfig;
  cwd?: string;
  yes: boolean;
}): Promise<void> {
  const language = options.config.language;
  const confirmed = options.yes || await confirmGlobalUninstall(language);
  if (!confirmed) {
    process.stdout.write(t('package.uninstallCancelled', language) + '\n');
    return;
  }

  const repoRoot = await resolveGitRoot(options.cwd);
  await uninstallGlobalCli(repoRoot, language);
}

export interface CreateProgramDeps {
  runAnalysis?: RunAnalysis;
  installHook?: InstallHook;
  uninstallHook?: UninstallHook;
  updateCli?: UpdateCli;
  uninstallCli?: UninstallCli;
  cwd?: string;
  stdout?: NodeJS.WritableStream;
}

/** Priority: CLI flags > .change-evidence.yml > defaults. */
function resolveOptions(
  flags: CliFlags,
  config: ChangeEvidenceConfig,
): ResolvedOptions {
  let scope: DiffScope;
  let base: string | undefined;

  if (flags.base) {
    scope = 'branch';
    base = flags.base;
  } else if (flags.staged) {
    scope = 'staged';
  } else {
    scope = 'working-tree';
  }

  const language: Language = resolveLanguage(flags.language, config.language);

  return {
    scope,
    base,
    language,
    noColor: flags.color === false,
    hookMode: flags.hook === true,
    config,
  };
}

function buildLanguageOption(): Option {
  return new Option(
    '--language <code>',
    'output language (overrides .change-evidence.yml)',
  ).choices(['zh-CN', 'en']);
}

export function createProgram(deps: CreateProgramDeps = {}): Command {
  const {
    runAnalysis,
    installHook: installHookHandler,
    uninstallHook: uninstallHookHandler,
    updateCli: updateCliHandler,
    uninstallCli: uninstallCliHandler,
    cwd,
    stdout = process.stdout,
  } = deps;

  // Real handlers bound to cwd unless the caller injects test doubles.
  const analysis: RunAnalysis = runAnalysis ?? ((options) => defaultRunAnalysis(options, cwd));
  const doInstall: InstallHook =
    installHookHandler ?? ((options) => defaultInstallHook({ ...options, cwd }));
  const doUninstall: UninstallHook =
    uninstallHookHandler ?? ((options) => defaultUninstallHook({ ...options, cwd }));
  const doUpdateCli: UpdateCli =
    updateCliHandler ?? ((options) => defaultUpdateCli(options));
  const doUninstallCli: UninstallCli =
    uninstallCliHandler ?? ((options) => defaultUninstallCli({ ...options, cwd }));

  const program = new Command();

  program
    .name('change-evidence')
    .description('Pre-commit risk summaries for AI-assisted code changes.')
    .version(VERSION)
    .allowExcessArguments(false)
    .option('--staged', 'analyse staged changes (git diff --cached)')
    .option('--base <ref>', 'analyse branch diff against <ref> (e.g. main)')
    .addOption(buildLanguageOption())
    .option('--no-color', 'disable colored output')
    .option('--hook', 'internal flag set by the installed pre-commit hook')
    .action(async (passedFlags: CliFlags) => {
      const config = loadConfig(cwd).config;
      const options = resolveOptions(passedFlags, config);
      await analysis(options);
    });

  program
    .command('hook <action>')
    .description('manage git hooks; action: install | uninstall')
    .allowExcessArguments(false)
    .option('--force', 'overwrite an existing non-managed pre-commit hook')
    .action(async (action: string, commandOptions: { force?: boolean }) => {
      if (action !== 'install' && action !== 'uninstall') {
        throw new CommanderError(
          1,
          'change-evidence.hook.unknownAction',
          `Unknown hook action: ${action}. Supported actions: install, uninstall.`,
        );
      }
      const config = loadConfig(cwd).config;
      if (action === 'install') {
        await doInstall({ config, interactive: true, force: commandOptions.force === true });
      } else {
        await doUninstall({ config });
      }
    });

  program
    .command('install-hook')
    .description('install a pre-commit hook')
    .allowExcessArguments(false)
    .option('--force', 'overwrite an existing non-managed pre-commit hook')
    .action(async (commandOptions: { force?: boolean }) => {
      const config = loadConfig(cwd).config;
      await doInstall({ config, interactive: true, force: commandOptions.force === true });
    });

  program
    .command('uninstall-hook')
    .description('remove the managed pre-commit hook')
    .allowExcessArguments(false)
    .action(async () => {
      const config = loadConfig(cwd).config;
      await doUninstall({ config });
    });

  program
    .command('update')
    .description('update the global CLI to the latest npm version')
    .allowExcessArguments(false)
    .option('--check', 'check for an update without installing it')
    .action(async (commandOptions: { check?: boolean }) => {
      const config = loadConfig(cwd).config;
      await doUpdateCli({ config, check: commandOptions.check === true });
    });

  program
    .command('version')
    .description('show the installed and latest npm versions')
    .allowExcessArguments(false)
    .action(async () => {
      const config = loadConfig(cwd).config;
      await doUpdateCli({ config, check: true });
    });

  program
    .command('uninstall')
    .description('remove the current managed hook and uninstall the global CLI')
    .allowExcessArguments(false)
    .option('-y, --yes', 'skip the uninstall confirmation')
    .action(async (commandOptions: { yes?: boolean }) => {
      const config = loadConfig(cwd).config;
      await doUninstallCli({ config, yes: commandOptions.yes === true });
    });

  program.exitOverride();

  return program;
}

const HELP_EXIT_CODES = new Set([
  'commander.help',
  'commander.helpDisplayed',
  'commander.version',
]);

export function handleCommanderError(err: CommanderError): never {
  if (HELP_EXIT_CODES.has(err.code)) {
    process.exit(0);
  }
  process.stderr.write(`change-evidence: ${err.message}\n`);
  process.exit(1);
}
