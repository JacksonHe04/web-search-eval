import { DataProcessor } from '../data/DataProcessor.js';
import path from 'path';
import fs from 'fs/promises';

/**
 * 批量测试管理器
 * 负责批量测试的执行、重复测试和结果汇总
 */
export class BatchTestManager {
  constructor(searchEngineManager, evaluationManager, config) {
    this.searchEngineManager = searchEngineManager;
    this.evaluationManager = evaluationManager;
    this.config = config;
    this.dataProcessor = new DataProcessor();
    this.repeatTimes = config.evaluation?.repeat_times || 3;
  }

  /**
   * 执行批量测试
   * @param {string|Array} queriesInput - 查询文件路径或查询数组
   * @param {Object} options - 测试选项
   * @returns {Promise<Object>} 测试结果
   */
  async runBatchTest(queriesInput, options = {}) {
    console.log('开始批量测试...');
    
    // 获取查询列表
    const queries = await this.getQueries(queriesInput);
    console.log(`共 ${queries.length} 个查询待测试`);

    // 执行测试
    const testResults = await this.executeTests(queries, options);

    // 生成最终报告
    const finalReport = this.generateFinalReport(testResults);

    // 保存结果
    if (options.outputDir) {
      await this.saveResults(testResults, finalReport, options.outputDir);
    }

    console.log('批量测试完成');
    return {
      testResults,
      finalReport,
      summary: this.generateTestSummary(testResults)
    };
  }

  /**
   * 获取查询列表
   * @param {string|Array} queriesInput - 查询输入
   * @returns {Promise<Array>} 查询列表
   */
  async getQueries(queriesInput) {
    if (Array.isArray(queriesInput)) {
      return queriesInput;
    }

    if (typeof queriesInput === 'string') {
      return await this.dataProcessor.importQueries(queriesInput);
    }

    throw new Error('无效的查询输入格式');
  }

