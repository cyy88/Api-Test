const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { testConnection } = require('./config/db');
const apiRoutes = require('./routes/apiRoutes');
const historyRoutes = require('./routes/historyRoutes');

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' })); // 增加请求体大小限制，因为Swagger文件可能较大
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '../dist')));

// API路由
app.use('/api/history', historyRoutes);
app.use('/api/api-data', apiRoutes);

// 所有其他GET请求返回Vue应用
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
async function startServer() {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('无法连接到数据库，服务器将不会启动');
      process.exit(1);
    }
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器时出错:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer(); 