# Prompt 05：实现 pre-commit hook 安装和触发

请实现 Change Evidence V1 的 hook 能力。

## 命令

支持：

```bash
change-evidence install-hook
ce hook install
```

## 安装交互

需要询问：

1. 输出语言：中文 / English
2. 是否安装 pre-commit hook
3. hook 模式：off / report / prompt / block
4. 触发条件：
   - minChangedFiles，默认 10
   - minRiskLevel，默认 medium

## Hook 行为

Hook 写入 `.git/hooks/pre-commit`。

执行：

```bash
change-evidence --staged --hook
```

或：

```bash
ce --staged --hook
```

返回规则：

- report：输出报告后 exit 0。
- prompt：命中触发条件时询问是否继续；继续 exit 0，取消 exit 1。
- block：仅显式 high-risk block 规则命中时 exit 1。

## 安全边界

禁止执行：

- git reset
- git revert
- git add
- git commit
- git push

## 修改文件

- `src/hook/install-hook.ts`
- `src/hook/hook-runner.ts`
- `src/cli/commands.ts`
- `src/config/defaults.ts`
