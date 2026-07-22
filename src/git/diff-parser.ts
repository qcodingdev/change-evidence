import type { FileChange, FileStatus } from '../shared/types.js';

/**
 * Parse the output of `git diff --name-status` into a map of
 * path → { status, oldPath? }.
 *
 * Format per line: `<status>\t<path>` or `<Rxxx>\t<old>\t<new>`.
 */
export function parseNameStatus(raw: string): Map<string, { status: FileStatus; oldPath?: string }> {
  if (raw.includes('\0')) return parseNulNameStatus(raw);

  const result = new Map<string, { status: FileStatus; oldPath?: string }>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Rename lines: R100\told_path\tnew_path
    if (trimmed.startsWith('R')) {
      const parts = trimmed.split('\t');
      if (parts.length >= 3) {
        result.set(parts[2], { status: 'renamed', oldPath: parts[1] });
      }
      continue;
    }

    // Single-char status followed by tab + path
    const tabIdx = trimmed.indexOf('\t');
    if (tabIdx === -1) continue;

    const statusCode = trimmed.slice(0, tabIdx).trim();
    const path = trimmed.slice(tabIdx + 1).trim();
    if (!path) continue;

    const status = mapStatus(statusCode);
    if (status) {
      result.set(path, { status });
    }
  }

  return result;
}

/** Parse `git diff --name-status -z` without trimming or unquoting paths. */
function parseNulNameStatus(
  raw: string,
): Map<string, { status: FileStatus; oldPath?: string }> {
  const result = new Map<string, { status: FileStatus; oldPath?: string }>();
  const tokens = raw.split('\0');

  for (let i = 0; i < tokens.length;) {
    const statusCode = tokens[i++];
    if (!statusCode) continue;

    if (statusCode.startsWith('R') || statusCode.startsWith('C')) {
      const oldPath = tokens[i++];
      const newPath = tokens[i++];
      if (!oldPath || !newPath) continue;
      if (statusCode.startsWith('R')) {
        result.set(newPath, { status: 'renamed', oldPath });
      } else {
        result.set(newPath, { status: 'added' });
      }
      continue;
    }

    const path = tokens[i++];
    const status = mapStatus(statusCode);
    if (path && status) result.set(path, { status });
  }

  return result;
}

function mapStatus(code: string): FileStatus | undefined {
  switch (code) {
    case 'A':
      return 'added';
    case 'M':
      return 'modified';
    case 'D':
      return 'deleted';
    default:
      // C (copied), R (rename — handled above), T (type change), etc.
      // Treat anything we don't explicitly handle as modified.
      if (code.length <= 2) return 'modified';
      return undefined;
  }
}

/**
 * Parse the output of `git diff --numstat` into a map of
 * path → { additions, deletions }.
 *
 * Format per line: `<additions>\t<deletions>\t<path>`.
 * Binary files show `-` for additions/deletions.
 */
export function parseNumstat(raw: string): Map<string, { additions: number; deletions: number }> {
  if (raw.includes('\0')) return parseNulNumstat(raw);

  const result = new Map<string, { additions: number; deletions: number }>();

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const parts = trimmed.split('\t');
    if (parts.length < 3) continue;

    const path = parts[2];
    if (!path) continue;

    result.set(path, {
      additions: parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0,
      deletions: parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0,
    });
  }

  return result;
}

interface ParsedNumstatRecord {
  additions: number;
  deletions: number;
  path: string;
}

function parseNumstatRecord(record: string): ParsedNumstatRecord | undefined {
  const firstTab = record.indexOf('\t');
  const secondTab = record.indexOf('\t', firstTab + 1);
  if (firstTab === -1 || secondTab === -1) return undefined;

  const additionsRaw = record.slice(0, firstTab);
  const deletionsRaw = record.slice(firstTab + 1, secondTab);
  return {
    additions: additionsRaw === '-' ? 0 : parseInt(additionsRaw, 10) || 0,
    deletions: deletionsRaw === '-' ? 0 : parseInt(deletionsRaw, 10) || 0,
    path: record.slice(secondTab + 1),
  };
}

/** Parse `git diff --numstat -z`, including its three-token rename form. */
function parseNulNumstat(
  raw: string,
): Map<string, { additions: number; deletions: number }> {
  const result = new Map<string, { additions: number; deletions: number }>();
  const tokens = raw.split('\0');

  for (let i = 0; i < tokens.length;) {
    const record = parseNumstatRecord(tokens[i++]);
    if (!record) continue;

    let path = record.path;
    if (path === '') {
      i++; // old path; stats belong to the destination path
      path = tokens[i++] ?? '';
    }
    if (!path) continue;

    result.set(path, {
      additions: record.additions,
      deletions: record.deletions,
    });
  }

  return result;
}

/**
 * Default sensitive-key patterns used to redact values from patch output.
 *
 * The regex captures the key name and separator (key = or key:), then
 * everything after it on the same line as the value — this handles
 * multi-word values like "Bearer eyJhbGci...".
 */
