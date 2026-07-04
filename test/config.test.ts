import { describe, it, expect } from 'vitest';
import { createDefaultConfig, DEFAULT_LANGUAGE } from '../src/config/defaults.js';
import { resolveLanguage } from '../src/config/config-loader.js';

describe('createDefaultConfig', () => {
  it('uses zh-CN as the default language', () => {
    const config = createDefaultConfig();
    expect(config.language).toBe('zh-CN');
    expect(DEFAULT_LANGUAGE).toBe('zh-CN');
  });

  it('has the spec defaults for report limits and hook', () => {
    const config = createDefaultConfig();
    expect(config.report).toEqual({
      maxFiles: 20,
      maxRiskItems: 10,
      maxChecklistItems: 8,
      collapseLowRisk: true,
    });
    expect(config.hook).toEqual({
      enabled: true,
      mode: 'prompt',
      trigger: { minChangedFiles: 10, minRiskLevel: 'medium' },
    });
  });

  it('has size thresholds matching the spec', () => {
    const config = createDefaultConfig();
    expect(config.risk.sizeThresholds).toEqual({
      maxFiles: 10,
      maxTotalLines: 500,
      maxSingleFileLines: 200,
    });
  });

  it('returns a fresh deep copy each call', () => {
    const a = createDefaultConfig();
    const b = createDefaultConfig();
    a.risk.highPaths.push('**/injected/**');
    a.report.maxFiles = 999;
    a.hook.trigger.minChangedFiles = 1;

    expect(b.risk.highPaths).not.toContain('**/injected/**');
    expect(b.report.maxFiles).toBe(20);
    expect(b.hook.trigger.minChangedFiles).toBe(10);
  });
});

describe('resolveLanguage', () => {
  it('returns the validated flag when given', () => {
    expect(resolveLanguage('en', 'zh-CN')).toBe('en');
    expect(resolveLanguage('zh-CN', 'en')).toBe('zh-CN');
  });

  it('falls back when the flag is invalid', () => {
    expect(resolveLanguage('fr', 'zh-CN')).toBe('zh-CN');
    expect(resolveLanguage(undefined, 'en')).toBe('en');
    expect(resolveLanguage('', 'zh-CN')).toBe('zh-CN');
  });
});
