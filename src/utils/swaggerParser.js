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
    
    // 检查是否为有效的Swagger/OpenAPI文档
    if (!content || (!content.swagger && !content.openapi)) {
      throw new Error('不是有效的Swagger/OpenAPI文档，缺少swagger或openapi字段');
    }
    
    // 标准化文档结构
    normalizeSwaggerDocument(content);
    
    // 处理引用关系
    const api = resolveReferences(content);
    return api;
  } catch (error) {
    console.error('解析Swagger文档时出错:', error);
    throw error;
  }
}

// 标准化不同版本的Swagger/OpenAPI文档结构
function normalizeSwaggerDocument(doc) {
  // 确保paths对象存在
  if (!doc.paths) {
    doc.paths = {};
  }
  
  // 确保tags数组存在
  if (!doc.tags) {
    doc.tags = [];
  }
  
  // 对于OpenAPI 3.0，确保components存在
  if (doc.openapi && !doc.components) {
    doc.components = { schemas: {} };
  }
  
  // 对于Swagger 2.0，确保definitions存在
  if (doc.swagger && !doc.definitions) {
    doc.definitions = {};
  }
  
  // 处理路径操作对象
  for (const path in doc.paths) {
    const pathItem = doc.paths[path];
    
    // 跳过空的路径项
    if (!pathItem) continue;
    
    // 处理各种HTTP方法
    ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].forEach(method => {
      if (pathItem[method]) {
        const operation = pathItem[method];
        
        // 确保操作对象有基本属性
        if (!operation.responses) operation.responses = {};
        if (!operation.parameters) operation.parameters = [];
        if (!operation.tags) operation.tags = [];
        
        // 为没有标签的操作添加默认标签
        if (operation.tags.length === 0) {
          operation.tags.push('默认');
        }
      }
    });
  }
}

// 手动解析$ref引用
function resolveReferences(doc) {
  try {
    // 创建API文档的深拷贝，避免修改原始对象
    const api = JSON.parse(JSON.stringify(doc));
    
    // 确定定义的位置（Swagger 2.0用definitions，OpenAPI 3.0用components.schemas）
    const definitions = api.definitions || (api.components ? api.components.schemas : {}) || {};
    const isOpenApi3 = !!api.openapi;
    
    // 处理路径对象中的引用
    if (api.paths) {
      for (const path in api.paths) {
        const pathItem = api.paths[path];
        if (!pathItem) continue;
        
        for (const method in pathItem) {
          // 跳过非HTTP方法属性
          if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
            continue;
          }
          
          const operation = pathItem[method];
          if (!operation) continue;
          
          try {
            // 处理参数中的引用
            if (operation.parameters) {
              operation.parameters.forEach((param, index) => {
                try {
                  if (param && param.schema && param.schema.$ref) {
                    operation.parameters[index].schema = resolveRef(param.schema.$ref, definitions);
                  }
                } catch (err) {
                  console.warn(`解析参数引用时出错 [${path}][${method}]:`, err);
                }
              });
            }
            
            // 处理请求体中的引用 (OpenAPI 3.0)
            if (isOpenApi3 && operation.requestBody && operation.requestBody.content) {
              for (const mediaType in operation.requestBody.content) {
                try {
                  const content = operation.requestBody.content[mediaType];
                  if (content && content.schema && content.schema.$ref) {
                    content.schema = resolveRef(content.schema.$ref, definitions);
                  }
                } catch (err) {
                  console.warn(`解析请求体引用时出错 [${path}][${method}]:`, err);
                }
              }
            }
            
            // 处理响应中的引用
            if (operation.responses) {
              for (const status in operation.responses) {
                try {
                  const response = operation.responses[status];
                  
                  // OpenAPI 3.0 格式
                  if (isOpenApi3 && response && response.content) {
                    for (const mediaType in response.content) {
                      const content = response.content[mediaType];
                      if (content && content.schema && content.schema.$ref) {
                        content.schema = resolveRef(content.schema.$ref, definitions);
                      }
                    }
                  }
                  // Swagger 2.0 格式
                  else if (response && response.schema && response.schema.$ref) {
                    response.schema = resolveRef(response.schema.$ref, definitions);
                  }
                } catch (err) {
                  console.warn(`解析响应引用时出错 [${path}][${method}][${status}]:`, err);
                }
              }
            }
          } catch (err) {
            console.warn(`解析操作引用时出错 [${path}][${method}]:`, err);
          }
        }
      }
    }
    
    return api;
  } catch (error) {
    console.error('解析引用关系时出错:', error);
    // 返回原始文档，避免完全失败
    return doc;
  }
}

