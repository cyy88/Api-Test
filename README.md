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
- 支持将测试用例导出为JSON或数组格式
- 支持模拟执行测试并展示结果
- 美观的淡蓝色UI界面

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式运行

```bash
npm run dev
```

### 构建项目

```bash
npm run build
```

## 使用指南

1. 上传Swagger文档（支持JSON/YAML格式）
2. 浏览并筛选API路径列表
3. 选择需要测试的API路径
4. 点击"生成测试用例"按钮
5. 查看生成的测试用例
6. 可选：执行测试或导出测试用例

## 项目结构

```
src/
├── assets/         # 静态资源
├── components/     # Vue组件
│   ├── FileUploader.vue        # 文件上传组件
│   ├── ApiPathsList.vue        # API路径列表组件
│   └── TestCaseGenerator.vue   # 测试用例生成组件
├── utils/          # 工具函数
│   └── swaggerParser.js        # Swagger解析工具
├── App.vue         # 应用主组件
└── main.js         # 入口文件
```

## 技术栈

- Vue 3.4.0
- Element Plus
- Swagger Parser
- js-yaml
- axios

## 注意事项

- 本项目为纯前端项目，可以单独部署运行
- 测试执行功能目前为模拟实现，实际测试需要配置后端环境 