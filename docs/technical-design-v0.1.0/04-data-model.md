# 04. 数据模型设计

## 设计原则

- 用统一的事项模型承载轻量事项和标准任务
- 用目录树承载分类结构
- 用软删除支撑回收站
- 保留账号主体，但不做完整认证流程

## 核心实体

### accounts

用于表示数据归属主体。

建议字段：

- `id`
- `name`
- `status`
- `created_at`
- `updated_at`

说明：

- V1 可以仅预置一个账号
- 该表的价值在于为未来多账号或开放部署保留边界

### directories

用于表示工作、生活和项目树。

建议字段：

- `id`
- `account_id`
- `parent_id`
- `name`
- `sort_order`
- `is_deleted`
- `created_at`
- `updated_at`

说明：

- `parent_id` 支持多级目录
- 目录删除应走应用层策略，而不是简单级联删除

### items

用于表示事项主表。

建议字段：

- `id`
- `account_id`
- `directory_id`
- `title`
- `notes`
- `progress`
- `priority`
- `expected_at`
- `completed_at`
- `trashed_at`
- `created_at`
- `updated_at`

说明：

- `directory_id` 允许为空，为空时表示进入收件箱 / 未分类
- `progress` 使用枚举值，例如 `todo`、`doing`、`done`、`paused`
- `trashed_at` 不为空时表示进入回收站

### settings

用于保存用户级偏好。

建议字段：

- `id`
- `account_id`
- `recent_range_value`
- `recent_range_unit`
- `created_at`
- `updated_at`

说明：

- “近期”视图的时间范围配置放在这里

## 关键约束

- `items.account_id`、`directories.account_id` 必须存在
- 目录删除时，应用层必须显式要求用户选择处理目录下事项的方式
- 回收站恢复本质上是清空 `trashed_at`

## 智能视图计算

- 收件箱：`directory_id IS NULL AND trashed_at IS NULL`
- 今天：`expected_at` 在当天范围内，且未进入回收站
- 近期：`expected_at` 在当前时间到配置范围内，且未进入回收站
- 逾期：`expected_at` 早于当前日期且 `progress != done`
- 已完成弱化展示：`progress = done`
