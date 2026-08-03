# Verified Project Resume（经验证的项目简历）

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` 是一个可移植的 Agent Skill，用于把真实软件仓库整理为完整、可核验的 STAR 故事库、经过 guard 的简历候选池，以及针对岗位精选的项目经历。

单一 Skill 内部严格按以下顺序执行：

```text
仓库证据 → 个人事实 → 详细 STAR 故事 → 合格候选池 → 岗位精选
```

这样既能避免把项目能力、starter、依赖、生成代码、团队工作、计划或未核验指标写成个人成果，也能防止简历阶段绕过 STAR。

- 版本：`0.2.0`
- 许可证：MIT
- 运行环境：Node.js 20+ 标准库；Git 仅在采集本地历史时需要

## 安装

```bash
npx skills add drychq/verified-project-resume
```

常用变体：

```bash
npx skills add drychq/verified-project-resume --list
npx skills add drychq/verified-project-resume --skill verified-project-resume
npx skills add drychq/verified-project-resume --agent codex
npx skills add drychq/verified-project-resume --global
npx skills add .
```

仓库只暴露 `skills/verified-project-resume/` 这一个 Skill。离线或使用宿主原生安装方式时，请复制完整目录，不要只复制 `SKILL.md`。

## 使用

完整流程：

```text
使用 $verified-project-resume 分析 /absolute/path/to/my-project，并把工作目录写到 /absolute/path/to/output。
我的 Git 身份是 Name <name@example.com> 和 Name <school@example.edu>。
starter tag 是 starter-v1。运行任何测试或 Benchmark 前都要先问我。
目标岗位：C++ 系统工程师。语言：both。
```

之后针对新岗位重新筛选：

```text
使用 $verified-project-resume 读取 /absolute/path/to/output，并根据以下新 JD 重新定制：……
```

导入旧双 Skill 工作流生成的档案：

```text
使用 $verified-project-resume 把 /absolute/path/to/star-project.json 导入 /absolute/path/to/output，复核重新生成的 STAR 故事，然后针对以下岗位定制：……
```

## 工作目录接口

用户只需要操作工作目录和四个 Markdown 文件：

- `star.md`：每项可辩护贡献对应一套完整、详细的 STAR；
- `resume-candidate-pool.md`：所有通过事实 guard 的候选条目；
- `resume.md`：一段有来源的项目概述，加上读取目标岗位或 JD 后按语言各精选的 1–4 条；
- `review.md`：工作流验收、证据缺口、风险、问题和排除理由。

机器状态位于 `.verified-resume/ledger.jsonl`。它是同一 Skill 的私有实现，不是需要用户维护的跨 Skill schema；由于其中记录了本地绝对路径和身份信息，请不要把它提交到共享版本库。新增叙事章节或排序信息不需要提升档案版本；Skill 的读写逻辑会一起更新，并忽略未知可选字段。

## 安全机制

- 只读 inventory 和 Git 采集不会执行目标项目代码。
- GitHub 证据是可选的只读增强。
- 测试和 Benchmark 必须分别展示准确命令并取得批准。
- 每个合格个人贡献必须进入 STAR，或记录明确排除理由。
- 每条候选必须沿 STAR 回溯到合格 claim、metric 和 evidence。
- 项目概述与候选条目一样引用账本来源，不引入新的数字或规模措辞。
- 只有实测或确定性计数指标可以进入简历数字。
- guard 会拒绝无依据的归属强词、依赖能力升级、性能对比、生产/可靠性/规模/因果措辞、来源篡改，以及候选与概述中的双语来源漂移。
- 只有一个合格故事时允许只输出一条，不会复制内容凑数量。

## 验证

运行离线测试套件，并对随附 demo 做只读校验：

```bash
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --stage resume
```

修改 fixture 或渲染逻辑后，用 `npm run demo` 确定性地重新生成 `examples/synthetic-demo/`；`render` 子命令会向工作目录写入四个 Markdown 文件，日常检查请使用 `validate`。两个脚本都支持 `--help` 和 `--version`。

测试只使用 Node.js 内置模块，在临时目录创建 Git 仓库并完全离线运行，不会安装依赖或执行外部项目代码。

可移植性要求见[宿主集成说明](docs/host-integration.zh-CN.md)。合成演示包含[完整 STAR 故事库](examples/synthetic-demo/star.md)、[候选池](examples/synthetic-demo/resume-candidate-pool.md)、[最终简历](examples/synthetic-demo/resume.md)和[工作流审查](examples/synthetic-demo/review.md)，不代表任何真实个人或项目。

## 方法论来源

实现为原创，仅借鉴工作流思路，不包含第三方代码或示例指标：

- `hubvue/skills` `resume-project-analyzer`：置信度分级、反思式归属提问、面试可辩护输出导向。MIT 许可证。<https://github.com/hubvue/skills/tree/main/project/resume-project-analyzer>
- `andrewstellman/quality-playbook`：从仓库工件到需求、测试与验证结论的可追溯性。Apache-2.0 许可证。<https://github.com/andrewstellman/quality-playbook>
- `hackforla/ai-skills-assessor`：结合人工复核使用 Issue 与 PR 活动的贡献者感知方法。GPL-2.0 仓库。<https://github.com/hackforla/ai-skills-assessor>
- Agent Skills 规范：可移植的 `SKILL.md`、scripts、references、assets 布局。<https://agentskills.io/specification>

未包含上述项目的任何宣传性表述、示例性能数字、Staff 级叙事框架或自动架构映射。
