# Superpowers 使用说明

## 文档目的

这份文档用于记录本仓库如何使用 `superpowers`，方便你和后续的 Codex 会话都能快速理解它的作用和使用方式。

## 当前安装状态

`superpowers` 已经通过 Codex 的原生技能发现机制安装完成。

当前安装位置：

- 仓库克隆目录：`~/.codex/superpowers`
- 技能软链接目录：`~/.agents/skills/superpowers`

注意：

- Codex 会在启动时自动扫描这些技能
- 安装或更新 `superpowers` 后，需要重启 Codex

## 它是什么

`superpowers` 是一套给编码代理使用的技能库和工作流体系。

它主要帮助这些事情：

- 在写代码前先做方案讨论
- 在实现前先写清楚执行计划
- 用更规范的方式推进实现
- 在阶段性完成后做评审和验证

## 在本仓库里的使用方式

本仓库推荐这样使用 `superpowers`：

1. 当功能方向或技术方案还不清楚时，使用 `brainstorming`
2. 当设计已经确认、准备开始较大实现时，使用 `writing-plans`
3. 只有在需求文档和技术方案文档已经对齐后，才使用执行类技能
4. 当一批实现完成后，使用评审类技能做检查

本仓库的特殊规则：

- `superpowers` 只能帮助提升工作流纪律，不能覆盖本仓库自己的事实来源文档
- 当前仓库的主要事实来源仍然是：
  - `docs/requirements-v0.1.0/`
  - `docs/technical-design-v0.1.0/`
  - `AGENTS.md`
  - `CLAUDE.md`

## 如何主动触发

你可以直接点名某个技能，例如：

- `use brainstorming`
- `use writing-plans`
- `use requesting-code-review`

你也可以直接用自然语言表达，例如：

- `帮我先做方案讨论，不要急着写代码`
- `先帮我写一个实现计划`
- `先做代码评审`

## 正常工作流会是什么样

如果 `superpowers` 使用得当，正常流程通常是：

1. 先澄清问题
2. 再细化设计
3. 然后写成明确计划
4. 再进入实现
5. 最后做评审和验证

## 如何更新

更新命令：

```bash
cd ~/.codex/superpowers && git pull
```

更新后重启 Codex。

## 如何检查安装是否正常

可以用下面两个命令做本地检查：

```bash
ls -la ~/.agents/skills/superpowers
ls ~/.codex/superpowers/skills
```

## 当前仓库提醒

对于本仓库：

- 主要把 `superpowers` 当作工作流辅助工具
- 不要在没有明确用户意图的情况下，用它重新打开已经确认的需求
- 不要让它替代仓库文档成为决策记录
