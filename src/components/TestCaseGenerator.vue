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
      <el-button type="primary" @click="showGenerateOptions">生成测试用例</el-button>
      <el-button @click="executeTestCases" :disabled="!testCases.length">执行测试</el-button>
      <el-dropdown @command="handleExport" trigger="click">
        <el-button :disabled="!testCases.length">
          导出 <el-icon class="el-icon--right"><Download /></el-icon>
        </el-button>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="json">导出为JSON</el-dropdown-item>
            <el-dropdown-item command="array">导出为数组格式</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>

    <!-- AI生成选项对话框 -->
    <el-dialog
      v-model="generateOptionsVisible"
      title="选择测试用例生成方式"
      width="50%"
    >
      <el-tabs v-model="generationMethod">
        <el-tab-pane label="常规生成" name="standard">
          <p>使用内置规则生成测试用例</p>
        </el-tab-pane>
        <el-tab-pane label="AI生成" name="ai">
          <p>使用DeepSeek AI生成更全面的测试用例</p>
          <el-alert
            v-if="!hasApiKey"
            title="未检测到DeepSeek API密钥"
            type="warning"
            :closable="false"
            show-icon
            style="margin-bottom: 15px"
          >
            <div>
              请按照以下步骤配置API密钥：
              <ol style="padding-left: 20px; margin-top: 8px; margin-bottom: 8px;">
                <li>访问 <a href="https://platform.deepseek.com" target="_blank">DeepSeek平台</a> 注册并获取API密钥</li>
                <li>在项目根目录创建 <code>.env</code> 文件（或复制 <code>.env.example</code>）</li>
                <li>添加环境变量: <code>VITE_DEEPSEEK_API_KEY=your_api_key</code></li>
                <li>重启开发服务器</li>
              </ol>
              <div>或者在下方输入临时API密钥：</div>
            </div>
          </el-alert>
          <el-form>
            <el-form-item v-if="!hasApiKey" label="临时API密钥">
              <el-input v-model="tempApiKey" placeholder="sk-..." show-password></el-input>
            </el-form-item>
            <el-form-item label="测试用例模板">
              <el-input
                v-model="aiTemplate"
                type="textarea"
                :rows="5"
                placeholder="请输入测试用例模板，例如: ['用例名称', '学校名称', 学校类型, 是否有卡, '学校地址', '经纬度', 预期状态码]"
              ></el-input>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="generateOptionsVisible = false">取消</el-button>
          <el-button type="primary" @click="generateCasesWithSelectedMethod" :loading="isGenerating">
            生成
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 生成中的加载提示 -->
    <el-dialog
      v-model="aiGeneratingVisible"
      title="AI正在生成测试用例"
      width="30%"
      :show-close="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
    >
      <div class="ai-generating-content">
        <el-progress type="circle" :percentage="100" status="warning" indeterminate></el-progress>
        <p>DeepSeek AI正在分析API并生成测试用例，请稍候...</p>
      </div>
    </el-dialog>

    <div class="test-cases" v-if="testCases.length > 0">
      <el-table :data="formattedTestCases" border style="width: 100%">
        <el-table-column prop="name" label="用例名称" min-width="150" />
        
        <el-table-column label="参数" min-width="200">
          <template #default="scope">
            <div v-if="scope.row.parameters && scope.row.parameters !== '{}'" class="formatted-json">
              <template v-for="(value, key) in JSON.parse(scope.row.parameters)" :key="key">
                <div class="param-item">
                  <span class="param-name">{{ key }}:</span>
                  <span class="param-value">{{ value }}</span>
                </div>
              </template>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column label="请求体" min-width="300">
          <template #default="scope">
            <div v-if="scope.row.body && scope.row.body !== '{}'" class="formatted-json">
              <template v-for="(value, key) in JSON.parse(scope.row.body)" :key="key">
                <div class="param-item">
                  <span class="param-name">{{ key }}:</span>
                  <span class="param-value">{{ typeof value === 'object' ? JSON.stringify(value) : value }}</span>
                </div>
              </template>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="expectedStatus" label="预期状态码" width="120" />
        
        <el-table-column prop="description" label="补充说明" min-width="150" />
        
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
import { ref, computed, watch } from 'vue';
import { Document, Download } from '@element-plus/icons-vue';
import { generateTestCases, formatTestCasesForDisplay, convertTestCasesToArray } from '../utils/swaggerParser';
import { generateTestCasesWithAI } from '../utils/deepseekAPI';
import { ElMessage, ElNotification } from 'element-plus';
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

