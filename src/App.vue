<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">Swagger测试用例生成器</h1>
      <h2 class="app-subtitle">自动解析Swagger文档并生成测试用例</h2>
    </header>

    <div class="page-container">
      <div class="card" v-if="!api">
        <div class="card-header">Swagger文档上传</div>
        <div class="card-body">
          <file-uploader @parsed="handleParsed" />
        </div>
      </div>

      <div v-else>
        <div class="header-actions">
          <el-button type="danger" @click="clearApiData">删除文档</el-button>
        </div>

        <div class="main-content">
          <!-- API路径列表部分 - 上部分，宽度100% -->
          <div class="card">
            <div class="card-header">API路径列表</div>
            <div class="card-body">
              <api-paths-list 
                :api="api" 
                @select-path="handleSelectPath" 
              />
            </div>
          </div>
          
          <!-- 测试用例生成部分 - 下部分，宽度100% -->
          <div class="card">
            <div class="card-header">测试用例生成</div>
            <div class="card-body">
              <test-case-generator 
                :api="api" 
                :selected-path="selectedPath" 
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import FileUploader from './components/FileUploader.vue';
import ApiPathsList from './components/ApiPathsList.vue';
import TestCaseGenerator from './components/TestCaseGenerator.vue';

const api = ref(null);
const selectedPath = ref(null);

// 从本地存储加载数据
onMounted(() => {
  try {
    const savedApi = localStorage.getItem('swagger-api');
    const savedPath = localStorage.getItem('selected-path');
    
    if (savedApi) {
      api.value = JSON.parse(savedApi);
      if (savedPath) {
        selectedPath.value = JSON.parse(savedPath);
      }
    }
  } catch (error) {
    console.error('从本地存储加载数据失败:', error);
    // 加载失败时清除本地存储
    localStorage.removeItem('swagger-api');
    localStorage.removeItem('selected-path');
  }
});

// 监听数据变化，保存到本地存储
watch(api, (newValue) => {
  if (newValue) {
    localStorage.setItem('swagger-api', JSON.stringify(newValue));
  } else {
    localStorage.removeItem('swagger-api');
  }
}, { deep: true });

watch(selectedPath, (newValue) => {
  if (newValue) {
    localStorage.setItem('selected-path', JSON.stringify(newValue));
  } else {
    localStorage.removeItem('selected-path');
  }
});

// 处理Swagger文档解析完成
const handleParsed = (parsedApi) => {
  api.value = parsedApi;
  selectedPath.value = null;
};

// 处理选择API路径
const handleSelectPath = (path) => {
  selectedPath.value = path;
};

// 清除API数据，恢复到初始状态
const clearApiData = () => {
  api.value = null;
  selectedPath.value = null;
  localStorage.removeItem('swagger-api');
  localStorage.removeItem('selected-path');
};
</script>

<style scoped>
.main-content {
  margin-top: 20px;
}

.card {
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}
</style> 