// 解析$ref引用
function resolveRef(ref, definitions) {
  try {
    if (!ref) return {};
    
    // 从引用路径中提取名称（例如从"#/definitions/User"中提取"User"）
    const parts = ref.split('/');
    const refName = parts.pop();
    
    // 获取定义
    const definition = definitions[refName];
    if (!definition) {
      console.warn(`引用未找到: ${ref}`);
      return {}; // 返回空对象作为默认值
    }
    
    // 避免递归引用导致的无限循环
    if (definition.$recursiveRef === ref) {
      return { type: 'object', description: '递归引用对象' };
    }
    
    // 标记此定义已被处理，防止循环引用
    const result = JSON.parse(JSON.stringify(definition));
    result.$recursiveRef = ref;
    
    // 处理属性中的引用
    if (result.properties) {
      for (const propName in result.properties) {
        const prop = result.properties[propName];
        if (prop && prop.$ref) {
          // 避免自引用
          if (prop.$ref === ref) {
            result.properties[propName] = { type: 'object', description: '自引用对象' };
          } else {
            try {
              result.properties[propName] = resolveRef(prop.$ref, definitions);
            } catch (err) {
              console.warn(`解析属性引用时出错 [${propName}]:`, err);
              result.properties[propName] = { type: 'object', description: '引用解析失败' };
            }
          }
        }
      }
    }
    
    // 处理数组项中的引用
    if (result.items && result.items.$ref) {
      try {
        // 避免自引用
        if (result.items.$ref === ref) {
          result.items = { type: 'object', description: '自引用对象' };
        } else {
          result.items = resolveRef(result.items.$ref, definitions);
        }
      } catch (err) {
        console.warn(`解析数组项引用时出错:`, err);
        result.items = { type: 'object', description: '引用解析失败' };
      }
    }
    
    // 移除临时标记
    delete result.$recursiveRef;
    
    return result;
  } catch (error) {
    console.warn(`解析引用时出错 [${ref}]:`, error);
    return { type: 'object', description: '引用解析失败' };
  }
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
  try {
    if (!api || !api.paths) {
      console.warn('API文档缺少paths字段');
      return [];
    }
    
    const pathsInfo = [];
    const isOpenApi3 = !!api.openapi;
    
    for (const path in api.paths) {
      const pathItem = api.paths[path];
      if (!pathItem) continue;
      
      for (const method in pathItem) {
        // 跳过非HTTP方法属性
        if (!['get', 'post', 'put', 'delete', 'patch', 'options', 'head'].includes(method)) {
          continue;
        }
        
        const operation = pathItem[method];
        if (!operation) continue;
        
        // 构建标准化的路径信息对象
        const pathInfo = {
          path,
          method: method.toUpperCase(),
          summary: operation.summary || '',
          description: operation.description || '',
          operationId: operation.operationId || '',
          parameters: [],
          requestBody: null,
          responses: operation.responses || {},
          tags: operation.tags || []
        };
        
        // 处理参数
        if (operation.parameters) {
          pathInfo.parameters = operation.parameters.map(param => {
            // 确保参数有基本属性
            return {
              name: param.name || '',
              in: param.in || '',
              description: param.description || '',
              required: !!param.required,
              schema: param.schema || { type: param.type || 'string' },
              type: param.type || (param.schema ? param.schema.type : 'string')
            };
          });
        }
        
        // 处理请求体 (OpenAPI 3.0)
        if (isOpenApi3 && operation.requestBody) {
          pathInfo.requestBody = operation.requestBody;
        }
        
        // 处理请求体 (Swagger 2.0)
        if (!isOpenApi3) {
          const bodyParam = operation.parameters?.find(p => p.in === 'body');
          if (bodyParam) {
            pathInfo.requestBody = {
              description: bodyParam.description || '',
              required: !!bodyParam.required,
              content: {
                'application/json': {
                  schema: bodyParam.schema || {}
                }
              }
            };
          }
        }
        
        pathsInfo.push(pathInfo);
      }
    }
    
    return pathsInfo;
  } catch (error) {
    console.error('提取API路径信息时出错:', error);
    return [];
  }
}