const emit = defineEmits(['test-cases-generated', 'error']);

const testCases = ref([]);
const formattedTestCases = ref([]);
const testResults = ref([]);
const currentTestResult = ref(null);
const isExecuting = ref(false);
const isGenerating = ref(false);

// AI生成相关
const generateOptionsVisible = ref(false);
const aiGeneratingVisible = ref(false);
const generationMethod = ref('standard');
const aiTemplate = ref('');

// API密钥相关
const hasApiKey = computed(() => !!import.meta.env.VITE_DEEPSEEK_API_KEY);
const tempApiKey = ref('');

// 根据API路径生成对应的测试用例模板
const generateTemplateForPath = (path) => {
  if (!path) return '';
  
  // 获取API操作对象
  const operation = props.api.paths[path.path][path.method.toLowerCase()];
  
  // 获取API参数信息
  const parameters = operation.parameters || [];
  
  // 获取API请求体信息
  let requestBodySchema = null;
  
  // 处理requestBody，兼容Swagger 2.0和3.0
  if (operation.requestBody && operation.requestBody.content && operation.requestBody.content['application/json']) {
    requestBodySchema = operation.requestBody.content['application/json'].schema;
  } else if (parameters.some(param => param.in === 'body' && param.schema)) {
    // Swagger 2.0 风格的请求体参数
    requestBodySchema = parameters.find(param => param.in === 'body').schema;
  }
  
  // 解析请求体schema的属性
  let bodyProperties = [];
  if (requestBodySchema) {
    if (requestBodySchema.$ref) {
      // 处理引用
      const refName = requestBodySchema.$ref.split('/').pop();
      const schema = props.api.definitions?.[refName] || 
                     (props.api.components?.schemas?.[refName]);
      
      if (schema && schema.properties) {
        bodyProperties = Object.entries(schema.properties).map(([name, prop]) => {
          return {
            name,
            type: prop.type,
            required: schema.required?.includes(name) || false,
            description: prop.description
          };
        });
      }
    } else if (requestBodySchema.properties) {
      // 直接处理属性
      bodyProperties = Object.entries(requestBodySchema.properties).map(([name, prop]) => {
        return {
          name,
          type: prop.type,
          required: requestBodySchema.required?.includes(name) || false,
          description: prop.description
        };
      });
    }
  }
  
  // 通用模板生成逻辑，不再基于具体API路径类型
  // 从请求参数和请求体中提取必要字段，构建通用模板
  
  // 获取查询参数（对于GET请求）或路径参数
  const queryParams = parameters.filter(p => p.in === 'query' || p.in === 'path');
  
  // 获取请求体参数（对于POST/PUT请求）
  const bodyParams = bodyProperties.filter(p => p.required);
  
  // 根据HTTP方法生成不同模板
  if (path.method === 'GET') {
    // GET请求模板
    if (queryParams.length > 0) {
      // 有查询参数的GET请求
      const paramNames = queryParams.map(p => p.name);
      
      // 生成基本测试行
      let template = `- ["正常查询", `;
      
      // 为每个参数添加占位符
      paramNames.forEach(() => {
        template += `"validValue", `;
      });
      
      template += `200]\n`;
      
      // 添加参数缺失场景
      queryParams.filter(p => p.required).forEach((param, index) => {
        template += `- ["${param.name}参数缺失", `;
        
        // 填充前面的参数
        for (let i = 0; i < paramNames.length; i++) {
          if (i === index) {
            template += `"", `;
          } else {
            template += `"validValue", `;
          }
        }
        
        template += `400]\n`;
      });
      
      // 添加参数类型错误场景
      queryParams.forEach((param, index) => {
        if (param.type === 'number' || param.type === 'integer') {
          template += `- ["${param.name}类型错误", `;
          
          // 填充参数
          for (let i = 0; i < paramNames.length; i++) {
            if (i === index) {
              template += `"non-numeric", `;
            } else {
              template += `"validValue", `;
            }
          }
          
          template += `400]\n`;
        }
      });
      
      return template;
    } else {
      // 无参数的GET请求
      return `- ["正常查询", 200]`;
    }
  } else if (path.method === 'POST' || path.method === 'PUT') {
    // POST/PUT请求模板
    if (bodyParams.length > 0) {
      // 有请求体的POST/PUT请求
      const paramNames = bodyParams.map(p => p.name);
      
      // 为了简洁，只生成几个关键场景
      let template = `- ["正常请求", `;
      
      // 为每个参数添加占位符
      paramNames.forEach(name => {
        if (name.toLowerCase().includes('type') || name.toLowerCase().includes('status')) {
          template += `1, `; // 对于类型字段，默认使用数字
        } else if (name.toLowerCase().includes('id')) {
          template += `"1", `; // ID字段通常是字符串
        } else {
          template += `"validValue", `;
        }
      });
      
      template += `200]\n`;
      
      // 添加必填参数缺失场景
      bodyParams.forEach((param, index) => {
        template += `- ["${param.name}参数缺失", `;
        
        // 填充参数
        for (let i = 0; i < paramNames.length; i++) {
          if (i === index) {
            template += `"", `;
          } else if (paramNames[i].toLowerCase().includes('type') || paramNames[i].toLowerCase().includes('status')) {
            template += `1, `;
          } else if (paramNames[i].toLowerCase().includes('id')) {
            template += `"1", `;
          } else {
            template += `"validValue", `;
          }
        }
        
        template += `400]\n`;
      });
      
      return template;
    } else {
      // 无请求体的POST/PUT请求
      return `- ["正常请求", 200]`;
    }
  } else if (path.method === 'DELETE') {
    // DELETE请求模板
    const idParam = queryParams.find(p => p.name.toLowerCase().includes('id'));
    
    if (idParam) {
      return `- ["正常删除", "validId", 200]
- ["ID为空", "", 400]
- ["ID不存在", "nonExistId", 404]`;
    } else {
      return `- ["正常删除", 200]`;
    }
  }
  
  // 最通用的模板
  return `- ["正常场景", 200]
- ["异常场景", 400]`;
};

