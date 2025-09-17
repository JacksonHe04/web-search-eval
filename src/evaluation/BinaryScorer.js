import { Scorer } from './Scorer.js';

/**
 * 二分制评分器
 * 实现0-2分的评分系统
 */
export class BinaryScorer extends Scorer {
  constructor(modelConfig, dimensions, prompts) {
    const scoringSystem = {
      scale: [0, 1, 2],
      description: '二分制评分（0-2分）'
    };
    
    super(modelConfig, dimensions, scoringSystem);
    this.prompts = prompts;
  }

  /**
   * 对单个搜索结果进行二分制评分
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
      
      // 确保评分在0-2范围内
      if (parsedResult.score !== undefined) {
        parsedResult.score = Math.max(0, Math.min(2, Math.round(parsedResult.score)));
      }

      return {
        score: parsedResult.score || 0,
        reasoning: parsedResult.reasoning || content,
        dimension,
        scoringSystem: 'binary',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`二分制评分失败: ${error.message}`);
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

评分标准（0-2分）：
- 0分：完全不符合要求
- 1分：部分符合要求
- 2分：完全符合要求

查询：${query}

搜索结果：
标题：${searchResult.title}
URL：${searchResult.url}
摘要：${searchResult.snippet}
来源：${searchResult.source}

${customPrompt ? `特殊评分要求：${customPrompt}` : ''}

请返回JSON格式的评分结果：
{
  "score": 评分(0-2),
  "reasoning": "评分理由"
}
`;

    return basePrompt.trim();
  }

  /**
   * 获取评分系统描述
   * @returns {string} 评分系统描述
   */
  getDescription() {
    return '二分制评分系统：0分（不符合）、1分（部分符合）、2分（完全符合）';
  }

  /**
   * 验证二分制评分
   * @param {number} score - 评分
   * @returns {boolean} 是否有效
   */
  isValidScore(score) {
    return [0, 1, 2].includes(score);
  }
}