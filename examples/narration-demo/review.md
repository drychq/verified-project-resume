# Workflow Review

## Workflow acceptance

- [x] Sources are recorded before claims
- [x] Eligible contributions are covered by stories
- [x] A detailed story library exists
- [x] Bullet options derive from stories
- [x] Final selection follows the target role
- [x] Final bullets come from the checked options
- [x] The project overview cites its sources
- [x] User-facing files require no schema handling

## Validation

- Deterministic validation passed.

## Gaps and warnings

- metric-risk-peak: number provided from memory; be ready to explain how you know it.
- Only one supported final bullet was selected; coverage is limited.
- candidate-rule-parser-zh-CN: rests on your account only; expect follow-up questions.
- candidate-rule-parser-en: rests on your account only; expect follow-up questions.
- overview:zh-CN: rests on your account only; expect follow-up questions.
- overview:en: rests on your account only; expect follow-up questions.
- story:story-rule-engine.results[0].text: approximate wording on a number you provided; be ready to explain its source
- candidate:candidate-rule-parser-zh-CN.clauses.result.text: approximate wording on a number you provided; be ready to explain its source
- candidate:candidate-rule-parser-zh-CN.clauses.result.text: performance wording rests on your account only; prepare an answer for interview follow-ups
- candidate:candidate-rule-parser-zh-CN.data.text: approximate wording on a number you provided; be ready to explain its source
- candidate:candidate-rule-parser-zh-CN.data.text: performance wording rests on your account only; prepare an answer for interview follow-ups
- candidate:candidate-rule-parser-en.clauses.result.text: approximate wording on a number you provided; be ready to explain its source
- candidate:candidate-rule-parser-en.clauses.result.text: performance wording rests on your account only; prepare an answer for interview follow-ups
- candidate:candidate-rule-parser-en.data.text: approximate wording on a number you provided; be ready to explain its source
- candidate:candidate-rule-parser-en.data.text: performance wording rests on your account only; prepare an answer for interview follow-ups

## Interview prep

### Grounding summary

- **candidate-rule-parser-zh-CN** (zh-CN): code-supported 0; from your account 3; numbers you provided 1; flags: approximate-user-number, no-baseline, no-method, proposal-confirmed-claim, user-grounded-performance, user-provided-number, user-stated-claim
- **candidate-rule-parser-en** (en): code-supported 0; from your account 3; numbers you provided 1; flags: approximate-user-number, no-baseline, no-method, proposal-confirmed-claim, user-grounded-performance, user-provided-number, user-stated-claim
- **overview:zh-CN** (zh-CN): code-supported 0; from your account 4; numbers you provided 0; flags: proposal-confirmed-claim, user-stated-claim
- **overview:en** (en): code-supported 0; from your account 4; numbers you provided 0; flags: proposal-confirmed-claim, user-stated-claim

### Numbers you provided

- `metric-risk-peak`: 2000 QPS — sources: `ev-narr-number`; note: 口述回忆的峰值量级

### Likely questions and suggested answers

- **candidate-rule-parser-zh-CN**: ANTLR 方案是你定的吗？ Answer: 方案由我提出并在整理时逐条确认，解析器与热加载都是我实现的。
- **candidate-rule-parser-zh-CN**: 2000 QPS 这个数字从哪来？ Answer: 口述回忆的峰值量级，没有监控截图，答辩时按回忆值说明。
- **candidate-rule-parser-zh-CN**: 热加载与解析器分别由谁完成？
- **candidate-rule-parser-en**: Was the ANTLR choice yours? Answer: I proposed it and confirmed the wording item by item; I built the parser and the hot reload.
- **candidate-rule-parser-en**: Where does 2000 QPS come from? Answer: A remembered peak magnitude; there is no dashboard screenshot, so I state it as recalled.
- **candidate-rule-parser-en**: 热加载与解析器分别由谁完成？
- **overview:zh-CN**: 整个引擎都是你做的吗？ Answer: 不是；我只负责解析模块，接入层由同事负责，表述按此口径。
- **overview:en**: Did you build the whole engine? Answer: No; I owned the parsing module while a teammate covered the integration layer.

## Open questions

- **q-qps-source** [open] 峰值 2000 QPS 是否有监控截图或答辩材料可以核对？

## Exclusions

- group-rule-config: 与目标岗位相关性较低，保留在备选项中。
