import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseNameStatus,
  parseNumstat,
  parseUnifiedDiff,
  redactSecrets,
  extractExtension,
  buildFileChanges,
} from '../src/git/diff-parser.js';

const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), 'utf8');
}

// ─── parseNameStatus ──────────────────────────────────────────

describe('parseNameStatus', () => {
  it('parses A/M/D lines', () => {
    const raw = 'M\tfoo.ts\nA\tbar.ts\nD\tbaz.ts\n';
    const result = parseNameStatus(raw);
    expect(result.get('foo.ts')).toEqual({ status: 'modified' });
    expect(result.get('bar.ts')).toEqual({ status: 'added' });
    expect(result.get('baz.ts')).toEqual({ status: 'deleted' });
  });

  it('parses rename lines (R100)', () => {
    const raw = 'R100\told/path.ts\tnew/path.ts\n';
    const result = parseNameStatus(raw);
    expect(result.get('new/path.ts')).toEqual({ status: 'renamed', oldPath: 'old/path.ts' });
  });

  it('skips empty lines', () => {
    const result = parseNameStatus('\n\nM\tfoo.ts\n\n');
    expect(result.size).toBe(1);
  });

  it('returns empty map for empty input', () => {
    expect(parseNameStatus('').size).toBe(0);
  });

  it('parses the fixture file', () => {
    const result = parseNameStatus(fixture('name-status.txt'));
    expect(result.size).toBe(4);
    expect(result.get('src/main/java/com/example/auth/AuthService.java')).toEqual({ status: 'modified' });
    expect(result.get('src/main/resources/application.yml')).toEqual({ status: 'added' });
    expect(result.get('src/legacy/OldService.java')).toEqual({ status: 'deleted' });
    expect(result.get('src/config/Config.java')).toEqual({ status: 'renamed', oldPath: 'src/old/path/Config.java' });
  });
});

// ─── parseNumstat ─────────────────────────────────────────────

describe('parseNumstat', () => {
  it('parses normal lines', () => {
    const raw = '10\t3\tfoo.ts\n0\t0\tbar.ts\n';
    const result = parseNumstat(raw);
    expect(result.get('foo.ts')).toEqual({ additions: 10, deletions: 3 });
    expect(result.get('bar.ts')).toEqual({ additions: 0, deletions: 0 });
  });

  it('treats binary files (dash) as zero', () => {
    const raw = '-\t-\timage.png\n';
    const result = parseNumstat(raw);
    expect(result.get('image.png')).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns empty map for empty input', () => {
    expect(parseNumstat('').size).toBe(0);
  });

  it('parses the fixture file', () => {
    const result = parseNumstat(fixture('numstat.txt'));
    expect(result.get('src/main/java/com/example/auth/AuthService.java')).toEqual({ additions: 15, deletions: 3 });
    expect(result.get('src/main/resources/application.yml')).toEqual({ additions: 8, deletions: 0 });
    expect(result.get('src/config/Config.java')).toEqual({ additions: 4, deletions: 2 });
  });
});

// ─── redactSecrets ────────────────────────────────────────────

describe('redactSecrets', () => {
  it('redacts key=value patterns on diff lines', () => {
    const patch = '+  api_key = sk-1234567890abcdef';
    const result = redactSecrets(patch);
    expect(result).toContain('api_key =');
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('sk-1234567890abcdef');
  });

  it('redacts key: value patterns', () => {
    const patch = '+    password: super_secret_db_pass';
    const result = redactSecrets(patch);
    expect(result).toContain('password:');
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('super_secret_db_pass');
  });

  it('does not redact context or hunk-header lines', () => {
    const patch = '@@ -1,0 +1,2 @@\n password: visible_in_context\n+token: should_be_redacted';
    const result = redactSecrets(patch);
    // Context line (space-prefixed) is NOT redacted.
    expect(result).toContain('password: visible_in_context');
    // Added line IS redacted.
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('should_be_redacted');
  });

  it('handles multiple sensitive keys on one line', () => {
    const patch = '+  token=abc secret=def';
    const result = redactSecrets(patch);
    expect(result).toContain('***REDACTED***');
    expect(result).not.toContain('abc');
    expect(result).not.toContain('def');
  });
});

// ─── parseUnifiedDiff ─────────────────────────────────────────

