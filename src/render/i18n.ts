import type {
  DiffScope,
  FileCategory,
  Language,
  RiskLevel,
  SignalType,
} from '../shared/types.js';

/**
 * Localization table. Each message key maps to a per-language string. Some
 * strings contain placeholders ({count}, {path}, etc.) filled by the renderer.
 *
 * Both zh-CN and en are first-class; defaults are zh-CN per the spec.
 */
export const MESSAGES = {
  // Header
  'header.title': {
    'zh-CN': 'Change Evidence 代码变更证据包',
    en: 'Change Evidence — code change risk report',
  },
  'header.scope': {
    'zh-CN': '范围',
    en: 'Scope',
  },
  'header.riskLevel': {
    'zh-CN': '风险等级',
    en: 'Risk level',
  },

  // Scope labels
  'scope.working-tree': {
    'zh-CN': '工作区改动',
    en: 'working tree changes',
  },
  'scope.staged': {
    'zh-CN': '暂存区改动',
    en: 'staged changes',
  },
  'scope.branch': {
    'zh-CN': '分支对比',
    en: 'branch diff',
  },

  // Section headers
  'section.summary': { 'zh-CN': '摘要', en: 'Summary' },
  'section.highRisk': { 'zh-CN': '高风险变更', en: 'High-risk changes' },
  'section.signals': { 'zh-CN': '风险信号', en: 'Risk signals' },
  'section.checklist': { 'zh-CN': '提交前建议', en: 'Pre-commit checklist' },
  'section.collapsed': {
    'zh-CN': '折叠的低风险变更',
    en: 'Collapsed low-risk changes',
  },

  // Summary lines
  'summary.fileCount': { 'zh-CN': '变更文件', en: 'Files changed' },
  'summary.additions': { 'zh-CN': '新增行数', en: 'Lines added' },
  'summary.deletions': { 'zh-CN': '删除行数', en: 'Lines deleted' },
  'summary.productionFiles': {
    'zh-CN': '生产代码文件',
    en: 'Production files',
  },
  'summary.testFiles': { 'zh-CN': '测试文件', en: 'Test files' },
  'summary.highRiskFiles': {
    'zh-CN': '高风险文件',
    en: 'High-risk files',
  },

  // Checklist marker
  'checklist.marker': { 'zh-CN': '[ ]', en: '[ ]' },

  // Risk-level labels
  'level.high': { 'zh-CN': '高风险', en: 'high' },
  'level.medium': { 'zh-CN': '中等风险', en: 'medium' },
  'level.low': { 'zh-CN': '低风险', en: 'low' },
  'level.ok': { 'zh-CN': '无风险', en: 'none' },

  // File category reasons
  'reason.high-risk-path': { 'zh-CN': '命中高风险路径', en: 'matches high-risk path' },
  'reason.config-change': { 'zh-CN': '配置文件变更', en: 'config file changed' },
  'reason.dependency-change': { 'zh-CN': '依赖文件变更', en: 'dependency file changed' },
  'reason.migration-change': { 'zh-CN': '数据库迁移变更', en: 'database migration changed' },
  'reason.ci-change': { 'zh-CN': 'CI/CD 配置变更', en: 'CI/CD configuration changed' },
  'reason.secret-keyword': { 'zh-CN': '检测到敏感关键词', en: 'sensitive keyword detected' },
  'reason.test-deleted': { 'zh-CN': '测试文件被删除', en: 'test file deleted' },
  'reason.public-api-change': { 'zh-CN': '公开 API 变更', en: 'public API changed' },

  // Signal message templates
  'signal.test-missing': {
    'zh-CN': '生产代码有变更，但没有测试文件变更',
    en: 'Production code changed but no test files were modified',
  },
  'signal.test-deleted': {
    'zh-CN': '测试文件被删除：{path}',
    en: 'Test file deleted: {path}',
  },
  'signal.size-file-count': {
    'zh-CN': '变更文件数 ({count}) 超过阈值',
    en: 'Changed file count ({count}) exceeds threshold',
  },
  'signal.size-large-changeset': {
    'zh-CN': '总变更行数 ({count}) 超过阈值',
    en: 'Total changed lines ({count}) exceeds threshold',
  },
  'signal.size-large-single-file': {
    'zh-CN': '单文件变更行数较大：{path}',
    en: 'Single file has a large change: {path}',
  },
  'signal.secret-keyword': {
    'zh-CN': '检测到敏感关键词：{keywords}',
    en: 'Sensitive keywords detected: {keywords}',
  },
  'signal.public-api-change': {
    'zh-CN': '公开 API 变更：{path}',
    en: 'Public API changed: {path}',
  },
  'signal.low-risk-collapsed': {
    'zh-CN': '{count} 个文档/样式文件已折叠',
    en: '{count} documentation/style files collapsed',
  },
  'signal.high-risk-path': {
    'zh-CN': '高风险路径变更：{path}',
    en: 'High-risk path changed: {path}',
  },
  'signal.config-change': {
    'zh-CN': '配置文件变更：{path}',
    en: 'Config file changed: {path}',
  },
  'signal.dependency-change': {
    'zh-CN': '依赖文件变更：{path}',
    en: 'Dependency file changed: {path}',
  },
  'signal.migration-change': {
    'zh-CN': '数据库迁移变更：{path}',
    en: 'Migration changed: {path}',
  },
  'signal.ci-change': {
    'zh-CN': 'CI/CD 配置变更：{path}',
    en: 'CI/CD configuration changed: {path}',
  },

  // Collapsed footer
  'collapsed.summary': {
    'zh-CN': '{count} 个文档、注释或样式文件已折叠',
    en: '{count} documentation, comment, or style files collapsed',
  },

  // Empty report
  'empty.noChanges': {
    'zh-CN': '没有检测到代码变更，无需风险分析。',
    en: 'No code changes detected; nothing to analyse.',
  },

  // Punctuation: full-width colon for zh-CN, half-width for en.
  'punct.colon': { 'zh-CN': '：', en: ': ' },
  'punct.listJoin': { 'zh-CN': '；', en: '; ' },

  // Category labels (used in reason phrases / future use)
  'category.production': { 'zh-CN': '生产代码', en: 'production' },
  'category.test': { 'zh-CN': '测试', en: 'test' },
  'category.config': { 'zh-CN': '配置', en: 'config' },
  'category.dependency': { 'zh-CN': '依赖', en: 'dependency' },
  'category.migration': { 'zh-CN': '迁移', en: 'migration' },
  'category.ci': { 'zh-CN': 'CI/CD', en: 'CI/CD' },
  'category.documentation': { 'zh-CN': '文档', en: 'documentation' },
  'category.style-asset': { 'zh-CN': '样式/资源', en: 'style/asset' },
} as const;

export type MessageKey = keyof typeof MESSAGES;

/**
 * Translate a key into the active language, substituting {placeholder}
 * tokens from the params object.
 */
export function t(
  key: MessageKey,
  language: Language = 'zh-CN',
  params: Record<string, string | number> = {},
): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  const template = entry[language] ?? entry['zh-CN'];
  return template.replace(/\{(\w+)\}/g, (_match, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  );
}

/** Localize a DiffScope value to a human label. */
export function scopeLabel(scope: DiffScope, language: Language): string {
  return t(`scope.${scope}` as MessageKey, language);
}

/** Localize a risk level to a human label. */
export function riskLevelLabel(level: RiskLevel, language: Language): string {
  return t(`level.${level}` as MessageKey, language);
}

/** Localize a FileCategory to a human label. */
export function categoryLabel(category: FileCategory, language: Language): string {
  return t(`category.${category}` as MessageKey, language);
}
