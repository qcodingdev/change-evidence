import { describe, it, expect } from 'vitest';
import { runHook, shouldTrigger } from '../src/hook/hook-runner.js';
import type { ChangeEvidenceConfig, RiskReport } from '../src/shared/types.js';
import { createDefaultConfig } from '../src/config/defaults.js';

function makeReport(fileCount: number, overallRisk: RiskReport['overallRisk']): RiskReport {
  return {
    overallRisk,
    summary: {
      fileCount,
      totalAdditions: 100,
      totalDeletions: 10,
      productionFiles: fileCount,
      testFiles: 0,
      highRiskFiles: 0,
      byCategory: {
        production: fileCount,
        test: 0,
        config: 0,
        dependency: 0,
        migration: 0,
        ci: 0,
        documentation: 0,
        'style-asset': 0,
      },
    },
    highRiskFiles: [],
    signals: [],
    collapsedLowRiskCount: 0,
    checklistItems: [],
  };
}

function makeConfig(
  mode: ChangeEvidenceConfig['hook']['mode'],
  trigger: { minChangedFiles: number; minRiskLevel: ChangeEvidenceConfig['hook']['trigger']['minRiskLevel'] } = { minChangedFiles: 10, minRiskLevel: 'medium' },
): ChangeEvidenceConfig {
  const cfg = createDefaultConfig();
  cfg.hook.mode = mode;
  cfg.hook.trigger = trigger;
  return cfg;
}

describe('shouldTrigger', () => {
  it('fires when both file count and risk meet thresholds', () => {
    const report = makeReport(12, 'high');
    const config = makeConfig('prompt');
    expect(shouldTrigger(report, config)).toBe(true);
  });

  it('does not fire when file count below threshold', () => {
    const report = makeReport(5, 'high');
    const config = makeConfig('prompt');
    expect(shouldTrigger(report, config)).toBe(false);
  });

  it('does not fire when risk below threshold', () => {
    const report = makeReport(20, 'low');
    const config = makeConfig('prompt');
    expect(shouldTrigger(report, config)).toBe(false);
  });

  it('fires when exactly at file threshold (>=)', () => {
    const report = makeReport(10, 'medium');
    const config = makeConfig('prompt');
    expect(shouldTrigger(report, config)).toBe(true);
  });

  it('fires when risk exactly at threshold', () => {
    const report = makeReport(15, 'medium');
    const config = makeConfig('prompt', { minChangedFiles: 10, minRiskLevel: 'medium' });
    expect(shouldTrigger(report, config)).toBe(true);
  });

  it('respects a low minRiskLevel', () => {
    const report = makeReport(15, 'low');
    const config = makeConfig('prompt', { minChangedFiles: 10, minRiskLevel: 'low' as const });
    expect(shouldTrigger(report, config)).toBe(true);
  });
});

describe('runHook — off mode', () => {
  it('exits 0 when hook.enabled is false', async () => {
    const config = makeConfig('prompt');
    config.hook.enabled = false;
    const report = makeReport(20, 'high');
    const result = await runHook(report, config, {
      promptYesNo: async () => {
        throw new Error('should not prompt when hook is disabled');
      },
    });
    expect(result.exitCode).toBe(0);
    expect(result.triggered).toBe(false);
    expect(result.prompted).toBe(false);
  });

  it('always exits 0 and never prompts', async () => {
    const config = makeConfig('off');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
    expect(result.triggered).toBe(false);
    expect(result.prompted).toBe(false);
  });
});

describe('runHook — report mode', () => {
  it('always exits 0', async () => {
    const config = makeConfig('report');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
    expect(result.blocked).toBe(false);
    expect(result.triggered).toBe(true); // reports the trigger state
  });

  it('exits 0 even when not triggered', async () => {
    const config = makeConfig('report');
    const report = makeReport(1, 'low');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
    expect(result.triggered).toBe(false);
  });
});

describe('runHook — prompt mode', () => {
  it('does not prompt when not triggered', async () => {
    const config = makeConfig('prompt');
    const report = makeReport(1, 'low');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
    expect(result.prompted).toBe(false);
  });

  it('prompts and allows commit on yes', async () => {
    const config = makeConfig('prompt');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config, {
      promptYesNo: async () => true,
    });
    expect(result.prompted).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it('prompts and blocks commit on no', async () => {
    const config = makeConfig('prompt');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config, {
      promptYesNo: async () => false,
      write: () => undefined,
    });
    expect(result.prompted).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.blocked).toBe(true);
  });

  it('blocks instead of silently allowing when no prompt adapter is available', async () => {
    const config = makeConfig('prompt');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config);
    expect(result.prompted).toBe(true);
    expect(result.exitCode).toBe(1);
    expect(result.blocked).toBe(true);
  });
});

describe('runHook — block mode', () => {
  it('blocks only when triggered AND overall risk is high', async () => {
    const config = makeConfig('block');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(1);
    expect(result.blocked).toBe(true);
  });

  it('does not block on medium risk', async () => {
    const config = makeConfig('block');
    const report = makeReport(20, 'medium');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
    expect(result.blocked).toBe(false);
  });

  it('does not block when not triggered', async () => {
    const config = makeConfig('block');
    const report = makeReport(1, 'low');
    const result = await runHook(report, config);
    expect(result.exitCode).toBe(0);
  });

  it('does not prompt the user', async () => {
    const config = makeConfig('block');
    const report = makeReport(20, 'high');
    const result = await runHook(report, config);
    expect(result.prompted).toBe(false);
  });
});
