<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">Swagger测试用例生成器</h1>
      <h2 class="app-subtitle">自动解析Swagger文档并生成测试用例</h2>
    </header>

    <div class="page-container">
      <div class="card upload-card" v-if="!api">
        <div class="card-header">Swagger文档上传</div>
        <div class="card-body">
          <file-uploader @parsed="handleParsed" />
        </div>
      </div>

      <div v-else>
        <div class="header-actions">
          <el-button type="danger" @click="confirmClearApiData">删除文档</el-button>
        </div>

        <div class="main-content">
          <!-- API路径列表部分 -->
          <div class="card api-card">
            <div class="card-header">
              <span>API路径列表</span>
              <el-tag v-if="apiTotalCount > 0" type="info" size="small" class="api-count">
                共 {{ apiTotalCount }} 个接口
              </el-tag>
            </div>
            <div class="card-body">
              <api-paths-list 
                :api="api" 
                @select-path="handleSelectPath"
                v-loading="apiListLoading"
                element-loading-text="正在加载API列表..."
              />
            </div>
          </div>
          
          <!-- 测试用例生成部分 -->
          <div class="card testcase-card" v-if="selectedPath">
            <div class="card-header">
              <span>测试用例生成</span>
              <el-tag v-if="testCaseCount > 0" type="success" size="small" class="test-count">
                共 {{ testCaseCount }} 个测试用例
              </el-tag>
            </div>
            <div class="card-body">
              <test-case-generator 
                :api="api" 
                :selected-path="selectedPath"
                v-loading="testCaseLoading"
                element-loading-text="正在生成测试用例..."
                @test-cases-generated="handleTestCasesGenerated"
                @error="handleTestCaseError"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 全局错误提示 -->
    <el-dialog
      v-model="errorDialogVisible"
      title="出错了"
      width="50%"
      :close-on-click-modal="false"
    >
      <div class="error-content">
        <p>{{ errorMessage }}</p>
        <pre v-if="errorDetails" class="error-details">{{ errorDetails }}</pre>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="errorDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="handleClearError">
            清除并刷新
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import FileUploader from './components/FileUploader.vue';
import ApiPathsList from './components/ApiPathsList.vue';
import TestCaseGenerator from './components/TestCaseGenerator.vue';

const api = ref(null);
const selectedPath = ref(null);
const apiListLoading = ref(false);
const testCaseLoading = ref(false);
const apiTotalCount = ref(0);
const testCaseCount = ref(0);
const errorDialogVisible = ref(false);
const errorMessage = ref('');
const errorDetails = ref('');

// 从本地存储加载数据
onMounted(() => {
  try {
    const savedApi = localStorage.getItem('swagger-api');
    const savedPath = localStorage.getItem('selected-path');
    
    if (savedApi) {
      apiListLoading.value = true;
      setTimeout(() => {
        try {
          api.value = JSON.parse(savedApi);
          countApiPaths();
          if (savedPath) {
            selectedPath.value = JSON.parse(savedPath);
          }
          apiListLoading.value = false;
        } catch (error) {
          apiListLoading.value = false;
          showError('加载API数据时出错', error);
          // 加载失败时清除本地存储
          clearApiData();
        }
      }, 300); // 短暂延迟，以便显示加载状态
    }
  } catch (error) {
    showError('从本地存储加载数据失败', error);
    // 加载失败时清除本地存储
    clearApiData();
  }
});

// 监听数据变化，保存到本地存储
watch(api, (newValue) => {
  if (newValue) {
    try {
      localStorage.setItem('swagger-api', JSON.stringify(newValue));
    } catch (error) {
      showError('保存API数据到本地存储时出错', error);
    }
  } else {
    localStorage.removeItem('swagger-api');
  }
}, { deep: true });

watch(selectedPath, (newValue) => {
  if (newValue) {
    try {
      localStorage.setItem('selected-path', JSON.stringify(newValue));
    } catch (error) {
      showError('保存选中路径到本地存储时出错', error);
    }
  } else {
    localStorage.removeItem('selected-path');
  }
});

// 处理Swagger文档解析完成
const handleParsed = (parsedApi) => {
  try {
    api.value = parsedApi;
    selectedPath.value = null;
    testCaseCount.value = 0;
    
    if (parsedApi) {
      countApiPaths();
    }
  } catch (error) {
    showError('处理解析的API数据时出错', error);
  }
};

// 统计API路径数量
const countApiPaths = () => {
  if (!api.value || !api.value.paths) {
    apiTotalCount.value = 0;
    return;
  }
  
  let count = 0;
  for (const path in api.value.paths) {
    const pathItem = api.value.paths[path];
    if (pathItem) {
      for (const method in pathItem) {
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
          count++;
        }
      }
    }
  }
  apiTotalCount.value = count;
};

// 处理选择API路径
const handleSelectPath = (path) => {
  selectedPath.value = path;
  testCaseLoading.value = true;
  // 在下一次DOM更新后设置testCaseLoading为false，以便显示加载过渡
  setTimeout(() => {
    testCaseLoading.value = false;
  }, 300);
};

// 处理测试用例生成完成
const handleTestCasesGenerated = (count) => {
  testCaseCount.value = count;
};

// 处理测试用例生成错误
const handleTestCaseError = (error) => {
  showError('生成测试用例时出错', error);
  testCaseCount.value = 0;
};

// 确认清除API数据
const confirmClearApiData = () => {
  ElMessageBox.confirm(
    '确定要删除当前文档吗？这将清除所有已加载的API数据和测试用例。',
    '确认删除',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  ).then(() => {
    clearApiData();
    ElMessage.success('已删除文档，返回上传界面');
  }).catch(() => {
    // 用户取消操作
  });
};

// 清除API数据，恢复到初始状态
const clearApiData = () => {
  api.value = null;
  selectedPath.value = null;
  apiTotalCount.value = 0;
  testCaseCount.value = 0;
  localStorage.removeItem('swagger-api');
  localStorage.removeItem('selected-path');
};

// 显示错误
const showError = (message, error) => {
  errorMessage.value = message;
  errorDetails.value = error ? (error.stack || error.message || String(error)) : '';
  errorDialogVisible.value = true;
  console.error(message, error);
};

// 处理清除错误
const handleClearError = () => {
  errorDialogVisible.value = false;
  errorMessage.value = '';
  errorDetails.value = '';
  
  // 如果API加载出错，清除数据
  if (!api.value || !api.value.paths) {
    clearApiData();
  }
  
  // 如果是测试用例生成出错，清除选中路径
  if (api.value && !selectedPath.value) {
    selectedPath.value = null;
  }
};
</script>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.page-container {
  flex: 1;
  overflow: hidden;
  padding: 20px;
}

.main-content {
  height: calc(100vh - 150px);
  display: flex;
  flex-direction: column;
}

.card {
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  border-radius: 4px;
  display: flex;
  flex-direction: column;
}

.api-card {
  flex: 1;
  margin-bottom: 20px;
  min-height: 400px;
}

.testcase-card {
  flex: 1;
  min-height: 300px;
}

.card-header {
  padding: 12px 20px;
  border-bottom: 1px solid #e4e7ed;
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-body {
  padding: 20px;
  flex: 1;
  overflow: hidden;
  position: relative;
}

.upload-card {
  max-width: 800px;
  margin: 0 auto;
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 10px;
}

.api-count, .test-count {
  margin-left: 10px;
}

.error-content {
  max-height: 400px;
  overflow: auto;
}

.error-details {
  background-color: #f8f8f8;
  padding: 15px;
  border-radius: 4px;
  font-family: monospace;
  white-space: pre-wrap;
  color: #e74c3c;
}
</style> 