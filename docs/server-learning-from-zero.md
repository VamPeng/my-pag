# My Pag Server 从 0 开始学习文档

这份文档的目标不是只告诉你“这个项目在做什么”，而是带你用一个真实项目学 Java 后端开发。

阅读目标：

- 先看懂项目结构
- 再看懂每个包的职责、数据模型和数据逻辑
- 最后沿着一条主链路，把类和方法串起来

本文选择的讲解方向是：

- 从外到内

原因：

- 对后端新手最自然
- 更接近真实请求流
- 更容易把 `Controller -> Service -> Repository -> SQL -> DB` 这一整套思维建立起来

---

## 1. 先建立对“后端项目”的基本认知

这个项目是一个单体 Spring Boot 服务。

一句话理解：

- 它是一个 Web API 服务
- 前端通过 HTTP 调它
- 它负责业务校验、数据查询、数据写入
- 数据存储在 SQLite

你可以先把它理解成一个“专门接请求、处理业务、访问数据库”的程序。

和 Android 开发最大的思维差异：

- Android 代码很多时候围着页面和状态走
- 后端代码很多时候围着请求、资源、业务规则和数据库走

在这个项目里，一次请求的典型流向是：

```text
Browser / Frontend
-> Controller
-> Service
-> Repository
-> SQLite
-> Repository
-> Service
-> Controller
-> JSON Response
```

---

## 2. 项目结构总览

服务端工程目录：

```text
apps/server/
  build.gradle.kts
  settings.gradle.kts
  gradlew
  src/
    main/
      java/com/vampeng/mypag/
        account/
        bootstrap/
        common/
        config/
        directory/
        health/
        item/
        setting/
        view/
      resources/
        application.yml
        db/migration/
    test/
```

各部分作用：

- `build.gradle.kts`
  归属：工程根
  作用：Gradle 构建脚本，定义插件、依赖、Java 版本、测试配置
  常用用法：加依赖、改插件版本、改构建行为

- `settings.gradle.kts`
  归属：工程根
  作用：定义 Gradle 根工程名
  常用用法：多模块时管理子模块，这里只做简单命名

- `src/main/java`
  归属：主代码目录
  作用：存放所有运行时代码

- `src/main/resources/application.yml`
  归属：配置层
  作用：Spring Boot 应用配置，例如端口、数据库连接、时区

- `src/main/resources/db/migration`
  归属：数据库初始化层
  作用：存放建表 SQL 脚本

- `src/test/java`
  归属：测试层
  作用：存放集成测试和基础启动测试

---

## 3. 技术栈先看懂

从 `build.gradle.kts` 可以读出核心技术：

- `Spring Boot`
  作用：提供应用启动、依赖注入、Web API、测试支持

- `spring-boot-starter-web`
  作用：做 HTTP 接口

- `spring-boot-starter-jdbc`
  作用：通过 JDBC 直接访问数据库

- `sqlite-jdbc`
  作用：连接 SQLite

这说明当前项目不是：

- JPA/Hibernate 风格
- MyBatis 风格
- 复杂 ORM 风格

而是：

- Spring Boot + JdbcTemplate + 手写 SQL

这对学习很有价值，因为链路更直接，比较容易看清后端的底层动作。

---

## 4. 模块总览

### 4.1 `account`

主要作用：

- 负责“当前账号”概念
- 当前版本没有登录系统，所以它用默认账号兜底

对应数据模型：

- `accounts` 表
- `CurrentAccountService.Account` 记录对象

数据逻辑：

- 每次业务请求先确保默认账号存在
- 如果不存在，就自动插入一条默认账号

适合你理解成：

- 当前后端的“账号上下文提供者”

### 4.2 `bootstrap`

主要作用：

- 给前端提供启动时需要的一揽子初始化数据

对应数据模型：

- `BootstrapResponse`
- `AccountResponse`

数据逻辑：

