<template>
  <div class="api-paths-container">
    <!-- 左侧API列表 -->
    <div class="api-paths-list">
      <div class="filter-container">
        <el-input
          v-model="searchQuery"
          placeholder="搜索API路径..."
          prefix-icon="Search"
          clearable
          @clear="handleClearSearch"
        />
        <el-select v-model="methodFilter" placeholder="请求方法" clearable style="width: 130px; margin-left: 10px;">
          <el-option v-for="method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']" :key="method" :label="method" :value="method">
            <el-tag :type="getMethodTagType(method)" size="small">{{ method }}</el-tag>
          </el-option>
        </el-select>
        <el-select v-model="tagFilter" placeholder="标签" clearable style="width: 160px; margin-left: 10px;">
          <el-option v-for="tag in uniqueTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
      </div>

      <div class="api-stats">
        <el-tag type="info" size="small">总接口数: {{ paths.length }}</el-tag>
        <el-tag type="info" size="small" v-if="filteredPaths.length !== paths.length">过滤结果: {{ filteredPaths.length }}</el-tag>
        <div class="method-stats">
          <el-tag type="success" size="small">GET: {{ countMethodTypes('GET') }}</el-tag>
          <el-tag type="primary" size="small">POST: {{ countMethodTypes('POST') }}</el-tag>
          <el-tag type="warning" size="small">PUT: {{ countMethodTypes('PUT') }}</el-tag>
          <el-tag type="danger" size="small">DELETE: {{ countMethodTypes('DELETE') }}</el-tag>
        </div>
      </div>

      <!-- 模块化展示API列表 -->
      <div class="module-container">
        <el-empty description="加载API列表中..." v-if="!isInitialized"></el-empty>
        <el-collapse v-model="activeModules" v-else>
          <el-collapse-item 
            v-for="(paths, moduleName) in groupedPaths" 
            :key="moduleName" 
            :title="getModuleTitle(moduleName, paths)"
            :name="moduleName"
          >
            <el-table
              :data="paths"
              style="width: 100%;"
              @row-click="handlePathSelect"
              row-key="path"
              :row-class-name="getRowClass"
              border
              size="small"
            >
              <el-table-column width="90">
                <template #default="scope">
                  <el-tag :type="getMethodTagType(scope.row.method)" size="small">{{ scope.row.method }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="path" label="路径" min-width="250" show-overflow-tooltip />
              <el-table-column prop="summary" label="描述" min-width="200" show-overflow-tooltip />
              <el-table-column width="80">
                <template #default="scope">
                  <el-button type="primary" size="small" circle plain @click.stop="copyPathInfo(scope.row)">
                    <el-icon><Document /></el-icon>
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 无模块划分时的展示 -->
      <div v-if="isInitialized && Object.keys(groupedPaths).length === 0" class="no-modules">
        <el-table
          :data="filteredPaths"
          style="width: 100%; margin-top: 15px;"
          @row-click="handlePathSelect"
          row-key="path"
          :row-class-name="getRowClass"
          height="calc(100% - 120px)"
          border
          size="small"
        >
          <el-table-column width="90">
            <template #default="scope">
              <el-tag :type="getMethodTagType(scope.row.method)" size="small">{{ scope.row.method }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="path" label="路径" min-width="250" show-overflow-tooltip />
          <el-table-column prop="summary" label="描述" min-width="200" show-overflow-tooltip />
          <el-table-column width="80">
            <template #default="scope">
              <el-button type="primary" size="small" circle plain @click.stop="copyPathInfo(scope.row)">
                <el-icon><Document /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 右侧API详情 -->
    <div class="api-detail" v-if="selectedPath">
      <div class="api-detail-header">
        <div class="api-title">
          <el-tag :type="getMethodTagType(selectedPath.method)" size="large">{{ selectedPath.method }}</el-tag>
          <h2>{{ selectedPath.path }}</h2>
          <el-button type="primary" size="small" circle plain @click="copyApiUrl">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </div>
        <el-button type="primary" @click="handleGenerateTest">生成测试用例</el-button>
      </div>
      
      <div class="api-module-info" v-if="selectedPath.tags && selectedPath.tags.length > 0">
        <div class="module-tag" v-for="tag in selectedPath.tags" :key="tag">{{ tag }}</div>
      </div>
      
      <div class="api-description" v-if="selectedPath.description || selectedPath.summary">
        <p>{{ selectedPath.description || selectedPath.summary }}</p>
      </div>

      <!-- 顶部导航栏 -->
      <el-tabs v-model="activeTopTab" class="api-top-tabs">
        <el-tab-pane label="请求信息" name="request">
          <!-- 请求信息子选项卡 -->
          <el-tabs v-model="activeRequestTab" type="border-card" class="sub-tabs">
            <!-- 请求头 -->
            <el-tab-pane label="请求头" name="headers">
              <el-table :data="headerParams" border style="width: 100%" size="small">
                <el-table-column prop="name" label="参数名" width="180" />
                <el-table-column prop="description" label="描述" min-width="180" />
                <el-table-column prop="required" label="必填" width="80" align="center">
                  <template #default="scope">
                    <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                      {{ scope.row.required ? '✓' : '✗' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column width="80">
                  <template #default="scope">
                    <el-button type="primary" size="small" circle plain @click="copyParam(scope.row)">
                      <el-icon><DocumentCopy /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="headerParams.length === 0" class="empty-data">
                <el-empty description="无请求头参数" />
              </div>
            </el-tab-pane>

            <!-- 路径参数 -->
            <el-tab-pane label="路径参数" name="path">
              <el-table :data="pathParams" border style="width: 100%" size="small">
                <el-table-column prop="name" label="参数名" width="180" />
                <el-table-column prop="description" label="描述" min-width="180" />
                <el-table-column prop="required" label="必填" width="80" align="center">
                  <template #default="scope">
                    <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                      {{ scope.row.required ? '✓' : '✗' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column width="80">
                  <template #default="scope">
                    <el-button type="primary" size="small" circle plain @click="copyParam(scope.row)">
                      <el-icon><DocumentCopy /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="pathParams.length === 0" class="empty-data">
                <el-empty description="无路径参数" />
              </div>
            </el-tab-pane>

            <!-- 查询参数 -->
            <el-tab-pane label="查询参数" name="query">
              <el-table :data="queryParams" border style="width: 100%" size="small">
                <el-table-column prop="name" label="参数名" width="180" />
                <el-table-column prop="description" label="描述" min-width="180" />
                <el-table-column prop="required" label="必填" width="80" align="center">
                  <template #default="scope">
                    <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                      {{ scope.row.required ? '✓' : '✗' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column width="80">
                  <template #default="scope">
                    <el-button type="primary" size="small" circle plain @click="copyParam(scope.row)">
                      <el-icon><DocumentCopy /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="queryParams.length === 0" class="empty-data">
                <el-empty description="无查询参数" />
              </div>
            </el-tab-pane>

            <!-- 请求体 -->
            <el-tab-pane label="请求体" name="body">
              <el-table v-if="requestBodyFields.length > 0" :data="requestBodyFields" border style="width: 100%" size="small">
                <el-table-column prop="name" label="参数名" width="180" />
                <el-table-column prop="description" label="描述" min-width="180" />
                <el-table-column prop="required" label="必填" width="80" align="center">
                  <template #default="scope">
                    <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                      {{ scope.row.required ? '✓' : '✗' }}
                    </span>
                  </template>
                </el-table-column>
                <el-table-column prop="type" label="类型" width="120" />
                <el-table-column width="80">
                  <template #default="scope">
                    <el-button type="primary" size="small" circle plain @click="copyParam(scope.row)">
                      <el-icon><DocumentCopy /></el-icon>
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <div v-if="requestBodySchema" class="code-block">
                <div class="code-title">
                  <span>示例数据：</span>
                  <el-button type="primary" size="small" plain @click="copyJsonExample(formatRequestBodyExample)">
                    复制 <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                </div>
                <pre class="json-content">{{ formatRequestBodyExample }}</pre>
              </div>
              <div v-if="!hasRequestBody" class="empty-data">
                <el-empty description="无请求体参数" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        
        <el-tab-pane label="响应信息" name="response">
          <el-tabs type="border-card">
            <el-tab-pane 
              v-for="(response, status) in selectedPath.responses"
              :key="status" 
              :label="getResponseStatusLabel(status, response)"
            >
              <div v-if="response.description" class="response-description">
                {{ response.description }}
              </div>
              <div v-if="getResponseSchema(response)" class="response-schema">
                <div class="code-title">
                  <span>响应数据结构：</span>
                  <el-button type="primary" size="small" plain @click="copyJsonExample(formatResponseExample(response))">
                    复制 <el-icon><DocumentCopy /></el-icon>
                  </el-button>
                </div>
                <div class="code-block">
                  <pre class="json-content">{{ formatResponseExample(response) }}</pre>
                </div>
              </div>
              <div v-if="!getResponseSchema(response)" class="empty-data">
                <el-empty description="无响应数据结构" />
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-tab-pane>
        
        <el-tab-pane label="调用示例" name="example">
          <div class="example-container">
            <div class="example-title">
              <h4>cURL 命令</h4>
              <el-button type="primary" size="small" plain @click="copyCurlCommand">
                复制 <el-icon><DocumentCopy /></el-icon>
              </el-button>
            </div>
            <pre class="curl-example">{{ generateCurlExample }}</pre>
            
            <el-divider></el-divider>
            
            <div class="example-title">
              <h4>JavaScript (Axios) 示例</h4>
              <el-button type="primary" size="small" plain @click="copyAxiosExample">
                复制 <el-icon><DocumentCopy /></el-icon>
              </el-button>
            </div>
            <pre class="code-example">{{ generateAxiosExample }}</pre>
            
            <el-divider></el-divider>
            
            <div class="example-title">
              <h4>Python (Requests) 示例</h4>
              <el-button type="primary" size="small" plain @click="copyPythonExample">
                复制 <el-icon><DocumentCopy /></el-icon>
              </el-button>
            </div>
            <pre class="code-example">{{ generatePythonExample }}</pre>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
    
    <div class="api-empty-state" v-else>
      <el-empty description="请选择一个API查看详细信息" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Search, Document, DocumentCopy } from '@element-plus/icons-vue';
import { extractPaths } from '../utils/swaggerParser';
import { ElMessage } from 'element-plus';

const props = defineProps({
  api: {
    type: Object,
    required: true
  }
});

const emit = defineEmits(['select-path']);

const paths = ref([]);
const searchQuery = ref('');
const methodFilter = ref('');
const tagFilter = ref('');
const selectedPath = ref(null);
const activeTopTab = ref('request');
const activeRequestTab = ref('headers');
const activeModules = ref([]);  // 控制展开的模块
const isInitialized = ref(false);

// 获取并更新活动模块的辅助函数 - 移到顶部，确保在使用前定义
const updateActiveModules = () => {
  // 直接计算模块列表，不依赖computed属性
  const grouped = {};
  paths.value.forEach(path => {
    if (path && path.tags && Array.isArray(path.tags) && path.tags.length > 0) {
      const moduleName = path.tags[0];
      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }
      grouped[moduleName].push(path);
    } else {
      const moduleName = '未分类';
      if (!grouped[moduleName]) {
        grouped[moduleName] = [];
      }
      grouped[moduleName].push(path);
    }
  });
  
  const modules = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
  activeModules.value = modules.slice(0, 5); // 默认展开前5个模块
};

// 提取API路径
onMounted(() => {
  if (props.api) {
    paths.value = extractPaths(props.api);
    // 更新活动模块
    updateActiveModules();
    isInitialized.value = true;
  }
});

// 监听API变化
watch(() => props.api, (newApi) => {
  if (newApi) {
    paths.value = extractPaths(newApi);
    // 更新活动模块
    updateActiveModules();
    isInitialized.value = true;
  } else {
    paths.value = [];
    activeModules.value = [];
    isInitialized.value = false;
  }
}, { immediate: true });

// 获取所有唯一标签
const uniqueTags = computed(() => {
  const tags = new Set();
  paths.value.forEach(path => {
    if (path.tags && Array.isArray(path.tags)) {
      path.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags);
});

// 过滤路径
const filteredPaths = computed(() => {
  return paths.value.filter(path => {
    const matchesSearch = !searchQuery.value || 
      path.path.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      (path.summary && path.summary.toLowerCase().includes(searchQuery.value.toLowerCase()));
    
    const matchesMethod = !methodFilter.value || path.method === methodFilter.value;
    
    const matchesTag = !tagFilter.value || (path.tags && Array.isArray(path.tags) && path.tags.includes(tagFilter.value));
    
    return matchesSearch && matchesMethod && matchesTag;
  });
});

// 将API路径按模块分组
const groupedPaths = computed(() => {
  const grouped = {};
  
  filteredPaths.value.forEach(path => {
    // 使用第一个标签作为模块名，如果没有标签则归为"未分类"
    const moduleName = path.tags && Array.isArray(path.tags) && path.tags.length > 0 ? path.tags[0] : '未分类';
    
    if (!grouped[moduleName]) {
      grouped[moduleName] = [];
    }
    
    grouped[moduleName].push(path);
  });
  
  // 按模块名排序
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  );
});

// 处理路径选择
const handlePathSelect = (path) => {
  selectedPath.value = path;
  // 默认切换到请求信息标签页
  activeTopTab.value = 'request';
  emit('select-path', path);
};

// 生成测试用例按钮点击事件
const handleGenerateTest = () => {
  if (selectedPath.value) {
    emit('select-path', selectedPath.value);
  }
};

// 获取行样式
const getRowClass = ({ row }) => {
  if (selectedPath.value && selectedPath.value.path === row.path && selectedPath.value.method === row.method) {
    return 'selected-row';
  }
  return '';
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

// 获取响应状态标签
const getResponseStatusLabel = (status, response) => {
  let statusLabel = status;
  if (status >= 200 && status < 300) {
    statusLabel = `${status} (成功)`;
  } else if (status >= 400 && status < 500) {
    statusLabel = `${status} (客户端错误)`;
  } else if (status >= 500) {
    statusLabel = `${status} (服务器错误)`;
  }
  return statusLabel;
};

// 参数类型计算属性
const pathParams = computed(() => {
  if (!selectedPath.value) return [];
  return selectedPath.value.parameters.filter(param => param.in === 'path').map(param => ({
    name: param.name,
    description: param.description || '',
    required: !!param.required,
    type: getParameterType(param)
  }));
});

const queryParams = computed(() => {
  if (!selectedPath.value) return [];
  return selectedPath.value.parameters.filter(param => param.in === 'query').map(param => ({
    name: param.name,
    description: param.description || '',
    required: !!param.required,
    type: getParameterType(param)
  }));
});

const headerParams = computed(() => {
  if (!selectedPath.value) return [];
  return selectedPath.value.parameters.filter(param => param.in === 'header').map(param => ({
    name: param.name,
    description: param.description || '',
    required: !!param.required,
    type: getParameterType(param)
  }));
});

// 请求体相关计算属性
const hasRequestBody = computed(() => {
  if (!selectedPath.value) return false;
  return !!selectedPath.value.requestBody || selectedPath.value.parameters.some(param => param.in === 'body');
});

const requestBodySchema = computed(() => {
  if (!selectedPath.value) return null;
  
  // 处理OpenAPI 3.0格式的请求体
  if (selectedPath.value.requestBody && selectedPath.value.requestBody.content) {
    const content = selectedPath.value.requestBody.content;
    const jsonContent = content['application/json'];
    if (jsonContent && jsonContent.schema) {
      return jsonContent.schema;
    }
  }
  
  // 处理Swagger 2.0格式的请求体
  const bodyParam = selectedPath.value.parameters.find(param => param.in === 'body');
  if (bodyParam && bodyParam.schema) {
    return bodyParam.schema;
  }
  
  return null;
});

const requestBodyFields = computed(() => {
  if (!requestBodySchema.value) return [];
  
  const schema = requestBodySchema.value;
  const fields = [];
  
  // 如果schema是引用类型，可能需要在此处解析引用
  if (schema.properties) {
    const requiredProps = schema.required || [];
    
    // 遍历属性
    Object.entries(schema.properties).forEach(([propName, propSchema]) => {
      fields.push({
        name: propName,
        description: propSchema.description || '',
        required: requiredProps.includes(propName),
        type: getSchemaType(propSchema)
      });
    });
  }
  
  return fields;
});

const formatRequestBodyExample = computed(() => {
  if (!requestBodySchema.value) return '';
  
  // 创建示例数据对象
  const example = {};
  
  if (requestBodySchema.value.properties) {
    Object.entries(requestBodySchema.value.properties).forEach(([propName, propSchema]) => {
      example[propName] = getExampleValue(propSchema);
    });
  }
  
  return JSON.stringify(example, null, 2);
});

// 获取参数类型
const getParameterType = (param) => {
  if (param.schema) {
    return getSchemaType(param.schema);
  }
  return param.type || '未知';
};

// 获取schema类型
const getSchemaType = (schema) => {
  if (!schema) return '未知';
  
  if (schema.type === 'array' && schema.items) {
    return `${schema.type}<${getSchemaType(schema.items)}>`;
  }
  
  if (schema.enum) {
    return `enum(${schema.enum.join('|')})`;
  }
  
  return schema.type || '对象';
};

// 获取属性示例值
const getExampleValue = (schema) => {
  if (!schema) return null;
  
  // 使用示例值（如果有）
  if (schema.example !== undefined) return schema.example;
  if (schema.examples && schema.examples.length > 0) return schema.examples[0];
  
  // 根据类型生成值
  switch (schema.type) {
    case 'string':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().split('T')[0];
      return 'string';
    case 'number':
    case 'integer':
      if (schema.format === 'int32') return 0;
      if (schema.format === 'int64') return 0;
      if (schema.format === 'float') return 0.0;
      if (schema.format === 'double') return 0.0;
      return 0;
    case 'boolean':
      return false;
    case 'array':
      if (schema.items) {
        return [getExampleValue(schema.items)];
      }
      return [];
    case 'object':
      if (schema.properties) {
        const obj = {};
        Object.entries(schema.properties).forEach(([name, prop]) => {
          obj[name] = getExampleValue(prop);
        });
        return obj;
      }
      return {};
    default:
      return null;
  }
};

// 获取响应数据模式
const getResponseSchema = (response) => {
  // OpenAPI 3.0
  if (response.content && response.content['application/json'] && response.content['application/json'].schema) {
    return response.content['application/json'].schema;
  }
  // Swagger 2.0
  return response.schema;
};

// 格式化响应示例
const formatResponseExample = (response) => {
  const schema = getResponseSchema(response);
  if (!schema) return '';
  
  // 创建响应示例
  return JSON.stringify(generateExampleFromSchema(schema), null, 2);
};

// 从schema生成示例
const generateExampleFromSchema = (schema) => {
  if (!schema) return null;
  
  // 处理引用（这里简化处理）
  if (schema.$ref) {
    // 在实际应用中，需要查找引用模型
    return { "引用对象": "此处引用了其他模型" };
  }
  
  // 处理特殊类型
  if (schema.type === 'array' && schema.items) {
    return [generateExampleFromSchema(schema.items)];
  }
  
  if (schema.type === 'object' || schema.properties) {
    const example = {};
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([propName, propSchema]) => {
        example[propName] = getExampleValue(propSchema);
      });
    }
    return example;
  }
  
  return getExampleValue(schema);
};

// 获取模块标题，包含接口数量和请求方法统计
const getModuleTitle = (moduleName, modulePaths) => {
  const methodCounts = {
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
    PATCH: 0
  };
  
  modulePaths.forEach(path => {
    if (methodCounts[path.method] !== undefined) {
      methodCounts[path.method]++;
    }
  });
  
  // 格式化标题
  return `${moduleName} (${modulePaths.length}) - GET:${methodCounts.GET} POST:${methodCounts.POST} PUT:${methodCounts.PUT} DELETE:${methodCounts.DELETE}`;
};

// 复制路径信息
const copyPathInfo = (path) => {
  const pathInfo = `${path.method} ${path.path} - ${path.summary || ''}`;
  navigator.clipboard.writeText(pathInfo).then(() => {
    ElMessage.success('已复制接口信息到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  });
};

// 复制API URL
const copyApiUrl = () => {
  if (!selectedPath.value) return;
  
  const pathText = selectedPath.value.path;
  navigator.clipboard.writeText(pathText).then(() => {
    ElMessage.success('已复制API路径到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  });
};

// 复制参数信息
const copyParam = (param) => {
  const paramInfo = JSON.stringify(param, null, 2);
  navigator.clipboard.writeText(paramInfo).then(() => {
    ElMessage.success(`已复制参数 ${param.name} 信息到剪贴板`);
  }).catch(err => {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  });
};

// 复制JSON示例
const copyJsonExample = (jsonStr) => {
  navigator.clipboard.writeText(jsonStr).then(() => {
    ElMessage.success('已复制JSON示例到剪贴板');
  }).catch(err => {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  });
};

// 统计接口方法类型数量
const countMethodTypes = (method) => {
  return paths.value.filter(path => path.method === method).length;
};

// 处理搜索框清空
const handleClearSearch = () => {
  searchQuery.value = '';
  methodFilter.value = '';
  tagFilter.value = '';
};

// 生成cURL命令示例
const generateCurlExample = computed(() => {
  if (!selectedPath.value) return '';
  
  const { method, path } = selectedPath.value;
  let curl = `curl -X ${method} "https://api.example.com${path}"`;
  
  // 添加请求头
  if (headerParams.value.length > 0) {
    headerParams.value.forEach(param => {
      curl += `\n     -H "${param.name}: ${getExampleValueForHeader(param)}"`;
    });
  }
  
  // 添加内容类型头
  if (hasRequestBody.value) {
    curl += `\n     -H "Content-Type: application/json"`;
  }
  
  // 添加路径参数（替换URL中的参数）
  let apiPath = path;
  if (pathParams.value.length > 0) {
    pathParams.value.forEach(param => {
      const placeholder = `{${param.name}}`;
      apiPath = apiPath.replace(placeholder, getExampleValueAsString(param));
    });
  }
  
  // 添加查询参数
  if (queryParams.value.length > 0) {
    const queryStrings = queryParams.value.map(param => `${param.name}=${getExampleValueAsString(param)}`);
    apiPath += `?${queryStrings.join('&')}`;
  }
  
  // 更新路径
  if (apiPath !== path) {
    curl = `curl -X ${method} "https://api.example.com${apiPath}"`;
    
    // 重新添加请求头
    if (headerParams.value.length > 0) {
      headerParams.value.forEach(param => {
        curl += `\n     -H "${param.name}: ${getExampleValueForHeader(param)}"`;
      });
    }
    
    // 添加内容类型头
    if (hasRequestBody.value) {
      curl += `\n     -H "Content-Type: application/json"`;
    }
  }
  
  // 添加请求体
  if (hasRequestBody.value && formatRequestBodyExample.value) {
    curl += `\n     -d '${formatRequestBodyExample.value}'`;
  }
  
  return curl;
});

// 生成Axios调用示例
const generateAxiosExample = computed(() => {
  if (!selectedPath.value) return '';
  
  const { method, path } = selectedPath.value;
  let code = `import axios from 'axios';\n\n`;
  code += `// API调用函数\nasync function callApi() {\n  try {\n`;
  
  // 生成请求配置
  code += `    const config = {\n`;
  code += `      method: '${method.toLowerCase()}',\n`;
  
  // 处理URL和路径参数
  let apiPath = path;
  if (pathParams.value.length > 0) {
    pathParams.value.forEach(param => {
      const placeholder = `{${param.name}}`;
      apiPath = apiPath.replace(placeholder, `\${${param.name}}`);
    });
    
    // 添加路径参数变量
    code += `      url: \`https://api.example.com${apiPath}\`,\n`;
    
    // 定义变量
    code = `// 定义路径参数\n`;
    pathParams.value.forEach(param => {
      code += `const ${param.name} = ${getExampleValueAsCode(param)};\n`;
    });
    code += `\nimport axios from 'axios';\n\n`;
    code += `// API调用函数\nasync function callApi() {\n  try {\n`;
    code += `    const config = {\n`;
    code += `      method: '${method.toLowerCase()}',\n`;
    code += `      url: \`https://api.example.com${apiPath}\`,\n`;
  } else {
    code += `      url: 'https://api.example.com${path}',\n`;
  }
  
  // 添加请求头
  if (headerParams.value.length > 0) {
    code += `      headers: {\n`;
    headerParams.value.forEach(param => {
      code += `        '${param.name}': ${getExampleValueAsCode(param)},\n`;
    });
    if (hasRequestBody.value) {
      code += `        'Content-Type': 'application/json',\n`;
    }
    code += `      },\n`;
  } else if (hasRequestBody.value) {
    code += `      headers: {\n`;
    code += `        'Content-Type': 'application/json',\n`;
    code += `      },\n`;
  }
  
  // 添加查询参数
  if (queryParams.value.length > 0) {
    code += `      params: {\n`;
    queryParams.value.forEach(param => {
      code += `        ${param.name}: ${getExampleValueAsCode(param)},\n`;
    });
    code += `      },\n`;
  }
  
  // 添加请求体
  if (hasRequestBody.value && requestBodySchema.value) {
    // 构造请求体对象
    code += `      data: {\n`;
    if (requestBodySchema.value.properties) {
      Object.entries(requestBodySchema.value.properties).forEach(([propName, propSchema]) => {
        code += `        ${propName}: ${JSON.stringify(getExampleValue(propSchema))},\n`;
      });
    }
    code += `      },\n`;
  }
  
  code += `    };\n\n`;
  code += `    const response = await axios(config);\n`;
  code += `    console.log('成功:', response.data);\n`;
  code += `    return response.data;\n`;
  code += `  } catch (error) {\n`;
  code += `    console.error('失败:', error.response ? error.response.data : error.message);\n`;
  code += `    throw error;\n`;
  code += `  }\n`;
  code += `}\n\n`;
  code += `// 调用API\ncallApi();`;
  
  return code;
});

// 生成Python请求示例
const generatePythonExample = computed(() => {
  if (!selectedPath.value) return '';
  
  const { method, path } = selectedPath.value;
  let code = `import requests\nimport json\n\n`;
  
  // 基础URL
  code += `base_url = "https://api.example.com"\n`;
  
  // 处理路径参数
  let apiPath = path;
  if (pathParams.value.length > 0) {
    // 定义路径参数变量
    code += `\n# 路径参数\n`;
    pathParams.value.forEach(param => {
      code += `${param.name} = ${getExampleValueAsPython(param)}\n`;
    });
    
    // 替换路径中的参数
    code += `\n# 构建URL\n`;
    code += `endpoint = f"${apiPath.replace(/\{([^}]+)\}/g, '{$1}')}"\n`;
    code += `url = base_url + endpoint\n\n`;
  } else {
    code += `\n# API端点\n`;
    code += `url = base_url + "${path}"\n\n`;
  }
  
  // 添加请求头
  if (headerParams.value.length > 0 || hasRequestBody.value) {
    code += `# 请求头\nheaders = {\n`;
    headerParams.value.forEach(param => {
      code += `    "${param.name}": ${getExampleValueAsPython(param)},\n`;
    });
    if (hasRequestBody.value) {
      code += `    "Content-Type": "application/json",\n`;
    }
    code += `}\n\n`;
  }
  
  // 添加查询参数
  if (queryParams.value.length > 0) {
    code += `# 查询参数\nparams = {\n`;
    queryParams.value.forEach(param => {
      code += `    "${param.name}": ${getExampleValueAsPython(param)},\n`;
    });
    code += `}\n\n`;
  } else {
    code += `params = {}\n\n`;
  }
  
  // 添加请求体
  if (hasRequestBody.value && requestBodySchema.value) {
    code += `# 请求体\ndata = {\n`;
    if (requestBodySchema.value.properties) {
      Object.entries(requestBodySchema.value.properties).forEach(([propName, propSchema]) => {
        code += `    "${propName}": ${getExampleValueAsPython(propSchema)},\n`;
      });
    }
    code += `}\n\n`;
  }
  
  // 发送请求
  code += `# 发送请求\ntry:\n`;
  
  if (hasRequestBody.value) {
    if (method.toLowerCase() === 'get') {
      // GET方法通常不带请求体
      code += `    response = requests.${method.toLowerCase()}(url, headers=headers, params=params)\n`;
    } else {
      code += `    response = requests.${method.toLowerCase()}(url, headers=headers, params=params, json=data)\n`;
    }
  } else if (headerParams.value.length > 0) {
    code += `    response = requests.${method.toLowerCase()}(url, headers=headers, params=params)\n`;
  } else {
    code += `    response = requests.${method.toLowerCase()}(url, params=params)\n`;
  }
  
  // 处理响应
  code += `    \n    # 处理响应\n`;
  code += `    response.raise_for_status()  # 如果响应状态码不是2xx，抛出异常\n`;
  code += `    print(f"状态码: {response.status_code}")\n`;
  code += `    print("响应内容:")\n`;
  code += `    print(json.dumps(response.json(), indent=4, ensure_ascii=False))\n`;
  code += `    \n    return response.json()\n`;
  code += `except requests.exceptions.HTTPError as errh:\n`;
  code += `    print(f"HTTP错误: {errh}")\n`;
  code += `except requests.exceptions.ConnectionError as errc:\n`;
  code += `    print(f"连接错误: {errc}")\n`;
  code += `except requests.exceptions.Timeout as errt:\n`;
  code += `    print(f"请求超时: {errt}")\n`;
  code += `except requests.exceptions.RequestException as err:\n`;
  code += `    print(f"请求异常: {err}")\n`;
  
  return code;
});

// 复制cURL命令
const copyCurlCommand = () => {
  copyToClipboard(generateCurlExample.value, '已复制cURL命令到剪贴板');
};

// 复制Axios示例
const copyAxiosExample = () => {
  copyToClipboard(generateAxiosExample.value, '已复制Axios示例代码到剪贴板');
};

// 复制Python示例
const copyPythonExample = () => {
  copyToClipboard(generatePythonExample.value, '已复制Python示例代码到剪贴板');
};

// 通用复制函数
const copyToClipboard = (text, successMsg) => {
  navigator.clipboard.writeText(text).then(() => {
    ElMessage.success(successMsg);
  }).catch(err => {
    console.error('复制失败:', err);
    ElMessage.error('复制失败');
  });
};

// 为请求头生成示例值
const getExampleValueForHeader = (param) => {
  if (param.name.toLowerCase() === 'authorization') {
    return 'Bearer YOUR_ACCESS_TOKEN';
  }
  return getExampleValueAsString(param);
};

// 将示例值转换为字符串
const getExampleValueAsString = (param) => {
  if (param.type === 'string') {
    return 'example_value';
  } else if (param.type === 'number' || param.type === 'integer') {
    return '123';
  } else if (param.type === 'boolean') {
    return 'true';
  }
  return 'example_value';
};

// 将示例值转换为JS代码中的形式
const getExampleValueAsCode = (param) => {
  if (param.type === 'string') {
    return "'example_value'";
  } else if (param.type === 'number' || param.type === 'integer') {
    return '123';
  } else if (param.type === 'boolean') {
    return 'true';
  }
  return "'example_value'";
};

// 将示例值转换为Python代码中的形式
const getExampleValueAsPython = (param) => {
  if (param.type === 'string') {
    return '"example_value"';
  } else if (param.type === 'number' || param.type === 'integer') {
    return '123';
  } else if (param.type === 'boolean') {
    return 'True';
  } else if (param.type === 'object') {
    return '{}';
  } else if (param.type === 'array') {
    return '[]';
  }
  return '"example_value"';
};
</script>

<style scoped>
.api-paths-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  height: 100%;
  overflow: hidden;
}

.api-paths-list {
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.filter-container {
  display: flex;
  margin-bottom: 10px;
}

.api-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 15px;
}

.method-stats {
  display: flex;
  gap: 10px;
}

.module-container {
  flex: 1;
  overflow: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.no-modules {
  flex: 1;
  overflow: auto;
}

.api-detail, .api-empty-state {
  padding: 15px;
  border-left: 1px solid #e0e0e0;
  height: 100%;
  overflow: auto;
}

.api-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.api-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.api-title h2 {
  margin: 0;
  font-size: 18px;
}

.api-module-info {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.module-tag {
  padding: 4px 8px;
  background-color: #f2f6fc;
  color: #409EFF;
  border-radius: 4px;
  font-size: 13px;
}

.api-description {
  margin-bottom: 20px;
  color: #666;
  background-color: #f8f9fa;
  padding: 10px;
  border-radius: 4px;
}

.api-top-tabs {
  margin-bottom: 20px;
}

.sub-tabs {
  margin-bottom: 20px;
}

.api-param-section {
  margin-bottom: 20px;
}

.required-param {
  color: #F56C6C;
  font-weight: bold;
}

.optional-param {
  color: #67C23A;
}

.code-block {
  background-color: #f5f7fa;
  border-radius: 4px;
  padding: 10px;
  margin-top: 10px;
  position: relative;
}

.code-title {
  font-weight: 500;
  margin-bottom: 8px;
  color: #606266;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.json-content, .curl-example, .code-example {
  white-space: pre-wrap;
  font-family: monospace;
  margin: 0;
  font-size: 14px;
  max-height: 400px;
  overflow: auto;
}

.response-description {
  margin-bottom: 10px;
  color: #666;
}

.example-container {
  padding: 10px;
}

.example-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.example-title h4 {
  margin: 0;
  font-size: 16px;
  color: #606266;
}

.curl-example {
  background-color: #f5f7fa;
  padding: 10px;
  border-radius: 4px;
}

.param-item {
  margin-bottom: 4px;
}

.param-name {
  font-weight: 500;
  color: #606266;
  margin-right: 5px;
}

.param-value {
  color: #909399;
}

.empty-data {
  padding: 20px 0;
}

:deep(.selected-row) {
  background-color: var(--el-color-primary-light-9);
}

:deep(.el-collapse-item__header) {
  font-weight: bold;
  background-color: #f5f7fa;
}

:deep(.el-collapse-item__content) {
  padding-top: 15px;
}
</style> 