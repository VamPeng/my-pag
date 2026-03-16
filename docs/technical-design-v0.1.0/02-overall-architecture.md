# 02. 总体架构

## 推荐架构

V1 推荐采用以下形态：

- 前端：单页面 Web 应用
- 后端：单体 API 服务
- 数据库：运行在用户 Ubuntu 电脑上的本地数据库
- 远程访问：通过受控网络通道访问 Web 服务

## 架构图

```text
Client Browser
  -> Private Access Channel
  -> Web/API Service on Ubuntu Laptop
  -> Local Database on Ubuntu Laptop
```

## 架构说明

- 浏览器只访问应用服务，不直接访问数据库
- 所有事项读写都通过后端 API 完成
- 数据集中保存在一台设备上，因此 V1 不需要做多端冲突合并
- 远程设备的更新本质上是直接访问这台笔记本上的唯一数据源

## 不选方案

V1 不优先选择以下方案：

- 纯前端 + 浏览器本地存储
- 直接上云数据库
- 原生桌面应用优先
- 前后端完全独立并分别复杂部署