- 聚合账号
- 聚合设置
- 聚合目录树

适合你理解成：

- 前端首页或应用启动时的“初始化接口”

### 4.3 `common`

主要作用：

- 放全局通用逻辑

当前只有：

- `DbMigrationsRunner`

数据逻辑：

- 应用启动时自动执行 `db/migration/*.sql`
- 自动确保 SQLite 文件父目录存在

适合你理解成：

- 启动阶段基础设施逻辑

### 4.4 `config`

主要作用：

- 放框架配置

当前只有：

- `WebCorsConfig`

数据逻辑：

- 配置 `/api/**` 的跨域策略

适合你理解成：

- Web 框架行为配置层

### 4.5 `directory`

主要作用：

- 管理目录树

对应数据模型：

- `directories` 表
- `DirectoryRecord`
- `DirectoryNode`

数据逻辑：

- 创建目录
- 重命名目录
- 查询目录树
- 删除目录子树
- 删除时选择“移到收件箱”或“连事项一起进回收站”

适合你理解成：

- 树形分类系统

### 4.6 `health`

主要作用：

- 健康检查

对应数据模型：

- 简单 `Map<String, Object>`

数据逻辑：

- 返回服务状态、服务名、时间戳

适合你理解成：

- 运维或调试最小接口

### 4.7 `item`

主要作用：

- 管理事项核心资源

对应数据模型：

- `items` 表
- `ItemRecord`
- `CreateItemRequest`
- `PatchItemRequest`
- `ItemResponse`
- `ListItemsQuery`

数据逻辑：

- 创建事项
- 查询事项
- 列表筛选
- 更新事项
- 完成事项
- 移入回收站
- 恢复事项

适合你理解成：

- 项目的核心业务模块

### 4.8 `setting`

主要作用：

- 管理当前账号的个人设置

对应数据模型：

- `settings` 表
- `SettingsRecord`
- `SettingsPatchRequest`
- `SettingsResponse`

数据逻辑：

- 默认设置懒创建
- 当前只支持“近期范围”的值和单位

适合你理解成：

- 个人偏好配置模块

### 4.9 `view`

主要作用：

- 提供智能视图查询

对应数据模型：

- 没有独立表
- 复用 `items` 表
- `ViewItemRecord`
- `ViewItemResponse`

数据逻辑：

- 收件箱查询
- 今天查询
- 近期查询
- 逾期查询

适合你理解成：

- 基于现有事项表做聚合查询的“读模型模块”

---

## 5. 数据库模型从 0 看

### 5.1 `accounts`

来源：

- `V001__init_accounts.sql`

字段：

- `id`：账号 ID
- `name`：账号名
- `status`：账号状态
- `created_at`：创建时间
- `updated_at`：更新时间

作用：

- 虽然当前没有登录，但所有业务数据都归属于某个账号

### 5.2 `directories`

来源：

- `V002__init_directories.sql`

字段：

- `id`：目录 ID
- `account_id`：归属账号
- `parent_id`：父目录 ID，支持树结构
- `name`：目录名
- `sort_order`：排序值
- `is_deleted`：是否软删除
- `created_at`
- `updated_at`

作用：

- 目录不是简单列表，而是树

关键点：

- `parent_id` 让它形成父子结构
- `is_deleted` 说明目录删除不是硬删

### 5.3 `items`

来源：

- `V003__init_items.sql`

字段：

- `id`
- `account_id`
- `directory_id`
- `title`
- `notes`
- `progress`
- `priority`
- `expected_at`
- `completed_at`
- `trashed_at`
- `created_at`
- `updated_at`

作用：

- 存放核心事项数据

关键点：

- `directory_id = NULL` 表示收件箱
- `trashed_at != NULL` 表示在回收站
- `completed_at` 单独保存完成时间

### 5.4 `settings`

来源：

- `V004__init_settings.sql`

字段：

- `id`
- `account_id`
- `recent_range_value`
- `recent_range_unit`
- `created_at`
- `updated_at`

