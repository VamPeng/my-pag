# 03. 技术栈选型

## 推荐技术栈

- 前端：React + TypeScript + Vite
- 后端：Java 17 + Spring Boot
- 数据库：SQLite
- 数据访问：Spring Web + Spring JDBC
- 建表与演进：仓库内维护 SQL migration 脚本
- 部署编排：Docker Compose
- 远程访问：Tailscale

## 选型理由

### 前端

选择 `React + TypeScript + Vite` 的原因：

- 适合单页面应用
- 开发反馈快，适合当前从 0 到 1 的阶段
- 后续如果扩展到更复杂前端结构，迁移成本低

### 后端

选择 `Java 17 + Spring Boot` 的原因：

- 更适合承载清晰的数据边界和长期演进
- 对目录树、回收站、账号主体这类后端模型更稳
- 后续如果从个人工具继续演进成正式产品，迁移成本更低
- 在 API、校验、事务和模块组织上有成熟做法

### 数据库

选择 `SQLite` 的原因：

- 当前主场景是单人使用，且数据库部署在个人电脑上
- 不需要为 V1 先引入独立数据库服务进程和额外运维负担
- 单文件数据库便于本地备份、迁移和后续排查

### 数据访问

选择 `Spring JDBC` 的原因：

- 当前数据模型不算复杂，没有必要一开始就上重 ORM
- 对 SQLite 这种单机数据库方案更直接
- SQL 可控，后续如果迁移 PostgreSQL，重写成本也可接受
- 有利于把智能视图、回收站、目录删除策略这类查询逻辑写清楚

### 建表与演进

当前建议先采用仓库内维护 SQL migration 脚本的方式。

原因：

- V1 模型规模可控
- 比额外引入复杂迁移框架更直接
- 便于明确记录 SQLite 下的表结构和索引变化

### 远程访问

选择 `Tailscale` 作为首选方案的原因：

- 可以通过受控设备网络访问笔记本上的服务
- 不需要直接将数据库或应用服务暴露到公网
- 比泛化的“随便做个内网穿透”更容易控制访问边界

## 当前不推荐的替代方案

- `localStorage` / `IndexedDB`：不适合作为主存储
- PostgreSQL：V1 过重，先不引入
- Next.js 全栈：当前阶段没有明显收益，反而增加路由和服务端复杂度
- Electron / Tauri：当前产品重点是多端访问，不优先做桌面壳
- 重 ORM 方案：V1 先不优先引入

## 参考资料

- Vite 官方文档：https://vite.dev/guide/
- Spring Boot 官方文档：https://docs.spring.io/spring-boot/
- Spring Boot 3.2 Getting Started：https://docs.spring.io/spring-boot/docs/3.2.10/reference/html/getting-started.html
- Spring Framework JDBC 文档：https://docs.spring.io/spring-framework/reference/data-access/jdbc.html
- SQLite 官方文档：https://www.sqlite.org/docs.html
- Tailscale 文档：https://tailscale.com/kb
