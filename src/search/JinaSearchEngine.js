import fetch from 'node-fetch';
import { SearchEngine } from './SearchEngine.js';

/**
 * Jina搜索引擎实现
 * 调用Jina API进行网络搜索
 */
export class JinaSearchEngine extends SearchEngine {
  constructor(config) {
    super('jina', config);
  }

  /**
   * 执行Jina搜索
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    if (!this.validateConfig()) {
      throw new Error('Jina搜索引擎配置无效');
    }

    try {
      const searchUrl = `${this.config.base_url}?q=${encodeURIComponent(query)}&hl=${options.language || 'zh-cn'}`;
      
      const response = await fetch(searchUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${this.config.api_key}`,
          'X-Respond-With': 'no-content'
        },
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return this.formatResults({
        query,
        total: data?.data?.length || 0,
        results: this.parseJinaResults(data?.data || []),
        raw: data
      });

    } catch (error) {
      console.error(`Jina搜索失败: ${error.message}`);
      throw new Error(`Jina搜索失败: ${error.message}`);
    }
  }

  /**
   * 解析Jina API返回的结果
   * @param {Array} rawResults - 原始结果数组
   * @returns {Array} 格式化的结果数组
   */
  parseJinaResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      return [];
    }

    return rawResults.map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.url || '',
      snippet: item.content || item.description || '',
      source: item.source || this.extractDomain(item.url),
      timestamp: item.publishedDate || null,
      score: item.score || null
    }));
  }

  /**
   * 从URL提取域名
   * @param {string} url - 完整URL
   * @returns {string} 域名
   */
  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }
}