作用：

- 存放当前账号的设置

关键点：

- `account_id` 唯一索引保证一账号一份设置

---

## 6. 为什么要分 Controller / Service / Repository

这是 Java 后端里非常常见的一种结构。

### 6.1 `Controller`

归属模块：

- 各业务包内部的接口层

主要作用：

- 接收 HTTP 请求
- 解析路径参数、查询参数、请求体
- 调用 Service
- 返回响应对象

常用用法：

- `@GetMapping`
- `@PostMapping`
- `@PatchMapping`
- `@DeleteMapping`
- `@RequestBody`
- `@PathVariable`
- `@RequestParam`

你可以把它理解成：

- Web 入口层

### 6.2 `Service`

归属模块：

- 各业务包内部的业务层

主要作用：

- 业务校验
- 默认值处理
- 业务规则计算
- 事务边界管理
- 协调多个依赖

常用用法：

- `@Service`
- `@Transactional`
- `ResponseStatusException`

你可以把它理解成：

- 真正写“系统规则”的地方

### 6.3 `Repository`

归属模块：

- 各业务包内部的数据访问层

主要作用：

- 写 SQL
- 执行 SQL
- 把查询结果映射成 Java record

常用用法：

- `JdbcTemplate.update(...)`
- `JdbcTemplate.query(...)`

你可以把它理解成：

- 数据库读写层

---

## 7. 从外到内，逐类讲解

下面按照请求流来讲。

---

## 8. 启动和全局基础设施

### 8.1 `MyPagApplication`

文件：

- `com.vampeng.mypag.MyPagApplication`

归属模块：

- 应用入口

主要作用：

- Spring Boot 启动入口

核心方法：

- `main(String[] args)`
  作用：调用 `SpringApplication.run(...)` 启动整个应用容器

技术重点：

- Spring Boot 会在启动时扫描同包及子包里的 Bean
- 因为主类在 `com.vampeng.mypag` 根包下，所以所有子包都能被自动扫描到

### 8.2 `DbMigrationsRunner`

文件：

- `common/DbMigrationsRunner.java`

归属模块：

- `common`

主要作用：

- 应用启动后执行数据库建表脚本

核心方法：

- `run(ApplicationArguments args)`
  作用：查找所有 migration SQL，按文件名排序后逐个执行

- `ensureParentDirectoryExistsForSqlite()`
  作用：如果数据库路径是 SQLite 文件路径，就先创建父目录

技术重点：

- 它实现了 `ApplicationRunner`
- 这意味着 Spring Boot 启动完成后，它会自动执行
- 这里没有接入 Flyway，而是自己写了一个极简 migration runner

学习点：

- 这类类通常不处理业务，而处理“应用启动时要准备好什么”

### 8.3 `WebCorsConfig`

文件：

- `config/WebCorsConfig.java`

归属模块：

- `config`

主要作用：

- 配置跨域

核心方法：

- `addCorsMappings(CorsRegistry registry)`
  作用：允许 `/api/**` 被浏览器跨域访问

技术重点：

- 浏览器前端和后端端口不同，默认会触发跨域限制
- 后端必须明确允许某些跨域请求

学习点：

- 配置类不是业务类
- 它影响的是框架行为

### 8.4 `HealthController`

文件：

- `health/HealthController.java`

归属模块：

- `health`

主要作用：

- 提供健康检查接口

核心方法：

- `health()`
  作用：返回一个最基础的健康状态响应

技术重点：

- 运维里很常见
- 常用于容器探针、反向代理检查、手动诊断

---

## 9. `account` 模块

### 9.1 `CurrentAccountService`

文件：

- `account/CurrentAccountService.java`

归属模块：

- `account`

模块主要作用：

- 给全系统提供“当前账号”

当前实现特点：

- 没有登录
- 没有 token
- 没有 session
- 永远只使用 `default-account`

