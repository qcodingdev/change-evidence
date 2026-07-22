import * as vscode from 'vscode';
import type { AnalysisError, DiffScope } from '../../../src/api/index.js';
import {
  analyzeWorkspace,
  stagedDiffFingerprint,
} from './core-adapter.js';
import { RiskDiagnostics } from './diagnostics.js';
import {
  commitStagedChanges,
  existingCommitMessage,
  GitCommitError,
} from './git-api.js';
import {
  checklistLabels,
  highRiskSignalCount,
  resolveUiLanguage,
  riskLabel,
  signalLabel,
  text,
} from './i18n.js';
import type { AnalysisRecord, UiLanguage } from './model.js';
import { RiskTreeProvider } from './tree.js';

export function activate(context: vscode.ExtensionContext): void {
  const language = resolveUiLanguage(vscode.env.language);
  const controller = new ChangeEvidenceController(language);
  context.subscriptions.push(controller);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'aiChangeRadar.analyzeStaged',
      (source?: unknown) => controller.analyze('staged', source),
    ),
    vscode.commands.registerCommand(
      'aiChangeRadar.analyzeWorkingTree',
      (source?: unknown) => controller.analyze('working-tree', source),
    ),
    vscode.commands.registerCommand(
      'aiChangeRadar.reviewAndCommit',
      (source?: unknown) => controller.reviewAndCommit(source),
    ),
    vscode.commands.registerCommand('aiChangeRadar.clearResults', () =>
      controller.clear(),
    ),
    vscode.commands.registerCommand(
      'aiChangeRadar.openFile',
      (uri?: vscode.Uri) => controller.openFile(uri),
    ),
    vscode.commands.registerCommand('aiChangeRadar.showOutput', () =>
      controller.showOutput(),
    ),
  );
}

export function deactivate(): void {
  // All resources are owned by ExtensionContext subscriptions.
}

class ChangeEvidenceController implements vscode.Disposable {
  private readonly output: vscode.LogOutputChannel;
  private readonly tree: RiskTreeProvider;
  private readonly diagnostics: RiskDiagnostics;
  private readonly view: vscode.TreeView<import('./tree.js').RiskTreeItem>;
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;

