import { describe, expect, it } from 'vitest';
import {
  checklistLabels,
  highRiskSignalCount,
  resolveUiLanguage,
  riskLabel,
  signalLabel,
  text,
} from '../src/i18n.js';

describe('resolveUiLanguage', () => {
  it('uses Chinese for all Chinese VS Code locales', () => {
    expect(resolveUiLanguage('zh-cn')).toBe('zh-CN');
    expect(resolveUiLanguage('zh-TW')).toBe('zh-CN');
  });

  it('uses English for other locales', () => {
    expect(resolveUiLanguage('en')).toBe('en');
    expect(resolveUiLanguage('ja')).toBe('en');
  });
});

describe('localized presentation', () => {
  it('substitutes message parameters', () => {
    expect(text('en', 'summaryValue', {
      files: 2,
      additions: 10,
      deletions: 4,
    })).toBe('2 files, +10 / -4');
  });

  it('localizes known signals and keeps paths visible', () => {
    const signal = {
      type: 'secret-keyword' as const,
      paths: ['src/config.ts'],
    };
    expect(signalLabel(signal, 'zh-CN')).toContain('敏感信息');
    expect(signalLabel(signal, 'zh-CN')).toContain('src/config.ts');
    expect(signalLabel(signal, 'en')).toContain('Sensitive information');
  });

  it('falls back safely for future signal types', () => {
    const signal = {
      type: 'future-signal' as never,
      paths: undefined,
    };
    expect(signalLabel(signal, 'en')).toBe('Change risk detected');
  });

  it('localizes every risk level', () => {
    expect(riskLabel('high', 'zh-CN')).toBe('高');
    expect(riskLabel('medium', 'en')).toBe('Medium');
    expect(riskLabel('ok', 'en')).toBe('No');
  });
});

describe('highRiskSignalCount', () => {
  it('counts only high-risk signals', () => {
    expect(highRiskSignalCount([
      { severity: 'high' },
      { severity: 'medium' },
      { severity: 'high' },
    ])).toBe(2);
  });
});

describe('checklistLabels', () => {
  it('localizes and deduplicates Chinese checklist items', () => {
    expect(checklistLabels(
      [
        { type: 'size-file-count' },
        { type: 'size-large-changeset' },
        { type: 'test-missing' },
      ],
      ['split', 'tests'],
      'zh-CN',
    )).toEqual([
      '考虑将变更拆分为更小且便于审查的提交。',
      '补充或运行覆盖本次生产行为变更的测试。',
    ]);
  });

  it('preserves canonical English checklist text', () => {
    expect(checklistLabels(
      [{ type: 'test-missing' }],
      ['Run focused tests.'],
      'en',
    )).toEqual(['Run focused tests.']);
  });
});
