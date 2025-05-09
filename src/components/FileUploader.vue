<template>
  <div class="file-uploader">
    <el-upload
      class="upload-demo"
      drag
      action="#"
      :auto-upload="false"
      :on-change="handleFileChange"
      :limit="1"
      :file-list="fileList"
      :multiple="false"
      :before-remove="handleBeforeRemove"
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽 Swagger 文件到此处，或 <em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持 JSON/YAML 格式的 Swagger 2.0/OpenAPI 3.0 文档
        </div>
      </template>
    </el-upload>
    
    <div class="upload-actions" v-if="fileList.length > 0">
      <el-button type="primary" @click="parseSwagger" :loading="loading">解析文档</el-button>
      <el-button @click="clearFile" :disabled="loading">清除</el-button>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="true"
      @close="error = ''"
      style="margin-top: 10px;"
    />
    
    <div v-if="loading" class="loading-container">
      <el-progress :percentage="parseProgress" :format="progressFormat" />
      <div class="parse-status">{{ parseStatus }}</div>
    </div>
    
    <div v-if="documentInfo.title" class="document-info">
      <h3>文档信息</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="标题">{{ documentInfo.title }}</el-descriptions-item>
        <el-descriptions-item label="版本">{{ documentInfo.version }}</el-descriptions-item>
        <el-descriptions-item label="描述" v-if="documentInfo.description">{{ documentInfo.description }}</el-descriptions-item>
        <el-descriptions-item label="格式">{{ documentInfo.format }}</el-descriptions-item>
        <el-descriptions-item label="API数量">{{ documentInfo.apiCount }}</el-descriptions-item>
        <el-descriptions-item label="模块数量">{{ documentInfo.tagCount }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import { parseSwaggerDoc } from '../utils/swaggerParser';
import { ElMessage, ElMessageBox } from 'element-plus';

const fileList = ref([]);
const error = ref('');
const loading = ref(false);
const parseProgress = ref(0);
const parseStatus = ref('');
const emit = defineEmits(['parsed']);

// 文档信息
const documentInfo = reactive({
  title: '',
  version: '',
  description: '',
  format: '',
  apiCount: 0,
  tagCount: 0
});

// 进度显示格式
const progressFormat = (percentage) => {
  return percentage === 100 ? '完成' : `${percentage}%`;
};

// 文件变更处理
const handleFileChange = (uploadFile) => {
  // 检查文件后缀名
  const fileName = uploadFile.name.toLowerCase();
  if (!fileName.endsWith('.json') && !fileName.endsWith('.yaml') && !fileName.endsWith('.yml')) {
    ElMessage.warning('请上传JSON或YAML格式的Swagger文档');
    return;
  }
  
  fileList.value = [uploadFile];
  error.value = '';
  
  // 清除文档信息
  Object.keys(documentInfo).forEach(key => {
    documentInfo[key] = '';
  });
  documentInfo.apiCount = 0;
  documentInfo.tagCount = 0;
};

// 确认删除文件
const handleBeforeRemove = () => {
  if (loading.value) {
    ElMessage.warning('正在解析中，请稍后再试');
    return false;
  }
  return true;
};

// 清除文件
const clearFile = () => {
  if (loading.value) return;
  
  fileList.value = [];
  error.value = '';
  
  // 清除文档信息
  Object.keys(documentInfo).forEach(key => {
    documentInfo[key] = '';
  });
  documentInfo.apiCount = 0;
  documentInfo.tagCount = 0;
  
  emit('parsed', null);
};

// 解析Swagger文档
const parseSwagger = async () => {
  if (fileList.value.length === 0) {
    error.value = '请先上传文件';
    return;
  }
  
  if (loading.value) return;

  try {
    loading.value = true;
    parseProgress.value = 0;
    error.value = '';
    
    const file = fileList.value[0].raw;
    
    if (!file) {
      error.value = '无法读取文件，请重新上传';
      loading.value = false;
      return;
    }
    
    // 检查文件大小
    if (file.size > 10 * 1024 * 1024) { // 10MB
      const confirmResult = await ElMessageBox.confirm(
        '文件大小超过10MB，解析可能需要较长时间，是否继续？',
        '文件较大',
        {
          confirmButtonText: '继续',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).catch(() => false);
      
      if (!confirmResult) {
        loading.value = false;
        return;
      }
    }
    
    // 模拟解析进度
    const progressInterval = setInterval(() => {
      if (parseProgress.value < 90) {
        parseProgress.value += 10;
        parseStatus.value = '正在解析文档...';
      }
    }, 300);
    
    // 解析文档
    const api = await parseSwaggerDoc(file).catch(err => {
      throw err;
    });
    
    clearInterval(progressInterval);
    parseProgress.value = 100;
    parseStatus.value = '解析完成';
    
    // 验证文档有效性
    if (!api) {
      error.value = '解析结果为空';
      loading.value = false;
      return;
    }
    
    if (!api.paths) {
      error.value = '无效的Swagger文档：缺少paths对象';
      loading.value = false;
      return;
    }
    
    // 获取并显示文档信息
    documentInfo.title = api.info?.title || '未知标题';
    documentInfo.version = api.info?.version || '未知版本';
    documentInfo.description = api.info?.description || '';
    documentInfo.format = api.swagger ? `Swagger ${api.swagger}` : api.openapi ? `OpenAPI ${api.openapi}` : '未知格式';
    
    // 计算API数量
    let apiCount = 0;
    for (const path in api.paths) {
      for (const method in api.paths[path]) {
        if (['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method.toLowerCase())) {
          apiCount++;
        }
      }
    }
    documentInfo.apiCount = apiCount;
    
    // 计算标签数量
    documentInfo.tagCount = Array.isArray(api.tags) ? api.tags.length : 0;
    
    ElMessage.success('文档解析成功');
    emit('parsed', api);
    
    // 1秒后隐藏加载状态
    setTimeout(() => {
      loading.value = false;
    }, 1000);
  } catch (err) {
    clearInterval(progressInterval);
    parseProgress.value = 0;
    error.value = '解析文档失败: ' + (err.message || '未知错误');
    console.error('解析失败:', err);
    loading.value = false;
  }
};
</script>

<style scoped>
.file-uploader {
  margin-bottom: 20px;
}

.upload-actions {
  margin-top: 15px;
  display: flex;
  gap: 10px;
}

.loading-container {
  margin-top: 20px;
}

.parse-status {
  margin-top: 5px;
  font-size: 14px;
  color: #606266;
  text-align: center;
}

.document-info {
  margin-top: 20px;
  background-color: #f8f9fa;
  padding: 15px;
  border-radius: 4px;
}

.document-info h3 {
  margin-top: 0;
  margin-bottom: 15px;
  color: #409EFF;
}

:deep(.el-upload-dragger) {
  width: 100%;
  height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

:deep(.el-upload__text) {
  margin-top: 10px;
}
</style> 