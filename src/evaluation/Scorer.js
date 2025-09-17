import fetch from 'node-fetch';

/**
 * 评分器基类
 * 定义评分系统的基础接口和通用方法
 */
export class Scorer {
  constructor(modelConfig, dimensions, scoringSystem) {
    this.modelConfig = modelConfig;
    this.dimensions = dimensions;
    this.scoringSystem = scoringSystem;
  }

  /**
   * 对搜索结果进行评分（抽象方法）
   * @param {Object} searchResult - 搜索结果
   * @param {string} query - 原始查询
   * @param {string} dimension - 评分维度
   * @returns {Promise<Object>} 评分结果
   */
  async scoreResult(searchResult, query, dimension) {
    throw new Error('scoreResult方法需要在子类中实现');
  }

  /**
   * 批量评分搜索结果
   * @param {Array} searchResults - 搜索结果数组
   * @param {string} query - 原始查询
   * @returns {Promise<Array>} 评分结果数组
   */
  async batchScore(searchResults, query) {
    const scoredResults = [];

    for (const result of searchResults) {
      const resultScores = {};
      
      // 对每个维度进行评分
      for (const dimension of this.dimensions) {
        try {
          const score = await this.scoreResult(result, query, dimension.name);
          resultScores[dimension.name] = score;
        } catch (error) {
          console.error(`评分失败 - 维度: ${dimension.name}, 错误: ${error.message}`);
          resultScores[dimension.name] = {
            score: 0,
            reasoning: `评分失败: ${error.message}`,
            error: true
          };
        }
      }

      // 计算加权总分
      const weightedScore = this.calculateWeightedScore(resultScores);

      scoredResults.push({
        ...result,
        scores: resultScores,
        weightedScore,
        timestamp: new Date().toISOString()
      });
    }

    return scoredResults;
  }

  /**
   * 计算加权总分
   * @param {Object} scores - 各维度得分
   * @returns {number} 加权总分
   */
  calculateWeightedScore(scores) {
    let totalScore = 0;
    let totalWeight = 0;

    for (const dimension of this.dimensions) {
      const dimensionScore = scores[dimension.name];
      if (dimensionScore && !dimensionScore.error) {
        totalScore += dimensionScore.score * dimension.weight;
        totalWeight += dimension.weight;
      }
    }

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  /**
   * 调用AI模型进行评分
   * @param {string} prompt - 评分提示词
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} AI模型响应
   */
  async callAIModel(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(this.modelConfig.base_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.modelConfig.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.modelConfig.model_name,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.1,
            max_tokens: 500
          }),
          timeout: 30000
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`AI模型调用失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`AI模型调用失败: ${error.message}`);
        }
        
        // 等待后重试
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  /**
   * 解析AI模型返回的评分
   * @param {string} response - AI模型响应文本
   * @returns {Object} 解析后的评分结果
   */
  parseAIResponse(response) {
    try {
      // 尝试提取JSON格式的响应
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      // 如果没有JSON，尝试提取数字评分
      const scoreMatch = response.match(/(\d+(?:\.\d+)?)/);
      if (scoreMatch) {
        return {
          score: parseFloat(scoreMatch[1]),
          reasoning: response.trim()
        };
      }

      throw new Error('无法解析AI响应');
    } catch (error) {
      console.error('解析AI响应失败:', error.message);
      return {
        score: 0,
        reasoning: response,
        error: true
      };
    }
  }

  /**
   * 验证评分是否在有效范围内
   * @param {number} score - 评分
   * @returns {boolean} 是否有效
   */
  isValidScore(score) {
    const scale = this.scoringSystem.scale;
    return score >= Math.min(...scale) && score <= Math.max(...scale);
  }
}