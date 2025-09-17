import { ConfigManager } from './config/ConfigManager.js';
import { SearchEngineManager } from './search/SearchEngineManager.js';
import { EvaluationManager } from './evaluation/EvaluationManager.js';
import { BatchTestManager } from './batch/BatchTestManager.js';
import { ReportGenerator } from './report/ReportGenerator.js';
import { DataProcessor } from './data/DataProcessor.js';

/**
 * 网络搜索引擎评估系统主类
 * 整合所有功能模块，提供统一的API接口
 */
export class WebSearchEvaluationSystem {
  constructor(configPath = './config.json') {
    this.configPath = configPath;
    this.configManager = new ConfigManager(configPath);
    this.config = null;
    this.searchEngineManager = null;
    this.evaluationManager = null;
    this.batchTestManager = null;
    this.reportGenerator = new ReportGenerator();
    this.dataProcessor = new DataProcessor();
  }

  /**
   * 初始化系统
   * @returns {Promise<void>}
   */
  async initialize() {
    console.log('🚀 初始化搜索引擎评估系统...');
    
    try {
      // 加载配置
      this.config = await this.configManager.loadConfig();
      console.log('✅ 配置加载成功');

      // 初始化搜索引擎管理器
      this.searchEngineManager = new SearchEngineManager(this.config);
      console.log('✅ 搜索引擎管理器初始化完成');

      // 初始化评估管理器
      this.evaluationManager = new EvaluationManager(this.config);
      console.log('✅ 评估管理器初始化完成');

      // 初始化批量测试管理器
      this.batchTestManager = new BatchTestManager(
        this.searchEngineManager,
        this.evaluationManager,
        this.config
      );
      console.log('✅ 批量测试管理器初始化完成');

      console.log('🎉 系统初始化完成！');
      this.printSystemInfo();

    } catch (error) {
      console.error('❌ 系统初始化失败:', error.message);
      throw error;
    }
  }

