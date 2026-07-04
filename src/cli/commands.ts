import { Command, Option, CommanderError } from 'commander';
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
    stdout = process.stdout,
  } = deps;

  const program = new Command();

  program
    .name('change-evidence')
    .description('Pre-commit risk summaries for AI-assisted code changes.')
    // Reject any positional arguments — they must be explicit subcommands.
    .allowExcessArguments(false)
    .option('--staged', 'analyse staged changes (git diff --cached)')
    .option('--base <ref>', 'analyse branch diff against <ref> (e.g. main)')
    .addOption(buildLanguageOption())
    .option('--no-color', 'disable colored output')
    .option('--hook', 'internal flag set by the installed pre-commit hook')
    .action(async (passedFlags: CliFlags) => {
      const config = loadConfig(cwd).config;
      const options = resolveOptions(passedFlags, config);
      await runAnalysis(options);
    });

  program
    .command('hook <action>')
    .description('manage git hooks; action: install')
    .allowExcessArguments(false)
    .action(async (action: string) => {
      if (action !== 'install') {
        throw new CommanderError(
          1,
          'change-evidence.hook.unknownAction',
          `Unknown hook action: ${action}. Supported action: install.`,
        );
      }
      const config = loadConfig(cwd).config;
      await installHook({ config, interactive: true });
    });

  // `install-hook` as a first-class subcommand (spec lists both forms).
  program
    .command('install-hook')
    .description('install a pre-commit hook')
    .allowExcessArguments(false)
    .action(async () => {
      const config = loadConfig(cwd).config;
      await installHook({ config, interactive: true });
    });

  // Always override exit so we can distinguish help (exit 0) from real errors.
  program.exitOverride();

  return program;
}

/**
 * Commander error codes that indicate "the user asked for help or version
 * output" — these are not errors and should exit 0.
 */
const HELP_EXIT_CODES = new Set([
  'commander.help',
  'commander.helpDisplayed',
  'commander.version',
]);

/**
 * Handle a CommanderError thrown by exitOverride. Help / version exits 0;
 * all other errors exit 1 with a message on stderr.
 */
export function handleCommanderError(err: CommanderError): never {
  if (HELP_EXIT_CODES.has(err.code)) {
    process.exit(0);
  }
  process.stderr.write(`change-evidence: ${err.message}\n`);
  process.exit(1);
}
