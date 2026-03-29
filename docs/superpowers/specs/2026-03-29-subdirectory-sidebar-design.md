# 设计文档：侧边栏子目录样式与交互

**日期**：2026-03-29  
**版本**：v3（最终确认）  
**状态**：已确认，待实施  
**范围**：`apps/web/src/app/App.tsx`、`apps/web/src/styles/global.css`

---

## 背景

当前侧边栏目录列表已支持递归渲染子目录（`renderDirNodes`）和展开/收起状态（`expandedDirs`），但视觉上缺少清晰的层级指示，且内联添加子目录的入口尚未实现。本次设计补全这两块功能。

---

## 决策一览

| 方面 | 决策 |
|---|---|
| 展开/收起驱动方式 | 选中时展开路径，通过 `expandedDirs` Set 缓存 |
| 展开路径管理 | 选中目录时，将根到该目录的完整 id 路径写入 `expandedDirs` |
| 再次点击已选中目录 | 不做任何操作，保持选中态 |
| 兄弟目录收起 | 选新目录时，旧路径自动从 `expandedDirs` 消失，兄弟节点自动收起 |
| 树状连接线 | `.dir-children` 左侧 `border-left` 实现竖线 |
| 内联添加子目录入口 | `isExpanded && depth < 2` 时显示，放在 `dir-children` 列表末尾 |
| 底部"新建目录"按钮 | 始终创建根目录（`parentId: null`） |
| 最大显示深度 | 侧边栏渲染最多 3 层（depth 0/1/2），孙节点不显示添加按钮 |
| 删除逻辑 | 两步确认不变，子目录同样适用 |

---

## 一、展开/收起逻辑

### 核心机制

保留 `expandedDirs: Set<string>`，但改变管理方式：**选中目录时，将从根到该目录的完整 id 路径写入 Set**。

```
点击「项目」（工作 → 项目）：
expandedDirs = new Set(['工作的id', '项目的id'])
```

效果：
- 路径上的祖先全部展开（「工作」保持可见）
- 「项目」自己展开（显示其子目录）
- 「生活」等兄弟目录自动收起（不在路径里）

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
  // 再次点击已选中目录：不做任何操作
  if (dirFilterEquals(dirFilter, df)) return;

  setDirFilter(df);

  if (df.type === 'directory') {
    const path = findPathToDir(bootstrap!.directories, df.id);
    setExpandedDirs(new Set(path ?? []));
  } else {
    // unclassified：不展开任何目录
    setExpandedDirs(new Set());
  }
}
```

### 移除内容
- 移除原 `toggleDir()` 函数（展开状态由路径管理接管）
- 移除点击行时对 `toggleDir` 的调用

### 各级行为对应

| 操作 | `expandedDirs` 变化 | 效果 |
|---|---|---|
| 点击根目录「工作」 | `{'工作'}` | 工作展开，子目录出现 |
| 点击子目录「项目」 | `{'工作', '项目'}` | 工作保持展开，项目展开，显示孙目录 |
| 点击孙目录（depth 2） | `{'工作', '项目', '孙目录'}` | 三层均展开，孙不显示添加按钮 |
| 再次点击当前选中 | 无变化 | 保持原状 |
| 点击「生活」 | `{'生活'}` | 工作所有子树自动收起 |
| 点击「全部」（unclassified） | `{}` | 所有目录收起 |

### `renderDirNodes` 中展开判定

```ts
const isExpanded = expandedDirs.has(node.id);
```

---

## 二、视觉样式

### 选中态（`is-active`）
已有 `border-left-color: var(--md-sys-color-primary)` 和背景高亮，不变。

### 展开但未选中的父目录
父目录展开时（子目录被选中），父目录 `isActive = false`，无额外样式——子列表出现本身即是展开的视觉提示，无需额外状态样式。

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

变更说明：
- `margin-left: 14px`（新增）：对齐父目录 dot 下方位置
- `padding-left: 12px`（由 16px 改为 12px）：保持子项缩进
- `border-left: 2px solid ...`（新增）：树状竖连接线
- 其余属性（`list-style`, `display`, `flex-direction`, `gap`, `margin-top`）保持不变

### 子目录行样式
保持现有 `.nav-list__item--child` 的 `font-size: 0.88rem`，无需新增样式。

---

## 三、内联"+ 添加子目录"入口

### 渲染条件

```ts
const canAddChild = isExpanded && depth < 2;
```

- `depth < 2`：根目录（depth 0）和子目录（depth 1）显示；孙目录（depth 2）不显示
- `isExpanded`：该目录是否在当前 `expandedDirs` 中

### 叶子节点的容器处理

当选中的目录无子节点（叶子节点）时，`hasChildren = false`，但 `canAddChild` 可能为 `true`。子列表容器条件改为：

```tsx
{isExpanded && (hasChildren || canAddChild) && (
  <ul className="dir-children">
    {renderDirNodes(node.children, depth + 1)}
    {canAddChild && (
      /* 内联添加子目录表单或按钮 */
    )}
  </ul>
)}
```

内联表单放在 `dir-children` 列表内部末尾，树状竖线视觉包裹该表单，保持视觉连贯。

### 新增 State（App.tsx）

```ts
const [addingChildForDirId, setAddingChildForDirId] = useState<string | null>(null);
const [newChildDirName, setNewChildDirName] = useState('');
const [isCreatingChildDir, setIsCreatingChildDir] = useState(false);
const addChildDirInputRef = useRef<HTMLInputElement>(null);
```

- `addingChildForDirId`：当前展开内联表单的父目录 id，`null` 表示无表单打开
- `newChildDirName`：内联表单输入值
- `isCreatingChildDir`：提交进行中状态
- `addChildDirInputRef`：自动聚焦用 ref

### 内联表单处理函数

```ts
function openAddChildDir(dirId: string) {
  setAddingChildForDirId(dirId);
  setNewChildDirName('');
  setTimeout(() => addChildDirInputRef.current?.focus(), 0);
}

