const express = require('express');
const router = express.Router();
const historyModel = require('../models/historyModel');

// 获取所有历史记录，支持过滤
router.get('/', async (req, res) => {
  try {
    // 从查询参数中提取过滤条件
    const filters = {
      api_id: req.query.api_id,
      path: req.query.path,
      method: req.query.method,
      start_date: req.query.start_date,
      end_date: req.query.end_date
    };
    
    // 过滤掉未定义的条件
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) {
        delete filters[key];
      }
    });
    
    const historyList = await historyModel.getAllHistory(filters);
    res.json({
      success: true,
      data: historyList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取特定ID的历史记录
router.get('/:id', async (req, res) => {
  try {
    const history = await historyModel.getHistoryById(req.params.id);
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    if (error.message.includes('找不到')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
});

// 保存历史记录
router.post('/', async (req, res) => {
  try {
    const result = await historyModel.saveHistory(req.body);
    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 删除特定历史记录
router.delete('/:id', async (req, res) => {
  try {
    const result = await historyModel.deleteHistory(req.params.id);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    if (error.message.includes('找不到')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
});

// 删除所有历史记录
router.delete('/', async (req, res) => {
  try {
    const result = await historyModel.deleteAllHistory();
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router; 