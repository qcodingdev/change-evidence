import type { RiskLevel, Signal } from '../../../src/api/index.js';
import type { UiLanguage } from './model.js';

const TEXT = {
  en: {
    analyzingStaged: 'Analyzing staged changes…',
    analyzingWorking: 'Analyzing working-tree changes…',
    chooseWorkspace: 'Choose a workspace to analyze',
    noWorkspace: 'Open a folder or workspace before running AI Change Radar.',
    noChangesStaged: 'No staged changes were found.',
    noChangesWorking: 'No working-tree changes were found.',
    analysisComplete: 'AI Change Radar: {risk} risk across {files} changed file(s).',
    analysisFailed: 'AI Change Radar could not analyze this workspace: {message}',
    gitUnavailable: 'Git is not installed or is not available to the extension host.',
    notRepository: 'The selected workspace is not a Git repository.',
    invalidRevision: 'The requested Git revision is invalid.',
    unexpectedError: 'Unexpected analysis failure: {message}',
    resultsCleared: 'AI Change Radar results cleared.',
    highRiskConfirm: 'High-risk staged changes were detected. Continue with commit?',
    highRiskDetail: '{signals} high-risk signal(s) across {files} changed file(s). Review the AI Change Radar view and Problems panel before continuing.',
    continueCommit: 'Continue Commit',
    cancel: 'Cancel',
    commitMessagePrompt: 'Commit message',
    commitMessagePlaceHolder: 'Describe the reviewed change',
    commitMessageRequired: 'A commit message is required.',
    stagedChanged: 'Staged changes changed after review. Commit was canceled; run Review & Commit again.',
    stagedChangedDuringAnalysis: 'Staged changes kept changing during analysis. Wait for Git operations to finish and try again.',
    commitSucceeded: 'Commit completed after AI Change Radar review.',
    commitFailed: 'Commit failed: {message}',
    gitExtensionUnavailable: 'The built-in VS Code Git extension is unavailable.',
    repositoryUnavailable: 'The Git repository is not open in VS Code.',
    fileUnavailable: 'This file is no longer available in the working tree.',
    outputTitle: 'AI Change Radar',
    outputAnalysis: 'Analysis',
    outputWorkspace: 'Workspace',
    outputRepository: 'Repository',
    outputScope: 'Scope',
    outputRisk: 'Overall risk',
    outputSummary: 'Summary',
    outputSignals: 'Risk signals',
    outputChecklist: 'Pre-commit checklist',
    outputNoSignals: 'No risk signals detected.',
    summaryLabel: 'Summary',
    summaryValue: '{files} files, +{additions} / -{deletions}',
    signalsLabel: 'Risk signals',
    checklistLabel: 'Pre-commit checklist',
    analyzedAt: 'Analyzed {time}',
    scopeStaged: 'staged',
    scopeWorking: 'working tree',
    noChecklist: 'No additional checklist items.',
    problemsMessage: '{signal}',
    riskHigh: 'High',
    riskMedium: 'Medium',
    riskLow: 'Low',
    riskOk: 'No',
    signalHighRiskPath: 'High-risk path changed',
    signalConfigChange: 'Configuration changed',
    signalDependencyChange: 'Dependencies changed',
    signalMigrationChange: 'Database migration changed',
    signalCiChange: 'CI/CD configuration changed',
    signalSecretKeyword: 'Sensitive information indicator detected',
    signalLargeChangeset: 'Large changeset',
    signalLargeFile: 'Large single-file change',
    signalFileCount: 'Many files changed',
    signalTestMissing: 'Production code changed without test changes',
    signalTestDeleted: 'Test file deleted',
    signalPublicApi: 'Public API changed',
    signalCollapsed: 'Low-risk files collapsed',
    signalUnknown: 'Change risk detected',
    resultUnavailable: 'Run an analysis before opening a risk file.',
    checklistSecrets: 'Verify that no real credentials or sensitive values will be committed.',
    checklistTests: 'Add or run tests that cover the changed production behavior.',
    checklistDeletedTests: 'Confirm deleted tests do not remove required coverage.',
    checklistConfig: 'Validate configuration changes in the target environment.',
    checklistDependencies: 'Review dependency versions, lockfiles, and known vulnerabilities.',
    checklistMigration: 'Review migration compatibility, backup, and rollback strategy.',
    checklistCi: 'Validate the changed CI/CD workflow in a safe branch.',
    checklistHighPath: 'Have a second reviewer inspect the high-risk path.',
    checklistSize: 'Consider splitting the change into smaller, reviewable commits.',
    checklistPublicApi: 'Check compatibility for consumers of the changed public API.',
    checklistGeneric: 'Review the reported risk before committing.',
  },
  'zh-CN': {
    analyzingStaged: '正在分析暂存区变更…',
    analyzingWorking: '正在分析工作区变更…',
    chooseWorkspace: '请选择要分析的工作区',
    noWorkspace: '请先打开文件夹或工作区，再运行 AI Change Radar。',
    noChangesStaged: '未发现暂存区变更。',
    noChangesWorking: '未发现工作区变更。',
    analysisComplete: 'AI Change Radar：{files} 个变更文件，风险等级为“{risk}”。',
    analysisFailed: 'AI Change Radar 无法分析当前工作区：{message}',
    gitUnavailable: '未安装 Git，或扩展宿主无法访问 Git。',
    notRepository: '所选工作区不是 Git 仓库。',
    invalidRevision: '指定的 Git 版本无效。',
    unexpectedError: '分析发生异常：{message}',
    resultsCleared: '已清空 AI Change Radar 分析结果。',
    highRiskConfirm: '检测到高风险暂存区变更，是否仍要提交？',
    highRiskDetail: '{files} 个变更文件中发现 {signals} 个高风险信号。继续前请查看 AI Change Radar 视图和“问题”面板。',
    continueCommit: '仍然提交',
    cancel: '取消',
    commitMessagePrompt: '提交说明',
    commitMessagePlaceHolder: '说明本次已审查的变更',
    commitMessageRequired: '提交说明不能为空。',
    stagedChanged: '审查后暂存区发生了变化，本次提交已取消；请重新运行“审查并提交”。',
    stagedChangedDuringAnalysis: '分析期间暂存区持续变化。请等待 Git 操作结束后重试。',
    commitSucceeded: '已在 AI Change Radar 审查后完成提交。',
    commitFailed: '提交失败：{message}',
    gitExtensionUnavailable: 'VS Code 内置 Git 扩展不可用。',
    repositoryUnavailable: 'VS Code 中未打开对应的 Git 仓库。',
    fileUnavailable: '该文件已不在当前工作区中。',
    outputTitle: 'AI Change Radar',
    outputAnalysis: '分析结果',
    outputWorkspace: '工作区',
    outputRepository: '仓库',
    outputScope: '范围',
    outputRisk: '总体风险',
    outputSummary: '摘要',
    outputSignals: '风险信号',
    outputChecklist: '提交前检查项',
    outputNoSignals: '未检测到风险信号。',
    summaryLabel: '摘要',
    summaryValue: '{files} 个文件，+{additions} / -{deletions}',
    signalsLabel: '风险信号',
    checklistLabel: '提交前检查项',
    analyzedAt: '分析时间 {time}',
    scopeStaged: '暂存区',
    scopeWorking: '工作区',
    noChecklist: '没有额外检查项。',
    problemsMessage: '{signal}',
    riskHigh: '高',
    riskMedium: '中',
    riskLow: '低',
    riskOk: '无',
    signalHighRiskPath: '高风险路径发生变更',
    signalConfigChange: '配置文件发生变更',
    signalDependencyChange: '依赖文件发生变更',
    signalMigrationChange: '数据库迁移发生变更',
    signalCiChange: 'CI/CD 配置发生变更',
    signalSecretKeyword: '检测到敏感信息线索',
    signalLargeChangeset: '变更集规模较大',
    signalLargeFile: '单文件变更规模较大',
    signalFileCount: '变更文件较多',
    signalTestMissing: '生产代码变更但测试未变更',
    signalTestDeleted: '测试文件被删除',
    signalPublicApi: '公开 API 发生变更',
    signalCollapsed: '已折叠低风险文件',
    signalUnknown: '检测到变更风险',
    resultUnavailable: '请先运行分析，再打开风险文件。',
    checklistSecrets: '确认不会提交真实凭据或敏感值。',
    checklistTests: '补充或运行覆盖本次生产行为变更的测试。',
    checklistDeletedTests: '确认删除测试不会造成必要覆盖缺失。',
    checklistConfig: '在目标环境中验证配置变更。',
    checklistDependencies: '检查依赖版本、锁文件及已知漏洞。',
    checklistMigration: '检查迁移兼容性、备份与回滚方案。',
    checklistCi: '在安全分支中验证变更后的 CI/CD 流程。',
    checklistHighPath: '请另一位审查者复核高风险路径。',
    checklistSize: '考虑将变更拆分为更小且便于审查的提交。',
    checklistPublicApi: '检查公开 API 消费方的兼容性。',
    checklistGeneric: '提交前复核已报告的风险。',
  },
} as const;

