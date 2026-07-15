import { describe, it, expect } from 'vitest';
import {
  __internals,
  loadConfig,
} from '../src/config/config-loader.js';
import { createDefaultConfig } from '../src/config/defaults.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const {
  applyRawConfig,
  asLanguage,
  asHookMode,
  asRiskLevel,
  asStringArray,
  asPositiveInt,
} = __internals;

// ─── validator helpers ────────────────────────────────────────

describe('asLanguage', () => {
  it.each(['zh-CN', 'en'])('accepts %s', (v) => {
    expect(asLanguage(v)).toBe(v);
  });
  it.each(['fr', 'ZH-CN', '', undefined, null, 42])(
    'rejects %j',
    (v) => expect(asLanguage(v)).toBeUndefined(),
  );
});

describe('asHookMode', () => {
  it.each(['off', 'report', 'prompt', 'block'])('accepts %s', (v) => {
    expect(asHookMode(v)).toBe(v);
  });
  it.each(['ON', '', undefined, null])(
    'rejects %j',
    (v) => expect(asHookMode(v)).toBeUndefined(),
  );
});

describe('asRiskLevel', () => {
  it.each(['ok', 'low', 'medium', 'high'])('accepts %s', (v) => {
    expect(asRiskLevel(v)).toBe(v);
  });
  it('is case-insensitive', () => {
    expect(asRiskLevel('Medium')).toBe('medium');
    expect(asRiskLevel('HIGH')).toBe('high');
  });
  it('rejects invalid values', () => {
    expect(asRiskLevel('critical')).toBeUndefined();
    expect(asRiskLevel('')).toBeUndefined();
  });
});

