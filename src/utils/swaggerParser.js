import yaml from 'js-yaml';

// 解析Swagger文档
export async function parseSwaggerDoc(file) {
  try {
    let content;
    const fileContent = await readFileAsText(file);
    
    // 判断是JSON还是YAML格式
    try {
      content = JSON.parse(fileContent);
    } catch (e) {
      try {
        content = yaml.load(fileContent);
      } catch (e2) {
        throw new Error('无效的Swagger文档格式，仅支持JSON或YAML');
      }
    }
    
    // 处理引用关系，但不使用swagger-parser
    const api = resolveReferences(content);
    return api;
  } catch (error) {
    console.error('解析Swagger文档时出错:', error);
    throw error;
  }
}

// 手动解析$ref引用
function resolveReferences(doc) {
  // 创建API文档的深拷贝，避免修改原始对象
  const api = JSON.parse(JSON.stringify(doc));
  
  // 确保definitions或components存在
  const definitions = api.definitions || (api.components ? api.components.schemas : {}) || {};
  
  // 处理路径对象中的引用
  if (api.paths) {
    for (const path in api.paths) {
      for (const method in api.paths[path]) {
        const operation = api.paths[path][method];
        
        // 处理参数中的引用
        if (operation.parameters) {
          operation.parameters.forEach((param, index) => {
            if (param.schema && param.schema.$ref) {
              operation.parameters[index].schema = resolveRef(param.schema.$ref, definitions);
            }
          });
        }
        
        // 处理请求体中的引用
        if (operation.requestBody && operation.requestBody.content) {
          for (const mediaType in operation.requestBody.content) {
            const content = operation.requestBody.content[mediaType];
            if (content.schema && content.schema.$ref) {
              content.schema = resolveRef(content.schema.$ref, definitions);
            }
          }
        }
        
        // 处理响应中的引用
        if (operation.responses) {
          for (const status in operation.responses) {
            const response = operation.responses[status];
            if (response.schema && response.schema.$ref) {
              response.schema = resolveRef(response.schema.$ref, definitions);
            }
          }
        }
      }
    }
  }
  
  return api;
}

// 解析$ref引用
function resolveRef(ref, definitions) {
  // 从引用路径中提取名称（例如从"#/definitions/User"中提取"User"）
  const refName = ref.split('/').pop();
  
  // 获取定义
  const definition = definitions[refName];
  if (!definition) {
    console.warn(`引用未找到: ${ref}`);
    return {}; // 返回空对象作为默认值
  }
  
  // 递归解析嵌套引用
  const result = JSON.parse(JSON.stringify(definition));
  
  // 处理属性中的引用
  if (result.properties) {
    for (const propName in result.properties) {
      const prop = result.properties[propName];
      if (prop.$ref) {
        result.properties[propName] = resolveRef(prop.$ref, definitions);
      }
    }
  }
  
  return result;
}

// 读取文件内容
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

// 提取API路径信息
export function extractPaths(api) {
  const pathsInfo = [];
  
  for (const path in api.paths) {
    for (const method in api.paths[path]) {
      const operation = api.paths[path][method];
      
      pathsInfo.push({
        path,
        method: method.toUpperCase(),
        summary: operation.summary || '',
        description: operation.description || '',
        operationId: operation.operationId || '',
        parameters: operation.parameters || [],
        requestBody: operation.requestBody || null,
        responses: operation.responses || {},
        tags: operation.tags || []
      });
    }
  }
  
  return pathsInfo;
}

// 生成测试用例
export function generateTestCases(api, pathInfo) {
  const testCases = [];
  const { path, method } = pathInfo;
  const operation = api.paths[path][method.toLowerCase()];
  
  // 获取请求参数和请求体信息
  const parameters = operation.parameters || [];
  const requestBodySchema = operation.requestBody?.content?.['application/json']?.schema;
  
  // 正常测试用例
  const normalCase = {
    name: '正常数据',
    parameters: {},
    expectedStatus: 200
  };
  
  // 处理路径参数、查询参数和请求头
  parameters.forEach(param => {
    if (param.in === 'path' || param.in === 'query' || param.in === 'header') {
      normalCase.parameters[param.name] = generateExampleValue(param.schema || param);
    }
  });
  
  // 处理请求体
  if (requestBodySchema) {
    normalCase.body = generateObjectFromSchema(requestBodySchema, api.definitions || (api.components ? api.components.schemas : {}));
  }
  
  testCases.push(normalCase);
  
  // 生成异常测试用例
  // 1. 必填参数缺失场景
  parameters.forEach(param => {
    if (param.required) {
      const missingCase = JSON.parse(JSON.stringify(normalCase));
      missingCase.name = `${param.name}参数缺失`;
      delete missingCase.parameters[param.name];
      missingCase.expectedStatus = 400;
      testCases.push(missingCase);
    }
  });
  
  // 2. 处理请求体中的必填项
  if (requestBodySchema && requestBodySchema.required) {
    requestBodySchema.required.forEach(propName => {
      const missingCase = JSON.parse(JSON.stringify(normalCase));
      missingCase.name = `请求体${propName}属性缺失`;
      if (missingCase.body) {
        delete missingCase.body[propName];
      }
      missingCase.expectedStatus = 400;
      testCases.push(missingCase);
    });
  }
  
  // 3. 数据类型错误场景
  parameters.forEach(param => {
    if (param.schema && param.schema.type) {
      const wrongTypeCase = JSON.parse(JSON.stringify(normalCase));
      wrongTypeCase.name = `${param.name}参数类型错误`;
      wrongTypeCase.parameters[param.name] = generateWrongTypeValue(param.schema);
      wrongTypeCase.expectedStatus = 400;
      testCases.push(wrongTypeCase);
    }
  });
  
  return testCases;
}

