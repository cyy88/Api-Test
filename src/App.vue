<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">Swagger测试用例生成器</h1>
      <h2 class="app-subtitle">自动解析Swagger文档并生成测试用例</h2>
    </header>

    <div class="page-container">
      <div class="card">
        <div class="card-header">Swagger文档上传</div>
        <div class="card-body">
          <file-uploader @parsed="handleParsed" />
        </div>
      </div>

      <div class="main-content" v-if="api">
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
</template>

<script setup>
import { ref } from 'vue';
import FileUploader from './components/FileUploader.vue';
import ApiPathsList from './components/ApiPathsList.vue';
import TestCaseGenerator from './components/TestCaseGenerator.vue';

const api = ref(null);
const selectedPath = ref(null);

// 处理Swagger文档解析完成
const handleParsed = (parsedApi) => {
  api.value = parsedApi;
  selectedPath.value = null;
};

// 处理选择API路径
const handleSelectPath = (path) => {
  selectedPath.value = path;
};
</script>

<style scoped>
.main-content {
  margin-top: 20px;
}

.card {
  margin-bottom: 20px;
}
</style> 