export type TextKey = keyof typeof TEXT.en;

export function resolveUiLanguage(language: string): UiLanguage {
  return language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

export function text(
  language: UiLanguage,
  key: TextKey,
  params: Record<string, string | number> = {},
): string {
  let value: string = TEXT[language][key];
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

const SIGNAL_KEYS: Record<string, TextKey> = {
  'high-risk-path': 'signalHighRiskPath',
  'config-change': 'signalConfigChange',
  'dependency-change': 'signalDependencyChange',
  'migration-change': 'signalMigrationChange',
  'ci-change': 'signalCiChange',
  'secret-keyword': 'signalSecretKeyword',
  'size-large-changeset': 'signalLargeChangeset',
  'size-large-single-file': 'signalLargeFile',
  'size-file-count': 'signalFileCount',
  'test-missing': 'signalTestMissing',
  'test-deleted': 'signalTestDeleted',
  'public-api-change': 'signalPublicApi',
  'low-risk-collapsed': 'signalCollapsed',
};

export function signalLabel(signal: Pick<Signal, 'type' | 'paths'>, language: UiLanguage): string {
  const label = text(language, SIGNAL_KEYS[signal.type] ?? 'signalUnknown');
  const firstPath = signal.paths?.[0];
  return firstPath ? `${label}: ${firstPath}` : label;
}

export function riskLabel(level: RiskLevel, language: UiLanguage): string {
  const key: Record<RiskLevel, TextKey> = {
    high: 'riskHigh',
    medium: 'riskMedium',
    low: 'riskLow',
    ok: 'riskOk',
  };
  return text(language, key[level]);
}

export function highRiskSignalCount(signals: readonly Pick<Signal, 'severity'>[]): number {
  return signals.filter((signal) => signal.severity === 'high').length;
}

const CHECKLIST_KEYS: Record<string, TextKey> = {
  'secret-keyword': 'checklistSecrets',
  'test-missing': 'checklistTests',
  'test-deleted': 'checklistDeletedTests',
  'config-change': 'checklistConfig',
  'dependency-change': 'checklistDependencies',
  'migration-change': 'checklistMigration',
  'ci-change': 'checklistCi',
  'high-risk-path': 'checklistHighPath',
  'size-large-changeset': 'checklistSize',
  'size-large-single-file': 'checklistSize',
  'size-file-count': 'checklistSize',
  'public-api-change': 'checklistPublicApi',
};

export function checklistLabels(
  signals: readonly Pick<Signal, 'type'>[],
  originalItems: readonly string[],
  language: UiLanguage,
): string[] {
  if (language === 'en') return [...originalItems];

  const labels: string[] = [];
  const seen = new Set<TextKey>();
  for (const signal of signals) {
    const key = CHECKLIST_KEYS[signal.type];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(text(language, key));
  }
  const targetSize = originalItems.length;
  if (labels.length === 0 && targetSize > 0) {
    labels.push(text(language, 'checklistGeneric'));
  }
  return labels.slice(0, targetSize);
}