function cancelAddChildDir() {
  setAddingChildForDirId(null);
  setNewChildDirName('');
}

async function handleConfirmAddChildDir(parentId: string) {
  if (!newChildDirName.trim()) return;
  try {
    setIsCreatingChildDir(true);
    await createDirectory({ name: newChildDirName.trim(), parentId });
    setAddingChildForDirId(null);
    setNewChildDirName('');
    await refreshBootstrap();
  } catch (e) {
    setErrorMessage((e as Error).message || '创建子目录失败');
  } finally {
    setIsCreatingChildDir(false);
  }
}
```

### 内联表单 UI 规则
- 样式复用底部 `.dir-add-form` 相关 CSS 类
- `ref={addChildDirInputRef}` 实现自动聚焦
- 键盘：Enter 提交，Escape 取消
- `isCreatingChildDir = true` 时：输入框、确认按钮、取消按钮均 `disabled`
- 错误通过全局 `errorMessage` 显示

### 互斥与状态清理

多个内联表单互斥：`setAddingChildForDirId(node.id)` 覆盖上一个。

`dirFilter` 或 `timeFilter` 变化时重置内联表单状态，扩展现有 `useEffect`：

```ts
useEffect(() => {
  setQuickTitle('');
  setModalItem(null);
  setCloseWarningActive(false);
  setAddingChildForDirId(null); // 新增
  setNewChildDirName('');       // 新增
}, [timeFilter, dirFilter]);
```

### 与底部"新建目录"的关系

底部 `handleConfirmAddDir` 改为始终传 `parentId: null`（始终创建根目录）：

```ts
// 变更前
const parentId = dirFilter?.type === 'directory' ? dirFilter.id : null;
// 变更后
const parentId = null;
```

---

## 四、受影响文件与变更范围

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `apps/web/src/app/App.tsx` | 重构 + 新增 | 新增 `findPathToDir`；修改 `handleDirFilterClick`；移除 `toggleDir`；新增 4 个 state/ref 和 3 个处理函数；修改 `renderDirNodes`（子容器条件、内联表单）；扩展 dirFilter 变化的 `useEffect`；修改底部 `parentId` |
| `apps/web/src/styles/global.css` | 修改 | `.dir-children` 完整替换（新增 `border-left`、`margin-left`，调整 `padding-left`） |

后端无需变更，`createDirectory` 已支持 `parentId`。

---

## 五、边界行为

- 选中孙目录（depth 2）：路径中的根和子目录均展开，三层可见；孙目录 `canAddChild = false`，不显示添加按钮
- 再次点击已选中目录：`dirFilterEquals` 为 `true`，提前 `return`，无任何状态变化
- 点击「全部」（unclassified）：`expandedDirs` 清空，所有目录收起
- `dirFilter` 切换时：内联表单状态清空
- 删除目录：后端 `mode=move_to_inbox`，前端刷新 bootstrap 重新渲染；`isInSubtree` 函数有已知 bug（`targetId` 参数未使用，导致任何删除均可能触发 `dirFilter` 重置），本次不修复，作为技术债保留
