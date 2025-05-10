// 数据库配置信息
module.exports = {
  host: process.env.VITE_MYSQL_HOST || '49.233.204.133',
  port: process.env.VITE_MYSQL_PORT || 3306,
  user: process.env.VITE_MYSQL_USER || 'root',
  password: process.env.VITE_MYSQL_PASSWORD || 'cyy3344274520',
  database: process.env.VITE_MYSQL_DATABASE || 'aitest',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}; 