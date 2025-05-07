<template>
  <div class="test-case-generator" v-if="selectedPath">
    <div class="path-info">
      <div class="method-tag">
        <el-tag :type="getMethodTagType(selectedPath.method)" size="large">{{ selectedPath.method }}</el-tag>
      </div>
      <div class="path-details">
        <h3>{{ selectedPath.path }}</h3>
        <p>{{ selectedPath.summary }}</p>
      </div>
    </div>

    <el-divider />

    <div class="test-actions">
      <el-button type="primary" @click="generateCases">生成测试用例</el-button>
      <el-button @click="executeTestCases" :disabled="!testCases.length">执行测试</el-button>
      <el-dropdown @command="handleExport" trigger="click">
        <el-button :disabled="!testCases.length">
          导出 <el-icon class="el-icon--right"><arrow-down /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="json">导出为JSON</el-dropdown-item>
            <el-dropdown-item command="array">导出为数组格式</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <div class="test-cases" v-if="testCases.length > 0">
      <el-table :data="formattedTestCases" border style="width: 100%">
        <el-table-column prop="name" label="用例名称" min-width="150" />
        
        <el-table-column label="参数" min-width="200">
          <template #default="scope">
            <pre v-if="scope.row.parameters">{{ scope.row.parameters }}</pre>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="请求体" min-width="300">
          <template #default="scope">
            <pre v-if="scope.row.body">{{ scope.row.body }}</pre>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="expectedStatus" label="预期状态码" width="120" />
        
        <el-table-column label="测试结果" width="100" v-if="testResults.length > 0">
          <template #default="scope">
            <el-tag 
              :type="getTestResultType(scope.$index)"
              size="small"
            >
              {{ getTestResultText(scope.$index) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="test-results" v-if="currentTestResult">
      <h4>测试响应</h4>
      <div class="result-details">
        <div>
          <strong>状态码:</strong> {{ currentTestResult.status }}
          <el-tag 
            :type="currentTestResult.status === currentTestResult.expectedStatus ? 'success' : 'danger'"
            size="small"
            style="margin-left: 8px;"
          >
            {{ currentTestResult.status === currentTestResult.expectedStatus ? '通过' : '失败' }}
          </el-tag>
        </div>
        <div><strong>请求耗时:</strong> {{ currentTestResult.duration }}ms</div>
        <el-divider />
        <div>
          <strong>响应数据:</strong>
          <pre>{{ JSON.stringify(currentTestResult.data, null, 2) }}</pre>
        </div>
      </div>
    </div>
  </div>
  <div v-else class="no-path-selected">
    <el-empty description="请选择一个API路径" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
import { generateTestCases, formatTestCasesForDisplay, convertTestCasesToArray } from '../utils/swaggerParser';
import axios from 'axios';

const props = defineProps({
  api: {
    type: Object,
    required: true
  },
  selectedPath: {
    type: Object,
    default: null
  }
});

const testCases = ref([]);
const formattedTestCases = ref([]);
const testResults = ref([]);
const currentTestResult = ref(null);
const isExecuting = ref(false);

// 生成测试用例
const generateCases = () => {
  if (!props.selectedPath) return;
  
  // 生成测试用例
  testCases.value = generateTestCases(props.api, props.selectedPath);
  
  // 格式化用于显示
  formattedTestCases.value = formatTestCasesForDisplay(testCases.value);
  
  // 清除之前的测试结果
  testResults.value = [];
  currentTestResult.value = null;
};

// 执行测试用例
const executeTestCases = async () => {
  if (!testCases.value.length || isExecuting.value) return;
  
  isExecuting.value = true;
  testResults.value = [];
  currentTestResult.value = null;
  
  try {
    // 假设执行第一个测试用例
    const testCase = testCases.value[0];
    
    // 创建URL（这里仅作演示，实际可能需要基础URL配置）
    const url = props.selectedPath.path;
    
    // 记录开始时间
    const startTime = Date.now();
    
    // 这里实际项目中应该发送真实请求
    // 由于这是前端项目，我们模拟一个响应
    // const response = await axios({
    //   method: props.selectedPath.method.toLowerCase(),
    //   url,
    //   params: props.selectedPath.method === 'GET' ? testCase.parameters : undefined,
    //   data: testCase.body,
    //   headers: { 'Content-Type': 'application/json' }
    // });
    
    // 模拟响应
    const mockResponse = {
      status: testCase.expectedStatus,
      data: {
        code: 0,
        msg: "操作成功",
        data: testCase.expectedStatus === 200 ? true : null
      }
    };
    
    // 计算耗时
    const duration = Date.now() - startTime;
    
    // 保存测试结果
    const result = {
      status: mockResponse.status,
      expectedStatus: testCase.expectedStatus,
      duration,
      data: mockResponse.data
    };
    
    testResults.value.push(result);
    currentTestResult.value = result;
    
  } catch (error) {
    console.error('执行测试时出错:', error);
    // 保存错误结果
    testResults.value.push({
      status: error.response?.status || 500,
      expectedStatus: testCases.value[0].expectedStatus,
      duration: 0,
      data: error.response?.data || { error: error.message }
    });
  } finally {
    isExecuting.value = false;
  }
};

// 获取测试结果类型
const getTestResultType = (index) => {
  if (!testResults.value[index]) return '';
  return testResults.value[index].status === testResults.value[index].expectedStatus ? 'success' : 'danger';
};

// 获取测试结果文本
const getTestResultText = (index) => {
  if (!testResults.value[index]) return '';
  return testResults.value[index].status === testResults.value[index].expectedStatus ? '通过' : '失败';
};

// 获取请求方法对应的标签类型
const getMethodTagType = (method) => {
  const types = {
    'GET': 'success',
    'POST': 'primary',
    'PUT': 'warning',
    'DELETE': 'danger',
    'PATCH': 'info'
  };
  return types[method] || 'info';
};

// 处理导出
const handleExport = (command) => {
  if (!testCases.value.length) return;
  
  let data;
  let filename;
  
  if (command === 'json') {
    data = JSON.stringify(testCases.value, null, 2);
    filename = `test_cases_${props.selectedPath.operationId || 'api'}.json`;
  } else if (command === 'array') {
    const arrayData = convertTestCasesToArray(testCases.value, props.api, props.selectedPath);
    data = JSON.stringify(arrayData, null, 2);
    filename = `test_cases_array_${props.selectedPath.operationId || 'api'}.json`;
  }
  
  if (data) {
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  }
};
</script>

<style scoped>
.test-case-generator {
  margin-top: 20px;
}

.path-info {
  display: flex;
  align-items: flex-start;
  margin-bottom: 15px;
}

.method-tag {
  margin-right: 15px;
}

.path-details h3 {
  margin: 0 0 5px 0;
}

.path-details p {
  margin: 0;
  color: #606266;
}

.test-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.test-cases {
  margin-bottom: 20px;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 12px;
  background-color: #f8f8f8;
  padding: 8px;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
}

.result-details {
  background-color: #f8f8f8;
  padding: 15px;
  border-radius: 4px;
  margin-top: 10px;
}

.no-path-selected {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
}
</style> 