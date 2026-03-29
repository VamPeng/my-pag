# 侧边栏子目录样式与交互 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构侧边栏目录展开逻辑为路径驱动，新增树状竖连接线，并移除所有"新建目录"入口。

**Architecture:** 展开状态由 `expandedDirs: Set<string>` 缓存，选中目录时写入从根到该目录的完整 id 路径；CSS 用 `.dir-children` 的 `border-left` 绘制树状连接线；新建目录功能（state、函数、JSX、CSS）全部删除。

**Tech Stack:** React 18, TypeScript, plain CSS (no CSS-in-JS), Vite

---

## 文件变更范围

| 文件 | 操作 |
|---|---|
| `apps/web/src/app/App.tsx` | 修改：新增 `findPathToDir`；修改 `handleDirFilterClick`；移除 `toggleDir` 及调用；移除添加目录相关 state/ref/函数/JSX |
| `apps/web/src/styles/global.css` | 修改：替换 `.dir-children` 规则；删除所有 `dir-add-*` 样式 |

无新建文件，无后端变更。

---

## Task 1: 移除添加目录相关 State、Ref 与函数

**Files:**
- Modify: `apps/web/src/app/App.tsx`

- [ ] **Step 1: 删除 state 与 ref 声明**

  在 `App.tsx` 中找到并删除以下四行（约第 72–76 行）：

  ```ts
  // 删除这四行：
  const [isAddingDir, setIsAddingDir] = useState(false);
  const [newDirName, setNewDirName] = useState('');
  const [isCreatingDir, setIsCreatingDir] = useState(false);
  const addDirInputRef = useRef<HTMLInputElement>(null);
  ```

- [ ] **Step 2: 删除三个处理函数**

  删除以下三个函数（约第 298–323 行）：

  ```ts
  // 删除 openAddDir、cancelAddDir、handleConfirmAddDir 三个函数
  function openAddDir() { ... }
  function cancelAddDir() { ... }
  async function handleConfirmAddDir() { ... }
  ```

- [ ] **Step 3: 删除底部添加目录 JSX 块**

  在 `renderDirNodes` 之后，找到 `<section className="panel">` 内的添加入口，删除以下整块（约第 496–524 行）：

  ```tsx
  // 删除从 {isAddingDir ? ( 到最后的 </button>)} 整个条件渲染块：
  {isAddingDir ? (
    <div className="dir-add-form">
      ...
    </div>
  ) : (
    <button type="button" className="dir-add-btn" onClick={openAddDir}>
      ...
    </button>
  )}
  ```

- [ ] **Step 4: 确认编译无错误**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  期望：无类型错误输出。

- [ ] **Step 5: Commit**

  ```bash
  git add apps/web/src/app/App.tsx
  git commit -m "refactor: remove add-directory feature from sidebar"
  ```

---

## Task 2: 重构展开/收起逻辑为路径驱动

**Files:**
- Modify: `apps/web/src/app/App.tsx`

- [ ] **Step 1: 新增 `findPathToDir` 辅助函数**

  在 `App.tsx` 顶部的工具函数区（`findDirName` 附近，约第 24 行后）添加：

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

- [ ] **Step 2: 修改 `handleDirFilterClick`**

  将现有函数（约第 179–182 行）替换为：

  ```ts
  function handleDirFilterClick(df: DirFilter) {
    if (dirFilterEquals(dirFilter, df)) return;

    setDirFilter(df);

    if (df.type === 'directory') {
      const path = findPathToDir(bootstrap!.directories, df.id);
      setExpandedDirs(new Set(path ?? []));
    } else {
      setExpandedDirs(new Set());
    }
  }
  ```

- [ ] **Step 3: 移除 `toggleDir` 函数及所有调用**

  删除 `toggleDir` 函数定义（约第 54–61 行）：

  ```ts
  // 删除：
  function toggleDir(id: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  ```

  在 `renderDirNodes` 的点击 handler 中，找到同时调用 `handleDirFilterClick` 和 `toggleDir` 的地方（约第 364–367 行），改为只调用 `handleDirFilterClick`：

  ```tsx
  // 修改前：
  onClick={() => {
    handleDirFilterClick({ type: 'directory', id: node.id });
    if (hasChildren) toggleDir(node.id);
  }}

  // 修改后：
  onClick={() => handleDirFilterClick({ type: 'directory', id: node.id })}
  ```

- [ ] **Step 4: 确认编译无错误**

  ```bash
  cd apps/web && npx tsc --noEmit
  ```

  期望：无类型错误。

- [ ] **Step 5: 手动验证展开行为**

  启动开发服务器（若未运行）：

  ```bash
  cd apps/web && npm run dev
  ```

  验证以下场景：
  - 点击根目录 → 展开子列表
  - 点击子目录 → 根目录保持展开，子目录展开
  - 点击「生活」→「工作」子树收起
  - 再次点击已选中目录 → 无任何变化
  - 点击「全部」→ 所有目录收起

- [ ] **Step 6: Commit**

  ```bash
  git add apps/web/src/app/App.tsx
  git commit -m "refactor: path-based directory expansion, remove toggleDir"
  ```

---

## Task 3: 新增树状竖连接线 CSS

**Files:**
- Modify: `apps/web/src/styles/global.css`

- [ ] **Step 1: 替换 `.dir-children` 规则**

  找到当前 `.dir-children` 规则（约第 185–192 行）：

  ```css
  .dir-children {
    list-style: none;
    padding: 0 0 0 16px;
    margin: 4px 0 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  ```

  替换为：

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

- [ ] **Step 2: 删除所有 `dir-add-*` 样式**

  找到并删除以下样式块（约第 739–815 行），共约 10 个规则：

  ```css
  /* 全部删除：*/
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

- [ ] **Step 3: 手动验证视觉效果**

  在浏览器中确认：
  - 展开根目录后，子目录列表左侧出现竖连接线
  - 竖线颜色为 `outline-variant`（浅色中性）
  - 子项缩进合理，与父目录 dot 对齐
  - 原"新建目录"按钮区域已消失

- [ ] **Step 4: Commit**

  ```bash
  git add apps/web/src/styles/global.css
  git commit -m "style: add tree connector line to dir-children, remove add-dir styles"
  ```

---

## 完成后检查清单

- [ ] `npx tsc --noEmit` 无错误
- [ ] 页面无 console 报错
- [ ] 三层目录结构（根→子→孙）展开行为正确
- [ ] 「全部」按钮点击后所有目录收起
- [ ] 树状竖线视觉正常
- [ ] 侧边栏底部无残留的"新建目录"按钮
