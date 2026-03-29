# 实现 Todo

记录待完成的前后端联调工作，按优先级排序。

---

## 高优先级

### [ ] Modal 详情区补充字段

当前 Modal 只能编辑标题和备注，以下字段未连通：

- 进度（`progress`）：后端 `PATCH /api/items/:id` 已支持，前端 Modal 缺少选择器
- 所属目录（`directoryId`）：后端已支持，前端 Modal 缺少目录选择器，创建时也未传

### [ ] 侧边栏新建子目录入口

用户无法在根目录下创建项目，后端 `POST /api/directories` 已支持 `parentId`，前端侧边栏缺少创建入口和交互。

---

## 中优先级

### [ ] Modal 详情区补充更多字段

- 优先级（`priority`）
- 预期完成时间（`expectedAt`）

### [ ] 移动条目到其他目录

编辑条目时支持修改所属目录（依赖 Modal 目录选择器完成后处理）。

---

## 低优先级

### [ ] 目录重命名 / 删除入口

侧边栏缺少目录操作入口，后端接口已就绪：
- `PATCH /api/directories/:id`
- `DELETE /api/directories/:id`

### [ ] 移入回收站

前端无删除入口，后端 `POST /api/items/:id/trash` 已就绪。

### [ ] 搜索

前端无搜索框，后端 `GET /api/items?q=` 已支持标题搜索。

---

## 备注

- `activeCount` / `unclassifiedCount` 在写操作完成后需要重新拉取 bootstrap 刷新计数，待写操作联调完成后统一处理
