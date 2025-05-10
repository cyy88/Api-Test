const { pool } = require('../config/db');

/**
 * 测试用例历史记录模型
 */
class HistoryModel {
  /**
   * 保存测试用例历史记录
   * @param {Object} historyData 历史记录数据
   * @returns {Promise<Object>} 保存结果
   */
  async saveHistory(historyData) {
    try {
      const { api_id, path, method, summary, test_cases, generation_method } = historyData;
      
      // 将测试用例数据转换为JSON字符串
      const testCasesJson = typeof test_cases === 'string' 
        ? test_cases 
        : JSON.stringify(test_cases);
      
      // 插入历史记录
      const [result] = await pool.query(
        'INSERT INTO test_case_history (api_id, path, method, summary, test_cases, generation_method) VALUES (?, ?, ?, ?, ?, ?)',
        [api_id, path, method, summary, testCasesJson, generation_method || 'standard']
      );
      
      return {
        id: result.insertId,
        message: '保存测试用例历史记录成功'
      };
    } catch (error) {
      console.error('保存历史记录错误:', error);
      throw new Error('保存历史记录失败: ' + error.message);
    }
  }

  /**
   * 获取所有历史记录
   * @param {Object} filters 过滤条件
   * @returns {Promise<Array>} 历史记录列表
   */
  async getAllHistory(filters = {}) {
    try {
      let query = `
        SELECT h.id, h.path, h.method, h.summary, h.generation_method, h.created_at,
               a.api_name, a.swagger_file_name
        FROM test_case_history h
        LEFT JOIN api_data a ON h.api_id = a.id
      `;
      
      const queryParams = [];
      const conditions = [];
      
      // 添加过滤条件
      if (filters.api_id) {
        conditions.push('h.api_id = ?');
        queryParams.push(filters.api_id);
      }
      
      if (filters.path) {
        conditions.push('h.path LIKE ?');
        queryParams.push(`%${filters.path}%`);
      }
      
      if (filters.method) {
        conditions.push('h.method = ?');
        queryParams.push(filters.method);
      }
      
      if (filters.start_date && filters.end_date) {
        conditions.push('h.created_at BETWEEN ? AND ?');
        queryParams.push(filters.start_date, filters.end_date);
      } else if (filters.start_date) {
        conditions.push('h.created_at >= ?');
        queryParams.push(filters.start_date);
      } else if (filters.end_date) {
        conditions.push('h.created_at <= ?');
        queryParams.push(filters.end_date);
      }
      
      // 添加WHERE子句
      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }
      
      // 添加排序
      query += ' ORDER BY h.created_at DESC';
      
      const [rows] = await pool.query(query, queryParams);
      return rows;
    } catch (error) {
      console.error('获取历史记录列表错误:', error);
      throw new Error('获取历史记录列表失败: ' + error.message);
    }
  }

  /**
   * 根据ID获取历史记录
   * @param {number} id 历史记录ID
   * @returns {Promise<Object>} 历史记录
   */
  async getHistoryById(id) {
    try {
      const [rows] = await pool.query(
        `SELECT h.*, a.api_name, a.swagger_file_name
         FROM test_case_history h
         LEFT JOIN api_data a ON h.api_id = a.id
         WHERE h.id = ?`,
        [id]
      );
      
      if (rows.length === 0) {
        throw new Error('找不到指定的历史记录');
      }
      
      // 解析测试用例数据
      const history = rows[0];
      try {
        history.test_cases = JSON.parse(history.test_cases);
      } catch (e) {
        console.warn('解析测试用例JSON数据失败:', e);
      }
      
      return history;
    } catch (error) {
      console.error(`获取历史记录(ID: ${id})错误:`, error);
      throw new Error('获取历史记录失败: ' + error.message);
    }
  }

  /**
   * 删除历史记录
   * @param {number} id 历史记录ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteHistory(id) {
    try {
      const [result] = await pool.query(
        'DELETE FROM test_case_history WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('找不到要删除的历史记录');
      }
      
      return {
        deleted: true,
        message: '历史记录删除成功'
      };
    } catch (error) {
      console.error(`删除历史记录(ID: ${id})错误:`, error);
      throw new Error('删除历史记录失败: ' + error.message);
    }
  }

  /**
   * 删除所有历史记录
   * @returns {Promise<Object>} 删除结果
   */
  async deleteAllHistory() {
    try {
      const [result] = await pool.query('DELETE FROM test_case_history');
      
      return {
        deleted: true,
        count: result.affectedRows,
        message: `成功删除${result.affectedRows}条历史记录`
      };
    } catch (error) {
      console.error('删除所有历史记录错误:', error);
      throw new Error('删除所有历史记录失败: ' + error.message);
    }
  }
}

module.exports = new HistoryModel(); 