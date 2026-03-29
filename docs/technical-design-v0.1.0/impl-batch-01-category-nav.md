# 实现规范 · 第一批改动 · 左侧分类导航

- 状态：待实现
- 创建日期：2026-03-27
- 最后修订：2026-03-27（v3：新增未分类入口，移除收件箱智能视图）
- 对应需求：`docs/requirements-v0.1.0/04-core-scope.md` §目录管理

---

## 1. 功能描述

左侧 sidebar 目录面板包含：

1. **未分类**：固定入口，排在目录面板顶部，展示 `directory_id IS NULL` 的全部未删除条目
2. **5 个根目录（分类）**：预设，带色点 + 名称 + 未完成数，可展开子目录
3. **子目录（项目）**：用户在根目录下自由创建

原「收件箱」智能视图废弃，`SmartViewKey` 中移除 `inbox`，智能视图仅保留今天、近期、逾期。

---

## 2. 数据层（后端 · SQLite）

### 2.1 `directories` 表新增 `color` 字段

```sql
ALTER TABLE directories ADD COLUMN color TEXT;
```

- 类型：`TEXT`，可为 `NULL`
- 仅根目录（`parent_id IS NULL`）有色值，子目录为 `NULL`
- 色值格式为 CSS hex 字符串，如 `#5a8a6a`

### 2.2 初始数据（幂等种入）

V1 预设 5 个根目录，在 `CurrentAccountService.ensureCurrentAccount()` 中**幂等**种入：账号确保存在后，检查 `parent_id IS NULL` 的根目录数量，为 0 时执行插入。

采用幂等方式而非仅在账号新建时种入，原因是：若账号已存在而根目录尚未写入（如升级部署场景），仍能正确补写。

```sql
-- 检查
SELECT COUNT(*) FROM directories
WHERE account_id = 'default-account' AND parent_id IS NULL AND is_deleted = 0

-- 为 0 时执行
INSERT OR IGNORE INTO directories
  (id, account_id, parent_id, name, color, sort_order, is_deleted, created_at, updated_at)
VALUES
  ('dir-todo',     'default-account', NULL, '待办', '#5a8a6a', 1, 0, :now, :now),
  ('dir-idea',     'default-account', NULL, '灵感', '#c4954a', 2, 0, :now, :now),
  ('dir-work',     'default-account', NULL, '工作', '#5a6e8a', 3, 0, :now, :now),
  ('dir-life',     'default-account', NULL, '生活', '#8a6a8a', 4, 0, :now, :now),
  ('dir-reminder', 'default-account', NULL, '提醒', '#8a5a5a', 5, 0, :now, :now);
```

> 说明：根目录使用语义化固定 ID 以便迁移追踪。根目录不允许用户删除（服务层校验 `parent_id IS NULL` 时拒绝删除请求）。

---

## 3. 后端 API

### 3.1 Bootstrap 响应扩展

`GET /api/bootstrap` 新增顶层字段：
- `unclassifiedCount`：`directory_id IS NULL` 且 `trashed_at IS NULL` 且 `progress != 'done'` 的条目数

`directories` 字段中，每个节点新增：
- `color`：`string | null`
- `activeCount`：该节点及其所有后代节点下未完成（`progress != 'done'`）且未删除（`trashed_at IS NULL`）的条目总数

**Bootstrap 响应结构示例：**

```json
{
  "account": { ... },
  "settings": { ... },
  "unclassifiedCount": 4,
  "directories": [ ... ]
}
```

**目录节点结构变更（`DirectoryNode`）：**

```json
{
  "id": "dir-work",
  "parentId": null,
  "name": "工作",
  "color": "#5a6e8a",
  "sortOrder": 3,
  "activeCount": 5,
  "children": [
    {
      "id": "dir-work-proj-a",
      "parentId": "dir-work",
      "name": "A 项目",
      "color": null,
      "sortOrder": 1,
      "activeCount": 2,
      "children": []
    }
  ]
}
```

**`activeCount` 查询逻辑：**

递归统计每个节点及其所有后代目录下的未完成条目数。推荐用 SQLite 递归 CTE 实现：

