const { pool } = require('../config/db');

/**
 * API数据模型
 */
class ApiModel {
  /**
   * 保存API数据
   * @param {Object} apiData API数据对象
   * @returns {Promise<Object>} 保存结果
   */
  async saveApiData(apiData) {
    try {
      const { api_name, swagger_file_name, swagger_data } = apiData;
      
      // 检查是否已存在相同文件名的API数据
      const [existingApis] = await pool.query(
        'SELECT * FROM api_data WHERE swagger_file_name = ?',
        [swagger_file_name]
      );
      
      let result;
      
      if (existingApis.length > 0) {
        // 更新现有记录
        [result] = await pool.query(
          'UPDATE api_data SET api_name = ?, swagger_data = ?, updated_at = CURRENT_TIMESTAMP WHERE swagger_file_name = ?',
          [api_name, swagger_data, swagger_file_name]
        );
        
        return {
          id: existingApis[0].id,
          updated: true,
          message: '更新API数据成功'
        };
      } else {
        // 创建新记录
        [result] = await pool.query(
          'INSERT INTO api_data (api_name, swagger_file_name, swagger_data) VALUES (?, ?, ?)',
          [api_name, swagger_file_name, swagger_data]
        );
        
        return {
          id: result.insertId,
          updated: false,
          message: '保存API数据成功'
        };
      }
    } catch (error) {
      console.error('保存API数据错误:', error);
      throw new Error('保存API数据失败: ' + error.message);
    }
  }

  /**
   * 获取所有API数据
   * @returns {Promise<Array>} API数据列表
   */
  async getAllApiData() {
    try {
      const [rows] = await pool.query(
        'SELECT id, api_name, swagger_file_name, created_at, updated_at FROM api_data ORDER BY updated_at DESC'
      );
      return rows;
    } catch (error) {
      console.error('获取API数据列表错误:', error);
      throw new Error('获取API数据列表失败: ' + error.message);
    }
  }

  /**
   * 根据ID获取API数据
   * @param {number} id API数据ID
   * @returns {Promise<Object>} API数据
   */
  async getApiDataById(id) {
    try {
      const [rows] = await pool.query(
        'SELECT * FROM api_data WHERE id = ?',
        [id]
      );
      
      if (rows.length === 0) {
        throw new Error('找不到指定的API数据');
      }
      
      return rows[0];
    } catch (error) {
      console.error(`获取API数据(ID: ${id})错误:`, error);
      throw new Error('获取API数据失败: ' + error.message);
    }
  }

  /**
   * 删除API数据
   * @param {number} id API数据ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteApiData(id) {
    try {
      // 首先删除关联的测试用例历史记录
      await pool.query(
        'UPDATE test_case_history SET api_id = NULL WHERE api_id = ?',
        [id]
      );
      
      // 然后删除API数据
      const [result] = await pool.query(
        'DELETE FROM api_data WHERE id = ?',
        [id]
      );
      
      if (result.affectedRows === 0) {
        throw new Error('找不到要删除的API数据');
      }
      
      return {
        deleted: true,
        message: 'API数据删除成功'
      };
    } catch (error) {
      console.error(`删除API数据(ID: ${id})错误:`, error);
      throw new Error('删除API数据失败: ' + error.message);
    }
  }
}

module.exports = new ApiModel(); 