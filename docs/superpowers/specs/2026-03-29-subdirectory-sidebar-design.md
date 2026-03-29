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
| 展开视觉指示 | 父目录 `border-left` 变为中性色（outline） |
| 树状连接线 | `.dir-children` 左侧加竖线，用 `border-left` 实现 |
| 内联添加子目录入口 | 仅在展开态（即选中）且 `depth < 2` 时显示 |
| 底部"新建目录"按钮 | 始终创建根目录（`parentId: null`），不跟随 `dirFilter` |
| 最大显示深度 | 侧边栏渲染最多 3 层（depth 0/1/2），孙节点不显示添加按钮 |
| 删除逻辑 | 两步确认不变，子目录同样适用 |

---

## 一、展开/收起逻辑重构

### 现状
`expandedDirs: Set<string>` 记录手动展开的目录，`toggleDir()` 切换展开态。

### 变更
移除 `expandedDirs` state 和 `toggleDir()` 函数。展开态改为由选中状态派生：

```ts
const isExpanded = isActive; // isActive = dirFilter?.type === 'directory' && dirFilter.id === node.id
```

点击目录行只触发 `handleDirFilterClick`，不再同时调用 `toggleDir`。

**行为说明**：
- 点击根目录 → 选中 → 自动展开，显示子目录
- 点击子目录 → 选中子目录，父目录不再是选中态 → 父目录自动收起
- 再次点击已选中目录 → 反选（`dirFilter = null`）→ 自动收起

---

## 二、视觉样式

### 展开态父目录指示
当目录处于展开态（即选中态），`border-left` 变为中性色，与选中子目录时的 primary 色区分：

```css
/* 展开态（=选中态）已由 .is-active 的 border-left-color: primary 覆盖 */
/* 父目录展开时本身也是 is-active，不需要额外样式 */
```

> 注：由于展开 = 选中，父目录展开时本身已是 `is-active` 状态，`border-left-color` 已为 primary 色，无需额外引入新色值。

### 树状竖连接线
在 `.dir-children` 上添加左侧竖线：

```css
.dir-children {
  position: relative;
  border-left: 2px solid var(--md-sys-color-outline-variant);
  margin-left: 14px;       /* 对齐父目录文字起始位置 */
  padding-left: 12px;      /* 保持子项缩进 */
}
```

移除原有的 `padding: 0 0 0 16px`，改用 `margin-left` + `border-left` 组合。

### 子目录行样式
保持现有 `.nav-list__item--child` 的 `font-size: 0.88rem`，无需新增样式。

---

## 三、内联"+ 添加子目录"入口

### 渲染条件
```ts
const canAddChild = isExpanded && depth < 2;
```
- `isExpanded`：当前节点被选中（即展开）
- `depth < 2`：只在根目录（depth 0）和子目录（depth 1）显示；孙目录（depth 2）不显示

### 新增 State（App.tsx）
```ts
const [addingChildForDirId, setAddingChildForDirId] = useState<string | null>(null);
const [newChildDirName, setNewChildDirName] = useState('');
const [isCreatingChildDir, setIsCreatingChildDir] = useState(false);
```

- `addingChildForDirId`：当前展开内联表单的父目录 id（可为根目录或子目录的 id），`null` 表示无表单打开
- `newChildDirName`：内联表单的输入值
- `isCreatingChildDir`：提交中状态

### 内联表单行为
- 点击"+ 添加子目录"按钮：`setAddingChildForDirId(node.id)`
- 表单样式复用底部 `.dir-add-form` 相关类
- 回车或点击"确认"：调用 `createDirectory({ name: newChildDirName.trim(), parentId: node.id })`
- 提交成功后：`setAddingChildForDirId(null)`，刷新 `bootstrap`
- Escape 或点击"取消"：关闭表单

### 与底部"新建目录"的关系
底部 `handleConfirmAddDir` 中，`parentId` 改为始终传 `null`（创建根目录），不再依赖 `dirFilter` 推断：

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
| `apps/web/src/app/App.tsx` | 重构 + 新增 | 移除 `expandedDirs`/`toggleDir`；新增 3 个 child dir state；修改 `renderDirNodes`；修改底部 `parentId` 逻辑 |
| `apps/web/src/styles/global.css` | 修改 | `.dir-children` 改用 `border-left` + `margin-left`；可能新增内联表单定位样式 |

后端无需变更，`createDirectory` 已支持 `parentId`。

---

## 五、边界行为

- 选中孙目录（depth 2）时，孙目录展开（选中态），但不显示"+ 添加子目录"按钮
- 多个目录的内联表单互斥：打开新表单时，上一个自动关闭（`setAddingChildForDirId(node.id)` 覆盖）
- 删除一个有子目录的目录：后端使用 `mode=move_to_inbox`，子目录的 items 移至 inbox，前端刷新 bootstrap 后重新渲染