// 生成测试用例
export function generateTestCases(api, pathInfo) {
  try {
    if (!api || !api.paths || !pathInfo) {
      console.warn('生成测试用例参数无效');
      return [];
    }
    
    const testCases = [];
    const { path, method } = pathInfo;
    
    // 获取操作对象
    const pathItem = api.paths[path];
    if (!pathItem) return [];
    
    const operation = pathItem[method.toLowerCase()];
    if (!operation) return [];
    
    // 是否为OpenAPI 3.0
    const isOpenApi3 = !!api.openapi;
    
    // 获取请求参数和请求体信息
    const parameters = operation.parameters || [];
    let requestBodySchema = null;
    
    // 确定请求体架构
    if (isOpenApi3 && operation.requestBody) {
      requestBodySchema = operation.requestBody.content?.['application/json']?.schema;
    } else {
      const bodyParam = parameters.find(param => param.in === 'body');
      requestBodySchema = bodyParam?.schema;
    }
    
    // 获取定义
    const definitions = api.definitions || (api.components ? api.components.schemas : {}) || {};
    
    // 正常测试用例
    const normalCase = {
      name: '正常数据',
      parameters: {},
      expectedStatus: 200
    };
    
    // 处理路径参数、查询参数和请求头
    parameters.forEach(param => {
      if (param.in === 'path' || param.in === 'query' || param.in === 'header') {
        try {
          normalCase.parameters[param.name] = generateExampleValue(param.schema || param);
        } catch (err) {
          console.warn(`生成参数示例值出错 [${param.name}]:`, err);
          normalCase.parameters[param.name] = param.type === 'number' ? 0 : '';
        }
      }
    });
    
    // 处理请求体
    if (requestBodySchema) {
      try {
        normalCase.body = generateObjectFromSchema(requestBodySchema, definitions);
      } catch (err) {
        console.warn('生成请求体示例出错:', err);
        normalCase.body = {};
      }
    }
    
    testCases.push(normalCase);
    
    // 生成异常测试用例
    // 1. 必填参数缺失场景
    parameters.forEach(param => {
      if (param.required) {
        try {
          const missingCase = JSON.parse(JSON.stringify(normalCase));
          missingCase.name = `${param.name}参数缺失`;
          delete missingCase.parameters[param.name];
          missingCase.expectedStatus = 400;
          testCases.push(missingCase);
        } catch (err) {
          console.warn(`生成参数缺失测试用例出错 [${param.name}]:`, err);
        }
      }
    });
    
    // 2. 处理请求体中的必填项
    if (requestBodySchema && requestBodySchema.required && Array.isArray(requestBodySchema.required)) {
      requestBodySchema.required.forEach(propName => {
        try {
          const missingCase = JSON.parse(JSON.stringify(normalCase));
          missingCase.name = `请求体${propName}属性缺失`;
          if (missingCase.body) {
            delete missingCase.body[propName];
          }
          missingCase.expectedStatus = 400;
          testCases.push(missingCase);
        } catch (err) {
          console.warn(`生成请求体属性缺失测试用例出错 [${propName}]:`, err);
        }
      });
    }
    
    // 3. 数据类型错误场景
    parameters.forEach(param => {
      if ((param.schema && param.schema.type) || param.type) {
        try {
          const wrongTypeCase = JSON.parse(JSON.stringify(normalCase));
          wrongTypeCase.name = `${param.name}参数类型错误`;
          wrongTypeCase.parameters[param.name] = generateWrongTypeValue(param.schema || param);
          wrongTypeCase.expectedStatus = 400;
          testCases.push(wrongTypeCase);
        } catch (err) {
          console.warn(`生成参数类型错误测试用例出错 [${param.name}]:`, err);
        }
      }
    });
    
    return testCases;
  } catch (error) {
    console.error('生成测试用例时出错:', error);
    return [];
  }
}

// 根据Schema生成示例对象
function generateObjectFromSchema(schema, definitions) {
  try {
    if (!schema) return {};
    
    // 处理引用
    if (schema.$ref) {
      const refName = schema.$ref.split('/').pop();
      const definition = definitions[refName];
      if (!definition) return {};
      return generateObjectFromSchema(definition, definitions);
    }
    
    // 处理数组
    if (schema.type === 'array' && schema.items) {
      try {
        return [generateObjectFromSchema(schema.items, definitions)];
      } catch (err) {
        console.warn('生成数组示例出错:', err);
        return [];
      }
    }
    
    // 处理对象
    if (schema.type === 'object' || schema.properties) {
      const obj = {};
      if (schema.properties) {
        for (const propName in schema.properties) {
          try {
            obj[propName] = generateObjectFromSchema(schema.properties[propName], definitions);
          } catch (err) {
            console.warn(`生成对象属性示例出错 [${propName}]:`, err);
            obj[propName] = null;
          }
        }
      }
      return obj;
    }
    
    // 处理基本类型
    return generateExampleValue(schema);
  } catch (error) {
    console.warn('生成对象示例时出错:', error);
    return {};
  }
}

