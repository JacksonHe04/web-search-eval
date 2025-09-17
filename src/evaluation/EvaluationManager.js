import { BinaryScorer } from './BinaryScorer.js';
import { FivePointScorer } from './FivePointScorer.js';

/**
 * 评估管理器
 * 统一管理评分流程和结果汇总
 */
export class EvaluationManager {
  constructor(config, prompts) {
    this.config = config;
    this.modelConfig = config.model;
    this.dimensions = config.evaluation.dimensions;
    this.prompts = prompts;
    this.repeatTimes = config.evaluation.repeat_times || 3;
    
    this.initializeScorers();
  }

  /**
   * 异步创建EvaluationManager实例
   * @param {Object} configManager - 配置管理器实例
   * @returns {Promise<EvaluationManager>} EvaluationManager实例
   */
  static async create(configManager) {
    const config = configManager.config;
    const prompts = await configManager.getPrompts();
    return new EvaluationManager(config, prompts);
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
    
    // 显示最终评估结果
    this.displayFinalResults(query, evaluationResults);
    
    return evaluationResults;
  }

  /**
   * 评估单个搜索引擎的结果（支持重复评估）
   * @param {string} query - 搜索查询
   * @param {Object} engineResult - 搜索引擎结果
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateEngineResults(query, engineResult) {
    const evaluation = {
      engine: engineResult.engine,
      totalResults: engineResult.results.length,
      scores: {
        binary: [],
        five_point: []
      },
      averageScores: {},
      timestamp: new Date().toISOString(),
      repeatTimes: this.repeatTimes
    };

    console.log(`🔄 开始对 ${engineResult.engine} 进行 ${this.repeatTimes} 次重复评估`);
    console.log(`📋 评分制式说明:`);
    console.log(`   - 二分制评分: 使用 /Users/jackson/Zai/web-search-eval/prompts/binary/ 目录下的提示词文件`);
    console.log(`   - 五分制评分: 使用 /Users/jackson/Zai/web-search-eval/prompts/five_point/ 目录下的提示词文件`);
    console.log(`   - 评估维度: ${this.scorers.binary.dimensions.map(d => d.name).join('、')}`);

    // 进行重复评估
    for (let round = 1; round <= this.repeatTimes; round++) {
      console.log(`   📊 第 ${round}/${this.repeatTimes} 次评估 ${engineResult.engine}...`);

      // 使用二分制评分
      try {
        const binaryScore = await this.scorers.binary.batchScore(
          engineResult.results,
          query
        );
        evaluation.scores.binary.push({
          round,
          ...binaryScore,
          timestamp: new Date().toISOString()
        });
        
        // 显示二分制加权评分结果
        console.log(`      📊 二分制加权评分: ${binaryScore.weightedScore?.toFixed(2) || '计算失败'}分`);
        if (binaryScore.overallScores) {
          Object.entries(binaryScore.overallScores).forEach(([dimension, scoreObj]) => {
            const score = typeof scoreObj === 'object' ? scoreObj.score : scoreObj;
            console.log(`         - ${dimension}: ${score}分`);
          });
        }
      } catch (error) {
        console.error(`第${round}次二分制评分失败:`, error.message);
        evaluation.scores.binary.push({
          round,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // 使用五分制评分
      try {
        const fivePointScore = await this.scorers.five_point.batchScore(
          engineResult.results,
          query
        );
        evaluation.scores.five_point.push({
          round,
          ...fivePointScore,
          timestamp: new Date().toISOString()
        });
        
        // 显示五分制加权评分结果
        console.log(`      📊 五分制加权评分: ${fivePointScore.weightedScore?.toFixed(2) || '计算失败'}分`);
        if (fivePointScore.overallScores) {
          Object.entries(fivePointScore.overallScores).forEach(([dimension, scoreObj]) => {
            const score = typeof scoreObj === 'object' ? scoreObj.score : scoreObj;
            console.log(`         - ${dimension}: ${score}分`);
          });
        }
      } catch (error) {
        console.error(`第${round}次五分制评分失败:`, error.message);
        evaluation.scores.five_point.push({
          round,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      // 添加轮次间延迟
      if (round < this.repeatTimes) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 计算平均分（基于多次评估结果）
    evaluation.averageScores = this.calculateAverageScoresFromRepeats(evaluation.scores);

    // 显示三次评估的平均分
    console.log(`✅ ${engineResult.engine} 重复评估完成`);
    console.log(`📈 三次评估平均分汇总:`);
    
    if (evaluation.averageScores.binary) {
      console.log(`   二分制平均加权评分: ${evaluation.averageScores.binary.weighted?.toFixed(2) || '计算失败'}分`);
      if (evaluation.averageScores.binary.dimensions) {
        Object.entries(evaluation.averageScores.binary.dimensions).forEach(([dimension, score]) => {
          console.log(`      - ${dimension}: ${score.toFixed(2)}分`);
        });
      }
    }
    
    if (evaluation.averageScores.five_point) {
      console.log(`   五分制平均加权评分: ${evaluation.averageScores.five_point.weighted?.toFixed(2) || '计算失败'}分`);
      if (evaluation.averageScores.five_point.dimensions) {
        Object.entries(evaluation.averageScores.five_point.dimensions).forEach(([dimension, score]) => {
          console.log(`      - ${dimension}: ${score.toFixed(2)}分`);
        });
      }
    }
    
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
   * 计算重复评估的平均分
   * @param {Object} scores - 重复评估的分数结果
   * @returns {Object} 平均分统计
   */
  calculateAverageScoresFromRepeats(scores) {
    const averages = {};

    ['binary', 'five_point'].forEach(scoringType => {
      if (scores[scoringType] && scores[scoringType].length > 0) {
        averages[scoringType] = {
          dimensions: {},
          weighted: 0,
          rounds: []
        };

        // 收集所有有效的评估轮次
        const validRounds = scores[scoringType].filter(round => !round.error && round.weightedScore !== undefined);

        if (validRounds.length > 0) {
          // 计算各维度的平均分（跨所有轮次）
          this.dimensions.forEach(dimension => {
            const allDimensionScores = [];
            
            validRounds.forEach(round => {
              if (round.scores && round.scores[dimension.name] && round.scores[dimension.name].score !== undefined) {
                allDimensionScores.push(round.scores[dimension.name].score);
              }
            });

            if (allDimensionScores.length > 0) {
              averages[scoringType].dimensions[dimension.name] = 
                allDimensionScores.reduce((sum, score) => sum + score, 0) / allDimensionScores.length;
            }
          });

          // 计算加权平均分（跨所有轮次）
          const allWeightedScores = validRounds.map(round => round.weightedScore);
          averages[scoringType].weighted = 
            allWeightedScores.reduce((sum, score) => sum + score, 0) / allWeightedScores.length;

          // 保存每轮的详细结果
          averages[scoringType].rounds = validRounds.map(round => ({
            round: round.round,
            weighted: round.weightedScore,
            timestamp: round.timestamp
          }));
        }

        // 添加统计信息
        averages[scoringType].totalRounds = scores[scoringType].length;
        averages[scoringType].validRounds = validRounds.length;
        averages[scoringType].errorRounds = scores[scoringType].length - validRounds.length;
      }
    });

    return averages;
  }

