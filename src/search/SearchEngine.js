/**
 * 搜索引擎基类
 * 定义所有搜索引擎的统一接口
 */
export class SearchEngine {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  /**
   * 执行搜索（抽象方法，需要子类实现）
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    throw new Error('search方法需要在子类中实现');
  }

  /**
   * 格式化搜索结果为统一格式
   * @param {Object} rawResults - 原始搜索结果
   * @returns {Object} 格式化后的结果
   */
  formatResults(rawResults) {
    return {
      engine: this.name,
      query: rawResults.query || '',
      total: rawResults.total || 0,
      results: rawResults.results || [],
      timestamp: new Date().toISOString(),
      raw: rawResults
    };
  }

  /**
   * 验证API配置
   * @returns {boolean} 配置是否有效
   */
  validateConfig() {
    return !!(this.config && this.config.api_key && this.config.base_url);
  }

  /**
   * 获取搜索引擎名称
   * @returns {string} 搜索引擎名称
   */
  getName() {
    return this.name;
  }

  /**
   * 检查搜索引擎是否启用
   * @returns {boolean} 是否启用
   */
  isEnabled() {
    return this.config?.enabled === true;
  }
}