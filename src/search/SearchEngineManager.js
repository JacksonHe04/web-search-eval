import { JinaSearchEngine } from './JinaSearchEngine.js';
import { SerperSearchEngine } from './SerperSearchEngine.js';
import { ZhipuSearchEngine } from './ZhipuSearchEngine.js';

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

    console.log(`开始使用 ${enabledEngines.length} 个搜索引擎搜索: ${query}`);

    const searchPromises = enabledEngines.map(async (engine) => {
      try {
        return await this.searchWithEngine(engine.getName(), query, options);
      } catch (error) {
        console.error(`${engine.getName()} 搜索失败:`, error.message);
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
    console.log(`所有搜索引擎搜索完成`);
    
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