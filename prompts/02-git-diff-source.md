# Prompt 02：实现 Git Diff 读取和解析

请实现本地 Git diff 数据读取和解析。

## 输入来源

支持：

- working tree：`git diff`
- staged：`git diff --cached`
- branch diff：`git diff <base>...HEAD`

## 需要读取

- `git diff --name-status`
- `git diff --numstat`
- `git diff --unified=0`

## 输出结构

输出结构化 changed files：

- path
- status: added / modified / deleted / renamed
- additions
- deletions
- patch snippets
- file extension

## 注意

- 要处理 Git 不存在、非 Git 仓库、没有改动等情况。
- 不要打印 patch 中的 secret 值。
- parser 要有测试 fixture。

## 修改文件

- `src/git/diff-source.ts`
- `src/git/diff-parser.ts`
- `src/shared/types.ts`
- `test/fixtures/*`
