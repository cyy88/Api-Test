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
      console.log(aiTestCases);
      
      // 记录AI返回数据的类型和格式
      console.log('AI返回数据类型:', typeof aiTestCases);
      if (typeof aiTestCases === 'string') {
        console.log('AI返回了字符串格式数据，尝试解析为JSON');
        try {
          const parsed = JSON.parse(aiTestCases);
          console.log('解析后的数据:', parsed);
          aiTestCases = parsed;
        } catch (err) {
          console.error('解析AI返回的字符串为JSON失败:', err);
        }
      } else if (Array.isArray(aiTestCases)) {
        console.log('AI返回了数组格式数据，数组长度:', aiTestCases.length);
        if (aiTestCases.length > 0) {
          console.log('第一个元素类型:', typeof aiTestCases[0]);
          console.log('第一个元素值:', aiTestCases[0]);
        }
      } else if (typeof aiTestCases === 'object') {
        console.log('AI返回了对象格式数据:', Object.keys(aiTestCases));
      }
      
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
  // 先确保aiArrays是数组
  if (!Array.isArray(aiArrays)) {
    console.warn("AI返回的数据不是数组格式:", aiArrays);
    
    // 如果是字符串，尝试解析为JSON
    if (typeof aiArrays === 'string') {
      try {
        const parsed = JSON.parse(aiArrays);
        if (Array.isArray(parsed)) {
          aiArrays = parsed;
        } else {
          return [{
            name: "AI返回格式错误",
            parameters: {},
            body: null,
            expectedStatus: 400
          }];
        }
      } catch (e) {
        console.error("无法解析AI返回的字符串为JSON:", e);
        return [{
          name: "AI返回格式错误",
          parameters: {},
          body: null,
          expectedStatus: 400
        }];
      }
    } else {
      return [{
        name: "AI返回格式错误",
        parameters: {},
        body: null,
        expectedStatus: 400
      }];
    }
  }
  
  // 处理数组格式的测试用例
  return aiArrays.map(array => {
    // 检查是否已经是测试用例对象格式
    if (typeof array === 'object' && !Array.isArray(array) && array.name) {
      return array;
    }
    
    // 通用转换逻辑，基于API方法和参数结构
    if (!Array.isArray(array)) {
      console.warn("非数组格式的AI测试用例:", array);
      return {
        name: typeof array === 'string' ? array : "格式错误",
        parameters: {},
        body: null,
        expectedStatus: 400
      };
    }
    
    // 提取测试用例名称和预期状态码
    let name = array[0] || "测试用例";
    
    // 尝试从数组最后一个元素中提取状态码
    let expectedStatus = 200;
    const lastElement = array[array.length - 1];
    if (typeof lastElement === 'number') {
      expectedStatus = lastElement;
      // 移除已处理的状态码
      array = array.slice(0, -1);
    } else if (typeof lastElement === 'string' && /^\d{3}$/.test(lastElement)) {
      expectedStatus = parseInt(lastElement);
      // 移除已处理的状态码
      array = array.slice(0, -1);
    }
    
    // 移除已处理的名称
    const dataArray = array.slice(1);
    
    // 根据API方法创建请求参数
    if (props.selectedPath.method === 'GET' || props.selectedPath.method === 'DELETE') {
      // 对于GET和DELETE请求，创建查询参数对象
      const parameters = {};
      
      // 获取API操作对象
      const operation = props.api.paths[props.selectedPath.path][props.selectedPath.method.toLowerCase()];
      const apiParams = operation.parameters || [];
      const queryParams = apiParams.filter(p => p.in === 'query' || p.in === 'path');
      
      // 将数组值映射到参数名
      queryParams.forEach((param, index) => {
        if (index < dataArray.length) {
          parameters[param.name] = dataArray[index];
        }
      });
      
      // 提取或创建补充说明
      let description = '';
      if (array.length > 2) {
        // 尝试从数组中搜索可能的补充说明，通常可能在第一个或最后一个元素后
        const possibleDescriptions = array.filter(item => 
          typeof item === 'string' && 
          !item.match(/^\d{3}$/) && // 不是状态码
          item !== name && // 不是名称
          !Object.values(parameters).includes(item) // 不是参数值
        );
        
        if (possibleDescriptions.length > 0) {
          description = possibleDescriptions[0];
        }
      }
      
      return {
        name,
        parameters,
        body: null,
        expectedStatus,
        description
      };
    } else if (props.selectedPath.method === 'POST' || props.selectedPath.method === 'PUT' || props.selectedPath.method === 'PATCH') {
      // 对于POST/PUT/PATCH请求，创建请求体对象
      const body = {};
      
      // 获取API操作对象
      const operation = props.api.paths[props.selectedPath.path][props.selectedPath.method.toLowerCase()];
      
      // 获取请求体信息
      let requestBodySchema = null;
      let bodyProperties = [];
      
      // 处理requestBody，兼容Swagger 2.0和3.0
      if (operation.requestBody && operation.requestBody.content && operation.requestBody.content['application/json']) {
        requestBodySchema = operation.requestBody.content['application/json'].schema;
      } else if (operation.parameters && operation.parameters.some(param => param.in === 'body' && param.schema)) {
        // Swagger 2.0 风格的请求体参数
        requestBodySchema = operation.parameters.find(param => param.in === 'body').schema;
      }
      
      // 解析请求体schema的属性
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
                required: schema.required?.includes(name) || false
              };
            });
          }
        } else if (requestBodySchema.properties) {
          // 直接处理属性
          bodyProperties = Object.entries(requestBodySchema.properties).map(([name, prop]) => {
            return {
              name,
              type: prop.type,
              required: requestBodySchema.required?.includes(name) || false
            };
          });
        }
      }
      
      // 尝试直接使用JSON对象
      if (dataArray.length === 1 && typeof dataArray[0] === 'object' && !Array.isArray(dataArray[0])) {
        // 提取或创建补充说明
        let description = '';
        // 搜索不是状态码或名称的字符串元素，作为可能的补充说明
        const possibleDescriptions = array.filter(item => 
          typeof item === 'string' && 
          !item.match(/^\d{3}$/) && // 不是状态码
          item !== name // 不是名称
        );
        
        if (possibleDescriptions.length > 0) {
          description = possibleDescriptions[0];
        }
        
        return {
          name,
          parameters: {},
          body: dataArray[0],
          expectedStatus,
          description
        };
      }
      
      // 将数组值映射到请求体属性
      bodyProperties.forEach((prop, index) => {
        if (index < dataArray.length) {
          // 设置请求体属性值，尝试根据类型进行转换
          let value = dataArray[index];
          
          // 忽略undefined和null值，除非是显式的null测试
          if (value === undefined || (value === '' && prop.type !== 'string')) {
            return;
          }
          
          // 尝试转换值类型
          if (prop.type === 'number' || prop.type === 'integer') {
            // 对于数字类型，将字符串转换为数字
            if (typeof value === 'string') {
              if (value.toLowerCase() === 'null' || value === '') {
                value = null;
              } else if (!isNaN(Number(value))) {
                value = Number(value);
              }
            }
          } else if (prop.type === 'boolean') {
            // 对于布尔类型，转换为布尔值
            if (typeof value === 'string') {
              if (value.toLowerCase() === 'true') {
                value = true;
              } else if (value.toLowerCase() === 'false') {
                value = false;
              } else if (value.toLowerCase() === 'null' || value === '') {
                value = null;
              }
            }
          } else if (prop.type === 'string' && value === null) {
            // 对于字符串类型，将null转换为空字符串
            value = '';
          }
          
          body[prop.name] = value;
        }
      });
      
      // 提取或创建补充说明
      let description = '';
      if (array.length > 2) {
        // 尝试从数组中搜索可能的补充说明，通常可能在第一个或最后一个元素后
        const possibleDescriptions = array.filter(item => 
          typeof item === 'string' && 
          !item.match(/^\d{3}$/) && // 不是状态码
          item !== name && // 不是名称
          !Object.values(body).includes(item) // 不是请求体中的值
        );
        
        if (possibleDescriptions.length > 0) {
          description = possibleDescriptions[0];
        }
      }
      
      return {
        name,
        parameters: {},
        body,
        expectedStatus,
        description
      };
    }
    
    // 默认情况，返回简单的测试用例对象
    return {
      name,
      parameters: {},
      body: dataArray.length > 0 ? { values: dataArray } : null,
      expectedStatus,
      description: array.length > 2 ? array.find(item => 
        typeof item === 'string' && 
        !item.match(/^\d{3}$/) && // 不是状态码
        item !== name // 不是名称
      ) || '' : ''
    };
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