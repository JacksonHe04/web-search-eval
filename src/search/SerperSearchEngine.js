import fetch from 'node-fetch';
import { SearchEngine } from './SearchEngine.js';

/**
 * Serper搜索引擎实现
 * 调用Serper API进行Google搜索
 */
export class SerperSearchEngine extends SearchEngine {
  constructor(config) {
    super('serper', config);
  }

  /**
   * 执行Serper搜索
   * @param {string} query - 搜索查询
   * @param {Object} options - 搜索选项
   * @returns {Promise<Object>} 搜索结果
   */
  async search(query, options = {}) {
    if (!this.validateConfig()) {
      throw new Error('Serper搜索引擎配置无效');
    }

    try {
      const requestData = {
        q: query,
        hl: options.language || 'zh-cn',
        num: options.maxResults || 10
      };

      const response = await fetch(this.config.base_url, {
        method: 'POST',
        headers: {
          'X-API-KEY': this.config.api_key,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData),
        timeout: 30000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      return this.formatResults({
        query,
        total: data?.searchInformation?.totalResults || 0,
        results: this.parseSerperResults(data?.organic || []),
        raw: data
      });

    } catch (error) {
      console.error(`Serper搜索失败: ${error.message}`);
      throw new Error(`Serper搜索失败: ${error.message}`);
    }
  }

  /**
   * 解析Serper API返回的结果
   * @param {Array} rawResults - 原始结果数组
   * @returns {Array} 格式化的结果数组
   */
  parseSerperResults(rawResults) {
    if (!Array.isArray(rawResults)) {
      return [];
    }

    return rawResults.map((item, index) => ({
      rank: index + 1,
      title: item.title || '',
      url: item.link || '',
      snippet: item.snippet || '',
      source: item.source || this.extractDomain(item.link),
      timestamp: item.date || null,
      score: item.position || null
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