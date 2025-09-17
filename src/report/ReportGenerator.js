import fs from 'fs/promises';
import path from 'path';

/**
 * 报告生成器
 * 生成多种格式的评估报告
 */
export class ReportGenerator {
  constructor() {
    this.templates = {
      html: this.getHtmlTemplate(),
      markdown: this.getMarkdownTemplate()
    };
  }

  /**
   * 生成完整报告
   * @param {Object} finalReport - 最终报告数据
   * @param {string} outputDir - 输出目录
   * @param {Object} options - 生成选项
   * @returns {Promise<Object>} 生成的文件路径
   */
  async generateReport(finalReport, outputDir, options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // 获取查询信息用于创建子目录
    const queryInfo = finalReport.metadata?.query_info || {};
    let queryName = '';
    
    if (queryInfo.query && queryInfo.query !== '未指定') {
      // 清理查询字符串，移除特殊字符
      queryName = queryInfo.query.replace(/[<>:"/\\|?*]/g, '_').substring(0, 50);
    } else if (queryInfo.queries && queryInfo.queries.length > 0) {
      // 多个查询的情况，使用第一个查询的前几个字符
      queryName = queryInfo.queries[0].replace(/[<>:"/\\|?*]/g, '_').substring(0, 30);
    }
    
    // 创建子目录名称：时间戳 + 查询名称
    const subDirName = queryName ? `${timestamp}_${queryName}` : timestamp;
    const reportOutputDir = path.join(outputDir, subDirName);
    
    await fs.mkdir(reportOutputDir, { recursive: true });
    
    const generatedFiles = {};

    // 生成HTML报告
    if (options.html !== false) {
      const htmlPath = path.join(reportOutputDir, `evaluation_report_${timestamp}.html`);
      await this.generateHtmlReport(finalReport, htmlPath);
      generatedFiles.html = htmlPath;
    }

    // 生成Markdown报告
    if (options.markdown !== false) {
      const mdPath = path.join(reportOutputDir, `evaluation_report_${timestamp}.md`);
      await this.generateMarkdownReport(finalReport, mdPath);
      generatedFiles.markdown = mdPath;
    }

    // 生成文本摘要
    if (options.summary !== false) {
      const summaryPath = path.join(reportOutputDir, `evaluation_summary_${timestamp}.txt`);
      await this.generateTextSummary(finalReport, summaryPath);
      generatedFiles.summary = summaryPath;
    }

    // 生成JSON结果文件
    if (options.json !== false) {
      const jsonPath = path.join(reportOutputDir, `evaluation_result_${timestamp}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(finalReport, null, 2), 'utf-8');
      generatedFiles.json = jsonPath;
      console.log(`JSON结果已生成: ${jsonPath}`);
    }

    console.log(`报告已生成到目录: ${reportOutputDir}`);
    return generatedFiles;
  }

  /**
   * 生成HTML报告
   * @param {Object} finalReport - 最终报告数据
   * @param {string} outputPath - 输出路径
   * @returns {Promise<void>}
   */
  async generateHtmlReport(finalReport, outputPath) {
    const htmlContent = this.buildHtmlContent(finalReport);
    await fs.writeFile(outputPath, htmlContent, 'utf-8');
    console.log(`HTML报告已生成: ${outputPath}`);
  }

  /**
   * 生成Markdown报告
   * @param {Object} finalReport - 最终报告数据
   * @param {string} outputPath - 输出路径
   * @returns {Promise<void>}
   */
  async generateMarkdownReport(finalReport, outputPath) {
    const markdownContent = this.buildMarkdownContent(finalReport);
    await fs.writeFile(outputPath, markdownContent, 'utf-8');
    console.log(`Markdown报告已生成: ${outputPath}`);
  }

  /**
   * 生成文本摘要
   * @param {Object} finalReport - 最终报告数据
   * @param {string} outputPath - 输出路径
   * @returns {Promise<void>}
   */
  async generateTextSummary(finalReport, outputPath) {
    const textContent = this.buildTextSummary(finalReport);
    await fs.writeFile(outputPath, textContent, 'utf-8');
    console.log(`文本摘要已生成: ${outputPath}`);
  }

  /**
   * 构建HTML内容
   * @param {Object} finalReport - 最终报告数据
   * @returns {string} HTML内容
   */
  buildHtmlContent(finalReport) {
    const metadata = finalReport.metadata || {};
    const engineRankings = finalReport.engine_rankings || {};
    const aggregatedResults = finalReport.aggregated_results || {};
    const configSummary = metadata.config_summary || {};

    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>搜索引擎评估报告</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; }
        h3 { color: #7f8c8d; }
        .metadata { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .ranking-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .ranking-table th, .ranking-table td { border: 1px solid #bdc3c7; padding: 12px; text-align: left; }
        .ranking-table th { background: #3498db; color: white; }
        .ranking-table tr:nth-child(even) { background: #f8f9fa; }
        .score-high { color: #27ae60; font-weight: bold; }
        .score-medium { color: #f39c12; font-weight: bold; }
        .score-low { color: #e74c3c; font-weight: bold; }
        .chart-container { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        .progress-bar { width: 100%; height: 20px; background: #ecf0f1; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #3498db, #2ecc71); transition: width 0.3s ease; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 搜索引擎评估报告</h1>
        
        <div class="metadata">
            <h3>📊 测试概览</h3>
            <p><strong>测试轮次:</strong> ${metadata.total_rounds || 1}</p>
            <p><strong>查询数量:</strong> ${metadata.total_queries || 1}</p>
            <p><strong>生成时间:</strong> ${metadata.generation_time ? new Date(metadata.generation_time).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')}</p>
            <p><strong>启用引擎:</strong> ${(configSummary.enabled_engines || []).join(', ')}</p>
            <p><strong>评估维度:</strong> ${(configSummary.dimensions || ['权威性', '相关性', '时效性']).join(', ')}</p>
        </div>

        <h2>🏆 引擎排名</h2>
        
        ${engineRankings.binary && engineRankings.binary.length > 0 ? `
        <h3>二分制评分排名</h3>
        <table class="ranking-table">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>搜索引擎</th>
                    <th>平均得分</th>
                </tr>
            </thead>
            <tbody>
                ${this.generateRankingTableRows(engineRankings.binary)}
            </tbody>
        </table>
        ` : ''}

        ${engineRankings.five_point && engineRankings.five_point.length > 0 ? `
        <h3>五分制评分排名</h3>
        <table class="ranking-table">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>搜索引擎</th>
                    <th>平均得分</th>
                </tr>
            </thead>
            <tbody>
                ${this.generateRankingTableRows(engineRankings.five_point)}
            </tbody>
        </table>
        ` : ''}

        ${engineRankings.combined && engineRankings.combined.length > 0 ? `
        <h3>综合排名</h3>
        <table class="ranking-table">
            <thead>
                <tr>
                    <th>排名</th>
                    <th>搜索引擎</th>
                    <th>综合得分</th>
                    <th>成功率</th>
                </tr>
            </thead>
            <tbody>
                ${this.generateCombinedRankingTableRows(engineRankings.combined)}
            </tbody>
        </table>
        ` : ''}

        ${aggregatedResults.engine_performance && Object.keys(aggregatedResults.engine_performance).length > 0 ? `
        <h2>📈 详细性能分析</h2>
        ${this.generatePerformanceAnalysis(aggregatedResults.engine_performance)}
        ` : ''}

        <h2>📋 测试配置</h2>
        <div class="metadata">
            <p><strong>重复测试次数:</strong> ${configSummary.repeat_times || 3}</p>
            <p><strong>评分维度权重:</strong></p>
            <ul>
                ${(configSummary.dimensions || ['权威性', '相关性', '时效性']).map(dim => `<li>${dim}: 权重待配置</li>`).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;
  }

  /**
   * 生成排名表格行
   * @param {Array} rankings - 排名数据
   * @returns {string} HTML表格行
   */
  generateRankingTableRows(rankings) {
    return rankings.map(item => `
        <tr>
            <td>${item.rank}</td>
            <td>${item.engine}</td>
            <td class="${this.getScoreClass(item.score)}">${item.score.toFixed(3)}</td>
            <td>${(item.stability * 100).toFixed(1)}%</td>
            <td>${(item.success_rate * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
  }

  /**
   * 生成综合排名表格行
   * @param {Array} rankings - 排名数据
   * @returns {string} HTML表格行
   */
  generateCombinedRankingTableRows(rankings) {
    return rankings.map(item => `
        <tr>
            <td>${item.rank}</td>
            <td>${item.engine}</td>
            <td class="${this.getScoreClass(item.combined_score)}">${item.combined_score.toFixed(3)}</td>
            <td>${(item.success_rate * 100).toFixed(1)}%</td>
        </tr>
    `).join('');
  }

  /**
   * 生成性能分析HTML
   * @param {Object} enginePerformance - 引擎性能数据
   * @returns {string} HTML内容
   */
  generatePerformanceAnalysis(enginePerformance) {
    return Object.entries(enginePerformance).map(([engineName, performance]) => `
        <div class="chart-container">
            <h4>${engineName} 性能详情</h4>
            <p><strong>成功率:</strong> ${(performance.success_rate * 100).toFixed(1)}%</p>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${performance.success_rate * 100}%"></div>
            </div>
            
            ${Object.entries(performance.average_scores).map(([scoringType, scores]) => `
                <p><strong>${scoringType === 'binary' ? '二分制' : '五分制'}平均分:</strong> ${scores.mean.toFixed(3)} (范围: ${scores.min.toFixed(3)} - ${scores.max.toFixed(3)})</p>
                <p><strong>标准差:</strong> ${scores.std_dev.toFixed(3)}</p>
            `).join('')}
        </div>
    `).join('');
  }

  /**
   * 构建Markdown内容
   * @param {Object} finalReport - 最终报告数据
   * @returns {string} Markdown内容
   */
  buildMarkdownContent(finalReport) {
    const metadata = finalReport.metadata || {};
    const engineRankings = finalReport.engine_rankings || {};
    const configSummary = metadata.config_summary || {};
    const aggregatedResults = finalReport.aggregated_results || {};
    const enginePerformance = aggregatedResults.engine_performance || {};

    let content = `# 🔍 搜索引擎评估报告

## 📊 测试概览

- **测试轮次:** ${metadata.total_rounds || 1}
- **查询数量:** ${metadata.total_queries || 1}
- **生成时间:** ${metadata.generation_time ? new Date(metadata.generation_time).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')}
- **启用引擎:** ${(configSummary.enabled_engines || []).join(', ')}
- **评估维度:** ${(configSummary.dimensions || ['权威性', '相关性', '时效性']).join(', ')}

## 🏆 引擎排名
`;

    // 添加二分制排名
    if (engineRankings.binary && engineRankings.binary.length > 0) {
      content += `
### 二分制评分排名

| 排名 | 搜索引擎 | 平均得分 |
|------|----------|----------|
${engineRankings.binary.map(item => 
  `| ${item.rank} | ${item.engine} | ${item.score.toFixed(3)} |`
).join('\n')}
`;
    }

    // 添加五分制排名
    if (engineRankings.five_point && engineRankings.five_point.length > 0) {
      content += `
### 五分制评分排名

| 排名 | 搜索引擎 | 平均得分 |
|------|----------|----------|
${engineRankings.five_point.map(item => 
  `| ${item.rank} | ${item.engine} | ${item.score.toFixed(3)} |`
).join('\n')}
`;
    }

    // 添加综合排名（如果存在）
    if (engineRankings.combined && engineRankings.combined.length > 0) {
      content += `
### 综合排名

| 排名 | 搜索引擎 | 综合得分 | 成功率 |
|------|----------|----------|--------|
${engineRankings.combined.map(item => 
  `| ${item.rank} | ${item.engine} | ${item.combined_score.toFixed(3)} | ${(item.success_rate * 100).toFixed(1)}% |`
).join('\n')}
`;
    }

    // 添加性能分析（如果存在）
    if (Object.keys(enginePerformance).length > 0) {
      content += `
## 📈 详细性能分析

${Object.entries(enginePerformance).map(([engineName, performance]) => `
### ${engineName}

- **成功率:** ${(performance.success_rate * 100).toFixed(1)}%
${Object.entries(performance.average_scores || {}).map(([scoringType, scores]) => `
- **${scoringType === 'binary' ? '二分制' : '五分制'}平均分:** ${scores.mean.toFixed(3)} (范围: ${scores.min.toFixed(3)} - ${scores.max.toFixed(3)})
- **标准差:** ${scores.std_dev.toFixed(3)}`).join('')}
`).join('')}
`;
    }

    content += `
---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

    return content;
  }

  /**
   * 构建文本摘要
   * @param {Object} finalReport - 最终报告数据
   * @returns {string} 文本内容
   */
  buildTextSummary(finalReport) {
    const metadata = finalReport.metadata || {};
    const engineRankings = finalReport.engine_rankings || {};

    // 安全获取配置信息
    const configSummary = metadata.config_summary || {};
    const enabledEngines = configSummary.enabled_engines || [];
    
    // 获取查询信息和时间信息
    const queryInfo = metadata.query_info || {};
    const testStartTime = metadata.test_start_time;
    const testEndTime = metadata.test_end_time || metadata.generation_time;
    
    let summary = `搜索引擎评估报告摘要
${'='.repeat(50)}

测试概览:
- 测试轮次: ${metadata.total_rounds || 1}
- 查询数量: ${metadata.total_queries || 1}
- 搜索查询: ${queryInfo.query || '未指定'}
- 生成时间: ${metadata.generation_time ? new Date(metadata.generation_time).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN')}
- 启用引擎: ${enabledEngines.join(', ')}`;

    // 添加总耗时信息
    if (testStartTime && testEndTime) {
      const startTime = new Date(testStartTime);
      const endTime = new Date(testEndTime);
      const totalTimeMs = endTime - startTime;
      const totalTimeSeconds = (totalTimeMs / 1000).toFixed(2);
      summary += `
- 总耗时: ${totalTimeSeconds}秒`;
    }

    summary += `
`;

    // 添加综合排名（如果存在）
    if (engineRankings.combined && engineRankings.combined.length > 0) {
      summary += `
综合排名 (前3名):
${engineRankings.combined.slice(0, 3).map((item, index) => 
  `${index + 1}. ${item.engine} - 综合得分: ${item.combined_score.toFixed(3)} (成功率: ${(item.success_rate * 100).toFixed(1)}%)`
).join('\n')}`;
    }

    // 添加二分制排名
    if (engineRankings.binary && engineRankings.binary.length > 0) {
      summary += `
二分制评分排名 (前3名):
${engineRankings.binary.slice(0, 3).map((item, index) => 
  `${index + 1}. ${item.engine} - 平均得分: ${item.score.toFixed(3)}`
).join('\n')}`;
    }

    // 添加五分制排名
    if (engineRankings.five_point && engineRankings.five_point.length > 0) {
      summary += `
五分制评分排名 (前3名):
${engineRankings.five_point.slice(0, 3).map((item, index) => 
  `${index + 1}. ${item.engine} - 平均得分: ${item.score.toFixed(3)}`
).join('\n')}`;
    }

    summary += `

${'='.repeat(50)}
报告生成时间: ${new Date().toLocaleString('zh-CN')}
`;

    return summary;
  }

  /**
   * 获取分数对应的CSS类
   * @param {number} score - 分数
   * @returns {string} CSS类名
   */
  getScoreClass(score) {
    if (score >= 0.8) return 'score-high';
    if (score >= 0.5) return 'score-medium';
    return 'score-low';
  }

  /**
   * 获取HTML模板
   * @returns {string} HTML模板
   */
  getHtmlTemplate() {
    return '<!-- HTML模板占位符 -->';
  }

  /**
   * 获取Markdown模板
   * @returns {string} Markdown模板
   */
  getMarkdownTemplate() {
    return '<!-- Markdown模板占位符 -->';
  }
}