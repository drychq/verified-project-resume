# 宿主集成与可移植性契约

本项目的规范产品是 `skills/` 下两个自包含目录。宿主无需识别 `.codex-plugin/` 或 `agents/openai.yaml`，也可以单独安装一个或同时安装两个 Skill。

## 宿主最低能力

兼容宿主必须能够：

- 加载标准 `SKILL.md`，并相对该文件所在目录解析资源；
- 读取目标仓库，并写入用户允许的输出文件；
- 执行本地 `python3` 命令，并在存在 Git 历史时执行本地 `git` 命令；
- 在运行测试或 Benchmark 前，先取得用户对准确命令、工作目录和预计写入内容的明确批准；
- 将第一阶段的 `star-project.json` 原样交给第二阶段。

网络访问、GitHub connector、MCP、marketplace 和厂商 SDK 都不是必需条件。可选的 GitHub 证据采集必须只读。缺少集成时应记录为 `unavailable`，不能当作 Issue、PR、review 或 CI 记录不存在的证据。

档案 Schema 1.0 的可选远程代码托管字段仍以 GitHub 命名，因为原始证据范围就是采集 GitHub 的 Issue、PR、review 和 CI。这是数据源限制，不是 AI 宿主依赖：本地仓库与 Git 分析可在任意兼容宿主运行，没有 GitHub 的宿主会正常降级。若要以中立字段支持其他代码托管平台，需要在后续 Schema 版本中提供明确的兼容迁移。

## 核心与适配层

| 路径 | 作用 | 通用核心是否需要 |
| --- | --- | --- |
| `skills/*/SKILL.md` | 可移植工作流指令 | 是 |
| `skills/*/scripts/` | 确定性采集、验证、guard 与渲染 | 是 |
| `skills/*/assets/` | JSON Schema 与模板 | 是 |
| `skills/*/references/` | 证据、归属和语言政策 | 是 |
| `.codex-plugin/plugin.json` | 可选 Codex 打包元数据 | 否 |
| `skills/*/agents/openai.yaml` | 可选 OpenAI/Codex 发现与调用策略 | 否 |

适配层可以定义显示名称、显式调用策略和安装体验，但不得改变证据准入、贡献归属、指标资格、Schema 或 guard 行为。

## 通用安装

按照宿主自身的 Agent Skills 安装方式，完整安装以下目录：

```text
skills/repository-to-star/
skills/star-to-resume/
```

不要只复制 `SKILL.md`：每个 Skill 都依赖同目录下的 `scripts/`、`assets/` 和 `references/`。宿主可以不使用 `$repository-to-star` 这种调用语法，但 frontmatter 中的 Skill 名始终是 `repository-to-star`。

## 通用调用

通过 frontmatter 名称要求宿主显式调用 Skill。与客户端无关的请求语义如下：

```text
显式调用 repository-to-star skill，分析 /absolute/path/to/project，并将已验证档案写入 /absolute/path/to/output。未单独取得批准前，不要运行项目测试或 Benchmark。

显式调用 star-to-resume skill，输入 /absolute/path/to/output/star-project.json。目标岗位：C++ 系统工程师。语言：both。生成 3 组语义对应的候选条目。
```

第一阶段必须先生成通过 Schema 验证的档案，第二阶段才能启动。如果宿主无法在机制上关闭隐式调用，用户仍应明确点名 Skill，并且宿主不得把自由文本简历直接交给第二阶段。
