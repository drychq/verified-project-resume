# Course Index — Verified Resume Candidates

- Source archive SHA-256: `1a735da1189b4f9c7e4b2d78c0b228ddc78486217d5313f36cc6c401c221bac9`
- Guard: `pass`
- Target role: `systems engineer`
- Focus: `correctness and measured performance`

## One-line project summary

- **zh-CN**: 基于课程 starter 扩展的索引项目，包含解析、持久化与缓存能力。
  - Claims: `c-project`
  - Evidence: `ev-starter`, `ev-dependency`
- **en**: A course index extending a supplied starter with parsing, persistence, and caching capabilities.
  - Claims: `c-project`
  - Evidence: `ev-starter`, `ev-dependency`

## Candidate bullets

### 1. parser-latency

Compression: `action-method-result`

- **zh-CN**: 在分配的解析模块中实现有界 token 解析，通过固定合成输入将延迟从 20 ms 降至 10 ms。
  - Status: `submittable`
  - Action sources: `c-parser`
  - Action evidence: `ev-parser-diff`
  - Method sources: `c-parser`
  - Method evidence: `ev-parser-diff`
  - Result sources: `c-parser`
  - Result evidence: `ev-parser-diff`, `ev-benchmark`
  - Metrics: `m-latency`
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none
- **en**: Implemented bounded token parsing in the assigned module, reducing fixed-fixture latency from 20 ms to 10 ms under the recorded benchmark method.
  - Status: `submittable`
  - Action sources: `c-parser`
  - Action evidence: `ev-parser-diff`
  - Method sources: `c-parser`
  - Method evidence: `ev-parser-diff`
  - Result sources: `c-parser`
  - Result evidence: `ev-parser-diff`, `ev-benchmark`
  - Metrics: `m-latency`
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none

### 2. storage-tests

Compression: `action-method-verified-capability`

- **zh-CN**: 通过现有存储封装集成 SQLite，并用 12 项确定性测试验证解析与存储边界。
  - Status: `submittable`
  - Action sources: `c-integration`
  - Action evidence: `ev-dependency`
  - Method sources: `c-integration`, `c-tests`
  - Method evidence: `ev-dependency`, `ev-test`
  - Result sources: `c-tests`
  - Result evidence: `ev-test`
  - Metrics: `m-tests`
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none
- **en**: Integrated SQLite through the existing storage wrapper and validated parser and storage boundaries with 12 deterministic tests.
  - Status: `submittable`
  - Action sources: `c-integration`
  - Action evidence: `ev-dependency`
  - Method sources: `c-integration`, `c-tests`
  - Method evidence: `ev-dependency`, `ev-test`
  - Result sources: `c-tests`
  - Result evidence: `ev-test`
  - Metrics: `m-tests`
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none

### 3. cache-fix

Compression: `action-method-verified-capability`

- **zh-CN**: 定位并修复队友模块中的缓存失效缺陷，通过回归测试确认目标错误路径已消除。
  - Status: `submittable`
  - Action sources: `c-fix`
  - Action evidence: `ev-fix-diff`, `ev-test`
  - Method sources: `c-fix`
  - Method evidence: `ev-fix-diff`, `ev-test`
  - Result sources: `c-fix`
  - Result evidence: `ev-fix-diff`, `ev-test`
  - Metrics: none
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none
- **en**: Debugged and fixed cache invalidation in a module implemented by a teammate, using regression tests to confirm the targeted failure path was eliminated.
  - Status: `submittable`
  - Action sources: `c-fix`
  - Action evidence: `ev-fix-diff`, `ev-test`
  - Method sources: `c-fix`
  - Method evidence: `ev-fix-diff`, `ev-test`
  - Result sources: `c-fix`
  - Result evidence: `ev-fix-diff`, `ev-test`
  - Metrics: none
  - Interview follow-up: What did the cited diff change?; What are the evidence limits?
  - Risk flags: none

## Excluded claims

- `c-starter` — Starter functionality is not a user contribution.
- `c-team-architecture` — Valid team context, but not selected for the concise candidate set.
- `c-confirmed-role` — Qualitative responsibility is supported but redundant with the selected parser action.
- `c-planned` — Future target is inferred and unmeasured.
- `c-production` — Production reliability is unknown.

## Warnings

- Measured latency applies only to the fixed synthetic fixture.