```sql
WITH RECURSIVE subtree(id) AS (
    SELECT id FROM directories WHERE id = :directoryId
    UNION ALL
    SELECT d.id FROM directories d
    JOIN subtree s ON d.parent_id = s.id
)
SELECT COUNT(*) FROM items
WHERE directory_id IN (SELECT id FROM subtree)
  AND account_id = :accountId
  AND trashed_at IS NULL
  AND progress != 'done'
```

对 bootstrap 中的所有目录节点执行此查询后填充 `activeCount`。

### 3.2 未分类条目接口

新增接口，用于点击「未分类」入口后加载主列表：

```
GET /api/views/unclassified
```

**查询逻辑：**

```sql
SELECT ... FROM items
WHERE account_id = :accountId
  AND directory_id IS NULL
  AND trashed_at IS NULL
ORDER BY created_at DESC
```

**响应：** `ItemSummary[]`

> 说明：`inbox` 接口（`GET /api/views/inbox`）废弃，由此接口替代。后端可保留 inbox 接口做兼容过渡，但前端不再调用。

### 3.3 按目录获取条目接口

新增接口，用于点击分类/项目后加载主列表：

```
GET /api/directories/:id/items
```

**路径参数：**
- `id`：目录 ID（根目录或子目录均支持）

**查询范围：** 该目录及其所有后代目录下的条目（递归 CTE，同上）

**查询条件：** `trashed_at IS NULL`，无进度过滤（前端自行过滤）

**响应：** `ItemSummary[]`（与 `/api/views/:view` 格式一致）

**错误场景：**
- 目录 ID 不属于当前账号 → `404 Not Found`

### 3.3 目录删除接口保护

`DELETE /api/directories/:id`：

- 若目标目录的 `parent_id IS NULL`（根目录）→ 返回 `400 Bad Request`，body：`{"error": "root directory cannot be deleted"}`
- 子目录删除行为不变

---

## 4. 前端类型（`src/types/item.ts`）

### 4.1 修改 `DirectoryNode`

新增字段：

```typescript
export interface DirectoryNode {
  id: string;
  parentId: string | null;
  name: string;
  color: string | null;   // 新增：根目录有色值，子目录为 null
  sortOrder: number;
  activeCount: number;    // 新增：该节点及后代的未完成条目数
  children: DirectoryNode[];
}
```

### 4.2 修改 `BootstrapData`

新增字段：

```typescript
export interface BootstrapData {
  account: { ... };
  settings: SettingsData;
  unclassifiedCount: number;  // 新增
  directories: DirectoryNode[];
}
```

### 4.3 修改 `SmartViewKey`

移除 `inbox`，更新后：

```typescript
export type SmartViewKey = 'today' | 'upcoming' | 'overdue';
```

同步更新 `SMART_VIEW_LABELS`，移除 `inbox` 条目。

### 4.4 扩展视图状态类型

将 activeView 改为 discriminated union，统一表示三种入口：

```typescript
export type ActiveView =
  | { type: 'smart'; key: SmartViewKey }      // 今天 / 近期 / 逾期
  | { type: 'unclassified' }                   // 未分类
  | { type: 'directory'; id: string };         // 根目录或子目录
```

---

## 5. 前端 API（`src/services/api.ts`）

新增函数，移除 `getViewItems('inbox')` 调用：

```typescript
export async function getUnclassifiedItems(): Promise<ItemSummary[]> {
  return requestJson<ItemSummary[]>('/api/views/unclassified');
}

export async function getDirectoryItems(directoryId: string): Promise<ItemSummary[]> {
  return requestJson<ItemSummary[]>(`/api/directories/${directoryId}/items`);
}
```

---

## 6. 前端组件（`src/app/App.tsx`）

### 6.1 状态变更

- `activeView` 类型改为 `ActiveView`
- 数据加载根据 `activeView.type` 分支：

```
type === 'smart'        → getViewItems(activeView.key)
type === 'unclassified' → getUnclassifiedItems()
type === 'directory'    → getDirectoryItems(activeView.id)
```

- 默认初始视图改为 `{ type: 'unclassified' }`（原来是 `inbox`）

### 6.2 Sidebar 目录面板改造

