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
        />
        <el-select v-model="methodFilter" placeholder="请求方法" clearable style="width: 130px; margin-left: 10px;">
          <el-option v-for="method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']" :key="method" :label="method" :value="method" />
        </el-select>
        <el-select v-model="tagFilter" placeholder="标签" clearable style="width: 160px; margin-left: 10px;">
          <el-option v-for="tag in uniqueTags" :key="tag" :label="tag" :value="tag" />
        </el-select>
      </div>

      <el-table
        :data="filteredPaths"
        style="width: 100%; margin-top: 15px;"
        @row-click="handlePathSelect"
        row-key="path"
        :row-class-name="getRowClass"
        height="calc(100% - 60px)"
      >
        <el-table-column width="100">
          <template #default="scope">
            <el-tag :type="getMethodTagType(scope.row.method)">{{ scope.row.method }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="path" label="路径" min-width="250" show-overflow-tooltip />
        <el-table-column prop="summary" label="描述" min-width="200" show-overflow-tooltip />
      </el-table>
    </div>

    <!-- 右侧API详情 -->
    <div class="api-detail" v-if="selectedPath">
      <div class="api-detail-header">
        <div class="api-title">
          <el-tag :type="getMethodTagType(selectedPath.method)" size="large">{{ selectedPath.method }}</el-tag>
          <h2>{{ selectedPath.path }}</h2>
        </div>
        <el-button type="primary" @click="handleGenerateTest">生成测试用例</el-button>
      </div>
      
      <div class="api-description" v-if="selectedPath.description">
        <p>{{ selectedPath.description }}</p>
      </div>

      <!-- 顶部导航栏 -->
      <el-tabs v-model="activeTopTab" class="api-top-tabs">
        <el-tab-pane label="请求信息" name="request"></el-tab-pane>
        <el-tab-pane label="响应信息" name="response"></el-tab-pane>
      </el-tabs>

      <!-- 请求信息内容 -->
      <div v-if="activeTopTab === 'request'">
        <!-- 请求信息子选项卡 -->
        <el-tabs v-model="activeRequestTab" type="border-card" class="sub-tabs">
          <!-- 请求头 -->
          <el-tab-pane label="请求头" name="headers">
            <el-table :data="headerParams" border style="width: 100%">
              <el-table-column prop="name" label="参数名" width="200" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="required" label="必填" width="80" align="center">
                <template #default="scope">
                  <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                    {{ scope.row.required ? '✓' : '✗' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="120" />
            </el-table>
            <div v-if="headerParams.length === 0" class="empty-data">
              <el-empty description="无请求头参数" />
            </div>
          </el-tab-pane>

          <!-- 路径参数 -->
          <el-tab-pane label="路径参数" name="path">
            <el-table :data="pathParams" border style="width: 100%">
              <el-table-column prop="name" label="参数名" width="200" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="required" label="必填" width="80" align="center">
                <template #default="scope">
                  <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                    {{ scope.row.required ? '✓' : '✗' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="120" />
            </el-table>
            <div v-if="pathParams.length === 0" class="empty-data">
              <el-empty description="无路径参数" />
            </div>
          </el-tab-pane>

          <!-- 查询参数 -->
          <el-tab-pane label="查询参数" name="query">
            <el-table :data="queryParams" border style="width: 100%">
              <el-table-column prop="name" label="参数名" width="200" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="required" label="必填" width="80" align="center">
                <template #default="scope">
                  <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                    {{ scope.row.required ? '✓' : '✗' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="120" />
            </el-table>
            <div v-if="queryParams.length === 0" class="empty-data">
              <el-empty description="无查询参数" />
            </div>
          </el-tab-pane>

          <!-- 请求体 -->
          <el-tab-pane label="请求体" name="body">
            <el-table v-if="requestBodyFields.length > 0" :data="requestBodyFields" border style="width: 100%">
              <el-table-column prop="name" label="参数名" width="200" />
              <el-table-column prop="description" label="描述" min-width="200" />
              <el-table-column prop="required" label="必填" width="80" align="center">
                <template #default="scope">
                  <span :class="scope.row.required ? 'required-param' : 'optional-param'">
                    {{ scope.row.required ? '✓' : '✗' }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="type" label="类型" width="120" />
            </el-table>
            <div v-if="requestBodySchema" class="code-block">
              <div class="code-title">示例数据：</div>
              <pre class="json-content">{{ formatRequestBodyExample }}</pre>
            </div>
            <div v-if="!hasRequestBody" class="empty-data">
              <el-empty description="无请求体参数" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <!-- 响应信息内容 -->
      <div v-if="activeTopTab === 'response'" class="response-container">
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
              <div class="code-title">响应数据结构：</div>
              <div class="code-block">
                <pre class="json-content">{{ formatResponseExample(response) }}</pre>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </div>
    
    <div class="api-empty-state" v-else>
      <el-empty description="请选择一个API查看详细信息" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { extractPaths } from '../utils/swaggerParser';

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

// 提取API路径
onMounted(() => {
  if (props.api) {
    paths.value = extractPaths(props.api);
  }
});

// 监听API变化
watch(() => props.api, (newApi) => {
  if (newApi) {
    paths.value = extractPaths(newApi);
  } else {
    paths.value = [];
  }
}, { immediate: true });

// 获取所有唯一标签
const uniqueTags = computed(() => {
  const tags = new Set();
  paths.value.forEach(path => {
    path.tags.forEach(tag => tags.add(tag));
  });
  return Array.from(tags);
});

// 过滤路径
const filteredPaths = computed(() => {
  return paths.value.filter(path => {
    const matchesSearch = !searchQuery.value || 
      path.path.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      path.summary.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    const matchesMethod = !methodFilter.value || path.method === methodFilter.value;
    
    const matchesTag = !tagFilter.value || path.tags.includes(tagFilter.value);
    
    return matchesSearch && matchesMethod && matchesTag;
  });
});

// 处理路径选择
const handlePathSelect = (path) => {
  selectedPath.value = path;
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
  margin-bottom: 15px;
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

.api-description {
  margin-bottom: 20px;
  color: #666;
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
}

.code-title {
  font-weight: 500;
  margin-bottom: 8px;
  color: #606266;
}

.json-content {
  white-space: pre-wrap;
  font-family: monospace;
  margin: 0;
  font-size: 14px;
}

.response-description {
  margin-bottom: 10px;
  color: #666;
}

.empty-data {
  padding: 20px 0;
}

:deep(.selected-row) {
  background-color: var(--primary-light);
}
</style> 