import { Command, Option } from 'commander';
import type {
  ChangeEvidenceConfig,
  CliFlags,
  DiffScope,
  Language,
  ResolvedOptions,
} from '../shared/types.js';
import { loadConfig, resolveLanguage } from '../config/config-loader.js';

/**
 * Placeholder for the real analysis run (implemented in a later prompt).
 * Kept minimal so this module stays within prompt 01's CLI/config scope.
 */
export type RunAnalysis = (options: ResolvedOptions) => Promise<void> | void;

/**
 * Placeholder for the real hook installer (implemented in a later prompt).
 */
export type InstallHook = (options: {
  config: ChangeEvidenceConfig;
  interactive: boolean;
}) => Promise<void> | void;

export interface CreateProgramDeps {
  runAnalysis?: RunAnalysis;
  installHook?: InstallHook;
  cwd?: string;
  exitProcess?: boolean;
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

/**
 * Build the commander program. Both `change-evidence` and `ce` share this
 * single program; the bin name is cosmetic.
 */
export function createProgram(deps: CreateProgramDeps = {}): Command {
  const {
    runAnalysis = () => undefined,
    installHook = () => undefined,
    cwd,
    exitProcess = true,
    stdout = process.stdout,
  } = deps;

  const program = new Command();

  program
    .name('change-evidence')
    .description('Pre-commit risk summaries for AI-assisted code changes.')
    .argument(
      '[install-hook]',
      'install a pre-commit hook (alias: use the `hook` subcommand)',
    )
    .option('--staged', 'analyse staged changes (git diff --cached)')
    .option('--base <ref>', 'analyse branch diff against <ref> (e.g. main)')
    .addOption(buildLanguageOption())
    .option('--no-color', 'disable colored output')
    .option('--hook', 'internal flag set by the installed pre-commit hook')
    .action(async (positional, passedFlags: CliFlags) => {
      // Positional `install-hook` is tolerated as a convenience alias.
      if (positional === 'install-hook') {
        const config = loadConfig(cwd).config;
        await installHook({ config, interactive: true });
        return;
      }

      const config = loadConfig(cwd).config;
      const options = resolveOptions(passedFlags, config);
      await runAnalysis(options);
    });

  program
    .command('hook <action>')
    .description('manage git hooks; action: install')
    .action(async (action: string) => {
      if (action !== 'install') {
        stdout.write(
          `Unknown hook action: ${action}. Supported action: install.\n`,
        );
        if (exitProcess) process.exit(1);
        return;
      }
      const config = loadConfig(cwd).config;
      await installHook({ config, interactive: true });
    });

  // `install-hook` as a first-class subcommand (spec lists both forms).
  program
    .command('install-hook')
    .description('install a pre-commit hook')
    .action(async () => {
      const config = loadConfig(cwd).config;
      await installHook({ config, interactive: true });
    });

  program.exitOverride();
  if (!exitProcess) {
    // Prevent commander from calling process.exit on --help / errors when the
    // caller (e.g. a test harness) wants to keep the process alive.
  }

  return program;
}
