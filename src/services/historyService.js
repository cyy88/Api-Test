const HISTORY_KEY = 'testcase_history';
const API_DATA_KEY = 'api_data';

/**
 * 历史记录服务
 */
const historyService = {
  /**
   * 获取所有测试用例历史记录
   * @returns {Promise<Array>} 历史记录列表
   */
  async getAllHistory() {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return data;
  },

  /**
   * 根据ID获取历史记录详情
   * @param {number} id 历史记录ID
   * @returns {Promise<Object>} 历史记录详情
   */
  async getHistoryById(id) {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const history = data.find(item => item.id === id);
    
    if (!history) {
      throw new Error(`找不到ID为 ${id} 的历史记录`);
    }
    
    // 确保返回前处理测试用例字段
    if (typeof history.test_cases === 'string') {
      try {
        // 尝试解析测试用例字符串为对象，但仍然保持字符串形式返回
        // 这样可以确保在其他地方使用时能够正确处理
        JSON.parse(history.test_cases);
      } catch (e) {
        console.error(`解析历史记录 ${id} 的测试用例失败:`, e);
        history.test_cases = '[]';
      }
    } else if (!history.test_cases) {
      history.test_cases = '[]';
    } else if (typeof history.test_cases === 'object') {
      try {
        history.test_cases = JSON.stringify(history.test_cases);
      } catch (e) {
        console.error(`序列化历史记录 ${id} 的测试用例失败:`, e);
        history.test_cases = '[]';
      }
    }
    
    return history;
  },

  /**
   * 保存测试用例到历史记录
   * @param {Object} historyData 历史记录数据
   * @returns {Promise<Object>} 保存结果
   */
  async saveHistory(historyData) {
    const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    
    // 确保测试用例数据为字符串格式
    if (historyData.test_cases) {
      if (typeof historyData.test_cases !== 'string') {
        try {
          historyData.test_cases = JSON.stringify(historyData.test_cases);
        } catch (e) {
          console.error('序列化测试用例数据失败:', e);
          // 如果无法序列化，使用空数组
          historyData.test_cases = JSON.stringify([]);
        }
      }
    } else {
      historyData.test_cases = JSON.stringify([]);
    }
    
    // 如果有id则更新，否则新增
    if (historyData.id) {
      const idx = data.findIndex(item => item.id === historyData.id);
      if (idx !== -1) {
        data[idx] = historyData;
      } else {
        data.push(historyData);
      }
    } else {
      historyData.id = Date.now();
      historyData.created_at = new Date().toISOString();
      data.push(historyData);
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    return historyData;
  },

  /**
   * 删除历史记录
   * @param {number} id 历史记录ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteHistory(id) {
    let data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    data = data.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(data));
    return { success: true };
  },

  /**
   * 删除所有历史记录
   * @returns {Promise<Object>} 删除结果
   */
  async deleteAllHistory() {
    localStorage.removeItem(HISTORY_KEY);
    return { success: true };
  },

  /**
   * 保存API数据
   * @param {Object} apiData API数据
   * @returns {Promise<Object>} 保存结果
   */
  async saveApiData(apiData) {
    localStorage.setItem(API_DATA_KEY, JSON.stringify(apiData));
    return { success: true };
  },

  /**
   * 获取所有API数据
   * @returns {Promise<Array>} API数据列表
   */
  async getAllApiData() {
    return JSON.parse(localStorage.getItem(API_DATA_KEY) || '[]');
  }
};

export default historyService; 