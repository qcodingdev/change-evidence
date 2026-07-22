import { resolve, sep } from 'node:path';
import * as vscode from 'vscode';
import type { Signal } from '../../../src/api/index.js';
import { signalLabel, text } from './i18n.js';
import type { AnalysisRecord, UiLanguage } from './model.js';

export class RiskDiagnostics implements vscode.Disposable {
  private readonly collection =
    vscode.languages.createDiagnosticCollection('change-evidence');

  constructor(private readonly language: UiLanguage) {}

  async update(record: AnalysisRecord): Promise<void> {
    this.clearRepository(record.repositoryRoot);
    const grouped = new Map<string, vscode.Diagnostic[]>();

    for (const signal of record.report.signals) {
      for (const path of signal.paths ?? []) {
        const uri = safeRepositoryUri(record.repositoryRoot, path);
        if (!uri || !(await exists(uri))) continue;

        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(0, 0, 0, 1),
          text(this.language, 'problemsMessage', {
            signal: signalLabel(signal, this.language),
          }),
          diagnosticSeverity(signal),
        );
        diagnostic.source = 'AI Change Radar';
        diagnostic.code = signal.type;

        const key = uri.toString();
        grouped.set(key, [...(grouped.get(key) ?? []), diagnostic]);
      }
    }

    for (const [uri, diagnostics] of grouped) {
      this.collection.set(vscode.Uri.parse(uri), diagnostics);
    }
  }

  clear(): void {
    this.collection.clear();
  }

  dispose(): void {
    this.collection.dispose();
  }

  private clearRepository(repositoryRoot: string): void {
    const root = `${vscode.Uri.file(repositoryRoot).toString()}/`;
    for (const [uri] of this.collection) {
      if (uri.toString().startsWith(root)) {
        this.collection.delete(uri);
      }
    }
  }
}

export function safeRepositoryUri(repositoryRoot: string, relativePath: string): vscode.Uri | undefined {
  const absoluteRoot = resolve(repositoryRoot);
  const absolutePath = resolve(absoluteRoot, relativePath);
  if (absolutePath !== absoluteRoot && !absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    return undefined;
  }
  return vscode.Uri.file(absolutePath);
}

function diagnosticSeverity(signal: Signal): vscode.DiagnosticSeverity {
  switch (signal.severity) {
    case 'high':
      return vscode.DiagnosticSeverity.Error;
    case 'medium':
      return vscode.DiagnosticSeverity.Warning;
    case 'low':
      return vscode.DiagnosticSeverity.Information;
    default:
      return vscode.DiagnosticSeverity.Hint;
  }
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