describe('parseUnifiedDiff', () => {
  it('parses the fixture file into per-file patches', () => {
    const result = parseUnifiedDiff(fixture('unified-diff.txt'));
    expect(result.size).toBe(4);
    expect(result.has('src/main/java/com/example/auth/AuthService.java')).toBe(true);
    expect(result.has('src/main/resources/application.yml')).toBe(true);
    expect(result.has('src/legacy/OldService.java')).toBe(true);
    expect(result.has('src/config/Config.java')).toBe(true);
  });

  it('redacts secrets in parsed patches', () => {
    const result = parseUnifiedDiff(fixture('unified-diff.txt'));
    const authPatch = result.get('src/main/java/com/example/auth/AuthService.java') ?? '';
    expect(authPatch).toContain('api_key =');
    expect(authPatch).toContain('***REDACTED***');
    expect(authPatch).not.toContain('sk-1234567890abcdef');
    expect(authPatch).not.toContain('ghp_abcdef1234567890');

    const ymlPatch = result.get('src/main/resources/application.yml') ?? '';
    expect(ymlPatch).toContain('password:');
    expect(ymlPatch).toContain('***REDACTED***');
    expect(ymlPatch).not.toContain('super_secret_db_pass');
    expect(ymlPatch).not.toContain('eyJhbGciOiJIUzI1NiJ9');
  });

  it('accepts custom sensitive keywords', () => {
    const diff = `diff --git a/cfg.yml b/cfg.yml
--- a/cfg.yml
+++ b/cfg.yml
@@ -1,0 +1,1 @@
+  custom_key: my_custom_value`;
    const result = parseUnifiedDiff(diff, ['custom_key']);
    const patch = result.get('cfg.yml') ?? '';
    expect(patch).toContain('***REDACTED***');
    expect(patch).not.toContain('my_custom_value');
  });

  it('treats custom sensitive keywords as literals, not regex syntax', () => {
    const diff = `diff --git a/cfg.yml b/cfg.yml
--- a/cfg.yml
+++ b/cfg.yml
@@ -1,0 +1,2 @@
+  api.key: my_custom_value
+  apiXkey: should_remain`;
    const result = parseUnifiedDiff(diff, ['api.key']);
    const patch = result.get('cfg.yml') ?? '';
    expect(patch).toContain('api.key: ***REDACTED***');
    expect(patch).not.toContain('my_custom_value');
    expect(patch).toContain('apiXkey: should_remain');
  });

  it('skips binary file markers', () => {
    const diff = `diff --git a/img.png b/img.png
Binary files /dev/null and b/img.png differ
diff --git a/foo.ts b/foo.ts
--- a/foo.ts
+++ b/foo.ts
@@ -1,0 +1,1 @@
+hello`;
    const result = parseUnifiedDiff(diff);
    expect(result.has('img.png')).toBe(false);
    expect(result.get('foo.ts')).toContain('hello');
  });

  it('returns empty map for empty input', () => {
    expect(parseUnifiedDiff('').size).toBe(0);
  });
});

// ─── extractExtension ─────────────────────────────────────────

describe('extractExtension', () => {
  it.each([
    ['foo.ts', 'ts'],
    ['bar.JAVA', 'java'],
    ['baz.test.ts', 'ts'],
    ['path/to/file.yml', 'yml'],
    ['Makefile', ''],
    ['dir/.hidden', ''],
    ['README', ''],
  ])('extractExtension("%s") → "%s"', (input, expected) => {
    expect(extractExtension(input)).toBe(expected);
  });
});

// ─── buildFileChanges (integration) ──────────────────────────

describe('buildFileChanges', () => {
  it('merges the three fixture files into FileChange[]', () => {
    const files = buildFileChanges(
      fixture('name-status.txt'),
      fixture('numstat.txt'),
      fixture('unified-diff.txt'),
    );

    expect(files).toHaveLength(4);

    const auth = files.find((f) => f.path.includes('AuthService'));
    expect(auth).toBeDefined();
    expect(auth!.status).toBe('modified');
    expect(auth!.additions).toBe(15);
    expect(auth!.deletions).toBe(3);
    expect(auth!.extension).toBe('java');
    expect(auth!.patch).toContain('***REDACTED***');
    expect(auth!.patch).not.toContain('sk-1234567890abcdef');

    const yml = files.find((f) => f.path.includes('application.yml'));
    expect(yml!.status).toBe('added');
    expect(yml!.additions).toBe(8);

    const deleted = files.find((f) => f.path.includes('OldService'));
    expect(deleted!.status).toBe('deleted');

    const renamed = files.find((f) => f.path.includes('Config.java') && f.path.includes('src/config'));
    expect(renamed!.status).toBe('renamed');
    expect(renamed!.oldPath).toBe('src/old/path/Config.java');
    expect(renamed!.additions).toBe(4);
  });

  it('handles empty inputs gracefully', () => {
    const files = buildFileChanges('', '', '');
    expect(files).toHaveLength(0);
  });
});
