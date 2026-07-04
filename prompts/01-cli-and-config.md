# Prompt 01：实现 CLI、配置和项目入口

请实现 Change Evidence 的 CLI 基础能力，不写风险分析业务细节之外的额外功能。

## 目标

实现：

- `change-evidence` 和 `ce` 共用入口。
- `--staged`
- `--base <ref>`
- `--language zh-CN|en`
- `--no-color`
- `install-hook` / `hook install`
- `.change-evidence.yml` 配置读取。

## 要求

- 使用 `commander`。
- CLI 默认分析 working tree。
- `--staged` 分析暂存区。
- `--base main` 分析分支 diff。
- 配置优先级：CLI 参数 > `.change-evidence.yml` > 默认配置。
- 默认语言为 `zh-CN`。
- 不调用 LLM。
- 不执行危险 Git 操作。

## 输出

完成以下文件：

- `src/cli/index.ts`
- `src/cli/commands.ts`
- `src/config/defaults.ts`
- `src/config/config-loader.ts`
- `src/shared/types.ts`

并补对应测试。
