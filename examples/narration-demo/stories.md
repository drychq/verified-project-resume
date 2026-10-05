# Risk Rule Engine — Story Library

Rendered from the private records file. Each story is one contribution, with its sources listed.

## 1. 风控规则引擎：解析模块与规则配置化

- Story ID: `story-rule-engine`
- Resume eligible: `true`
- Sources: contribution: `contribution-rule-engine`; claim: `claim-risk-project`, `claim-risk-role`, `claim-risk-migrate`, `claim-risk-parser`, `claim-risk-perf`; evidence: `ev-narr-context`, `ev-narr-role`, `ev-narr-owner`, `ev-old-resume`, `ev-prop-parser`, `ev-narr-perf`, `ev-narr-number`; metric: `metric-risk-peak`; open_question: `q-qps-source`

### Situation

- 项目是内部风控服务，规则原先硬编码在代码里，改一次规则要走完整发版流程。
  - Claims: `claim-risk-project`; Evidence: `ev-narr-context`; Metrics: none

### Task

- 用户负责规则解析模块，与接入层同事协作。
  - Claims: `claim-risk-role`; Evidence: `ev-narr-role`, `ev-narr-owner`; Metrics: none

### Action

- 基于 ANTLR 实现表达式解析器，支持规则文件热加载。
  - Claims: `claim-risk-parser`; Evidence: `ev-prop-parser`; Metrics: none
- 把硬编码规则迁移为可配置的规则描述。
  - Claims: `claim-risk-migrate`; Evidence: `ev-old-resume`, `ev-narr-role`; Metrics: none

### Result

- 规则加载与发布明显加快，峰值约 2000 QPS 场景下保持稳定。
  - Claims: `claim-risk-perf`; Evidence: `ev-narr-perf`, `ev-narr-number`; Metrics: `metric-risk-peak`

### Constraints

- 代码与文档不能带出公司，全部来源为用户口述、旧材料与逐条确认。

### Decisions

- 解析方案采用 ANTLR 表达式解析（经用户逐条确认）。

### Trade-offs

- 以规则文件热加载代替重新发版。

### Result boundaries

- 数字来自用户口述回忆，没有监控截图；性能表述仅由口述支撑。

### Interview questions

- 热加载与解析器分别由谁完成？
- 峰值 2000 QPS 的口径是什么？

### Risk flags

- user-provided-number