describe('asStringArray', () => {
  it('accepts valid string arrays', () => {
    expect(asStringArray(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('rejects mixed arrays', () => {
    expect(asStringArray(['a', 1 as unknown as string])).toBeUndefined();
  });
  it('rejects non-arrays', () => {
    expect(asStringArray('not-array')).toBeUndefined();
    expect(asStringArray(null)).toBeUndefined();
  });
});

describe('asPositiveInt', () => {
  it.each([1, 5, 10, 100, 999999])('accepts %d', (v) => {
    expect(asPositiveInt(v)).toBe(v);
  });
  it.each([0, -1, -100, 0.5, 1.5, NaN, Infinity, -Infinity])(
    'rejects %d',
    (v) => expect(asPositiveInt(v)).toBeUndefined(),
  );
  it('rejects non-numbers', () => {
    expect(asPositiveInt('5')).toBeUndefined();
    expect(asPositiveInt(null)).toBeUndefined();
    expect(asPositiveInt(undefined)).toBeUndefined();
  });
});

// ─── applyRawConfig ───────────────────────────────────────────

describe('applyRawConfig', () => {
  const base = createDefaultConfig();

  it('overrides language', () => {
    const result = applyRawConfig(base, { language: 'en' });
    expect(result.language).toBe('en');
  });

  it('ignores invalid language silently', () => {
    const result = applyRawConfig(base, { language: 'fr' });
    expect(result.language).toBe('zh-CN');
  });

  it('overrides risk.highPaths', () => {
    const result = applyRawConfig(base, {
      risk: { highPaths: ['**/custom/**'] },
    });
    expect(result.risk.highPaths).toEqual(['**/custom/**']);
  });

  it('overrides report limits with valid positive integers', () => {
    const result = applyRawConfig(base, {
      report: { maxFiles: 5, maxRiskItems: 3, maxChecklistItems: 2, collapseLowRisk: false },
    });
    expect(result.report.maxFiles).toBe(5);
    expect(result.report.maxRiskItems).toBe(3);
    expect(result.report.maxChecklistItems).toBe(2);
    expect(result.report.collapseLowRisk).toBe(false);
  });

  it('rejects non-positive-integer report limits silently', () => {
    const result = applyRawConfig(base, {
      report: { maxFiles: -1, maxRiskItems: 0, maxChecklistItems: 1.5 },
    });
    // All three overrides are invalid — values stay at defaults.
    expect(result.report.maxFiles).toBe(20);
    expect(result.report.maxRiskItems).toBe(10);
    expect(result.report.maxChecklistItems).toBe(8);
  });

  it('overrides hook settings', () => {
    const result = applyRawConfig(base, {
      hook: { enabled: false, mode: 'block', trigger: { minChangedFiles: 5, minRiskLevel: 'high' } },
    });
    expect(result.hook.enabled).toBe(false);
    expect(result.hook.mode).toBe('block');
    expect(result.hook.trigger.minChangedFiles).toBe(5);
    expect(result.hook.trigger.minRiskLevel).toBe('high');
  });

  it('rejects non-positive-integer hook trigger thresholds', () => {
    const result = applyRawConfig(base, {
      hook: { trigger: { minChangedFiles: 0.5, minRiskLevel: 'low' } },
    });
    expect(result.hook.trigger.minChangedFiles).toBe(10); // default preserved
    expect(result.hook.trigger.minRiskLevel).toBe('low'); // string, still valid
  });

  it('rejects negative size thresholds silently', () => {
    const result = applyRawConfig(base, {
      risk: { sizeThresholds: { maxFiles: -1, maxTotalLines: -100, maxSingleFileLines: 0 } },
    });
    expect(result.risk.sizeThresholds.maxFiles).toBe(10);
    expect(result.risk.sizeThresholds.maxTotalLines).toBe(500);
    expect(result.risk.sizeThresholds.maxSingleFileLines).toBe(200);
  });

  it('does not mutate the base', () => {
    const before = JSON.parse(JSON.stringify(base));
    applyRawConfig(base, { language: 'en', report: { maxFiles: 1 } });
    expect(base).toEqual(before);
  });

  it('returns defaults when raw is null', () => {
    const result = applyRawConfig(base, null);
    expect(result.language).toBe('zh-CN');
  });

  it('returns defaults when raw is a string', () => {
    const result = applyRawConfig(base, 'not-an-object');
    expect(result.language).toBe('zh-CN');
  });
});

// ─── loadConfig with actual .change-evidence.yml ──────────────

describe('loadConfig with file', () => {
  function withConfig(yaml: string, fn: (dir: string) => void) {
    const dir = join(
      fileURLToPath(new URL('./fixtures', import.meta.url)),
      'tmp-cfg-' + Math.random().toString(36).slice(2),
    );
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, '.change-evidence.yml'), yaml);
    try {
      fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it('merges a valid .change-evidence.yml onto defaults', () => {
    withConfig(
      `
language: en
report:
  maxFiles: 5
hook:
  mode: block
  trigger:
    minRiskLevel: high
`,
      (dir) => {
        const result = loadConfig(dir);
        expect(result.source).toBe('file');
        expect(result.configPath).toContain('.change-evidence.yml');
        expect(result.config.language).toBe('en');
        expect(result.config.report.maxFiles).toBe(5);
        // Non-overridden values retain defaults.
        expect(result.config.report.maxRiskItems).toBe(10);
        expect(result.config.hook.mode).toBe('block');
        expect(result.config.hook.trigger.minRiskLevel).toBe('high');
      },
    );
  });

  it('treats an empty yaml as defaults', () => {
    withConfig('', (dir) => {
      const result = loadConfig(dir);
      expect(result.source).toBe('file');
      expect(result.config.language).toBe('zh-CN');
    });
  });

  it('handles partially valid yaml gracefully', () => {
    withConfig(
      `
language: en
risk:
  highPaths: not-an-array
report:
  maxFiles: 3
`,
      (dir) => {
        const result = loadConfig(dir);
        // language override works; invalid highPaths is ignored.
        expect(result.config.language).toBe('en');
        expect(result.config.risk.highPaths).toEqual(
          createDefaultConfig().risk.highPaths,
        );
        expect(result.config.report.maxFiles).toBe(3);
      },
    );
  });

  it('rejects negative and fractional thresholds in the config file', () => {
    withConfig(
      `
report:
  maxFiles: -1
  maxRiskItems: 0.5
hook:
  trigger:
    minChangedFiles: 0
risk:
  sizeThresholds:
    maxTotalLines: -100
`,
      (dir) => {
        const result = loadConfig(dir);
        // All invalid overrides are silently ignored.
        expect(result.config.report.maxFiles).toBe(20);
        expect(result.config.report.maxRiskItems).toBe(10);
        expect(result.config.hook.trigger.minChangedFiles).toBe(10);
        expect(result.config.risk.sizeThresholds.maxTotalLines).toBe(500);
      },
    );
  });
});
