# 设计文档：侧边栏子目录样式与交互

**日期**：2026-03-29  
**状态**：已确认，待实施  
**范围**：`apps/web/src/app/App.tsx`、`apps/web/src/styles/global.css`

---

## 背景

当前侧边栏目录列表已支持递归渲染子目录（`renderDirNodes`）和展开/收起状态（`expandedDirs`），但视觉上缺少清晰的层级指示，且内联添加子目录的入口尚未实现。本次设计补全这两块功能。

---

## 决策一览

| 方面 | 决策 |
|---|---|
| 展开/收起驱动方式 | 纯选中态驱动，不做独立展开交互 |
| 展开判定规则 | `isActive \|\| hasActiveDescendant(node)` |
| 展开视觉指示 | `is-active` 已有 `border-left` primary 色；无需额外样式 |
| 树状连接线 | `.dir-children` 左侧加竖线，用 `border-left` 实现 |
| 内联添加子目录入口 | 仅在 `isExpanded && depth < 2` 时显示 |
| 底部"新建目录"按钮 | 始终创建根目录（`parentId: null`） |
| 最大显示深度 | 侧边栏渲染最多 3 层（depth 0/1/2），孙节点不显示添加按钮 |
| 删除逻辑 | 两步确认不变，子目录同样适用 |

---

## 一、展开/收起逻辑重构

### 现状
`expandedDirs: Set<string>` 记录手动展开的目录，`toggleDir()` 切换展开态。点击目录行时同时调用 `handleDirFilterClick` 和 `toggleDir`。

### 变更

**移除** `expandedDirs` state 和 `toggleDir()` 函数。

**新增** 辅助函数 `hasActiveDescendant`，判断某节点的后代中是否有节点被当前 `dirFilter` 选中：

```ts
function hasActiveDescendant(nodes: DirectoryNode[], activeDirId: string | null): boolean {
  if (!activeDirId) return false;
  for (const node of nodes) {
    if (node.id === activeDirId) return true;
    if (hasActiveDescendant(node.children, activeDirId)) return true;
  }
  return false;
}
```

**`renderDirNodes` 中的展开判定**（需将 `activeDirId` 作为参数传入，或通过闭包访问 `dirFilter`）：

```ts
const isActive = dirFilter?.type === 'directory' && dirFilter.id === node.id;
const isExpanded =
  isActive ||
  (dirFilter?.type === 'directory'
    ? hasActiveDescendant(node.children, dirFilter.id)
    : false);
```

**行为说明**：
- 点击根目录 → `isActive = true` → `isExpanded = true` → 显示子列表
- 点击子目录 → 子目录 `isActive = true`；父目录 `hasActiveDescendant = true` → 父目录 `isExpanded = true`，子目录保持可见
- 再次点击已选中目录 → 反选（`dirFilter = null`）→ 所有节点 `isExpanded = false` → 全部收起
- `dirFilter` 为 `null` 或 `type === 'unclassified'` 时：所有目录收起

**移除** 点击行时对 `toggleDir` 的调用，点击只触发 `handleDirFilterClick`。

---

## 二、视觉样式

### 展开态父目录指示
展开态与选中态（`is-active`）在当前规则中已有 `border-left-color: var(--md-sys-color-primary)` 和背景高亮。父目录展开时（其子目录被选中），父目录本身未被选中（`isActive = false`），无高亮。

如需视觉区分"展开但未选中的父目录"，可选择性地为此状态加样式。**本次不引入新状态样式**，保持简洁——父目录是否展开靠子列表出现本身来体现。

### 树状竖连接线

将 `.dir-children` 现有规则替换为：

```css
.dir-children {
  list-style: none;
  margin: 4px 0 0 14px;    /* margin-left: 14px 对齐父目录 dot 下方 */
  padding: 0 0 0 12px;     /* padding-left 保持子项缩进，移除原 16px */
  display: flex;
  flex-direction: column;
  gap: 4px;
  border-left: 2px solid var(--md-sys-color-outline-variant);
}
```

> 保留原有 `list-style: none`、`display: flex`、`flex-direction: column`、`gap: 4px`、`margin: 4px 0 0`；
> 变更：`padding-left` 由 16px 改为 12px，新增 `margin-left: 14px` 和 `border-left`。

### 子目录行样式
保持现有 `.nav-list__item--child` 的 `font-size: 0.88rem`，无需新增样式。

---

## 三、内联"+ 添加子目录"入口