  /**
   * 执行测试
   * @param {Array} queries - 查询列表
   * @param {Object} options - 测试选项
   * @returns {Promise<Array>} 测试结果
   */
  async executeTests(queries, options) {
    const allTestResults = [];

    for (let round = 1; round <= this.repeatTimes; round++) {
      console.log(`\n=== 第 ${round}/${this.repeatTimes} 轮测试 ===`);
      
      const roundResults = [];

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        console.log(`\n处理查询 ${i + 1}/${queries.length} (第${round}轮): ${query}`);

        try {
          // 执行搜索
          const searchResults = await this.searchEngineManager.searchWithAllEngines(
            query,
            options.searchOptions || {}
          );

          // 执行评估
          const evaluationResult = await this.evaluationManager.evaluateQuery(
            query,
            searchResults
          );

          evaluationResult.round = round;
          evaluationResult.queryIndex = i;
          roundResults.push(evaluationResult);

          // 添加延迟避免API限制
          if (i < queries.length - 1 || round < this.repeatTimes) {
            await this.delay(options.delayMs || 2000);
          }

        } catch (error) {
          console.error(`查询 "${query}" 第${round}轮测试失败:`, error.message);
          roundResults.push({
            query,
            round,
            queryIndex: i,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }

      allTestResults.push({
        round,
        results: roundResults,
        timestamp: new Date().toISOString()
      });

      // 轮次间延迟
      if (round < this.repeatTimes) {
        console.log(`第${round}轮完成，等待 ${options.roundDelayMs || 5000}ms 后开始下一轮...`);
        await this.delay(options.roundDelayMs || 5000);
      }
    }

    return allTestResults;
  }

  /**
   * 生成最终报告
   * @param {Array} testResults - 所有轮次的测试结果
   * @returns {Object} 最终报告
   */
  generateFinalReport(testResults) {
    console.log('生成最终报告...');
    
    const report = {
      metadata: {
        total_rounds: testResults.length,
        total_queries: 0,
        generation_time: new Date().toISOString(),
        config_summary: {
          repeat_times: this.repeatTimes,
          enabled_engines: this.searchEngineManager.getEnabledEngines().map(e => e.getName()),
          dimensions: this.config.evaluation.dimensions.map(d => d.name)
        }
      },
      aggregated_results: {},
      round_by_round: testResults,
      engine_rankings: {},
      stability_analysis: {}
    };

    // 聚合所有轮次的结果
    const aggregatedData = this.aggregateResults(testResults);
    report.aggregated_results = aggregatedData;
    report.metadata.total_queries = aggregatedData.unique_queries;

    // 生成引擎排名
    report.engine_rankings = this.generateEngineRankings(aggregatedData);

    // 生成稳定性分析
    report.stability_analysis = this.analyzeStability(testResults);

    return report;
  }

  /**
   * 聚合多轮测试结果
   * @param {Array} testResults - 测试结果
   * @returns {Object} 聚合结果
   */
  aggregateResults(testResults) {
    const queryResults = {};
    const engineStats = {};

    testResults.forEach(roundData => {
      roundData.results.forEach(result => {
        if (result.error) return;

        const query = result.query;
        if (!queryResults[query]) {
          queryResults[query] = [];
        }
        queryResults[query].push(result);

        // 收集引擎统计
        Object.entries(result.engines || {}).forEach(([engineName, engineData]) => {
          if (!engineStats[engineName]) {
            engineStats[engineName] = {
              scores: { binary: [], five_point: [] },
              total_tests: 0,
              successful_tests: 0
            };
          }

          engineStats[engineName].total_tests++;

          if (!engineData.error) {
            engineStats[engineName].successful_tests++;
            
            ['binary', 'five_point'].forEach(scoringType => {
              const weightedScore = engineData.averageScores?.[scoringType]?.weighted;
              if (weightedScore !== undefined) {
                engineStats[engineName].scores[scoringType].push(weightedScore);
              }
            });
          }
        });
      });
    });

    // 计算每个引擎的平均性能
    const enginePerformance = {};
    Object.entries(engineStats).forEach(([engineName, stats]) => {
      enginePerformance[engineName] = {
        success_rate: stats.successful_tests / stats.total_tests,
        average_scores: {},
        score_stability: {}
      };

      ['binary', 'five_point'].forEach(scoringType => {
        const scores = stats.scores[scoringType];
        if (scores.length > 0) {
          const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
          const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
          
          enginePerformance[engineName].average_scores[scoringType] = {
            mean,
            min: Math.min(...scores),
            max: Math.max(...scores),
            std_dev: Math.sqrt(variance),
            count: scores.length
          };

          enginePerformance[engineName].score_stability[scoringType] = {
            coefficient_of_variation: mean > 0 ? Math.sqrt(variance) / mean : 0,
            range: Math.max(...scores) - Math.min(...scores)
          };
        }
      });
    });

    return {
      unique_queries: Object.keys(queryResults).length,
      total_tests: testResults.length * Object.keys(queryResults).length,
      query_results: queryResults,
      engine_performance: enginePerformance
    };
  }

  /**
   * 生成引擎排名
   * @param {Object} aggregatedData - 聚合数据
   * @returns {Object} 排名结果
   */
  generateEngineRankings(aggregatedData) {
    const rankings = {
      binary: [],
      five_point: [],
      combined: []
    };

    const enginePerformance = aggregatedData.engine_performance;

    ['binary', 'five_point'].forEach(scoringType => {
      const engineScores = Object.entries(enginePerformance)
        .map(([engineName, performance]) => ({
          engine: engineName,
          score: performance.average_scores[scoringType]?.mean || 0,
          stability: 1 - (performance.score_stability[scoringType]?.coefficient_of_variation || 1),
          success_rate: performance.success_rate
        }))
        .sort((a, b) => b.score - a.score);

      rankings[scoringType] = engineScores.map((item, index) => ({
        rank: index + 1,
        ...item
      }));
    });

    // 综合排名（考虑两种评分系统）
    const combinedScores = Object.entries(enginePerformance)
      .map(([engineName, performance]) => {
        const binaryScore = performance.average_scores.binary?.mean || 0;
        const fivePointScore = performance.average_scores.five_point?.mean || 0;
        
        // 标准化分数（二分制转换为0-1，五分制转换为0-1）
        const normalizedBinary = binaryScore / 2;
        const normalizedFivePoint = (fivePointScore - 1) / 4;
        
        return {
          engine: engineName,
          combined_score: (normalizedBinary + normalizedFivePoint) / 2,
          success_rate: performance.success_rate
        };
      })
      .sort((a, b) => b.combined_score - a.combined_score);

    rankings.combined = combinedScores.map((item, index) => ({
      rank: index + 1,
      ...item
    }));

    return rankings;
  }

  /**
   * 分析结果稳定性
   * @param {Array} testResults - 测试结果
   * @returns {Object} 稳定性分析
   */
  analyzeStability(testResults) {
    const stability = {
      overall_consistency: 0,
      engine_consistency: {},
      query_consistency: {}
    };

    // 这里可以添加更详细的稳定性分析逻辑
    // 例如计算各轮次间的分数变异系数等

    return stability;
  }

  /**
   * 保存测试结果
   * @param {Array} testResults - 测试结果
   * @param {Object} finalReport - 最终报告
   * @param {string} outputDir - 输出目录
   * @returns {Promise<void>}
   */
  async saveResults(testResults, finalReport, outputDir) {
    await fs.mkdir(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 保存详细结果
    await this.dataProcessor.exportResultsToJson(
      testResults,
      path.join(outputDir, `detailed_results_${timestamp}.json`)
    );

    // 保存最终报告
    await this.dataProcessor.exportResultsToJson(
      finalReport,
      path.join(outputDir, `final_report_${timestamp}.json`)
    );

    // 保存CSV格式的汇总
    const flattenedResults = this.flattenForCsv(testResults);
    await this.dataProcessor.exportResultsToCsv(
      flattenedResults,
      path.join(outputDir, `summary_${timestamp}.csv`)
    );

    console.log(`结果已保存到目录: ${outputDir}`);
  }

  /**
   * 扁平化结果用于CSV导出
   * @param {Array} testResults - 测试结果
   * @returns {Array} 扁平化数据
   */
  flattenForCsv(testResults) {
    const flatData = [];

    testResults.forEach(roundData => {
      roundData.results.forEach(result => {
        if (result.error) {
          flatData.push({
            round: result.round,
            query: result.query,
            error: result.error,
            timestamp: result.timestamp
          });
          return;
        }

        Object.entries(result.engines || {}).forEach(([engineName, engineData]) => {
          const baseRow = {
            round: result.round,
            query: result.query,
            engine: engineName,
            timestamp: result.timestamp
          };

          if (engineData.error) {
            flatData.push({
              ...baseRow,
              error: engineData.error
            });
          } else {
            ['binary', 'five_point'].forEach(scoringType => {
              const avgScores = engineData.averageScores?.[scoringType];
              if (avgScores) {
                flatData.push({
                  ...baseRow,
                  scoring_type: scoringType,
                  weighted_score: avgScores.weighted,
                  ...Object.fromEntries(
                    Object.entries(avgScores.dimensions || {}).map(([dim, score]) => 
                      [`${dim}_score`, score]
                    )
                  )
                });
              }
            });
          }
        });
      });
    });

    return flatData;
  }

  /**
   * 生成测试摘要
   * @param {Array} testResults - 测试结果
   * @returns {Object} 测试摘要
   */
  generateTestSummary(testResults) {
    const summary = {
      total_rounds: testResults.length,
      total_tests: 0,
      successful_tests: 0,
      failed_tests: 0,
      engines_tested: new Set(),
      queries_tested: new Set()
    };

    testResults.forEach(roundData => {
      roundData.results.forEach(result => {
        summary.total_tests++;
        summary.queries_tested.add(result.query);

        if (result.error) {
          summary.failed_tests++;
        } else {
          summary.successful_tests++;
          Object.keys(result.engines || {}).forEach(engine => {
            summary.engines_tested.add(engine);
          });
        }
      });
    });

    summary.engines_tested = Array.from(summary.engines_tested);
    summary.queries_tested = Array.from(summary.queries_tested);
    summary.success_rate = summary.successful_tests / summary.total_tests;

    return summary;
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}