// 监听选中路径的变化，自动生成测试用例
watch(() => props.selectedPath, (newPath) => {
  if (newPath) {
    try {
      testCases.value = [];
      formattedTestCases.value = [];
      testResults.value = [];
      currentTestResult.value = null;
      
      // 自动生成测试用例
      const cases = generateTestCases(props.api, newPath);
      testCases.value = cases;
      formattedTestCases.value = formatTestCasesForDisplay(cases);
      
      // 发送生成的测试用例数量
      emit('test-cases-generated', cases.length);
    } catch (error) {
      console.error('自动生成测试用例时出错:', error);
      emit('error', error);
    }
  }
}, { immediate: true });

// 显示生成选项对话框
const showGenerateOptions = () => {
  generateOptionsVisible.value = true;
};

// 使用选定方法生成测试用例
const generateCasesWithSelectedMethod = async () => {
  try {
    isGenerating.value = true;
    
    if (generationMethod.value === 'standard') {
      // 使用标准方法生成
      const cases = generateTestCases(props.api, props.selectedPath);
      testCases.value = cases;
      formattedTestCases.value = formatTestCasesForDisplay(cases);
      
      generateOptionsVisible.value = false;
      ElMessage.success(`成功生成 ${cases.length} 个测试用例`);
      
      // 发送生成的测试用例数量
      emit('test-cases-generated', cases.length);
    } else if (generationMethod.value === 'ai') {
      // 使用AI生成
      generateOptionsVisible.value = false;
      aiGeneratingVisible.value = true;
      
      let apiKey = hasApiKey.value ? import.meta.env.VITE_DEEPSEEK_API_KEY : tempApiKey.value;
      
      if (!apiKey) {
        aiGeneratingVisible.value = false;
        ElMessage.error('缺少API密钥，无法使用AI生成测试用例');
        emit('error', new Error('缺少API密钥，无法使用AI生成测试用例'));
        isGenerating.value = false;
        return;
      }
      
      try {
        const aiCases = await generateTestCasesWithAI(props.api, props.selectedPath, aiTemplate.value, apiKey);
        testCases.value = aiCases;
        formattedTestCases.value = formatTestCasesForDisplay(aiCases);
        
        aiGeneratingVisible.value = false;
        ElMessage.success(`AI成功生成 ${aiCases.length} 个测试用例`);
        
        // 发送生成的测试用例数量
        emit('test-cases-generated', aiCases.length);
      } catch (aiError) {
        aiGeneratingVisible.value = false;
        console.error('AI生成测试用例时出错:', aiError);
        ElMessage.error('AI生成测试用例失败: ' + (aiError.message || '未知错误'));
        emit('error', aiError);
      }
    }
  } catch (error) {
    console.error('生成测试用例时出错:', error);
    ElMessage.error('生成测试用例失败: ' + (error.message || '未知错误'));
    emit('error', error);
  } finally {
    isGenerating.value = false;
  }
};