### 渲染条件
```ts
const canAddChild = isExpanded && depth < 2;
```
- `isExpanded`：当前节点被选中或其后代被选中（后者也满足条件：例如根目录的子目录被选中时，根目录 `isExpanded = true`，同样显示"+ 添加子目录"按钮，语义是为根目录再添加一个平级子目录）
- `depth < 2`：只在根目录（depth 0）和子目录（depth 1）显示；孙目录（depth 2）不显示

### 叶子节点的容器渲染

当选中的目录无子节点（叶子节点）时，`hasChildren = false`，原来的 `dir-children` 容器不会渲染，但 `canAddChild` 为 `true` 需要显示表单。

`renderDirNodes` 中的子容器渲染条件需改为：
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

内联表单放在 `dir-children` 列表内部的末尾，这样树状竖线（`border-left`）也会包裹住表单，视觉连贯。

### 新增 State（App.tsx）
```ts
const [addingChildForDirId, setAddingChildForDirId] = useState<string | null>(null);
const [newChildDirName, setNewChildDirName] = useState('');
const [isCreatingChildDir, setIsCreatingChildDir] = useState(false);
const addChildDirInputRef = useRef<HTMLInputElement>(null);
```

- `addingChildForDirId`：当前展开内联表单的父目录 id（根目录或子目录均可），`null` 表示无表单打开
- `newChildDirName`：内联表单的输入值
- `isCreatingChildDir`：提交进行中状态
- `addChildDirInputRef`：用于内联输入框自动聚焦

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
- 键盘交互：Enter 提交，Escape 取消
- 禁用状态（`isCreatingChildDir = true` 时）：输入框、确认按钮、取消按钮均 disabled
- 错误通过全局 `errorMessage` 显示（与现有底部表单一致）

### 互斥与状态清理
- 多个目录的内联表单互斥：`setAddingChildForDirId(node.id)` 覆盖上一个
- `dirFilter` 变化时，通过现有的 `useEffect`（监听 `timeFilter`/`dirFilter`）重置快速创建，**同时也需重置** `addingChildForDirId` 和 `newChildDirName`：

```ts
useEffect(() => {
  setQuickTitle('');
  setModalItem(null);
  setCloseWarningActive(false);
  setAddingChildForDirId(null);   // 新增
  setNewChildDirName('');         // 新增
}, [timeFilter, dirFilter]);
```

### 与底部"新建目录"的关系

底部 `handleConfirmAddDir` 中，`parentId` 改为始终传 `null`（始终创建根目录）：

```ts
// 变更前
const parentId = dirFilter?.type === 'directory' ? dirFilter.id : null;

// 变更后
const parentId = null;
```

底部按钮文案保持"新建目录"不变（语义为根目录级别的新建，当前用户已理解此行为）。

---

## 四、受影响文件与变更范围

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `apps/web/src/app/App.tsx` | 重构 + 新增 | 移除 `expandedDirs`/`toggleDir`；新增 `hasActiveDescendant` 函数；新增 4 个 state/ref；修改 `renderDirNodes`；修改 dirFilter 变化的 useEffect；修改底部 `parentId` 逻辑 |
| `apps/web/src/styles/global.css` | 修改 | `.dir-children` 完整替换为新规则（含 `border-left`、`margin-left`） |

后端无需变更，`createDirectory` 已支持 `parentId`。

---

## 五、边界行为

- 选中孙目录（depth 2）时：孙目录 `isActive = true`，子目录 `hasActiveDescendant = true` 且 `isExpanded = true`，根目录同理 → 三层均可见。孙目录不显示"+ 添加子目录"按钮（`depth < 2` 为 false）。
- 多个目录的内联表单互斥：`addingChildForDirId` 同时只存一个 id，打开新表单自动关闭旧表单。
- `dirFilter` 切换时：内联表单状态清空，输入框收起。
- 删除一个有子目录的目录：后端 `mode=move_to_inbox` 处理，前端刷新 bootstrap 重新渲染树。
- 删除后若 `dirFilter` 指向被删除目录或其后代，前端重置 `dirFilter = null`（现有逻辑，`isInSubtree` 函数）。注意：`isInSubtree` 有一个已知 bug——`targetId` 参数未被使用，函数实际只查找 `rootId` 是否存在于树中，导致任何删除操作在 bootstrap 刷新前都会触发 `dirFilter` 重置。本次不修复，作为后续技术债记录。
