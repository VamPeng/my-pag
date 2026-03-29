# 设计文档：正文顶部添加目录按钮

**日期**：2026-03-29  
**状态**：已确认，待实施  
**范围**：`apps/web/src/app/App.tsx`、`apps/web/src/styles/global.css`

---

## 功能描述

在正文 header 的标题（h2）右侧新增一个图标按钮，用于添加目录。同时将快捷创建任务输入框从 header 迁移到任务列表上方。

---

## 布局变化

**变更前：**
```
header: [h2 标题]  [quick task input]       [筛选下拉]
body:   [任务列表]
```

**变更后：**
```
header: [h2 标题]  [+ 目录图标按钮]          [筛选下拉]
body:   [quick task input]
        [任务列表]
```

---

## 添加目录按钮

- 图标：文件夹加号 SVG，18×18px
- 始终显示
- 点击后在标题行内联展开输入框（h2 保留，输入框出现在其右侧）
- Enter 确认，Escape 取消，自动聚焦

展开态：`[h2]  [____输入框____] [✓] [✕]`

---

## 上下文创建逻辑

| `dirFilter` | parentId |
|---|---|
| `null` 或 `unclassified` | `null`（创建根目录） |
| `{ type: 'directory', id: X }` | `X`（创建 X 的子目录） |

---

## State 变更（App.tsx）

新增：
```ts
const [isAddingDir, setIsAddingDir] = useState(false);
const [newDirName, setNewDirName] = useState('');
const [isCreatingDir, setIsCreatingDir] = useState(false);
const addDirInputRef = useRef<HTMLInputElement>(null);
```

新增函数：`openAddDir`、`cancelAddDir`、`handleConfirmAddDir`

---

## Import 变更

重新引入 `createDirectory` 到 import 列表。
