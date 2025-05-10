# Swagger测试用例生成器

基于Vue 3.4.0和Element Plus构建的Swagger测试用例生成工具，支持解析Swagger文档并自动生成测试用例。

## 功能特点

- 支持上传并解析Swagger 2.0/3.0文档（JSON/YAML格式）
- 自动提取API路径、方法、参数和响应结构
- 基于API定义自动生成测试用例，包括：
  - 正常数据场景
  - 必填参数缺失场景
  - 数据类型错误场景
  - 边界值测试场景
- **新增: 集成DeepSeek AI，智能生成更全面的测试用例**
- **新增: 测试用例历史记录功能，支持持久化到MySQL数据库**
- 支持自定义测试用例模板
- 支持将测试用例导出为JSON或数组格式
- 支持模拟执行测试并展示结果
- 美观的淡蓝色UI界面

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

1. 复制 `.env.example` 文件并重命名为 `.env`
2. 配置必要的环境变量：

```
# DeepSeek AI API配置 (AI生成功能需要)
VITE_DEEPSEEK_API_KEY=your_api_key

# MySQL数据库连接配置 (历史记录功能需要)
VITE_MYSQL_HOST=localhost
VITE_MYSQL_PORT=3306
VITE_MYSQL_USER=root
VITE_MYSQL_PASSWORD=your_password
VITE_MYSQL_DATABASE=aitest
```

### 初始化数据库

执行以下命令初始化MySQL数据库：

```bash
# 方法1：使用初始化脚本
node init.js

# 方法2：手动导入SQL脚本
mysql -u root -p < db_init.sql
```

### 开发模式运行

```bash
# 仅运行前端
npm run dev

# 仅运行后端服务
npm run server

# 同时运行前端和后端服务
npm run dev:full
```

### 构建项目

```bash
npm run build
```

## 使用指南

1. 上传Swagger文档（支持JSON/YAML格式）
2. 浏览并筛选API路径列表
3. 选择需要测试的API路径
4. 点击"生成测试用例"按钮，选择生成方式：
   - **常规生成**: 使用内置规则生成标准测试用例
   - **AI生成**: 使用DeepSeek AI生成更全面、智能的测试用例（需配置API密钥）
5. 查看生成的测试用例
6. 可选：执行测试、导出测试用例或保存到历史记录
7. 可通过"查看历史记录"按钮查看和管理之前保存的测试用例

## 项目结构

```
├── public/         # 静态资源
├── server/         # 后端服务
│   ├── config/     # 配置文件
│   ├── models/     # 数据模型
│   ├── routes/     # API路由
│   └── server.js   # 服务入口
├── src/
│   ├── assets/     # 静态资源
│   ├── components/ # Vue组件
│   │   ├── FileUploader.vue        # 文件上传组件
│   │   ├── ApiPathsList.vue        # API路径列表组件
│   │   ├── TestCaseGenerator.vue   # 测试用例生成组件
│   │   └── HistoryRecords.vue      # 历史记录组件
│   ├── services/   # 服务
│   │   └── historyService.js       # 历史记录服务
│   ├── utils/      # 工具函数
│   │   ├── swaggerParser.js        # Swagger解析工具
│   │   ├── deepseekAPI.js          # DeepSeek API调用工具
│   │   └── polyfills.js            # 兼容性处理
│   ├── App.vue     # 应用主组件
│   └── main.js     # 入口文件
├── db_init.sql     # 数据库初始化脚本
├── init.js         # 项目初始化脚本
└── vite.config.js  # Vite配置
```

## 技术栈

- 前端：Vue 3.4.0, Element Plus
- 后端：Express, MySQL
- 工具库：Swagger Parser, js-yaml, axios
- AI集成：DeepSeek AI API

## 历史记录功能

历史记录功能允许您保存和管理生成的测试用例，主要特点包括：

- 将测试用例持久化到MySQL数据库
- 按API路径和HTTP方法筛选历史记录
- 查看历史记录详情
- 导入历史记录中的测试用例
- 删除单个或所有历史记录

## 注意事项

- 历史记录功能需要配置MySQL数据库和启动后端服务
- AI生成功能需要配置DeepSeek API密钥
- 测试执行功能目前为模拟实现，实际测试需要配置后端环境 