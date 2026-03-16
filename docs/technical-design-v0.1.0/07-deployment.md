# 07. 部署方案

## 推荐部署形态

推荐将服务部署在用户自己的 Ubuntu 笔记本上。

部署目标：

- 该设备既是应用服务宿主机，也是数据库宿主机
- 通过私有访问链路从外部设备访问
- 避免数据库端口直接暴露

## 推荐部署结构

### 宿主机

- Ubuntu
- Tailscale
- Docker Engine
- Docker Compose

### 容器

- `app`：Spring Boot API 服务，可同时负责静态资源分发，或与静态前端资源一起部署

说明：

- V1 不需要单独的数据库容器
- SQLite 数据文件通过宿主机目录挂载持久化
- SQLite 数据文件建议保存在独立数据目录中，避免与代码目录混放
- 开发阶段可以直接在这台 Ubuntu 设备上持续运行应用服务

## 访问路径

推荐路径：

```text
Phone / Other Laptop
  -> Tailscale network
  -> Tailscale Serve or direct tailnet access
  -> Ubuntu laptop
  -> app service
  -> SQLite file
```

## 推荐运维动作

- 定期备份 SQLite 文件
- 定期备份环境变量和部署配置
- 保持宿主机自动启动应用服务
- 为 Tailscale 设备访问设置最小必要范围
- 将 SQLite 数据文件放在例如 `/home/<user>/.local/share/my-pag/` 这类独立目录中

## 当前不推荐做法

- 将 SQLite 文件放在仓库目录中
- 将数据库端口直接暴露到公网
- 依赖临时不稳定的公网隧道方案作为长期主方案
