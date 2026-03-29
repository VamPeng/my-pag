# 设计文档：侧边栏子目录样式与交互

**日期**：2026-03-29  
**版本**：v4（最终确认）  
**状态**：已确认，待实施  
**范围**：`apps/web/src/app/App.tsx`、`apps/web/src/styles/global.css`

---

## 背景

当前侧边栏目录列表支持递归渲染子目录，但视觉上缺少层级指示，展开/收起逻辑也需要与选中状态联动。本次设计：
1. 重构展开逻辑为路径驱动
2. 新增树状竖连接线
3. 移除所有"新建目录"入口（底部按钮和内联按钮），留待后续重新设计

---

## 决策一览

| 方面 | 决策 |
|---|---|
| 展开驱动方式 | 选中时将根到该目录的完整路径写入 `expandedDirs` |
| 再次点击已选中目录 | 不做任何操作，保持选中 |
| 树状连接线 | `.dir-children` 加 `border-left` 竖线 |
| 新建目录入口 | 全部移除（底部按钮 + 内联按钮），后续重新设计 |
| 删除目录逻辑 | 两步确认不变，子目录同样适用 |

---

## 一、展开/收起逻辑重构

### 核心机制

保留 `expandedDirs: Set<string>`，改为**路径写入**：选中某目录时，将从根到该目录的完整 id 路径写入 Set。

```
点击「项目」（工作 → 项目）：
expandedDirs = new Set(['工作的id', '项目的id'])
```

效果：
- 路径上的所有祖先自动展开
- 兄弟目录（如「生活」）自动收起（不在路径里）

### 新增辅助函数

```ts
function findPathToDir(nodes: DirectoryNode[], targetId: string): string[] | null {
  for (const node of nodes) {
    if (node.id === targetId) return [node.id];
    const childPath = findPathToDir(node.children, targetId);
    if (childPath) return [node.id, ...childPath];
  }
  return null;
}
```

### 修改 `handleDirFilterClick`

```ts
function handleDirFilterClick(df: DirFilter) {
  if (dirFilterEquals(dirFilter, df)) return; // 再次点击：不做操作

  setDirFilter(df);

  if (df.type === 'directory') {
    const path = findPathToDir(bootstrap!.directories, df.id);
    setExpandedDirs(new Set(path ?? []));
  } else {
    // 点击「全部」（unclassified）：收起所有目录
    setExpandedDirs(new Set());
  }
}
```

### 移除内容

- 移除 `toggleDir()` 函数
- 移除点击行时对 `toggleDir` 的调用（点击只触发 `handleDirFilterClick`）

### 各级行为

| 操作 | `expandedDirs` 结果 | 效果 |
|---|---|---|
| 点击根目录「工作」 | `{'工作'}` | 工作展开，子目录出现 |
| 点击子目录「项目」 | `{'工作', '项目'}` | 工作保持展开，项目展开 |
| 点击孙目录（depth 2） | `{'工作', '项目', '孙id'}` | 三层均展开 |
| 再次点击当前选中 | 无变化 | 保持原状 |
| 点击「生活」 | `{'生活'}` | 工作所有子树收起 |
| 点击「全部」 | `{}` | 所有目录收起 |

### `renderDirNodes` 中展开判定

```ts
const isExpanded = expandedDirs.has(node.id);
```

---

## 二、视觉样式

### 树状竖连接线

将 `.dir-children` 现有规则完整替换为：

```css
.dir-children {
  list-style: none;
  margin: 4px 0 0 14px;
  padding: 0 0 0 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 2px solid var(--md-sys-color-outline-variant);
}
```

变更说明（与现有规则对比）：
- `margin-left: 14px`（新增）：对齐父目录 dot 下方
- `padding-left: 12px`（由 16px 改为 12px）
- `border-left: 2px solid ...`（新增）：树状竖线
- `list-style`、`display`、`flex-direction`、`gap`、`margin-top` 保持不变

### 选中态
保持现有 `.is-active` 样式（`border-left-color: primary` + 背景高亮），不变。

### 子目录行
保持现有 `.nav-list__item--child` 的 `font-size: 0.88rem`，不变。

---

## 三、移除新建目录功能

### 移除的 State 与 Ref（App.tsx）

```ts
// 全部移除：
const [isAddingDir, setIsAddingDir] = useState(false);
const [newDirName, setNewDirName] = useState('');
const [isCreatingDir, setIsCreatingDir] = useState(false);
const addDirInputRef = useRef<HTMLInputElement>(null);
```

### 移除的函数（App.tsx）

```ts
// 全部移除：
function openAddDir() { ... }
function cancelAddDir() { ... }
async function handleConfirmAddDir() { ... }
```

### 移除的 JSX（App.tsx）

- 底部的 `{isAddingDir ? <div class="dir-add-form">...</div> : <button class="dir-add-btn">新建目录</button>}` 整块移除

### 移除的 CSS（global.css）

```css
/* 全部移除：*/
.dir-add-btn { ... }
.dir-add-btn:hover { ... }
.dir-add-btn__icon { ... }
.dir-add-form { ... }
.dir-add-form__input { ... }
.dir-add-form__input:focus { ... }
.dir-add-form__actions { ... }
.dir-add-form__confirm { ... }
.dir-add-form__confirm:disabled { ... }
.dir-add-form__cancel { ... }
```

---

## 四、受影响文件与变更范围

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `apps/web/src/app/App.tsx` | 重构 + 删除 | 新增 `findPathToDir`；修改 `handleDirFilterClick`；移除 `toggleDir`；移除 4 个添加目录相关 state/ref；移除 3 个处理函数；移除底部添加目录 JSX |
| `apps/web/src/styles/global.css` | 修改 + 删除 | `.dir-children` 完整替换；移除所有 `dir-add-*` 相关样式 |

后端无需变更。

---

## 五、边界行为

- 孙目录（depth 2）选中后三层均展开且可见
- 再次点击已选中目录：`dirFilterEquals` 返回 `true`，提前 `return`
- 点击「全部」：`expandedDirs` 清空，所有目录收起
- 删除目录：`isInSubtree` 函数有已知 bug（`targetId` 参数未使用，任何删除均可能触发 `dirFilter` 重置），本次不修复，记为技术债
