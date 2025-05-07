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
    >
      <el-icon class="el-icon--upload"><upload-filled /></el-icon>
      <div class="el-upload__text">
        拖拽 Swagger 文件到此处，或 <em>点击上传</em>
      </div>
      <template #tip>
        <div class="el-upload__tip">
          支持 JSON/YAML 格式的 Swagger 2.0/3.0 文档
        </div>
      </template>
    </el-upload>
    
    <div class="upload-actions" v-if="fileList.length > 0">
      <el-button type="primary" @click="parseSwagger">解析文档</el-button>
      <el-button @click="clearFile">清除</el-button>
    </div>

    <el-alert
      v-if="error"
      :title="error"
      type="error"
      show-icon
      :closable="false"
      style="margin-top: 10px;"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { UploadFilled } from '@element-plus/icons-vue';
import { parseSwaggerDoc } from '../utils/swaggerParser';

const fileList = ref([]);
const error = ref('');
const emit = defineEmits(['parsed']);

// 文件变更处理
const handleFileChange = (uploadFile) => {
  fileList.value = [uploadFile];
  error.value = '';
};

// 清除文件
const clearFile = () => {
  fileList.value = [];
  error.value = '';
  emit('parsed', null);
};

// 解析Swagger文档
const parseSwagger = async () => {
  if (fileList.value.length === 0) {
    error.value = '请先上传文件';
    return;
  }

  try {
    error.value = '';
    const file = fileList.value[0].raw;
    const api = await parseSwaggerDoc(file);
    
    // 验证文档有效性
    if (!api || !api.paths) {
      error.value = '无效的Swagger文档：缺少paths对象';
      return;
    }
    
    emit('parsed', api);
  } catch (err) {
    error.value = '解析文档失败: ' + (err.message || '未知错误');
    console.error('解析失败:', err);
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
</style> 