核心数据模型：

- `Account`
  作用：表示当前账号的简单读模型

核心方法：

- `ensureCurrentAccount()`
  作用：
  - 先查默认账号是否存在
  - 不存在就插入
  - 最后返回这条账号记录

技术重点：

- 这是一个“懒初始化”模式
- 业务代码不用关心账号是否存在，只需要先调用它

学习点：

- 这里虽然是 `Service`，但它偏基础上下文服务，不是业务资源服务

---

## 10. `setting` 模块

### 10.1 `SettingsController`

归属模块：

- `setting`

主要作用：

- 暴露设置相关 HTTP 接口

核心方法：

- `getSettings()`
  作用：获取当前账号设置

- `patchSettings(SettingsPatchRequest request)`
  作用：更新当前账号设置

### 10.2 `SettingsRepository`

归属模块：

- `setting`

主要作用：

- 访问 `settings` 表

核心数据模型：

- `SettingsRecord`
  作用：数据库层读写使用的记录对象

核心方法：

- `findByAccountId(String accountId)`
  作用：查当前账号设置

- `createDefault(String accountId)`
  作用：插入默认设置

- `update(...)`
  作用：更新设置值

技术重点：

- 这里使用 `Optional`
- 表示数据库查询可能没有结果

### 10.3 `SettingsService`

归属模块：

- `setting`

主要作用：

- 管理当前账号设置的业务逻辑

核心数据模型：

- `SettingsPatchRequest`
  作用：PATCH 请求体

- `SettingsResponse`
  作用：接口返回体

核心方法：

- `getCurrentSettings()`
  作用：
  - 获取当前账号
  - 查设置
  - 如果没有则创建默认设置
  - 返回响应对象

- `updateCurrentSettings(...)`
  作用：
  - 读取当前设置
  - 合并 patch 值
  - 校验合法性
  - 更新数据库

- `validate(...)`
  作用：校验设置值是否合法

- `toResponse(...)`
  作用：把 repository record 转成接口返回对象

技术重点：

- 这里体现了后端常见的 patch 语义：未传字段保持原值
- `day/week` 用 `Set` 限制允许值

---

## 11. `directory` 模块

### 11.1 `DirectoryController`

归属模块：

- `directory`

主要作用：

- 暴露目录接口

核心方法：

- `getDirectories()`
  作用：获取目录树

- `createDirectory(...)`
  作用：创建目录

- `renameDirectory(...)`
  作用：重命名目录

- `deleteDirectory(...)`
  作用：删除目录

技术重点：

- 删除目录时必须传 `mode`
- 说明删除不是简单动作，而是带策略的业务行为

### 11.2 `DirectoryRepository`

归属模块：

- `directory`

主要作用：

- 访问 `directories` 表
- 也负责目录删除时关联更新 `items`

核心数据模型：

- `DirectoryRecord`
  作用：数据库层目录对象

核心方法：

- `create(...)`
  作用：插入目录

- `findActiveById(...)`
  作用：按 ID 查询未删除目录

- `findAllActiveByAccountId(...)`
  作用：查某账号下所有未删除目录

- `rename(...)`
  作用：更新目录名

- `findActiveSubtreeIds(...)`
  作用：用递归 CTE 查整棵子树的目录 ID

- `softDelete(...)`
  作用：把目录标记为删除

- `moveItemsToInbox(...)`
  作用：把目录下事项的 `directory_id` 设为 `NULL`

- `trashItems(...)`
  作用：把目录下事项打上 `trashed_at`

技术重点：

- `WITH RECURSIVE` 是 SQL 递归查询，适合树结构
- 删除目录时同时处理 `items`，说明数据层考虑了级联业务效果

### 11.3 `DirectoryService`

归属模块：

- `directory`

主要作用：

- 承担目录树的业务规则和树构建逻辑

核心数据模型：

