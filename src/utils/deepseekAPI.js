// DeepSeek API 调用工具
import axios from 'axios';

// 从环境变量读取API密钥（生产环境中应该从安全存储获取）
// 在实际使用时，需要在.env文件中设置VITE_DEEPSEEK_API_KEY环境变量
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';

/**
 * 动态加载指南文档
 * @returns {Promise<Object>} - 包含三个文档内容的对象
 */
async function loadGuideDocs() {
  try {
    // 尝试加载三个文档
    const guidePromise = fetch('/接口测试用例生成指南.md').then(res => res.text());
    const promptPromise = fetch('/接口用例调教提示词.md').then(res => res.text());
    const templatePromise = fetch('/接口用例参考模板.md').then(res => res.text());
    
    // 等待所有文档加载完成
    const [guide, prompt, template] = await Promise.all([guidePromise, promptPromise, templatePromise]);
    
    return { guide, prompt, template };
  } catch (error) {
    console.warn('加载指南文档失败，将使用内置文档:', error);
    
    // 返回默认内置文档
    return {
      guide: `# Role: 接口测试用例生成专家

## Profile
- language: 中文
- description: 专业的接口测试用例生成专家，能够根据接口文档自动生成全面、规范的测试用例
- background: 拥有5年以上软件测试经验，精通RESTful API测试方法论
- personality: 严谨细致，逻辑性强，注重细节
- expertise: 接口测试、边界值分析、异常场景设计、测试用例编写
- target_audience: 测试工程师、开发人员、质量保障团队`,
      
      prompt: `## Skills

1. 测试用例设计
   - 边界值分析: 准确识别参数边界条件
   - 等价类划分: 合理划分输入参数等价类
   - 异常场景设计: 全面覆盖各种异常情况
   - 组合测试: 设计多参数组合测试场景`,
      
      template: `### 1. 创建学校接口 \`/admin-api/tcom/school/create\`

**请求方式**：POST
**请求体**：SchoolSaveReqVO
**必填参数**：id, schoolName, schoolType, isHaveCard, schoolAddress, schoolLonLat

|        场景        |                            参数值                            | 响应状态码 |         补充说明         |
| :----------------: | :----------------------------------------------------------: | :--------: | :----------------------: |
|      正常用例      | {"id":"29932","schoolName":"洁兔","schoolType":1,"isHaveCard":1,"schoolAddress":"杭州市","schoolLonLat":"120.188966,30.346182"} |    200     |                          |`
    };
  }
}

/**
 * 调用DeepSeek API生成测试用例
 * @param {Object} swaggerDoc - Swagger文档对象
 * @param {Object} apiPath - API路径信息
 * @param {string} template - 测试用例模板描述
 * @param {string} [tempApiKey] - 临时API密钥
 * @returns {Promise<Array>} - 生成的测试用例数组
 */
