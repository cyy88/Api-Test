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
import { ref, computed, watch } from 'vue';
import { ArrowDown } from '@element-plus/icons-vue';
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
  
  // 检查API路径类型
  if (path.path.includes('/school')) {
    // 学校管理API
    if (path.method === 'POST' || path.method === 'PUT') {
      // 分析SchoolSaveReqVO结构
      const hasSchoolName = bodyProperties.some(p => p.name === 'schoolName');
      const hasSchoolType = bodyProperties.some(p => p.name === 'schoolType');
      const hasSchoolAddress = bodyProperties.some(p => p.name === 'schoolAddress');
      const hasSchoolLonLat = bodyProperties.some(p => p.name === 'schoolLonLat');
      const hasIsHaveCard = bodyProperties.some(p => p.name === 'isHaveCard');
      
      if (hasSchoolName && hasSchoolType && hasSchoolAddress && hasSchoolLonLat && hasIsHaveCard) {
        return `- [ "正常数据", "测试学校", 1, 2, "浙江省杭州市拱墅区石桥路与永华街交叉口滨江·春语蓝庭", "120.188966,30.346182", 200 ]
- ["学校名称为空", "", 1, 2, "浙江省杭州市拱墅区石桥路与永华街交叉口滨江·春语蓝庭", "120.188966,30.346182", 400]
- ["学校地址为空", "测试学校2", 1, 2, "", "120.188966,30.346182", 400]
- ["学校坐标为空", "测试学校3", 1, 2, "浙江省杭州市拱墅区石桥路与永华街交叉口滨江·春语蓝庭", "", 400]
- ["学校类型非法值", "测试学校4", 99, 2, "浙江省杭州市", "120.188966,30.346182", 400]
- ["是否有一卡通非法值", "测试学校5", 1, 99, "浙江省杭州市", "120.188966,30.346182", 400]`;
      }
    } else if (path.path.includes('/page')) {
      // 分页查询
      // 分析查询参数
      const queryParams = parameters.filter(p => p.in === 'query');
      const paramNames = queryParams.map(p => p.name);
      
      if (paramNames.includes('pageNo') && paramNames.includes('pageSize')) {
        let template = `- ["正常查询", `;
        
        // 添加其他查询参数
        queryParams.forEach(param => {
          if (param.name !== 'pageNo' && param.name !== 'pageSize') {
            template += `null, `;
          }
        });
        
        template += `1, 10, 200]
- ["页码为0", `;
        
        // 再次添加其他查询参数
        queryParams.forEach(param => {
          if (param.name !== 'pageNo' && param.name !== 'pageSize') {
            template += `null, `;
          }
        });
        
        template += `0, 10, 400]
- ["每页大小为0", `;
        
        // 第三次添加其他查询参数
        queryParams.forEach(param => {
          if (param.name !== 'pageNo' && param.name !== 'pageSize') {
            template += `null, `;
          }
        });
        
        template += `1, 0, 400]`;
        
        return template;
      }
    } else if (path.path.includes('/delete') || path.path.includes('/get')) {
      // 获取或删除操作
      const idParam = parameters.find(p => p.name === 'id');
      
      if (idParam) {
        return `- ["正常操作", "test_id", 200]
- ["ID为空", "", 400]
- ["ID不存在", "non_existent_id", 404]`;
      }
    }
  }
  
  // 恢复用户和登录API相关的代码
  if (path.path.includes('/user')) {
    // 用户相关API
    if (path.method === 'POST') {
      return `- ["正常创建", "test_user", "password123", "test@example.com", 1, 200]
- ["用户名为空", "", "password123", "test@example.com", 1, 400]
- ["密码为空", "test_user", "", "test@example.com", 1, 400]
- ["邮箱格式错误", "test_user", "password123", "invalid_email", 1, 400]`;
    }
  } else if (path.path.includes('/login')) {
    // 登录相关API
    return `- ["正常登录", "admin", "password123", 200]
- ["用户名为空", "", "password123", 400]
- ["密码为空", "admin", "", 400]
- ["用户名不存在", "nonexistent", "password123", 401]
- ["密码错误", "admin", "wrong_password", 401]`;
  }
  
  // 如果没有匹配到特定模式，则生成通用模板
  // 这部分逻辑保持不变...
  
  // 默认模板 - 根据API方法生成通用模板
  if (path.method === 'GET') {
    return `- ["正常查询", "param1", "param2", 200]
- ["参数1为空", "", "param2", 400]
- ["参数2为空", "param1", "", 400]`;
  } else if (path.method === 'POST' || path.method === 'PUT') {
    return `- ["正常创建/更新", "field1", "field2", 200]
- ["字段1为空", "", "field2", 400]
- ["字段2为空", "field1", "", 400]`;
  } else if (path.method === 'DELETE') {
    return `- ["正常删除", "id", 200]
- ["ID为空", "", 400]
- ["ID不存在", "non_existent_id", 404]`;
  }
  
  // 最通用的模板
  return `- ["正常场景", "param1", "param2", 200]
- ["异常场景1", "", "param2", 400]
- ["异常场景2", "param1", "", 400]`;
};

