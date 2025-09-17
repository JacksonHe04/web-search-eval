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