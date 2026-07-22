/** Language codes supported by the CLI. */
export type Language = 'zh-CN' | 'en';

/** Hook trigger mode. */
export type HookMode = 'off' | 'report' | 'prompt' | 'block';

/** Risk level ordering: ok < low < medium < high. */
export type RiskLevel = 'ok' | 'low' | 'medium' | 'high';

/** What diff scope the user asked to analyse. */
export type DiffScope = 'working-tree' | 'staged' | 'branch';

/** Machine-readable or human-readable CLI output. */
export type OutputFormat = 'terminal' | 'json';

/** Full configuration model (merged result). */
export interface ChangeEvidenceConfig {
  language: Language;
  risk: {
    highPaths: string[];
    sensitiveKeywords: string[];
    sizeThresholds: {
      maxFiles: number;
      maxTotalLines: number;
      maxSingleFileLines: number;
    };
  };
  report: {
    maxFiles: number;
    maxRiskItems: number;
    maxChecklistItems: number;
    collapseLowRisk: boolean;
  };
  hook: {
    enabled: boolean;
    mode: HookMode;
    trigger: {
      minChangedFiles: number;
      minRiskLevel: RiskLevel;
    };
  };
}

/** Raw CLI flags parsed by commander. */
export interface CliFlags {
  staged?: boolean;
  base?: string;
  language?: string;
  format?: string;
  /**
   * Untracked-file flag. Defined via `--no-untracked`, so commander stores
   * `true` by default and `false` when the flag is passed.
   */
  untracked?: boolean;
  /**
   * Color flag. Defined via `--no-color`, so commander stores the negated
   * value here: `true` by default, `false` when `--no-color` is passed.
   */
  color?: boolean;
  hook?: boolean;
}

/** Resolved options after merging CLI flags → config → defaults. */
export interface ResolvedOptions {
  scope: DiffScope;
  base?: string;
  language: Language;
  noColor: boolean;
  format: OutputFormat;
  includeUntracked: boolean;
  hookMode?: boolean;
  config: ChangeEvidenceConfig;
}

// ─── Git diff data model (prompt 02) ──────────────────────────

/** Normalized git file status. */
export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

/**
 * A single changed file as understood by Change Evidence.
 *
 * `patch` is the `git diff --unified=0` hunk text, with secret-looking
 * values redacted before it ever reaches the report layer.
 */
export interface FileChange {
  path: string;
  /** For renames, the original path; undefined otherwise. */
  oldPath?: string;
  status: FileStatus;
  /** Lines added, from numstat. Binary files report 0. */
  additions: number;
  /** Lines deleted, from numstat. Binary files report 0. */
  deletions: number;
  /** Patch hunks from `git diff --unified=0`, secrets redacted. */
  patch: string;
  /** Lowercased file extension without the leading dot (e.g. "ts", "yml"). */
  extension: string;
}

/** Aggregate diff result across all changed files in a scope. */
export interface DiffResult {
  files: FileChange[];
  totalAdditions: number;
  totalDeletions: number;
}

// ─── Risk analysis model (prompt 03) ──────────────────────────

/** Coarse category a changed file falls into, used for summarising. */
export type FileCategory =
  | 'production'
  | 'test'
  | 'config'
  | 'dependency'
  | 'migration'
  | 'ci'
  | 'documentation'
  | 'style-asset';

/** Risk severity for a single signal or file. */
export type SignalSeverity = RiskLevel; // ok | low | medium | high

/** The kind of risk signal detected. */
export type SignalType =
  | 'high-risk-path'
  | 'config-change'
  | 'dependency-change'
  | 'migration-change'
  | 'ci-change'
  | 'secret-keyword'
  | 'size-large-changeset'
  | 'size-large-single-file'
  | 'size-file-count'
  | 'test-missing'
  | 'test-deleted'
  | 'public-api-change'
  | 'low-risk-collapsed';

/** A single risk signal emitted by the analysis. */
export interface Signal {
  type: SignalType;
  severity: SignalSeverity;
  /** Human-readable reason (locale-agnostic; renderer localizes). */
  message: string;
  /** Optional file paths this signal refers to. */
  paths?: string[];
}

/** A high-risk file with the reasons it was flagged. */
export interface HighRiskFile {
  path: string;
  category: FileCategory;
  severity: SignalSeverity;
  /** Categories of reasons (matching signal types). */
  reasons: string[];
}

/** Aggregate summary of the changeset. */
export interface RiskSummary {
  fileCount: number;
  totalAdditions: number;
  totalDeletions: number;
  productionFiles: number;
  testFiles: number;
  highRiskFiles: number;
  byCategory: Record<FileCategory, number>;
}

/** Full risk report produced by the analysis engine. */
export interface RiskReport {
  /** Overall risk level (highest severity across all signals). */
  overallRisk: RiskLevel;
  summary: RiskSummary;
  highRiskFiles: HighRiskFile[];
  signals: Signal[];
  /** Number of low-risk files collapsed (documentation / style-asset). */
  collapsedLowRiskCount: number;
  /** Actionable pre-commit checklist items. */
  checklistItems: string[];
  /** Details about report items omitted by configured display limits. */
  truncation?: {
    highRiskFilesOmitted: number;
    signalsOmitted: number;
  };
}
