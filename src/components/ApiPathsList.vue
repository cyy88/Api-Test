<template>
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
    >
      <el-table-column width="100">
        <template #default="scope">
          <el-tag :type="getMethodTagType(scope.row.method)">{{ scope.row.method }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="path" label="路径" min-width="250" show-overflow-tooltip />
      <el-table-column prop="summary" label="描述" min-width="200" show-overflow-tooltip />
      <el-table-column width="120">
        <template #default="scope">
          <el-button type="primary" size="small" plain @click.stop="handlePathSelect(scope.row)">
            生成测试用例
          </el-button>
        </template>
      </el-table-column>
    </el-table>
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
</script>

<style scoped>
.api-paths-list {
  margin-bottom: 20px;
}

.filter-container {
  display: flex;
  margin-bottom: 15px;
}

:deep(.selected-row) {
  background-color: var(--primary-light);
}
</style> 