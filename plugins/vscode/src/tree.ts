import * as vscode from 'vscode';
import type { RiskLevel, Signal } from '../../../src/api/index.js';
import {
  checklistLabels,
  riskLabel,
  signalLabel,
  text,
} from './i18n.js';
import type { AnalysisRecord, UiLanguage } from './model.js';
import { safeRepositoryUri } from './diagnostics.js';

export class RiskTreeProvider implements vscode.TreeDataProvider<RiskTreeItem> {
  private readonly changed = new vscode.EventEmitter<RiskTreeItem | undefined>();
  readonly onDidChangeTreeData = this.changed.event;
  private readonly records = new Map<string, AnalysisRecord>();

  constructor(private readonly language: UiLanguage) {}

  update(record: AnalysisRecord): void {
    this.records.set(record.repositoryRoot, record);
    this.changed.fire(undefined);
  }

  clear(): void {
    this.records.clear();
    this.changed.fire(undefined);
  }

  removeWorkspace(workspacePath: string): void {
    for (const [root, record] of this.records) {
      if (record.workspacePath === workspacePath) {
        this.records.delete(root);
      }
    }
    this.changed.fire(undefined);
  }

  getTreeItem(element: RiskTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: RiskTreeItem): RiskTreeItem[] {
    if (!element) {
      return [...this.records.values()]
        .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName))
        .map((record) => this.workspaceItem(record));
    }
    return element.children;
  }

  private workspaceItem(record: AnalysisRecord): RiskTreeItem {
    const summary = record.report.summary;
    const summaryItem = new RiskTreeItem(
      text(this.language, 'summaryLabel'),
      vscode.TreeItemCollapsibleState.None,
      [],
    );
    summaryItem.description = text(this.language, 'summaryValue', {
      files: summary.fileCount,
      additions: summary.totalAdditions,
      deletions: summary.totalDeletions,
    });
    summaryItem.iconPath = new vscode.ThemeIcon('diff');
    summaryItem.tooltip = text(this.language, 'analyzedAt', {
      time: record.analyzedAt.toLocaleString(),
    });

    const signalItems = record.report.signals.map((signal) =>
      this.signalItem(record, signal),
    );
    if (signalItems.length === 0) {
      const child = new RiskTreeItem(
        text(this.language, 'outputNoSignals'),
        vscode.TreeItemCollapsibleState.None,
        [],
      );
      child.iconPath = new vscode.ThemeIcon('pass');
      signalItems.push(child);
    }
    const signalGroup = new RiskTreeItem(
      text(this.language, 'signalsLabel'),
      vscode.TreeItemCollapsibleState.Expanded,
      signalItems,
    );
    signalGroup.description = String(signalItems.length);
    signalGroup.iconPath = new vscode.ThemeIcon('warning');

    const localizedChecklist = checklistLabels(
      record.report.signals,
      record.report.checklistItems,
      this.language,
    );
    const checklistItems = localizedChecklist.map((item) => {
      const child = new RiskTreeItem(item, vscode.TreeItemCollapsibleState.None, []);
      child.iconPath = new vscode.ThemeIcon('checklist');
      child.tooltip = item;
      return child;
    });
    if (checklistItems.length === 0) {
      const child = new RiskTreeItem(
        text(this.language, 'noChecklist'),
        vscode.TreeItemCollapsibleState.None,
        [],
      );
      child.iconPath = new vscode.ThemeIcon('pass');
      checklistItems.push(child);
    }
    const checklistGroup = new RiskTreeItem(
      text(this.language, 'checklistLabel'),
      vscode.TreeItemCollapsibleState.Collapsed,
      checklistItems,
    );
    checklistGroup.description = String(localizedChecklist.length);
    checklistGroup.iconPath = new vscode.ThemeIcon('checklist');

    const workspace = new RiskTreeItem(
      record.workspaceName,
      vscode.TreeItemCollapsibleState.Expanded,
      [summaryItem, signalGroup, checklistGroup],
    );
    workspace.description = `${riskLabel(record.report.overallRisk, this.language)} · ${
      record.scope === 'staged'
        ? text(this.language, 'scopeStaged')
        : text(this.language, 'scopeWorking')
    }`;
    workspace.tooltip = record.repositoryRoot;
    workspace.iconPath = riskIcon(record.report.overallRisk);
    return workspace;
  }

  private signalItem(record: AnalysisRecord, signal: Signal): RiskTreeItem {
    const path = signal.paths?.[0];
    const item = new RiskTreeItem(
      signalLabel(signal, this.language),
      vscode.TreeItemCollapsibleState.None,
      [],
    );
    item.description = riskLabel(signal.severity, this.language);
    item.tooltip =
      this.language === 'en'
        ? `${signalLabel(signal, this.language)}\n${signal.message}`
        : signalLabel(signal, this.language);
    item.iconPath = riskIcon(signal.severity);

    if (path) {
      const uri = safeRepositoryUri(record.repositoryRoot, path);
      if (uri) {
        item.contextValue = 'aiChangeRadar.fileRisk';
        item.resourceUri = uri;
        item.command = {
          command: 'aiChangeRadar.openFile',
          title: text(this.language, 'fileUnavailable'),
          arguments: [uri],
        };
      }
    }
    return item;
  }
}

export class RiskTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    readonly children: RiskTreeItem[],
  ) {
    super(label, collapsibleState);
  }
}

function riskIcon(level: RiskLevel): vscode.ThemeIcon {
  switch (level) {
    case 'high':
      return new vscode.ThemeIcon(
        'error',
        new vscode.ThemeColor('problemsErrorIcon.foreground'),
      );
    case 'medium':
      return new vscode.ThemeIcon(
        'warning',
        new vscode.ThemeColor('problemsWarningIcon.foreground'),
      );
    case 'low':
      return new vscode.ThemeIcon(
        'info',
        new vscode.ThemeColor('problemsInfoIcon.foreground'),
      );
    default:
      return new vscode.ThemeIcon('pass');
  }
}
