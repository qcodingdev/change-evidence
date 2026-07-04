# Claude 开发总 Prompt：Change Evidence V1

你现在要在本仓库实现 Change Evidence V1。

## 项目定位

Change Evidence 是一个 CLI-first 的本地代码变更风险报告工具。它主要服务使用 Claude Code、Codex、Cursor、OpenCode、Trae、Qoder 等 AI coding 工具的开发者，在 commit 前输出一份修改摘要和风险报告。

核心边界：

- 只做提交前风险输出。
- 不做 AI code review。
- 不判断代码正确性。
- 不自动修复。
- 不回滚。
- 不执行 `git reset` / `git revert` / `git add` / `git commit` / `git push`。
- 不做 GitHub Action 主入口。
- 不做多模板输出系统。
- 不默认依赖 LLM。

## V1 必须实现的能力

1. CLI 命令：
   - `change-evidence`
   - `ce`
   - `change-evidence --staged` / `ce --staged`
   - `change-evidence --base main` / `ce --base main`
   - `change-evidence install-hook` / `ce hook install`

2. Git diff 读取：
   - working tree
   - staged changes
   - branch diff
   - 基于 `git diff --name-status`、`git diff --numstat`、`git diff --unified=0`。

3. 风险分析：
   - 高风险路径：auth、security、payment、migration、database、config、CI/CD、public API。
   - 配置和依赖文件：application.yml、.env、Dockerfile、pom.xml、package.json、build.gradle。
   - 测试缺失：生产代码变化但测试文件未变化。
   - 大改动：文件数、总行数、单文件行数超过阈值。
   - 敏感关键词：token、secret、password、private_key、api_key、access_key、authorization；只检测，不打印具体值。

4. 统一终端报告：
   - 第一版只做一种格式。
   - 中文和英文都要支持。
   - 默认中文。
   - 输出要美观、颜色清晰、信息克制。
   - 低风险变更折叠。
   - 默认不超过一个终端屏幕的 1.5 倍。

5. Hook：
   - `change-evidence install-hook` / `ce hook install`。
   - 安装时选择语言。
   - 安装时选择是否安装 pre-commit hook。
   - 安装时选择 hook 模式：off / report / prompt / block。
   - 支持触发条件：改动文件数大于 10、风险等级达到 medium。
   - hook 执行 `change-evidence --staged --hook` 或 `ce --staged --hook`。

6. 配置文件：
   - `.change-evidence.yml`
   - 支持 language、risk.highPaths、report limits、hook trigger。

7. 测试：
   - git diff parser 测试。
   - file classifier 测试。
   - risk engine 测试。
   - report limiter 测试。
   - hook trigger 判断测试。

## 推荐实现顺序

1. 先实现 shared types 和默认配置。
2. 实现 git diff 读取和 parser。
3. 实现 file classifier。
4. 实现 risk engine 和各类 signals。
5. 实现 checklist。
6. 实现 terminal report renderer。
7. 实现 CLI 命令。
8. 实现 hook install 和 hook runner。
9. 补测试。
10. 运行 `npm run typecheck`、`npm test`、`npm run build`。

## 验收标准

- `ce --staged` 能输出中文风险报告。
- `ce --base main` 能输出分支 diff 风险报告。
- 高风险文件能被识别。
- 生产代码变更但测试未变更时能提示。
- `.env`、application.yml、pom.xml、Dockerfile 等能被识别。
- 敏感关键词不打印具体值。
- 低风险变更能折叠。
- `ce hook install` 能安装 pre-commit hook。
- hook 能根据文件数和风险等级触发。
- 不执行任何危险 Git 操作。