export async function generateTestCasesWithAI(swaggerDoc, apiPath, template, tempApiKey = '') {
  try {
    // 使用临时API密钥或环境变量中的API密钥
    const apiKey = tempApiKey || API_KEY;
    
    if (!apiKey) {
      throw new Error('DeepSeek API密钥未设置。请在.env文件中设置VITE_DEEPSEEK_API_KEY变量，或提供临时API密钥。');
    }

    // 加载指南文档
    const guideDocs = await loadGuideDocs();
    
    // 构建提示词，每次都使用最新的文档内容
    const prompt = constructPrompt(swaggerDoc, apiPath, template, guideDocs);
    
    try {
      // 调用DeepSeek API
      const response = await axios.post(
        'https://api.deepseek.com/v1/chat/completions',
        {
          model: 'deepseek-chat',
          messages: [
            { 
              role: 'system', 
              content: '你是一个接口测试用例生成专家，擅长根据接口规范生成全面的测试用例。你将严格按照提供的指南和模板生成测试用例，确保覆盖所有必要的测试场景。' 
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 2048
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          }
        }
      );

      // 解析响应内容
      const aiResponse = response.data.choices[0].message.content;
      
      // 将AI响应转换为测试用例数组
      return parseAIResponseToTestCases(aiResponse);
    } catch (apiError) {
      console.error('DeepSeek API调用失败:', apiError);
      
      // 检查是否为402错误（通常表示付费问题）
      if (apiError.response && apiError.response.status === 402) {
        throw new Error('DeepSeek API付费授权错误。请检查您的API密钥额度是否充足，或联系DeepSeek平台客服。');
      } else if (apiError.response && apiError.response.status === 401) {
        throw new Error('DeepSeek API认证失败。请检查API密钥是否正确。');
      }
      
      // 如果API调用失败，使用本地生成回退
      console.log('使用本地模拟生成测试用例...');
      return generateFallbackTestCases(apiPath, template);
    }
  } catch (error) {
    console.error('调用DeepSeek API失败:', error);
    throw error;
  }
}

/**
 * 本地生成回退测试用例（当API调用失败时使用）
 * @param {Object} apiPath - API路径信息
 * @param {string} template - 测试用例模板描述
 * @returns {Array} - 生成的测试用例数组
 */
function generateFallbackTestCases(apiPath, template) {
  // 解析模板格式，提取示例
  const templateLines = template.split('\n')
    .filter(line => line.trim().startsWith('-'))
    .map(line => line.trim().replace(/^-\s*/, ''));
  
  if (templateLines.length === 0) {
    throw new Error('无法解析测试用例模板格式');
  }
  
  // 如果是学校API路径
  if (apiPath.path.includes('/school')) {
    // 提取第一个示例的格式
    let exampleLine = templateLines[0];
    try {
      // 尝试解析为JSON数组
      let example = JSON.parse(exampleLine);
      
      // 生成5个不同的测试用例
      return [
        example, // 保留原始示例
        // 添加更多的测试用例，修改一些值
        ["学校名称特殊字符", "测试学校@#$%", 1, 2, "浙江省杭州市", "120.1,30.2", 400],
        ["学校类型非法值", "测试学校", 99, 2, "浙江省杭州市", "120.1,30.2", 400],
        ["学校类型为空", "测试学校", null, 2, "浙江省杭州市", "120.1,30.2", 400],
        ["经纬度格式错误", "测试学校", 1, 2, "浙江省杭州市", "invalid", 400]
      ];
    } catch (e) {
      // 如果解析JSON失败，则简单拆分字符串
      return templateLines;
    }
  } else {
    // 其他API路径的通用处理
    return templateLines;
  }
}

/**
 * 构建API请求的提示词
 * @param {Object} swaggerDoc - Swagger文档对象
 * @param {Object} apiPath - API路径信息
 * @param {string} template - 测试用例模板描述
 * @param {Object} guideDocs - 指南文档内容对象
 * @returns {string} - 构建好的提示词
 */
function constructPrompt(swaggerDoc, apiPath, template, guideDocs) {
  const { path, method, summary, description } = apiPath;
  const operation = swaggerDoc.paths[path][method.toLowerCase()];
  
  // 获取参数信息
  const parameters = operation.parameters || [];
  
  // 获取请求体信息
  let requestBodySchema = null;
  
  // 处理requestBody，兼容Swagger 2.0和3.0
  if (operation.requestBody && operation.requestBody.content && operation.requestBody.content['application/json']) {
    requestBodySchema = operation.requestBody.content['application/json'].schema;
  } else if (parameters.some(param => param.in === 'body' && param.schema)) {
    // Swagger 2.0 风格的请求体参数
    requestBodySchema = parameters.find(param => param.in === 'body').schema;
  }
  
  // 构造参数描述（排除body参数，因为它将单独处理）
  const paramDescriptions = parameters
    .filter(param => param.in !== 'body')
    .map(param => {
      return `${param.name} (${param.in}): ${param.description || '无描述'} ${param.required ? '(必填)' : '(可选)'} - 类型: ${param.schema?.type || param.type || '未知'}`;
    }).join('\n');
  
  // 构造请求体描述
  let requestBodyDesc = '无请求体';
  if (requestBodySchema) {
    if (requestBodySchema.$ref) {
      const refName = requestBodySchema.$ref.split('/').pop();
      const schema = swaggerDoc.definitions?.[refName] || 
                    (swaggerDoc.components?.schemas?.[refName]);
      
      if (schema) {
        requestBodyDesc = `请求体 (${refName}):\n`;
        
        if (schema.properties) {
          for (const propName in schema.properties) {
            const prop = schema.properties[propName];
            const required = schema.required?.includes(propName);
            requestBodyDesc += `- ${propName}: ${prop.description || '无描述'} ${required ? '(必填)' : '(可选)'} - 类型: ${prop.type || '未知'}\n`;
          }
        }
      }
    } else if (requestBodySchema.properties) {
      requestBodyDesc = '请求体:\n';
      for (const propName in requestBodySchema.properties) {
        const prop = requestBodySchema.properties[propName];
        const required = requestBodySchema.required?.includes(propName);
        requestBodyDesc += `- ${propName}: ${prop.description || '无描述'} ${required ? '(必填)' : '(可选)'} - 类型: ${prop.type || '未知'}\n`;
      }
    }
  }
  
  // 构造响应描述
  const responseDesc = Object.entries(operation.responses || {})
    .map(([status, response]) => {
      return `状态码 ${status}: ${response.description || '无描述'}`;
    }).join('\n');
  
  // 构建提示词
  return `
${guideDocs.guide}

${guideDocs.prompt}

请根据以下API信息，参考上述指南和以下参考模板，生成符合模板的测试用例数组：

API路径: ${path}
HTTP方法: ${method}
接口名称: ${summary || '无'}
接口描述: ${description || '无'}

参数信息:
${paramDescriptions || '无参数'}

${requestBodyDesc}

响应信息:
${responseDesc || '无响应描述'}

参考的测试用例模板格式示例:
${guideDocs.template}

测试用例数组模板:
${template}

请按照上述模板格式，生成一系列全面的测试用例，包括但不限于：
1. 正常数据场景
2. 必填参数缺失场景
3. 参数格式/类型错误场景
4. 边界值测试场景
5. 特殊字符测试场景

只需返回格式化好的测试用例数组，不要包含其他解释性文本。每个测试用例应包含测试名称、测试数据和预期状态码。
`;
}

/**
 * 将AI响应解析为测试用例数组
 * @param {string} aiResponse - AI生成的响应文本
 * @returns {Array} - 解析后的测试用例数组
 */
function parseAIResponseToTestCases(aiResponse) {
  try {
    // 尝试提取JSON数组
    const arrayMatch = aiResponse.match(/\[\s*\n?\s*\[[\s\S]*\]\s*\n?\s*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
    
    // 尝试提取代码块中的内容
    const codeBlockMatch = aiResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return JSON.parse(codeBlockMatch[1]);
    }
    
    // 如果无法解析为JSON，尝试按行解析
    const lines = aiResponse.split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('['))
      .map(line => line.trim().replace(/^-\s*/, ''));
    
    if (lines.length > 0) {
      // 尝试每行作为JSON数组解析
      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          // 如果解析失败，尝试将其作为纯文本数组返回
          return line.split(',').map(item => item.trim());
        }
      });
    }
    
    // 如果以上所有方法都失败，则返回原始文本
    return aiResponse;
  } catch (error) {
    console.error('解析AI响应失败:', error);
    return aiResponse; // 返回原始响应
  }
}

export default {
  generateTestCasesWithAI
}; 