import type { ChangeEvidenceConfig, RiskLevel, RiskReport } from '../shared/types.js';

/**
 * Severity ranking used to compare trigger thresholds against the report.
 */
const RISK_RANK: Record<RiskLevel, number> = {
  ok: 0,
  low: 1,
  medium: 2,
  high: 3,
};

/** Exit code returned by git hooks: 0 allows the commit, 1 blocks it. */
export type HookExitCode = 0 | 1;

/** Result of running the hook, for inspection by callers / tests. */
export interface HookRunResult {
  exitCode: HookExitCode;
  /** true when the report met the configured trigger conditions. */
  triggered: boolean;
  /** true when the commit was blocked. */
  blocked: boolean;
  /** true when the user was prompted (prompt mode + trigger hit). */
  prompted: boolean;
}

/**
 * Injection seam for the I/O the hook-runner needs. Defaults are wired to
 * process.stdin/stdout so the production path "just works"; tests pass mocks.
 */
export interface HookIO {
  /** Ask a yes/no question; resolve true for yes (continue). */
  promptYesNo?: (question: string) => Promise<boolean>;
  /** Write a message line to the user. */
  write?: (message: string) => void;
}

/**
 * Decide whether the report meets the configured trigger conditions.
 *
 * Trigger fires when BOTH:
 *   - changed file count >= minChangedFiles
 *   - overall risk level >= minRiskLevel
 */
export function shouldTrigger(
  report: RiskReport,
  config: ChangeEvidenceConfig,
): boolean {
  const { minChangedFiles, minRiskLevel } = config.hook.trigger;
  const filesMet = report.summary.fileCount >= minChangedFiles;
  const riskMet = RISK_RANK[report.overallRisk] >= RISK_RANK[minRiskLevel];
  return filesMet && riskMet;
}

/**
 * Run the configured hook mode against a risk report and return the exit code.
 *
 * Modes:
 *   - off / report → always exit 0 (report still rendered by caller).
 *   - prompt       → if triggered, ask user; yes → 0, no → 1.
 *   - block        → if triggered AND overall risk is high → 1, else 0.
 */
export async function runHook(
  report: RiskReport,
  config: ChangeEvidenceConfig,
  io: HookIO = {},
): Promise<HookRunResult> {
  const mode = config.hook.mode;
  const write = io.write ?? (() => undefined);
  // A missing prompt adapter must never turn prompt mode into an implicit yes.
  const promptYesNo = io.promptYesNo ?? (async () => false);

  if (!config.hook.enabled) {
    return { exitCode: 0, triggered: false, blocked: false, prompted: false };
  }

  // off: never act.
  if (mode === 'off') {
    return { exitCode: 0, triggered: false, blocked: false, prompted: false };
  }

  // report: always allow, report already printed by caller.
  if (mode === 'report') {
    return { exitCode: 0, triggered: shouldTrigger(report, config), blocked: false, prompted: false };
  }

  const triggered = shouldTrigger(report, config);

  // prompt: ask the user when triggered.
  if (mode === 'prompt') {
    if (!triggered) {
      return { exitCode: 0, triggered: false, blocked: false, prompted: false };
    }
    const proceed = await promptYesNo(
      'Risk threshold met. Continue with commit? [y/N] ',
    );
    const blocked = !proceed;
    if (blocked) {
      write('Commit aborted.');
    }
    return { exitCode: blocked ? 1 : 0, triggered: true, blocked, prompted: true };
  }

  // block: only block on explicit high risk.
  if (mode === 'block') {
    const blocked = triggered && report.overallRisk === 'high';
    if (blocked) {
      write('Commit blocked: high-risk change detected.');
    }
    return { exitCode: blocked ? 1 : 0, triggered, blocked, prompted: false };
  }

  // Unknown mode: fail safe (allow commit).
  return { exitCode: 0, triggered: false, blocked: false, prompted: false };
}
