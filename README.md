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
- 支持自定义测试用例模板
- 支持将测试用例导出为JSON或数组格式
- 支持模拟执行测试并展示结果
- 美观的淡蓝色UI界面

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置DeepSeek API (可选)

如需使用AI生成测试用例功能，请按以下步骤配置DeepSeek API:

1. 访问 [DeepSeek平台](https://platform.deepseek.com) 注册并获取API密钥
2. 复制 `.env.example` 文件并重命名为 `.env`
3. 将您的DeepSeek API密钥填入 `.env` 文件中的 `VITE_DEEPSEEK_API_KEY` 变量

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
4. 点击"生成测试用例"按钮，选择生成方式：
   - **常规生成**: 使用内置规则生成标准测试用例
   - **AI生成**: 使用DeepSeek AI生成更全面、智能的测试用例（需配置API密钥）
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
│   ├── swaggerParser.js        # Swagger解析工具
│   ├── deepseekAPI.js          # DeepSeek API调用工具
│   └── polyfills.js            # 兼容性处理
├── App.vue         # 应用主组件
└── main.js         # 入口文件
```

## 技术栈

- Vue 3.4.0
- Element Plus
- Swagger Parser
- js-yaml
- axios
- DeepSeek AI API

## 注意事项

- 本项目为纯前端项目，可以单独部署运行
- 测试执行功能目前为模拟实现，实际测试需要配置后端环境
- AI生成功能需要配置DeepSeek API密钥 