/**
 * 项目初始化脚本
 * 用于初始化数据库和服务
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const { execSync } = require('child_process');
const readline = require('readline');
const dbConfig = require('./server/config/dbConfig');

// 创建readline接口用于交互
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// 加载环境变量
dotenv.config();

/**
 * 初始化数据库
 */
async function initDatabase() {
  console.log('正在初始化数据库...');
  
  try {
    // 创建不包含数据库名的连接
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password
    });
    
    // 加载SQL脚本
    const sqlScript = fs.readFileSync(path.join(__dirname, 'db_init.sql'), 'utf8');
    const statements = sqlScript.split(';').filter(statement => statement.trim());
    
    // 执行SQL脚本
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.query(statement);
      }
    }
    
    console.log('数据库初始化成功！');
    await connection.end();
    
    return true;
  } catch (error) {
    console.error('数据库初始化失败:', error.message);
    return false;
  }
}

/**
 * 安装依赖
 */
function installDependencies() {
  console.log('正在安装依赖...');
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('依赖安装成功！');
    return true;
  } catch (error) {
    console.error('依赖安装失败:', error.message);
    return false;
  }
}

/**
 * 创建.env文件
 */
function createEnvFile() {
  console.log('正在检查.env文件...');
  
  const envPath = path.join(__dirname, '.env');
  
  // 如果.env文件已存在，则跳过
  if (fs.existsSync(envPath)) {
    console.log('.env文件已存在，跳过创建。');
    return true;
  }
  
  // 创建.env文件
  const envContent = `# 应用配置
VITE_APP_TITLE=Swagger测试用例生成器

# DeepSeek AI API配置
VITE_DEEPSEEK_API_KEY=

# MySQL数据库连接配置
VITE_MYSQL_HOST=${dbConfig.host}
VITE_MYSQL_PORT=${dbConfig.port}
VITE_MYSQL_USER=${dbConfig.user}
VITE_MYSQL_PASSWORD=${dbConfig.password}
VITE_MYSQL_DATABASE=${dbConfig.database}

# 服务器配置
PORT=3000
NODE_ENV=development
`;
  
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('.env文件创建成功！');
    return true;
  } catch (error) {
    console.error('.env文件创建失败:', error.message);
    return false;
  }
}

/**
 * 启动服务
 */
function startServices() {
  console.log('正在启动服务...');
  try {
    execSync('npm run dev:full', { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error('服务启动失败:', error.message);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('=== Swagger测试用例生成器初始化脚本 ===');
  
  rl.question('是否继续初始化? (y/n) ', async (answer) => {
    if (answer.toLowerCase() !== 'y') {
      console.log('初始化已取消。');
      rl.close();
      return;
    }
    
    // 1. 创建.env文件
    if (!createEnvFile()) {
      rl.close();
      return;
    }
    
    // 2. 安装依赖
    if (!installDependencies()) {
      rl.close();
      return;
    }
    
    // 3. 初始化数据库
    rl.question('是否初始化数据库? (y/n) ', async (dbAnswer) => {
      if (dbAnswer.toLowerCase() === 'y') {
        const dbSuccess = await initDatabase();
        if (!dbSuccess) {
          console.log('数据库初始化失败，请检查数据库配置和连接。');
        }
      } else {
        console.log('跳过数据库初始化。');
      }
      
      // 4. 启动服务
      rl.question('是否立即启动服务? (y/n) ', (startAnswer) => {
        if (startAnswer.toLowerCase() === 'y') {
          startServices();
        } else {
          console.log('初始化完成！您可以使用以下命令手动启动服务：');
          console.log('- 启动前端开发服务器: npm run dev');
          console.log('- 启动后端服务器: npm run server');
          console.log('- 同时启动前后端: npm run dev:full');
        }
        
        rl.close();
      });
    });
  });
}

// 启动主函数
main(); 