  /**
   * 显示最终评估结果
   * @param {string} query - 搜索查询
   * @param {Object} evaluationResults - 评估结果
   */
  displayFinalResults(query, evaluationResults) {
    console.log('\n' + '='.repeat(80));
    console.log('🏆 最终评估结果');
    console.log(`📝 查询: "${query}"`);
    console.log(`⏰ 完成时间: ${new Date(evaluationResults.timestamp).toLocaleString()}`);
    console.log('='.repeat(80));

    // 显示各搜索引擎的评估结果
    console.log('\n📊 各搜索引擎评估结果:');
    const engineEntries = Object.entries(evaluationResults.engines);
    
    if (engineEntries.length === 0) {
      console.log('   ❌ 没有可用的搜索引擎结果');
      return;
    }

    // 收集有效的引擎结果并按得分排序
    const validEngines = engineEntries
      .filter(([_, result]) => !result.error && result.averageScores)
      .map(([engine, result]) => ({
        engine,
        score: result.averageScores.five_point?.weighted || 0,
        result
      }))
      .sort((a, b) => b.score - a.score);

    if (validEngines.length === 0) {
      console.log('   ❌ 所有搜索引擎都出现错误');
      engineEntries.forEach(([engine, result]) => {
        if (result.error) {
          console.log(`   ❌ ${engine}: ${result.error}`);
        }
      });
      return;
    }

    // 显示排名结果
    validEngines.forEach((item, index) => {
      const { engine, score, result } = item;
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '  ';
      
      console.log(`\n${medal} 第${rank}名: ${engine} - 总分: ${score.toFixed(2)}`);
      console.log(`   📈 结果数量: ${result.scoredResults?.length || 0}`);
      
      // 显示各维度得分
      if (result.averageScores?.five_point?.dimensions) {
        Object.entries(result.averageScores.five_point.dimensions).forEach(([dimension, dimScore]) => {
          console.log(`   📏 ${dimension}: ${dimScore.toFixed(2)}`);
        });
      }
    });

    // 显示失败的引擎
    const failedEngines = engineEntries.filter(([_, result]) => result.error);
    if (failedEngines.length > 0) {
      console.log('\n❌ 失败的搜索引擎:');
      failedEngines.forEach(([engine, result]) => {
        console.log(`   ❌ ${engine}: ${result.error}`);
      });
    }

    // 显示汇总统计
    console.log('\n📈 汇总统计:');
    console.log(`   ✅ 成功引擎: ${evaluationResults.summary.successfulEngines}/${evaluationResults.summary.totalEngines}`);
    console.log(`   ❌ 失败引擎: ${evaluationResults.summary.failedEngines}/${evaluationResults.summary.totalEngines}`);
    
    if (validEngines.length > 0) {
      const avgScore = validEngines.reduce((sum, item) => sum + item.score, 0) / validEngines.length;
      console.log(`   🎯 平均得分: ${avgScore.toFixed(2)}`);
      console.log(`   🏆 最佳引擎: ${validEngines[0].engine} (${validEngines[0].score.toFixed(2)}分)`);
    }

    console.log('='.repeat(80) + '\n');
  }

  /**
   * 生成汇总统计
   * @param {Object} engineResults - 各引擎评估结果
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