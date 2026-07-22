import { analyse } from '../analysis/risk-engine.js';
import { loadConfig } from '../config/config-loader.js';
import {
  getDiff,
  GitUnavailableError,
  InvalidRevisionError,
  NotARepositoryError,
} from '../git/diff-source.js';
import type {
  ChangeEvidenceConfig,
  DiffScope,
  RiskReport,
} from '../shared/types.js';

/** Options for repository analysis without any terminal or process side effects. */
export interface AnalyzeRepositoryOptions {
  /** Repository or child directory. Defaults to process.cwd(). */
  cwd?: string;
  /** Diff scope. Defaults to working-tree. */
  scope?: DiffScope;
  /** Required when scope is branch. */
  base?: string;
  /**
   * Include untracked, non-ignored files for working-tree analysis.
   * Defaults to true because users normally expect working-tree to mean all
   * current changes. It has no effect for staged or branch analysis.
   */
  includeUntracked?: boolean;
  /**
   * Apply terminal-oriented maxFiles/maxRiskItems limits to returned arrays.
   * Defaults to false so structured consumers receive complete evidence.
   */
  applyReportLimits?: boolean;
  /** Fully resolved config. Loads .change-evidence.yml when omitted. */
  config?: ChangeEvidenceConfig;
}

export type AnalysisErrorCode =
  | 'GIT_UNAVAILABLE'
  | 'NOT_A_REPOSITORY'
  | 'INVALID_REVISION'
  | 'ANALYSIS_FAILED';

export interface AnalysisError {
  code: AnalysisErrorCode;
  message: string;
}

export type AnalysisOutcome =
  | { ok: true; report: RiskReport }
  | { ok: false; error: AnalysisError };

/**
 * Analyse a repository and return a structured RiskReport.
 *
 * This API writes nothing to stdout/stderr and never calls process.exit.
 * Expected repository errors are represented by exported error classes.
 */
export async function analyzeRepository(
  options: AnalyzeRepositoryOptions = {},
): Promise<RiskReport> {
  const cwd = options.cwd ?? process.cwd();
  const scope = options.scope ?? 'working-tree';
  const config = options.config ?? loadConfig(cwd).config;
  const diff = await getDiff(scope, {
    cwd,
    base: options.base,
    includeUntracked: options.includeUntracked ?? true,
    sensitiveKeywords: config.risk.sensitiveKeywords,
  });
  return analyse(diff, config, {
    applyReportLimits: options.applyReportLimits ?? false,
  });
}

/** British-English compatibility alias matching the existing `analyse` API. */
export const analyseRepository = analyzeRepository;

/**
 * Never-throw convenience API for IDE hosts and other long-lived processes.
 * Unexpected errors are normalized rather than terminating the host process.
 */
export async function tryAnalyzeRepository(
  options: AnalyzeRepositoryOptions = {},
): Promise<AnalysisOutcome> {
  try {
    return { ok: true, report: await analyzeRepository(options) };
  } catch (error) {
    return { ok: false, error: normalizeAnalysisError(error) };
  }
}

export function normalizeAnalysisError(error: unknown): AnalysisError {
  if (error instanceof GitUnavailableError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof NotARepositoryError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof InvalidRevisionError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'ANALYSIS_FAILED',
    message: error instanceof Error ? error.message : String(error),
  };
}

export { analyse } from '../analysis/risk-engine.js';
export { createDefaultConfig } from '../config/defaults.js';
export {
  GitUnavailableError,
  InvalidRevisionError,
  NotARepositoryError,
} from '../git/diff-source.js';
export type {
  ChangeEvidenceConfig,
  DiffResult,
  DiffScope,
  FileChange,
  HighRiskFile,
  RiskLevel,
  RiskReport,
  RiskSummary,
  Signal,
} from '../shared/types.js';
