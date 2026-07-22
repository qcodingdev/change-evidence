import type {
  DiffScope,
  RiskReport,
  Signal,
} from '../../../src/api/index.js';

export type UiLanguage = 'zh-CN' | 'en';

export interface AnalysisRecord {
  workspaceName: string;
  workspacePath: string;
  repositoryRoot: string;
  scope: DiffScope;
  report: RiskReport;
  analyzedAt: Date;
  /** Stable hash of the staged diff that produced this report. */
  stagedFingerprint?: string;
}

export interface FileRiskLocation {
  repositoryRoot: string;
  path: string;
  signal: Signal;
}
