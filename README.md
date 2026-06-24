# 面试信息共享池

一个用于团队协作的面试信息管理系统，支持多人共享面试经验、记录面试过程。

## 功能特性

### 共享池页面
- 📊 **面试信息汇总**：展示所有成员的面试记录
- 🔍 **搜索功能**：按公司名称快速搜索
- 📈 **统计信息**：显示总记录数、公司数量、参与者数量
- ⏰ **时间排序**：按面试时间倒序展示
- 📄 **分页显示**：支持分页浏览，每页可选 5/10/20 条

### 个人记录页面
- ✏️ **记录管理**：新增、编辑、删除面试记录
- 📊 **数据统计**：待面试、推进中、Offer 数量统计
- 🔍 **搜索功能**：按公司名称搜索
- 💾 **数据保存**：本地保存面试记录
- 🎨 **列宽调整**：支持拖拽调整列宽

### 面试记录字段
- 公司名称
- 面试时间
- 面试方式（线上/线下/线上+线下）
- 面试阶段（1面/2面/3面/HR面/谈薪/Offer）
- 面试反馈（待面试/推进中/无反馈/主动取消/不匹配/背调中/待入职/已入职）
- 薪资范围
- 岗位名称
- 公司位置
- 面经

## 技术栈

- **前端**：原生 HTML/CSS/JavaScript（ES Module）
- **后端**：Node.js HTTP Server
- **数据存储**：JSON 文件
- **样式**：CSS3

## 快速开始

### 环境要求

- Node.js 18+

### 启动项目

```bash
# 启动服务器
bash scripts/start.sh

# 访问应用
# 共享池页面：http://localhost:3000/pool.html
# 个人记录页面：http://localhost:3000/index.html?userId=xxx
```

### 停止项目

```bash
bash scripts/stop.sh
```

### 运行测试

```bash
bash scripts/test.sh
```

## 项目结构

```
interview-web/
├── index.html          # 个人记录页面
├── pool.html           # 共享池页面
├── app.js              # 个人记录页面逻辑
├── pool.js             # 共享池页面逻辑
├── styles.css          # 个人记录页面样式
├── pool.css            # 共享池页面样式
├── server.js           # Node.js 服务器
├── lib/
│   ├── auth.js         # 用户认证模块
│   ├── constants.js    # 常量定义
│   ├── data.js         # 数据读写模块
│   ├── normalize.js    # 数据标准化模块
│   └── pool.js         # 共享池数据同步模块
├── scripts/
│   ├── start.sh        # 启动脚本
│   ├── stop.sh         # 停止脚本
│   └── test.sh         # 测试脚本
├── tests/
│   ├── app-dom.test.js # 前端 DOM 测试
│   ├── app-utils.test.js # 工具函数测试
│   └── server.test.js  # 服务器测试
└── data/               # 数据目录（已忽略）
    ├── config.json     # 用户配置
    ├── interviews.json # 面试记录
    ├── public-pool.json # 共享池数据
    └── users/          # 用户数据目录
```

## API 接口

### 认证接口

- `POST /api/auth/verify` - 密码验证

### 用户管理

- `POST /api/users` - 新增用户

### 数据接口

- `GET /api/interviews` - 获取面试记录
- `POST /api/interviews` - 保存面试记录
- `GET /api/my/interviews?userId=xxx` - 获取个人面试记录
- `POST /api/my/interviews` - 保存个人面试记录
- `GET /api/public/pool` - 获取共享池数据

## 开发说明

### 添加新功能

1. 在 `lib/` 目录下创建新模块
2. 在 `server.js` 中添加 API 接口
3. 在前端页面中调用接口
4. 编写测试用例

### 代码规范

- 使用 ES Module 语法
- 每个文件不超过 300 行
- 遵循 DRY 原则
- 编写单元测试

## 测试

项目包含完整的测试套件：

```bash
# 运行所有测试
bash scripts/test.sh

# 测试覆盖
- 前端 DOM 操作测试
- 工具函数测试
- 服务器 API 测试
```

## 许可证

MIT License
