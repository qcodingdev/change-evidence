import { resolve } from 'node:path';
import * as vscode from 'vscode';

interface GitExtension {
  getAPI(version: 1): GitApi;
}

interface GitApi {
  repositories: GitRepository[];
}

interface GitRepository {
  rootUri: vscode.Uri;
  inputBox: { value: string };
  commit(message: string): Promise<void>;
}

export async function commitStagedChanges(
  repositoryRoot: string,
  message: string,
): Promise<void> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension) {
    throw new GitCommitError('GIT_EXTENSION_UNAVAILABLE');
  }

  const git = extension.isActive
    ? extension.exports
    : await extension.activate();
  const api = git.getAPI(1);
  const expected = normalized(repositoryRoot);
  const repository = api.repositories.find(
    (candidate) => normalized(candidate.rootUri.fsPath) === expected,
  );
  if (!repository) {
    throw new GitCommitError('REPOSITORY_UNAVAILABLE');
  }

  await repository.commit(message);
  if (repository.inputBox.value.trim() === message.trim()) {
    repository.inputBox.value = '';
  }
}

export async function existingCommitMessage(repositoryRoot: string): Promise<string> {
  const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
  if (!extension) return '';
  const git = extension.isActive
    ? extension.exports
    : await extension.activate();
  const expected = normalized(repositoryRoot);
  return git
    .getAPI(1)
    .repositories.find(
      (candidate) => normalized(candidate.rootUri.fsPath) === expected,
    )
    ?.inputBox.value ?? '';
}

export class GitCommitError extends Error {
  constructor(
    readonly code: 'GIT_EXTENSION_UNAVAILABLE' | 'REPOSITORY_UNAVAILABLE',
  ) {
    super(code);
    this.name = 'GitCommitError';
  }
}

function normalized(path: string): string {
  const value = resolve(path);
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
