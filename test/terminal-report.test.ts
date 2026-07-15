import { describe, it, expect } from 'vitest';
import { renderReport } from '../src/render/terminal-report.js';
import { analyse } from '../src/analysis/risk-engine.js';
import { createDefaultConfig } from '../src/config/defaults.js';
import type { DiffResult, FileChange, RiskReport } from '../src/shared/types.js';

function makeFile(
  path: string,
  opts: Partial<FileChange> = {},
): FileChange {
  return {
    path,
    status: 'modified',
    additions: 5,
    deletions: 2,
    patch: '',
    extension: path.includes('.') ? path.split('.').pop()!.toLowerCase() : '',
    ...opts,
  };
}

function makeDiff(files: FileChange[]): DiffResult {
  return {
    files,
    totalAdditions: files.reduce((s, f) => s + f.additions, 0),
    totalDeletions: files.reduce((s, f) => s + f.deletions, 0),
  };
}

const CONFIG = createDefaultConfig();

function analyseFiles(files: FileChange[]): RiskReport {
  return analyse(makeDiff(files), CONFIG);
}

describe('renderReport — zh-CN', () => {
  it('renders the title and scope header', () => {
    const report = analyseFiles([makeFile('src/a.ts')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('Change Evidence 代码变更证据包');
    expect(out).toContain('范围：暂存区改动');
  });

  it('renders overall risk level', () => {
    const report = analyseFiles([makeFile('src/auth/AuthService.java')]);
    const out = renderReport(report, {
      scope: 'working-tree',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('风险等级：');
    // auth path → high overall risk
    expect(out).toMatch(/高风险|high/);
  });

  it('renders summary block with all six metrics', () => {
    const report = analyseFiles([makeFile('src/a.ts'), makeFile('src/a.test.ts')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('变更文件');
    expect(out).toContain('新增行数');
    expect(out).toContain('删除行数');
    expect(out).toContain('生产代码文件');
    expect(out).toContain('测试文件');
    expect(out).toContain('高风险文件');
  });

  it('renders high-risk files with reasons', () => {
    const report = analyseFiles([makeFile('src/auth/AuthService.java')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('[HIGH]');
    expect(out).toContain('AuthService.java');
    expect(out).toContain('命中高风险路径');
  });

  it('renders test-missing signal as [WARN]', () => {
    const report = analyseFiles([makeFile('src/auth/AuthService.ts')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('[WARN]');
    expect(out).toContain('没有测试文件变更');
  });

  it('renders checklist items with [ ] markers', () => {
    const report = analyseFiles([
      makeFile('src/auth/AuthService.ts', { patch: '+  api_key = "x"' }),
    ]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('[ ]');
  });

  it('renders collapsed low-risk footer', () => {
    const report = analyseFiles([
      makeFile('src/a.ts'),
      makeFile('README.md'),
      makeFile('docs/guide.md'),
    ]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('折叠的低风险变更');
    expect(out).toContain('2 个文档、注释或样式文件已折叠');
  });

  it('renders empty diff message when no files', () => {
    const report = analyseFiles([]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).toContain('没有检测到代码变更');
  });
});

describe('renderReport — en', () => {
  it('renders English title and scope', () => {
    const report = analyseFiles([makeFile('src/a.ts')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'en',
      noColor: true,
    });
    expect(out).toContain('Change Evidence');
    expect(out).toContain('Scope:');
    expect(out).toContain('staged changes');
  });

  it('renders English summary metrics', () => {
    const report = analyseFiles([makeFile('src/a.ts')]);
    const out = renderReport(report, {
      scope: 'working-tree',
      language: 'en',
      noColor: true,
    });
    expect(out).toContain('Files changed');
    expect(out).toContain('Lines added');
    expect(out).toContain('Lines deleted');
    expect(out).toContain('Production files');
    expect(out).toContain('Test files');
    expect(out).toContain('High-risk files');
  });

  it('renders English collapsed footer', () => {
    const report = analyseFiles([makeFile('src/a.ts'), makeFile('README.md')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'en',
      noColor: true,
    });
    expect(out).toContain('1 documentation, comment, or style files collapsed');
  });
});

describe('renderReport — color handling', () => {
  it('produces no ANSI escapes when noColor is true', () => {
    const report = analyseFiles([makeFile('src/auth/AuthService.java')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).not.toMatch(/\x1b\[/);
  });

  it('includes ANSI escapes when noColor is false', () => {
    const report = analyseFiles([makeFile('src/auth/AuthService.java')]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: false,
    });
    expect(out).toMatch(/\x1b\[/);
  });
});

describe('renderReport — secret never leaked', () => {
  it('does not contain raw secret values even if patch had them', () => {
    const report = analyseFiles([
      makeFile('src/config.ts', {
        patch: '+  api_key = "sk-super-secret-12345"',
      }),
    ]);
    const out = renderReport(report, {
      scope: 'staged',
      language: 'zh-CN',
      noColor: true,
    });
    expect(out).not.toContain('sk-super-secret-12345');
  });
});

describe('renderReport — path safety', () => {
  it('escapes control characters from Git file names', () => {
    const unsafePath = 'src/auth/line\n\u001b[31m.ts';
    const report = analyseFiles([makeFile('src/a.ts')]);
    report.highRiskFiles = [{
      path: unsafePath,
      category: 'production',
      severity: 'high',
      reasons: ['high-risk-path'],
    }];
    const out = renderReport(report, {
      scope: 'staged',
      language: 'en',
      noColor: true,
    });
    expect(out).toContain('line\\n\\u001b[31m.ts');
    expect(out).not.toContain('\u001b[31m');
  });
});
