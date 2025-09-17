import { JinaSearchEngine } from './JinaSearchEngine.js';
import { SerperSearchEngine } from './SerperSearchEngine.js';
import { ZhipuSearchEngine } from './ZhipuSearchEngine.js';
import { ZhipuProSearchEngine } from './ZhipuProSearchEngine.js';
import { ZhipuSogouSearchEngine } from './ZhipuSogouSearchEngine.js';
import { ZhipuQuarkSearchEngine } from './ZhipuQuarkSearchEngine.js';

/**
 * 搜索引擎管理器
 * 统一管理和调用所有搜索引擎
 */
export class SearchEngineManager {
  constructor(config) {
    this.config = config;
    this.engines = new Map();
    this.initializeEngines();
  }

  /**
   * 初始化所有搜索引擎
   */
  initializeEngines() {
    const searchEnginesConfig = this.config.search_engines || {};

    // 初始化Jina搜索引擎
    if (searchEnginesConfig.jina?.enabled) {
      this.engines.set('jina', new JinaSearchEngine(searchEnginesConfig.jina));
    }

    // 初始化Serper搜索引擎
    if (searchEnginesConfig.serper?.enabled) {
      this.engines.set('serper', new SerperSearchEngine(searchEnginesConfig.serper));
    }

    // 初始化智谱搜索引擎
    if (searchEnginesConfig.zhipu?.enabled) {
      this.engines.set('zhipu', new ZhipuSearchEngine(searchEnginesConfig.zhipu));
    }

    // 初始化智谱Pro搜索引擎
    if (searchEnginesConfig.zhipu_pro?.enabled) {
      this.engines.set('zhipu_pro', new ZhipuProSearchEngine(searchEnginesConfig.zhipu_pro));
    }

    // 初始化智谱Sogou搜索引擎
    if (searchEnginesConfig.zhipu_sogou?.enabled) {
      this.engines.set('zhipu_sogou', new ZhipuSogouSearchEngine(searchEnginesConfig.zhipu_sogou));
    }

    // 初始化智谱Quark搜索引擎
    if (searchEnginesConfig.zhipu_quark?.enabled) {
      this.engines.set('zhipu_quark', new ZhipuQuarkSearchEngine(searchEnginesConfig.zhipu_quark));
    }

    console.log(`已初始化 ${this.engines.size} 个搜索引擎`);
  }

  /**
   * 获取所有启用的搜索引擎
   * @returns {Array} 搜索引擎列表
   */
  getEnabledEngines() {
    return Array.from(this.engines.values()).filter(engine => engine.isEnabled());
  }

  /**
   * 获取指定搜索引擎
   * @param {string} engineName - 搜索引擎名称
   * @returns {SearchEngine|null} 搜索引擎实例
   */
  getEngine(engineName) {
    return this.engines.get(engineName) || null;
  }

  /**
   * 使用单个搜索引擎执行搜索
   * @param {string} engineName - 搜索引擎名称
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async searchWithEngine(engineName, query, options = {}) {
    const engine = this.getEngine(engineName);
    if (!engine) {
      throw new Error(`搜索引擎 ${engineName} 不存在或未启用`);
    }

    try {
      console.log(`使用 ${engineName} 搜索: ${query}`);
      const result = await engine.search(query, options);
      console.log(`${engineName} 搜索完成，返回 ${result.results.length} 条结果`);
      return result;
    } catch (error) {
      console.error(`${engineName} 搜索失败:`, error.message);
      throw error;
    }
  }

  /**
   * 使用所有启用的搜索引擎执行搜索
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Array>} 所有搜索引擎的结果
   */
  async searchWithAllEngines(query, options = {}) {
    const enabledEngines = this.getEnabledEngines();
    
    if (enabledEngines.length === 0) {
      throw new Error('没有启用的搜索引擎');
    }

    console.log('\n' + '='.repeat(80));
    console.log(`🔍 开始搜索: "${query}"`);
    console.log(`📊 启用的搜索引擎数量: ${enabledEngines.length}`);
    console.log(`🎯 搜索引擎列表: ${enabledEngines.map(e => e.getName()).join(', ')}`);
    console.log('='.repeat(80));

    const searchPromises = enabledEngines.map(async (engine, index) => {
      try {
        console.log(`\n[${index + 1}/${enabledEngines.length}] 🚀 开始使用 ${engine.getName()} 搜索...`);
        const result = await this.searchWithEngine(engine.getName(), query, options);
        
        // 显示搜索结果摘要
        console.log(`✅ ${engine.getName()} 搜索完成:`);
        console.log(`   📈 结果数量: ${result.results.length}`);
        if (result.results.length > 0) {
          console.log(`   🔗 搜索结果详情:`);
          result.results.forEach((item, idx) => {
            // 格式化发布时间
            const publishTime = item.publishedDate || item.date || '未知时间';
            console.log(`      ${idx + 1}. ${item.title}（发布时间：${publishTime}）`);
            console.log(`         ${item.url}`);
          });
        }
        
        return result;
      } catch (error) {
        console.error(`❌ ${engine.getName()} 搜索失败: ${error.message}`);
        return {
          engine: engine.getName(),
          query,
          error: error.message,
          results: [],
          timestamp: new Date().toISOString()
        };
      }
    });

    const results = await Promise.all(searchPromises);
    
    // 显示搜索汇总
    console.log('\n' + '='.repeat(80));
    console.log('📋 搜索结果汇总:');
    let totalResults = 0;
    let successfulEngines = 0;
    
    results.forEach(result => {
      if (result.error) {
        console.log(`   ❌ ${result.engine}: 搜索失败 (${result.error})`);
      } else {
        console.log(`   ✅ ${result.engine}: ${result.results.length} 条结果`);
        totalResults += result.results.length;
        successfulEngines++;
      }
    });
    
    console.log(`\n📊 总计: ${successfulEngines}/${enabledEngines.length} 个引擎成功，共获得 ${totalResults} 条结果`);
    console.log('='.repeat(80) + '\n');
    
    return results;
  }

  /**
   * 获取搜索引擎统计信息
   * @returns {Object} 统计信息
   */
  getEngineStats() {
    const totalEngines = this.engines.size;
    const enabledEngines = this.getEnabledEngines().length;
    
    return {
      total: totalEngines,
      enabled: enabledEngines,
      disabled: totalEngines - enabledEngines,
      engines: Array.from(this.engines.keys())
    };
  }
}