- `CreateDirectoryRequest`
- `RenameDirectoryRequest`
- `DirectoryNode`
- `MutableNode`
- `DeleteMode`

核心方法：

- `getTree()`
  作用：查目录记录并构造成树

- `create(...)`
  作用：校验父目录、处理排序值、创建目录

- `rename(...)`
  作用：重命名目录

- `delete(...)`
  作用：
  - 解析删除模式
  - 找整棵子树
  - 决定事项如何处理
  - 最后软删除目录

- `validateName(...)`
  作用：校验目录名不能为空

- `buildTree(...)`
  作用：把平铺记录构造成树

- `sortNodes(...)`
  作用：对子节点递归排序

- `toNode(...)`
  作用：把可变节点或记录对象转成只读响应节点

技术重点：

- `MutableNode` 是构树时的中间对象
- `DirectoryNode` 是对外响应对象
- 这是“内部可变、对外不可变”的常见写法

学习点：

- 树结构一般不会直接在数据库中按对象树存储
- 常见做法是数据库平铺存，Service 层组装成树

---

## 12. `item` 模块

这是最值得学习的模块。

### 12.1 `ItemController`

归属模块：

- `item`

主要作用：

- 暴露事项资源的 HTTP 接口

核心方法：

- `listItems(...)`
  作用：根据查询参数列出事项

- `createItem(...)`
  作用：创建事项

- `getItem(String itemId)`
  作用：查单个事项

- `patchItem(...)`
  作用：更新事项

- `completeItem(...)`
  作用：一键完成事项

- `trashItem(...)`
  作用：移入回收站

- `restoreItem(...)`
  作用：恢复事项

技术重点：

- 这是标准 REST 风格写法
- 一个资源有列表、创建、详情、更新，以及几个动作型子接口

### 12.2 `ItemRepository`

归属模块：

- `item`

主要作用：

- 访问 `items` 表

核心数据模型：

- `ListFilter`
- `ItemRecord`

核心方法：

- `create(...)`
  作用：
  - 生成 UUID
  - 插入事项
  - 再查回刚插入的数据

- `findById(...)`
  作用：按账号和 ID 查单条事项

- `list(...)`
  作用：动态拼接查询条件，列出事项

- `update(...)`
  作用：更新事项字段

- `mapRow(...)`
  作用：把 `ResultSet` 映射成 `ItemRecord`

技术重点：

- `list(...)` 用 `StringBuilder` 动态拼 SQL
- `args` 列表存放占位参数，避免拼接值本身
- 查询默认排除回收站数据

学习点：

- 这就是手写 SQL 风格 Repository 的典型样子

### 12.3 `ItemService`

归属模块：

- `item`

主要作用：

- 管理事项业务规则

核心数据模型：

- `CreateItemRequest`
- `PatchItemRequest`
- `ListItemsQuery`
- `ItemResponse`

静态常量：

- `ALLOWED_PROGRESS`
- `ALLOWED_PRIORITY`

作用：

- 定义允许的枚举值集合

核心方法：

- `create(...)`
  作用：
  - 获取当前账号
  - 校验标题
  - 校验目录是否存在
  - 处理默认进度
  - 校验优先级和时间
  - 如果直接创建为 done，就写 `completedAt`
  - 调 Repository 创建

- `getById(...)`
  作用：查不到就抛 404

- `list(...)`
  作用：
  - 规范化筛选参数
  - 调 Repository 查询
  - 把数据库对象转成响应对象

- `patch(...)`
  作用：
  - 先查当前事项
  - 对每个字段做 patch 合并
  - 根据新进度决定 `completedAt`
  - 更新数据库

- `complete(...)`
  作用：一键把进度改成 `done`

- `trash(...)`
  作用：打上 `trashed_at`

- `restore(...)`
  作用：清空 `trashed_at`

辅助方法：

- `normalizeTitle(...)`
  作用：标题非空校验 + 去空格

- `normalizeText(...)`
  作用：普通文本去空格

