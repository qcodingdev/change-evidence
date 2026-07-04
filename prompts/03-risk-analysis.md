# Prompt 03：实现风险分析模块

请实现 Change Evidence V1 的确定性风险分析，不要使用 LLM。

## 风险信号

实现以下分析：

1. 文件分类：
   - production
   - test
   - config
   - dependency
   - migration
   - ci
   - documentation
   - style/asset

2. 高风险路径：
   - auth
   - security
   - payment
   - migration
   - database
   - config
   - CI/CD
   - secrets
   - public API

3. 测试缺失：
   - production code changed but test files unchanged
   - critical module changed with no tests
   - test files deleted

4. 大改动：
   - changed files > threshold
   - total changed lines > threshold
   - single file changed lines > threshold

5. 敏感关键词：
   - token
   - secret
   - password
   - private_key
   - api_key
   - access_key
   - authorization

6. public API 简单启发式：
   - Java public method changed
   - Controller mapping changed
   - interface changed

## 输出

输出 RiskReport 数据结构，包含：

- overallRisk
- summary
- highRiskFiles
- signals
- collapsedLowRiskCount
- checklistItems

## 修改文件

- `src/analysis/file-classifier.ts`
- `src/analysis/risk-engine.ts`
- `src/analysis/test-signal.ts`
- `src/analysis/size-signal.ts`
- `src/analysis/sensitive-signal.ts`
- `src/analysis/checklist.ts`
- `src/shared/types.ts`
