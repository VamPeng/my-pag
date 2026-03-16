# 05. 接口与服务边界

## 服务边界

V1 建议只有一个应用后端服务，职责包括：

- 提供前端页面访问入口
- 提供事项、目录、回收站、设置等 API
- 负责智能视图查询逻辑
- 负责与本地数据库交互

## API 设计原则

- REST 风格优先
- 资源边界清晰
- 避免过早设计复杂同步协议
- 所有写操作默认要求显式提交

## 建议资源

### items

建议接口：

- `GET /api/items`
- `POST /api/items`
- `GET /api/items/:id`
- `PATCH /api/items/:id`
- `POST /api/items/:id/complete`
- `POST /api/items/:id/trash`
- `POST /api/items/:id/restore`

### directories

建议接口：

- `GET /api/directories`
- `POST /api/directories`
- `PATCH /api/directories/:id`
- `DELETE /api/directories/:id`

说明：

- 删除目录时应通过请求参数或请求体显式传递处理模式
- 例如 `move_to_inbox` 或 `delete_with_items`

### views

建议接口：

- `GET /api/views/inbox`
- `GET /api/views/today`
- `GET /api/views/upcoming`
- `GET /api/views/overdue`

### settings

建议接口：

- `GET /api/settings`
- `PATCH /api/settings`

### bootstrap

建议接口：

- `GET /api/bootstrap`

说明：

- 用于返回当前账号、设置、目录树和必要初始数据
- 因为 V1 没有登录注册流程，前端需要一个统一初始化入口

## 当前不做的接口能力

- 登录接口
- 注册接口
- 文件上传接口
- WebSocket 实时协作接口
- 跨设备冲突合并接口