  /**
   * 执行单个查询的评估
   * @param {string} query - 搜索查询
   * @param {Object} options - 评估选项
   * @returns {Promise<Object>} 评估结果
   */
  async evaluateSingleQuery(query, options = {}) {
    this.ensureInitialized();
    
    console.log(`🔍 开始评估查询: "${query}"`);
    
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

      console.log(`✅ 查询 "${query}" 评估完成`);
      return evaluationResult;

    } catch (error) {
      console.error(`❌ 查询 "${query}" 评估失败:`, error.message);
      throw error;
    }
  }

  /**
   * 执行批量测试
   * @param {string|Array} queriesInput - 查询文件路径或查询数组
   * @param {Object} options - 测试选项
   * @returns {Promise<Object>} 测试结果
   */
  async runBatchEvaluation(queriesInput, options = {}) {
    this.ensureInitialized();
    
    console.log('📊 开始批量评估...');
    
    try {
      const result = await this.batchTestManager.runBatchTest(queriesInput, options);
      
      // 生成报告
      if (options.generateReport !== false && options.outputDir) {
        await this.generateReports(result.finalReport, options.outputDir, options.reportOptions);
      }

      console.log('🎉 批量评估完成！');
      return result;

    } catch (error) {
      console.error('❌ 批量评估失败:', error.message);
      throw error;
    }
  }

  /**
   * 生成评估报告
   * @param {Object} finalReport - 最终报告数据
   * @param {string} outputDir - 输出目录
   * @param {Object} options - 报告选项
   * @returns {Promise<Object>} 生成的文件路径
   */
  async generateReports(finalReport, outputDir, options = {}) {
    console.log('📝 生成评估报告...');
    
    try {
      const generatedFiles = await this.reportGenerator.generateReport(
        finalReport,
        outputDir,
        options
      );

      console.log('✅ 报告生成完成');
      return generatedFiles;

    } catch (error) {
      console.error('❌ 报告生成失败:', error.message);
      throw error;
    }
  }

  /**
   * 测试搜索引擎连接
   * @returns {Promise<Object>} 连接测试结果
   */
  async testConnections() {
    this.ensureInitialized();
    
    console.log('🔗 测试搜索引擎连接...');
    
    const testQuery = '测试查询';
    const results = {};

    const enabledEngines = this.searchEngineManager.getEnabledEngines();
    
    for (const engine of enabledEngines) {
      const engineName = engine.getName();
      console.log(`测试 ${engineName} 连接...`);
      
      try {
        const result = await this.searchEngineManager.searchWithEngine(
          engineName,
          testQuery,
          { maxResults: 1 }
        );
        
        results[engineName] = {
          status: 'success',
          resultCount: result.results.length,
          responseTime: result.timestamp
        };
        
        console.log(`✅ ${engineName} 连接正常`);
        
      } catch (error) {
        results[engineName] = {
          status: 'failed',
          error: error.message
        };
        
        console.log(`❌ ${engineName} 连接失败: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * 获取系统状态
   * @returns {Object} 系统状态信息
   */
  getSystemStatus() {
    if (!this.config) {
      return { status: 'not_initialized' };
    }

    const engineStats = this.searchEngineManager.getEngineStats();
    
    return {
      status: 'initialized',
      config: {
        engines: engineStats,
        dimensions: this.config.evaluation.dimensions.map(d => d.name),
        repeatTimes: this.config.evaluation.repeat_times
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 创建示例文件
   * @param {string} outputDir - 输出目录
   * @returns {Promise<Object>} 创建的文件路径
   */
  async createSampleFiles(outputDir = './samples') {
    console.log('📁 创建示例文件...');
    
    const files = {};

    // 创建示例查询文件
    files.queries_json = `${outputDir}/sample_queries.json`;
    await this.dataProcessor.createSampleQueryFile(files.queries_json, 'json');

    files.queries_csv = `${outputDir}/sample_queries.csv`;
    await this.dataProcessor.createSampleQueryFile(files.queries_csv, 'csv');

    files.queries_txt = `${outputDir}/sample_queries.txt`;
    await this.dataProcessor.createSampleQueryFile(files.queries_txt, 'txt');

    console.log('✅ 示例文件创建完成');
    return files;
  }

  /**
   * 确保系统已初始化
   */
  ensureInitialized() {
    if (!this.config) {
      throw new Error('系统未初始化，请先调用 initialize() 方法');
    }
  }

  /**
   * 打印系统信息
   */
  printSystemInfo() {
    const engineStats = this.searchEngineManager.getEngineStats();
    
    console.log('\n📋 系统信息:');
    console.log(`   搜索引擎: ${engineStats.enabled}/${engineStats.total} 个已启用`);
    console.log(`   评估维度: ${this.config.evaluation.dimensions.length} 个`);
    console.log(`   重复测试: ${this.config.evaluation.repeat_times} 次`);
    console.log(`   启用引擎: ${engineStats.engines.join(', ')}`);
    console.log('');
  }
}

/**
 * 便捷函数：创建并初始化系统实例
 * @param {string} configPath - 配置文件路径
 * @returns {Promise<WebSearchEvaluationSystem>} 初始化后的系统实例
 */
export async function createEvaluationSystem(configPath = './config.json') {
  const system = new WebSearchEvaluationSystem(configPath);
  await system.initialize();
  return system;
}

// 如果直接运行此文件，执行演示
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 运行搜索引擎评估系统演示...\n');
  
  try {
    const system = await createEvaluationSystem();
    
    // 测试连接
    console.log('测试搜索引擎连接...');
    const connectionResults = await system.testConnections();
    console.log('连接测试结果:', connectionResults);
    
    // 创建示例文件
    await system.createSampleFiles();
    
    console.log('\n✅ 演示完成！');
    console.log('💡 使用提示:');
    console.log('   1. 配置 config.json 中的API密钥');
    console.log('   2. 使用 npm run eval 运行批量评估');
    console.log('   3. 查看 samples/ 目录中的示例文件');
    
  } catch (error) {
    console.error('❌ 演示失败:', error.message);
    console.log('\n💡 请检查:');
    console.log('   1. config.json 文件是否存在');
    console.log('   2. API密钥是否正确配置');
    console.log('   3. 网络连接是否正常');
  }
}