# 06. 工程结构与模块划分

## 推荐仓库结构

建议采用前后端同仓库结构，首版目录如下：

```text
my-pag/
  apps/
    web/
    server/
  docs/
  scripts/
  deploy/
```

说明：

- `apps/web`：React 前端
- `apps/server`：Spring Boot 后端
- `docs`：需求文档与技术方案
- `scripts`：开发和运维辅助脚本
- `deploy`：Docker Compose、环境样例、部署相关文件

## 后端模块划分

`apps/server` 建议采用以下分层：

```text
apps/server/
  src/main/java/.../
    config/
    common/
    account/
    directory/
    item/
    view/
    setting/
    trash/
  src/main/resources/
    db/migration/
    application.yml
```

## 分层职责

### config

- 数据源配置
- Web 配置
- JSON 序列化配置
- 跨域和基础拦截器配置

### common

- 通用异常
- 通用响应结构
- 时间工具
- 枚举定义

### account

- 当前账号读取
- 手动预置账号加载

说明：

- V1 没有完整登录流程，但账号主体仍然需要独立模块承载

### directory

- 目录树查询
- 新增目录
- 重命名目录
- 删除目录及其处理策略

### item

- 事项增删改查
- 一键完成
- 搜索标题
- 进度与优先级更新

### view

- 收件箱
- 今天
- 近期
- 逾期

说明：

- 视图模块负责聚合查询逻辑，而不是新增实体表

### setting

- 近期范围配置
- 其他个人偏好配置

### trash

- 回收站查询
- 恢复事项
- 永久清理的后续扩展点

## 后端代码层建议

每个业务模块建议保持以下分层：

```text
controller/
service/
repository/
model/
dto/
```

职责建议：

- `controller`：接收 HTTP 请求
- `service`：承载业务规则
- `repository`：编写 SQL 与数据库交互
- `model`：领域对象或记录对象
- `dto`：接口输入输出结构

## 前端建议结构

`apps/web` 建议采用以下结构：

```text
apps/web/
  src/
    app/
    pages/
    features/
    components/
    services/
    types/
    styles/
```

说明：

- `features` 用于承载 item、directory、view、trash 等业务模块
- `services` 用于封装 API 请求
- `types` 用于共享前端类型定义

## SQL Migration 结构

建议放在：

```text
apps/server/src/main/resources/db/migration/
```

文件命名建议：

- `V001__init_accounts.sql`
- `V002__init_directories.sql`
- `V003__init_items.sql`
- `V004__init_settings.sql`

## 当前不建议的结构

- 前后端完全混写在同一个源码目录
- 以后端技术层分包但不按业务模块分组
- 将 migration、脚本、部署文件散落在仓库各处
