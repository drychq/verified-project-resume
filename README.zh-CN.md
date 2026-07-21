# Verified Project Resume（经验证的项目简历）

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` 是一个可移植的 Agent Skill，用于把真实软件仓库整理为完整、可核验的 STAR 故事库、经过 guard 的简历候选池，以及针对岗位精选的项目经历。

单一 Skill 内部严格按以下顺序执行：

```text
仓库证据 → 个人事实 → 详细 STAR 故事 → 合格候选池 → 岗位精选
```

这样既能避免把项目能力、starter、依赖、生成代码、团队工作、计划或未核验指标写成个人成果，也能防止简历阶段绕过 STAR。

- 版本：`0.1.0`
- 许可证：MIT
- 运行环境：Node.js 20+ 标准库和 Git

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
- `resume.md`：读取目标岗位或 JD 后精选的 1–4 条；
- `review.md`：工作流验收、证据缺口、风险、问题和排除理由。

机器状态位于 `.verified-resume/ledger.jsonl`。它是同一 Skill 的私有实现，不是需要用户维护的跨 Skill schema。新增叙事章节或排序信息不需要提升档案版本；Skill 的读写逻辑会一起更新，并忽略未知可选字段。

## 安全机制

- 只读 inventory 和 Git 采集不会执行目标项目代码。
- GitHub 证据是可选的只读增强。
- 测试和 Benchmark 必须分别展示准确命令并取得批准。
- 每个合格个人贡献必须进入 STAR，或记录明确排除理由。
- 每条候选必须沿 STAR 回溯到合格 claim、metric 和 evidence。
- 只有实测或确定性计数指标可以进入简历数字。
- guard 会拒绝无依据的归属强词、依赖能力升级、性能对比、生产/可靠性/规模/因果措辞、来源篡改和双语来源漂移。
- 只有一个合格故事时允许只输出一条，不会复制内容凑数量。

## 验证

```text
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --stage resume
node skills/verified-project-resume/scripts/workspace.mjs render --ledger examples/synthetic-demo/.verified-resume/ledger.jsonl --workspace examples/synthetic-demo --stage resume
```

测试只使用 Node.js 内置模块，在临时目录创建 Git 仓库并完全离线运行，不会安装依赖或执行外部项目代码。

可移植性要求见[宿主集成说明](docs/host-integration.zh-CN.md)。合成演示包含[完整 STAR 故事库](examples/synthetic-demo/star.md)、[候选池](examples/synthetic-demo/resume-candidate-pool.md)、[最终简历](examples/synthetic-demo/resume.md)和[工作流审查](examples/synthetic-demo/review.md)，不代表任何真实个人或项目。
