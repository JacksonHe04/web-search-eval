import { Scorer } from './Scorer.js';

/**
 * 五分制评分器
 * 实现1-5分的评分系统
 */
export class FivePointScorer extends Scorer {
  constructor(modelConfig, dimensions, prompts) {
    const scoringSystem = {
      scale: [1, 2, 3, 4, 5],
      description: '五分制评分（1-5分）'
    };
    
    super(modelConfig, dimensions, scoringSystem);
    this.prompts = prompts;
  }

  /**
   * 对单个搜索结果进行五分制评分
   * @param {Object} searchResult - 搜索结果
   * @param {string} query - 原始查询
   * @param {string} dimension - 评分维度
   * @returns {Promise<Object>} 评分结果
   */
  async scoreResult(searchResult, query, dimension) {
    const prompt = this.buildPrompt(searchResult, query, dimension);
    
    try {
      const aiResponse = await this.callAIModel(prompt);
      const content = aiResponse.choices?.[0]?.message?.content || '';
      
      const parsedResult = this.parseAIResponse(content);
      
      // 确保评分在1-5范围内
      if (parsedResult.score !== undefined) {
        parsedResult.score = Math.max(1, Math.min(5, Math.round(parsedResult.score)));
      }

      return {
        score: parsedResult.score || 1,
        reasoning: parsedResult.reasoning || content,
        dimension,
        scoringSystem: 'five_point',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`五分制评分失败: ${error.message}`);
    }
  }

  /**
   * 构建评分提示词
   * @param {Object} searchResult - 搜索结果
   * @param {string} query - 原始查询
   * @param {string} dimension - 评分维度
   * @returns {string} 完整的提示词
   */
  buildPrompt(searchResult, query, dimension) {
    const customPrompt = this.prompts[dimension] || '';
    
    const basePrompt = `
请对以下搜索结果在"${dimension}"维度进行评分。

评分标准（1-5分）：
- 1分：非常差，完全不符合要求
- 2分：较差，基本不符合要求
- 3分：一般，部分符合要求
- 4分：较好，大部分符合要求
- 5分：优秀，完全符合要求

查询：${query}

搜索结果：
标题：${searchResult.title}
URL：${searchResult.url}
摘要：${searchResult.snippet}
来源：${searchResult.source}
${searchResult.timestamp ? `发布时间：${searchResult.timestamp}` : ''}

${customPrompt ? `特殊评分要求：${customPrompt}` : ''}

请返回JSON格式的评分结果：
{
  "score": 评分(1-5),
  "reasoning": "详细的评分理由"
}
`;

    return basePrompt.trim();
  }

  /**
   * 对单个维度进行批量评分（优化版本）
   * @param {Array} searchResults - 搜索结果数组
   * @param {string} query - 搜索查询
   * @param {string} dimension - 评分维度
   * @returns {Promise<Object>} 该维度的整体评分结果
   */
  async batchScoreDimension(searchResults, query, dimension) {
    const prompt = this.buildBatchPrompt(searchResults, query, dimension);
    
    try {
      const aiResponse = await this.callAIModel(prompt);
      const content = aiResponse.choices?.[0]?.message?.content || '';
      
      const parsedResult = this.parseOverallAIResponse(content);
      
      // 确保评分在1-5范围内
      const score = Math.max(1, Math.min(5, Math.round(parsedResult.score || 1)));
      
      return {
        score,
        reasoning: parsedResult.reasoning || '整体评分理由',
        dimension,
        scoringSystem: 'five_point',
        timestamp: new Date().toISOString(),
        resultCount: searchResults.length
      };

    } catch (error) {
      throw new Error(`五分制批量评分失败: ${error.message}`);
    }
  }

