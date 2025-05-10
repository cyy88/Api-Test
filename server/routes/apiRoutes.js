const express = require('express');
const router = express.Router();
const apiModel = require('../models/apiModel');

// 获取所有API数据
router.get('/', async (req, res) => {
  try {
    const apiList = await apiModel.getAllApiData();
    res.json({
      success: true,
      data: apiList
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取特定ID的API数据
router.get('/:id', async (req, res) => {
  try {
    const apiData = await apiModel.getApiDataById(req.params.id);
    res.json({
      success: true,
      data: apiData
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

// 保存API数据
router.post('/', async (req, res) => {
  try {
    const result = await apiModel.saveApiData(req.body);
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

// 删除API数据
router.delete('/:id', async (req, res) => {
  try {
    const result = await apiModel.deleteApiData(req.params.id);
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

module.exports = router; 