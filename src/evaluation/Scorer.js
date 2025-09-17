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
   * 批量评分搜索结果（优化版本 - 减少API调用）
   * @param {Array} searchResults - 搜索结果数组
   * @param {string} query - 搜索查询
   * @returns {Promise<Array>} 评分后的结果数组
   */
  async batchScore(searchResults, query) {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 开始AI批量评估过程');
    console.log(`📝 查询: "${query}"`);
    console.log(`📊 待评估结果数量: ${searchResults.length}`);
    console.log(`🔍 评估维度: ${this.dimensions.map(d => `${d.name}(权重:${d.weight})`).join(', ')}`);
    console.log(`🚀 评估说明: 每个维度仅调用1次API (本轮总共${this.dimensions.length}次调用)`);
    console.log('='.repeat(80));

    const scoredResults = [];
    
    // 为每个维度进行批量评分
    const dimensionScores = {};
    
    for (const dimension of this.dimensions) {
      console.log(`\n📏 批量评估维度: ${dimension.name} (权重: ${dimension.weight})`);
      
      try {
        // 调用子类实现的批量评分方法
        const batchScoreResult = await this.batchScoreDimension(searchResults, query, dimension.name);
        dimensionScores[dimension.name] = batchScoreResult;
        
        console.log(`   ✅ ${dimension.name}: 批量评分完成，处理了${searchResults.length}个结果`);
        console.log(`      整体评分: ${batchScoreResult.score}分`);
        console.log(`      评分理由: ${this.formatReasoningForDisplay(batchScoreResult.reasoning)}`);
        
      } catch (error) {
        console.error(`   ❌ ${dimension.name} 批量评分失败:`, error.message);
        // 创建错误评分
        dimensionScores[dimension.name] = {
          score: 0,
          reasoning: `批量评分失败: ${error.message}`,
          dimension: dimension.name,
          error: true,
          resultCount: searchResults.length
        };
      }
      
      // 添加维度间延迟
      if (this.dimensions.indexOf(dimension) < this.dimensions.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 计算整体加权评分
    const overallScores = {};
    this.dimensions.forEach(dimension => {
      overallScores[dimension.name] = dimensionScores[dimension.name];
    });
    
    const weightedScore = this.calculateWeightedScore(overallScores);
    
    // 创建评分结果（整体评分应用到所有搜索结果）
    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      
      scoredResults.push({
        ...result,
        dimensionScores: overallScores,
        weightedScore,
        timestamp: new Date().toISOString()
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ AI批量评估完成');
    console.log(`📊 API调用优化: ${this.dimensions.length} 次调用 (原来需要 ${searchResults.length * this.dimensions.length} 次)`);
    console.log(`🎯 效率提升: ${Math.round((1 - this.dimensions.length / (searchResults.length * this.dimensions.length)) * 100)}%`);
    console.log('='.repeat(80));

    return {
      results: scoredResults,
      overallScores,
      weightedScore,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 对单个维度进行批量评分（抽象方法，需要在子类中实现）
   * @param {Array} searchResults - 搜索结果数组
   * @param {string} query - 搜索查询
   * @param {string} dimension - 评分维度
   * @returns {Promise<Array>} 该维度下所有结果的评分数组
   */
  async batchScoreDimension(searchResults, query, dimension) {
    throw new Error('batchScoreDimension方法需要在子类中实现');
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
   * @param {string|Object} prompt - 评分提示词（字符串或包含system和user的对象）
   * @param {number} maxRetries - 最大重试次数
   * @returns {Promise<Object>} AI模型响应
   */
  async callAIModel(prompt, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // 构建消息数组
        let messages;
        if (typeof prompt === 'string') {
          // 兼容旧版本：字符串提示词作为用户消息
          messages = [
            {
              role: 'user',
              content: prompt
            }
          ];
        } else {
          // 新版本：支持系统提示和用户提示分离
          messages = [];
          if (prompt.system) {
            messages.push({
              role: 'system',
              content: prompt.system
            });
          }
          if (prompt.user) {
            messages.push({
              role: 'user',
              content: prompt.user
            });
          }
        }

        const response = await fetch(this.modelConfig.base_url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.modelConfig.model_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: this.modelConfig.model_name,
            messages: messages,
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
      // 优先尝试提取<result></result>标签内的得分
      const resultTagMatch = response.match(/<result>(.*?)<\/result>/s);
      if (resultTagMatch) {
        const resultContent = resultTagMatch[1].trim();
        
        // 尝试解析标签内的数字得分
        const scoreMatch = resultContent.match(/(\d+(?:\.\d+)?)/);
        if (scoreMatch) {
          return {
            score: parseFloat(scoreMatch[1]),
            reasoning: response.trim()
          };
        }
        
        // 如果标签内是JSON格式
        try {
          const jsonResult = JSON.parse(resultContent);
          return jsonResult;
        } catch (e) {
          // 继续尝试其他解析方式
        }
      }

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
   * 格式化评分理由用于展示
   * @param {string} reasoning - 原始评分理由
   * @returns {string} 格式化后的评分理由
   */
  formatReasoningForDisplay(reasoning) {
    if (!reasoning) return '无评分理由';
    
    // 查找result标签
    const resultMatch = reasoning.match(/<result>.*?<\/result>/);
    
    if (resultMatch) {
      // 如果有result标签，截断中间部分但保留result标签
      const resultTag = resultMatch[0];
      const beforeResult = reasoning.substring(0, reasoning.indexOf('<result>'));
      
      // 如果前面内容太长，截断前面部分
      if (beforeResult.length > 150) {
        const truncatedBefore = beforeResult.substring(0, 150);
        return `${truncatedBefore}...${resultTag}`;
      } else {
        return `${beforeResult}${resultTag}`;
      }
    } else {
      // 如果没有result标签，简单截断
      if (reasoning.length > 200) {
        return `${reasoning.substring(0, 200)}...`;
      }
      return reasoning;
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