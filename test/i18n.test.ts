import { describe, it, expect } from 'vitest';
import { t, scopeLabel, riskLevelLabel, MESSAGES, type MessageKey } from '../src/render/i18n.js';

describe('t', () => {
  it('returns zh-CN string by default', () => {
    expect(t('header.title')).toBe('Change Evidence 代码变更证据包');
    expect(t('section.summary')).toBe('摘要');
  });

  it('returns en string when language is en', () => {
    expect(t('header.title', 'en')).toBe('Change Evidence — code change risk report');
    expect(t('section.summary', 'en')).toBe('Summary');
  });

  it('substitutes {placeholder} params', () => {
    expect(
      t('collapsed.summary', 'zh-CN', { count: 5 }),
    ).toBe('5 个文档、注释或样式文件已折叠');
    expect(
      t('collapsed.summary', 'en', { count: 5 }),
    ).toBe('5 documentation, comment, or style files collapsed');
  });

  it('localizes hook interaction messages', () => {
    expect(t('hook.confirm', 'zh-CN')).toContain('是否继续提交');
    expect(t('hook.confirm', 'en')).toContain('Continue with commit');
    expect(t('hook.noTerminal', 'zh-CN')).toContain('提交已中止');
  });

  it('localizes package management messages', () => {
    expect(t('package.updateStarting', 'zh-CN')).toContain('正在通过 npm 更新');
    expect(t('package.updateAvailable', 'zh-CN', { version: '0.2.0' })).toContain('ce update');
    expect(t('package.upToDate', 'en')).toContain('up to date');
    expect(t('package.uninstallConfirm', 'en')).toContain('uninstalls the global CLI');
    expect(t('package.otherHooksWarning', 'zh-CN')).toContain('其他仓库');
  });

  it('leaves unmatched placeholders in place', () => {
    expect(t('collapsed.summary', 'zh-CN', {})).toBe('{count} 个文档、注释或样式文件已折叠');
  });

  it('falls back to zh-CN for an unsupported language value at runtime', () => {
    // Simulate a value that bypassed validation; t() must not throw and must
    // fall back to the zh-CN template.
    const badLang = 'fr' as unknown as Parameters<typeof t>[1];
    expect(t('section.summary', badLang)).toBe('摘要');
  });
});

describe('scopeLabel', () => {
  it('localizes each scope in zh-CN', () => {
    expect(scopeLabel('working-tree', 'zh-CN')).toBe('工作区改动');
    expect(scopeLabel('staged', 'zh-CN')).toBe('暂存区改动');
    expect(scopeLabel('branch', 'zh-CN')).toBe('分支对比');
  });

  it('localizes each scope in en', () => {
    expect(scopeLabel('working-tree', 'en')).toBe('working tree changes');
    expect(scopeLabel('staged', 'en')).toBe('staged changes');
    expect(scopeLabel('branch', 'en')).toBe('branch diff');
  });
});

describe('riskLevelLabel', () => {
  it('localizes each level', () => {
    expect(riskLevelLabel('high', 'zh-CN')).toBe('高风险');
    expect(riskLevelLabel('high', 'en')).toBe('high');
    expect(riskLevelLabel('ok', 'en')).toBe('none');
  });
});

describe('MESSAGES completeness', () => {
  // Both languages must define every key.
  const keys = Object.keys(MESSAGES) as MessageKey[];

  it('every key has zh-CN and en values', () => {
    for (const key of keys) {
      expect(MESSAGES[key]['zh-CN'], `key ${key} missing zh-CN`).toBeTruthy();
      expect(MESSAGES[key].en, `key ${key} missing en`).toBeTruthy();
    }
  });

  it('covers all signal types', () => {
    const signalTypes = [
      'high-risk-path',
      'config-change',
      'dependency-change',
      'migration-change',
      'ci-change',
      'secret-keyword',
      'size-large-changeset',
      'size-large-single-file',
      'size-file-count',
      'test-missing',
      'test-deleted',
      'public-api-change',
      'low-risk-collapsed',
    ];
    for (const st of signalTypes) {
      expect(`signal.${st}`).toMatch(/^signal\./);
      expect(MESSAGES[`signal.${st}` as MessageKey]).toBeDefined();
    }
  });
});