// 监听选择的路径变化，自动生成对应模板
watch(() => props.selectedPath, (newPath) => {
  if (newPath) {
    aiTemplate.value = generateTemplateForPath(newPath);
  }
}, { immediate: true });

// 显示生成选项对话框
const showGenerateOptions = () => {
  generateOptionsVisible.value = true;
};

// 根据选择的方法生成测试用例
const generateCasesWithSelectedMethod = async () => {
  generateOptionsVisible.value = false;
  isGenerating.value = true;
  
  try {
    if (generationMethod.value === 'standard') {
      // 使用标准方法生成
      await generateCases();
    } else {
      // 使用AI方法生成
      await generateCasesWithAI();
    }
  } catch (error) {
    ElMessage.error(`生成测试用例失败: ${error.message}`);
  } finally {
    isGenerating.value = false;
  }
};

// 生成标准测试用例
const generateCases = async () => {
  if (!props.selectedPath) return;
  
  // 生成测试用例
  testCases.value = generateTestCases(props.api, props.selectedPath);
  
  // 格式化用于显示
  formattedTestCases.value = formatTestCasesForDisplay(testCases.value);
  
  // 清除之前的测试结果
  testResults.value = [];
  currentTestResult.value = null;
  
  ElMessage.success('已生成测试用例');
};

// 使用AI生成测试用例
const generateCasesWithAI = async () => {
  if (!props.selectedPath) return;
  
  try {
    // 显示加载对话框
    aiGeneratingVisible.value = true;
    
    // 使用DeepSeek API生成测试用例
    const aiTestCases = await generateTestCasesWithAI(
      props.api,
      props.selectedPath,
      aiTemplate.value,
      tempApiKey.value // 传递临时API密钥
    );
    
    if (Array.isArray(aiTestCases) && aiTestCases.length > 0) {
      // 将AI生成的测试用例转换为应用内部格式
      if (typeof aiTestCases[0] === 'object' && aiTestCases[0].name) {
        // 已经是对象格式
        testCases.value = aiTestCases;
      } else {
        // 数组格式，需要转换
        testCases.value = convertAIArrayToTestCases(aiTestCases);
      }
      
      // 格式化用于显示
      formattedTestCases.value = formatTestCasesForDisplay(testCases.value);
      
      // 清除之前的测试结果
      testResults.value = [];
      currentTestResult.value = null;
      
      ElNotification({
        title: '成功',
        message: `AI已生成 ${testCases.value.length} 个测试用例`,
        type: 'success',
        duration: 3000
      });
    } else {
      throw new Error('AI返回的测试用例格式不正确');
    }
  } catch (error) {
    console.error('AI生成测试用例失败:', error);
    ElNotification({
      title: '错误',
      message: `AI生成测试用例失败: ${error.message}`,
      type: 'error',
      duration: 5000
    });
  } finally {
    // 关闭加载对话框
    aiGeneratingVisible.value = false;
  }
};

// 将AI生成的数组格式转换为测试用例对象
const convertAIArrayToTestCases = (aiArrays) => {
  return aiArrays.map(array => {
    // 检查API类型，根据不同API格式化不同的测试用例
    if (props.selectedPath.path.includes('/school')) {
      // 学校管理API的转换
      const [name, schoolName, schoolType, isHaveCard, schoolAddress, schoolLonLat, expectedStatus] = array;
      
      // 创建请求体对象
      let body = null;
      if (props.selectedPath.method === 'POST' || props.selectedPath.method === 'PUT') {
        body = {
          id: props.selectedPath.method === 'PUT' ? "test_id" : undefined,
          schoolName,
          schoolType,
          isHaveCard,
          schoolAddress,
          schoolLonLat,
          locationSearch: false,
          schoolRemark: "自动生成的测试用例"
        };
      }
      
      // 创建参数对象
      const parameters = {};
      if (props.selectedPath.method === 'GET' || props.selectedPath.method === 'DELETE') {
        // 对于GET和DELETE请求，添加必要的查询参数
        if (props.selectedPath.path.includes('/get') || props.selectedPath.path.includes('/delete')) {
          parameters.id = "test_id";
        }
      }
      
      return {
        name,
        parameters,
        body,
        expectedStatus: parseInt(expectedStatus) || 200
      };
    } else {
      // 默认转换方式
      const [name, ...rest] = array;
      const expectedStatus = parseInt(rest.pop()) || 200;
      
      return {
        name,
        parameters: {},
        body: rest.length > 0 ? { values: rest } : null,
        expectedStatus
      };
    }
  });
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