  /**
   * 构建批量评分提示词
   * @param {Array} searchResults - 搜索结果数组
   * @param {string} query - 原始查询
   * @param {string} dimension - 评分维度
   * @returns {Object} 包含系统提示和用户提示的对象
   */
  buildBatchPrompt(searchResults, query, dimension) {
    const customPrompt = this.prompts[dimension] || '';
    
    const resultsText = searchResults.map((result, index) => `
结果${index + 1}：
标题：${result.title}
URL：${result.url}
摘要：${result.snippet}
来源：${result.source}
${result.timestamp ? `发布时间：${result.timestamp}` : ''}
`).join('\n');

    // 系统提示：使用自定义提示词（包含完整的评分标准和要求）
    const systemPrompt = customPrompt || `
请对搜索结果在"${dimension}"维度进行整体评分。

评分标准（1-5分）：
- 1分：非常差，完全不符合要求
- 2分：较差，基本不符合要求
- 3分：一般，部分符合要求
- 4分：较好，大部分符合要求
- 5分：优秀，完全符合要求

请根据所有搜索结果的整体表现给出一个综合分数。
`;

    // 用户提示：只包含查询和搜索结果数据
    const userPrompt = `
查询：${query}

搜索结果：
${resultsText}
`;

    return {
      system: systemPrompt.trim(),
      user: userPrompt.trim()
    };
  }

  /**
   * 解析整体AI响应
   * @param {string} content - AI响应内容
   * @returns {Object} 解析后的整体评分结果
   */
  parseOverallAIResponse(content) {
    try {
      // 首先尝试从<result>标签中提取分数
      const resultMatch = content.match(/<result>(\d+)<\/result>/);
      if (resultMatch) {
        const score = parseInt(resultMatch[1]);
        return {
          score,
          reasoning: content.replace(/<result>.*?<\/result>/, '').trim()
        };
      }
      
      // 如果没有<result>标签，尝试解析JSON格式
      const parsed = this.parseAIResponse(content);
      if (parsed.score !== undefined) {
        return {
          score: parsed.score,
          reasoning: parsed.reasoning || content
        };
      }
      
      // 如果都失败了，尝试从文本中提取数字
      const scoreMatch = content.match(/(?:得分|评分|分数).*?(\d+)/);
      if (scoreMatch) {
        return {
          score: parseInt(scoreMatch[1]),
          reasoning: content
        };
      }
      
      throw new Error('无法解析整体评分结果');
      
    } catch (error) {
      console.warn('整体评分解析失败，使用默认值:', error.message);
      return {
        score: 1,
        reasoning: `评分解析失败: ${error.message}`
      };
    }
  }

  /**
   * 解析批量AI响应（保留用于兼容性）
   * @param {string} content - AI响应内容
   * @param {number} expectedCount - 期望的结果数量
   * @returns {Array} 解析后的评分数组
   */
  parseBatchAIResponse(content, expectedCount) {
    try {
      const parsed = this.parseAIResponse(content);
      
      if (parsed.results && Array.isArray(parsed.results)) {
        // 确保返回正确数量的结果
        const results = parsed.results.slice(0, expectedCount);
        
        // 如果结果不足，用默认值填充
        while (results.length < expectedCount) {
          results.push({
            score: 1,
            reasoning: `结果${results.length + 1}评分解析失败，使用默认值`
          });
        }
        
        return results;
      }
      
      // 如果没有results字段，尝试解析为单个结果并复制
      if (parsed.score !== undefined) {
        return Array(expectedCount).fill(null).map((_, index) => ({
          score: parsed.score,
          reasoning: parsed.reasoning || `结果${index + 1}的评分`
        }));
      }
      
      throw new Error('无法解析批量评分结果');
      
    } catch (error) {
      console.warn('批量评分解析失败，使用默认值:', error.message);
      // 返回默认评分
      return Array(expectedCount).fill(null).map((_, index) => ({
        score: 1,
        reasoning: `结果${index + 1}评分解析失败: ${error.message}`
      }));
    }
  }

  /**
   * 获取评分系统描述
   * @returns {string} 评分系统描述
   */
  getDescription() {
    return '五分制评分系统：1分（非常差）、2分（较差）、3分（一般）、4分（较好）、5分（优秀）';
  }

  /**
   * 验证五分制评分
   * @param {number} score - 评分
   * @returns {boolean} 是否有效
   */
  isValidScore(score) {
    return [1, 2, 3, 4, 5].includes(score);
  }
}