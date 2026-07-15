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

  // Hook interaction
  'hook.confirm': {
    'zh-CN': '已达到风险阈值，是否继续提交？[y/N] ',
    en: 'Risk threshold met. Continue with commit? [y/N] ',
  },
  'hook.answerYesNo': {
    'zh-CN': '请输入 y 或 n。',
    en: 'Please answer y or n.',
  },
  'hook.noTerminal': {
    'zh-CN': 'change-evidence：没有可交互终端，提交已中止。',
    en: 'change-evidence: no interactive terminal is available; commit aborted.',
  },
  'hook.openFailed': {
    'zh-CN': 'change-evidence：无法打开确认提示，提交已中止。',
    en: 'change-evidence: unable to open confirmation prompt; commit aborted.',
  },
  'hook.readFailed': {
    'zh-CN': 'change-evidence：无法读取确认结果，提交已中止。',
    en: 'change-evidence: unable to read confirmation; commit aborted.',
  },
  'hook.commitAborted': {
    'zh-CN': '提交已中止。',
    en: 'Commit aborted.',
  },
  'hook.commitBlocked': {
    'zh-CN': '提交已阻止：检测到高风险变更。',
    en: 'Commit blocked: high-risk change detected.',
  },

  // Global package management
  'package.updateStarting': {
    'zh-CN': '正在通过 npm 更新 Change Evidence…',
    en: 'Updating Change Evidence through npm…',
  },
  'package.updateComplete': {
    'zh-CN': '更新完成。重新运行 ce --version 可查看当前版本。',
    en: 'Update complete. Run ce --version again to see the installed version.',
  },
  'package.versionCurrent': {
    'zh-CN': '当前版本：{version}',
    en: 'Current version: {version}',
  },
  'package.versionLatest': {
    'zh-CN': 'npm 最新版本：{version}',
    en: 'Latest npm version: {version}',
  },
  'package.updateAvailable': {
    'zh-CN': '发现新版本 {version}，运行 ce update 即可升级。',
    en: 'Update {version} is available. Run ce update to install it.',
  },
  'package.upToDate': {
    'zh-CN': '当前已是最新版本。',
    en: 'Change Evidence is up to date.',
  },
  'package.versionAhead': {
    'zh-CN': '当前版本高于 npm 最新版本，可能是开发版本。',
    en: 'The installed version is newer than npm latest and may be a development build.',
  },
  'package.versionUnknown': {
    'zh-CN': '无法比较版本号，请手动确认是否需要升级。',
    en: 'The versions could not be compared; check manually before updating.',
  },
  'package.uninstallConfirm': {
    'zh-CN': '将移除当前仓库的托管 Hook 并全局卸载 CLI；其他仓库的 Hook 不会自动移除。是否继续？[y/N] ',
    en: 'This removes the current managed hook and uninstalls the global CLI; hooks in other repositories are not removed. Continue? [y/N] ',
  },
  'package.uninstallNonInteractive': {
    'zh-CN': '非交互环境不会自动卸载；确认后请使用 ce uninstall --yes。',
    en: 'Refusing to uninstall non-interactively; use ce uninstall --yes after confirming the impact.',
  },
  'package.uninstallCancelled': {
    'zh-CN': '已取消卸载。',
    en: 'Uninstall cancelled.',
  },
  'package.hookRemoved': {
    'zh-CN': '已移除当前仓库的 pre-commit Hook：{path}',
    en: 'Removed the current repository pre-commit hook: {path}',
  },
  'package.hookConfigUpdated': {
    'zh-CN': '已更新配置：{path}',
    en: 'Updated configuration: {path}',
  },
  'package.noManagedHook': {
    'zh-CN': '当前目录未发现 Change Evidence 管理的 Hook。',
    en: 'No Change Evidence managed hook was found in the current directory.',
  },
  'package.customHookPreserved': {
    'zh-CN': '已保留非 Change Evidence 管理的 Hook：{path}',
    en: 'Preserved a hook not managed by Change Evidence: {path}',
  },
  'package.otherHooksWarning': {
    'zh-CN': '注意：其他仓库中的 Hook 不会自动移除；若卸载后提交失败，请重新安装 CLI，并在对应仓库运行 ce uninstall-hook。',
    en: 'Note: hooks in other repositories are not removed. If commits fail afterward, reinstall the CLI and run ce uninstall-hook in those repositories.',
  },
  'package.uninstallStarting': {
    'zh-CN': '正在通过 npm 全局卸载 Change Evidence…',
    en: 'Uninstalling Change Evidence globally through npm…',
  },
  'package.uninstallComplete': {
    'zh-CN': 'Change Evidence 已卸载。',
    en: 'Change Evidence has been uninstalled.',
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