// 根据Schema生成示例对象
function generateObjectFromSchema(schema, definitions) {
  // 处理引用
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop();
    return generateObjectFromSchema(definitions[refName], definitions);
  }
  
  // 处理数组
  if (schema.type === 'array' && schema.items) {
    return [generateObjectFromSchema(schema.items, definitions)];
  }
  
  // 处理对象
  if (schema.type === 'object' || schema.properties) {
    const obj = {};
    for (const propName in schema.properties) {
      obj[propName] = generateObjectFromSchema(schema.properties[propName], definitions);
    }
    return obj;
  }
  
  // 处理基本类型
  return generateExampleValue(schema);
}

// 生成示例值
function generateExampleValue(schema) {
  if (!schema) return undefined;
  
  // 使用示例值（如果有）
  if (schema.example !== undefined) return schema.example;
  if (schema.examples && schema.examples.length > 0) return schema.examples[0];
  
  // 根据类型生成值
  switch (schema.type) {
    case 'string':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.format === 'date-time') return new Date().toISOString();
      if (schema.format === 'date') return new Date().toISOString().split('T')[0];
      if (schema.format === 'email') return 'test@example.com';
      return '测试数据';
    
    case 'number':
    case 'integer':
      if (schema.enum && schema.enum.length > 0) return schema.enum[0];
      if (schema.minimum !== undefined) return schema.minimum;
      return 1;
    
    case 'boolean':
      return true;
    
    case 'array':
      if (schema.items) {
        return [generateExampleValue(schema.items)];
      }
      return [];
    
    default:
      return undefined;
  }
}

// 生成错误类型的值
function generateWrongTypeValue(schema) {
  if (!schema || !schema.type) return 'wrong_type_value';
  
  switch (schema.type) {
    case 'string':
      return 123;
    case 'number':
    case 'integer':
      return 'not_a_number';
    case 'boolean':
      return 'not_a_boolean';
    case 'array':
      return 'not_an_array';
    default:
      return 'wrong_type_value';
  }
}

// 将测试用例转换为适合展示的格式
export function formatTestCasesForDisplay(testCases) {
  return testCases.map(testCase => {
    return {
      name: testCase.name,
      parameters: JSON.stringify(testCase.parameters, null, 2),
      body: testCase.body ? JSON.stringify(testCase.body, null, 2) : '',
      expectedStatus: testCase.expectedStatus
    };
  });
}

// 将测试用例转换为数组格式
export function convertTestCasesToArray(testCases, api, pathInfo) {
  const operation = api.paths[pathInfo.path][pathInfo.method.toLowerCase()];
  const parameters = operation.parameters || [];
  const requestBodySchema = operation.requestBody?.content?.['application/json']?.schema;
  
  // 确定数组中的字段顺序
  const paramNames = [];
  
  // 添加参数名称
  parameters.forEach(param => {
    if (param.in === 'path' || param.in === 'query') {
      paramNames.push(param.name);
    }
  });
  
  // 添加请求体字段
  if (requestBodySchema && requestBodySchema.properties) {
    Object.keys(requestBodySchema.properties).forEach(propName => {
      paramNames.push(propName);
    });
  }
  
  // 最后添加预期状态码
  paramNames.push('expectedStatus');
  
  // 转换为数组格式
  return testCases.map(testCase => {
    const row = [testCase.name];
    
    paramNames.forEach(paramName => {
      if (paramName === 'expectedStatus') {
        row.push(testCase.expectedStatus);
      } else if (testCase.parameters && testCase.parameters[paramName] !== undefined) {
        row.push(testCase.parameters[paramName]);
      } else if (testCase.body && testCase.body[paramName] !== undefined) {
        row.push(testCase.body[paramName]);
      } else {
        row.push('');
      }
    });
    
    return row;
  });
} 