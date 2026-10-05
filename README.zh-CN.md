# Verified Project Resume（项目经历简历整理）

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` 是一个可移植的 Agent Skill：把你口述的项目经历（有源码时也可以提供），整理成有来源的故事库、备选要点，以及针对岗位的简历条目。

单一 Skill 内部严格按以下顺序执行：

```text
记录来源 → 事实与数字 → 详细故事 → 备选要点 → 岗位精选
```

措辞可以包装，但不得超出来源能支撑的范围；技术细节、方案和职责表述可以由 skill 提议，但必须逐条确认后才写入；数字只来自你的提供或实测——skill 绝不代拟。

- 版本：`0.3.0`
- 许可证：MIT
- 运行环境：Node.js 20+ 标准库；纯口述场景不需要网络或 Git

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

仓库只暴露 `skills/verified-project-resume/` 这一个 Skill。离线安装或手动复制时，请复制完整目录，不要只复制 `SKILL.md`。

## 使用

口述整理（不需要源码）：

```text
使用 $verified-project-resume 把我的简历工作目录写到 /absolute/path/to/output。
我拿不到公司代码，我口述。目标岗位：后端开发工程师。语言：both。
```

有源码时（可选）：

```text
使用 $verified-project-resume 分析 /absolute/path/to/my-project，并把工作目录写到 /absolute/path/to/output。
我的 Git 身份是 Name <name@example.com>。starter tag 是 starter-v1。运行任何测试或 Benchmark 前先问我。
目标岗位：C++ 系统工程师。语言：both。
```

之后针对新岗位重新筛选：

```text
使用 $verified-project-resume 读取 /absolute/path/to/output，并根据以下新 JD 重新定制：……
```

## 工作目录接口

用户只需要操作工作目录和四个 Markdown 文件：

- `stories.md`：每项可辩护的贡献对应一套完整故事，附来源；
- `bullet-options.md`：所有通过检查的备选要点（按语言）；
- `resume.md`：一段有来源的项目概述，加上读取目标岗位或 JD 后按语言精选的 1–4 条；
- `review.md`：工作流验收、缺口、提醒、面试追问准备、问题和排除理由。

机器状态位于 `.verified-resume/records.jsonl`。它是同一个 Skill 的私有数据；由于记录了本地绝对路径和身份信息，请不要提交到共享版本库。

## 有据可依的机制

- 只读 inventory 和 Git 采集不会执行目标项目代码。
- GitHub 查询是可选的只读增强，且仅在有仓库时使用。
- 测试和 Benchmark 必须展示准确命令并取得批准。
- 每个合格贡献必须进入故事，或记录明确排除理由。
- 每条要点沿故事回溯到记录来源；项目概述与要点一样引用来源。
- 数字只来自你的提供或实测；你提供的数字会连同出处列在 `review.md`。
- 检查会拒绝无依据的强词、依赖能力升级、来源里找不到的数字；只有口述依据的性能/规模/生产/因果措辞会变成提醒，并附面试追问准备。
- 只有一个合格故事时允许只输出一条，不会复制内容凑数量。

## 验证

运行离线测试套件，并对随附 demo 做只读校验：

```bash
npm test
node skills/verified-project-resume/scripts/workspace.mjs validate --records examples/narration-demo/.verified-resume/records.jsonl --stage resume
```

修改 fixture 或渲染逻辑后，用 `npm run demo` 确定性重新生成 `examples/synthetic-demo/` 和 `examples/narration-demo/`；`render` 子命令会向工作目录写入四个 Markdown 文件，日常检查请用 `validate`。两个脚本都支持 `--help` 和 `--version`。

测试只使用 Node.js 内置模块，在临时目录创建 Git 仓库并完全离线运行，不会安装依赖或执行外部项目代码。

可移植性要求见[接入说明](docs/setup.zh-CN.md)。口述示例见[故事库](examples/narration-demo/stories.md)、[备选要点](examples/narration-demo/bullet-options.md)、[最终简历](examples/narration-demo/resume.md)和[含面试追问准备的审查](examples/narration-demo/review.md)；有源码路径见[合成演示](examples/synthetic-demo/resume.md)。两者均不代表任何真实个人或项目。

## 方法论来源

实现为原创，仅借鉴工作流思路，不包含第三方代码或示例指标：

- `hubvue/skills` `resume-project-analyzer`：置信度分级、反思式归属提问、面试可辩护输出导向。MIT 许可证。<https://github.com/hubvue/skills/tree/main/project/resume-project-analyzer>
- `andrewstellman/quality-playbook`：从仓库工件到需求、测试与验证结论的可追溯性。Apache-2.0 许可证。<https://github.com/andrewstellman/quality-playbook>
- `hackforla/ai-skills-assessor`：结合人工复核使用 Issue 与 PR 活动的贡献者感知方法。GPL-2.0 仓库。<https://github.com/hackforla/ai-skills-assessor>
- Agent Skills 规范：可移植的 `SKILL.md`、scripts、references、assets 布局。<https://agentskills.io/specification>

未包含上述项目的任何宣传性表述、示例性能数字、Staff 级叙事框架或自动架构映射。