「目录」面板的渲染逻辑改为：

**未分类：** 固定排在最顶部，名称固定为「未分类」，显示 `unclassifiedCount`（从 bootstrap 新增字段获取）

**根目录层（分类）：** 色点 + 名称 + `activeCount`，可展开/折叠子目录

**子目录层（项目）：** 缩进展示，名称 + `activeCount`，无色点

```html
<section class="panel">
  <div class="panel__title">目录</div>
  <ul class="nav-list">
    <!-- 未分类（固定顶部） -->
    <li>
      <button class="nav-list__item [is-active]" onclick="setActiveView({type:'unclassified'})">
        <span>未分类</span>
        <span class="dir-root__count">{unclassifiedCount}</span>
      </button>
    </li>
    <!-- 根目录 -->
    <li class="dir-root">
      <button class="nav-list__item [is-active]" onclick="setActiveView + toggle">
        <span class="dir-root__label">
          <span class="category-dot" style="background: {color}"></span>
          {name}
        </span>
        <span class="dir-root__count">{activeCount}</span>
      </button>
      <!-- 子目录（展开时渲染） -->
      <ul class="dir-children">
        <li>
          <button class="nav-list__item nav-list__item--child [is-active]">
            <span>{childName}</span>
            <span class="dir-root__count">{childActiveCount}</span>
          </button>
        </li>
      </ul>
    </li>
  </ul>
</section>
```

展开/折叠状态建议用本地 `Set<string>` 存储已展开的目录 ID，不持久化。

### 6.3 标题区显示

当 `activeView.type === 'directory'` 时，`<h2>` 显示对应目录名称（从 bootstrap.directories 树中查找）。

---

## 7. 前端样式（`src/styles/global.css`）

### 新增样式

```css
/* 色点 */
.category-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* 根目录标签（色点 + 名称） */
.dir-root__label {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 未完成数角标 */
.dir-root__count {
  font-size: 11px;
  color: var(--md-sys-color-on-surface-variant);
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}

/* 子目录列表缩进 */
.dir-children {
  list-style: none;
  padding: 0 0 0 16px;
  margin: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* 子目录节点样式（比根目录稍小） */
.nav-list__item--child {
  font-size: 0.88rem;
  background: var(--md-sys-color-surface-container-low);
}
```

---

## 8. 实现顺序建议

| 步骤 | 内容 | 端 |
|------|------|-----|
| 1 | 数据库迁移：`directories` 表新增 `color` 字段，种入 5 个根目录 | 后端 |
| 2 | `DirectoryNode` 响应新增 `color` 和 `activeCount` 字段 | 后端 |
| 3 | Bootstrap 接口新增 `unclassifiedCount` + 填充 `activeCount`（递归 CTE）| 后端 |
| 4 | 新增 `GET /api/views/unclassified` 接口 | 后端 |
| 5 | 新增 `GET /api/directories/:id/items` 接口 | 后端 |
| 6 | 根目录删除保护 | 后端 |
| 7 | 前端类型更新（`SmartViewKey` 移除 inbox、`BootstrapData` 新增 `unclassifiedCount`、`DirectoryNode` 新增字段、`ActiveView` union）| 前端 |
| 8 | 前端 API 新增 `getUnclassifiedItems` + `getDirectoryItems`，移除 `inbox` 调用 | 前端 |
| 9 | `App.tsx` 状态重构（`activeView` 类型变更 + 数据加载三路分支，默认改为 `unclassified`）| 前端 |
| 10 | Sidebar 目录面板改造（未分类入口、色点、计数、展开折叠）| 前端 |
| 11 | CSS 新增目录样式 | 前端 |

---

## 9. 边界说明

- 根目录（5 个分类）不允许用户删除，仅支持重命名
- 用户只能在根目录下创建子目录（项目），V1 不限制更深的层级，但 UI 重点保证 2 层可用
- `activeCount` 为 bootstrap 加载时的快照；写操作完成后需重新拉取 bootstrap 或局部更新计数
- 点击根目录时，主列表显示该根目录及其所有子目录下的全部条目
- 点击子目录时，主列表只显示该子目录下的条目（不含其他兄弟目录）

