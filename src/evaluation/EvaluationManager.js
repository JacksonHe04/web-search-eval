import { BinaryScorer } from './BinaryScorer.js';
import { FivePointScorer } from './FivePointScorer.js';

/**
 * 评估管理器
 * 统一管理评分流程和结果汇总
 */
export class EvaluationManager {
  constructor(config) {
    this.config = config;
    this.modelConfig = config.model;
    this.dimensions = config.evaluation.dimensions;
    this.prompts = config.evaluation.prompts;
    this.repeatTimes = config.evaluation.repeat_times || 3;
    
    this.initializeScorers();
  }

  /**
   * 初始化评分器
   */
  initializeScorers() {
    this.scorers = {
      binary: new BinaryScorer(
        this.modelConfig,
        this.dimensions,
        this.prompts.binary
      ),
      five_point: new FivePointScorer(
        this.modelConfig,
        this.dimensions,
        this.prompts.five_point
      )
    };
  }

  /**
   * 评估单个查询的所有搜索结果
   * @param {string} query - 搜索查询
   * @param {Array} searchResults - 所有搜索引擎的结果
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateQuery(query, searchResults) {
    console.log(`开始评估查询: ${query}`);
    
    const evaluationResults = {
      query,
      timestamp: new Date().toISOString(),
      engines: {},
      summary: {}
    };

    // 对每个搜索引擎的结果进行评估
    for (const engineResult of searchResults) {
      if (engineResult.error) {
        evaluationResults.engines[engineResult.engine] = {
          error: engineResult.error,
          scores: null
        };
        continue;
      }

      console.log(`评估 ${engineResult.engine} 的搜索结果`);
      
      try {
        const engineEvaluation = await this.evaluateEngineResults(
          query,
          engineResult
        );
        
        evaluationResults.engines[engineResult.engine] = engineEvaluation;
      } catch (error) {
        console.error(`评估 ${engineResult.engine} 失败:`, error.message);
        evaluationResults.engines[engineResult.engine] = {
          error: error.message,
          scores: null
        };
      }
    }

    // 生成汇总统计
    evaluationResults.summary = this.generateSummary(evaluationResults.engines);
    
    console.log(`查询 "${query}" 评估完成`);
    return evaluationResults;
  }

  /**
   * 评估单个搜索引擎的结果
   * @param {string} query - 搜索查询
   * @param {Object} engineResult - 搜索引擎结果
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateEngineResults(query, engineResult) {
    const evaluation = {
      engine: engineResult.engine,
      totalResults: engineResult.results.length,
      scores: {
        binary: null,
        five_point: null
      },
      averageScores: {},
      timestamp: new Date().toISOString()
    };

    // 使用二分制评分
    try {
      evaluation.scores.binary = await this.scorers.binary.batchScore(
        engineResult.results,
        query
      );
    } catch (error) {
      console.error(`二分制评分失败:`, error.message);
      evaluation.scores.binary = { error: error.message };
    }

    // 使用五分制评分
    try {
      evaluation.scores.five_point = await this.scorers.five_point.batchScore(
        engineResult.results,
        query
      );
    } catch (error) {
      console.error(`五分制评分失败:`, error.message);
      evaluation.scores.five_point = { error: error.message };
    }

    // 计算平均分
    evaluation.averageScores = this.calculateAverageScores(evaluation.scores);

    return evaluation;
  }

  /**
   * 计算平均分
   * @param {Object} scores - 评分结果
   * @returns {Object} 平均分统计
   */
  calculateAverageScores(scores) {
    const averages = {};

    ['binary', 'five_point'].forEach(scoringType => {
      if (scores[scoringType] && !scores[scoringType].error) {
        averages[scoringType] = {
          dimensions: {},
          weighted: 0
        };

        const results = scores[scoringType];
        const validResults = results.filter(r => r.weightedScore !== undefined);

        if (validResults.length > 0) {
          // 计算各维度平均分
          this.dimensions.forEach(dimension => {
            const dimensionScores = validResults
              .map(r => r.scores[dimension.name]?.score)
              .filter(score => score !== undefined && !isNaN(score));

            if (dimensionScores.length > 0) {
              averages[scoringType].dimensions[dimension.name] = 
                dimensionScores.reduce((sum, score) => sum + score, 0) / dimensionScores.length;
            }
          });

          // 计算加权平均分
          averages[scoringType].weighted = 
            validResults.reduce((sum, r) => sum + r.weightedScore, 0) / validResults.length;
        }
      }
    });

    return averages;
  }

  /**
   * 生成评估汇总
   * @param {Object} engineResults - 所有引擎的评估结果
   * @returns {Object} 汇总统计
   */
  generateSummary(engineResults) {
    const summary = {
      totalEngines: Object.keys(engineResults).length,
      successfulEngines: 0,
      failedEngines: 0,
      rankings: {
        binary: [],
        five_point: []
      }
    };

    const engineScores = {
      binary: [],
      five_point: []
    };

    // 收集各引擎得分
    Object.entries(engineResults).forEach(([engineName, result]) => {
      if (result.error) {
        summary.failedEngines++;
      } else {
        summary.successfulEngines++;
        
        ['binary', 'five_point'].forEach(scoringType => {
          const avgScore = result.averageScores?.[scoringType]?.weighted;
          if (avgScore !== undefined && !isNaN(avgScore)) {
            engineScores[scoringType].push({
              engine: engineName,
              score: avgScore
            });
          }
        });
      }
    });

    // 生成排名
    ['binary', 'five_point'].forEach(scoringType => {
      summary.rankings[scoringType] = engineScores[scoringType]
        .sort((a, b) => b.score - a.score)
        .map((item, index) => ({
          rank: index + 1,
          engine: item.engine,
          score: item.score
        }));
    });

    return summary;
  }

  /**
   * 批量评估多个查询
   * @param {Array} queries - 查询列表
   * @param {Function} searchFunction - 搜索函数
   * @returns {Promise<Array>} 所有查询的评估结果
   */
  async batchEvaluate(queries, searchFunction) {
    console.log(`开始批量评估 ${queries.length} 个查询`);
    
    const allResults = [];

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`处理查询 ${i + 1}/${queries.length}: ${query}`);

      try {
        // 执行搜索
        const searchResults = await searchFunction(query);
        
        // 执行评估
        const evaluationResult = await this.evaluateQuery(query, searchResults);
        allResults.push(evaluationResult);

        // 添加延迟避免API限制
        if (i < queries.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`查询 "${query}" 处理失败:`, error.message);
        allResults.push({
          query,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    console.log(`批量评估完成，共处理 ${allResults.length} 个查询`);
    return allResults;
  }
}