  constructor(private readonly language: UiLanguage) {
    this.output = vscode.window.createOutputChannel(
      text(language, 'outputTitle'),
      { log: true },
    );
    this.tree = new RiskTreeProvider(language);
    this.diagnostics = new RiskDiagnostics(language);
    this.view = vscode.window.createTreeView('aiChangeRadar.results', {
      treeDataProvider: this.tree,
      showCollapseAll: true,
    });

    this.disposables.push(
      this.output,
      this.view,
      this.diagnostics,
      vscode.workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
          this.tree.removeWorkspace(folder.uri.fsPath);
        }
      }),
    );
    void vscode.commands.executeCommand(
      'setContext',
      'aiChangeRadar.hasResults',
      false,
    );
  }

  async analyze(
    scope: DiffScope,
    source?: unknown,
    options: { quietEmpty?: boolean } = {},
  ): Promise<AnalysisRecord | undefined> {
    const folder = await this.resolveWorkspaceFolder(source);
    if (!folder) return undefined;

    const progressTitle =
      scope === 'staged'
        ? text(this.language, 'analyzingStaged')
        : text(this.language, 'analyzingWorking');

    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: false,
      },
      async () => {
        const includeUntracked = vscode.workspace
          .getConfiguration('aiChangeRadar', folder.uri)
          .get<boolean>('includeUntracked', true);
        const outcome = await analyzeWorkspace(
          folder.uri.fsPath,
          scope,
          includeUntracked,
        );

        if (!outcome.ok) {
          const message = this.analysisError(outcome.error);
          this.output.error(message);
          this.output.show(true);
          void vscode.window.showErrorMessage(message);
          return undefined;
        }

        const record: AnalysisRecord = {
          workspaceName: folder.name,
          workspacePath: folder.uri.fsPath,
          repositoryRoot: outcome.repositoryRoot,
          scope,
          report: outcome.report,
          analyzedAt: new Date(),
          stagedFingerprint: outcome.stagedFingerprint,
        };

        this.tree.update(record);
        await this.diagnostics.update(record);
        await vscode.commands.executeCommand(
          'setContext',
          'aiChangeRadar.hasResults',
          true,
        );
        this.writeOutput(record);

        const revealOutput = vscode.workspace
          .getConfiguration('aiChangeRadar', folder.uri)
          .get<boolean>('revealOutputOnSuccess', false);
        if (revealOutput) this.output.show(true);

        if (record.report.summary.fileCount === 0) {
          if (!options.quietEmpty) {
            void vscode.window.showInformationMessage(
              scope === 'staged'
                ? text(this.language, 'noChangesStaged')
                : text(this.language, 'noChangesWorking'),
            );
          }
        } else {
          void vscode.window.setStatusBarMessage(
            `$(shield) AI Change Radar: ${riskLabel(
              record.report.overallRisk,
              this.language,
            )}`,
            5000,
          );
        }

        return record;
      },
    );
  }

  async reviewAndCommit(source?: unknown): Promise<void> {
    const record = await this.analyze('staged', source, { quietEmpty: true });
    if (!record) return;
    if (record.report.summary.fileCount === 0) {
      void vscode.window.showInformationMessage(
        text(this.language, 'noChangesStaged'),
      );
      return;
    }

    if (record.report.overallRisk === 'high') {
      const choice = await vscode.window.showWarningMessage(
        text(this.language, 'highRiskConfirm'),
        {
          modal: true,
          detail: text(this.language, 'highRiskDetail', {
            signals: highRiskSignalCount(record.report.signals),
            files: record.report.summary.fileCount,
          }),
        },
        text(this.language, 'continueCommit'),
        text(this.language, 'cancel'),
      );
      if (choice !== text(this.language, 'continueCommit')) return;
    }

    const existing = await existingCommitMessage(record.repositoryRoot);
    const message = await vscode.window.showInputBox({
      title: text(this.language, 'commitMessagePrompt'),
      prompt: text(this.language, 'commitMessagePrompt'),
      placeHolder: text(this.language, 'commitMessagePlaceHolder'),
      value: existing,
      ignoreFocusOut: true,
      validateInput: (value) =>
        value.trim().length > 0
          ? undefined
          : text(this.language, 'commitMessageRequired'),
    });
    if (message === undefined) return;

    try {
      const currentFingerprint = await stagedDiffFingerprint(
        record.repositoryRoot,
      );
      if (
        !record.stagedFingerprint ||
        currentFingerprint !== record.stagedFingerprint
      ) {
        const changed = text(this.language, 'stagedChanged');
        this.output.warn(changed);
        this.output.show(true);
        void vscode.window.showWarningMessage(changed);
        return;
      }

      await commitStagedChanges(record.repositoryRoot, message.trim());
      void vscode.window.showInformationMessage(
        text(this.language, 'commitSucceeded'),
      );
      await this.analyze('staged', source, { quietEmpty: true });
    } catch (error) {
      const message =
        error instanceof GitCommitError &&
        error.code === 'GIT_EXTENSION_UNAVAILABLE'
          ? text(this.language, 'gitExtensionUnavailable')
          : error instanceof GitCommitError &&
              error.code === 'REPOSITORY_UNAVAILABLE'
            ? text(this.language, 'repositoryUnavailable')
            : text(this.language, 'commitFailed', {
                message: errorMessage(error),
              });
      this.output.error(message);
      this.output.show(true);
      void vscode.window.showErrorMessage(message);
    }
  }

  async openFile(uri?: vscode.Uri): Promise<void> {
    if (!uri) {
      void vscode.window.showInformationMessage(
        text(this.language, 'resultUnavailable'),
      );
      return;
    }
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document, {
        preview: true,
        selection: new vscode.Range(0, 0, 0, 0),
      });
    } catch {
      void vscode.window.showWarningMessage(
        text(this.language, 'fileUnavailable'),
      );
    }
  }

  clear(): void {
    this.tree.clear();
    this.diagnostics.clear();
    this.output.clear();
    void vscode.commands.executeCommand(
      'setContext',
      'aiChangeRadar.hasResults',
      false,
    );
    void vscode.window.showInformationMessage(
      text(this.language, 'resultsCleared'),
    );
  }

  showOutput(): void {
    this.output.show(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const disposable of this.disposables.reverse()) {
      disposable.dispose();
    }
  }

  private async resolveWorkspaceFolder(
    source?: unknown,
  ): Promise<vscode.WorkspaceFolder | undefined> {
    const sourceUri = uriFromSource(source);
    if (sourceUri) {
      const direct = vscode.workspace.getWorkspaceFolder(sourceUri);
      if (direct) return direct;
      const exact = vscode.workspace.workspaceFolders?.find(
        (folder) => folder.uri.fsPath === sourceUri.fsPath,
      );
      if (exact) return exact;
    }

    const activeUri = vscode.window.activeTextEditor?.document.uri;
    const active = activeUri
      ? vscode.workspace.getWorkspaceFolder(activeUri)
      : undefined;
    if (active) return active;

    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 1) return folders[0];
    if (folders.length === 0) {
      void vscode.window.showWarningMessage(
        text(this.language, 'noWorkspace'),
      );
      return undefined;
    }

    const selected = await vscode.window.showQuickPick(
      folders.map((folder) => ({
        label: folder.name,
        description: folder.uri.fsPath,
        folder,
      })),
      {
        title: text(this.language, 'chooseWorkspace'),
        placeHolder: text(this.language, 'chooseWorkspace'),
        matchOnDescription: true,
      },
    );
    return selected?.folder;
  }

  private analysisError(error: AnalysisError): string {
    let detail: string;
    switch (error.code) {
      case 'GIT_UNAVAILABLE':
        detail = text(this.language, 'gitUnavailable');
        break;
      case 'NOT_A_REPOSITORY':
        detail = text(this.language, 'notRepository');
        break;
      case 'INVALID_REVISION':
        detail = text(this.language, 'invalidRevision');
        break;
      default:
        detail =
          error.message === 'STAGED_CHANGED_DURING_ANALYSIS'
            ? text(this.language, 'stagedChangedDuringAnalysis')
            : text(this.language, 'unexpectedError', {
                message: error.message,
              });
        break;
    }
    return text(this.language, 'analysisFailed', { message: detail });
  }

  private writeOutput(record: AnalysisRecord): void {
    const report = record.report;
    this.output.appendLine('');
    this.output.appendLine(
      `=== ${text(this.language, 'outputAnalysis')} · ${record.analyzedAt.toLocaleString()} ===`,
    );
    this.output.appendLine(
      `${text(this.language, 'outputWorkspace')}: ${record.workspaceName}`,
    );
    this.output.appendLine(
      `${text(this.language, 'outputRepository')}: ${record.repositoryRoot}`,
    );
    this.output.appendLine(
      `${text(this.language, 'outputScope')}: ${
        record.scope === 'staged'
          ? text(this.language, 'scopeStaged')
          : text(this.language, 'scopeWorking')
      }`,
    );
    this.output.appendLine(
      `${text(this.language, 'outputRisk')}: ${riskLabel(
        report.overallRisk,
        this.language,
      )}`,
    );
    this.output.appendLine(
      `${text(this.language, 'outputSummary')}: ${text(
        this.language,
        'summaryValue',
        {
          files: report.summary.fileCount,
          additions: report.summary.totalAdditions,
          deletions: report.summary.totalDeletions,
        },
      )}`,
    );
    this.output.appendLine(`${text(this.language, 'outputSignals')}:`);
    if (report.signals.length === 0) {
      this.output.appendLine(`  ✓ ${text(this.language, 'outputNoSignals')}`);
    } else {
      for (const signal of report.signals) {
        this.output.appendLine(
          `  [${riskLabel(signal.severity, this.language)}] ${signalLabel(
            signal,
            this.language,
          )}`,
        );
      }
    }
    this.output.appendLine(`${text(this.language, 'outputChecklist')}:`);
    const localizedChecklist = checklistLabels(
      report.signals,
      report.checklistItems,
      this.language,
    );
    for (const item of localizedChecklist) {
      this.output.appendLine(`  [ ] ${item}`);
    }
    if (localizedChecklist.length === 0) {
      this.output.appendLine(`  ✓ ${text(this.language, 'noChecklist')}`);
    }
  }
}

function uriFromSource(source: unknown): vscode.Uri | undefined {
  if (source instanceof vscode.Uri) return source;
  if (!source || typeof source !== 'object') return undefined;
  const candidate = source as { rootUri?: unknown; resourceUri?: unknown };
  if (candidate.rootUri instanceof vscode.Uri) return candidate.rootUri;
  if (candidate.resourceUri instanceof vscode.Uri) return candidate.resourceUri;
  return undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
