import fs from 'fs/promises';
import csv from 'csv-parser';
import createCsvWriter from 'csv-writer';
import path from 'path';
import { createReadStream } from 'fs';

/**
 * 数据处理器
 * 负责查询数据的导入和结果的导出
 */
export class DataProcessor {
  constructor() {
    this.supportedFormats = ['json', 'csv', 'txt'];
  }

  /**
   * 从文件导入查询数据
   * @param {string} filePath - 文件路径
   * @returns {Promise<Array>} 查询列表
   */
  async importQueries(filePath) {
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      throw new Error(`文件不存在: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    
    switch (ext) {
      case '.json':
        return this.importFromJson(filePath);
      case '.csv':
        return this.importFromCsv(filePath);
      case '.txt':
        return this.importFromTxt(filePath);
      default:
        throw new Error(`不支持的文件格式: ${ext}`);
    }
  }

  /**
   * 从JSON文件导入查询
   * @param {string} filePath - JSON文件路径
   * @returns {Promise<Array>} 查询列表
   */
  async importFromJson(filePath) {
    try {
      const data = await fs.readJson(filePath);
      
      if (Array.isArray(data)) {
        return data.map(item => typeof item === 'string' ? item : item.query || item.q || '');
      } else if (data.queries && Array.isArray(data.queries)) {
        return data.queries;
      } else {
        throw new Error('JSON格式不正确，应为查询数组或包含queries字段的对象');
      }
    } catch (error) {
      throw new Error(`读取JSON文件失败: ${error.message}`);
    }
  }

  /**
   * 从CSV文件导入查询
   * @param {string} filePath - CSV文件路径
   * @returns {Promise<Array>} 查询列表
   */
  async importFromCsv(filePath) {
    return new Promise((resolve, reject) => {
      const queries = [];
      
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          // 尝试从不同的列名获取查询
          const query = row.query || row.q || row.search || row.keyword || 
                       Object.values(row)[0] || '';
          
          if (query.trim()) {
            queries.push(query.trim());
          }
        })
        .on('end', () => {
          resolve(queries);
        })
        .on('error', (error) => {
          reject(new Error(`读取CSV文件失败: ${error.message}`));
        });
    });
  }

  /**
   * 从TXT文件导入查询（每行一个查询）
   * @param {string} filePath - TXT文件路径
   * @returns {Promise<Array>} 查询列表
   */
  async importFromTxt(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    } catch (error) {
      throw new Error(`读取TXT文件失败: ${error.message}`);
    }
  }

  /**
   * 导出评估结果到JSON文件
   * @param {Array} results - 评估结果
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<void>}
   */
  async exportResultsToJson(results, outputPath) {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
      console.log(`结果已导出到: ${outputPath}`);
    } catch (error) {
      throw new Error(`导出JSON失败: ${error.message}`);
    }
  }

  /**
   * 导出评估结果到CSV文件
   * @param {Array} results - 评估结果
   * @param {string} outputPath - 输出文件路径
   * @returns {Promise<void>}
   */
  async exportResultsToCsv(results, outputPath) {
    try {
      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      
      // 准备CSV数据
      const csvData = this.flattenResultsForCsv(results);
      
      if (csvData.length === 0) {
        throw new Error('没有可导出的数据');
      }

      // 创建CSV写入器
      const csvWriter = createCsvWriter.createObjectCsvWriter({
        path: outputPath,
        header: Object.keys(csvData[0]).map(key => ({ id: key, title: key }))
      });

      await csvWriter.writeRecords(csvData);
      console.log(`结果已导出到: ${outputPath}`);
    } catch (error) {
      throw new Error(`导出CSV失败: ${error.message}`);
    }
  }

  /**
   * 将嵌套的评估结果扁平化为CSV格式
   * @param {Array} results - 评估结果
   * @returns {Array} 扁平化的数据
   */
  flattenResultsForCsv(results) {
    const flatData = [];

    results.forEach(result => {
      if (result.error) {
        flatData.push({
          query: result.query,
          timestamp: result.timestamp,
          error: result.error
        });
        return;
      }

      Object.entries(result.engines).forEach(([engineName, engineData]) => {
        if (engineData.error) {
          flatData.push({
            query: result.query,
            engine: engineName,
            error: engineData.error,
            timestamp: result.timestamp
          });
        } else {
          // 添加引擎级别的汇总数据
          const row = {
            query: result.query,
            engine: engineName,
            total_results: engineData.totalResults,
            timestamp: result.timestamp
          };

          // 添加平均分数据
          ['binary', 'five_point'].forEach(scoringType => {
            const avgScores = engineData.averageScores?.[scoringType];
            if (avgScores) {
              row[`${scoringType}_weighted_avg`] = avgScores.weighted;
              
              Object.entries(avgScores.dimensions || {}).forEach(([dim, score]) => {
                row[`${scoringType}_${dim}_avg`] = score;
              });
            }
          });

          flatData.push(row);
        }
      });
    });

    return flatData;
  }

  /**
   * 生成汇总报告
   * @param {Array} results - 评估结果
   * @returns {Object} 汇总报告
   */
  generateSummaryReport(results) {
    const report = {
      overview: {
        total_queries: results.length,
        successful_queries: 0,
        failed_queries: 0,
        total_engines: 0,
        generation_time: new Date().toISOString()
      },
      engine_performance: {},
      dimension_analysis: {},
      scoring_comparison: {}
    };

    const engineStats = {};
    const dimensionStats = {};

    results.forEach(result => {
      if (result.error) {
        report.overview.failed_queries++;
        return;
      }

      report.overview.successful_queries++;

      Object.entries(result.engines).forEach(([engineName, engineData]) => {
        if (!engineStats[engineName]) {
          engineStats[engineName] = {
            total_queries: 0,
            successful_queries: 0,
            failed_queries: 0,
            scores: { binary: [], five_point: [] }
          };
        }

        engineStats[engineName].total_queries++;

        if (engineData.error) {
          engineStats[engineName].failed_queries++;
        } else {
          engineStats[engineName].successful_queries++;

          // 收集分数数据
          ['binary', 'five_point'].forEach(scoringType => {
            const weightedScore = engineData.averageScores?.[scoringType]?.weighted;
            if (weightedScore !== undefined) {
              engineStats[engineName].scores[scoringType].push(weightedScore);
            }
          });
        }
      });
    });

    // 计算引擎性能统计
    Object.entries(engineStats).forEach(([engineName, stats]) => {
      report.engine_performance[engineName] = {
        success_rate: stats.successful_queries / stats.total_queries,
        average_scores: {}
      };

      ['binary', 'five_point'].forEach(scoringType => {
        const scores = stats.scores[scoringType];
        if (scores.length > 0) {
          report.engine_performance[engineName].average_scores[scoringType] = {
            mean: scores.reduce((sum, score) => sum + score, 0) / scores.length,
            min: Math.min(...scores),
            max: Math.max(...scores),
            count: scores.length
          };
        }
      });
    });

    report.overview.total_engines = Object.keys(engineStats).length;

    return report;
  }

  /**
   * 创建示例查询文件
   * @param {string} outputPath - 输出路径
   * @param {string} format - 文件格式 (json/csv/txt)
   * @returns {Promise<void>}
   */
  async createSampleQueryFile(outputPath, format = 'json') {
    const sampleQueries = [
      'JavaScript异步编程最佳实践',
      'React性能优化技巧',
      '机器学习入门教程',
      'Python数据分析库',
      'Vue.js组件开发指南'
    ];

    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    switch (format.toLowerCase()) {
      case 'json':
        await fs.writeFile(outputPath, JSON.stringify({ queries: sampleQueries }, null, 2));
        break;
      case 'csv':
        const csvWriter = createCsvWriter.createObjectCsvWriter({
          path: outputPath,
          header: [{ id: 'query', title: 'query' }]
        });
        await csvWriter.writeRecords(sampleQueries.map(q => ({ query: q })));
        break;
      case 'txt':
        await fs.writeFile(outputPath, sampleQueries.join('\n'));
        break;
      default:
        throw new Error(`不支持的格式: ${format}`);
    }

    console.log(`示例查询文件已创建: ${outputPath}`);
  }
}