- `normalizeDirectoryId(...)`
  作用：目录为空则视为收件箱，不为空就校验目录存在

- `normalizeProgress(...)`
  作用：校验进度是否合法

- `normalizePriority(...)`
  作用：校验优先级是否合法

- `normalizeExpectedAt(...)`
  作用：校验时间字符串是否能被 `Instant` 正确解析

- `toResponse(...)`
  作用：把数据库对象转换成接口响应对象

技术重点：

- 这个类是理解后端最关键的地方
- 它不接触 HTTP 注解
- 也不直接写 SQL
- 它专门处理业务规则

学习点：

- 很多后端初学者会把校验写在 Controller
- 这个项目选择把核心校验放在 Service，更利于复用和测试

---

## 13. `view` 模块

### 13.1 `ViewController`

归属模块：

- `view`

主要作用：

- 暴露智能视图接口

核心方法：

- `inbox()`
- `today()`
- `upcoming()`
- `overdue()`

作用：

- 每个方法对应一个只读视图接口

### 13.2 `ViewRepository`

归属模块：

- `view`

主要作用：

- 基于 `items` 表执行各种视图 SQL

核心数据模型：

- `ViewItemRecord`

核心方法：

- `inbox(accountId)`
  作用：查收件箱事项，条件是 `directory_id IS NULL`

- `today(accountId, dayStart, nextDayStart)`
  作用：查今天的事项

- `upcoming(accountId, now, upperBound)`
  作用：查近期事项

- `overdue(accountId, now)`
  作用：查逾期且未完成事项

- `mapRow(...)`
  作用：映射查询结果

技术重点：

- 这个模块没有独立表
- 说明“视图”在这里是查询逻辑，不是存储实体

### 13.3 `ViewService`

归属模块：

- `view`

主要作用：

- 负责时间边界计算和视图查询协调

核心常量：

- `APP_ZONE`
  作用：定义应用时区为 `Asia/Shanghai`

核心方法：

- `inbox()`
  作用：直接查收件箱

- `today()`
  作用：
  - 先算出今天起点和明天起点
  - 再查这个时间范围内的事项

- `upcoming()`
  作用：
  - 先读设置里的近期范围
  - 再把范围换算成秒
  - 再查这段时间内的事项

- `overdue()`
  作用：查现在之前且未完成的事项

- `toSeconds(...)`
  作用：把 day/week 转成秒数

- `toResponse(...)`
  作用：把数据库对象转成响应对象

技术重点：

- 视图模块的关键不是写入，而是查询语义
- 时间边界通常放在 Service 算，不放在 Controller

---

## 14. `bootstrap` 模块

### 14.1 `BootstrapController`

归属模块：

- `bootstrap`

主要作用：

- 暴露初始化接口

核心方法：

- `getBootstrap()`
  作用：返回启动需要的聚合数据

### 14.2 `BootstrapService`

归属模块：

- `bootstrap`

主要作用：

- 聚合多个模块数据

核心数据模型：

- `BootstrapResponse`
- `AccountResponse`

核心方法：

- `getBootstrap()`
  作用：
  - 取当前账号
  - 取当前设置
  - 取目录树
  - 组合成一个响应

技术重点：

- 这是典型的“聚合服务”
- 它本身不拥有表，而是组合别的模块结果

学习点：

- 一个后端服务不一定每个接口都直连一个表
- 有些接口的意义是“给前端凑齐初始化上下文”

---

## 15. 测试怎么帮助理解架构

### 15.1 `MyPagApplicationTests`

主要作用：

- 最基础的上下文加载测试

核心方法：

- `contextLoads()`
  作用：验证 Spring Boot 容器能启动

### 15.2 `ApiIntegrationTest`

主要作用：

- 用集成测试覆盖主要 API 行为

技术重点：

- `@SpringBootTest`
  作用：启动完整 Spring 上下文