// 生成示例值
function generateExampleValue(schema) {
  try {
    if (!schema) return undefined;
    
    // 使用示例值（如果有）
    if (schema.example !== undefined) return schema.example;
    if (schema.examples && schema.examples.length > 0) return schema.examples[0];
    
    // 根据类型生成值
    const type = schema.type || 'string';
    
    switch (type) {
      case 'string':
        if (schema.enum && schema.enum.length > 0) return schema.enum[0];
        if (schema.format === 'date-time') return new Date().toISOString();
        if (schema.format === 'date') return new Date().toISOString().split('T')[0];
        if (schema.format === 'email') return 'user@example.com';
        if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com';
        return 'string';
        
      case 'number':
      case 'integer':
        if (schema.format === 'int32' || schema.format === 'int64') return 0;
        if (schema.format === 'float' || schema.format === 'double') return 0.0;
        if (schema.minimum !== undefined) return schema.minimum;
        return 0;
        
      case 'boolean':
        return false;
        
      case 'array':
        if (schema.items) {
          try {
            return [generateExampleValue(schema.items)];
          } catch (err) {
            return [];
          }
        }
        return [];
        
      case 'object':
        return {};
        
      case 'file':
        return 'file_content';
        
      default:
        return null;
    }
  } catch (error) {
    console.warn('生成示例值出错:', error);
    return null;
  }
}

// 生成错误类型的值
function generateWrongTypeValue(schema) {
  try {
    if (!schema) return 'wrong_type';
    
    const type = schema.type || 'string';
    
    switch (type) {
      case 'string':
        return 123; // 非字符串
      case 'number':
      case 'integer':
        return 'not_a_number'; // 非数字
      case 'boolean':
        return 'not_a_boolean'; // 非布尔值
      case 'array':
        return 'not_an_array'; // 非数组
      case 'object':
        return 'not_an_object'; // 非对象
      default:
        return 'wrong_type';
    }
  } catch (error) {
    console.warn('生成错误类型值出错:', error);
    return 'error_value';
  }
}

// 格式化测试用例用于显示
export function formatTestCasesForDisplay(testCases) {
  try {
    if (!testCases || !Array.isArray(testCases)) return [];
    
    return testCases.map(testCase => {
      const { name, parameters, body, expectedStatus } = testCase;
      
      // 格式化请求参数
      const formattedParams = Object.entries(parameters || {}).map(
        ([key, value]) => `${key}: ${JSON.stringify(value)}`
      ).join('\n');
      
      // 格式化请求体
      const formattedBody = body ? JSON.stringify(body, null, 2) : '';
      
      // 返回格式化的测试用例
      return {
        name,
        parameters: formattedParams,
        body: formattedBody,
        expectedStatus
      };
    });
  } catch (error) {
    console.error('格式化测试用例时出错:', error);
    return [];
  }
}

// 转换测试用例为数组形式（适用于批量测试）
export function convertTestCasesToArray(testCases, api, pathInfo) {
  try {
    if (!testCases || !Array.isArray(testCases) || !pathInfo) return [];
    
    const testCasesArray = [];
    const { path, method } = pathInfo;
    
    testCases.forEach(testCase => {
      const { name, parameters, body, expectedStatus } = testCase;
      
      // 提取路径参数、查询参数和请求头
      const pathParams = {};
      const queryParams = {};
      const headers = {};
      
      Object.entries(parameters || {}).forEach(([key, value]) => {
        const param = pathInfo.parameters.find(p => p.name === key);
        if (!param) return;
        
        switch (param.in) {
          case 'path':
            pathParams[key] = value;
            break;
          case 'query':
            queryParams[key] = value;
            break;
          case 'header':
            headers[key] = value;
            break;
        }
      });
      
      // 生成URL
      let url = path;
      Object.entries(pathParams).forEach(([key, value]) => {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      });
      
      // 添加查询参数
      if (Object.keys(queryParams).length > 0) {
        const queryString = Object.entries(queryParams)
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
          .join('&');
        url = `${url}?${queryString}`;
      }
      
      // 构建测试用例数组项
      testCasesArray.push({
        name,
        method,
        url,
        headers,
        body,
        expectedStatus
      });
    });
    
    return testCasesArray;
  } catch (error) {
    console.error('转换测试用例为数组时出错:', error);
    return [];
  }
} 