const DEFAULT_SENSITIVE_PATTERNS: RegExp[] = [
  /\b(token|secret|password|private_key|api_key|access_key|authorization)\s*[=:]\s*.+/gi,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Build redaction patterns for a caller-provided sensitive keyword list. */
function sensitivePatterns(keywords?: readonly string[]): RegExp[] | undefined {
  const nonEmptyKeywords = keywords?.filter((keyword) => keyword.length > 0);
  if (!nonEmptyKeywords?.length) return undefined;
  return [
    new RegExp(
      `\\b(${nonEmptyKeywords.map(escapeRegExp).join('|')})\\s*[=:]\\s*.+`,
      'gi',
    ),
  ];
}

/**
 * Redact secret-looking values from a unified-diff patch string.
 *
 * Strategy: for each line that looks like an assignment (key = value or
 * key: value) where the key matches a sensitive keyword, replace the value
 * portion with `***REDACTED***`.
 *
 * Only diff content lines (starting with + or -) are redacted; hunk headers
 * and context lines are left untouched.
 */
export function redactSecrets(patch: string, patterns: RegExp[] = DEFAULT_SENSITIVE_PATTERNS): string {
  return patch
    .split('\n')
    .map((line) => {
      // Only redact added/removed lines — hunk headers start with @@, context is space-prefixed.
      if (!line.startsWith('+') && !line.startsWith('-')) return line;
      let redacted = line;
      for (const pat of patterns) {
        redacted = redacted.replace(pat, (match) => {
          // Keep the key part, replace the value.
          const sepIdx = Math.max(match.indexOf('='), match.indexOf(':'));
          if (sepIdx === -1) return match;
          return match.slice(0, sepIdx + 1) + ' ***REDACTED***';
        });
      }
      return redacted;
    })
    .join('\n');
}

/**
 * Redact a patch using the configured keyword list. This keeps untracked-file
 * collection on the same redaction path as regular Git diffs.
 */
export function redactSecretsForKeywords(
  patch: string,
  keywords?: readonly string[],
): string {
  return redactSecrets(patch, sensitivePatterns(keywords));
}

/**
 * Parse the output of `git diff --unified=0` into a map of
 * path → patch string (secrets redacted).
 *
 * The unified diff format starts each file with:
 *   diff --git a/<path> b/<path>
 * optionally followed by rename metadata, then hunks.
 */
export function parseUnifiedDiff(
  raw: string,
  sensitiveKeywords?: string[],
  expectedPaths?: readonly string[],
): Map<string, string> {
  const result = new Map<string, string>();
  let currentPath: string | null = null;
  let currentIsBinary = false;
  let pathIndex = 0;
  const chunks: string[] = [];

  // Build custom patterns if caller provides keywords.
  const patterns = sensitivePatterns(sensitiveKeywords);

  function flush(): void {
    if (currentPath && chunks.length > 0 && !currentIsBinary) {
      result.set(currentPath, redactSecrets(chunks.join('\n'), patterns));
    }
    chunks.length = 0;
    currentPath = null;
    currentIsBinary = false;
  }

  for (const rawLine of raw.split('\n')) {
    // Git output follows the platform/checkout line endings in fixtures and
    // can therefore contain CRLF on Windows.
    const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine;
    // New file boundary.
    if (line.startsWith('diff --git ')) {
      flush();
      const expectedPath = expectedPaths?.[pathIndex++];
      if (expectedPath !== undefined) {
        currentPath = expectedPath;
        continue;
      }
      // Extract path from "diff --git a/<path> b/<path>"
      const match = line.match(/^diff --git a\/(.+?) b\/(.+)$/);
      if (match) {
        // For renames, use the destination (b/) path — consistent with name-status.
        currentPath = match[2];
      }
      continue;
    }

    // Skip binary file markers — no patch content to parse.
    if (line.startsWith('Binary files') || line === 'GIT binary patch') {
      currentIsBinary = true;
      continue;
    }

    if (currentPath) {
      chunks.push(line);
    }
  }

  flush();
  return result;
}

/**
 * Extract the file extension from a path, lowercased, without the dot.
 * Returns empty string for paths without an extension (including dotfiles
 * like `.gitignore` whose basename starts with a dot and has no further dot).
 */
export function extractExtension(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const basename = path.slice(lastSlash + 1);
  const lastDot = basename.lastIndexOf('.');
  // No dot, or the only dot is the leading dot of a dotfile.
  if (lastDot <= 0) return '';
  return basename.slice(lastDot + 1).toLowerCase();
}

/**
 * Merge the three git diff outputs into a unified FileChange[].
 *
 * This is the primary entry point for callers that have already collected
 * raw output from the three git commands.
 */
export function buildFileChanges(
  nameStatusRaw: string,
  numstatRaw: string,
  unifiedDiffRaw: string,
  sensitiveKeywords?: string[],
): FileChange[] {
  const statuses = parseNameStatus(nameStatusRaw);
  const stats = parseNumstat(numstatRaw);
  const patches = parseUnifiedDiff(
    unifiedDiffRaw,
    sensitiveKeywords,
    [...statuses.keys()],
  );

  const files: FileChange[] = [];

  for (const [path, { status, oldPath }] of statuses) {
    const stat = stats.get(path);
    files.push({
      path,
      oldPath,
      status,
      additions: stat?.additions ?? 0,
      deletions: stat?.deletions ?? 0,
      patch: patches.get(path) ?? '',
      extension: extractExtension(path),
    });
  }

  return files;
}
