# Verified Project Resume（经验证的项目简历）

[English](README.md) | [简体中文](README.zh-CN.md)

`verified-project-resume` 是一个本地优先的 Codex 插件，包含两个职责严格分离的 Agent Skill：

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
.codex-plugin/plugin.json
skills/
  repository-to-star/
    SKILL.md
    agents/openai.yaml
    assets/
    references/
    scripts/repo_evidence.py
  star-to-resume/
    SKILL.md
    agents/openai.yaml
    assets/
    references/
    scripts/resume_guard.py
tests/
examples/synthetic-demo/
```

两个 Skill 均禁用隐式调用。仓库审计可能耗时较长，而且普通的简历写作请求不应绕过证据采集阶段，因此必须通过名称显式调用。

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

## 可移植性

`skills/` 下的两个目录都是自包含的标准 Agent Skill，可以分别复制到客户端支持的 Skills 目录。确定性脚本需要 `python3`；本地历史采集还需要 `git`。GitHub 采集取决于宿主客户端提供的只读 GitHub 工具，没有这些工具时会进入受支持的降级模式。

本仓库只提供源码：它本身不会安装插件、修改个人 marketplace、绑定 MCP server，也不会写入用户级 Skills 目录。

## 完整演示

[`examples/synthetic-demo/star-project.md`](examples/synthetic-demo/star-project.md) 和 [`examples/synthetic-demo/resume-candidates.md`](examples/synthetic-demo/resume-candidates.md) 展示了完整的两阶段交接。

合成 fixture 特意包含以下容易误判的情况：starter 已有功能、第三方依赖集成、队友负责的模块、README 中未经验证的目标数字、带原始证据的 Benchmark、测试数量，以及用户确认的定性职责。演示输出会明确展示哪些内容被采用、降级或排除。

该演示完全由合成数据生成，不能作为任何真实个人贡献或生产系统能力的证据。
