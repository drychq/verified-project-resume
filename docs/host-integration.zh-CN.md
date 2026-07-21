# 宿主集成

可移植核心是单一、自包含的 `skills/verified-project-resume/` 目录。

兼容宿主需要能够加载 `SKILL.md`、读写获准的本地工作目录文件，并运行 Node.js 20+ 命令。只有采集本地历史时需要 Git。Skill 不导入宿主 SDK，也不要求 MCP server。

请安装完整 Skill 目录。`agents/openai.yaml` 只是可选界面元数据，并为支持该设置的宿主禁用隐式调用。仓库分析可能耗时较长，而且普通简历写作不能绕过证据阶段，因此应保持显式调用。

用户接口是包含 Markdown 的工作目录。`.verified-resume/ledger.jsonl` 是同一个已安装 Skill 使用的私有机器状态；针对新岗位重新定制时需要保留，但不应要求用户手工编辑。

GitHub 证据是可选只读增强。若宿主没有 GitHub、网络、测试、Benchmark，甚至没有 `.git`，应把来源记录为不可用或未请求，而不是解释成不存在。