- `@AutoConfigureMockMvc`
  作用：注入 `MockMvc`，模拟 HTTP 请求

- `@DynamicPropertySource`
  作用：测试时动态指定 SQLite 文件路径

- `@BeforeEach`
  作用：每次测试前清理表数据

学习点：

- 这类测试非常适合后端学习
- 因为它能让你从“HTTP 请求”的角度验证整个链路

---

## 16. 选一条主线：从外到内看“新增一个事项”

这是整个项目里最适合入门的一条主线。

### 第 1 步：前端或测试发起请求

目标接口：

- `POST /api/items`

请求体类似：

```json
{
  "title": "和同事确认接口字段",
  "directoryId": "some-directory-id",
  "progress": "doing",
  "priority": "high",
  "expectedAt": "2026-03-20T10:00:00Z"
}
```

### 第 2 步：`ItemController.createItem(...)`

做的事：

- 收到 JSON 请求体
- Spring 自动把 JSON 转成 `CreateItemRequest`
- Controller 调用 `itemService.create(request)`

这里最重要的学习点：

- Controller 不写业务细节
- 它只是 Web 入口适配层

### 第 3 步：`ItemService.create(...)`

做的事：

- 确保当前账号存在
- 标题非空
- 目录若存在则必须合法
- 进度若为空则默认 `todo`
- 优先级若填写则必须合法
- 时间若填写则必须是合法 ISO 时间
- 如果进度是 `done`，自动填 `completedAt`

这里最重要的学习点：

- 业务规则集中在 Service
- 默认值和业务派生字段也在 Service

### 第 4 步：`ItemRepository.create(...)`

做的事：

- 生成 UUID
- 生成当前时间
- 执行 `INSERT INTO items`
- 再查回刚插入的数据

这里最重要的学习点：

- Repository 不关心 HTTP
- 它只关心数据库怎么写

### 第 5 步：返回响应

做的事：

- Repository 返回 `ItemRecord`
- Service 转成 `ItemResponse`
- Controller 把它返回给 Spring
- Spring 自动序列化成 JSON

这里最重要的学习点：

- Java 对象最终会自动变成 HTTP JSON 响应
- 这是 Spring Boot 帮你做的

---

## 17. 如果你要真正学会这个项目，推荐阅读顺序

第一轮：

1. `MyPagApplication`
2. `application.yml`
3. `ItemController`
4. `ItemService`
5. `ItemRepository`
6. `V003__init_items.sql`

第二轮：

1. `DirectoryController`
2. `DirectoryService`
3. `DirectoryRepository`
4. `V002__init_directories.sql`

第三轮：

1. `SettingsController`
2. `SettingsService`
3. `SettingsRepository`
4. `ViewController`
5. `ViewService`
6. `ViewRepository`

第四轮：

1. `CurrentAccountService`
2. `BootstrapService`
3. `DbMigrationsRunner`
4. `ApiIntegrationTest`

---

## 18. 你现在最应该建立的后端直觉

请反复记这几条：

- Controller 接请求，不写核心规则
- Service 写规则，不直接拼 HTTP
- Repository 写 SQL，不决定业务语义
- 表结构负责存数据，不负责解释业务
- 一个业务功能通常会跨多个类协作完成

如果你把这五条建立起来，你已经不是在“看 Java 代码”，而是在开始“理解 Java 后端”了。

---

## 19. 下一步怎么学最有效

最推荐的方式不是继续看更多概念，而是做这三件事：

1. 盯着 `ItemController -> ItemService -> ItemRepository` 再手动走一遍创建事项链路
2. 自己尝试说出每层的职责
3. 再切到“删除目录”链路，体会一个更复杂的业务流程如何跨多个数据对象工作

如果继续往下学，我建议下一篇就只做一件事：

- 逐行讲解 `ItemService.create(...)` 和 `ItemRepository.create(...)`

这是最接近“你真正开始学会 Java 后端开发”的位置。
