# Verified Project Resume（经验证的项目简历）

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` 是一个厂商中立、本地优先的 Agent Skills 包。它以两个职责严格分离的 Skill 作为可移植核心：

- `$repository-to-star`：检查真实软件仓库，生成带证据引用的完整 STAR 项目档案；
- `$star-to-resume`：只从已验证的 STAR 档案中提取事实，压缩为经过安全检查的技术简历候选条目。

- 版本：`0.1.0`
- 许可证：MIT
- 运行环境：Python 3.10+ 标准库和 Git

## 为什么必须分成两个阶段

第一阶段负责确认项目具备哪些能力、用户实际修改了什么，以及哪些信息仍然未知。第二阶段不得重新推断或补全这些事实。因此，starter 提供的组件、对第三方依赖的调用、队友负责的模块、尚未完成的目标或仅凭记忆提供的数字，都不能被悄悄改写成用户的个人成果。

两个阶段之间唯一的规范化接口是 `schema_version: "1.0.0"` 的 `star-project.json`。供人阅读的 Markdown 始终从通过验证的 JSON 确定性渲染生成。

## 仓库结构

```text
skills/
  repository-to-star/
    SKILL.md
    assets/
    references/
    scripts/repo_evidence.py
    agents/openai.yaml       # 可选 Codex/OpenAI 元数据
  star-to-resume/
    SKILL.md
    assets/
    references/
    scripts/resume_guard.py
    agents/openai.yaml       # 可选 Codex/OpenAI 元数据
.codex-plugin/plugin.json    # 可选 Codex 适配层
tests/
docs/
examples/synthetic-demo/
```

可选 Codex 适配层为两个 Skill 禁用了隐式调用；其他宿主如果支持相同策略，也应配置为仅显式调用。仓库审计可能耗时较长，而且普通的简历写作请求不应绕过证据采集阶段。

`.codex-plugin/` 和各 Skill 下的 `agents/openai.yaml` 只是可选的 Codex 适配层，只提供发现和界面元数据。两个 Skill、Schema、确定性脚本和测试都不依赖 Codex 或 OpenAI SDK。

## 调用示例

第一阶段：

```text
使用 $repository-to-star 分析 /absolute/path/to/my-project。
我的 Git 身份是 Name <name@example.com> 和 Name <school@example.edu>。
课程 starter 对应 tag starter-v1。将档案写入 /absolute/path/to/output。
除非我明确批准准确命令，否则不要运行测试或 Benchmark。
```

第二阶段：

```text
使用 $star-to-resume 处理 /absolute/path/to/output/star-project.json。
目标岗位：C++ 系统工程师。语言：both。生成 3 组语义对应的候选条目。
```

## 事实安全机制

- 本地文件清单和 Git 检查是只读操作，不执行目标项目代码。
- GitHub 证据是可选增强；无法采集不等于相关 Issue、PR 或贡献不存在。
- 运行测试或 Benchmark 前，必须展示准确命令、工作目录和预计写入内容，并分别取得批准。
- 用户确认可以支持范围明确的定性职责，但不能让仅凭记忆提供的数字进入简历。
- 每条证据声明摘要依据；验证器会重新计算文件字节、规范化记录或用户确认原文的 SHA-256，而不是只检查字符串是否长得像摘要。
- 只有 `verified-measured` 和 `verified-count` 指标可以进入候选简历文本。
- 简历 guard 会拒绝无来源数字、表示个人所有权或主导责任的过强动词、将依赖能力夸大为个人成果、无证据性能对比、生产级/可靠性/规模/因果措辞、档案哈希变化，以及双语内容相对来源发生事实漂移。
- 未通过 guard 的候选条目只能保留为草稿，并生成同目录的 `resume-candidates.guard-report.json`。

## 本地验证

在仓库根目录运行：

```text
python3 -m unittest discover -s tests -v
python3 skills/repository-to-star/scripts/repo_evidence.py validate --archive examples/synthetic-demo/star-project.json
python3 skills/star-to-resume/scripts/resume_guard.py validate-output --archive examples/synthetic-demo/star-project.json --candidates examples/synthetic-demo/resume-candidates.json
```

测试套件会创建临时 Git 仓库，并且完全离线运行。它不会安装第三方包，也不会执行外部项目代码。

## 宿主中立核心与可选适配层

`skills/` 下的两个自包含目录是规范实现。可以将其中任意一个复制到兼容 Agent Skills 的宿主目录，也可以让宿主直接加载本仓库的 `skills/`。安装路径和调用语法由宿主决定；`$repository-to-star` 与 `$star-to-resume` 是支持 `$skill-name` 语法的宿主所使用的调用形式。

通用核心只需要本地文件/命令执行能力、Python 3.10+，以及用于本地历史采集的 Git。它不导入任何宿主 SDK，不要求 MCP server，并将只读 GitHub 集成视为可选增强。即使宿主没有 GitHub 集成、网络、测试、Benchmark，甚至仓库没有 `.git`，工作流也必须正常降级，把相关来源记为 `unavailable`，而不是解释成“不存在”。

可移植性契约和适配层边界见[宿主集成说明](docs/host-integration.zh-CN.md)。

本仓库只提供源码：它本身不会安装适配层、修改 marketplace、绑定 MCP server，也不会写入用户级 Skills 目录。

## 完整演示

[`examples/synthetic-demo/star-project.md`](examples/synthetic-demo/star-project.md) 和 [`examples/synthetic-demo/resume-candidates.md`](examples/synthetic-demo/resume-candidates.md) 展示了完整的两阶段交接。

合成 fixture 特意包含以下容易误判的情况：starter 已有功能、第三方依赖集成、队友负责的模块、README 中未经验证的目标数字、带原始证据的 Benchmark、测试数量，以及用户确认的定性职责。演示输出会明确展示哪些内容被采用、降级或排除。

该演示完全由合成数据生成，不能作为任何真实个人贡献或生产系统能力的证据。
