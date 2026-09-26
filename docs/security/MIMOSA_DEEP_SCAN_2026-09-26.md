# Mimosa Security Scan

- Scan: `scan-2026-09-26T04-45-57.128Z-5c571064231b`
- Created: 2026-09-26T04:45:57.128Z
- Depth: deep
- Run status: **inconclusive**
- Findings: 43 (0 business-logic candidate)
- 覆盖缺口:
  - 部分分析阶段未能完整覆盖
  - 调用图部分不完整:部分调用为动态派发或超出分析规模,跨文件可达性可能不完整
- Verdict effect: `none`

## Findings

### HIGH · 命令注入 (oracle-backend/cmd/app/main.go:1187)

static · static-finding

外部数据进入进程执行接口，可能命令注入。

### HIGH · 命令注入 (oracle-backend/internal/handlers/deploy_status.go:138)

static · static-finding

外部数据进入进程执行接口，可能命令注入。

### HIGH · 命令注入 (oracle-backend/internal/handlers/deploy_status.go:148)

static · static-finding

外部数据进入进程执行接口，可能命令注入。

### HIGH · 命令注入 (oracle-backend/internal/handlers/deploy_status.go:158)

static · static-finding

外部数据进入进程执行接口，可能命令注入。

### HIGH · applyAutoGithubSync 经 2 跳到达 ssrf (cloudflare-worker/src/downloads_do.ts:3203)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 applyAutoGithubSync() → 污点链：applyAutoGithubSync → parseMarkdownToEntries → fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · forwardArchivedBatchToOracle 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:3455)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 forwardArchivedBatchToOracle() → 污点链：forwardArchivedBatchToOracle(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:6182)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · forwardArchivedBatchToOracle 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:6365)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 forwardArchivedBatchToOracle() → 污点链：forwardArchivedBatchToOracle(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetchMarkdownFromUrl 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:6521)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetchMarkdownFromUrl() → 污点链：fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · parseMarkdownToEntries 经 1 跳到达 ssrf (cloudflare-worker/src/downloads_do.ts:6566)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 parseMarkdownToEntries() → 污点链：parseMarkdownToEntries → fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:6670)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetchMarkdownFromUrl 是 ssrf 入口 (cloudflare-worker/src/downloads_do.ts:6728)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetchMarkdownFromUrl() → 污点链：fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · parseMarkdownToEntries 经 1 跳到达 ssrf (cloudflare-worker/src/downloads_do.ts:6793)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 parseMarkdownToEntries() → 污点链：parseMarkdownToEntries → fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · applyAutoGithubSync 经 2 跳到达 ssrf (cloudflare-worker/src/downloads_do.ts:6917)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 applyAutoGithubSync() → 污点链：applyAutoGithubSync → parseMarkdownToEntries → fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · parseMarkdownToEntries 经 1 跳到达 ssrf (cloudflare-worker/src/downloads_do.ts:6957)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 parseMarkdownToEntries() → 污点链：parseMarkdownToEntries → fetchMarkdownFromUrl(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · onOptionalBindingMismatch 经 1 跳到达 ssrf (cloudflare-worker/src/index.ts:307)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 onOptionalBindingMismatch() → 污点链：onOptionalBindingMismatch → recordOptionalSessionBindingMismatch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:735)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · recordOptionalSessionBindingMismatch 是 ssrf 入口 (cloudflare-worker/src/index.ts:753)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 recordOptionalSessionBindingMismatch() → 污点链：recordOptionalSessionBindingMismatch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:884)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:923)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:953)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:964)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:1111)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:1164)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:1543)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2040)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2081)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2190)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2204)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### MEDIUM · 疑似跨文件污点 (cloudflare-worker/src/index.ts:2215)

cross-file · static-finding

HTTP 请求输入 → src/release-notes.ts:42 的 MongoDB 动态排序字段 sort

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### MEDIUM · sanitizeReleaseEntries 是 mongo-sort-injection 入口 (cloudflare-worker/src/index.ts:2215)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 sanitizeReleaseEntries() → 污点链：sanitizeReleaseEntries(sink:mongo-sort-injection) （定义于 src/release-notes.ts）

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2556)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:2581)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · proxyToDO 是 ssrf 入口 (cloudflare-worker/src/index.ts:3000)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 proxyToDO() → 污点链：proxyToDO(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · fetch 是 ssrf 入口 (cloudflare-worker/src/index.ts:3011)

cross-file · static-finding

不可信数据「HTTP 请求输入」流入 fetch() → 污点链：fetch(sink:ssrf)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### MEDIUM · 疑似跨文件污点 (extension/src/engines/v3/engine-v3.ts:232)

cross-file · static-finding

URL 输入 → tests/v2-docs-anchor-discovery.test.ts:20 的 XSS innerHTML 赋值

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · runArchiver 是 security 入口 (oracle-backend/cmd/app/main.go:1066)

cross-file · static-finding

不可信数据「环境变量」流入 runArchiver() → 污点链：runArchiver(sink:security)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · runArchiver 是 security 入口 (oracle-backend/cmd/app/main.go:1121)

cross-file · static-finding

不可信数据「环境变量」流入 runArchiver() → 污点链：runArchiver(sink:security)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### MEDIUM · 疑似跨文件污点 (oracle-backend/cmd/app/sheets_flush_manual.go:152)

cross-file · static-finding

环境变量 → app/main.go:1121 的 命令执行 os/exec.Command

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · runArchiver 是 security 入口 (oracle-backend/cmd/app/sheets_flush_manual.go:152)

cross-file · static-finding

不可信数据「环境变量」流入 runArchiver() → 污点链：runArchiver(sink:security) （定义于 app/main.go）

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · captureSnapshot 是 path-traversal 入口 (tools/capture-classroom-snapshot.ts:188)

cross-file · static-finding

不可信数据「命令行参数」流入 captureSnapshot() → 污点链：captureSnapshot(sink:path-traversal)

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### MEDIUM · 疑似跨文件污点 (tools/capture-classroom-snapshot.ts:208)

cross-file · static-finding

命令行参数 → qa/harness.ts:383 的 路径穿越 path traversal（未校验路径）

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。

### HIGH · screenshot 是 path-traversal 入口 (tools/capture-classroom-snapshot.ts:208)

cross-file · static-finding

不可信数据「命令行参数」流入 screenshot() → 污点链：screenshot(sink:path-traversal) （定义于 qa/harness.ts）

Proof gaps:

- 静态 advisory 需要人工确认真实数据流和可利用性。


---

This report is a projection of sealed JSON artifacts. It is not runtime verification.
