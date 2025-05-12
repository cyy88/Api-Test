<template>
  <div class="history-records">
    <div class="history-header">
      <h3>测试用例历史记录</h3>
      <div class="history-actions">
        <el-button type="primary" @click="refreshHistory">刷新</el-button>
        <el-popconfirm
          title="确定要清空所有历史记录吗？此操作不可恢复。"
          @confirm="clearAllHistory"
        >
          <template #reference>
            <el-button type="danger">清空历史</el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>

    <div class="history-filters">
      <el-form :model="filters" label-width="80px" size="small" inline>
        <el-form-item label="API路径">
          <el-input v-model="filters.path" placeholder="输入关键字搜索" clearable @clear="applyFilters"></el-input>
        </el-form-item>
        <el-form-item label="HTTP方法">
          <el-select v-model="filters.method" placeholder="全部" clearable @clear="applyFilters">
            <el-option label="GET" value="get"></el-option>
            <el-option label="POST" value="post"></el-option>
            <el-option label="PUT" value="put"></el-option>
            <el-option label="DELETE" value="delete"></el-option>
            <el-option label="PATCH" value="patch"></el-option>
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="applyFilters">筛选</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table
      v-loading="loading"
      :data="historyList"
      style="width: 100%"
      border
      stripe
      :empty-text="loading ? '加载中...' : '暂无历史记录'"
    >
      <el-table-column prop="id" label="ID" width="80"></el-table-column>
      <el-table-column prop="api_name" label="API名称" width="150">
        <template #default="scope">
          <span>{{ scope.row.api_name || '未知API' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="method" label="方法" width="100">
        <template #default="scope">
          <el-tag :type="getMethodTagType(scope.row.method)">{{ scope.row.method.toUpperCase() }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="path" label="API路径" min-width="200"></el-table-column>
      <el-table-column prop="generation_method" label="生成方式" width="120">
        <template #default="scope">
          <el-tag type="info" v-if="scope.row.generation_method === 'standard'">常规生成</el-tag>
          <el-tag type="success" v-else-if="scope.row.generation_method === 'ai'">AI生成</el-tag>
          <span v-else>{{ scope.row.generation_method }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="180">
        <template #default="scope">
          {{ formatDate(scope.row.created_at) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180">
        <template #default="scope">
          <el-button 
            size="small" 
            type="primary" 
            @click="viewHistoryDetail(scope.row)"
          >
            查看
          </el-button>
          <el-button 
            size="small" 
            type="success" 
            @click="importTestCases(scope.row)"
          >
            导入
          </el-button>
          <el-popconfirm
            :title="`确定要删除ID为 ${scope.row.id} 的记录吗？`"
            @confirm="deleteHistory(scope.row.id)"
          >
            <template #reference>
              <el-button size="small" type="danger">删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <!-- 历史记录详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="历史记录详情"
      width="70%"
    >
      <div v-if="currentDetail">
        <div class="detail-header">
          <div>
            <el-tag :type="getMethodTagType(currentDetail.method)" size="large">
              {{ currentDetail.method.toUpperCase() }}
            </el-tag>
          </div>
          <div class="detail-path">
            <h3>{{ currentDetail.path }}</h3>
            <p>{{ currentDetail.summary }}</p>
          </div>
        </div>

        <el-divider />

        <div class="test-cases-list" v-if="currentDetail.test_cases && currentDetail.test_cases.length">
          <h4>测试用例列表 ({{ currentDetail.test_cases.length }}个)</h4>
          <el-table
            :data="formattedTestCases"
            border
            style="width: 100%"
          >
            <el-table-column prop="name" label="用例名称" min-width="150" />
            
            <el-table-column label="参数" min-width="200">
              <template #default="scope">
                <div v-if="scope.row.parameters && scope.row.parameters !== '{}'" class="formatted-json">
                  <pre>{{ formatJson(scope.row.parameters) }}</pre>
                </div>
                <span v-else>-</span>
              </template>
            </el-table-column>
            
            <el-table-column label="请求体" min-width="300">
              <template #default="scope">
                <div v-if="scope.row.body && scope.row.body !== '{}'" class="formatted-json">
                  <pre>{{ formatJson(scope.row.body) }}</pre>
                </div>
                <span v-else>-</span>
              </template>
            </el-table-column>
            
            <el-table-column prop="code" label="响应code值" width="120">
              <template #default="scope">
                <span>{{ scope.row.code || '-' }}</span>
              </template>
            </el-table-column>
            
            <el-table-column prop="expectedStatus" label="预期状态码" width="120" />
            
            <el-table-column label="补充说明" min-width="150">
              <template #default="scope">
                <span>{{ scope.row.description || '无补充说明' }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else class="no-test-cases">
          <el-empty description="没有测试用例数据" />
        </div>
      </div>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="detailDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="importTestCases(currentDetail)">
            导入这些测试用例
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import historyService from '../services/historyService';

const loading = ref(false);
const historyList = ref([]);
const detailDialogVisible = ref(false);
const currentDetail = ref(null);
const filters = ref({
  path: '',
  method: ''
});

const emit = defineEmits(['import-test-cases']);

// 格式化日期
const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// 根据HTTP方法获取标签类型
const getMethodTagType = (method) => {
  const methodMap = {
    get: 'success',
    post: 'primary',
    put: 'warning',
    delete: 'danger',
    patch: 'info'
  };
  return methodMap[method.toLowerCase()] || 'info';
};

// 获取历史记录列表
const fetchHistoryList = async () => {
  loading.value = true;
  try {
    historyList.value = await historyService.getAllHistory(filters.value);
  } catch (error) {
    ElMessage.error(error.message || '获取历史记录失败');
  } finally {
    loading.value = false;
  }
};

// 刷新历史记录
const refreshHistory = () => {
  fetchHistoryList();
};

// 应用筛选条件
const applyFilters = () => {
  fetchHistoryList();
};

// 重置筛选条件
const resetFilters = () => {
  filters.value = {
    path: '',
    method: ''
  };
  fetchHistoryList();
};

// 查看历史记录详情
const viewHistoryDetail = async (history) => {
  try {
    const detail = await historyService.getHistoryById(history.id);
    currentDetail.value = detail;
    detailDialogVisible.value = true;
  } catch (error) {
    ElMessage.error(error.message || '获取历史记录详情失败');
  }
};

// 格式化JSON数据
const formatJson = (jsonString) => {
  try {
    const obj = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return jsonString;
  }
};

// 处理格式化的测试用例
const formattedTestCases = computed(() => {
  if (!currentDetail.value) return [];
  
  // 处理 test_cases 可能是字符串的情况
  let testCases = currentDetail.value.test_cases;
  
  // 如果 test_cases 是字符串，尝试解析为 JSON
  if (typeof testCases === 'string') {
    try {
      testCases = JSON.parse(testCases);
    } catch (e) {
      console.error('解析测试用例JSON失败:', e);
      return [];
    }
  }
  
  // 如果 test_cases 不是数组，返回空数组
  if (!Array.isArray(testCases)) {
    console.error('测试用例数据不是数组:', testCases);
    return [];
  }
  
  return testCases.map(testCase => {
    return {
      ...testCase,
      parameters: typeof testCase.parameters === 'string' 
        ? testCase.parameters 
        : JSON.stringify(testCase.parameters || {}),
      body: typeof testCase.body === 'string' 
        ? testCase.body 
        : JSON.stringify(testCase.body || {})
    };
  });
});

// 导入测试用例
const importTestCases = async (history) => {
  try {
    if (!history) return;
    
    // 如果只有ID，需要先获取详情
    let detail = history;
    if (!history.test_cases) {
      detail = await historyService.getHistoryById(history.id);
    }
    
    // 处理测试用例数据可能是字符串的情况
    let testCases = detail.test_cases;
    if (typeof testCases === 'string') {
      try {
        testCases = JSON.parse(testCases);
      } catch (e) {
        console.error('解析测试用例JSON失败:', e);
        ElMessage.error('导入失败：测试用例数据格式错误');
        return;
      }
    }
    
    // 确保测试用例是数组
    if (!Array.isArray(testCases)) {
      console.error('测试用例数据不是数组:', testCases);
      ElMessage.error('导入失败：测试用例数据格式错误');
      return;
    }
    
    // 发出导入事件
    emit('import-test-cases', {
      path: detail.path,
      method: detail.method,
      summary: detail.summary,
      test_cases: testCases
    });
    
    detailDialogVisible.value = false;
    ElMessage.success('测试用例导入成功');
  } catch (error) {
    console.error('导入测试用例失败:', error);
    ElMessage.error(error.message || '导入测试用例失败');
  }
};

// 删除历史记录
const deleteHistory = async (id) => {
  try {
    await historyService.deleteHistory(id);
    ElMessage.success('删除历史记录成功');
    fetchHistoryList();
  } catch (error) {
    ElMessage.error(error.message || '删除历史记录失败');
  }
};

// 清空所有历史记录
const clearAllHistory = async () => {
  try {
    const result = await historyService.deleteAllHistory();
    ElMessage.success(result.message || '清空历史记录成功');
    fetchHistoryList();
  } catch (error) {
    ElMessage.error(error.message || '清空历史记录失败');
  }
};

// 组件挂载时加载历史记录
onMounted(() => {
  fetchHistoryList();
});
</script>

<style scoped>
.history-records {
  margin-top: 20px;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.history-actions {
  display: flex;
  gap: 10px;
}

.history-filters {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}

.detail-path {
  flex: 1;
}

.detail-path h3 {
  margin-top: 0;
  margin-bottom: 5px;
}

.detail-path p {
  margin-top: 0;
  color: #666;
}

.formatted-json {
  max-height: 150px;
  overflow: auto;
  font-family: monospace;
  font-size: 12px;
}

.formatted-json pre {
  margin: 0;
  white-space: pre-wrap;
}

.test-cases-list {
  margin-top: 20px;
}

.test-cases-list h4 {
  margin-bottom: 15px;
}

.no-test-cases {
  margin-top: 30px;
}
</style> 