// 执行测试用例
const executeTestCases = async () => {
  if (testCases.value.length === 0) {
    ElMessage.warning('没有可执行的测试用例');
    return;
  }
  
  try {
    // 清空之前的测试结果
    testResults.value = [];
    currentTestResult.value = null;
    
    const baseUrl = 'https://example.com/api'; // 这里应替换为实际的API基础URL
    
    // 询问用户API基础URL
    const { value: customBaseUrl } = await ElMessageBox.prompt(
      '请输入API的基础URL，所有测试请求将发送到此URL',
      '设置API基础URL',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputPattern: /^https?:\/\/.+/,
        inputErrorMessage: '请输入有效的URL (以http://或https://开头)',
        inputValue: baseUrl
      }
    ).catch(() => {
      return { value: null };
    });
    
    if (!customBaseUrl) return;
    
    // 转换测试用例为数组格式
    const testCasesArray = convertTestCasesToArray(testCases.value, props.api, props.selectedPath);
    
    // 显示执行进度通知
    const notification = ElNotification({
      title: '测试执行中',
      message: `正在执行 ${testCasesArray.length} 个测试用例`,
      type: 'info',
      duration: 0
    });
    
    // 逐个执行测试用例
    for (let i = 0; i < testCasesArray.length; i++) {
      const testCase = testCasesArray[i];
      const { method, url, headers, body, expectedStatus } = testCase;
      
      try {
        const startTime = Date.now();
        const response = await axios({
          method: method.toLowerCase(),
          url: `${customBaseUrl}${url}`,
          headers,
          data: body
        });
        
        const duration = Date.now() - startTime;
        
        // 添加测试结果
        testResults.value.push({
          status: response.status,
          expectedStatus,
          data: response.data,
          duration,
          pass: response.status === expectedStatus
        });
        
        // 更新当前查看的测试结果
        currentTestResult.value = testResults.value[testResults.value.length - 1];
      } catch (error) {
        // 处理请求错误
        const status = error.response ? error.response.status : 0;
        const data = error.response ? error.response.data : { error: error.message };
        const duration = 0;
        
        testResults.value.push({
          status,
          expectedStatus,
          data,
          duration,
          pass: status === expectedStatus
        });
        
        currentTestResult.value = testResults.value[testResults.value.length - 1];
      }
    }
    
    // 关闭通知
    notification.close();
    
    // 计算测试通过率
    const passCount = testResults.value.filter(result => result.pass).length;
    const passRate = Math.round((passCount / testResults.value.length) * 100);
    
    // 显示测试结果通知
    ElNotification({
      title: '测试执行完成',
      message: `通过率: ${passRate}% (${passCount}/${testResults.value.length})`,
      type: passRate === 100 ? 'success' : passRate >= 60 ? 'warning' : 'error',
      duration: 5000
    });
  } catch (error) {
    console.error('执行测试用例时出错:', error);
    ElMessage.error('执行测试失败: ' + (error.message || '未知错误'));
    emit('error', error);
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
  margin-bottom: 10px;
}

.method-tag {
  margin-right: 15px;
  flex-shrink: 0;
}

.path-details {
  flex-grow: 1;
}

.path-details h3 {
  margin: 0 0 5px 0;
  font-size: 18px;
}

.path-details p {
  margin: 0;
  color: #666;
}

.test-actions {
  margin-bottom: 20px;
  display: flex;
  gap: 10px;
}

.test-cases {
  margin-top: 20px;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  font-size: 12px;
}

/* JSON格式化样式 */
.formatted-json {
  font-family: monospace;
  font-size: 12px;
  max-height: 300px;
  overflow-y: auto;
  padding: 2px;
}

.param-item {
  padding: 2px 0;
  display: flex;
  flex-wrap: wrap;
}

.param-name {
  color: #0d47a1;
  margin-right: 5px;
  font-weight: bold;
}

.param-value {
  word-break: break-word;
  flex: 1;
}

.test-results {
  margin-top: 20px;
  padding: 15px;
  background-color: #f9f9f9;
  border-radius: 4px;
}

.test-results h4 {
  margin-top: 0;
}

.result-details {
  line-height: 1.6;
}

.no-path-selected {
  margin-top: 40px;
  text-align: center;
}

.ai-generating-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.ai-generating-content p {
  margin-top: 20px;
  color: #666;
}
</style> 